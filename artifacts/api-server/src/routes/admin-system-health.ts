import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql, desc, eq } from "drizzle-orm";
import {
  stripeWebhookEventsTable,
  accountingConnectionsTable,
  deadLetterJobsTable,
} from "@workspace/db/schema";
import { getQueueStats } from "@workspace/queue";
import { requireAuth, refreshRole, requireMinRole } from "../middlewares/auth.js";
import { isDemoCompany } from "../lib/demo-companies.js";

const router: IRouter = Router();

router.get(
  "/admin/system-health",
  requireAuth,
  refreshRole,
  requireMinRole("ADMIN"),
  async (req, res) => {
  const companyId = req.user!.companyId;

  // Cross-tenant operational metrics (Stripe webhooks, DLQ totals) are not
  // company-scoped at the schema level. Until a platform-admin role exists,
  // restrict the endpoint to designated demo tenants to prevent leakage of
  // global operational counts into real-tenant dashboards.
  if (!isDemoCompany(companyId)) {
    res.status(403).json({ error: "System health is restricted to platform demo tenants" });
    return;
  }
  const checks: Record<string, unknown> = {};

  // Database
  const dbStart = Date.now();
  let dbStatus: "ok" | "error" = "ok";
  let dbError: string | null = null;
  try {
    await db.execute(sql`SELECT 1`);
  } catch (err) {
    dbStatus = "error";
    dbError = err instanceof Error ? err.message : "unknown";
  }
  checks.database = {
    status: dbStatus,
    latencyMs: Date.now() - dbStart,
    error: dbError,
  };

  // Queue backend
  const queueStats = getQueueStats();
  checks.queue = {
    backend: queueStats.backend,
    listeners: Object.fromEntries(
      Object.entries(queueStats).filter(([k]) => k.endsWith("Listeners")),
    ),
  };

  // Storage backend
  const storageBackend = process.env.STORAGE_BACKEND === "local" || !process.env.S3_BUCKET_RAW_DOCUMENTS
    ? "local"
    : "s3";
  checks.storage = {
    backend: storageBackend,
    bucket: process.env.S3_BUCKET_RAW_DOCUMENTS || null,
    region: process.env.AWS_REGION || null,
  };

  // Stripe webhook freshness
  const [lastWebhook] = await db
    .select({
      eventType: stripeWebhookEventsTable.eventType,
      receivedAt: stripeWebhookEventsTable.receivedAt,
      status: stripeWebhookEventsTable.status,
    })
    .from(stripeWebhookEventsTable)
    .orderBy(desc(stripeWebhookEventsTable.receivedAt))
    .limit(1);

  const [webhookCounts] = await db
    .select({
      total: sql<number>`count(*)`,
      failed: sql<number>`count(*) filter (where ${stripeWebhookEventsTable.status} = 'FAILED')`,
    })
    .from(stripeWebhookEventsTable);

  checks.stripeWebhooks = {
    lastEventType: lastWebhook?.eventType ?? null,
    lastReceivedAt: lastWebhook?.receivedAt ?? null,
    lastStatus: lastWebhook?.status ?? null,
    totalReceived: Number(webhookCounts?.total ?? 0),
    totalFailed: Number(webhookCounts?.failed ?? 0),
  };

  // Accounting (QuickBooks) sync freshness
  const [qbConnection] = await db
    .select({
      provider: accountingConnectionsTable.provider,
      status: accountingConnectionsTable.connectionStatus,
      lastSyncAt: accountingConnectionsTable.lastSyncAt,
      lastSyncStatus: accountingConnectionsTable.lastSyncStatus,
      lastSyncError: accountingConnectionsTable.lastSyncError,
    })
    .from(accountingConnectionsTable)
    .where(eq(accountingConnectionsTable.companyId, companyId))
    .limit(1);

  checks.accounting = qbConnection
    ? {
        provider: qbConnection.provider,
        status: qbConnection.status,
        lastSyncAt: qbConnection.lastSyncAt,
        lastSyncStatus: qbConnection.lastSyncStatus,
        lastSyncError: qbConnection.lastSyncError,
      }
    : { provider: null, status: "NOT_CONFIGURED", lastSyncAt: null };

  // Dead letter queue depth
  const [dlqCounts] = await db
    .select({
      failed: sql<number>`count(*) filter (where ${deadLetterJobsTable.status} = 'FAILED')`,
      total: sql<number>`count(*)`,
    })
    .from(deadLetterJobsTable);

  const dlqByQueueRows = await db
    .select({
      queueName: deadLetterJobsTable.queueName,
      count: sql<number>`count(*)`,
    })
    .from(deadLetterJobsTable)
    .where(eq(deadLetterJobsTable.status, "FAILED"))
    .groupBy(deadLetterJobsTable.queueName);

  checks.deadLetterQueue = {
    failed: Number(dlqCounts?.failed ?? 0),
    total: Number(dlqCounts?.total ?? 0),
    byQueue: dlqByQueueRows.reduce<Record<string, number>>((acc, r) => {
      acc[r.queueName] = Number(r.count);
      return acc;
    }, {}),
  };

  // Process info
  const mem = process.memoryUsage();
  checks.process = {
    uptimeSeconds: Math.floor(process.uptime()),
    nodeEnv: process.env.NODE_ENV || "development",
    memoryMb: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    },
  };

  res.json({
    data: {
      timestamp: new Date().toISOString(),
      checks,
    },
  });
  },
);

export default router;
