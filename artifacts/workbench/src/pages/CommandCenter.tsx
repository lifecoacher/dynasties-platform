import { useListShipments } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Clock,
  XCircle,
  Shield,
  Zap,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CommandInput } from "@/components/command/CommandInput";
import { useAuth } from "@/hooks/use-auth";
import { useAlertsSummary } from "@/hooks/use-exceptions";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { normalizeRiskScore, riskColor, formatCurrency } from "@/lib/format";

function deriveSystemStatus(stats: any, alertsSummary: any) {
  const criticalAlerts = alertsSummary?.criticalAlerts?.length ?? 0;
  const needsAttention = alertsSummary?.needsAttention ?? 0;
  const highRisk = stats?.risk?.high ?? 0;
  const flagged = stats?.compliance?.flagged ?? 0;

  if (criticalAlerts > 0) {
    const alert = alertsSummary.criticalAlerts[0];
    return {
      level: "critical" as const,
      headline: alert.title || "Critical Issue Detected",
      detail: `${criticalAlerts} critical alert${criticalAlerts > 1 ? "s" : ""} require immediate action.`,
      action: "Resolve Now",
      actionHref: "/exceptions",
    };
  }

  if (flagged > 0) {
    return {
      level: "warning" as const,
      headline: `${flagged} Compliance Flag${flagged > 1 ? "s" : ""} Active`,
      detail: "Review before these shipments can proceed.",
      action: "Review Flags",
      actionHref: "/shipments",
    };
  }

  if (highRisk > 0) {
    return {
      level: "warning" as const,
      headline: `${highRisk} High-Risk Shipment${highRisk > 1 ? "s" : ""}`,
      detail: "Elevated risk detected. Review before approving.",
      action: "Review Risk",
      actionHref: "/shipments",
    };
  }

  if (needsAttention > 0) {
    return {
      level: "attention" as const,
      headline: `${needsAttention} Item${needsAttention > 1 ? "s" : ""} Need Attention`,
      detail: "Non-critical exceptions to review when ready.",
      action: "View",
      actionHref: "/exceptions",
    };
  }

  return {
    level: "clear" as const,
    headline: "All Clear",
    detail: "No issues detected. All shipments are on track.",
    action: null,
    actionHref: null,
  };
}

function statusStyles(level: string) {
  switch (level) {
    case "critical":
      return { text: "text-red-400", bg: "bg-red-500/[0.06]", border: "border-red-500/10", btn: "bg-red-500/15 text-red-400 hover:bg-red-500/25", icon: XCircle };
    case "warning":
    case "attention":
      return { text: "text-[#D4A24C]", bg: "bg-[#D4A24C]/[0.04]", border: "border-[#D4A24C]/10", btn: "bg-[#D4A24C]/15 text-[#D4A24C] hover:bg-[#D4A24C]/25", icon: AlertTriangle };
    default:
      return { text: "text-primary", bg: "bg-primary/[0.04]", border: "border-primary/10", btn: "", icon: CheckCircle2 };
  }
}

export default function CommandCenter() {
  const { user } = useAuth();
  const { data: shipmentsRes, isLoading } = useListShipments();
  const { data: alertsRes } = useAlertsSummary();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const shipments = (shipmentsRes?.data || []) as any[];
  const alertsSummary = alertsRes?.data;

  const activeShipments = stats?.shipments.active ?? 0;
  const totalShipments = stats?.shipments.total ?? 0;
  const complianceClear = stats?.compliance.clear ?? 0;
  const highRisk = stats?.risk.high ?? 0;

  const status = deriveSystemStatus(stats, alertsSummary);
  const style = statusStyles(status.level);
  const ready = !statsLoading && !isLoading;
  const Icon = style.icon;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-6 py-10">

        {!ready && (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {ready && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className={`rounded-2xl ${style.bg} border ${style.border} px-8 py-8 mb-8`}
            >
              <div className="flex items-center gap-2 mb-4">
                <Icon className={`w-4 h-4 ${style.text}`} />
                <span className={`text-[11px] font-semibold uppercase tracking-[0.15em] ${style.text}`}>
                  {status.level === "clear" ? "System Status" : "Action Required"}
                </span>
              </div>

              <h1 className={`text-[32px] font-bold ${style.text} font-heading leading-none tracking-tight mb-3`}>
                {status.headline}
              </h1>

              <p className="text-[15px] text-muted-foreground leading-relaxed max-w-lg mb-6">
                {status.detail}
              </p>

              {status.action && status.actionHref && (
                <Link href={status.actionHref}>
                  <button className={`px-6 py-2.5 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.97] ${style.btn}`}>
                    {status.action}
                  </button>
                </Link>
              )}

              {status.level !== "clear" && alertsSummary?.criticalAlerts?.length > 0 && (
                <div className="mt-6 pt-5 border-t border-white/5 space-y-1.5">
                  {alertsSummary.criticalAlerts.slice(0, 3).map((alert: any) => (
                    <Link key={alert.id} href={alert.shipmentId ? `/shipments/${alert.shipmentId}` : "/exceptions"}>
                      <div className="flex items-center gap-3 py-2 px-3 -mx-3 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer group">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          alert.severity === "CRITICAL" ? "bg-red-400" : "bg-orange-400"
                        }`} />
                        <span className="text-[13px] text-foreground/80 flex-1">{alert.title}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="flex items-center gap-8 mb-10 text-[13px]"
            >
              <div>
                <span className="text-muted-foreground/70">Active</span>
                <span className="ml-2 text-[18px] font-bold text-foreground tabular-nums">{activeShipments}</span>
                <span className="ml-1 text-muted-foreground/40">/ {totalShipments}</span>
              </div>
              <div className="w-px h-5 bg-border/50" />
              <div>
                <span className="text-muted-foreground/70">Compliant</span>
                <span className="ml-2 text-[18px] font-bold text-primary tabular-nums">{complianceClear}</span>
              </div>
              {highRisk > 0 && (
                <>
                  <div className="w-px h-5 bg-border/50" />
                  <div>
                    <span className="text-muted-foreground/70">High Risk</span>
                    <span className="ml-2 text-[18px] font-bold text-[#D4A24C] tabular-nums">{highRisk}</span>
                  </div>
                </>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="mb-10"
            >
              <CommandInput />
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.25 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[15px] font-semibold text-foreground font-heading">Recent Shipments</h2>
                <Link href="/shipments" className="text-[12px] text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors">
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {shipments.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-px">
                  {shipments.slice(0, 8).map((s: any, i: number) => {
                    const score = normalizeRiskScore(s.risk?.compositeScore);
                    const needsCare = s.status === "PENDING_REVIEW" || s.compliance?.status === "FLAGGED" || (score != null && score >= 60);

                    return (
                      <motion.div
                        key={s.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.25 + i * 0.03 }}
                      >
                        <Link href={`/shipments/${s.id}`}>
                          <div className={`flex items-center gap-4 px-4 py-3.5 -mx-4 rounded-lg hover:bg-white/[0.03] transition-all cursor-pointer group ${needsCare ? "" : "opacity-60 hover:opacity-100"}`}>
                            <StatusIndicator status={s.status} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2.5">
                                <span className="text-[13px] font-semibold text-foreground font-mono">{s.reference}</span>
                                <span className="text-[11px] text-muted-foreground/70">
                                  {s.status.replace(/_/g, " ")}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-[12px] text-muted-foreground">
                                <span className="truncate max-w-[160px]">{s.shipper?.name || "Pending"}</span>
                                <span className="text-primary/40">→</span>
                                <span className="truncate max-w-[160px]">{s.consignee?.name || "Pending"}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3.5 shrink-0">
                              {s.compliance?.status === "CLEAR" ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-primary/60" />
                              ) : s.compliance?.status ? (
                                <AlertTriangle className="w-3.5 h-3.5 text-[#D4A24C]" />
                              ) : (
                                <Clock className="w-3.5 h-3.5 text-muted-foreground/40" />
                              )}

                              {score != null && (
                                <span className={`text-[12px] font-semibold tabular-nums ${riskColor(score)}`}>
                                  {score}
                                </span>
                              )}

                              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                            </div>
                          </div>
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function StatusIndicator({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DRAFT: "bg-muted-foreground/40",
    PENDING_REVIEW: "bg-[#D4A24C]",
    APPROVED: "bg-primary",
    REJECTED: "bg-[#E05252]",
    IN_TRANSIT: "bg-primary",
    AT_PORT: "bg-[#D4A24C]",
    CUSTOMS: "bg-[#D4A24C]",
    BOOKED: "bg-primary/60",
    DELIVERED: "bg-muted-foreground/40",
    CLOSED: "bg-muted-foreground/40",
  };
  return <span className={`w-2 h-2 rounded-full shrink-0 ${colors[status] || "bg-muted-foreground/40"}`} />;
}

function EmptyState() {
  return (
    <div className="text-center py-16">
      <p className="text-[15px] text-muted-foreground mb-1">No shipments yet</p>
      <p className="text-[13px] text-muted-foreground/60 mb-5">Import your data or create your first shipment to get started.</p>
      <Link href="/shipments" className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors">
        Get Started
      </Link>
    </div>
  );
}
