import { db } from "@workspace/db";
import {
  laneScoresTable,
  tradeLaneStatsTable,
  laneStrategiesTable,
  recommendationsTable,
  workflowTasksTable,
  exceptionsTable,
  shipmentsTable,
  disruptionEventsTable,
  portCongestionSnapshotsTable,
  preShipmentRiskReportsTable,
} from "@workspace/db/schema";
import { generateId } from "@workspace/shared-utils";
import { eq, and, desc, sql, gte, or, inArray } from "drizzle-orm";

type LaneStrategy =
  | "STABLE"
  | "MONITOR_CLOSELY"
  | "REDUCE_EXPOSURE"
  | "REROUTE_CONDITIONAL"
  | "REPRICE_LANE"
  | "TIGHTEN_GATES";

interface StrategyFactor {
  dimension: string;
  score: number;
  weight: number;
  detail: string;
}

export interface LaneStrategyResult {
  id: string;
  originPort: string;
  destinationPort: string;
  strategy: LaneStrategy;
  confidence: number;
  stressScore: number;
  delayExposure: number;
  disruptionFrequency: number;
  congestionTrend: number;
  recommendationVolume: number;
  taskVolume: number;
  exceptionCount: number;
  marginPressure: number;
  shipmentCount: number;
  factors: StrategyFactor[];
  suggestedActions: string[];
}

const STRATEGY_WEIGHTS = {
  stress: 0.20,
  delay: 0.20,
  disruption: 0.15,
  congestion: 0.15,
  recVolume: 0.10,
  taskVolume: 0.10,
  exceptions: 0.05,
  margin: 0.05,
};

export async function computeLaneStrategies(
  companyId: string,
): Promise<LaneStrategyResult[]> {
  const laneScores = await db
    .select()
    .from(laneScoresTable)
    .where(eq(laneScoresTable.companyId, companyId));

  if (laneScores.length === 0) return [];

  const laneStats = await db
    .select()
    .from(tradeLaneStatsTable)
    .where(eq(tradeLaneStatsTable.companyId, companyId));

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  const recCounts = await db
    .select({
      origin: shipmentsTable.portOfLoading,
      dest: shipmentsTable.portOfDischarge,
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
    .groupBy(shipmentsTable.portOfLoading, shipmentsTable.portOfDischarge);

  const taskCounts = await db
    .select({
      origin: shipmentsTable.portOfLoading,
      dest: shipmentsTable.portOfDischarge,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(workflowTasksTable)
    .innerJoin(shipmentsTable, eq(workflowTasksTable.shipmentId, shipmentsTable.id))
    .where(
      and(
        eq(workflowTasksTable.companyId, companyId),
        gte(workflowTasksTable.createdAt, thirtyDaysAgo),
      ),
    )
    .groupBy(shipmentsTable.portOfLoading, shipmentsTable.portOfDischarge);

  const exceptionCounts = await db
    .select({
      origin: shipmentsTable.portOfLoading,
      dest: shipmentsTable.portOfDischarge,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(exceptionsTable)
    .innerJoin(shipmentsTable, eq(exceptionsTable.shipmentId, shipmentsTable.id))
    .where(
      and(
        eq(exceptionsTable.companyId, companyId),
        gte(exceptionsTable.createdAt, thirtyDaysAgo),
      ),
    )
    .groupBy(shipmentsTable.portOfLoading, shipmentsTable.portOfDischarge);

  const recMap = new Map(recCounts.map((r) => [`${r.origin}-${r.dest}`, r.count]));
  const taskMap = new Map(taskCounts.map((t) => [`${t.origin}-${t.dest}`, t.count]));
  const excMap = new Map(exceptionCounts.map((e) => [`${e.origin}-${e.dest}`, e.count]));

  const statsMap = new Map(
    laneStats.map((s) => [`${s.origin}-${s.destination}`, s]),
  );

  const allPorts = [...new Set(laneScores.flatMap((l) => [l.originPort, l.destinationPort]))];
  const congestionSnaps = await db
    .select()
    .from(portCongestionSnapshotsTable)
    .where(
      and(
        or(
          eq(portCongestionSnapshotsTable.companyId, companyId),
          sql`${portCongestionSnapshotsTable.companyId} IS NULL`,
        ),
        inArray(portCongestionSnapshotsTable.portCode, allPorts.length > 0 ? allPorts : [""]),
        gte(portCongestionSnapshotsTable.snapshotTimestamp, thirtyDaysAgo),
      ),
    )
    .orderBy(desc(portCongestionSnapshotsTable.snapshotTimestamp));

  const congestionMap = new Map<string, number>();
  for (const snap of congestionSnaps) {
    if (!congestionMap.has(snap.portCode)) {
      const level = snap.congestionLevel === "critical" ? 1.0
        : snap.congestionLevel === "high" ? 0.75
        : snap.congestionLevel === "moderate" ? 0.5
        : 0.25;
      congestionMap.set(snap.portCode, level);
    }
  }

  const results: LaneStrategyResult[] = [];

  for (const lane of laneScores) {
    const key = `${lane.originPort}-${lane.destinationPort}`;
    const stats = statsMap.get(key);

    const stressScore = lane.compositeStressScore ?? 0;
    const delayExposure = stats?.delayFrequency ?? (lane.delayStressScore ?? 0);
    const disruptionFreq = lane.disruptionScore ?? 0;
    const originCongestion = congestionMap.get(lane.originPort) ?? 0;
    const destCongestion = congestionMap.get(lane.destinationPort) ?? 0;
    const congestionTrend = Math.max(originCongestion, destCongestion);
    const recVol = recMap.get(key) ?? 0;
    const taskVol = taskMap.get(key) ?? 0;
    const excCount = excMap.get(key) ?? 0;
    const shipCount = stats?.shipmentCount ?? 0;

    const normalizedRecVol = Math.min(recVol / Math.max(shipCount, 1), 1);
    const normalizedTaskVol = Math.min(taskVol / Math.max(shipCount, 1), 1);
    const normalizedExc = Math.min(excCount / Math.max(shipCount, 1), 1);
    const marginPressure = stats?.carrierPerformanceScore != null
      ? 1 - (stats.carrierPerformanceScore / 100)
      : 0;

    const factors: StrategyFactor[] = [
      { dimension: "Lane Stress", score: stressScore, weight: STRATEGY_WEIGHTS.stress, detail: `Composite stress: ${stressScore.toFixed(2)}` },
      { dimension: "Delay Exposure", score: delayExposure, weight: STRATEGY_WEIGHTS.delay, detail: `Delay frequency: ${delayExposure.toFixed(2)}` },
      { dimension: "Disruption Frequency", score: disruptionFreq, weight: STRATEGY_WEIGHTS.disruption, detail: `Disruption score: ${disruptionFreq.toFixed(2)}` },
      { dimension: "Congestion Trend", score: congestionTrend, weight: STRATEGY_WEIGHTS.congestion, detail: `Max port congestion: ${congestionTrend.toFixed(2)}` },
      { dimension: "Recommendation Volume", score: normalizedRecVol, weight: STRATEGY_WEIGHTS.recVolume, detail: `${recVol} recs in 30d` },
      { dimension: "Task Volume", score: normalizedTaskVol, weight: STRATEGY_WEIGHTS.taskVolume, detail: `${taskVol} tasks in 30d` },
      { dimension: "Exceptions", score: normalizedExc, weight: STRATEGY_WEIGHTS.exceptions, detail: `${excCount} exceptions in 30d` },
      { dimension: "Margin Pressure", score: marginPressure, weight: STRATEGY_WEIGHTS.margin, detail: `Margin pressure: ${marginPressure.toFixed(2)}` },
    ];

    const compositeScore = factors.reduce((sum, f) => sum + f.score * f.weight, 0);

    const { strategy, actions } = determineStrategy(compositeScore, factors, lane);
    const confidence = computeConfidence(shipCount, factors);

    const id = generateId("lst");
    results.push({
      id,
      originPort: lane.originPort,
      destinationPort: lane.destinationPort,
      strategy,
      confidence,
      stressScore,
      delayExposure,
      disruptionFrequency: disruptionFreq,
      congestionTrend,
      recommendationVolume: recVol,
      taskVolume: taskVol,
      exceptionCount: excCount,
      marginPressure,
      shipmentCount: shipCount,
      factors,
      suggestedActions: actions,
    });
  }

  if (results.length > 0) {
    await db
      .insert(laneStrategiesTable)
      .values(
        results.map((r) => ({
          id: r.id,
          companyId,
          originPort: r.originPort,
          destinationPort: r.destinationPort,
          strategy: r.strategy,
          confidence: r.confidence,
          stressScore: r.stressScore,
          delayExposure: r.delayExposure,
          disruptionFrequency: r.disruptionFrequency,
          congestionTrend: r.congestionTrend,
          recommendationVolume: r.recommendationVolume,
          taskVolume: r.taskVolume,
          exceptionCount: r.exceptionCount,
          marginPressure: r.marginPressure,
          shipmentCount: r.shipmentCount,
          factors: r.factors,
          suggestedActions: r.suggestedActions,
          computedAt: new Date(),
        })),
      );
  }

  return results.sort((a, b) => {
    const stratOrder: Record<LaneStrategy, number> = {
      TIGHTEN_GATES: 0, REDUCE_EXPOSURE: 1, REROUTE_CONDITIONAL: 2,
      REPRICE_LANE: 3, MONITOR_CLOSELY: 4, STABLE: 5,
    };
    return (stratOrder[a.strategy] ?? 5) - (stratOrder[b.strategy] ?? 5);
  });
}

export async function getLaneStrategies(
  companyId: string,
  limit = 50,
): Promise<LaneStrategyResult[]> {
  const rows = await db
    .select()
    .from(laneStrategiesTable)
    .where(eq(laneStrategiesTable.companyId, companyId))
    .orderBy(desc(laneStrategiesTable.computedAt))
    .limit(limit);

  const seen = new Set<string>();
  const latest: typeof rows = [];
  for (const r of rows) {
    const key = `${r.originPort}-${r.destinationPort}`;
    if (!seen.has(key)) {
      seen.add(key);
      latest.push(r);
    }
  }

  return latest.map((r) => ({
    id: r.id,
    originPort: r.originPort,
    destinationPort: r.destinationPort,
    strategy: r.strategy as LaneStrategy,
    confidence: r.confidence,
    stressScore: r.stressScore,
    delayExposure: r.delayExposure,
    disruptionFrequency: r.disruptionFrequency,
    congestionTrend: r.congestionTrend,
    recommendationVolume: r.recommendationVolume,
    taskVolume: r.taskVolume,
    exceptionCount: r.exceptionCount,
    marginPressure: r.marginPressure,
    shipmentCount: r.shipmentCount,
    factors: r.factors as StrategyFactor[],
    suggestedActions: r.suggestedActions as string[],
  }));
}

function determineStrategy(
  composite: number,
  factors: StrategyFactor[],
  lane: any,
): { strategy: LaneStrategy; actions: string[] } {
  const actions: string[] = [];
  const stress = factors.find((f) => f.dimension === "Lane Stress")?.score ?? 0;
  const disruption = factors.find((f) => f.dimension === "Disruption Frequency")?.score ?? 0;
  const congestion = factors.find((f) => f.dimension === "Congestion Trend")?.score ?? 0;
  const margin = factors.find((f) => f.dimension === "Margin Pressure")?.score ?? 0;

  if (composite >= 0.75) {
    if (disruption >= 0.7 || congestion >= 0.8) {
      actions.push("Evaluate alternate routing through less congested ports");
      actions.push("Engage operations team for contingency planning");
      return { strategy: "REROUTE_CONDITIONAL", actions };
    }
    actions.push("Reduce booking volume on this lane");
    actions.push("Escalate to operations leadership for review");
    return { strategy: "REDUCE_EXPOSURE", actions };
  }

  if (composite >= 0.60) {
    if (margin >= 0.6) {
      actions.push("Review rate table pricing for this lane");
      actions.push("Analyze cost trends and carrier negotiation leverage");
      return { strategy: "REPRICE_LANE", actions };
    }
    if (stress >= 0.6) {
      actions.push("Apply stricter booking decision thresholds");
      actions.push("Require manual review for high-value shipments");
      return { strategy: "TIGHTEN_GATES", actions };
    }
    actions.push("Set up enhanced monitoring dashboards");
    actions.push("Review weekly performance metrics");
    return { strategy: "MONITOR_CLOSELY", actions };
  }

  if (composite >= 0.40) {
    actions.push("Continue standard monitoring");
    actions.push("Review monthly trend data");
    return { strategy: "MONITOR_CLOSELY", actions };
  }

  actions.push("No action required; lane performing within normal parameters");
  return { strategy: "STABLE", actions };
}

function computeConfidence(shipmentCount: number, factors: StrategyFactor[]): number {
  const dataDepth = Math.min(shipmentCount / 20, 1);
  const signalStrength = factors.reduce((sum, f) => sum + Math.abs(f.score - 0.5), 0) / factors.length;
  return Math.min(0.4 + dataDepth * 0.4 + signalStrength * 0.2, 1);
}
