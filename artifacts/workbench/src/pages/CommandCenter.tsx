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
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CommandInput } from "@/components/command/CommandInput";
import { useAuth } from "@/hooks/use-auth";
import { useAlertsSummary } from "@/hooks/use-exceptions";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { normalizeRiskScore, riskColor } from "@/lib/format";

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
      recommendation: "Resolve the highest-severity alert first.",
      action: "Resolve Now",
      actionHref: "/exceptions",
    };
  }

  if (flagged > 0) {
    return {
      level: "warning" as const,
      headline: `${flagged} Compliance Flag${flagged > 1 ? "s" : ""} Active`,
      detail: "Review before these shipments can proceed.",
      recommendation: "Clear compliance flags to unblock operations.",
      action: "Review Flags",
      actionHref: "/shipments",
    };
  }

  if (highRisk > 0) {
    return {
      level: "warning" as const,
      headline: `${highRisk} High-Risk Shipment${highRisk > 1 ? "s" : ""}`,
      detail: "Elevated risk detected. Review before approving.",
      recommendation: "Assess risk factors before proceeding.",
      action: "Review Risk",
      actionHref: "/shipments",
    };
  }

  if (needsAttention > 0) {
    return {
      level: "attention" as const,
      headline: `${needsAttention} Item${needsAttention > 1 ? "s" : ""} Need Attention`,
      detail: "Non-critical exceptions to review when ready.",
      recommendation: null,
      action: "View",
      actionHref: "/exceptions",
    };
  }

  return {
    level: "clear" as const,
    headline: "All Clear",
    detail: "No issues detected. All shipments are on track.",
    recommendation: null,
    action: null,
    actionHref: null,
  };
}

function statusAccent(level: string) {
  switch (level) {
    case "critical":
      return { text: "text-[#E05252]", bg: "bg-[#E05252]/[0.04]", border: "border-[#E05252]/8", btn: "bg-[#E05252] text-white hover:bg-[#E05252]/90", icon: XCircle };
    case "warning":
    case "attention":
      return { text: "text-[#D4A24C]", bg: "bg-[#D4A24C]/[0.03]", border: "border-[#D4A24C]/8", btn: "bg-[#D4A24C] text-white hover:bg-[#D4A24C]/90", icon: AlertTriangle };
    default:
      return { text: "text-primary", bg: "bg-primary/[0.03]", border: "border-primary/8", btn: "", icon: CheckCircle2 };
  }
}

export default function CommandCenter() {
  const { user } = useAuth();
  const { data: shipmentsRes, isLoading } = useListShipments();
  const { data: alertsRes } = useAlertsSummary();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const shipments = (shipmentsRes?.data || []) as any[];
  const alertsSummary = alertsRes?.data;

  const activeShipments = stats?.shipments?.active ?? 0;
  const totalShipments = stats?.shipments?.total ?? 0;
  const complianceClear = stats?.compliance?.clear ?? 0;
  const highRisk = stats?.risk?.high ?? 0;

  const status = deriveSystemStatus(stats, alertsSummary);
  const accent = statusAccent(status.level);
  const ready = !statsLoading && !isLoading;
  const Icon = accent.icon;

  return (
    <AppLayout>
      <div className="max-w-[640px] mx-auto px-6 py-10">

        {!ready && (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/40" />
          </div>
        )}

        {ready && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
              className={`rounded-2xl ${accent.bg} border ${accent.border} px-7 py-7 mb-10`}
            >
              <div className="flex items-center gap-2 mb-4">
                <Icon className={`w-4 h-4 ${accent.text}`} />
                <span className={`text-[11px] font-semibold uppercase tracking-[0.15em] ${accent.text}`}>
                  {status.level === "clear" ? "System Status" : "Action Required"}
                </span>
              </div>

              <h1 className={`text-[26px] font-bold ${accent.text} font-heading leading-tight tracking-tight mb-1.5`}>
                {status.headline}
              </h1>

              <p className="text-[14px] text-muted-foreground leading-relaxed max-w-md mb-1">
                {status.detail}
              </p>

              {status.recommendation && (
                <p className="text-[13px] text-foreground/40 mb-5">
                  Recommended: {status.recommendation}
                </p>
              )}

              {!status.recommendation && <div className="mb-5" />}

              {status.action && status.actionHref && (
                <Link href={status.actionHref}>
                  <button className={`px-5 py-2 rounded-lg text-[13px] font-semibold transition-all active:scale-[0.97] ${accent.btn}`}>
                    {status.action}
                  </button>
                </Link>
              )}

              {status.level !== "clear" && alertsSummary?.criticalAlerts?.length > 0 && (
                <div className="mt-5 pt-4 border-t border-border/30 space-y-0.5">
                  {alertsSummary.criticalAlerts.slice(0, 3).map((alert: any) => (
                    <Link key={alert.id} href={alert.shipmentId ? `/shipments/${alert.shipmentId}` : "/exceptions"}>
                      <div className="flex items-center gap-3 py-1.5 px-3 -mx-3 rounded-lg hover:bg-black/[0.02] transition-colors cursor-pointer group">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          alert.severity === "CRITICAL" ? "bg-[#E05252]" : "bg-[#D4A24C]"
                        }`} />
                        <span className="text-[13px] text-foreground/70 flex-1">{alert.title}</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="flex items-center gap-8 mb-10 text-[13px]"
            >
              <Signal label="Active" value={activeShipments} sub={`/ ${totalShipments}`} color="text-foreground" />
              <div className="w-px h-7 bg-border/50" />
              <Signal label="Compliant" value={complianceClear} color="text-primary" />
              {highRisk > 0 && (
                <>
                  <div className="w-px h-7 bg-border/50" />
                  <Signal label="High Risk" value={highRisk} color="text-[#D4A24C]" />
                </>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="mb-10"
            >
              <CommandInput />
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[14px] font-semibold text-foreground font-heading">Recent Shipments</h2>
                <Link href="/shipments" className="text-[12px] text-primary/70 hover:text-primary font-medium flex items-center gap-1 transition-colors">
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {shipments.length === 0 ? (
                <EmptyState />
              ) : (
                <div>
                  {shipments.slice(0, 8).map((s: any, i: number) => {
                    const score = normalizeRiskScore(s.risk?.compositeScore);
                    const needsCare = s.status === "PENDING_REVIEW" || s.compliance?.status === "FLAGGED" || (score != null && score >= 60);

                    return (
                      <motion.div
                        key={s.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 + i * 0.025 }}
                      >
                        <Link href={`/shipments/${s.id}`}>
                          <div className={`flex items-center gap-4 px-4 py-3 -mx-4 rounded-xl hover:bg-card transition-all cursor-pointer group ${needsCare ? "" : "opacity-40 hover:opacity-80"}`}>
                            <StatusDot status={s.status} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-semibold text-foreground font-mono">{s.reference}</span>
                                <span className="text-[11px] text-muted-foreground/50">
                                  {s.status.replace(/_/g, " ")}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 text-[12px] text-muted-foreground/60">
                                <span className="truncate max-w-[140px]">{s.shipper?.name || "Pending"}</span>
                                <span className="text-primary/30">→</span>
                                <span className="truncate max-w-[140px]">{s.consignee?.name || "Pending"}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              {s.compliance?.status === "CLEAR" ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-primary/40" />
                              ) : s.compliance?.status ? (
                                <AlertTriangle className="w-3.5 h-3.5 text-[#D4A24C]" />
                              ) : (
                                <Clock className="w-3.5 h-3.5 text-muted-foreground/25" />
                              )}

                              {score != null && (
                                <span className={`text-[12px] font-semibold tabular-nums ${riskColor(score)}`}>
                                  {score}
                                </span>
                              )}

                              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors" />
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

function Signal({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
  return (
    <div>
      <span className="text-muted-foreground/50 text-[11px] uppercase tracking-wider">{label}</span>
      <div className="flex items-baseline gap-1 mt-0.5">
        <span className={`text-[20px] font-bold tabular-nums ${color}`}>{value}</span>
        {sub && <span className="text-muted-foreground/35 text-[13px]">{sub}</span>}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DRAFT: "bg-muted-foreground/30",
    PENDING_REVIEW: "bg-[#D4A24C]",
    APPROVED: "bg-primary",
    REJECTED: "bg-[#E05252]",
    IN_TRANSIT: "bg-primary",
    AT_PORT: "bg-[#D4A24C]",
    CUSTOMS: "bg-[#D4A24C]",
    BOOKED: "bg-primary/50",
    DELIVERED: "bg-muted-foreground/25",
    CLOSED: "bg-muted-foreground/25",
  };
  return <span className={`w-2 h-2 rounded-full shrink-0 ${colors[status] || "bg-muted-foreground/30"}`} />;
}

function EmptyState() {
  return (
    <div className="text-center py-20">
      <p className="text-[15px] text-foreground/60 mb-1">No shipments yet</p>
      <p className="text-[13px] text-muted-foreground/50 mb-6">Import your data or create your first shipment.</p>
      <Link href="/shipments" className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors">
        Get Started
      </Link>
    </div>
  );
}
