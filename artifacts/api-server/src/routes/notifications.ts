import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  operationalNotificationsTable,
  exceptionsTable,
  workflowTasksTable,
  documentValidationResultsTable,
  complianceScreeningsTable,
} from "@workspace/db/schema";
import { eq, and, desc, count, sql, inArray, lt, isNull } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import { getCompanyId } from "../middlewares/tenant.js";
import { requireMinRole } from "../middlewares/auth.js";
import { z } from "zod";
import { validateBody } from "../middlewares/validate.js";

const router: IRouter = Router();

router.get("/notifications", async (req, res) => {
  const companyId = getCompanyId(req);
  const userId = req.user!.userId;
  const unreadOnly = req.query.unreadOnly === "true";
  const limit = Math.min(Number(req.query.limit) || 50, 100);

  const conditions = [
    eq(operationalNotificationsTable.companyId, companyId),
    sql`(${operationalNotificationsTable.userId} = ${userId} OR ${operationalNotificationsTable.userId} IS NULL)`,
  ];

  if (unreadOnly) {
    conditions.push(eq(operationalNotificationsTable.read, false));
  }

  const notifications = await db
    .select()
    .from(operationalNotificationsTable)
    .where(and(...conditions))
    .orderBy(desc(operationalNotificationsTable.createdAt))
    .limit(limit);

  const [unreadCount] = await db
    .select({ count: count() })
    .from(operationalNotificationsTable)
    .where(
      and(
        eq(operationalNotificationsTable.companyId, companyId),
        sql`(${operationalNotificationsTable.userId} = ${userId} OR ${operationalNotificationsTable.userId} IS NULL)`,
        eq(operationalNotificationsTable.read, false),
      ),
    );

  res.json({
    data: notifications,
    unreadCount: unreadCount?.count ?? 0,
  });
});

router.patch(
  "/notifications/:id/read",
  async (req, res) => {
    const companyId = getCompanyId(req);
    const notificationId = req.params.id;

    const userId = req.user!.userId;

    const [notification] = await db
      .select()
      .from(operationalNotificationsTable)
      .where(
        and(
          eq(operationalNotificationsTable.id, notificationId),
          eq(operationalNotificationsTable.companyId, companyId),
          sql`(${operationalNotificationsTable.userId} = ${userId} OR ${operationalNotificationsTable.userId} IS NULL)`,
        ),
      )
      .limit(1);

    if (!notification) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    await db
      .update(operationalNotificationsTable)
      .set({ read: true })
      .where(eq(operationalNotificationsTable.id, notificationId));

    res.json({ data: { ...notification, read: true } });
  },
);

router.patch("/notifications/read-all", async (req, res) => {
  const companyId = getCompanyId(req);
  const userId = req.user!.userId;

  await db
    .update(operationalNotificationsTable)
    .set({ read: true })
    .where(
      and(
        eq(operationalNotificationsTable.companyId, companyId),
        sql`(${operationalNotificationsTable.userId} = ${userId} OR ${operationalNotificationsTable.userId} IS NULL)`,
        eq(operationalNotificationsTable.read, false),
      ),
    );

  res.json({ data: { success: true } });
});

router.post("/notifications/generate", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  const created: Array<{ id: string; eventType: string; title: string }> = [];

  const recentNotifications = await db
    .select({
      relatedShipmentId: operationalNotificationsTable.relatedShipmentId,
      eventType: operationalNotificationsTable.eventType,
      metadata: operationalNotificationsTable.metadata,
    })
    .from(operationalNotificationsTable)
    .where(
      and(
        eq(operationalNotificationsTable.companyId, companyId),
        sql`${operationalNotificationsTable.createdAt} > NOW() - INTERVAL '1 hour'`,
      ),
    );
  const recentKeys = new Set(recentNotifications.map(n => {
    const meta = n.metadata as Record<string, any> | null;
    const sourceId = meta?.exceptionId || meta?.taskId || n.relatedShipmentId;
    return `${n.eventType}:${sourceId}`;
  }));

  const activeExceptions = await db
    .select()
    .from(exceptionsTable)
    .where(
      and(
        eq(exceptionsTable.companyId, companyId),
        inArray(exceptionsTable.status, ["OPEN", "IN_PROGRESS", "ESCALATED"]),
        inArray(exceptionsTable.severity, ["CRITICAL", "HIGH"]),
      ),
    )
    .orderBy(desc(exceptionsTable.createdAt))
    .limit(50);

  for (const exc of activeExceptions) {
    const eventType = exc.severity === "CRITICAL" ? "EXCEPTION_CRITICAL" : "EXCEPTION_HIGH";
    const key = `${eventType}:${exc.id}`;
    if (recentKeys.has(key)) continue;

    const id = generateId("notif");
    await db.insert(operationalNotificationsTable).values({
      id,
      companyId,
      userId: null,
      eventType: eventType as any,
      title: exc.title,
      message: exc.description,
      severity: exc.severity === "CRITICAL" ? "CRITICAL" : "WARNING",
      relatedShipmentId: exc.shipmentId,
      metadata: { exceptionId: exc.id, exceptionType: exc.exceptionType },
    });
    created.push({ id, eventType, title: exc.title });
    recentKeys.add(key);
  }

  const overdueTasks = await db
    .select()
    .from(workflowTasksTable)
    .where(
      and(
        eq(workflowTasksTable.companyId, companyId),
        inArray(workflowTasksTable.status, ["OPEN", "IN_PROGRESS", "BLOCKED"]),
        lt(workflowTasksTable.dueAt, new Date()),
      ),
    )
    .limit(20);

  for (const task of overdueTasks) {
    const key = `SLA_BREACH:${task.id}`;
    if (recentKeys.has(key)) continue;

    const id = generateId("notif");
    await db.insert(operationalNotificationsTable).values({
      id,
      companyId,
      userId: task.assignedTo,
      eventType: "SLA_BREACH" as any,
      title: `Overdue: ${task.title}`,
      message: `Task was due ${task.dueAt ? task.dueAt.toISOString() : "unknown"} and remains ${task.status}`,
      severity: task.priority === "CRITICAL" ? "CRITICAL" : "WARNING",
      relatedTaskId: task.id,
      relatedShipmentId: task.shipmentId,
      metadata: { taskId: task.id, taskType: task.taskType },
    });
    created.push({ id, eventType: "SLA_BREACH", title: `Overdue: ${task.title}` });
    recentKeys.add(key);
  }

  const blockedDocs = await db
    .select()
    .from(documentValidationResultsTable)
    .where(
      and(
        eq(documentValidationResultsTable.companyId, companyId),
        eq(documentValidationResultsTable.status, "BLOCKED"),
      ),
    )
    .limit(20);

  for (const doc of blockedDocs) {
    const key = `DOCUMENT_BLOCKED:${doc.shipmentId}`;
    if (recentKeys.has(key)) continue;

    const id = generateId("notif");
    await db.insert(operationalNotificationsTable).values({
      id,
      companyId,
      userId: null,
      eventType: "DOCUMENT_BLOCKED" as any,
      title: "Document validation blocked",
      message: `Shipment has blocked document validation — resolve before proceeding`,
      severity: "WARNING",
      relatedShipmentId: doc.shipmentId,
      metadata: { validationId: doc.id },
    });
    created.push({ id, eventType: "DOCUMENT_BLOCKED", title: "Document validation blocked" });
    recentKeys.add(key);
  }

  const blockedCompliance = await db
    .select()
    .from(complianceScreeningsTable)
    .where(
      and(
        eq(complianceScreeningsTable.companyId, companyId),
        eq(complianceScreeningsTable.status, "BLOCKED"),
      ),
    )
    .limit(20);

  for (const screen of blockedCompliance) {
    const key = `COMPLIANCE_BLOCK:${screen.shipmentId}`;
    if (recentKeys.has(key)) continue;

    const id = generateId("notif");
    await db.insert(operationalNotificationsTable).values({
      id,
      companyId,
      userId: null,
      eventType: "COMPLIANCE_BLOCK" as any,
      title: "Compliance screening blocked",
      message: `Shipment compliance screening returned BLOCKED status — cannot proceed until resolved`,
      severity: "CRITICAL",
      relatedShipmentId: screen.shipmentId,
      metadata: { screeningId: screen.id },
    });
    created.push({ id, eventType: "COMPLIANCE_BLOCK", title: "Compliance screening blocked" });
    recentKeys.add(key);
  }

  res.json({ data: { generated: created.length, notifications: created } });
});

export default router;
