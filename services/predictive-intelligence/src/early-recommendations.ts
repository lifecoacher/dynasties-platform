import { db } from "@workspace/db";
import {
  shipmentsTable,
  recommendationsTable,
  preShipmentRiskReportsTable,
} from "@workspace/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import { evaluatePreShipmentRisk } from "./pre-shipment-risk.js";

export interface EarlyRecommendation {
  type: string;
  urgency: string;
  confidence: number;
  title: string;
  explanation: string;
  recommendedAction: string;
  reasonCodes: string[];
}

export interface EarlyRecommendationResult {
  shipmentId: string;
  recommendations: EarlyRecommendation[];
  persisted: number;
}

const PRE_DEPARTURE_STATUSES = ["DRAFT", "PENDING_REVIEW", "APPROVED"] as const;

export async function generateEarlyRecommendations(
  shipmentId: string,
  companyId: string,
  systemAgent: string = "predictive-intelligence",
): Promise<EarlyRecommendationResult> {
  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(and(eq(shipmentsTable.id, shipmentId), eq(shipmentsTable.companyId, companyId)))
    .limit(1);

  if (!shipment) {
    return { shipmentId, recommendations: [], persisted: 0 };
  }

  const isPreDeparture =
    (PRE_DEPARTURE_STATUSES as readonly string[]).includes(shipment.status) ||
    (shipment.etd && new Date(shipment.etd) > new Date());

  if (!isPreDeparture) {
    return { shipmentId, recommendations: [], persisted: 0 };
  }

  const riskInput = {
    shipmentId,
    companyId,
    portOfLoading: shipment.portOfLoading,
    portOfDischarge: shipment.portOfDischarge,
    carrierId: shipment.carrierId,
    shipperId: shipment.shipperId,
    consigneeId: shipment.consigneeId,
    etd: shipment.etd ? new Date(shipment.etd) : null,
  };

  const riskResult = await evaluatePreShipmentRisk(riskInput);
  const recommendations: EarlyRecommendation[] = [];

  const { components } = riskResult;

  if (components.disruptionRisk.score >= 0.6) {
    const urgency = components.disruptionRisk.score >= 0.8 ? "CRITICAL" : "HIGH";
    recommendations.push({
      type: "DELAY_WARNING",
      urgency,
      confidence: Math.min(components.disruptionRisk.score + 0.1, 0.95),
      title: `Pre-departure disruption risk — delay departure advisory`,
      explanation: `Active disruption signals detected on the planned route. Risk score: ${(components.disruptionRisk.score * 100).toFixed(0)}%. ${components.disruptionRisk.factors.join(". ")}`,
      recommendedAction: "Evaluate delaying departure until disruption clears or consider alternative routing",
      reasonCodes: ["PRE_DEPARTURE_DISRUPTION", "PREDICTIVE_ALERT"],
    });
  }

  if (components.carrierReliability.score >= 0.5) {
    const urgency = components.carrierReliability.score >= 0.7 ? "HIGH" : "MEDIUM";
    recommendations.push({
      type: "CARRIER_SWITCH",
      urgency,
      confidence: Math.min(components.carrierReliability.score + 0.1, 0.9),
      title: `Pre-departure carrier concern — consider alternative`,
      explanation: `Carrier reliability risk: ${(components.carrierReliability.score * 100).toFixed(0)}%. ${components.carrierReliability.factors.join(". ")}`,
      recommendedAction: "Evaluate alternative carrier options before departure",
      reasonCodes: ["PRE_DEPARTURE_CARRIER_RISK", "PREDICTIVE_ALERT"],
    });
  }

  if (components.laneStress.score >= 0.6 || components.portCongestion.score >= 0.6) {
    const maxScore = Math.max(components.laneStress.score, components.portCongestion.score);
    const urgency = maxScore >= 0.8 ? "HIGH" : "MEDIUM";
    const factors = [...components.laneStress.factors, ...components.portCongestion.factors];
    recommendations.push({
      type: "ROUTE_ADJUSTMENT",
      urgency,
      confidence: Math.min(maxScore + 0.05, 0.9),
      title: `Pre-departure route advisory — congestion/stress detected`,
      explanation: `Lane stress: ${(components.laneStress.score * 100).toFixed(0)}%. Port congestion: ${(components.portCongestion.score * 100).toFixed(0)}%. ${factors.join(". ")}`,
      recommendedAction: "Consider rerouting shipment to avoid congested lanes/ports",
      reasonCodes: ["PRE_DEPARTURE_ROUTE_STRESS", "PREDICTIVE_ALERT"],
    });
  }

  if (components.entityCompliance.score >= 0.3) {
    const urgency = components.entityCompliance.score >= 0.6 ? "CRITICAL" : "HIGH";
    recommendations.push({
      type: "COMPLIANCE_ESCALATION",
      urgency,
      confidence: Math.min(components.entityCompliance.score + 0.15, 0.95),
      title: `Pre-departure compliance review required`,
      explanation: `Entity compliance risk detected: ${(components.entityCompliance.score * 100).toFixed(0)}%. ${components.entityCompliance.factors.join(". ")}`,
      recommendedAction: "Escalate compliance review before shipment departure",
      reasonCodes: ["PRE_DEPARTURE_COMPLIANCE", "PREDICTIVE_ALERT"],
    });
  }

  if (components.weatherExposure.score >= 0.5) {
    const urgency = components.weatherExposure.score >= 0.7 ? "HIGH" : "MEDIUM";
    recommendations.push({
      type: "INSURANCE_ADJUSTMENT",
      urgency,
      confidence: Math.min(components.weatherExposure.score + 0.05, 0.85),
      title: `Pre-departure weather risk — adjust insurance coverage`,
      explanation: `Weather exposure risk: ${(components.weatherExposure.score * 100).toFixed(0)}%. ${components.weatherExposure.factors.join(". ")}`,
      recommendedAction: "Review and potentially increase insurance coverage for weather-related delays/damage",
      reasonCodes: ["PRE_DEPARTURE_WEATHER", "PREDICTIVE_ALERT"],
    });
  }

  let persisted = 0;
  for (const rec of recommendations) {
    const fingerprint = `PRE-${shipmentId}-${rec.type}-${rec.reasonCodes.sort().join(",")}`;

    const existing = await db
      .select({ id: recommendationsTable.id })
      .from(recommendationsTable)
      .where(
        and(
          eq(recommendationsTable.shipmentId, shipmentId),
          eq(recommendationsTable.companyId, companyId),
          eq(recommendationsTable.fingerprint, fingerprint),
          inArray(recommendationsTable.status, ["PENDING", "SHOWN"]),
        ),
      )
      .limit(1);

    if (existing.length > 0) continue;

    await db.insert(recommendationsTable).values({
      id: generateId("rec"),
      companyId,
      shipmentId,
      fingerprint,
      type: rec.type as any,
      title: rec.title,
      explanation: rec.explanation,
      reasonCodes: rec.reasonCodes,
      confidence: rec.confidence,
      urgency: rec.urgency as any,
      recommendedAction: rec.recommendedAction,
      sourceAgent: systemAgent,
      intelligenceEnriched: "true",
      metadata: { predictive: true, preShipmentRiskReportId: null },
    });
    persisted++;
  }

  return { shipmentId, recommendations, persisted };
}

export async function getPreDepartureShipments(companyId: string, limit: number = 50) {
  return db
    .select()
    .from(shipmentsTable)
    .where(
      and(
        eq(shipmentsTable.companyId, companyId),
        inArray(shipmentsTable.status, PRE_DEPARTURE_STATUSES),
      ),
    )
    .orderBy(shipmentsTable.etd)
    .limit(limit);
}

export async function batchGenerateEarlyRecommendations(
  companyId: string,
  systemAgent: string = "predictive-intelligence",
): Promise<{ evaluated: number; recommendationsGenerated: number }> {
  const shipments = await getPreDepartureShipments(companyId, 50);
  let totalRecs = 0;

  for (const shipment of shipments) {
    const result = await generateEarlyRecommendations(shipment.id, companyId, systemAgent);
    totalRecs += result.persisted;
  }

  return { evaluated: shipments.length, recommendationsGenerated: totalRecs };
}
