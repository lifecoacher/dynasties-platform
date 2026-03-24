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
      detail: `${criticalAlerts} critical alert${criticalAlerts > 1 ? "s" : ""} require immediate attention.`,
      action: "Review critical alerts",
      actionHref: "/exceptions",
      color: "text-red-400",
      bgColor: "bg-red-500/5",
      borderColor: "border-red-500/10",
    };
  }

  if (flagged > 0) {
    return {
      level: "warning" as const,
      headline: `${flagged} Compliance Flag${flagged > 1 ? "s" : ""} Active`,
      detail: "Shipments with compliance flags need review before they can proceed.",
      action: "Review flagged shipments",
      actionHref: "/shipments",
      color: "text-[#D4A24C]",
      bgColor: "bg-[#D4A24C]/5",
      borderColor: "border-[#D4A24C]/10",
    };
  }

  if (highRisk > 0) {
    return {
      level: "warning" as const,
      headline: `${highRisk} High-Risk Shipment${highRisk > 1 ? "s" : ""}`,
      detail: "Elevated risk scores detected. Review risk factors before approving.",
      action: "Review risk alerts",
      actionHref: "/shipments",
      color: "text-[#D4A24C]",
      bgColor: "bg-[#D4A24C]/5",
      borderColor: "border-[#D4A24C]/10",
    };
  }

  if (needsAttention > 0) {
    return {
      level: "attention" as const,
      headline: `${needsAttention} Item${needsAttention > 1 ? "s" : ""} Need Attention`,
      detail: "Non-critical exceptions require review.",
      action: "View exceptions",
      actionHref: "/exceptions",
      color: "text-[#D4A24C]",
      bgColor: "bg-[#D4A24C]/5",
      borderColor: "border-[#D4A24C]/10",
    };
  }

  return {
    level: "clear" as const,
    headline: "All Systems Operating Normally",
    detail: "No issues detected. All shipments are on track.",
    action: null,
    actionHref: null,
    color: "text-primary",
    bgColor: "bg-primary/5",
    borderColor: "border-primary/10",
  };
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
  const ready = !statsLoading && !isLoading;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10"
        >
          <p className="text-[13px] text-muted-foreground mb-1">
            {user?.companyName || "Trade Intelligence"}
          </p>
          <h1 className="text-[28px] font-bold text-foreground tracking-tight font-heading leading-tight">
            Command Center
          </h1>
        </motion.div>

        {ready && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className={`rounded-2xl ${status.bgColor} border ${status.borderColor} px-8 py-7 mb-10`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2.5 mb-2">
                  {status.level === "clear" ? (
                    <CheckCircle2 className={`w-5 h-5 ${status.color}`} />
                  ) : status.level === "critical" ? (
                    <XCircle className={`w-5 h-5 ${status.color}`} />
                  ) : (
                    <AlertTriangle className={`w-5 h-5 ${status.color}`} />
                  )}
                  <span className={`text-[11px] font-semibold uppercase tracking-wider ${status.color}`}>
                    System Status
                  </span>
                </div>
                <h2 className={`text-[24px] font-bold ${status.color} font-heading leading-snug mb-2`}>
                  {status.headline}
                </h2>
                <p className="text-[14px] text-muted-foreground leading-relaxed max-w-md">
                  {status.detail}
                </p>
              </div>
              {status.action && status.actionHref && (
                <Link href={status.actionHref}>
                  <button className={`shrink-0 ml-6 px-5 py-2.5 rounded-lg text-[13px] font-semibold transition-all ${
                    status.level === "critical"
                      ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                      : "bg-[#D4A24C]/15 text-[#D4A24C] hover:bg-[#D4A24C]/25"
                  }`}>
                    {status.action}
                  </button>
                </Link>
              )}
            </div>

            {status.level !== "clear" && alertsSummary?.criticalAlerts?.length > 0 && (
              <div className="mt-5 pt-5 border-t border-white/5 space-y-2">
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
        )}

        {!ready && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {ready && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="flex items-center gap-8 mb-10 text-[13px]"
          >
            <div>
              <span className="text-muted-foreground">Active</span>
              <span className="ml-2 text-[18px] font-bold text-foreground tabular-nums">{activeShipments}</span>
              <span className="ml-1 text-muted-foreground/60">of {totalShipments}</span>
            </div>
            <div className="w-px h-5 bg-border" />
            <div>
              <span className="text-muted-foreground">Compliant</span>
              <span className="ml-2 text-[18px] font-bold text-primary tabular-nums">{complianceClear}</span>
            </div>
            <div className="w-px h-5 bg-border" />
            <div>
              <span className="text-muted-foreground">High Risk</span>
              <span className={`ml-2 text-[18px] font-bold tabular-nums ${highRisk > 0 ? "text-[#D4A24C]" : "text-foreground"}`}>{highRisk}</span>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mb-10"
        >
          <CommandInput />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold text-foreground font-heading">Recent Shipments</h2>
            <Link href="/shipments" className="text-[12px] text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : shipments.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-px">
              {shipments.slice(0, 8).map((s: any, i: number) => {
                const score = normalizeRiskScore(s.risk?.compositeScore);
                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.25 + i * 0.03 }}
                  >
                    <Link href={`/shipments/${s.id}`}>
                      <div className="flex items-center gap-4 px-4 py-3.5 -mx-4 rounded-lg hover:bg-white/[0.02] transition-colors cursor-pointer group">
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
