import { useState } from "react";
import { useListShipments } from "@workspace/api-client-react";
import { Link } from "wouter";
import { ArrowLeft, Brain, Shield, TrendingUp, Umbrella, Search, Loader2, ChevronRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

function riskColor(score: number | undefined | null): string {
  if (score == null) return "text-muted-foreground";
  if (score < 0.3) return "text-emerald-400";
  if (score < 0.6) return "text-amber-400";
  return "text-red-400";
}

function riskLabel(score: number | undefined | null): string {
  if (score == null) return "N/A";
  if (score < 0.3) return "Low";
  if (score < 0.6) return "Medium";
  return "High";
}

function complianceColor(status: string | undefined | null): string {
  if (!status) return "text-muted-foreground";
  if (status === "CLEAR") return "text-emerald-400";
  if (status === "FLAGGED") return "text-red-400";
  return "text-amber-400";
}

function formatCurrency(amount: number | string | null | undefined, currency = "USD"): string {
  if (amount == null) return "N/A";
  return `${currency} ${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ShipmentIntelligence() {
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

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-[1600px] mx-auto">
      <div className="flex items-center gap-4 mb-8 mt-4">
        <Link href="/" className="p-2 rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div className="flex-grow">
          <h1 className="text-4xl font-display font-extrabold text-foreground flex items-center gap-3">
            <Brain className="w-8 h-8 text-primary" />
            Shipment Intelligence
          </h1>
          <p className="text-muted-foreground text-lg mt-1">
            AI-powered analysis across all processed shipments.
          </p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search shipments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <SummaryCard
          icon={<Brain className="w-5 h-5" />}
          label="Total Shipments"
          value={shipments.length.toString()}
          color="text-primary"
        />
        <SummaryCard
          icon={<Shield className="w-5 h-5" />}
          label="Compliance Clear"
          value={shipments.filter((s: any) => s.compliance?.status === "CLEAR").length.toString()}
          color="text-emerald-400"
        />
        <SummaryCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Low Risk"
          value={shipments.filter((s: any) => (s.risk?.compositeScore ?? 1) < 0.3).length.toString()}
          color="text-blue-400"
        />
        <SummaryCard
          icon={<Umbrella className="w-5 h-5" />}
          label="Insured"
          value={shipments.filter((s: any) => s.insurance?.estimatedPremium).length.toString()}
          color="text-violet-400"
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-primary">
          <Loader2 className="w-10 h-10 animate-spin mb-4" />
          <p className="font-medium animate-pulse">Loading intelligence data...</p>
        </div>
      ) : (
        <div className="glass-panel rounded-xl overflow-hidden border border-border/50">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-card/50">
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider text-xs">Reference</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider text-xs">Shipper</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider text-xs">Consignee</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider text-xs">Commodity</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider text-xs">HS Code</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider text-xs">Route</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground uppercase tracking-wider text-xs">Weight</th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground uppercase tracking-wider text-xs">Compliance</th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground uppercase tracking-wider text-xs">Risk</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground uppercase tracking-wider text-xs">Premium</th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground uppercase tracking-wider text-xs">Trace</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s: any, i: number) => (
                  <motion.tr
                    key={s.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border/30 hover:bg-primary/5 transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <Link href={`/shipments/${s.id}`} className="font-semibold text-primary hover:underline">
                        {s.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-foreground">{s.shipper?.name || <span className="text-muted-foreground italic">Unknown</span>}</td>
                    <td className="px-4 py-3 text-foreground">{s.consignee?.name || <span className="text-muted-foreground italic">Unknown</span>}</td>
                    <td className="px-4 py-3 text-foreground truncate max-w-[160px]">{s.commodity || "N/A"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{s.hsCode || "N/A"}</td>
                    <td className="px-4 py-3 text-foreground whitespace-nowrap">
                      <span className="text-muted-foreground">{s.portOfLoading || "?"}</span>
                      <span className="mx-1 text-primary">→</span>
                      <span className="text-muted-foreground">{s.portOfDischarge || "?"}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {s.grossWeight ? `${Number(s.grossWeight).toLocaleString()} ${s.weightUnit || "KG"}` : "N/A"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 font-semibold ${complianceColor(s.compliance?.status)}`}>
                        {s.compliance?.status === "CLEAR" ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.compliance?.status ? <AlertTriangle className="w-3.5 h-3.5" /> : null}
                        {s.compliance?.status || "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-semibold ${riskColor(s.risk?.compositeScore)}`}>
                        {s.risk?.compositeScore != null ? `${(Number(s.risk.compositeScore) * 100).toFixed(0)}%` : "N/A"}
                      </span>
                      <span className={`block text-xs ${riskColor(s.risk?.compositeScore)}`}>{riskLabel(s.risk?.compositeScore)}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">
                      {s.insurance?.estimatedPremium ? formatCurrency(s.insurance.estimatedPremium) : "N/A"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/shipments/${s.id}/trace`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors opacity-60 group-hover:opacity-100"
                      >
                        View <ChevronRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No shipments match your search.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="glass-panel rounded-xl p-5 border border-border/50">
      <div className={`flex items-center gap-2 mb-2 ${color}`}>
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className="text-3xl font-display font-bold text-foreground">{value}</div>
    </div>
  );
}
