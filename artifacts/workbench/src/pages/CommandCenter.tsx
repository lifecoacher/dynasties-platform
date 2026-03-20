import { useListShipments, useListEvents } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Ship,
  Shield,
  TrendingUp,
  Umbrella,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Clock,
  AlertCircle,
  XCircle,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CommandInput } from "@/components/command/CommandInput";
import { useAuth } from "@/hooks/use-auth";
import { useAlertsSummary } from "@/hooks/use-exceptions";
import { normalizeRiskScore, riskColor, riskLabel, formatCurrency } from "@/lib/format";

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DRAFT: "bg-muted-foreground",
    PENDING_REVIEW: "bg-[#D4A24C]",
    APPROVED: "bg-primary",
    REJECTED: "bg-[#E05252]",
    IN_TRANSIT: "bg-primary",
    AT_PORT: "bg-[#D4A24C]",
    CUSTOMS: "bg-[#D4A24C]",
    BOOKED: "bg-primary/60",
    DELIVERED: "bg-muted-foreground",
    CLOSED: "bg-muted-foreground",
  };
  return <span className={`w-2 h-2 rounded-full ${colors[status] || "bg-muted-foreground"}`} />;
}

export default function CommandCenter() {
  const { user } = useAuth();
  const { data: shipmentsRes, isLoading } = useListShipments();
  const { data: alertsRes } = useAlertsSummary();
  const shipments = (shipmentsRes?.data || []) as any[];
  const alertsSummary = alertsRes?.data;

  const totalShipments = shipments.length;
  const complianceClear = shipments.filter((s: any) => s.compliance?.status === "CLEAR").length;
  const complianceAlerts = shipments.filter((s: any) => s.compliance?.status && s.compliance.status !== "CLEAR").length;
  const highRisk = shipments.filter((s: any) => {
    const score = normalizeRiskScore(s.risk?.compositeScore);
    return score != null && score >= 60;
  }).length;
  const activeShipments = shipments.filter((s: any) => !["DELIVERED", "CLOSED", "CANCELLED", "REJECTED"].includes(s.status)).length;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center mb-8"
          >
            <h1 className="text-2xl font-semibold text-foreground tracking-tight mb-1">Trade Command Center</h1>
            <p className="text-[14px] text-muted-foreground">
              {user?.companyName ? `${user.companyName} — ` : ""}AI-powered logistics operations hub
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <CommandInput />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="grid grid-cols-4 gap-3 mb-8"
        >
          <MetricCard label="Active" value={isLoading ? null : activeShipments} sub={isLoading ? undefined : `of ${totalShipments}`} icon={<Ship className="w-4 h-4" />} color="text-primary" />
          <MetricCard label="Compliant" value={isLoading ? null : complianceClear} sub={isLoading ? undefined : `of ${totalShipments}`} icon={<Shield className="w-4 h-4" />} color="text-primary" />
          <MetricCard label="Risk Alerts" value={isLoading ? null : highRisk} icon={<TrendingUp className="w-4 h-4" />} color={highRisk > 0 ? "text-[#D4A24C]" : "text-primary"} />
          <MetricCard label="Compliance" value={isLoading ? null : complianceAlerts} sub={complianceAlerts > 0 ? "alerts" : "clear"} icon={<AlertCircle className="w-4 h-4" />} color={complianceAlerts > 0 ? "text-[#E05252]" : "text-primary"} />
        </motion.div>

        {alertsSummary && alertsSummary.total > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-400" />
                Exception Alerts
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400">
                  {alertsSummary.needsAttention} need attention
                </span>
              </h2>
              <Link href="/exceptions" className="text-[12px] text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-1.5">
              {alertsSummary.criticalAlerts.map((alert: any) => (
                <Link key={alert.id} href={alert.shipmentId ? `/shipments/${alert.shipmentId}` : "/exceptions"}>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-card-border hover:bg-white/[0.02] transition-colors cursor-pointer group">
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                      alert.severity === "CRITICAL" ? "bg-red-500/10" : "bg-orange-500/10"
                    }`}>
                      {alert.severity === "CRITICAL" ? (
                        <XCircle className="w-3.5 h-3.5 text-red-400" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[12px] font-medium text-foreground">{alert.title}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                          alert.severity === "CRITICAL" ? "bg-red-500/10 text-red-400" : "bg-orange-500/10 text-orange-400"
                        }`}>{alert.severity}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                          alert.status === "ESCALATED" ? "bg-orange-500/10 text-orange-400" : "bg-red-500/10 text-red-400"
                        }`}>{alert.status}</span>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold text-foreground">Shipment Activity</h2>
            <Link href="/shipments" className="text-[12px] text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : shipments.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-1">
              {shipments.map((s: any, i: number) => {
                const score = normalizeRiskScore(s.risk?.compositeScore);
                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.04 }}
                  >
                    <Link href={`/shipments/${s.id}`}>
                      <div className="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-card/80 transition-colors cursor-pointer group border border-transparent hover:border-card-border">
                        <StatusDot status={s.status} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-semibold text-foreground font-mono">{s.reference}</span>
                            <span className="text-[11px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/50">
                              {s.status.replace(/_/g, " ")}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 text-[12px] text-muted-foreground">
                            <span className="truncate max-w-[140px]">{s.shipper?.name || "Unknown"}</span>
                            <span className="text-primary/60">→</span>
                            <span className="truncate max-w-[140px]">{s.consignee?.name || "Unknown"}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <div className="flex items-center gap-1.5">
                            {s.compliance?.status === "CLEAR" ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                            ) : s.compliance?.status ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-[#D4A24C]" />
                            ) : (
                              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                          </div>

                          {score != null && (
                            <span className={`text-[12px] font-semibold tabular-nums ${riskColor(score)}`}>
                              {score}
                            </span>
                          )}

                          {s.insurance?.estimatedPremium && (
                            <span className="text-[11px] text-muted-foreground font-mono">
                              {formatCurrency(s.insurance.estimatedPremium, s.insurance.currency)}
                            </span>
                          )}

                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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

function MetricCard({ label, value, sub, icon, color }: { label: string; value: number | null; sub?: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="px-4 py-3 rounded-xl bg-card border border-card-border">
      <div className={`flex items-center gap-1.5 mb-1.5 ${color}`}>
        {icon}
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      {value === null ? (
        <div className="h-8 w-12 rounded bg-muted/30 animate-pulse" />
      ) : (
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold text-foreground tabular-nums">{value}</span>
          {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16 px-8">
      <Ship className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
      <h3 className="text-[15px] font-semibold text-foreground mb-1">No shipments yet</h3>
      <p className="text-[13px] text-muted-foreground mb-4">Import your shipments, connect your email, or create your first shipment.</p>
      <div className="flex items-center justify-center gap-3">
        <Link href="/shipments" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors">
          View Shipments
        </Link>
      </div>
    </div>
  );
}
