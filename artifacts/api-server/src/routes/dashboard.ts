import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  shipmentsTable,
  complianceScreeningsTable,
  riskScoresTable,
  recommendationsTable,
  workflowTasksTable,
} from "@workspace/db/schema";
import { eq, and, sql, count, inArray } from "drizzle-orm";
import { getCompanyId } from "../middlewares/tenant.js";

const router: IRouter = Router();

router.get("/dashboard/stats", async (req, res) => {
  const companyId = getCompanyId(req);

  const TERMINAL = ["DELIVERED", "CLOSED", "CANCELLED", "REJECTED"];

  const [shipmentStats, complianceStats, riskStats, recStats, taskStats] =
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
        .select({
          total: count(),
          clear: sql<number>`COUNT(*) FILTER (WHERE ${complianceScreeningsTable.status} = 'CLEAR')`,
          flagged: sql<number>`COUNT(*) FILTER (WHERE ${complianceScreeningsTable.status} != 'CLEAR')`,
        })
        .from(complianceScreeningsTable)
        .where(eq(complianceScreeningsTable.companyId, companyId)),

      db
        .select({
          total: count(),
          highRisk: sql<number>`COUNT(*) FILTER (WHERE CAST(${riskScoresTable.compositeScore} AS numeric) >= 60)`,
          mediumRisk: sql<number>`COUNT(*) FILTER (WHERE CAST(${riskScoresTable.compositeScore} AS numeric) >= 30 AND CAST(${riskScoresTable.compositeScore} AS numeric) < 60)`,
          lowRisk: sql<number>`COUNT(*) FILTER (WHERE CAST(${riskScoresTable.compositeScore} AS numeric) < 30)`,
        })
        .from(riskScoresTable)
        .where(eq(riskScoresTable.companyId, companyId)),

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
  const c = complianceStats[0]!;
  const r = riskStats[0]!;
  const rec = recStats[0]!;
  const t = taskStats[0]!;

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
        total: Number(c.total),
        clear: Number(c.clear),
        flagged: Number(c.flagged),
      },
      risk: {
        total: Number(r.total),
        high: Number(r.highRisk),
        medium: Number(r.mediumRisk),
        low: Number(r.lowRisk),
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
