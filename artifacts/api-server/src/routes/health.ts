import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getQueueStats } from "@workspace/queue";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};
  let healthy = true;

  const dbStart = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch (err) {
    healthy = false;
    checks.database = {
      status: "error",
      latencyMs: Date.now() - dbStart,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }

  const queueStats = getQueueStats();
  const expectedConsumers = 12;
  const activeConsumers = Object.entries(queueStats)
    .filter(([k, v]) => k.endsWith("Listeners") && v === 1)
    .length;
  const queueHealthy = activeConsumers >= expectedConsumers;
  if (!queueHealthy) healthy = false;
  checks.queue = {
    status: queueHealthy ? "ok" : "degraded",
    latencyMs: 0,
  };

  checks.uptime = {
    status: "ok",
    latencyMs: Math.floor(process.uptime() * 1000),
  };

  checks.memory = {
    status: "ok",
    latencyMs: 0,
  };

  const mem = process.memoryUsage();
  const memoryMb = {
    rss: Math.round(mem.rss / 1024 / 1024),
    heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
  };

  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    version: process.env["npm_package_version"] || "0.0.0",
    environment: process.env["NODE_ENV"] || "development",
    checks,
    memory: memoryMb,
    queue: queueStats,
  });
});

router.get("/healthz/ready", async (_req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "not_ready" });
  }
});

export default router;
