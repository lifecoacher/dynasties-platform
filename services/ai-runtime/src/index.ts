import { db } from "@workspace/db";
import {
  shipmentAiStateTable,
  shipmentAiAnalysisRunsTable,
  aiEventLogTable,
  recommendationsTable,
  shipmentsTable,
  complianceScreeningsTable,
  riskScoresTable,
  insuranceQuotesTable,
  exceptionsTable,
  shipmentChargesTable,
  workflowTasksTable,
} from "@workspace/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import { runDecisionEngine } from "@workspace/svc-decision-engine";
import type { AiTriggerType } from "@workspace/db/schema";
import { syncTasksFromRecommendations } from "./task-sync.js";
import {
  shouldCoalesce,
  computeInputHash,
  logCoalescedEvent,
} from "./event-coalescing.js";

export interface ReanalysisRequest {
  shipmentId: string;
  companyId: string;
  triggerType: AiTriggerType;
  triggerSourceEntityId?: string;
  triggerSourceEntityType?: string;
}

const URGENCY_ORDER: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export async function ensureAiState(
  shipmentId: string,
  companyId: string,
): Promise<typeof shipmentAiStateTable.$inferSelect> {
  const [existing] = await db
    .select()
    .from(shipmentAiStateTable)
    .where(
      and(
        eq(shipmentAiStateTable.shipmentId, shipmentId),
        eq(shipmentAiStateTable.companyId, companyId),
      ),
    )
    .limit(1);

  if (existing) return existing;

  const id = generateId();
  const [created] = await db
    .insert(shipmentAiStateTable)
    .values({
      id,
      companyId,
      shipmentId,
      analysisStatus: "PENDING",
      analysisVersion: 0,
      activeRecommendationCount: 0,
      usedDeterministicFallback: false,
      isStale: false,
    })
    .onConflictDoNothing()
    .returning();

  if (created) {
    await db.insert(aiEventLogTable).values({
      id: generateId(),
      companyId,
      shipmentId,
      eventType: "AI_STATE_CREATED",
      details: { trigger: "ensureAiState" },
    });
    return created;
  }

  const [refetched] = await db
    .select()
    .from(shipmentAiStateTable)
    .where(eq(shipmentAiStateTable.shipmentId, shipmentId))
    .limit(1);
  return refetched!;
}

export async function runShipmentAnalysis(
  request: ReanalysisRequest,
): Promise<{ runId: string; success: boolean; error?: string }> {
  const { shipmentId, companyId, triggerType, triggerSourceEntityId, triggerSourceEntityType } = request;

  const coalesceDecision = await shouldCoalesce(shipmentId, companyId, triggerType);

  if (!coalesceDecision.shouldAnalyze) {
    console.log(
      `[ai-runtime] skipping analysis for shipment=${shipmentId} reason=${coalesceDecision.reason}`,
    );
    await logCoalescedEvent(companyId, shipmentId, [triggerType], coalesceDecision);
    return { runId: "", success: true, error: coalesceDecision.reason };
  }

  const currentState = await ensureAiState(shipmentId, companyId);
  const runId = generateId();
  const startedAt = new Date();
  const newVersion = currentState.analysisVersion + 1;

  const beforeState = {
    riskScore: currentState.riskScore,
    analysisVersion: currentState.analysisVersion,
    activeRecommendationCount: currentState.activeRecommendationCount,
  };

  await db.insert(shipmentAiAnalysisRunsTable).values({
    id: runId,
    companyId,
    shipmentId,
    triggerType,
    triggerSourceEntityId: triggerSourceEntityId ?? null,
    triggerSourceEntityType: triggerSourceEntityType ?? null,
    status: "STARTED",
    analysisVersion: newVersion,
    beforeState,
    startedAt,
  });

  await db
    .update(shipmentAiStateTable)
    .set({ analysisStatus: "ANALYZING", lastAnalysisRunId: runId })
    .where(eq(shipmentAiStateTable.id, currentState.id));

  await db.insert(aiEventLogTable).values({
    id: generateId(),
    companyId,
    shipmentId,
    eventType: "AI_REANALYSIS_STARTED",
    analysisRunId: runId,
    details: { triggerType, triggerSourceEntityId },
  });

  try {
    const result = await runDecisionEngine(shipmentId, companyId);

    const inputMeta = await gatherInputMeta(shipmentId, companyId);

    const activeRecs = await db
      .select()
      .from(recommendationsTable)
      .where(
        and(
          eq(recommendationsTable.shipmentId, shipmentId),
          eq(recommendationsTable.companyId, companyId),
          inArray(recommendationsTable.status, ["PENDING", "SHOWN"]),
        ),
      );

    await db
      .update(recommendationsTable)
      .set({ analysisRunId: runId })
      .where(
        and(
          eq(recommendationsTable.shipmentId, shipmentId),
          eq(recommendationsTable.companyId, companyId),
          inArray(recommendationsTable.status, ["PENDING", "SHOWN"]),
        ),
      );

    const taskSyncResult = await syncTasksFromRecommendations(
      shipmentId,
      companyId,
      activeRecs,
      runId,
    );

    const riskScore = await computeCurrentRiskScore(shipmentId, companyId);
    const complianceRisk = await computeComplianceRisk(shipmentId, companyId);
    const operationalReadiness = await computeOperationalReadiness(shipmentId, companyId);

    const usedFallback = result.aiEnrichment?.status === "fallback" || result.aiEnrichment?.status === "error";

    const actionsSummary = activeRecs.map((r) => r.title);
    const issuesSummary = activeRecs
      .filter((r) => ["HIGH", "CRITICAL"].includes(r.urgency))
      .map((r) => ({
        type: r.type,
        severity: r.urgency,
        description: r.title,
      }));

    const confidenceScore = computeConfidence(activeRecs, usedFallback);

    const highestUrgency = activeRecs.reduce<string | null>((highest, r) => {
      if (!highest) return r.urgency;
      return (URGENCY_ORDER[r.urgency] ?? 0) > (URGENCY_ORDER[highest] ?? 0)
        ? r.urgency
        : highest;
    }, null);

    const inputHash = await computeInputHash(shipmentId, companyId);

    const afterStateData = {
      riskScore,
      analysisVersion: newVersion,
      activeRecommendationCount: activeRecs.length,
    };

    const outputSummary = {
      riskScore,
      complianceRisk,
      marginRisk: null as number | null,
      operationalReadiness,
      confidenceScore,
      recommendationsCreated: result.recommendationsCreated,
      recommendationsSuperseded: result.recommendationsSuperseded,
      recommendationsDeduplicated: result.recommendationsDeduplicated,
      tasksCreated: taskSyncResult.created,
      tasksUpdated: taskSyncResult.updated,
    };

    await db.transaction(async (tx) => {
      await tx
        .update(shipmentAiStateTable)
        .set({
          analysisStatus: "CURRENT",
          analysisVersion: newVersion,
          lastAnalyzedAt: new Date(),
          lastTriggerEvent: triggerType,
          lastTriggerSource: triggerSourceEntityId ?? null,
          lastAnalysisRunId: runId,
          riskScore,
          complianceRisk,
          operationalReadiness,
          confidenceScore,
          recommendedActionsSummary: actionsSummary,
          explanationSnapshot: result.aiEnrichment?.status === "success"
            ? "AI-enriched analysis complete"
            : "Deterministic analysis (AI fallback)",
          activeIssuesSummary: issuesSummary,
          activeRecommendationCount: activeRecs.length,
          highestUrgency: highestUrgency as any,
          lastInputHash: inputHash,
          lastFailedAt: null,
          usedDeterministicFallback: usedFallback,
          isStale: false,
        })
        .where(eq(shipmentAiStateTable.id, currentState.id));

      await tx
        .update(shipmentAiAnalysisRunsTable)
        .set({
          status: "COMPLETED",
          analysisVersion: newVersion,
          inputSnapshotMeta: inputMeta,
          outputSummary,
          modelUsed: result.aiEnrichment?.model ?? null,
          inputTokens: result.aiEnrichment?.inputTokens ?? null,
          outputTokens: result.aiEnrichment?.outputTokens ?? null,
          latencyMs: result.aiEnrichment?.latencyMs ?? null,
          usedFallback,
          afterState: afterStateData,
          completedAt: new Date(),
        })
        .where(eq(shipmentAiAnalysisRunsTable.id, runId));

      await tx.insert(aiEventLogTable).values({
        id: generateId(),
        companyId,
        shipmentId,
        eventType: "AI_REANALYSIS_COMPLETED",
        analysisRunId: runId,
        details: {
          version: newVersion,
          recsCreated: result.recommendationsCreated,
          recsSuperseded: result.recommendationsSuperseded,
          tasksCreated: taskSyncResult.created,
          tasksUpdated: taskSyncResult.updated,
          usedFallback,
          riskScore,
        },
      });

      if (usedFallback) {
        await tx.insert(aiEventLogTable).values({
          id: generateId(),
          companyId,
          shipmentId,
          eventType: "AI_FALLBACK_USED",
          analysisRunId: runId,
          details: { reason: result.aiEnrichment?.errorMessage ?? "model_unavailable" },
        });
      }

      if (taskSyncResult.created > 0 || taskSyncResult.updated > 0) {
        await tx.insert(aiEventLogTable).values({
          id: generateId(),
          companyId,
          shipmentId,
          eventType: "AI_TASKS_SYNCED",
          analysisRunId: runId,
          details: {
            created: taskSyncResult.created,
            updated: taskSyncResult.updated,
            suppressed: taskSyncResult.suppressed,
          },
        });
      }
    });

    console.log(
      `[ai-runtime] analysis complete: shipment=${shipmentId} v${newVersion} recs=${activeRecs.length} tasks=${taskSyncResult.created}/${taskSyncResult.updated} fallback=${usedFallback}`,
    );

    return { runId, success: true };
  } catch (err: any) {
    console.error(`[ai-runtime] analysis failed for shipment=${shipmentId}:`, err);

    await db
      .update(shipmentAiAnalysisRunsTable)
      .set({
        status: "FAILED",
        errorMessage: err.message || "Unknown error",
        completedAt: new Date(),
      })
      .where(eq(shipmentAiAnalysisRunsTable.id, runId));

    await db
      .update(shipmentAiStateTable)
      .set({ analysisStatus: "FAILED", isStale: true, lastFailedAt: new Date() })
      .where(eq(shipmentAiStateTable.id, currentState.id));

    await db.insert(aiEventLogTable).values({
      id: generateId(),
      companyId,
      shipmentId,
      eventType: "AI_REANALYSIS_FAILED",
      analysisRunId: runId,
      details: { error: err.message },
    });

    return { runId, success: false, error: err.message };
  }
}

async function gatherInputMeta(shipmentId: string, companyId: string) {
  const [compliance] = await db
    .select({ status: complianceScreeningsTable.status })
    .from(complianceScreeningsTable)
    .where(
      and(
        eq(complianceScreeningsTable.shipmentId, shipmentId),
        eq(complianceScreeningsTable.companyId, companyId),
      ),
    )
    .limit(1);

  const [risk] = await db
    .select({ compositeScore: riskScoresTable.compositeScore })
    .from(riskScoresTable)
    .where(
      and(
        eq(riskScoresTable.shipmentId, shipmentId),
        eq(riskScoresTable.companyId, companyId),
      ),
    )
    .limit(1);

  const [insurance] = await db
    .select({ coverageType: insuranceQuotesTable.coverageType })
    .from(insuranceQuotesTable)
    .where(
      and(
        eq(insuranceQuotesTable.shipmentId, shipmentId),
        eq(insuranceQuotesTable.companyId, companyId),
      ),
    )
    .limit(1);

  const exceptionsResult = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(exceptionsTable)
    .where(
      and(
        eq(exceptionsTable.shipmentId, shipmentId),
        eq(exceptionsTable.companyId, companyId),
      ),
    );

  const chargesResult = await db
    .select({ total: sql<string>`COALESCE(SUM(${shipmentChargesTable.totalAmount}), 0)` })
    .from(shipmentChargesTable)
    .where(
      and(
        eq(shipmentChargesTable.shipmentId, shipmentId),
        eq(shipmentChargesTable.companyId, companyId),
      ),
    );

  return {
    riskScore: risk?.compositeScore ?? null,
    complianceStatus: compliance?.status ?? null,
    insuranceCoverage: insurance?.coverageType ?? null,
    intelligenceComposite: null,
    signalCount: 0,
    exceptionCount: Number(exceptionsResult[0]?.count ?? 0),
    chargeTotal: chargesResult[0] ? Number(chargesResult[0].total) : null,
  };
}

async function computeCurrentRiskScore(
  shipmentId: string,
  companyId: string,
): Promise<number | null> {
  const [risk] = await db
    .select({ compositeScore: riskScoresTable.compositeScore })
    .from(riskScoresTable)
    .where(
      and(
        eq(riskScoresTable.shipmentId, shipmentId),
        eq(riskScoresTable.companyId, companyId),
      ),
    )
    .limit(1);
  if (!risk) return null;
  const score = risk.compositeScore;
  return score != null ? (score <= 1 ? score * 100 : score) : null;
}

async function computeComplianceRisk(
  shipmentId: string,
  companyId: string,
): Promise<number | null> {
  const [compliance] = await db
    .select({
      status: complianceScreeningsTable.status,
      matches: complianceScreeningsTable.matches,
    })
    .from(complianceScreeningsTable)
    .where(
      and(
        eq(complianceScreeningsTable.shipmentId, shipmentId),
        eq(complianceScreeningsTable.companyId, companyId),
      ),
    )
    .limit(1);

  if (!compliance) return null;
  if (compliance.status === "CLEAR") return 0;
  if (compliance.status === "FLAGGED") return 75;
  return 50;
}

async function computeOperationalReadiness(
  shipmentId: string,
  companyId: string,
): Promise<number | null> {
  const [shipment] = await db
    .select({ status: shipmentsTable.status })
    .from(shipmentsTable)
    .where(
      and(
        eq(shipmentsTable.id, shipmentId),
        eq(shipmentsTable.companyId, companyId),
      ),
    )
    .limit(1);

  if (!shipment) return null;

  const statusScores: Record<string, number> = {
    DRAFT: 20,
    PENDING: 30,
    BOOKED: 50,
    APPROVED: 70,
    IN_TRANSIT: 80,
    AT_PORT: 85,
    CUSTOMS: 60,
    DELIVERED: 100,
    CLOSED: 100,
    CANCELLED: 0,
    REJECTED: 0,
  };

  return statusScores[shipment.status] ?? 30;
}

function computeConfidence(
  activeRecs: Array<{ confidence: number | null }>,
  usedFallback: boolean,
): number {
  if (activeRecs.length === 0) return usedFallback ? 0.5 : 0.8;
  const avgConfidence =
    activeRecs.reduce((sum, r) => sum + (Number(r.confidence) || 0), 0) /
    activeRecs.length;
  return usedFallback ? avgConfidence * 0.7 : avgConfidence;
}

export async function requestReanalysis(request: ReanalysisRequest): Promise<void> {
  const { shipmentId, companyId, triggerType, triggerSourceEntityId } = request;

  await db.insert(aiEventLogTable).values({
    id: generateId(),
    companyId,
    shipmentId,
    eventType: "AI_REANALYSIS_REQUESTED",
    details: { triggerType, triggerSourceEntityId },
  });

  await db
    .update(shipmentAiStateTable)
    .set({ isStale: true })
    .where(
      and(
        eq(shipmentAiStateTable.shipmentId, shipmentId),
        eq(shipmentAiStateTable.companyId, companyId),
      ),
    );
}

export async function getShipmentAiState(shipmentId: string, companyId: string) {
  const [state] = await db
    .select()
    .from(shipmentAiStateTable)
    .where(
      and(
        eq(shipmentAiStateTable.shipmentId, shipmentId),
        eq(shipmentAiStateTable.companyId, companyId),
      ),
    )
    .limit(1);
  return state ?? null;
}

export async function getAnalysisHistory(shipmentId: string, companyId: string) {
  return db
    .select()
    .from(shipmentAiAnalysisRunsTable)
    .where(
      and(
        eq(shipmentAiAnalysisRunsTable.shipmentId, shipmentId),
        eq(shipmentAiAnalysisRunsTable.companyId, companyId),
      ),
    )
    .orderBy(sql`${shipmentAiAnalysisRunsTable.createdAt} DESC`)
    .limit(50);
}

export async function getAiEventLog(shipmentId: string, companyId: string) {
  return db
    .select()
    .from(aiEventLogTable)
    .where(
      and(
        eq(aiEventLogTable.shipmentId, shipmentId),
        eq(aiEventLogTable.companyId, companyId),
      ),
    )
    .orderBy(sql`${aiEventLogTable.createdAt} DESC`)
    .limit(100);
}
