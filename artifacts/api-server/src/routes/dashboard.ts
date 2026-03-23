import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  shipmentsTable,
  complianceScreeningsTable,
  riskScoresTable,
  shipmentDecisionsTable,
  recommendationsTable,
  workflowTasksTable,
} from "@workspace/db/schema";
import { eq, sql, count, inArray } from "drizzle-orm";
import { getCompanyId } from "../middlewares/tenant.js";

const router: IRouter = Router();

router.get("/dashboard/stats", async (req, res) => {
  const companyId = getCompanyId(req);

  const [shipmentStats, allShipments, complianceRows, riskRows, decisionRows, recStats, taskStats] =
    await Promise.all([
      db
        .select({
          total: count(),
          active: sql<number>`COUNT(*) FILTER (WHERE ${shipmentsTable.status} NOT IN ('DELIVERED','CLOSED','CANCELLED','REJECTED'))`,
          pendingReview: sql<number>`COUNT(*) FILTER (WHERE ${shipmentsTable.status} = 'PENDING_REVIEW')`,
          inTransit: sql<number>`COUNT(*) FILTER (WHERE ${shipmentsTable.status} = 'IN_TRANSIT')`,
          draft: sql<number>`COUNT(*) FILTER (WHERE ${shipmentsTable.status} = 'DRAFT')`,
          delivered: sql<number>`COUNT(*) FILTER (WHERE ${shipmentsTable.status} = 'DELIVERED')`,
        })
        .from(shipmentsTable)
        .where(eq(shipmentsTable.companyId, companyId)),

      db
        .select({ id: shipmentsTable.id })
        .from(shipmentsTable)
        .where(eq(shipmentsTable.companyId, companyId)),

      db
        .select({
          shipmentId: complianceScreeningsTable.shipmentId,
          status: complianceScreeningsTable.status,
        })
        .from(complianceScreeningsTable)
        .where(eq(complianceScreeningsTable.companyId, companyId)),

      db
        .select({
          shipmentId: riskScoresTable.shipmentId,
          compositeScore: riskScoresTable.compositeScore,
        })
        .from(riskScoresTable)
        .where(eq(riskScoresTable.companyId, companyId)),

      db
        .select({
          shipmentId: shipmentDecisionsTable.shipmentId,
          finalRiskScore: shipmentDecisionsTable.finalRiskScore,
        })
        .from(shipmentDecisionsTable)
        .where(eq(shipmentDecisionsTable.companyId, companyId)),

      db
        .select({
          total: count(),
          pending: sql<number>`COUNT(*) FILTER (WHERE ${recommendationsTable.status} IN ('PENDING','SHOWN'))`,
          critical: sql<number>`COUNT(*) FILTER (WHERE ${recommendationsTable.urgency} = 'CRITICAL' AND ${recommendationsTable.status} IN ('PENDING','SHOWN'))`,
          high: sql<number>`COUNT(*) FILTER (WHERE ${recommendationsTable.urgency} = 'HIGH' AND ${recommendationsTable.status} IN ('PENDING','SHOWN'))`,
        })
        .from(recommendationsTable)
        .where(eq(recommendationsTable.companyId, companyId)),

      db
        .select({
          total: count(),
          open: sql<number>`COUNT(*) FILTER (WHERE ${workflowTasksTable.status} IN ('OPEN','IN_PROGRESS','BLOCKED'))`,
          overdue: sql<number>`COUNT(*) FILTER (WHERE ${workflowTasksTable.status} IN ('OPEN','IN_PROGRESS','BLOCKED') AND ${workflowTasksTable.dueAt} < NOW())`,
        })
        .from(workflowTasksTable)
        .where(eq(workflowTasksTable.companyId, companyId)),
    ]);

  const s = shipmentStats[0]!;
  const rec = recStats[0]!;
  const t = taskStats[0]!;

  const complianceMap = new Map(complianceRows.map((c) => [c.shipmentId, c.status]));
  let compClear = 0, compFlagged = 0, compUnscreened = 0;
  for (const shipment of allShipments) {
    const status = complianceMap.get(shipment.id);
    if (status === "CLEAR") compClear++;
    else if (status != null) compFlagged++;
    else compUnscreened++;
  }

  const riskMap = new Map(riskRows.map((r) => [r.shipmentId, Number(r.compositeScore)]));
  const decisionMap = new Map(decisionRows.map((d) => [d.shipmentId, d.finalRiskScore]));

  let riskHigh = 0, riskMedium = 0, riskLow = 0;
  for (const shipment of allShipments) {
    const decisionScore = decisionMap.has(shipment.id) && decisionMap.get(shipment.id) != null
      ? Number(decisionMap.get(shipment.id))
      : null;
    const compositeScore = riskMap.get(shipment.id) ?? null;
    const score = decisionScore ?? compositeScore;
    if (score == null) continue;
    if (score >= 60) riskHigh++;
    else if (score >= 30) riskMedium++;
    else riskLow++;
  }

  res.json({
    data: {
      shipments: {
        total: Number(s.total),
        active: Number(s.active),
        pendingReview: Number(s.pendingReview),
        inTransit: Number(s.inTransit),
        draft: Number(s.draft),
        delivered: Number(s.delivered),
      },
      compliance: {
        total: allShipments.length,
        clear: compClear,
        flagged: compFlagged,
        unscreened: compUnscreened,
      },
      risk: {
        total: riskHigh + riskMedium + riskLow,
        high: riskHigh,
        medium: riskMedium,
        low: riskLow,
      },
      recommendations: {
        total: Number(rec.total),
        pending: Number(rec.pending),
        critical: Number(rec.critical),
        high: Number(rec.high),
      },
      tasks: {
        total: Number(t.total),
        open: Number(t.open),
        overdue: Number(t.overdue),
      },
    },
  });
});

export default router;
