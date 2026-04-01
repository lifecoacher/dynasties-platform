import { db } from "@workspace/db";
import {
  shipmentAiStateTable,
  shipmentAiAnalysisRunsTable,
  aiEventLogTable,
  complianceScreeningsTable,
  riskScoresTable,
  exceptionsTable,
  recommendationsTable,
} from "@workspace/db/schema";
import { eq, and, inArray, sql, desc } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import { createHash } from "crypto";

const COALESCE_WINDOW_MS = 5_000;
const MIN_REANALYSIS_INTERVAL_MS = 30_000;

const pendingCoalesceTimers = new Map<string, NodeJS.Timeout>();
const coalescedEvents = new Map<
  string,
  Array<{
    triggerType: string;
    triggerSourceEntityId?: string;
    triggerSourceEntityType?: string;
    receivedAt: number;
  }>
>();

export interface CoalesceDecision {
  shouldAnalyze: boolean;
  reason: string;
  coalescedTriggers?: string[];
  inputHash?: string;
}

export async function computeInputHash(
  shipmentId: string,
  companyId: string,
): Promise<string> {
  const [compliance] = await db
    .select({
      status: complianceScreeningsTable.status,
    })
    .from(complianceScreeningsTable)
    .where(
      and(
        eq(complianceScreeningsTable.shipmentId, shipmentId),
        eq(complianceScreeningsTable.companyId, companyId),
      ),
    )
    .limit(1);

  const [risk] = await db
    .select({
      compositeScore: riskScoresTable.compositeScore,
    })
    .from(riskScoresTable)
    .where(
      and(
        eq(riskScoresTable.shipmentId, shipmentId),
        eq(riskScoresTable.companyId, companyId),
      ),
    )
    .limit(1);

  const exceptionResult = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(exceptionsTable)
    .where(
      and(
        eq(exceptionsTable.shipmentId, shipmentId),
        eq(exceptionsTable.companyId, companyId),
      ),
    );

  const activeRecs = await db
    .select({
      fingerprint: recommendationsTable.fingerprint,
      status: recommendationsTable.status,
    })
    .from(recommendationsTable)
    .where(
      and(
        eq(recommendationsTable.shipmentId, shipmentId),
        eq(recommendationsTable.companyId, companyId),
        inArray(recommendationsTable.status, ["PENDING", "SHOWN"]),
      ),
    )
    .orderBy(recommendationsTable.fingerprint);

  const hashInput = JSON.stringify({
    compliance: compliance?.status ?? null,
    risk: risk?.compositeScore ?? null,
    exceptionCount: Number(exceptionResult[0]?.count ?? 0),
    activeRecFingerprints: activeRecs.map((r) => r.fingerprint),
  });

  return createHash("sha256").update(hashInput).digest("hex").slice(0, 16);
}

export async function shouldCoalesce(
  shipmentId: string,
  companyId: string,
  triggerType: string,
): Promise<CoalesceDecision> {
  const alwaysAnalyzeTriggers = ["MANUAL", "RECOMMENDATION_RESPONDED"];
  if (alwaysAnalyzeTriggers.includes(triggerType)) {
    return { shouldAnalyze: true, reason: "priority_trigger" };
  }

  const [lastRun] = await db
    .select({
      completedAt: shipmentAiAnalysisRunsTable.completedAt,
      status: shipmentAiAnalysisRunsTable.status,
    })
    .from(shipmentAiAnalysisRunsTable)
    .where(
      and(
        eq(shipmentAiAnalysisRunsTable.shipmentId, shipmentId),
        eq(shipmentAiAnalysisRunsTable.companyId, companyId),
      ),
    )
    .orderBy(desc(shipmentAiAnalysisRunsTable.createdAt))
    .limit(1);

  if (lastRun?.status === "STARTED") {
    return { shouldAnalyze: false, reason: "analysis_in_progress" };
  }

  const inputHash = await computeInputHash(shipmentId, companyId);

  const [aiState] = await db
    .select({ lastInputHash: shipmentAiStateTable.lastInputHash })
    .from(shipmentAiStateTable)
    .where(
      and(
        eq(shipmentAiStateTable.shipmentId, shipmentId),
        eq(shipmentAiStateTable.companyId, companyId),
      ),
    )
    .limit(1);

  if (aiState?.lastInputHash === inputHash) {
    return {
      shouldAnalyze: false,
      reason: "no_material_change",
      inputHash,
    };
  }

  if (lastRun?.completedAt) {
    const elapsed = Date.now() - new Date(lastRun.completedAt).getTime();
    if (elapsed < MIN_REANALYSIS_INTERVAL_MS) {
      return {
        shouldAnalyze: false,
        reason: "min_interval_not_elapsed",
        inputHash,
      };
    }
  }

  return { shouldAnalyze: true, reason: "material_change_detected", inputHash };
}

export function queueCoalescedEvent(
  shipmentId: string,
  triggerType: string,
  triggerSourceEntityId?: string,
  triggerSourceEntityType?: string,
): void {
  const key = shipmentId;
  const events = coalescedEvents.get(key) ?? [];
  events.push({
    triggerType,
    triggerSourceEntityId,
    triggerSourceEntityType,
    receivedAt: Date.now(),
  });
  coalescedEvents.set(key, events);
}

export function getAndClearCoalescedEvents(
  shipmentId: string,
): Array<{
  triggerType: string;
  triggerSourceEntityId?: string;
}> {
  const events = coalescedEvents.get(shipmentId) ?? [];
  coalescedEvents.delete(shipmentId);
  return events;
}

export function hasPendingCoalesce(shipmentId: string): boolean {
  return pendingCoalesceTimers.has(shipmentId);
}

export function scheduleCoalescedAnalysis(
  shipmentId: string,
  callback: () => Promise<void>,
): void {
  const existing = pendingCoalesceTimers.get(shipmentId);
  if (existing) {
    clearTimeout(existing);
  }

  const timer = setTimeout(async () => {
    pendingCoalesceTimers.delete(shipmentId);
    try {
      await callback();
    } catch (err) {
      console.error(
        `[event-coalescing] coalesced analysis failed for shipment=${shipmentId}:`,
        err,
      );
    }
  }, COALESCE_WINDOW_MS);

  pendingCoalesceTimers.set(shipmentId, timer);
}

export async function logCoalescedEvent(
  companyId: string,
  shipmentId: string,
  coalescedTriggers: string[],
  decision: CoalesceDecision,
): Promise<void> {
  const eventType = decision.shouldAnalyze
    ? ("AI_EVENT_COALESCED" as const)
    : ("AI_ANALYSIS_SKIPPED_NO_CHANGE" as const);

  await db.insert(aiEventLogTable).values({
    id: generateId(),
    companyId,
    shipmentId,
    eventType,
    details: {
      coalescedTriggers,
      reason: decision.reason,
      inputHash: decision.inputHash,
    },
  });
}
