import { db } from "@workspace/db";
import {
  riskScoresTable,
  eventsTable,
  shipmentsTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import { computeRiskScore, type SubScores } from "./scorer.js";
import { runRiskAgent } from "./agent.js";
import { validateRiskOutput, type RiskFactor } from "./validator.js";

export interface RiskResult {
  riskScoreId: string | null;
  compositeScore: number;
  recommendedAction: string;
  riskFactors: RiskFactor[];
  success: boolean;
  error: string | null;
}

export async function runRiskIntelligence(
  shipmentId: string,
  companyId: string,
): Promise<RiskResult> {
  console.log(`[risk] starting scoring for shipment=${shipmentId}`);

  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(eq(shipmentsTable.id, shipmentId))
    .limit(1);

  if (!shipment || shipment.companyId !== companyId) {
    return {
      riskScoreId: null,
      compositeScore: 0,
      recommendedAction: "",
      riskFactors: [],
      success: false,
      error: "Shipment not found or company mismatch",
    };
  }

  const existing = await db
    .select({ id: riskScoresTable.id })
    .from(riskScoresTable)
    .where(eq(riskScoresTable.shipmentId, shipmentId))
    .limit(1);

  if (existing.length > 0) {
    console.log(`[risk] score already exists for shipment=${shipmentId}, skipping`);
    return {
      riskScoreId: existing[0]!.id,
      compositeScore: 0,
      recommendedAction: "",
      riskFactors: [],
      success: true,
      error: null,
    };
  }

  const scoreResult = computeRiskScore(shipment);

  let riskFactors: RiskFactor[] = [];

  try {
    const agentOutput = await runRiskAgent({
      compositeScore: scoreResult.compositeScore,
      subScores: scoreResult.subScores,
      commodity: shipment.commodity,
      hsCode: shipment.hsCode,
      portOfLoading: shipment.portOfLoading,
      portOfDischarge: shipment.portOfDischarge,
      vessel: shipment.vessel,
      incoterms: shipment.incoterms,
    });

    const validation = validateRiskOutput(agentOutput.raw);

    if (validation.valid) {
      riskFactors = validation.data;
    } else {
      console.log(`[risk] agent validation failed: ${validation.errors.join("; ")}`);
      riskFactors = deriveFactorsFromScores(scoreResult.subScores);
    }
  } catch (err) {
    console.error("[risk] agent error, using deterministic factors:", err);
    riskFactors = deriveFactorsFromScores(scoreResult.subScores);
  }

  const riskScoreId = generateId();

  await db.transaction(async (tx) => {
    await tx.insert(riskScoresTable).values({
      id: riskScoreId,
      companyId,
      shipmentId,
      compositeScore: scoreResult.compositeScore,
      subScores: scoreResult.subScores,
      primaryRiskFactors: riskFactors,
      recommendedAction: scoreResult.recommendedAction,
      scoredAt: new Date(),
    });

    await tx.insert(eventsTable).values({
      actorType: "SERVICE",
      id: generateId(),
      companyId,
      eventType: "RISK_SCORED",
      entityType: "shipment",
      entityId: shipmentId,
      serviceId: "risk-intelligence",
      metadata: {
        riskScoreId,
        compositeScore: scoreResult.compositeScore,
        recommendedAction: scoreResult.recommendedAction,
        subScores: scoreResult.subScores,
        factorCount: riskFactors.length,
      },
    });
  });

  console.log(
    `[risk] scoring complete: shipment=${shipmentId} score=${scoreResult.compositeScore} action=${scoreResult.recommendedAction} factors=${riskFactors.length}`,
  );

  return {
    riskScoreId,
    compositeScore: scoreResult.compositeScore,
    recommendedAction: scoreResult.recommendedAction,
    riskFactors,
    success: true,
    error: null,
  };
}

function deriveFactorsFromScores(
  subScores: SubScores,
): RiskFactor[] {
  const factors: RiskFactor[] = [];
  const entries: [string, number][] = [
    ["cargoType", subScores.cargoType],
    ["tradeLane", subScores.tradeLane],
    ["counterparty", subScores.counterparty],
    ["routeGeopolitical", subScores.routeGeopolitical],
    ["seasonal", subScores.seasonal],
    ["documentCompleteness", subScores.documentCompleteness],
  ];
  const sorted = entries.sort((a, b) => b[1] - a[1]);

  for (const [key, value] of sorted.slice(0, 3)) {
    if (value >= 0.3) {
      factors.push({
        factor: formatFactorName(key),
        explanation: `Scored ${(value * 100).toFixed(0)}% risk based on deterministic analysis.`,
      });
    }
  }

  return factors;
}

function formatFactorName(key: string): string {
  const names: Record<string, string> = {
    cargoType: "Cargo type risk",
    tradeLane: "Trade lane risk",
    counterparty: "Counterparty risk",
    routeGeopolitical: "Route geopolitical risk",
    seasonal: "Seasonal risk",
    documentCompleteness: "Document completeness risk",
  };
  return names[key] || key;
}
