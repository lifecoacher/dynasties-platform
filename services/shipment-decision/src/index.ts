import { eq, and, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  shipmentsTable,
  shipmentDecisionsTable,
  complianceScreeningsTable,
  riskScoresTable,
  documentValidationResultsTable,
  preShipmentRiskReportsTable,
  releaseGateHoldsTable,
} from "@workspace/db/schema";
import { computeDecision, type DecisionOutput, type DecisionInput } from "./engine.js";

export type { DecisionOutput, DecisionInput };
export { computeDecision };

export interface ShipmentDecisionResult {
  id: string;
  shipmentId: string;
  companyId: string;
  finalStatus: string;
  releaseAllowed: boolean;
  decisionReason: string;
  baseRiskScore: number | null;
  dynamicRiskScore: number | null;
  finalRiskScore: number | null;
  complianceStatus: string | null;
  docValidationStatus: string | null;
  readinessScore: number | null;
  shipmentStatus: string | null;
  inputSnapshot: DecisionInput;
  unifiedRisk: DecisionOutput["unifiedRisk"];
  blockReasons: string[];
  reviewReasons: string[];
  decidedAt: Date;
}

async function gatherInputs(
  shipmentId: string,
  companyId: string,
): Promise<{ shipment: any; input: DecisionInput } | null> {
  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(
      and(
        eq(shipmentsTable.id, shipmentId),
        eq(shipmentsTable.companyId, companyId),
      ),
    )
    .limit(1);

  if (!shipment) return null;

  let complianceStatus: string | null = null;
  let complianceMatchCount = 0;
  try {
    const [screening] = await db
      .select({
        status: complianceScreeningsTable.status,
        matchCount: complianceScreeningsTable.matchCount,
      })
      .from(complianceScreeningsTable)
      .where(
        and(
          eq(complianceScreeningsTable.shipmentId, shipmentId),
          eq(complianceScreeningsTable.companyId, companyId),
        ),
      )
      .orderBy(desc(complianceScreeningsTable.screenedAt))
      .limit(1);
    if (screening) {
      complianceStatus = screening.status;
      complianceMatchCount = screening.matchCount;
    }
  } catch (err) {
    console.error("[decision-engine] Failed to fetch compliance data:", err);
    complianceStatus = "UNAVAILABLE";
  }

  let docValidationStatus: string | null = null;
  let docReadinessLevel: string | null = null;
  try {
    const [docVal] = await db
      .select({
        status: documentValidationResultsTable.status,
        readinessLevel: documentValidationResultsTable.readinessLevel,
      })
      .from(documentValidationResultsTable)
      .where(
        and(
          eq(documentValidationResultsTable.shipmentId, shipmentId),
          eq(documentValidationResultsTable.companyId, companyId),
        ),
      )
      .limit(1);
    if (docVal) {
      docValidationStatus = docVal.status;
      docReadinessLevel = docVal.readinessLevel;
    }
  } catch (err) {
    console.error("[decision-engine] Failed to fetch doc validation data:", err);
    docValidationStatus = "UNAVAILABLE";
  }

  let baseRiskScore: number | null = null;
  let baseRiskLevel: string | null = null;
  try {
    const [riskScore] = await db
      .select({
        compositeScore: riskScoresTable.compositeScore,
        recommendedAction: riskScoresTable.recommendedAction,
      })
      .from(riskScoresTable)
      .where(
        and(
          eq(riskScoresTable.shipmentId, shipmentId),
          eq(riskScoresTable.companyId, companyId),
        ),
      )
      .orderBy(desc(riskScoresTable.scoredAt))
      .limit(1);
    if (riskScore) {
      baseRiskScore = Math.min(Math.max(riskScore.compositeScore, 0), 100);
      baseRiskLevel =
        baseRiskScore >= 75 ? "CRITICAL" :
        baseRiskScore >= 50 ? "HIGH" :
        baseRiskScore >= 25 ? "MODERATE" : "LOW";
    }
  } catch (err) {
    console.error("[decision-engine] Failed to fetch risk score data:", err);
  }

  let dynamicRiskScore: number | null = null;
  let dynamicRiskLevel: string | null = null;
  let readinessScore: number | null = null;
  try {
    const [riskReport] = await db
      .select({
        overallRiskScore: preShipmentRiskReportsTable.overallRiskScore,
        riskLevel: preShipmentRiskReportsTable.riskLevel,
        readinessScore: preShipmentRiskReportsTable.readinessScore,
      })
      .from(preShipmentRiskReportsTable)
      .where(
        and(
          eq(preShipmentRiskReportsTable.shipmentId, shipmentId),
          eq(preShipmentRiskReportsTable.companyId, companyId),
        ),
      )
      .orderBy(desc(preShipmentRiskReportsTable.evaluatedAt))
      .limit(1);
    if (riskReport) {
      dynamicRiskScore = Math.min(Math.max(riskReport.overallRiskScore, 0), 100);
      dynamicRiskLevel = riskReport.riskLevel;
      if (riskReport.readinessScore != null) {
        readinessScore = riskReport.readinessScore;
      }
    }
  } catch (err) {
    console.error("[decision-engine] Failed to fetch risk report data:", err);
  }

  let activeHolds: string[] = [];
  try {
    const holds = await db
      .select({ gateType: releaseGateHoldsTable.gateType })
      .from(releaseGateHoldsTable)
      .where(
        and(
          eq(releaseGateHoldsTable.shipmentId, shipmentId),
          eq(releaseGateHoldsTable.companyId, companyId),
          eq(releaseGateHoldsTable.status, "ACTIVE"),
        ),
      );
    activeHolds = holds.map((h) => h.gateType);
  } catch (err) {
    console.error("[decision-engine] Failed to fetch gate holds:", err);
  }

  const input: DecisionInput = {
    shipmentStatus: shipment.status,
    complianceStatus,
    complianceMatchCount,
    docValidationStatus,
    docReadinessLevel,
    baseRiskScore,
    baseRiskLevel,
    dynamicRiskScore,
    dynamicRiskLevel,
    readinessScore,
    gateHoldsCount: activeHolds.length,
    activeHolds,
  };

  return { shipment, input };
}

export async function runShipmentDecision(
  shipmentId: string,
  companyId: string,
): Promise<{ success: boolean; data?: ShipmentDecisionResult; error?: string }> {
  const gathered = await gatherInputs(shipmentId, companyId);
  if (!gathered) {
    return { success: false, error: "Shipment not found or company mismatch" };
  }

  const { input } = gathered;
  const decision = computeDecision(input);
  const resultId = `sdec_${shipmentId}_${Date.now()}`;
  const now = new Date();

  await db
    .delete(shipmentDecisionsTable)
    .where(
      and(
        eq(shipmentDecisionsTable.shipmentId, shipmentId),
        eq(shipmentDecisionsTable.companyId, companyId),
      ),
    );

  await db.insert(shipmentDecisionsTable).values({
    id: resultId,
    companyId,
    shipmentId,
    finalStatus: decision.finalStatus,
    releaseAllowed: decision.releaseAllowed,
    decisionReason: decision.decisionReason,
    baseRiskScore: decision.unifiedRisk.baseScore,
    dynamicRiskScore: decision.unifiedRisk.dynamicScore,
    finalRiskScore: decision.unifiedRisk.finalScore,
    complianceStatus: input.complianceStatus,
    docValidationStatus: input.docValidationStatus,
    readinessScore: input.readinessScore,
    shipmentStatus: input.shipmentStatus,
    inputSnapshot: input,
    decidedAt: now,
  });

  return {
    success: true,
    data: {
      id: resultId,
      shipmentId,
      companyId,
      finalStatus: decision.finalStatus,
      releaseAllowed: decision.releaseAllowed,
      decisionReason: decision.decisionReason,
      baseRiskScore: decision.unifiedRisk.baseScore,
      dynamicRiskScore: decision.unifiedRisk.dynamicScore,
      finalRiskScore: decision.unifiedRisk.finalScore,
      complianceStatus: input.complianceStatus,
      docValidationStatus: input.docValidationStatus,
      readinessScore: input.readinessScore,
      shipmentStatus: input.shipmentStatus,
      inputSnapshot: input,
      unifiedRisk: decision.unifiedRisk,
      blockReasons: decision.blockReasons,
      reviewReasons: decision.reviewReasons,
      decidedAt: now,
    },
  };
}

export async function getShipmentDecision(
  shipmentId: string,
  companyId: string,
): Promise<ShipmentDecisionResult | null> {
  const [result] = await db
    .select()
    .from(shipmentDecisionsTable)
    .where(
      and(
        eq(shipmentDecisionsTable.shipmentId, shipmentId),
        eq(shipmentDecisionsTable.companyId, companyId),
      ),
    )
    .limit(1);

  if (!result) return null;

  const snapshot = result.inputSnapshot as DecisionInput;
  const decision = computeDecision(snapshot);

  return {
    id: result.id,
    shipmentId: result.shipmentId,
    companyId: result.companyId,
    finalStatus: result.finalStatus,
    releaseAllowed: result.releaseAllowed,
    decisionReason: result.decisionReason,
    baseRiskScore: result.baseRiskScore,
    dynamicRiskScore: result.dynamicRiskScore,
    finalRiskScore: result.finalRiskScore,
    complianceStatus: result.complianceStatus,
    docValidationStatus: result.docValidationStatus,
    readinessScore: result.readinessScore,
    shipmentStatus: result.shipmentStatus,
    inputSnapshot: snapshot,
    unifiedRisk: decision.unifiedRisk,
    blockReasons: decision.blockReasons,
    reviewReasons: decision.reviewReasons,
    decidedAt: result.decidedAt,
  };
}
