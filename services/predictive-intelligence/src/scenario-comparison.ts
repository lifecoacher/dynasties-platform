import { db } from "@workspace/db";
import {
  scenarioComparisonsTable,
  shipmentsTable,
  preShipmentRiskReportsTable,
  tradeLaneStatsTable,
  portCongestionSnapshotsTable,
} from "@workspace/db/schema";
import { eq, and, desc, ne, sql } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import { computeReadinessScore } from "./readiness-scoring.js";

export interface ScenarioInput {
  shipmentId: string;
  companyId: string;
  includeAlternateCarriers?: boolean;
  includeAlternatePorts?: boolean;
  includeDelayedDeparture?: boolean;
  includeInsuranceUpgrade?: boolean;
}

export interface Scenario {
  scenarioType: string;
  label: string;
  riskScore: number;
  readinessScore: number;
  estimatedCost: number | null;
  estimatedTransitDays: number | null;
  riskDelta: number;
  costDelta: number | null;
  transitDelta: number | null;
  recommendation: string;
  details: Record<string, unknown>;
}

export interface ScenarioComparisonResult {
  id: string;
  shipmentId: string;
  baseline: {
    label: string;
    riskScore: number;
    readinessScore: number;
    estimatedCost: number | null;
    estimatedTransitDays: number | null;
    details: Record<string, unknown>;
  };
  alternatives: Scenario[];
  bestAlternative: string | null;
}

export async function compareScenarios(
  input: ScenarioInput,
): Promise<ScenarioComparisonResult> {
  const { shipmentId, companyId } = input;

  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(and(eq(shipmentsTable.id, shipmentId), eq(shipmentsTable.companyId, companyId)))
    .limit(1);

  if (!shipment) {
    throw new Error(`Shipment ${shipmentId} not found`);
  }

  const [[riskReport], readiness] = await Promise.all([
    db
      .select()
      .from(preShipmentRiskReportsTable)
      .where(
        and(
          eq(preShipmentRiskReportsTable.shipmentId, shipmentId),
          eq(preShipmentRiskReportsTable.companyId, companyId),
        ),
      )
      .orderBy(desc(preShipmentRiskReportsTable.evaluatedAt))
      .limit(1),
    computeReadinessScore(shipmentId, companyId),
  ]);

  const baselineRisk = riskReport?.overallRiskScore ?? 0.5;
  const baselineReadiness = readiness.overallScore;

  const baseline = {
    label: "Current Plan",
    riskScore: baselineRisk,
    readinessScore: baselineReadiness,
    estimatedCost: shipment.cargoValue ? Number(shipment.cargoValue) * 0.02 : null,
    estimatedTransitDays: estimateTransitDays(shipment.portOfLoading, shipment.portOfDischarge),
    details: {
      carrier: shipment.carrierId,
      portOfLoading: shipment.portOfLoading,
      portOfDischarge: shipment.portOfDischarge,
      etd: shipment.etd,
    },
  };

  const alternatives: Scenario[] = [];

  if (input.includeAlternateCarriers !== false) {
    const carrierAlt = buildCarrierAlternative(baselineRisk, baselineReadiness, baseline, riskReport);
    if (carrierAlt) alternatives.push(carrierAlt);
  }

  if (input.includeAlternatePorts !== false && shipment.portOfLoading) {
    const portAlt = await buildPortAlternative(
      shipment.portOfLoading,
      companyId,
      baselineRisk,
      baselineReadiness,
      baseline,
      riskReport,
    );
    if (portAlt) alternatives.push(portAlt);
  }

  if (input.includeDelayedDeparture !== false) {
    const delayAlt = buildDelayAlternative(baselineRisk, baselineReadiness, baseline, riskReport);
    if (delayAlt) alternatives.push(delayAlt);
  }

  if (input.includeInsuranceUpgrade !== false) {
    const insuranceAlt = buildInsuranceAlternative(baselineRisk, baselineReadiness, baseline);
    alternatives.push(insuranceAlt);
  }

  let bestAlternative: string | null = null;
  if (alternatives.length > 0) {
    const best = alternatives.reduce((a, b) => (a.riskScore < b.riskScore ? a : b));
    if (best.riskScore < baselineRisk) {
      bestAlternative = best.scenarioType;
    }
  }

  const id = generateId("scn");
  await db.insert(scenarioComparisonsTable).values({
    id,
    companyId,
    shipmentId,
    baselineScenario: baseline,
    alternativeScenarios: alternatives,
    bestAlternative,
  });

  return { id, shipmentId, baseline, alternatives, bestAlternative };
}

function buildCarrierAlternative(
  baselineRisk: number,
  baselineReadiness: number,
  baseline: ScenarioComparisonResult["baseline"],
  riskReport: any,
): Scenario | null {
  const carrierScore = riskReport?.carrierReliabilityScore ?? 0;
  if (carrierScore < 0.3) return null;

  const riskReduction = carrierScore * 0.15;
  const newRisk = Math.max(0, baselineRisk - riskReduction);
  const costIncrease = baseline.estimatedCost ? baseline.estimatedCost * 0.08 : null;

  return {
    scenarioType: "ALTERNATE_CARRIER",
    label: "Switch to Higher-Rated Carrier",
    riskScore: newRisk,
    readinessScore: baselineReadiness,
    estimatedCost: baseline.estimatedCost && costIncrease ? baseline.estimatedCost + costIncrease : null,
    estimatedTransitDays: baseline.estimatedTransitDays,
    riskDelta: newRisk - baselineRisk,
    costDelta: costIncrease,
    transitDelta: null,
    recommendation: `Switching carrier could reduce risk by ${(riskReduction * 100).toFixed(0)}% with ~8% cost increase`,
    details: { carrierReliabilityImprovement: riskReduction },
  };
}

async function buildPortAlternative(
  currentPort: string,
  companyId: string,
  baselineRisk: number,
  baselineReadiness: number,
  baseline: ScenarioComparisonResult["baseline"],
  riskReport: any,
): Promise<Scenario | null> {
  const congestionScore = riskReport?.portCongestionScore ?? 0;
  if (congestionScore < 0.3) return null;

  const riskReduction = congestionScore * 0.2;
  const newRisk = Math.max(0, baselineRisk - riskReduction);
  const transitIncrease = 2;

  return {
    scenarioType: "ALTERNATE_PORT",
    label: "Route Through Alternate Port",
    riskScore: newRisk,
    readinessScore: baselineReadiness * 0.95,
    estimatedCost: baseline.estimatedCost ? baseline.estimatedCost * 1.05 : null,
    estimatedTransitDays: baseline.estimatedTransitDays ? baseline.estimatedTransitDays + transitIncrease : null,
    riskDelta: newRisk - baselineRisk,
    costDelta: baseline.estimatedCost ? baseline.estimatedCost * 0.05 : null,
    transitDelta: transitIncrease,
    recommendation: `Alternate port reduces congestion risk by ${(riskReduction * 100).toFixed(0)}% but adds ~${transitIncrease} transit days`,
    details: { congestionAvoidance: riskReduction, currentPortCongestion: congestionScore },
  };
}

function buildDelayAlternative(
  baselineRisk: number,
  baselineReadiness: number,
  baseline: ScenarioComparisonResult["baseline"],
  riskReport: any,
): Scenario | null {
  const weatherScore = riskReport?.weatherExposureScore ?? 0;
  const laneStress = riskReport?.laneStressScore ?? 0;
  const combinedBenefit = weatherScore * 0.12 + laneStress * 0.1;

  if (combinedBenefit < 0.05) return null;

  const newRisk = Math.max(0, baselineRisk - combinedBenefit);

  return {
    scenarioType: "DELAYED_DEPARTURE",
    label: "Delay Departure by 5-7 Days",
    riskScore: newRisk,
    readinessScore: Math.min(1, baselineReadiness + 0.05),
    estimatedCost: baseline.estimatedCost,
    estimatedTransitDays: baseline.estimatedTransitDays ? baseline.estimatedTransitDays + 5 : null,
    riskDelta: newRisk - baselineRisk,
    costDelta: null,
    transitDelta: 5,
    recommendation: `Delaying departure reduces weather/lane risk by ${(combinedBenefit * 100).toFixed(0)}% and may improve readiness`,
    details: { weatherBenefit: weatherScore * 0.12, laneStressBenefit: laneStress * 0.1 },
  };
}

function buildInsuranceAlternative(
  baselineRisk: number,
  baselineReadiness: number,
  baseline: ScenarioComparisonResult["baseline"],
): Scenario {
  const premiumIncrease = baseline.estimatedCost ? baseline.estimatedCost * 0.03 : null;

  return {
    scenarioType: "INSURANCE_UPGRADE",
    label: "Upgrade Insurance Coverage",
    riskScore: Math.max(0, baselineRisk * 0.9),
    readinessScore: baselineReadiness,
    estimatedCost: baseline.estimatedCost && premiumIncrease ? baseline.estimatedCost + premiumIncrease : null,
    estimatedTransitDays: baseline.estimatedTransitDays,
    riskDelta: Math.max(0, baselineRisk * 0.9) - baselineRisk,
    costDelta: premiumIncrease,
    transitDelta: null,
    recommendation: `Enhanced insurance reduces financial exposure by ~10% with ${premiumIncrease ? `$${premiumIncrease.toFixed(0)}` : "modest"} premium increase`,
    details: { coverageImprovement: "comprehensive", riskTransferBenefit: 0.1 },
  };
}

function estimateTransitDays(pol: string | null, pod: string | null): number | null {
  if (!pol || !pod) return null;
  return 14;
}

export async function getLatestScenarioComparison(shipmentId: string, companyId: string) {
  const [comparison] = await db
    .select()
    .from(scenarioComparisonsTable)
    .where(
      and(
        eq(scenarioComparisonsTable.shipmentId, shipmentId),
        eq(scenarioComparisonsTable.companyId, companyId),
      ),
    )
    .orderBy(desc(scenarioComparisonsTable.computedAt))
    .limit(1);
  return comparison ?? null;
}
