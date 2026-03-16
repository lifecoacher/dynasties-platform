import { db } from "@workspace/db";
import {
  shipmentsTable,
  complianceScreeningsTable,
  riskScoresTable,
  insuranceQuotesTable,
  exceptionsTable,
  tradeLaneStatsTable,
  shipmentChargesTable,
  recommendationsTable,
  eventsTable,
} from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import {
  analyzeShipment,
  recommendationSchema,
  type AnalysisInputs,
  type RecommendationInput,
} from "./analyzer.js";
import { buildGraphEdges } from "./graph-builder.js";

export interface DecisionResult {
  recommendationsCreated: number;
  graphEdgesCreated: number;
  success: boolean;
  error: string | null;
}

export async function runDecisionEngine(
  shipmentId: string,
  companyId: string,
): Promise<DecisionResult> {
  console.log(`[decision-engine] starting analysis for shipment=${shipmentId}`);

  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(and(eq(shipmentsTable.id, shipmentId), eq(shipmentsTable.companyId, companyId)))
    .limit(1);

  if (!shipment) {
    return {
      recommendationsCreated: 0,
      graphEdgesCreated: 0,
      success: false,
      error: "Shipment not found or company mismatch",
    };
  }

  const [compliance] = await db
    .select()
    .from(complianceScreeningsTable)
    .where(eq(complianceScreeningsTable.shipmentId, shipmentId))
    .limit(1);

  const [riskScore] = await db
    .select()
    .from(riskScoresTable)
    .where(eq(riskScoresTable.shipmentId, shipmentId))
    .limit(1);

  const [insurance] = await db
    .select()
    .from(insuranceQuotesTable)
    .where(eq(insuranceQuotesTable.shipmentId, shipmentId))
    .limit(1);

  const exceptions = await db
    .select()
    .from(exceptionsTable)
    .where(
      and(
        eq(exceptionsTable.shipmentId, shipmentId),
        eq(exceptionsTable.companyId, companyId),
      ),
    );

  let tradeLane = null;
  if (shipment.portOfLoading && shipment.portOfDischarge) {
    const [lane] = await db
      .select()
      .from(tradeLaneStatsTable)
      .where(
        and(
          eq(tradeLaneStatsTable.companyId, companyId),
          eq(tradeLaneStatsTable.origin, shipment.portOfLoading),
          eq(tradeLaneStatsTable.destination, shipment.portOfDischarge),
        ),
      )
      .limit(1);
    tradeLane = lane || null;
  }

  let pricing = null;
  const charges = await db
    .select({
      total: sql<string>`COALESCE(SUM(${shipmentChargesTable.totalAmount}), 0)`,
      count: sql<string>`COUNT(*)`,
    })
    .from(shipmentChargesTable)
    .where(eq(shipmentChargesTable.shipmentId, shipmentId));

  if (charges[0]) {
    pricing = {
      totalAmount: Number(charges[0].total),
      chargeCount: Number(charges[0].count),
    };
  }

  const inputs: AnalysisInputs = {
    shipment: {
      shipmentId,
      companyId,
      status: shipment.status,
      commodity: shipment.commodity,
      hsCode: shipment.hsCode,
      portOfLoading: shipment.portOfLoading,
      portOfDischarge: shipment.portOfDischarge,
      vessel: shipment.vessel,
      etd: shipment.etd,
      eta: shipment.eta,
      grossWeight: shipment.grossWeight,
    },
    compliance: compliance
      ? {
          status: compliance.status,
          matches: compliance.matches,
        }
      : null,
    risk: riskScore
      ? {
          compositeScore: riskScore.compositeScore,
          subScores: (riskScore.subScores as Record<string, number>) || {},
          recommendedAction: riskScore.recommendedAction || "",
          primaryRiskFactors: (riskScore.primaryRiskFactors as Array<{ factor: string; explanation: string }>) || [],
        }
      : null,
    insurance: insurance
      ? {
          coverageType: insurance.coverageType,
          estimatedPremium: Number(insurance.estimatedPremium),
          confidenceScore: Number(insurance.confidenceScore),
        }
      : null,
    exceptions: exceptions.map((e) => ({
      id: e.id,
      exceptionType: e.exceptionType,
      severity: e.severity,
      title: e.title,
      status: e.status,
    })),
    tradeLane: tradeLane
      ? {
          origin: tradeLane.origin,
          destination: tradeLane.destination,
          shipmentCount: tradeLane.shipmentCount,
          delayCount: tradeLane.delayCount,
          delayFrequency: tradeLane.delayFrequency,
          carrierPerformanceScore: tradeLane.carrierPerformanceScore,
          avgTransitDays: tradeLane.avgTransitDays,
        }
      : null,
    pricing,
  };

  const rawRecs = analyzeShipment(inputs);

  const validRecs: RecommendationInput[] = [];
  for (const rec of rawRecs) {
    const result = recommendationSchema.safeParse(rec);
    if (result.success) {
      validRecs.push(result.data);
    } else {
      console.warn(`[decision-engine] recommendation validation failed:`, result.error.flatten());
    }
  }

  let recommendationsCreated = 0;
  if (validRecs.length > 0) {
    await db.transaction(async (tx) => {
      for (const rec of validRecs) {
        const recId = generateId();
        await tx.insert(recommendationsTable).values({
          id: recId,
          companyId,
          shipmentId,
          type: rec.type,
          title: rec.title,
          explanation: rec.explanation,
          reasonCodes: rec.reasonCodes,
          confidence: rec.confidence,
          urgency: rec.urgency,
          expectedDelayImpactDays: rec.expectedDelayImpactDays ?? null,
          expectedMarginImpactPct: rec.expectedMarginImpactPct ?? null,
          expectedRiskReduction: rec.expectedRiskReduction ?? null,
          recommendedAction: rec.recommendedAction,
          status: "PENDING",
          sourceAgent: rec.sourceAgent,
          sourceData: {
            riskScore: riskScore?.compositeScore ?? null,
            complianceStatus: compliance?.status ?? null,
            insuranceCoverage: insurance?.coverageType ?? null,
          },
        });
        recommendationsCreated++;
      }

      await tx.insert(eventsTable).values({
        id: generateId(),
        companyId,
        eventType: "RECOMMENDATIONS_GENERATED",
        entityType: "shipment",
        entityId: shipmentId,
        actorType: "SERVICE",
        serviceId: "decision-engine",
        metadata: {
          recommendationsCreated,
          types: validRecs.map((r) => r.type),
          urgencies: validRecs.map((r) => r.urgency),
        },
      });
    });
  }

  let graphEdgesCreated = 0;
  try {
    const graphResult = await buildGraphEdges(shipmentId, companyId);
    graphEdgesCreated = graphResult.edgesCreated;
  } catch (err) {
    console.error(`[decision-engine] graph building failed:`, err);
  }

  console.log(
    `[decision-engine] complete: shipment=${shipmentId} recommendations=${recommendationsCreated} edges=${graphEdgesCreated}`,
  );

  return {
    recommendationsCreated,
    graphEdgesCreated,
    success: true,
    error: null,
  };
}
