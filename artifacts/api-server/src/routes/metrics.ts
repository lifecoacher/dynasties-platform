import { Router, type IRouter } from "express";
import { getQueueStats } from "@workspace/queue";

const router: IRouter = Router();

const counters = {
  httpRequestsTotal: new Map<string, number>(),
  httpRequestDurationMs: new Map<string, number[]>(),
  webhookProcessed: 0,
  webhookFailed: 0,
  queueProcessed: 0,
  queueFailed: 0,
  queueRetried: 0,
  invoiceCreated: 0,
  reconciliationVariance: 0,
};

export function recordRequest(method: string, route: string, status: number, durationMs: number): void {
  const key = `${method}|${route}|${status}`;
  counters.httpRequestsTotal.set(key, (counters.httpRequestsTotal.get(key) || 0) + 1);

  const durKey = `${method}|${route}`;
  if (!counters.httpRequestDurationMs.has(durKey)) {
    counters.httpRequestDurationMs.set(durKey, []);
  }
  const durations = counters.httpRequestDurationMs.get(durKey)!;
  durations.push(durationMs);
  if (durations.length > 1000) durations.splice(0, durations.length - 1000);
}

export function recordWebhook(success: boolean): void {
  if (success) counters.webhookProcessed++;
  else counters.webhookFailed++;
}

export function recordQueue(outcome: "processed" | "failed" | "retried"): void {
  if (outcome === "processed") counters.queueProcessed++;
  else if (outcome === "failed") counters.queueFailed++;
  else counters.queueRetried++;
}

export function recordInvoiceCreated(): void {
  counters.invoiceCreated++;
}

export function recordReconciliationVariance(): void {
  counters.reconciliationVariance++;
}

router.get("/metrics", (_req, res) => {
  if (process.env.NODE_ENV === "production" && !process.env.METRICS_ENABLED) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const lines: string[] = [];

  lines.push("# HELP http_requests_total Total HTTP requests");
  lines.push("# TYPE http_requests_total counter");
  for (const [key, count] of counters.httpRequestsTotal) {
    const [method, route, status] = key.split("|");
    lines.push(`http_requests_total{method="${method}",route="${route}",status="${status}"} ${count}`);
  }

  lines.push("# HELP http_request_duration_ms HTTP request duration in ms");
  lines.push("# TYPE http_request_duration_ms summary");
  for (const [key, durations] of counters.httpRequestDurationMs) {
    const [method, route] = key.split("|");
    if (durations.length === 0) continue;
    const sorted = [...durations].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    lines.push(`http_request_duration_ms{method="${method}",route="${route}",quantile="0.5"} ${p50}`);
    lines.push(`http_request_duration_ms{method="${method}",route="${route}",quantile="0.95"} ${p95}`);
    lines.push(`http_request_duration_ms{method="${method}",route="${route}",quantile="0.99"} ${p99}`);
    lines.push(`http_request_duration_ms_count{method="${method}",route="${route}"} ${durations.length}`);
  }

  lines.push("# HELP stripe_webhook_total Stripe webhook events");
  lines.push("# TYPE stripe_webhook_total counter");
  lines.push(`stripe_webhook_total{status="processed"} ${counters.webhookProcessed}`);
  lines.push(`stripe_webhook_total{status="failed"} ${counters.webhookFailed}`);

  lines.push("# HELP queue_jobs_total Queue job outcomes");
  lines.push("# TYPE queue_jobs_total counter");
  lines.push(`queue_jobs_total{status="processed"} ${counters.queueProcessed}`);
  lines.push(`queue_jobs_total{status="failed"} ${counters.queueFailed}`);
  lines.push(`queue_jobs_total{status="retried"} ${counters.queueRetried}`);

  lines.push("# HELP invoices_created_total Invoices created");
  lines.push("# TYPE invoices_created_total counter");
  lines.push(`invoices_created_total ${counters.invoiceCreated}`);

  lines.push("# HELP reconciliation_variance_total Reconciliation variances detected");
  lines.push("# TYPE reconciliation_variance_total counter");
  lines.push(`reconciliation_variance_total ${counters.reconciliationVariance}`);

  const queueStats = getQueueStats();
  lines.push("# HELP queue_backend_info Queue backend type");
  lines.push("# TYPE queue_backend_info gauge");
  lines.push(`queue_backend_info{backend="${queueStats.backend}"} 1`);

  const mem = process.memoryUsage();
  lines.push("# HELP process_memory_rss_bytes Process RSS");
  lines.push("# TYPE process_memory_rss_bytes gauge");
  lines.push(`process_memory_rss_bytes ${mem.rss}`);

  lines.push("# HELP process_heap_used_bytes Heap used");
  lines.push("# TYPE process_heap_used_bytes gauge");
  lines.push(`process_heap_used_bytes ${mem.heapUsed}`);

  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(lines.join("\n") + "\n");
});

export default router;
