import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  workflowTasksTable,
  taskEventsTable,
  recommendationsTable,
  usersTable,
  shipmentsTable,
} from "@workspace/db/schema";
import { eq, and, desc, inArray, or, lt, sql, count } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import { getCompanyId } from "../middlewares/tenant.js";
import { requireMinRole } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { z } from "zod";

const router: IRouter = Router();

const RECOMMENDATION_TO_TASK_TYPE: Record<string, string> = {
  COMPLIANCE_ESCALATION: "COMPLIANCE_CASE",
  PRICING_ALERT: "PRICING_REVIEW",
  CARRIER_SWITCH: "CARRIER_REVIEW",
  ROUTE_ADJUSTMENT: "ROUTE_REVIEW",
  INSURANCE_ADJUSTMENT: "INSURANCE_REVIEW",
  DOCUMENT_CORRECTION: "DOCUMENT_CORRECTION_TASK",
  RISK_MITIGATION: "RISK_MITIGATION_TASK",
  DELAY_WARNING: "DELAY_RESPONSE_TASK",
  MARGIN_WARNING: "PRICING_REVIEW",
};

function getDefaultPriority(urgency: string): string {
  const map: Record<string, string> = {
    CRITICAL: "CRITICAL",
    HIGH: "HIGH",
    MEDIUM: "MEDIUM",
    LOW: "LOW",
  };
  return map[urgency] || "MEDIUM";
}

function getDefaultDueHours(urgency: string): number {
  const map: Record<string, number> = {
    CRITICAL: 4,
    HIGH: 24,
    MEDIUM: 72,
    LOW: 168,
  };
  return map[urgency] || 72;
}

const createFromRecommendationSchema = z.object({
  assignedTo: z.string().optional(),
  dueAt: z.string().datetime().optional(),
  executionNotes: z.string().optional(),
});

router.post(
  "/recommendations/:id/create-task",
  requireMinRole("OPERATOR"),
  validateBody(createFromRecommendationSchema),
  async (req, res) => {
    const companyId = getCompanyId(req);
    const recId = req.params.id;
    const userId = req.user!.userId;
    const { assignedTo, dueAt, executionNotes } = req.body;

    const [rec] = await db
      .select()
      .from(recommendationsTable)
      .where(
        and(
          eq(recommendationsTable.id, recId),
          eq(recommendationsTable.companyId, companyId),
        ),
      )
      .limit(1);

    if (!rec) {
      res.status(404).json({ error: "Recommendation not found" });
      return;
    }

    if (!["ACCEPTED", "MODIFIED"].includes(rec.status)) {
      res.status(400).json({ error: `Cannot create task from recommendation with status ${rec.status}. Only ACCEPTED or MODIFIED recommendations can be converted to tasks.` });
      return;
    }

    const existingTasks = await db
      .select({ id: workflowTasksTable.id })
      .from(workflowTasksTable)
      .where(
        and(
          eq(workflowTasksTable.companyId, companyId),
          eq(workflowTasksTable.recommendationId, recId),
          inArray(workflowTasksTable.status, ["OPEN", "IN_PROGRESS", "BLOCKED"]),
        ),
      )
      .limit(1);

    if (existingTasks.length > 0) {
      res.status(409).json({ error: "An active task already exists for this recommendation", taskId: existingTasks[0]!.id });
      return;
    }

    const taskType = RECOMMENDATION_TO_TASK_TYPE[rec.type] || "RISK_MITIGATION_TASK";
    const priority = getDefaultPriority(rec.urgency);
    const defaultDueAt = new Date(Date.now() + getDefaultDueHours(rec.urgency) * 60 * 60 * 1000);

    if (assignedTo) {
      const [assignee] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(and(eq(usersTable.id, assignedTo), eq(usersTable.companyId, companyId)))
        .limit(1);
      if (!assignee) {
        res.status(400).json({ error: "Assigned user not found in this company" });
        return;
      }
    }

    const taskId = generateId("tsk");
    const eventId = generateId("tev");

    await db.transaction(async (tx) => {
      await tx.insert(workflowTasksTable).values({
        id: taskId,
        companyId,
        shipmentId: rec.shipmentId,
        recommendationId: recId,
        snapshotId: rec.snapshotId,
        taskType: taskType as any,
        title: rec.title,
        description: rec.explanation,
        status: "OPEN",
        priority: priority as any,
        assignedTo: assignedTo || null,
        createdBy: userId,
        dueAt: dueAt ? new Date(dueAt) : defaultDueAt,
        executionNotes: executionNotes || rec.recommendedAction,
        metadata: {
          recommendationType: rec.type,
          urgency: rec.urgency,
          confidence: Number(rec.confidence),
          reasonCodes: rec.reasonCodes,
          externalReasonCodes: rec.externalReasonCodes,
          intelligenceEnriched: rec.intelligenceEnriched,
        },
      });

      await tx.insert(taskEventsTable).values({
        id: eventId,
        companyId,
        taskId,
        eventType: "CREATED",
        actorId: userId,
        afterValue: "OPEN",
        notes: `Created from ${rec.type} recommendation: ${rec.title}`,
        metadata: { recommendationId: recId, shipmentId: rec.shipmentId },
      });

      
    });

    const [task] = await db
      .select()
      .from(workflowTasksTable)
      .where(eq(workflowTasksTable.id, taskId))
      .limit(1);

    res.status(201).json({ data: task });
  },
);

const createTaskSchema = z.object({
  shipmentId: z.string().optional(),
  taskType: z.enum([
    "COMPLIANCE_CASE",
    "PRICING_REVIEW",
    "CARRIER_REVIEW",
    "ROUTE_REVIEW",
    "INSURANCE_REVIEW",
    "DOCUMENT_CORRECTION_TASK",
    "DISRUPTION_RESPONSE_TASK",
    "RISK_MITIGATION_TASK",
    "DELAY_RESPONSE_TASK",
  ]),
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  assignedTo: z.string().optional(),
  dueAt: z.string().datetime().optional(),
  executionNotes: z.string().optional(),
});

router.post(
  "/tasks",
  requireMinRole("OPERATOR"),
  validateBody(createTaskSchema),
  async (req, res) => {
    const companyId = getCompanyId(req);
    const userId = req.user!.userId;
    const { shipmentId, taskType, title, description, priority, assignedTo, dueAt, executionNotes } = req.body;

    if (assignedTo) {
      const [assignee] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(and(eq(usersTable.id, assignedTo), eq(usersTable.companyId, companyId)))
        .limit(1);
      if (!assignee) {
        res.status(400).json({ error: "Assigned user not found in this company" });
        return;
      }
    }

    if (shipmentId) {
      const [shipment] = await db
        .select({ id: shipmentsTable.id })
        .from(shipmentsTable)
        .where(and(eq(shipmentsTable.id, shipmentId), eq(shipmentsTable.companyId, companyId)))
        .limit(1);
      if (!shipment) {
        res.status(400).json({ error: "Shipment not found in this company" });
        return;
      }
    }

    const taskId = generateId("tsk");
    const eventId = generateId("tev");

    await db.transaction(async (tx) => {
      await tx.insert(workflowTasksTable).values({
        id: taskId,
        companyId,
        shipmentId: shipmentId || null,
        taskType,
        title,
        description: description || null,
        status: "OPEN",
        priority,
        assignedTo: assignedTo || null,
        createdBy: userId,
        dueAt: dueAt ? new Date(dueAt) : null,
        executionNotes: executionNotes || null,
      });

      await tx.insert(taskEventsTable).values({
        id: eventId,
        companyId,
        taskId,
        eventType: "CREATED",
        actorId: userId,
        afterValue: "OPEN",
        notes: `Manually created: ${title}`,
      });
    });

    const [task] = await db
      .select()
      .from(workflowTasksTable)
      .where(eq(workflowTasksTable.id, taskId))
      .limit(1);

    res.status(201).json({ data: task });
  },
);

router.get("/tasks", async (req, res) => {
  const companyId = getCompanyId(req);
  const status = req.query.status as string | undefined;
  const taskType = req.query.taskType as string | undefined;
  const assignedTo = req.query.assignedTo as string | undefined;
  const queue = req.query.queue as string | undefined;
  const overdue = req.query.overdue as string | undefined;

  let query = db
    .select()
    .from(workflowTasksTable)
    .where(eq(workflowTasksTable.companyId, companyId))
    .orderBy(desc(workflowTasksTable.createdAt))
    .limit(100)
    .$dynamic();

  const conditions = [eq(workflowTasksTable.companyId, companyId)];

  if (status) {
    conditions.push(eq(workflowTasksTable.status, status as any));
  }
  if (taskType) {
    conditions.push(eq(workflowTasksTable.taskType, taskType as any));
  }
  if (assignedTo) {
    if (assignedTo === "unassigned") {
      conditions.push(sql`${workflowTasksTable.assignedTo} IS NULL`);
    } else {
      conditions.push(eq(workflowTasksTable.assignedTo, assignedTo));
    }
  }
  if (overdue === "true") {
    conditions.push(lt(workflowTasksTable.dueAt, new Date()));
    conditions.push(
      inArray(workflowTasksTable.status, ["OPEN", "IN_PROGRESS", "BLOCKED"]),
    );
  }

  if (queue) {
    const queueTypeMap: Record<string, string[]> = {
      compliance: ["COMPLIANCE_CASE"],
      pricing: ["PRICING_REVIEW"],
      carrier: ["CARRIER_REVIEW", "ROUTE_REVIEW"],
      insurance: ["INSURANCE_REVIEW"],
      documents: ["DOCUMENT_CORRECTION_TASK"],
      disruption: ["DISRUPTION_RESPONSE_TASK", "DELAY_RESPONSE_TASK", "RISK_MITIGATION_TASK"],
    };
    const types = queueTypeMap[queue];
    if (types) {
      conditions.push(inArray(workflowTasksTable.taskType, types as any[]));
    }
  }

  const tasks = await db
    .select()
    .from(workflowTasksTable)
    .where(and(...conditions))
    .orderBy(desc(workflowTasksTable.createdAt))
    .limit(100);

  res.json({ data: tasks });
});

router.get("/tasks/summary", async (req, res) => {
  const companyId = getCompanyId(req);
  const userId = req.user!.userId;

  const [totals] = await db
    .select({
      total: count(),
      open: sql<number>`COUNT(*) FILTER (WHERE ${workflowTasksTable.status} = 'OPEN')`,
      inProgress: sql<number>`COUNT(*) FILTER (WHERE ${workflowTasksTable.status} = 'IN_PROGRESS')`,
      blocked: sql<number>`COUNT(*) FILTER (WHERE ${workflowTasksTable.status} = 'BLOCKED')`,
      completed: sql<number>`COUNT(*) FILTER (WHERE ${workflowTasksTable.status} = 'COMPLETED')`,
      cancelled: sql<number>`COUNT(*) FILTER (WHERE ${workflowTasksTable.status} = 'CANCELLED')`,
      overdue: sql<number>`COUNT(*) FILTER (WHERE ${workflowTasksTable.dueAt} < NOW() AND ${workflowTasksTable.status} IN ('OPEN', 'IN_PROGRESS', 'BLOCKED'))`,
      myTasks: sql<number>`COUNT(*) FILTER (WHERE ${workflowTasksTable.assignedTo} = ${userId} AND ${workflowTasksTable.status} IN ('OPEN', 'IN_PROGRESS', 'BLOCKED'))`,
    })
    .from(workflowTasksTable)
    .where(eq(workflowTasksTable.companyId, companyId));

  const byType = await db
    .select({
      taskType: workflowTasksTable.taskType,
      total: count(),
      open: sql<number>`COUNT(*) FILTER (WHERE ${workflowTasksTable.status} IN ('OPEN', 'IN_PROGRESS', 'BLOCKED'))`,
    })
    .from(workflowTasksTable)
    .where(eq(workflowTasksTable.companyId, companyId))
    .groupBy(workflowTasksTable.taskType);

  const byPriority = await db
    .select({
      priority: workflowTasksTable.priority,
      total: count(),
    })
    .from(workflowTasksTable)
    .where(
      and(
        eq(workflowTasksTable.companyId, companyId),
        inArray(workflowTasksTable.status, ["OPEN", "IN_PROGRESS", "BLOCKED"]),
      ),
    )
    .groupBy(workflowTasksTable.priority);

  res.json({
    data: {
      totals: totals || { total: 0, open: 0, inProgress: 0, blocked: 0, completed: 0, cancelled: 0, overdue: 0, myTasks: 0 },
      byType,
      byPriority,
    },
  });
});

router.get("/tasks/:id", async (req, res) => {
  const companyId = getCompanyId(req);
  const taskId = req.params.id;

  const [task] = await db
    .select()
    .from(workflowTasksTable)
    .where(
      and(
        eq(workflowTasksTable.id, taskId),
        eq(workflowTasksTable.companyId, companyId),
      ),
    )
    .limit(1);

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const events = await db
    .select()
    .from(taskEventsTable)
    .where(eq(taskEventsTable.taskId, taskId))
    .orderBy(desc(taskEventsTable.createdAt));

  res.json({ data: { ...task, events } });
});

const updateTaskSchema = z.object({
  status: z
    .enum(["OPEN", "IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELLED"])
    .optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  assignedTo: z.string().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  executionNotes: z.string().optional(),
  completionNotes: z.string().optional(),
  notes: z.string().optional(),
});

router.patch(
  "/tasks/:id",
  requireMinRole("OPERATOR"),
  validateBody(updateTaskSchema),
  async (req, res) => {
    const companyId = getCompanyId(req);
    const taskId = req.params.id;
    const userId = req.user!.userId;
    const body = req.body;

    const [task] = await db
      .select()
      .from(workflowTasksTable)
      .where(
        and(
          eq(workflowTasksTable.id, taskId),
          eq(workflowTasksTable.companyId, companyId),
        ),
      )
      .limit(1);

    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    const updates: Record<string, any> = {};
    const events: Array<{
      eventType: string;
      beforeValue: string | null;
      afterValue: string | null;
      notes: string | null;
    }> = [];

    if (body.status !== undefined && body.status !== task.status) {
      const terminalStatuses = ["COMPLETED", "CANCELLED"];
      if (terminalStatuses.includes(task.status)) {
        if (body.status !== "OPEN") {
          res.status(400).json({ error: `Cannot change status from ${task.status} to ${body.status}. Only reopening is allowed.` });
          return;
        }
        events.push({
          eventType: "REOPENED",
          beforeValue: task.status,
          afterValue: body.status,
          notes: body.notes || null,
        });
      } else if (body.status === "COMPLETED") {
        updates.completedAt = new Date();
        updates.completionNotes = body.completionNotes || null;
        events.push({
          eventType: "COMPLETED",
          beforeValue: task.status,
          afterValue: "COMPLETED",
          notes: body.completionNotes || body.notes || null,
        });
      } else if (body.status === "CANCELLED") {
        events.push({
          eventType: "CANCELLED",
          beforeValue: task.status,
          afterValue: "CANCELLED",
          notes: body.notes || null,
        });
      } else {
        events.push({
          eventType: "STATUS_CHANGED",
          beforeValue: task.status,
          afterValue: body.status,
          notes: body.notes || null,
        });
      }
      updates.status = body.status;
    }

    if (body.priority !== undefined && body.priority !== task.priority) {
      events.push({
        eventType: "PRIORITY_CHANGED",
        beforeValue: task.priority,
        afterValue: body.priority,
        notes: body.notes || null,
      });
      updates.priority = body.priority;
    }

    if (body.assignedTo !== undefined && body.assignedTo !== task.assignedTo) {
      if (body.assignedTo !== null) {
        const [assignee] = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(and(eq(usersTable.id, body.assignedTo), eq(usersTable.companyId, companyId)))
          .limit(1);
        if (!assignee) {
          res.status(400).json({ error: "Assigned user not found in this company" });
          return;
        }
      }
      events.push({
        eventType: "ASSIGNED",
        beforeValue: task.assignedTo,
        afterValue: body.assignedTo,
        notes: body.notes || null,
      });
      updates.assignedTo = body.assignedTo;
    }

    if (body.dueAt !== undefined) {
      const newDue = body.dueAt ? new Date(body.dueAt) : null;
      events.push({
        eventType: "DUE_DATE_CHANGED",
        beforeValue: task.dueAt?.toISOString() || null,
        afterValue: body.dueAt,
        notes: body.notes || null,
      });
      updates.dueAt = newDue;
    }

    if (body.executionNotes !== undefined) {
      updates.executionNotes = body.executionNotes;
    }

    if (body.completionNotes !== undefined) {
      updates.completionNotes = body.completionNotes;
    }

    if (body.notes && events.length === 0) {
      events.push({
        eventType: "NOTE_ADDED",
        beforeValue: null,
        afterValue: null,
        notes: body.notes,
      });
    }

    if (Object.keys(updates).length === 0 && events.length === 0) {
      res.json({ data: task });
      return;
    }

    await db.transaction(async (tx) => {
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date();
        await tx
          .update(workflowTasksTable)
          .set(updates)
          .where(eq(workflowTasksTable.id, taskId));
      }

      for (const evt of events) {
        await tx.insert(taskEventsTable).values({
          id: generateId("tev"),
          companyId,
          taskId,
          eventType: evt.eventType as any,
          actorId: userId,
          beforeValue: evt.beforeValue,
          afterValue: evt.afterValue,
          notes: evt.notes,
        });
      }

      if (body.status === "COMPLETED" && task.recommendationId) {
        await tx
          .update(recommendationsTable)
          .set({ status: "IMPLEMENTED", updatedAt: new Date() })
          .where(eq(recommendationsTable.id, task.recommendationId));
      }
    });

    const [updated] = await db
      .select()
      .from(workflowTasksTable)
      .where(eq(workflowTasksTable.id, taskId))
      .limit(1);

    const updatedEvents = await db
      .select()
      .from(taskEventsTable)
      .where(eq(taskEventsTable.taskId, taskId))
      .orderBy(desc(taskEventsTable.createdAt));

    res.json({ data: { ...updated, events: updatedEvents } });
  },
);

router.get("/shipments/:id/tasks", async (req, res) => {
  const companyId = getCompanyId(req);
  const shipmentId = req.params.id;

  const tasks = await db
    .select()
    .from(workflowTasksTable)
    .where(
      and(
        eq(workflowTasksTable.companyId, companyId),
        eq(workflowTasksTable.shipmentId, shipmentId),
      ),
    )
    .orderBy(desc(workflowTasksTable.createdAt));

  res.json({ data: tasks });
});

export default router;
