import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { operationalNotificationsTable } from "@workspace/db/schema";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { getCompanyId } from "../middlewares/tenant.js";
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

export default router;
