import { db } from "@workspace/db";
import {
  shipmentsTable,
  tradeLaneStatsTable,
  disruptionEventsTable,
  portCongestionSnapshotsTable,
  complianceScreeningsTable,
  historicalPatternsTable,
} from "@workspace/db/schema";
import { eq, and, or, sql, desc, gte, count } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";

export interface PatternComputeResult {
  laneDelays: number;
  portDisruptions: number;
  carrierPerformance: number;
  entityCompliance: number;
}

export async function computeHistoricalPatterns(companyId: string): Promise<PatternComputeResult> {
  const periodEnd = new Date();
  const periodStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [laneDelays, portDisruptions, carrierPerformance, entityCompliance] = await Promise.all([
    computeLaneDelayPatterns(companyId, periodStart, periodEnd),
    computePortDisruptionPatterns(companyId, periodStart, periodEnd),
    computeCarrierPerformancePatterns(companyId, periodStart, periodEnd),
    computeEntityCompliancePatterns(companyId, periodStart, periodEnd),
  ]);

  return { laneDelays, portDisruptions, carrierPerformance, entityCompliance };
}

async function computeLaneDelayPatterns(
  companyId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  const lanes = await db
    .select({
      origin: tradeLaneStatsTable.origin,
      destination: tradeLaneStatsTable.destination,
      avgTransitDays: tradeLaneStatsTable.avgTransitDays,
      delayFrequency: tradeLaneStatsTable.delayFrequency,
      shipmentCount: tradeLaneStatsTable.shipmentCount,
    })
    .from(tradeLaneStatsTable)
    .where(eq(tradeLaneStatsTable.companyId, companyId))
    .limit(100);

  let persisted = 0;

  for (const lane of lanes) {
    const key = `${lane.origin}-${lane.destination}`;
    const avgDelay = (lane.delayFrequency ?? 0) * (lane.avgTransitDays ?? 0);
    const trend = (lane.delayFrequency ?? 0) > 0.3 ? "RISING" : (lane.delayFrequency ?? 0) > 0.1 ? "STABLE" : "FALLING";

    await upsertPattern(companyId, {
      patternType: "LANE_DELAY_AVG",
      subjectKey: key,
      subjectName: `Lane ${lane.origin} → ${lane.destination}`,
      periodStart,
      periodEnd,
      sampleCount: lane.shipmentCount ?? 0,
      avgValue: avgDelay,
      minValue: 0,
      maxValue: (lane.avgTransitDays ?? 0) * 1.5,
      trendDirection: trend,
      trendStrength: lane.delayFrequency ?? 0,
      patternData: {
        avgTransitDays: lane.avgTransitDays,
        delayFrequency: lane.delayFrequency,
      },
    });
    persisted++;
  }

  return persisted;
}

async function computePortDisruptionPatterns(
  companyId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  const disruptions = await db
    .select({
      region: disruptionEventsTable.affectedRegion,
      cnt: count(),
    })
    .from(disruptionEventsTable)
    .where(
      and(
        or(eq(disruptionEventsTable.companyId, companyId), sql`${disruptionEventsTable.companyId} IS NULL`),
        gte(disruptionEventsTable.startDate, periodStart),
      ),
    )
    .groupBy(disruptionEventsTable.affectedRegion)
    .limit(50);

  let persisted = 0;

  for (const d of disruptions) {
    const region = d.region as string ?? "UNKNOWN";
    const freq = Number(d.cnt);
    const trend = freq >= 5 ? "RISING" : freq >= 2 ? "STABLE" : "FALLING";

    await upsertPattern(companyId, {
      patternType: "PORT_DISRUPTION_FREQ",
      subjectKey: region,
      subjectName: `Region: ${region}`,
      periodStart,
      periodEnd,
      sampleCount: freq,
      avgValue: freq / 3,
      trendDirection: trend,
      trendStrength: Math.min(freq / 10, 1),
      patternData: { totalEvents: freq },
    });
    persisted++;
  }

  return persisted;
}

async function computeCarrierPerformancePatterns(
  companyId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  const shipmentsByCarrier = await db
    .select({
      carrierId: shipmentsTable.carrierId,
      total: count(),
    })
    .from(shipmentsTable)
    .where(
      and(
        eq(shipmentsTable.companyId, companyId),
        gte(shipmentsTable.createdAt, periodStart),
      ),
    )
    .groupBy(shipmentsTable.carrierId)
    .limit(50);

  let persisted = 0;

  for (const carrier of shipmentsByCarrier) {
    if (!carrier.carrierId) continue;
    const total = Number(carrier.total);

    const delivered = await db
      .select({ cnt: count() })
      .from(shipmentsTable)
      .where(
        and(
          eq(shipmentsTable.companyId, companyId),
          eq(shipmentsTable.carrierId, carrier.carrierId),
          eq(shipmentsTable.status, "DELIVERED"),
          gte(shipmentsTable.createdAt, periodStart),
        ),
      );

    const deliveredCount = Number(delivered[0]?.cnt ?? 0);
    const completionRate = total > 0 ? deliveredCount / total : 0;
    const trend = completionRate >= 0.8 ? "STABLE" : completionRate >= 0.5 ? "FALLING" : "FALLING";

    await upsertPattern(companyId, {
      patternType: "CARRIER_PERFORMANCE",
      subjectKey: carrier.carrierId,
      subjectName: `Carrier ${carrier.carrierId}`,
      periodStart,
      periodEnd,
      sampleCount: total,
      avgValue: completionRate,
      trendDirection: trend,
      trendStrength: Math.abs(completionRate - 0.8),
      patternData: { totalShipments: total, deliveredCount, completionRate },
    });
    persisted++;
  }

  return persisted;
}

async function computeEntityCompliancePatterns(
  companyId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  const screenings = await db
    .select({
      shipmentId: complianceScreeningsTable.shipmentId,
      overallResult: complianceScreeningsTable.status,
    })
    .from(complianceScreeningsTable)
    .where(
      and(
        eq(complianceScreeningsTable.companyId, companyId),
        gte(complianceScreeningsTable.createdAt, periodStart),
      ),
    )
    .limit(500);

  const byResult: Record<string, number> = {};
  for (const s of screenings) {
    byResult[s.overallResult] = (byResult[s.overallResult] ?? 0) + 1;
  }

  const total = screenings.length;
  const flagged = (byResult["ALERT"] ?? 0) + (byResult["BLOCKED"] ?? 0);
  const incidentRate = total > 0 ? flagged / total : 0;

  if (total > 0) {
    await upsertPattern(companyId, {
      patternType: "ENTITY_COMPLIANCE_INCIDENTS",
      subjectKey: companyId,
      subjectName: "Company-wide compliance",
      periodStart,
      periodEnd,
      sampleCount: total,
      avgValue: incidentRate,
      trendDirection: incidentRate > 0.2 ? "RISING" : "STABLE",
      trendStrength: incidentRate,
      patternData: { byResult, total, flagged },
    });
    return 1;
  }

  return 0;
}

interface PatternInput {
  patternType: string;
  subjectKey: string;
  subjectName?: string;
  periodStart: Date;
  periodEnd: Date;
  sampleCount: number;
  avgValue: number;
  minValue?: number;
  maxValue?: number;
  trendDirection?: string;
  trendStrength?: number;
  patternData?: Record<string, unknown>;
}

async function upsertPattern(companyId: string, input: PatternInput): Promise<void> {
  const existing = await db
    .select({ id: historicalPatternsTable.id })
    .from(historicalPatternsTable)
    .where(
      and(
        eq(historicalPatternsTable.companyId, companyId),
        eq(historicalPatternsTable.patternType, input.patternType as any),
        eq(historicalPatternsTable.subjectKey, input.subjectKey),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(historicalPatternsTable)
      .set({
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        sampleCount: input.sampleCount,
        avgValue: input.avgValue,
        minValue: input.minValue,
        maxValue: input.maxValue,
        trendDirection: input.trendDirection as any,
        trendStrength: input.trendStrength,
        patternData: input.patternData,
        computedAt: new Date(),
      })
      .where(eq(historicalPatternsTable.id, existing[0].id));
  } else {
    await db.insert(historicalPatternsTable).values({
      id: generateId("hpt"),
      companyId,
      patternType: input.patternType as any,
      subjectKey: input.subjectKey,
      subjectName: input.subjectName,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      sampleCount: input.sampleCount,
      avgValue: input.avgValue,
      minValue: input.minValue,
      maxValue: input.maxValue,
      trendDirection: input.trendDirection as any,
      trendStrength: input.trendStrength,
      patternData: input.patternData,
    });
  }
}

export async function getPatterns(companyId: string, patternType?: string) {
  const conditions = [eq(historicalPatternsTable.companyId, companyId)];
  if (patternType) {
    conditions.push(eq(historicalPatternsTable.patternType, patternType as any));
  }
  return db
    .select()
    .from(historicalPatternsTable)
    .where(and(...conditions))
    .orderBy(desc(historicalPatternsTable.computedAt))
    .limit(100);
}
