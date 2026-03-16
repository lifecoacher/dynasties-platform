import { db } from "@workspace/db";
import {
  carrierScoresTable,
  carrierAllocationsTable,
  tradeLaneStatsTable,
  recommendationsTable,
  shipmentsTable,
  bookingDecisionsTable,
} from "@workspace/db/schema";
import { generateId } from "@workspace/shared-utils";
import { eq, and, desc, sql, gte } from "drizzle-orm";

type AllocationGuidance =
  | "PREFERRED"
  | "ACCEPTABLE_MONITOR"
  | "AVOID_CURRENT_CONDITIONS"
  | "INCREASE_ALLOCATION"
  | "REDUCE_ALLOCATION";

interface AllocationFactor {
  dimension: string;
  score: number;
  weight: number;
  detail: string;
}

export interface CarrierAllocationResult {
  id: string;
  carrierName: string;
  lane: string | null;
  allocation: AllocationGuidance;
  confidence: number;
  reliabilityScore: number;
  recommendationTriggerRate: number;
  switchAwayRate: number;
  disruptionExposure: number;
  lanePerformance: number;
  riskAdjustedScore: number;
  shipmentCount: number;
  factors: AllocationFactor[];
  suggestedActions: string[];
}

const ALLOCATION_WEIGHTS = {
  reliability: 0.30,
  recTrigger: 0.15,
  switchAway: 0.10,
  disruption: 0.20,
  lanePerf: 0.15,
  riskAdj: 0.10,
};

export async function computeCarrierAllocations(
  companyId: string,
  lane?: string,
): Promise<CarrierAllocationResult[]> {
  const carrierScores = await db
    .select()
    .from(carrierScoresTable)
    .where(eq(carrierScoresTable.companyId, companyId));

  if (carrierScores.length === 0) return [];

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  const shipmentsByCarrier = await db
    .select({
      carrier: shipmentsTable.carrier,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(shipmentsTable)
    .where(
      and(
        eq(shipmentsTable.companyId, companyId),
        gte(shipmentsTable.createdAt, thirtyDaysAgo),
      ),
    )
    .groupBy(shipmentsTable.carrier);

  const shipmentMap = new Map(
    shipmentsByCarrier.map((s) => [s.carrier, s.count]),
  );

  const recsByCarrier = await db
    .select({
      carrier: shipmentsTable.carrier,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(recommendationsTable)
    .innerJoin(shipmentsTable, eq(recommendationsTable.shipmentId, shipmentsTable.id))
    .where(
      and(
        eq(recommendationsTable.companyId, companyId),
        gte(recommendationsTable.createdAt, thirtyDaysAgo),
      ),
    )
    .groupBy(shipmentsTable.carrier);

  const recsMap = new Map(
    recsByCarrier.map((r) => [r.carrier, r.count]),
  );

  const switchCounts = await db
    .select({
      carrier: shipmentsTable.carrier,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(bookingDecisionsTable)
    .innerJoin(shipmentsTable, eq(bookingDecisionsTable.shipmentId, shipmentsTable.id))
    .where(
      and(
        eq(bookingDecisionsTable.companyId, companyId),
        eq(bookingDecisionsTable.status, "RECOMMEND_ALTERNATIVE"),
        gte(bookingDecisionsTable.createdAt, thirtyDaysAgo),
      ),
    )
    .groupBy(shipmentsTable.carrier);

  const switchMap = new Map(
    switchCounts.map((s) => [s.carrier, s.count]),
  );

  const laneStats = await db
    .select()
    .from(tradeLaneStatsTable)
    .where(eq(tradeLaneStatsTable.companyId, companyId));

  const results: CarrierAllocationResult[] = [];

  for (const cs of carrierScores) {
    const shipCount = shipmentMap.get(cs.carrierName) ?? 0;
    const recCount = recsMap.get(cs.carrierName) ?? 0;
    const switchCount = switchMap.get(cs.carrierName) ?? 0;

    const reliability = cs.reliabilityScore / 100;
    const recTriggerRate = shipCount > 0 ? Math.min(recCount / shipCount, 1) : 0;
    const switchAwayRate = shipCount > 0 ? Math.min(switchCount / shipCount, 1) : 0;
    const disruptionExposure = cs.laneStressExposure ?? 0;

    const carrierLaneStats = laneStats.filter((l) => l.carrier === cs.carrierName);
    const avgLanePerf = carrierLaneStats.length > 0
      ? carrierLaneStats.reduce((sum, l) => sum + (l.carrierPerformanceScore ?? 0), 0) / carrierLaneStats.length / 100
      : reliability;

    const riskAdjusted = reliability * (1 - disruptionExposure * 0.3) * (1 - recTriggerRate * 0.2);

    const factors: AllocationFactor[] = [
      { dimension: "Reliability", score: reliability, weight: ALLOCATION_WEIGHTS.reliability, detail: `Score: ${(reliability * 100).toFixed(0)}%` },
      { dimension: "Rec Trigger Rate", score: recTriggerRate, weight: ALLOCATION_WEIGHTS.recTrigger, detail: `${recCount} recs / ${shipCount} shipments` },
      { dimension: "Switch-Away Rate", score: switchAwayRate, weight: ALLOCATION_WEIGHTS.switchAway, detail: `${switchCount} switches in 30d` },
      { dimension: "Disruption Exposure", score: disruptionExposure, weight: ALLOCATION_WEIGHTS.disruption, detail: `Lane stress exposure: ${disruptionExposure.toFixed(2)}` },
      { dimension: "Lane Performance", score: avgLanePerf, weight: ALLOCATION_WEIGHTS.lanePerf, detail: `Avg lane perf: ${(avgLanePerf * 100).toFixed(0)}%` },
      { dimension: "Risk-Adjusted", score: riskAdjusted, weight: ALLOCATION_WEIGHTS.riskAdj, detail: `Risk-adj score: ${riskAdjusted.toFixed(2)}` },
    ];

    const composite = factors.reduce((sum, f) => {
      const isInverse = ["Rec Trigger Rate", "Switch-Away Rate", "Disruption Exposure"].includes(f.dimension);
      return sum + (isInverse ? (1 - f.score) : f.score) * f.weight;
    }, 0);

    const { allocation, actions } = determineAllocation(composite, factors, cs);
    const confidence = computeConfidence(shipCount, factors);

    const id = generateId("cal");
    results.push({
      id,
      carrierName: cs.carrierName,
      lane: lane ?? null,
      allocation,
      confidence,
      reliabilityScore: reliability,
      recommendationTriggerRate: recTriggerRate,
      switchAwayRate,
      disruptionExposure,
      lanePerformance: avgLanePerf,
      riskAdjustedScore: riskAdjusted,
      shipmentCount: shipCount,
      factors,
      suggestedActions: actions,
    });
  }

  if (results.length > 0) {
    await db
      .insert(carrierAllocationsTable)
      .values(
        results.map((r) => ({
          id: r.id,
          companyId,
          carrierName: r.carrierName,
          lane: r.lane,
          allocation: r.allocation,
          confidence: r.confidence,
          reliabilityScore: r.reliabilityScore,
          recommendationTriggerRate: r.recommendationTriggerRate,
          switchAwayRate: r.switchAwayRate,
          disruptionExposure: r.disruptionExposure,
          lanePerformance: r.lanePerformance,
          riskAdjustedScore: r.riskAdjustedScore,
          shipmentCount: r.shipmentCount,
          factors: r.factors,
          suggestedActions: r.suggestedActions,
          computedAt: new Date(),
        })),
      );
  }

  return results.sort((a, b) => {
    const order: Record<AllocationGuidance, number> = {
      AVOID_CURRENT_CONDITIONS: 0, REDUCE_ALLOCATION: 1,
      ACCEPTABLE_MONITOR: 2, INCREASE_ALLOCATION: 3, PREFERRED: 4,
    };
    return (order[a.allocation] ?? 2) - (order[b.allocation] ?? 2);
  });
}

export async function getCarrierAllocations(
  companyId: string,
  limit = 50,
): Promise<CarrierAllocationResult[]> {
  const rows = await db
    .select()
    .from(carrierAllocationsTable)
    .where(eq(carrierAllocationsTable.companyId, companyId))
    .orderBy(desc(carrierAllocationsTable.computedAt))
    .limit(limit);

  const seen = new Set<string>();
  const latest: typeof rows = [];
  for (const r of rows) {
    const key = `${r.carrierName}-${r.lane ?? "global"}`;
    if (!seen.has(key)) {
      seen.add(key);
      latest.push(r);
    }
  }

  return latest.map((r) => ({
    id: r.id,
    carrierName: r.carrierName,
    lane: r.lane,
    allocation: r.allocation as AllocationGuidance,
    confidence: r.confidence,
    reliabilityScore: r.reliabilityScore,
    recommendationTriggerRate: r.recommendationTriggerRate,
    switchAwayRate: r.switchAwayRate,
    disruptionExposure: r.disruptionExposure,
    lanePerformance: r.lanePerformance,
    riskAdjustedScore: r.riskAdjustedScore,
    shipmentCount: r.shipmentCount,
    factors: r.factors as AllocationFactor[],
    suggestedActions: r.suggestedActions as string[],
  }));
}

function determineAllocation(
  composite: number,
  factors: AllocationFactor[],
  carrier: any,
): { allocation: AllocationGuidance; actions: string[] } {
  const actions: string[] = [];
  const reliability = factors.find((f) => f.dimension === "Reliability")?.score ?? 0;
  const disruption = factors.find((f) => f.dimension === "Disruption Exposure")?.score ?? 0;
  const recRate = factors.find((f) => f.dimension === "Rec Trigger Rate")?.score ?? 0;

  if (composite < 0.35 || (reliability < 0.4 && disruption > 0.6)) {
    actions.push("Suspend new bookings with this carrier");
    actions.push("Review active shipments for contingency planning");
    return { allocation: "AVOID_CURRENT_CONDITIONS", actions };
  }

  if (composite < 0.50 || recRate > 0.4) {
    actions.push("Shift volume to higher-performing carriers");
    actions.push("Negotiate improved SLAs or consider contract revision");
    return { allocation: "REDUCE_ALLOCATION", actions };
  }

  if (composite >= 0.75 && reliability >= 0.8 && disruption < 0.3) {
    actions.push("Consider increasing allocation from underperforming carriers");
    actions.push("Negotiate volume-based rate improvements");
    return { allocation: "INCREASE_ALLOCATION", actions };
  }

  if (composite >= 0.65) {
    actions.push("Maintain current allocation; no action needed");
    return { allocation: "PREFERRED", actions };
  }

  actions.push("Monitor performance trends weekly");
  actions.push("Flag for review if reliability drops below threshold");
  return { allocation: "ACCEPTABLE_MONITOR", actions };
}

function computeConfidence(shipmentCount: number, factors: AllocationFactor[]): number {
  const dataDepth = Math.min(shipmentCount / 15, 1);
  const signalClarity = factors.reduce((sum, f) => sum + Math.abs(f.score - 0.5), 0) / factors.length;
  return Math.min(0.35 + dataDepth * 0.4 + signalClarity * 0.25, 1);
}
