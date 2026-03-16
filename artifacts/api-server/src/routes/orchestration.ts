import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  recommendationsTable,
  policyDecisionsTable,
  workflowTasksTable,
  taskEventsTable,
  operationalNotificationsTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, and, desc, inArray, count, sql, avg, isNotNull } from "drizzle-orm";
import { getCompanyId } from "../middlewares/tenant.js";
import { requireMinRole } from "../middlewares/auth.js";
import {
  evaluatePolicy,
  applyPolicy,
  getPrioritizedQueue,
  runEscalationCheck,
} from "@workspace/svc-workflow-orchestrator";
import type { RecommendationInput } from "@workspace/svc-workflow-orchestrator";

const router: IRouter = Router();

router.post(
  "/orchestration/evaluate",
  requireMinRole("OPERATOR"),
  async (req, res) => {
    const companyId = getCompanyId(req);
    const { recommendationId } = req.body;

    if (!recommendationId) {
      res.status(400).json({ error: "recommendationId is required" });
      return;
    }

    const [rec] = await db
      .select()
      .from(recommendationsTable)
      .where(
        and(
          eq(recommendationsTable.id, recommendationId),
          eq(recommendationsTable.companyId, companyId),
        ),
      )
      .limit(1);

    if (!rec) {
      res.status(404).json({ error: "Recommendation not found" });
      return;
    }

    const input = mapRecToInput(rec, companyId);
    const result = evaluatePolicy(input);

    res.json({ data: result });
  },
);

router.post(
  "/orchestration/apply",
  requireMinRole("OPERATOR"),
  async (req, res) => {
    const companyId = getCompanyId(req);
    const userId = req.user!.userId;
    const { recommendationId } = req.body;

    if (!recommendationId) {
      res.status(400).json({ error: "recommendationId is required" });
      return;
    }

    const [rec] = await db
      .select()
      .from(recommendationsTable)
      .where(
        and(
          eq(recommendationsTable.id, recommendationId),
          eq(recommendationsTable.companyId, companyId),
        ),
      )
      .limit(1);

    if (!rec) {
      res.status(404).json({ error: "Recommendation not found" });
      return;
    }

    const input = mapRecToInput(rec, companyId);
    const result = await applyPolicy(input, userId);

    res.json({ data: result });
  },
);

router.post(
  "/orchestration/apply-batch",
  requireMinRole("MANAGER"),
  async (req, res) => {
    const companyId = getCompanyId(req);
    const userId = req.user!.userId;

    const pendingRecs = await db
      .select()
      .from(recommendationsTable)
      .where(
        and(
          eq(recommendationsTable.companyId, companyId),
          inArray(recommendationsTable.status, ["PENDING", "SHOWN"]),
        ),
      )
      .orderBy(desc(recommendationsTable.createdAt))
      .limit(50);

    const results = [];
    for (const rec of pendingRecs) {
      const input = mapRecToInput(rec, companyId);
      const result = await applyPolicy(input, userId);
      results.push({ recommendationId: rec.id, ...result });
    }

    res.json({
      data: {
        processed: results.length,
        results,
      },
    });
  },
);

router.post(
  "/orchestration/escalation-check",
  requireMinRole("OPERATOR"),
  async (req, res) => {
    const companyId = getCompanyId(req);
    const userId = req.user!.userId;

    const results = await runEscalationCheck(companyId, userId);

    const escalated = results.filter((r) => r.shouldEscalate);
    const overdue = results.filter((r) => r.isOverdue);

    res.json({
      data: {
        checked: results.length,
        escalated: escalated.length,
        overdue: overdue.length,
        details: results,
      },
    });
  },
);

router.get("/orchestration/prioritized-queue", async (req, res) => {
  const companyId = getCompanyId(req);
  const queue = req.query.queue as string | undefined;
  const assignedTo = req.query.assignedTo as string | undefined;
  const unassignedOnly = req.query.unassignedOnly === "true";
  const needsAttentionOnly = req.query.needsAttentionOnly === "true";

  const tasks = await getPrioritizedQueue(companyId, {
    queue,
    assignedTo,
    unassignedOnly,
    needsAttentionOnly,
  });

  res.json({ data: tasks });
});

router.get("/orchestration/policy-decisions", async (req, res) => {
  const companyId = getCompanyId(req);
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const outcome = req.query.outcome as string | undefined;

  const conditions = [eq(policyDecisionsTable.companyId, companyId)];
  if (outcome) {
    conditions.push(eq(policyDecisionsTable.outcome, outcome as any));
  }

  const decisions = await db
    .select()
    .from(policyDecisionsTable)
    .where(and(...conditions))
    .orderBy(desc(policyDecisionsTable.createdAt))
    .limit(limit);

  res.json({ data: decisions });
});

router.get("/analytics/workflow", async (req, res) => {
  const companyId = getCompanyId(req);

  const [taskTotals] = await db
    .select({
      total: count(),
      open: sql<number>`COUNT(*) FILTER (WHERE ${workflowTasksTable.status} = 'OPEN')`,
      inProgress: sql<number>`COUNT(*) FILTER (WHERE ${workflowTasksTable.status} = 'IN_PROGRESS')`,
      blocked: sql<number>`COUNT(*) FILTER (WHERE ${workflowTasksTable.status} = 'BLOCKED')`,
      completed: sql<number>`COUNT(*) FILTER (WHERE ${workflowTasksTable.status} = 'COMPLETED')`,
      cancelled: sql<number>`COUNT(*) FILTER (WHERE ${workflowTasksTable.status} = 'CANCELLED')`,
      overdue: sql<number>`COUNT(*) FILTER (WHERE ${workflowTasksTable.dueAt} < NOW() AND ${workflowTasksTable.status} IN ('OPEN', 'IN_PROGRESS', 'BLOCKED'))`,
      autoCreated: sql<number>`COUNT(*) FILTER (WHERE ${workflowTasksTable.creationSource} = 'AUTO_POLICY')`,
      manualCreated: sql<number>`COUNT(*) FILTER (WHERE ${workflowTasksTable.creationSource} IN ('MANUAL', 'RECOMMENDATION'))`,
      escalated: sql<number>`COUNT(*) FILTER (WHERE ${workflowTasksTable.escalationLevel} > 0)`,
    })
    .from(workflowTasksTable)
    .where(eq(workflowTasksTable.companyId, companyId));

  const byType = await db
    .select({
      taskType: workflowTasksTable.taskType,
      total: count(),
      completed: sql<number>`COUNT(*) FILTER (WHERE ${workflowTasksTable.status} = 'COMPLETED')`,
      active: sql<number>`COUNT(*) FILTER (WHERE ${workflowTasksTable.status} IN ('OPEN', 'IN_PROGRESS', 'BLOCKED'))`,
      autoCreated: sql<number>`COUNT(*) FILTER (WHERE ${workflowTasksTable.creationSource} = 'AUTO_POLICY')`,
      avgCompletionHours: sql<number>`AVG(EXTRACT(EPOCH FROM (${workflowTasksTable.completedAt} - ${workflowTasksTable.createdAt})) / 3600) FILTER (WHERE ${workflowTasksTable.completedAt} IS NOT NULL)`,
    })
    .from(workflowTasksTable)
    .where(eq(workflowTasksTable.companyId, companyId))
    .groupBy(workflowTasksTable.taskType);

  const avgAssignmentHours = await db
    .select({
      avgHours: sql<number>`AVG(EXTRACT(EPOCH FROM (te.created_at - wt.created_at)) / 3600)`,
    })
    .from(sql`${taskEventsTable} te JOIN ${workflowTasksTable} wt ON te.task_id = wt.id`)
    .where(
      and(
        sql`wt.company_id = ${companyId}`,
        sql`te.event_type = 'ASSIGNED'`,
      ),
    );

  const completionRate = taskTotals
    ? taskTotals.total > 0
      ? ((taskTotals.completed / taskTotals.total) * 100).toFixed(1)
      : "0"
    : "0";

  const overdueRate = taskTotals
    ? taskTotals.total > 0
      ? ((taskTotals.overdue / taskTotals.total) * 100).toFixed(1)
      : "0"
    : "0";

  const escalationRate = taskTotals
    ? taskTotals.total > 0
      ? ((taskTotals.escalated / taskTotals.total) * 100).toFixed(1)
      : "0"
    : "0";

  const policyOutcomes = await db
    .select({
      outcome: policyDecisionsTable.outcome,
      count: count(),
    })
    .from(policyDecisionsTable)
    .where(eq(policyDecisionsTable.companyId, companyId))
    .groupBy(policyDecisionsTable.outcome);

  const funnel = {
    totalRecommendations: 0,
    acceptedRecommendations: 0,
    tasksCreated: taskTotals?.total ?? 0,
    tasksCompleted: taskTotals?.completed ?? 0,
  };

  const [recCounts] = await db
    .select({
      total: count(),
      accepted: sql<number>`COUNT(*) FILTER (WHERE ${recommendationsTable.status} IN ('ACCEPTED', 'MODIFIED', 'IMPLEMENTED'))`,
    })
    .from(recommendationsTable)
    .where(eq(recommendationsTable.companyId, companyId));

  if (recCounts) {
    funnel.totalRecommendations = recCounts.total;
    funnel.acceptedRecommendations = recCounts.accepted;
  }

  res.json({
    data: {
      totals: taskTotals,
      byType,
      rates: {
        completionRate: Number(completionRate),
        overdueRate: Number(overdueRate),
        escalationRate: Number(escalationRate),
      },
      avgAssignmentHours: avgAssignmentHours[0]?.avgHours ?? null,
      policyOutcomes,
      funnel,
    },
  });
});

function mapRecToInput(rec: any, companyId: string): RecommendationInput {
  return {
    id: rec.id,
    companyId,
    shipmentId: rec.shipmentId,
    type: rec.type,
    urgency: rec.urgency,
    confidence: Number(rec.confidence),
    title: rec.title,
    explanation: rec.explanation,
    recommendedAction: rec.recommendedAction,
    intelligenceEnriched: rec.intelligenceEnriched ?? false,
    expectedDelayImpactDays: rec.expectedDelayImpactDays ? Number(rec.expectedDelayImpactDays) : null,
    expectedMarginImpactPct: rec.expectedMarginImpactPct ? Number(rec.expectedMarginImpactPct) : null,
    expectedRiskReduction: rec.expectedRiskReduction ? Number(rec.expectedRiskReduction) : null,
    reasonCodes: rec.reasonCodes ?? [],
    externalReasonCodes: rec.externalReasonCodes ?? null,
  };
}

export default router;
