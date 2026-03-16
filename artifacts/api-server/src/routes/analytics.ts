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
import { eq, and, sql, count, desc } from "drizzle-orm";

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

export default router;
