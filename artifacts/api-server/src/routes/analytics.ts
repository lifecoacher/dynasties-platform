import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  recommendationsTable,
  recommendationOutcomesTable,
  laneScoresTable,
  portScoresTable,
  carrierScoresTable,
  entityScoresTable,
  shipmentIntelligenceSnapshotsTable,
} from "@workspace/db/schema";
import { eq, and, or, sql, count, desc, inArray } from "drizzle-orm";

const router = Router();

router.get("/analytics/recommendations", async (req: Request, res: Response) => {
  const companyId = (req as any).companyId as string;

  const byType = await db
    .select({
      type: recommendationsTable.type,
      total: count(),
      pending: sql<number>`COUNT(*) FILTER (WHERE ${recommendationsTable.status} = 'PENDING')`,
      shown: sql<number>`COUNT(*) FILTER (WHERE ${recommendationsTable.status} = 'SHOWN')`,
      accepted: sql<number>`COUNT(*) FILTER (WHERE ${recommendationsTable.status} = 'ACCEPTED')`,
      modified: sql<number>`COUNT(*) FILTER (WHERE ${recommendationsTable.status} = 'MODIFIED')`,
      rejected: sql<number>`COUNT(*) FILTER (WHERE ${recommendationsTable.status} = 'REJECTED')`,
      implemented: sql<number>`COUNT(*) FILTER (WHERE ${recommendationsTable.status} = 'IMPLEMENTED')`,
      expired: sql<number>`COUNT(*) FILTER (WHERE ${recommendationsTable.status} = 'EXPIRED')`,
      superseded: sql<number>`COUNT(*) FILTER (WHERE ${recommendationsTable.status} = 'SUPERSEDED')`,
      intelEnriched: sql<number>`COUNT(*) FILTER (WHERE ${recommendationsTable.intelligenceEnriched} = 'true')`,
    })
    .from(recommendationsTable)
    .where(eq(recommendationsTable.companyId, companyId))
    .groupBy(recommendationsTable.type);

  const byUrgency = await db
    .select({
      urgency: recommendationsTable.urgency,
      total: count(),
    })
    .from(recommendationsTable)
    .where(eq(recommendationsTable.companyId, companyId))
    .groupBy(recommendationsTable.urgency);

  const outcomes = await db
    .select({
      total: count(),
      withDelay: sql<number>`COUNT(*) FILTER (WHERE ${recommendationOutcomesTable.actualDelayDays} IS NOT NULL)`,
      withCost: sql<number>`COUNT(*) FILTER (WHERE ${recommendationOutcomesTable.actualCostDelta} IS NOT NULL)`,
      withMargin: sql<number>`COUNT(*) FILTER (WHERE ${recommendationOutcomesTable.actualMarginDelta} IS NOT NULL)`,
    })
    .from(recommendationOutcomesTable)
    .where(eq(recommendationOutcomesTable.companyId, companyId));

  const typeStats = byType.map((row) => {
    const responded = Number(row.accepted) + Number(row.modified) + Number(row.rejected) + Number(row.implemented);
    const actionable = responded + Number(row.pending) + Number(row.shown);
    const acceptanceRate = actionable > 0 ? ((Number(row.accepted) + Number(row.modified) + Number(row.implemented)) / actionable * 100) : 0;
    const implementationRate = responded > 0 ? (Number(row.implemented) / responded * 100) : 0;

    return {
      type: row.type,
      total: Number(row.total),
      pending: Number(row.pending),
      shown: Number(row.shown),
      accepted: Number(row.accepted),
      modified: Number(row.modified),
      rejected: Number(row.rejected),
      implemented: Number(row.implemented),
      expired: Number(row.expired),
      superseded: Number(row.superseded),
      intelEnriched: Number(row.intelEnriched),
      acceptanceRate: Math.round(acceptanceRate * 10) / 10,
      implementationRate: Math.round(implementationRate * 10) / 10,
    };
  });

  const totals = typeStats.reduce(
    (acc, ts) => ({
      total: acc.total + ts.total,
      pending: acc.pending + ts.pending,
      accepted: acc.accepted + ts.accepted,
      modified: acc.modified + ts.modified,
      rejected: acc.rejected + ts.rejected,
      implemented: acc.implemented + ts.implemented,
      expired: acc.expired + ts.expired,
      intelEnriched: acc.intelEnriched + ts.intelEnriched,
    }),
    { total: 0, pending: 0, accepted: 0, modified: 0, rejected: 0, implemented: 0, expired: 0, intelEnriched: 0 },
  );

  const overallAcceptance = totals.total > 0
    ? Math.round(((totals.accepted + totals.modified + totals.implemented) / totals.total) * 1000) / 10
    : 0;

  res.json({
    data: {
      byType: typeStats,
      byUrgency: byUrgency.map((r) => ({ urgency: r.urgency, total: Number(r.total) })),
      totals: {
        ...totals,
        overallAcceptanceRate: overallAcceptance,
        intelEnrichmentRate: totals.total > 0 ? Math.round((totals.intelEnriched / totals.total) * 1000) / 10 : 0,
      },
      outcomes: outcomes[0]
        ? {
            total: Number(outcomes[0].total),
            withDelay: Number(outcomes[0].withDelay),
            withCost: Number(outcomes[0].withCost),
            withMargin: Number(outcomes[0].withMargin),
          }
        : null,
    },
  });
});

router.get("/analytics/scores", async (req: Request, res: Response) => {
  const companyId = (req as any).companyId as string;

  const lanes = await db
    .select()
    .from(laneScoresTable)
    .where(eq(laneScoresTable.companyId, companyId))
    .orderBy(desc(laneScoresTable.compositeStressScore))
    .limit(20);

  const ports = await db
    .select()
    .from(portScoresTable)
    .where(eq(portScoresTable.companyId, companyId))
    .orderBy(desc(portScoresTable.compositeScore))
    .limit(20);

  const carriers = await db
    .select()
    .from(carrierScoresTable)
    .where(eq(carrierScoresTable.companyId, companyId))
    .orderBy(desc(carrierScoresTable.compositeScore))
    .limit(20);

  const entities = await db
    .select()
    .from(entityScoresTable)
    .where(eq(entityScoresTable.companyId, companyId))
    .orderBy(desc(entityScoresTable.compositeScore))
    .limit(20);

  res.json({ data: { lanes, ports, carriers, entities } });
});

router.get("/analytics/snapshots/:shipmentId", async (req: Request, res: Response) => {
  const companyId = (req as any).companyId as string;
  const { shipmentId } = req.params;

  const snapshots = await db
    .select()
    .from(shipmentIntelligenceSnapshotsTable)
    .where(
      and(
        eq(shipmentIntelligenceSnapshotsTable.companyId, companyId),
        eq(shipmentIntelligenceSnapshotsTable.shipmentId, shipmentId),
      ),
    )
    .orderBy(desc(shipmentIntelligenceSnapshotsTable.generatedAt))
    .limit(20);

  res.json({ data: { snapshots } });
});

router.get("/analytics/diagnostics", async (req: Request, res: Response) => {
  const companyId = (req as any).companyId as string;

  const byTypeAndAction = await db
    .select({
      type: recommendationsTable.type,
      status: recommendationsTable.status,
      intelligenceEnriched: recommendationsTable.intelligenceEnriched,
      cnt: count(),
    })
    .from(recommendationsTable)
    .where(eq(recommendationsTable.companyId, companyId))
    .groupBy(
      recommendationsTable.type,
      recommendationsTable.status,
      recommendationsTable.intelligenceEnriched,
    );

  const typeActionMap: Record<string, {
    total: number;
    accepted: number;
    modified: number;
    rejected: number;
    implemented: number;
    expired: number;
    pending: number;
    intelEnrichedTotal: number;
    intelEnrichedAccepted: number;
    internalOnlyTotal: number;
    internalOnlyAccepted: number;
  }> = {};

  for (const row of byTypeAndAction) {
    if (!typeActionMap[row.type]) {
      typeActionMap[row.type] = {
        total: 0, accepted: 0, modified: 0, rejected: 0,
        implemented: 0, expired: 0, pending: 0,
        intelEnrichedTotal: 0, intelEnrichedAccepted: 0,
        internalOnlyTotal: 0, internalOnlyAccepted: 0,
      };
    }
    const entry = typeActionMap[row.type]!;
    const c = Number(row.cnt);
    entry.total += c;

    if (row.status === "ACCEPTED") entry.accepted += c;
    if (row.status === "MODIFIED") entry.modified += c;
    if (row.status === "REJECTED") entry.rejected += c;
    if (row.status === "IMPLEMENTED") entry.implemented += c;
    if (row.status === "EXPIRED") entry.expired += c;
    if (row.status === "PENDING" || row.status === "SHOWN") entry.pending += c;

    const isEnriched = row.intelligenceEnriched === "true";
    if (isEnriched) {
      entry.intelEnrichedTotal += c;
      if (["ACCEPTED", "MODIFIED", "IMPLEMENTED"].includes(row.status)) {
        entry.intelEnrichedAccepted += c;
      }
    } else {
      entry.internalOnlyTotal += c;
      if (["ACCEPTED", "MODIFIED", "IMPLEMENTED"].includes(row.status)) {
        entry.internalOnlyAccepted += c;
      }
    }
  }

  const diagnosticsByType = Object.entries(typeActionMap).map(([type, data]) => ({
    type,
    ...data,
    acceptanceRate: data.total > 0 ? Math.round(((data.accepted + data.modified + data.implemented) / data.total) * 1000) / 10 : 0,
    rejectionRate: data.total > 0 ? Math.round((data.rejected / data.total) * 1000) / 10 : 0,
    implementationRate: (data.accepted + data.modified) > 0 ? Math.round((data.implemented / (data.accepted + data.modified)) * 1000) / 10 : 0,
    intelEnrichedAcceptanceRate: data.intelEnrichedTotal > 0
      ? Math.round((data.intelEnrichedAccepted / data.intelEnrichedTotal) * 1000) / 10 : 0,
    internalOnlyAcceptanceRate: data.internalOnlyTotal > 0
      ? Math.round((data.internalOnlyAccepted / data.internalOnlyTotal) * 1000) / 10 : 0,
  }));

  const outcomesByType = await db
    .select({
      type: recommendationsTable.type,
      evaluation: recommendationOutcomesTable.outcomeEvaluation,
      cnt: count(),
    })
    .from(recommendationOutcomesTable)
    .innerJoin(
      recommendationsTable,
      eq(recommendationOutcomesTable.recommendationId, recommendationsTable.id),
    )
    .where(eq(recommendationOutcomesTable.companyId, companyId))
    .groupBy(recommendationsTable.type, recommendationOutcomesTable.outcomeEvaluation);

  const outcomeQuality: Record<string, { positive: number; neutral: number; negative: number; pending: number }> = {};
  for (const row of outcomesByType) {
    if (!outcomeQuality[row.type]) {
      outcomeQuality[row.type] = { positive: 0, neutral: 0, negative: 0, pending: 0 };
    }
    const c = Number(row.cnt);
    if (row.evaluation === "POSITIVE") outcomeQuality[row.type]!.positive += c;
    else if (row.evaluation === "NEUTRAL") outcomeQuality[row.type]!.neutral += c;
    else if (row.evaluation === "NEGATIVE") outcomeQuality[row.type]!.negative += c;
    else outcomeQuality[row.type]!.pending += c;
  }

  const byUrgencyBand = await db
    .select({
      urgency: recommendationsTable.urgency,
      status: recommendationsTable.status,
      cnt: count(),
    })
    .from(recommendationsTable)
    .where(eq(recommendationsTable.companyId, companyId))
    .groupBy(recommendationsTable.urgency, recommendationsTable.status);

  const urgencyBands: Record<string, { total: number; accepted: number; rejected: number }> = {};
  for (const row of byUrgencyBand) {
    if (!urgencyBands[row.urgency]) {
      urgencyBands[row.urgency] = { total: 0, accepted: 0, rejected: 0 };
    }
    const c = Number(row.cnt);
    urgencyBands[row.urgency]!.total += c;
    if (["ACCEPTED", "MODIFIED", "IMPLEMENTED"].includes(row.status)) {
      urgencyBands[row.urgency]!.accepted += c;
    }
    if (row.status === "REJECTED") {
      urgencyBands[row.urgency]!.rejected += c;
    }
  }

  const falsePositiveLanes = await db
    .select({
      shipmentId: recommendationsTable.shipmentId,
      type: recommendationsTable.type,
      cnt: count(),
    })
    .from(recommendationsTable)
    .innerJoin(
      recommendationOutcomesTable,
      eq(recommendationsTable.id, recommendationOutcomesTable.recommendationId),
    )
    .where(
      and(
        eq(recommendationsTable.companyId, companyId),
        eq(recommendationOutcomesTable.outcomeEvaluation, "NEGATIVE"),
      ),
    )
    .groupBy(recommendationsTable.shipmentId, recommendationsTable.type)
    .orderBy(desc(count()))
    .limit(10);

  res.json({
    data: {
      diagnosticsByType,
      outcomeQuality,
      urgencyBands: Object.entries(urgencyBands).map(([urgency, data]) => ({ urgency, ...data })),
      topFalsePositives: falsePositiveLanes.map((r) => ({
        shipmentId: r.shipmentId,
        type: r.type,
        count: Number(r.cnt),
      })),
    },
  });
});

export default router;
