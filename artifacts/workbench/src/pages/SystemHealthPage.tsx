import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@workspace/api-client-react";
import { Activity, Database, HardDrive, Cloud, Webhook, BookOpen, AlertOctagon, Cpu, Loader2, RefreshCw, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { formatRelativeTime } from "@/lib/format-time";

const BASE = import.meta.env.VITE_API_URL || "/api";

async function fetchHealth() {
  const token = getAuthToken();
  const res = await fetch(`${BASE}/admin/system-health`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to load system health");
  return json.data as {
    timestamp: string;
    checks: Record<string, any>;
  };
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return ok ? (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[11px] font-medium">
      <CheckCircle2 className="w-3 h-3" /> {label}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#E05252]/10 text-[#E05252] text-[11px] font-medium">
      <XCircle className="w-3 h-3" /> {label}
    </span>
  );
}

function Card({ icon: Icon, title, subtitle, children }: { icon: any; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-card-border bg-card p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-[12px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-border/30 last:border-0">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="text-[12px] text-foreground font-mono text-right">{value ?? "—"}</span>
    </div>
  );
}

export default function SystemHealthPage() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["system-health"],
    queryFn: fetchHealth,
    refetchInterval: 30000,
    enabled: user?.role === "ADMIN",
  });

  if (user?.role !== "ADMIN") {
    return (
      <AppLayout hideRightPanel>
        <div className="max-w-3xl mx-auto px-6 py-12 text-center">
          <AlertTriangle className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-[14px] text-foreground">Admin access required</p>
          <p className="text-[12px] text-muted-foreground/60 mt-1">This page is restricted to administrators.</p>
        </div>
      </AppLayout>
    );
  }

  const checks = data?.checks ?? {};
  const db = checks.database;
  const queue = checks.queue;
  const storage = checks.storage;
  const stripeWebhooks = checks.stripeWebhooks;
  const accounting = checks.accounting;
  const dlq = checks.deadLetterQueue;
  const proc = checks.process;

  return (
    <AppLayout hideRightPanel>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-[22px] font-bold text-foreground tracking-tight font-heading">System Health</h1>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground rounded-lg border border-border/40 hover:bg-muted/40 transition-colors disabled:opacity-50"
          >
            {isFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Refresh
          </button>
        </div>
        <p className="text-[12px] text-muted-foreground/60 mb-6">
          Read-only operational view of backing services. {data?.timestamp && `Updated ${formatRelativeTime(data.timestamp)}.`}
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/30" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-[#E05252]/20 bg-[#E05252]/5 p-4 text-[12px] text-[#E05252]">
            Failed to load system health: {(error as Error).message}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card icon={Database} title="Database" subtitle="Primary PostgreSQL">
              <div className="mb-3"><StatusBadge ok={db?.status === "ok"} label={db?.status === "ok" ? "Healthy" : "Error"} /></div>
              <Field label="Latency" value={db?.latencyMs != null ? `${db.latencyMs} ms` : "—"} />
              {db?.error && <Field label="Error" value={db.error} />}
            </Card>

            <Card icon={Activity} title="Queue" subtitle="Background job transport">
              <div className="mb-3">
                <StatusBadge ok={queue?.backend === "sqs" || Object.values(queue?.listeners ?? {}).every((v: any) => v >= 1)} label={queue?.backend === "sqs" ? "SQS" : "EventEmitter (in-process)"} />
              </div>
              <Field label="Backend" value={queue?.backend} />
              {queue?.listeners && (
                <Field
                  label="Active consumers"
                  value={`${Object.values(queue.listeners).filter((v: any) => v >= 1).length} / ${Object.keys(queue.listeners).length}`}
                />
              )}
            </Card>

            <Card icon={HardDrive} title="Storage" subtitle="Document object store">
              <div className="mb-3">
                <StatusBadge ok={storage?.backend === "s3"} label={storage?.backend === "s3" ? "S3" : "Local filesystem"} />
              </div>
              <Field label="Backend" value={storage?.backend} />
              <Field label="Bucket" value={storage?.bucket ?? "—"} />
              <Field label="Region" value={storage?.region ?? "—"} />
            </Card>

            <Card icon={Webhook} title="Stripe Webhooks" subtitle="Last received event">
              <Field
                label="Last event"
                value={
                  stripeWebhooks?.lastReceivedAt ? (
                    <span title={new Date(stripeWebhooks.lastReceivedAt).toLocaleString()}>
                      {stripeWebhooks.lastEventType} · {formatRelativeTime(stripeWebhooks.lastReceivedAt)}
                    </span>
                  ) : "Never received"
                }
              />
              <Field label="Last status" value={stripeWebhooks?.lastStatus ?? "—"} />
              <Field label="Total received" value={stripeWebhooks?.totalReceived ?? 0} />
              <Field label="Total failed" value={stripeWebhooks?.totalFailed ?? 0} />
            </Card>

            <Card icon={BookOpen} title="Accounting Sync" subtitle="QuickBooks connection">
              <Field label="Provider" value={accounting?.provider ?? "—"} />
              <Field label="Status" value={accounting?.status ?? "—"} />
              <Field
                label="Last sync"
                value={
                  accounting?.lastSyncAt ? (
                    <span title={new Date(accounting.lastSyncAt).toLocaleString()}>
                      {formatRelativeTime(accounting.lastSyncAt)}
                    </span>
                  ) : "Not yet synced"
                }
              />
              <Field label="Last status" value={accounting?.lastSyncStatus ?? "—"} />
              {accounting?.lastSyncError && <Field label="Last error" value={accounting.lastSyncError} />}
            </Card>

            <Card icon={AlertOctagon} title="Dead Letter Queue" subtitle="Failed jobs awaiting attention">
              <div className="mb-3">
                <StatusBadge ok={(dlq?.failed ?? 0) === 0} label={(dlq?.failed ?? 0) === 0 ? "Clean" : `${dlq.failed} failed`} />
              </div>
              <Field label="Failed (open)" value={dlq?.failed ?? 0} />
              <Field label="Total ever" value={dlq?.total ?? 0} />
              {dlq?.byQueue && Object.keys(dlq.byQueue).length > 0 && (
                <div className="mt-2 pt-2 border-t border-border/30">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1">By queue</p>
                  {Object.entries(dlq.byQueue).map(([q, n]) => (
                    <Field key={q} label={q} value={n as number} />
                  ))}
                </div>
              )}
            </Card>

            <Card icon={Cpu} title="Process" subtitle="API server runtime">
              <Field label="Environment" value={proc?.nodeEnv} />
              <Field label="Uptime" value={proc?.uptimeSeconds != null ? `${Math.floor(proc.uptimeSeconds / 60)} min` : "—"} />
              <Field label="Memory (RSS)" value={proc?.memoryMb?.rss != null ? `${proc.memoryMb.rss} MB` : "—"} />
              <Field label="Heap used" value={proc?.memoryMb?.heapUsed != null ? `${proc.memoryMb.heapUsed} MB` : "—"} />
            </Card>

            <Card icon={Cloud} title="Liveness" subtitle="Quick reference">
              <Field label="Health endpoint" value={<a className="text-primary hover:underline" href={`${BASE}/healthz`} target="_blank" rel="noreferrer">/api/healthz</a>} />
              <Field label="Readiness" value={<a className="text-primary hover:underline" href={`${BASE}/healthz/ready`} target="_blank" rel="noreferrer">/api/healthz/ready</a>} />
              <Field label="Metrics" value={<a className="text-primary hover:underline" href={`${BASE}/metrics`} target="_blank" rel="noreferrer">/api/metrics</a>} />
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
