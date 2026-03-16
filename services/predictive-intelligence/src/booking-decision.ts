import { db } from "@workspace/db";
import {
  bookingDecisionsTable,
  preShipmentRiskReportsTable,
  shipmentsTable,
} from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import { computeReadinessScore } from "./readiness-scoring.js";
import { evaluatePreShipmentRisk } from "./pre-shipment-risk.js";

export type BookingDecisionStatus =
  | "APPROVED"
  | "APPROVED_WITH_CAUTION"
  | "REQUIRES_REVIEW"
  | "BLOCKED"
  | "RECOMMEND_ALTERNATIVE";

export interface BookingDecisionResult {
  id: string;
  shipmentId: string;
  status: BookingDecisionStatus;
  confidence: number;
  overallRiskScore: number;
  readinessScore: number;
  reasonCodes: string[];
  requiredActions: string[];
  recommendedAlternatives: Array<{
    type: string;
    description: string;
    estimatedRiskReduction: number;
  }>;
  inputScores: {
    laneStress: number;
    portCongestion: number;
    disruptionRisk: number;
    weatherExposure: number;
    carrierReliability: number;
    entityCompliance: number;
  };
}

export async function evaluateBookingDecision(
  shipmentId: string,
  companyId: string,
): Promise<BookingDecisionResult> {
  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(and(eq(shipmentsTable.id, shipmentId), eq(shipmentsTable.companyId, companyId)))
    .limit(1);

  if (!shipment) {
    throw new Error(`Shipment ${shipmentId} not found`);
  }

  const riskResult = await evaluatePreShipmentRisk({
    shipmentId,
    companyId,
    portOfLoading: shipment.portOfLoading,
    portOfDischarge: shipment.portOfDischarge,
    carrierId: shipment.carrierId,
    shipperId: shipment.shipperId,
    consigneeId: shipment.consigneeId,
    etd: shipment.etd ? new Date(shipment.etd) : null,
  });

  const readinessResult = await computeReadinessScore(shipmentId, companyId);

  const inputScores = {
    laneStress: riskResult.components.laneStress.score,
    portCongestion: riskResult.components.portCongestion.score,
    disruptionRisk: riskResult.components.disruptionRisk.score,
    weatherExposure: riskResult.components.weatherExposure.score,
    carrierReliability: riskResult.components.carrierReliability.score,
    entityCompliance: riskResult.components.entityCompliance.score,
  };

  const reasonCodes: string[] = [];
  const requiredActions: string[] = [];
  const recommendedAlternatives: BookingDecisionResult["recommendedAlternatives"] = [];

  if (inputScores.entityCompliance >= 0.7) {
    reasonCodes.push("ENTITY_COMPLIANCE_CRITICAL");
    requiredActions.push("Resolve compliance issues before booking");
  }
  if (inputScores.laneStress >= 0.7) {
    reasonCodes.push("LANE_STRESS_HIGH");
    requiredActions.push("Consider alternate lane or departure window");
    recommendedAlternatives.push({
      type: "ALTERNATE_DEPARTURE",
      description: "Delay departure by 5-7 days to allow lane stress to subside",
      estimatedRiskReduction: 0.15,
    });
  }
  if (inputScores.portCongestion >= 0.7) {
    reasonCodes.push("PORT_CONGESTION_HIGH");
    requiredActions.push("Monitor port conditions; consider alternate port");
    recommendedAlternatives.push({
      type: "ALTERNATE_PORT",
      description: "Route through alternate port to avoid congestion",
      estimatedRiskReduction: 0.2,
    });
  }
  if (inputScores.disruptionRisk >= 0.6) {
    reasonCodes.push("DISRUPTION_RISK_ELEVATED");
    requiredActions.push("Review active disruptions before confirming booking");
  }
  if (inputScores.weatherExposure >= 0.6) {
    reasonCodes.push("WEATHER_RISK_ELEVATED");
    requiredActions.push("Check weather forecasts; consider delayed departure");
    recommendedAlternatives.push({
      type: "DELAYED_DEPARTURE",
      description: "Delay departure to avoid weather window",
      estimatedRiskReduction: 0.1,
    });
  }
  if (inputScores.carrierReliability >= 0.6) {
    reasonCodes.push("CARRIER_RELIABILITY_CONCERN");
    requiredActions.push("Evaluate alternate carrier options");
    recommendedAlternatives.push({
      type: "ALTERNATE_CARRIER",
      description: "Switch to a carrier with better reliability score",
      estimatedRiskReduction: 0.12,
    });
  }
  if (readinessResult.overallScore < 0.5) {
    reasonCodes.push("LOW_READINESS");
    requiredActions.push("Complete missing documentation and operational details");
  }
  if (readinessResult.components.documentation.status === "NOT_READY") {
    reasonCodes.push("DOCUMENTS_INCOMPLETE");
    requiredActions.push("Attach required shipping documents");
  }
  if (readinessResult.components.compliance.status === "NOT_READY") {
    reasonCodes.push("COMPLIANCE_BLOCKED");
    requiredActions.push("Resolve compliance screening issues");
  }
  if (recommendedAlternatives.length > 0) {
    reasonCodes.push("ALTERNATE_AVAILABLE");
  }

  const status = determineBookingStatus(
    riskResult.overallRiskScore,
    readinessResult.overallScore,
    inputScores,
    reasonCodes,
  );

  const confidence = computeConfidence(
    riskResult.overallRiskScore,
    readinessResult.overallScore,
    reasonCodes,
  );

  const id = generateId("bkd");

  await db.insert(bookingDecisionsTable).values({
    id,
    companyId,
    shipmentId,
    status,
    confidence,
    overallRiskScore: riskResult.overallRiskScore,
    readinessScore: readinessResult.overallScore,
    reasonCodes,
    requiredActions,
    recommendedAlternatives: recommendedAlternatives.length > 0 ? recommendedAlternatives : null,
    inputScores,
  });

  return {
    id,
    shipmentId,
    status,
    confidence,
    overallRiskScore: riskResult.overallRiskScore,
    readinessScore: readinessResult.overallScore,
    reasonCodes,
    requiredActions,
    recommendedAlternatives,
    inputScores,
  };
}

function determineBookingStatus(
  riskScore: number,
  readinessScore: number,
  inputScores: BookingDecisionResult["inputScores"],
  reasonCodes: string[],
): BookingDecisionStatus {
  if (
    reasonCodes.includes("COMPLIANCE_BLOCKED") ||
    reasonCodes.includes("ENTITY_COMPLIANCE_CRITICAL") ||
    riskScore >= 0.85
  ) {
    return "BLOCKED";
  }

  if (
    riskScore >= 0.7 ||
    (inputScores.disruptionRisk >= 0.7 && inputScores.weatherExposure >= 0.5)
  ) {
    return reasonCodes.some((c) =>
      c.includes("ALTERNATE"),
    ) && reasonCodes.length > 1
      ? "RECOMMEND_ALTERNATIVE"
      : "REQUIRES_REVIEW";
  }

  if (
    riskScore >= 0.5 ||
    readinessScore < 0.5 ||
    reasonCodes.includes("LOW_READINESS")
  ) {
    return "REQUIRES_REVIEW";
  }

  if (
    riskScore >= 0.3 ||
    reasonCodes.length > 0
  ) {
    return "APPROVED_WITH_CAUTION";
  }

  return "APPROVED";
}

function computeConfidence(
  riskScore: number,
  readinessScore: number,
  reasonCodes: string[],
): number {
  let confidence = 0.8;
  if (reasonCodes.length > 3) confidence -= 0.1;
  if (riskScore >= 0.6) confidence -= 0.05;
  if (readinessScore < 0.4) confidence -= 0.05;
  if (riskScore <= 0.2 && readinessScore >= 0.8) confidence = 0.95;
  return Math.max(0.5, Math.min(1, confidence));
}

export async function getLatestBookingDecision(shipmentId: string, companyId: string) {
  const [decision] = await db
    .select()
    .from(bookingDecisionsTable)
    .where(
      and(
        eq(bookingDecisionsTable.shipmentId, shipmentId),
        eq(bookingDecisionsTable.companyId, companyId),
      ),
    )
    .orderBy(desc(bookingDecisionsTable.decidedAt))
    .limit(1);
  return decision ?? null;
}

export async function overrideBookingDecision(
  decisionId: string,
  companyId: string,
  overriddenBy: string,
  reason: string,
) {
  await db
    .update(bookingDecisionsTable)
    .set({ overriddenBy, overrideReason: reason })
    .where(
      and(
        eq(bookingDecisionsTable.id, decisionId),
        eq(bookingDecisionsTable.companyId, companyId),
      ),
    );
}
