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
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CommandInput } from "@/components/command/CommandInput";
import { normalizeRiskScore, riskColor, riskLabel, formatCurrency } from "@/lib/format";

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DRAFT: "bg-blue-400",
    PENDING_REVIEW: "bg-amber-400",
    APPROVED: "bg-emerald-400",
    REJECTED: "bg-red-400",
  };
  return <span className={`w-2 h-2 rounded-full ${colors[status] || "bg-muted-foreground"}`} />;
}

export default function CommandCenter() {
  const { data: shipmentsRes, isLoading } = useListShipments();
  const shipments = (shipmentsRes?.data || []) as any[];

  const totalShipments = shipments.length;
  const complianceClear = shipments.filter((s: any) => s.compliance?.status === "CLEAR").length;
  const highRisk = shipments.filter((s: any) => {
    const score = normalizeRiskScore(s.risk?.compositeScore);
    return score != null && score >= 60;
  }).length;
  const insured = shipments.filter((s: any) => s.insurance?.estimatedPremium).length;

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
            <p className="text-[14px] text-muted-foreground">Your AI-powered logistics operations hub</p>
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
          <MetricCard label="Shipments" value={totalShipments} icon={<Ship className="w-4 h-4" />} color="text-primary" />
          <MetricCard label="Compliant" value={complianceClear} icon={<Shield className="w-4 h-4" />} color="text-emerald-400" />
          <MetricCard label="High Risk" value={highRisk} icon={<TrendingUp className="w-4 h-4" />} color="text-red-400" />
          <MetricCard label="Insured" value={insured} icon={<Umbrella className="w-4 h-4" />} color="text-violet-400" />
        </motion.div>

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
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            ) : s.compliance?.status ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
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

function MetricCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="px-4 py-3 rounded-xl bg-card border border-card-border">
      <div className={`flex items-center gap-1.5 mb-1.5 ${color}`}>
        {icon}
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-foreground tabular-nums">{value}</div>
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
        <Link href="/demo" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors">
          Try Demo Pipeline
        </Link>
      </div>
    </div>
  );
}
