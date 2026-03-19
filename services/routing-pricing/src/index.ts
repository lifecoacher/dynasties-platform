import { eq, and, desc } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  shipmentsTable,
  routingPricingResultsTable,
  complianceScreeningsTable,
  riskScoresTable,
  documentValidationResultsTable,
} from "@workspace/db/schema";
import { generateRoutes, getPortInfo } from "./routes.js";
import { priceRoutes } from "./pricing.js";
import { evaluateRisks } from "./risk.js";
import { runRoutingPricingAgent } from "./agent.js";

export interface RoutingPricingOutput {
  id: string;
  shipmentId: string;
  companyId: string;
  recommendedRouteIndex: string;
  routeOptions: Array<{
    label: string;
    type: "DIRECT" | "TRANSSHIPMENT" | "ALTERNATIVE";
    legs: Array<{ from: string; to: string; mode: string; transitDays: number }>;
    totalTransitDays: number;
    estimatedCost: number;
    costRange: { low: number; high: number };
    currency: string;
    costBreakdown: Array<{ code: string; label: string; amount: number }>;
    costConfidence: "HIGH" | "MEDIUM" | "LOW";
    advantages: string[];
    disadvantages: string[];
  }>;
  riskFactors: Array<{
    code: string;
    title: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    detail: string;
  }>;
  recommendationSummary: string | null;
  reasoning: string | null;
  analyzedAt: Date;
}

export async function runRoutingPricing(
  shipmentId: string,
  companyId: string,
): Promise<{ success: boolean; data?: RoutingPricingOutput; error?: string }> {
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

  if (!shipment) {
    return { success: false, error: "Shipment not found or company mismatch" };
  }

  const origin = shipment.portOfLoading || "";
  const destination = shipment.portOfDischarge || "";

  if (!origin && !destination) {
    return {
      success: false,
      error: "Shipment has no port of loading or discharge — cannot generate routes",
    };
  }

  const routes = generateRoutes(origin, destination);

  const originPort = getPortInfo(origin);
  const destPort = getPortInfo(destination);
  const regionKey =
    originPort && destPort
      ? `${originPort.region}→${destPort.region}`
      : null;

  const pricedRoutes = priceRoutes(routes, {
    grossWeight: shipment.grossWeight,
    volume: shipment.volume,
    cargoValue: shipment.cargoValue,
    commodity: shipment.commodity,
    hsCode: shipment.hsCode,
    packageCount: shipment.packageCount,
    freightTerms: shipment.freightTerms,
    weightUnit: shipment.weightUnit,
  }, regionKey);

  let complianceStatus: string | null = null;
  let complianceRiskLevel: string | null = null;
  let docValidationStatus: string | null = null;
  let docReadiness: string | null = null;

  try {
    const [screening] = await db
      .select({ status: complianceScreeningsTable.status })
      .from(complianceScreeningsTable)
      .where(
        and(
          eq(complianceScreeningsTable.shipmentId, shipmentId),
          eq(complianceScreeningsTable.companyId, companyId),
        ),
      )
      .orderBy(desc(complianceScreeningsTable.screenedAt))
      .limit(1);
    if (screening) complianceStatus = screening.status;

    const [riskScore] = await db
      .select({ compositeScore: riskScoresTable.compositeScore })
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
      const score = riskScore.compositeScore;
      complianceRiskLevel = score >= 75 ? "CRITICAL" : score >= 50 ? "HIGH" : score >= 25 ? "MEDIUM" : "LOW";
    }
  } catch {
  }

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
      docReadiness = docVal.readinessLevel;
    }
  } catch {
  }

  const recommendedRoute = pricedRoutes[0];
  const riskFactors = evaluateRisks({
    originCode: origin,
    destinationCode: destination,
    commodity: shipment.commodity,
    hsCode: shipment.hsCode,
    cargoValue: shipment.cargoValue,
    complianceStatus,
    complianceRiskLevel,
    docValidationStatus,
    docReadiness,
    hasTransshipment: pricedRoutes.some((r) => r.type === "TRANSSHIPMENT"),
    transitDays: recommendedRoute?.totalTransitDays ?? 0,
  });

  const agentResult = await runRoutingPricingAgent({
    shipmentRef: shipment.reference,
    originCode: origin,
    destinationCode: destination,
    commodity: shipment.commodity,
    hsCode: shipment.hsCode,
    grossWeight: shipment.grossWeight,
    volume: shipment.volume,
    incoterms: shipment.incoterms,
    routes: pricedRoutes,
    riskFactors,
  });

  const resultId = `rpr_${shipmentId}_${Date.now()}`;
  const now = new Date();

  await db
    .delete(routingPricingResultsTable)
    .where(
      and(
        eq(routingPricingResultsTable.shipmentId, shipmentId),
        eq(routingPricingResultsTable.companyId, companyId),
      ),
    );

  await db.insert(routingPricingResultsTable).values({
    id: resultId,
    companyId,
    shipmentId,
    recommendedRouteIndex: String(agentResult.recommendedRouteIndex),
    routeOptions: pricedRoutes.map((r) => ({
      label: r.label,
      type: r.type,
      legs: r.legs,
      totalTransitDays: r.totalTransitDays,
      estimatedCost: r.estimatedCost,
      costRange: r.costRange,
      currency: r.currency,
      costBreakdown: r.costBreakdown,
      costConfidence: r.costConfidence,
      advantages: r.advantages,
      disadvantages: r.disadvantages,
    })),
    riskFactors,
    recommendationSummary: agentResult.recommendationSummary,
    reasoning: agentResult.reasoning,
    analyzedAt: now,
  });

  return {
    success: true,
    data: {
      id: resultId,
      shipmentId,
      companyId,
      recommendedRouteIndex: String(agentResult.recommendedRouteIndex),
      routeOptions: pricedRoutes,
      riskFactors,
      recommendationSummary: agentResult.recommendationSummary,
      reasoning: agentResult.reasoning,
      analyzedAt: now,
    },
  };
}

export async function getRoutingPricingResult(
  shipmentId: string,
  companyId: string,
): Promise<RoutingPricingOutput | null> {
  const [result] = await db
    .select()
    .from(routingPricingResultsTable)
    .where(
      and(
        eq(routingPricingResultsTable.shipmentId, shipmentId),
        eq(routingPricingResultsTable.companyId, companyId),
      ),
    )
    .limit(1);

  if (!result) return null;

  return {
    id: result.id,
    shipmentId: result.shipmentId,
    companyId: result.companyId,
    recommendedRouteIndex: result.recommendedRouteIndex,
    routeOptions: result.routeOptions as RoutingPricingOutput["routeOptions"],
    riskFactors: result.riskFactors as RoutingPricingOutput["riskFactors"],
    recommendationSummary: result.recommendationSummary,
    reasoning: result.reasoning,
    analyzedAt: result.analyzedAt,
  };
}
