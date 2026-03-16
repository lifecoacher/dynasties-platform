import { db } from "@workspace/db";
import {
  policySimulationsTable,
  shipmentsTable,
  preShipmentRiskReportsTable,
  recommendationsTable,
  bookingDecisionsTable,
  workflowTasksTable,
  laneScoresTable,
  carrierScoresTable,
} from "@workspace/db/schema";
import { generateId } from "@workspace/shared-utils";
import { eq, and, gte, desc } from "drizzle-orm";
import { getEffectivePolicy, getGlobalDefaults } from "./policy-engine.js";

export interface SimulationInput {
  simulationName: string;
  policyChanges: Record<string, Record<string, unknown>>;
}

interface SimulationMetrics {
  shipmentsAffected: number;
  recommendationsAffected: number;
  bookingDecisionsChanged: { blocked: number; requireReview: number; approved: number; cautionApproved: number; alternative: number };
  tasksEstimated: number;
  escalationsEstimated: number;
  strategicRecommendationsChanged: number;
  riskDistribution: { low: number; medium: number; high: number; critical: number };
}

export interface SimulationResult {
  id: string;
  simulationName: string;
  policyChanges: Record<string, Record<string, unknown>>;
  baseline: SimulationMetrics;
  simulated: SimulationMetrics;
  impactAnalysis: {
    shipmentDelta: number;
    blockRateChange: number;
    taskVolumeChange: number;
    escalationChange: number;
    summary: string[];
  };
}

export async function runPolicySimulation(
  companyId: string,
  userId: string,
  input: SimulationInput,
): Promise<SimulationResult> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  const [shipments, riskReports, recommendations, bookingDecisions, tasks, laneScores, carrierScores] = await Promise.all([
    db.select().from(shipmentsTable).where(
      and(eq(shipmentsTable.companyId, companyId), gte(shipmentsTable.createdAt, thirtyDaysAgo)),
    ),
    db.select().from(preShipmentRiskReportsTable).where(eq(preShipmentRiskReportsTable.companyId, companyId))
      .orderBy(desc(preShipmentRiskReportsTable.createdAt)),
    db.select().from(recommendationsTable).where(
      and(eq(recommendationsTable.companyId, companyId), gte(recommendationsTable.createdAt, thirtyDaysAgo)),
    ),
    db.select().from(bookingDecisionsTable).where(
      and(eq(bookingDecisionsTable.companyId, companyId), gte(bookingDecisionsTable.createdAt, thirtyDaysAgo)),
    ),
    db.select().from(workflowTasksTable).where(
      and(eq(workflowTasksTable.companyId, companyId), gte(workflowTasksTable.createdAt, thirtyDaysAgo)),
    ),
    db.select().from(laneScoresTable).where(eq(laneScoresTable.companyId, companyId)),
    db.select().from(carrierScoresTable).where(eq(carrierScoresTable.companyId, companyId)),
  ]);

  const currentGatePolicy = await getEffectivePolicy(companyId, "booking.gate_thresholds") as Record<string, number>;
  const currentTaskPolicy = await getEffectivePolicy(companyId, "auto_task.creation_rules") as Record<string, unknown>;
  const currentRiskTolerances = await getEffectivePolicy(companyId, "risk.tolerances") as Record<string, number>;

  const baseline = computeMetrics(
    shipments, riskReports, bookingDecisions, recommendations, tasks,
    laneScores, carrierScores, currentGatePolicy, currentTaskPolicy, currentRiskTolerances,
  );

  const simGatePolicy = input.policyChanges["booking.gate_thresholds"]
    ? { ...currentGatePolicy, ...input.policyChanges["booking.gate_thresholds"] }
    : currentGatePolicy;
  const simTaskPolicy = input.policyChanges["auto_task.creation_rules"]
    ? { ...currentTaskPolicy, ...input.policyChanges["auto_task.creation_rules"] }
    : currentTaskPolicy;
  const simRiskTolerances = input.policyChanges["risk.tolerances"]
    ? { ...currentRiskTolerances, ...input.policyChanges["risk.tolerances"] }
    : currentRiskTolerances;

  const simulated = computeMetrics(
    shipments, riskReports, bookingDecisions, recommendations, tasks,
    laneScores, carrierScores, simGatePolicy, simTaskPolicy, simRiskTolerances,
  );

  const shipmentDelta = simulated.shipmentsAffected - baseline.shipmentsAffected;
  const baselineBlockRate = baseline.bookingDecisionsChanged.blocked /
    Math.max(Object.values(baseline.bookingDecisionsChanged).reduce((a, b) => a + b, 0), 1);
  const simBlockRate = simulated.bookingDecisionsChanged.blocked /
    Math.max(Object.values(simulated.bookingDecisionsChanged).reduce((a, b) => a + b, 0), 1);
  const blockRateChange = simBlockRate - baselineBlockRate;
  const taskVolumeChange = simulated.tasksEstimated - baseline.tasksEstimated;
  const escalationChange = simulated.escalationsEstimated - baseline.escalationsEstimated;

  const summary: string[] = [];
  if (shipmentDelta > 0) summary.push(`${shipmentDelta} more shipments would be flagged`);
  if (shipmentDelta < 0) summary.push(`${Math.abs(shipmentDelta)} fewer shipments would be flagged`);
  if (blockRateChange > 0.05) summary.push(`Block rate would increase by ${(blockRateChange * 100).toFixed(1)}%`);
  if (blockRateChange < -0.05) summary.push(`Block rate would decrease by ${(Math.abs(blockRateChange) * 100).toFixed(1)}%`);
  if (taskVolumeChange > 0) summary.push(`Estimated ${taskVolumeChange} additional auto-tasks per month`);
  if (taskVolumeChange < 0) summary.push(`Estimated ${Math.abs(taskVolumeChange)} fewer auto-tasks per month`);
  if (escalationChange !== 0) summary.push(`Escalation volume change: ${escalationChange > 0 ? "+" : ""}${escalationChange}`);
  if (summary.length === 0) summary.push("No significant impact detected with proposed changes");

  const id = generateId("psim");
  const result: SimulationResult = {
    id,
    simulationName: input.simulationName,
    policyChanges: input.policyChanges,
    baseline,
    simulated,
    impactAnalysis: { shipmentDelta, blockRateChange, taskVolumeChange, escalationChange, summary },
  };

  await db.insert(policySimulationsTable).values({
    id,
    companyId,
    simulationName: input.simulationName,
    policyChanges: input.policyChanges,
    baselineSummary: baseline as unknown as Record<string, unknown>,
    simulatedSummary: simulated as unknown as Record<string, unknown>,
    impactAnalysis: result.impactAnalysis as unknown as Record<string, unknown>,
    simulatedBy: userId,
  });

  return result;
}

export async function getSimulationHistory(
  companyId: string,
  limit = 20,
): Promise<SimulationResult[]> {
  const rows = await db
    .select()
    .from(policySimulationsTable)
    .where(eq(policySimulationsTable.companyId, companyId))
    .orderBy(desc(policySimulationsTable.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    simulationName: r.simulationName,
    policyChanges: r.policyChanges,
    baseline: r.baselineSummary as unknown as SimulationMetrics,
    simulated: r.simulatedSummary as unknown as SimulationMetrics,
    impactAnalysis: r.impactAnalysis as unknown as SimulationResult["impactAnalysis"],
  }));
}

function computeMetrics(
  shipments: any[],
  riskReports: any[],
  bookingDecisions: any[],
  recommendations: any[],
  tasks: any[],
  laneScores: any[],
  carrierScores: any[],
  gatePolicy: Record<string, unknown>,
  taskPolicy: Record<string, unknown>,
  riskTolerances: Record<string, unknown>,
): SimulationMetrics {
  const blockThreshold = (gatePolicy.blockThreshold as number) ?? 0.85;
  const reviewThreshold = (gatePolicy.requireReviewThreshold as number) ?? 0.7;
  const cautionThreshold = (gatePolicy.cautionThreshold as number) ?? 0.5;
  const alternativeThreshold = (gatePolicy.alternativeThreshold as number) ?? 0.75;
  const maxRisk = (riskTolerances.maxAcceptableRiskScore as number) ?? 0.8;
  const taskMinRisk = (taskPolicy.minRiskScore as number) ?? 0.6;
  const taskEnabled = (taskPolicy.enabled as boolean) ?? true;

  const latestRisk = new Map<string, any>();
  for (const r of riskReports) {
    if (!latestRisk.has(r.shipmentId)) latestRisk.set(r.shipmentId, r);
  }

  const riskDist = { low: 0, medium: 0, high: 0, critical: 0 };
  const booking = { blocked: 0, requireReview: 0, approved: 0, cautionApproved: 0, alternative: 0 };
  let shipmentsAffected = 0;

  for (const ship of shipments) {
    const risk = latestRisk.get(ship.id);
    const score = risk?.overallRiskScore ?? 0;

    if (score >= maxRisk) riskDist.critical++;
    else if (score >= 0.6) riskDist.high++;
    else if (score >= 0.3) riskDist.medium++;
    else riskDist.low++;

    if (score >= blockThreshold) { booking.blocked++; shipmentsAffected++; }
    else if (score >= alternativeThreshold) { booking.alternative++; shipmentsAffected++; }
    else if (score >= reviewThreshold) { booking.requireReview++; shipmentsAffected++; }
    else if (score >= cautionThreshold) { booking.cautionApproved++; }
    else { booking.approved++; }
  }

  let tasksEstimated = 0;
  if (taskEnabled) {
    for (const ship of shipments) {
      const risk = latestRisk.get(ship.id);
      if ((risk?.overallRiskScore ?? 0) >= taskMinRisk) tasksEstimated++;
    }
  }

  const escalationsEstimated = Math.round(shipmentsAffected * 0.15);
  const recommendationsAffected = recommendations.filter((r) => {
    return (r.confidence ?? 0) >= ((gatePolicy.minConfidence as number) ?? 0.5);
  }).length;

  const strategicRecsChanged = laneScores.filter((l: any) => (l.compositeStressScore ?? 0) >= maxRisk * 0.8).length +
    carrierScores.filter((c: any) => (c.compositeScore ?? 0) >= maxRisk * 0.8).length;

  return {
    shipmentsAffected,
    recommendationsAffected,
    bookingDecisionsChanged: booking,
    tasksEstimated,
    escalationsEstimated,
    strategicRecommendationsChanged: strategicRecsChanged,
    riskDistribution: riskDist,
  };
}
