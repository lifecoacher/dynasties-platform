import { db } from "@workspace/db";
import crypto from "node:crypto";
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
  shipmentIntelligenceSnapshotsTable,
} from "@workspace/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import {
  analyzeShipment,
  recommendationSchema,
  computeFingerprint,
  type AnalysisInputs,
  type RecommendationInput,
} from "./analyzer.js";
import { computeExpiresAt } from "./config.js";
import { buildGraphEdges } from "./graph-builder.js";
import { buildIntelligenceSummary } from "./intelligence-summary.js";

export interface DecisionResult {
  recommendationsCreated: number;
  recommendationsSuperseded: number;
  recommendationsDeduplicated: number;
  graphEdgesCreated: number;
  intelligenceSignalsUsed: number;
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
      recommendationsSuperseded: 0,
      recommendationsDeduplicated: 0,
      graphEdgesCreated: 0,
      intelligenceSignalsUsed: 0,
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

  let intelligence = null;
  let snapshotId: string | null = null;
  try {
    intelligence = await buildIntelligenceSummary(
      shipmentId,
      companyId,
      shipment.portOfLoading,
      shipment.portOfDischarge,
      shipment.vessel,
    );
    console.log(
      `[decision-engine] intelligence summary: composite=${intelligence.compositeIntelScore} signals=${intelligence.signals.length} congestion=${intelligence.congestionScore} disruption=${intelligence.disruptionScore} weather=${intelligence.weatherRiskScore} sanctions=${intelligence.sanctionsRiskScore} market=${intelligence.marketPressureScore}`,
    );

    const snapshotData = {
      congestionScore: intelligence.congestionScore,
      disruptionScore: intelligence.disruptionScore,
      weatherRiskScore: intelligence.weatherRiskScore,
      sanctionsRiskScore: intelligence.sanctionsRiskScore,
      vesselRiskScore: intelligence.vesselRiskScore,
      marketPressureScore: intelligence.marketPressureScore,
      linkedSignalIds: intelligence.linkedSignalIds,
    };
    const snapshotHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(snapshotData))
      .digest("hex")
      .slice(0, 40);

    const externalReasonCodes = intelligence.signals.map((s) => s.externalReasonCode);

    snapshotId = generateId();
    await db.insert(shipmentIntelligenceSnapshotsTable).values({
      id: snapshotId,
      companyId,
      shipmentId,
      congestionScore: intelligence.congestionScore,
      disruptionScore: intelligence.disruptionScore,
      weatherRiskScore: intelligence.weatherRiskScore,
      sanctionsRiskScore: intelligence.sanctionsRiskScore,
      vesselRiskScore: intelligence.vesselRiskScore,
      marketPressureScore: intelligence.marketPressureScore,
      compositeIntelScore: intelligence.compositeIntelScore,
      linkedSignalIds: intelligence.linkedSignalIds,
      externalReasonCodes,
      evidenceSummary: intelligence.signals.map((s) => ({
        signalId: s.signalId,
        signalType: s.signalType,
        severity: s.severity,
        summary: s.summary,
      })),
      snapshotHash,
      generatedAt: intelligence.generatedAt,
    });
    console.log(`[decision-engine] snapshot persisted: ${snapshotId} hash=${snapshotHash}`);
  } catch (err) {
    console.warn(`[decision-engine] intelligence summary failed, proceeding without:`, err);
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
    intelligence,
  };

  const rawRecs = analyzeShipment(inputs);

  const validRecs: (RecommendationInput & { fingerprint: string })[] = [];
  for (const rec of rawRecs) {
    const result = recommendationSchema.safeParse(rec);
    if (result.success) {
      const fp = computeFingerprint(
        shipmentId,
        result.data.type,
        result.data.reasonCodes,
        result.data.recommendedAction,
      );
      validRecs.push({ ...result.data, fingerprint: fp });
    } else {
      console.warn(`[decision-engine] recommendation validation failed:`, result.error.flatten());
    }
  }

  const activeRecs = await db
    .select()
    .from(recommendationsTable)
    .where(
      and(
        eq(recommendationsTable.shipmentId, shipmentId),
        eq(recommendationsTable.companyId, companyId),
        inArray(recommendationsTable.status, ["PENDING", "SHOWN"]),
      ),
    );

  const activeByFingerprint = new Map<string, typeof activeRecs[0]>();
  const legacyByType = new Map<string, typeof activeRecs[0][]>();
  for (const r of activeRecs) {
    if (r.fingerprint) {
      activeByFingerprint.set(r.fingerprint, r);
    } else {
      const existing = legacyByType.get(r.type) || [];
      existing.push(r);
      legacyByType.set(r.type, existing);
    }
  }

  let recommendationsCreated = 0;
  let recommendationsSuperseded = 0;
  let recommendationsDeduplicated = 0;

  const newFingerprints = new Set(validRecs.map((r) => r.fingerprint));
  const newTypes = new Set(validRecs.map((r) => r.type));

  if (validRecs.length > 0 || activeRecs.length > 0) {
    await db.transaction(async (tx) => {
      const idsToSupersede: string[] = [];

      for (const existing of activeRecs) {
        if (existing.fingerprint && !newFingerprints.has(existing.fingerprint)) {
          idsToSupersede.push(existing.id);
          recommendationsSuperseded++;
        } else if (!existing.fingerprint && newTypes.has(existing.type)) {
          idsToSupersede.push(existing.id);
          recommendationsSuperseded++;
        }
      }

      const newRecIds: string[] = [];

      for (const rec of validRecs) {
        const existing = activeByFingerprint.get(rec.fingerprint);
        if (existing) {
          await tx
            .update(recommendationsTable)
            .set({
              title: rec.title,
              explanation: rec.explanation,
              confidence: rec.confidence,
              urgency: rec.urgency,
              expectedDelayImpactDays: rec.expectedDelayImpactDays ?? null,
              expectedMarginImpactPct: rec.expectedMarginImpactPct ?? null,
              expectedRiskReduction: rec.expectedRiskReduction ?? null,
              externalReasonCodes: rec.externalReasonCodes ?? null,
              signalEvidence: rec.signalEvidence as Record<string, unknown>[] ?? null,
              intelligenceEnriched: rec.intelligenceEnriched ? "true" : "false",
              snapshotId: snapshotId ?? undefined,
              expiresAt: computeExpiresAt(rec.urgency, rec.type),
              sourceData: {
                riskScore: riskScore?.compositeScore ?? null,
                complianceStatus: compliance?.status ?? null,
                insuranceCoverage: insurance?.coverageType ?? null,
                intelligenceComposite: intelligence?.compositeIntelScore ?? null,
                signalCount: intelligence?.signals.length ?? 0,
              },
              updatedAt: new Date(),
            })
            .where(eq(recommendationsTable.id, existing.id));
          recommendationsDeduplicated++;
          newRecIds.push(existing.id);
          continue;
        }

        const recId = generateId();
        newRecIds.push(recId);
        await tx.insert(recommendationsTable).values({
          id: recId,
          companyId,
          shipmentId,
          fingerprint: rec.fingerprint,
          type: rec.type,
          title: rec.title,
          explanation: rec.explanation,
          reasonCodes: rec.reasonCodes,
          externalReasonCodes: rec.externalReasonCodes ?? null,
          signalEvidence: rec.signalEvidence as Record<string, unknown>[] ?? null,
          intelligenceEnriched: rec.intelligenceEnriched ? "true" : "false",
          snapshotId: snapshotId ?? null,
          confidence: rec.confidence,
          urgency: rec.urgency,
          expectedDelayImpactDays: rec.expectedDelayImpactDays ?? null,
          expectedMarginImpactPct: rec.expectedMarginImpactPct ?? null,
          expectedRiskReduction: rec.expectedRiskReduction ?? null,
          recommendedAction: rec.recommendedAction,
          status: "PENDING",
          sourceAgent: rec.sourceAgent,
          expiresAt: computeExpiresAt(rec.urgency, rec.type),
          sourceData: {
            riskScore: riskScore?.compositeScore ?? null,
            complianceStatus: compliance?.status ?? null,
            insuranceCoverage: insurance?.coverageType ?? null,
            intelligenceComposite: intelligence?.compositeIntelScore ?? null,
            signalCount: intelligence?.signals.length ?? 0,
          },
        });
        recommendationsCreated++;
      }

      if (idsToSupersede.length > 0 && newRecIds.length > 0) {
        const supersededById = newRecIds[0];
        for (const oldId of idsToSupersede) {
          await tx
            .update(recommendationsTable)
            .set({ status: "SUPERSEDED", supersededById, updatedAt: new Date() })
            .where(eq(recommendationsTable.id, oldId));
        }
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
          recommendationsSuperseded,
          recommendationsDeduplicated,
          types: validRecs.map((r) => r.type),
          urgencies: validRecs.map((r) => r.urgency),
          intelligenceEnrichedCount: validRecs.filter((r) => r.intelligenceEnriched).length,
          intelligenceSignals: intelligence?.signals.length ?? 0,
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

  const intelligenceSignalsUsed = intelligence?.signals.length ?? 0;

  console.log(
    `[decision-engine] complete: shipment=${shipmentId} created=${recommendationsCreated} superseded=${recommendationsSuperseded} deduped=${recommendationsDeduplicated} edges=${graphEdgesCreated} intelSignals=${intelligenceSignalsUsed}`,
  );

  return {
    recommendationsCreated,
    recommendationsSuperseded,
    recommendationsDeduplicated,
    graphEdgesCreated,
    intelligenceSignalsUsed,
    success: true,
    error: null,
  };
}
