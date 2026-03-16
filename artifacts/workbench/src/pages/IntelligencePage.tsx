import { useState } from "react";
import { useListShipments } from "@workspace/api-client-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Search,
  Loader2,
  Brain,
  Shield,
  TrendingUp,
  Umbrella,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { normalizeRiskScore, riskColor, riskLabel, formatCurrency, formatWeight } from "@/lib/format";

function complianceColor(status: string | undefined | null): string {
  if (!status) return "text-muted-foreground";
  if (status === "CLEAR") return "text-primary";
  if (status === "FLAGGED" || status === "ALERT") return "text-[#E05252]";
  return "text-[#D4A24C]";
}

export default function IntelligencePage() {
  const { data: response, isLoading } = useListShipments();
  const [search, setSearch] = useState("");

  const shipments = (response?.data || []) as any[];

  const filtered = shipments.filter((s: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.reference?.toLowerCase().includes(q) ||
      s.shipper?.name?.toLowerCase().includes(q) ||
      s.consignee?.name?.toLowerCase().includes(q) ||
      s.commodity?.toLowerCase().includes(q)
    );
  });

  const totalShipments = shipments.length;
  const complianceClear = shipments.filter((s: any) => s.compliance?.status === "CLEAR").length;
  const lowRisk = shipments.filter((s: any) => {
    const score = normalizeRiskScore(s.risk?.compositeScore);
    return score != null && score < 30;
  }).length;
  const insured = shipments.filter((s: any) => s.insurance?.estimatedPremium).length;

  return (
    <AppLayout>
      <div className="px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Intelligence</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              AI-powered analysis across all shipments
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search shipments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-lg bg-card border border-card-border text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all w-56"
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-6">
          <StatCard icon={<Brain className="w-4 h-4" />} label="Total" value={totalShipments} color="text-primary" />
          <StatCard icon={<Shield className="w-4 h-4" />} label="Compliant" value={complianceClear} color="text-primary" />
          <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Low Risk" value={lowRisk} color="text-primary" />
          <StatCard icon={<Umbrella className="w-4 h-4" />} label="Insured" value={insured} color="text-muted-foreground" />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="rounded-xl border border-card-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-card-border bg-card/50">
                    <th className="px-4 py-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Reference</th>
                    <th className="px-4 py-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Shipper</th>
                    <th className="px-4 py-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Consignee</th>
                    <th className="px-4 py-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Commodity</th>
                    <th className="px-4 py-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Route</th>
                    <th className="px-4 py-3 text-center text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Compliance</th>
                    <th className="px-4 py-3 text-center text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Risk</th>
                    <th className="px-4 py-3 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Premium</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s: any, i: number) => {
                    const score = normalizeRiskScore(s.risk?.compositeScore);
                    return (
                      <motion.tr
                        key={s.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className="border-b border-card-border/50 hover:bg-card/50 transition-colors group"
                      >
                        <td className="px-4 py-3">
                          <Link href={`/shipments/${s.id}`} className="font-semibold text-primary hover:underline font-mono text-[12px]">
                            {s.reference}
                          </Link>
                        </td>
                        <td className="px-4 py-3 max-w-[160px]">
                          <span className="block truncate">{s.shipper?.name || <span className="text-muted-foreground italic">Unknown</span>}</span>
                        </td>
                        <td className="px-4 py-3 max-w-[160px]">
                          <span className="block truncate">{s.consignee?.name || <span className="text-muted-foreground italic">Unknown</span>}</span>
                        </td>
                        <td className="px-4 py-3 max-w-[160px]">
                          <span className="block truncate">{s.commodity || "N/A"}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-[12px]">
                          <span className="text-muted-foreground">{s.portOfLoading || "?"}</span>
                          <span className="mx-1 text-primary/40">→</span>
                          <span className="text-muted-foreground">{s.portOfDischarge || "?"}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 font-medium text-[12px] ${complianceColor(s.compliance?.status)}`}>
                            {s.compliance?.status === "CLEAR" ? <CheckCircle2 className="w-3 h-3" /> : s.compliance?.status ? <AlertTriangle className="w-3 h-3" /> : null}
                            {s.compliance?.status || "Pending"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-semibold text-[12px] ${riskColor(score)}`}>
                            {score != null ? score : "—"}
                          </span>
                          <span className={`block text-[10px] ${riskColor(score)}`}>{riskLabel(score)}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[11px] text-muted-foreground">
                          {s.insurance?.estimatedPremium ? formatCurrency(s.insurance.estimatedPremium) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/shipments/${s.id}/trace`}
                            className="inline-flex items-center gap-0.5 text-primary text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Trace <ChevronRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-[13px]">
                No shipments match your search.
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="px-4 py-3 rounded-xl bg-card border border-card-border">
      <div className={`flex items-center gap-1.5 mb-1 ${color}`}>
        {icon}
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-foreground tabular-nums">{value}</div>
    </div>
  );
}
