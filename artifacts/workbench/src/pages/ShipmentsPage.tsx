import { useState } from "react";
import { useListShipments } from "@workspace/api-client-react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  Search,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Ship,
  Filter,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { normalizeRiskScore, riskColor, formatCurrency } from "@/lib/format";

type FilterTab = "ALL" | "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";

const TABS: { value: FilterTab; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING_REVIEW", label: "Review" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const STAGES = [
  "Email Received",
  "Extracted",
  "Entities Resolved",
  "Compliance",
  "Risk Analysis",
  "Insurance",
  "Pricing",
  "Documents",
  "Billing",
];

function getCompletedStages(s: any): number {
  let count = 1;
  if (s.blNumber || s.commodity) count++;
  if (s.shipper || s.consignee) count++;
  if (s.compliance) count++;
  if (s.risk) count++;
  if (s.insurance) count++;
  if (s.status === "APPROVED") count += 3;
  return Math.min(count, STAGES.length);
}

export default function ShipmentsPage() {
  const { data: response, isLoading } = useListShipments();
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [search, setSearch] = useState("");

  const shipments = (response?.data || []) as any[];

  const filtered = shipments.filter((s) => {
    const matchesTab = activeTab === "ALL" || s.status === activeTab;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      s.reference?.toLowerCase().includes(q) ||
      s.shipper?.name?.toLowerCase().includes(q) ||
      s.consignee?.name?.toLowerCase().includes(q) ||
      s.commodity?.toLowerCase().includes(q);
    return matchesTab && matchesSearch;
  });

  return (
    <AppLayout>
      <div className="px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Shipments</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              {shipments.length} total across all stages
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-lg bg-card border border-card-border text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all w-56"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 mb-6 border-b border-card-border">
          {TABS.map((tab) => {
            const count = tab.value === "ALL" ? shipments.length : shipments.filter((s) => s.status === tab.value).length;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`relative px-4 py-2.5 text-[13px] font-medium transition-colors ${
                  activeTab === tab.value
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                <span className="ml-1.5 text-[11px] text-muted-foreground">{count}</span>
                {activeTab === tab.value && (
                  <motion.div
                    layoutId="shipment-tab"
                    className="absolute bottom-0 left-2 right-2 h-[2px] bg-primary rounded-full"
                  />
                )}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Filter className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-[14px] text-muted-foreground">No shipments match your filters</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((s: any, i: number) => {
              const score = normalizeRiskScore(s.risk?.compositeScore);
              const completedStages = getCompletedStages(s);
              const progress = (completedStages / STAGES.length) * 100;

              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link href={`/shipments/${s.id}`}>
                    <div className="p-4 rounded-xl bg-card border border-card-border hover:border-primary/30 transition-all cursor-pointer group">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Ship className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[14px] font-semibold text-foreground font-mono">{s.reference}</span>
                              <StatusPill status={s.status} />
                            </div>
                            <p className="text-[12px] text-muted-foreground mt-0.5">
                              {format(new Date(s.createdAt), "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="flex items-center gap-3 text-[12px]">
                              {s.compliance?.status === "CLEAR" && (
                                <span className="flex items-center gap-1 text-emerald-400">
                                  <CheckCircle2 className="w-3 h-3" /> Clear
                                </span>
                              )}
                              {s.compliance?.status && s.compliance.status !== "CLEAR" && (
                                <span className="flex items-center gap-1 text-amber-400">
                                  <AlertTriangle className="w-3 h-3" /> {s.compliance.status}
                                </span>
                              )}
                              {score != null && (
                                <span className={`font-semibold ${riskColor(score)}`}>Risk {score}</span>
                              )}
                              {s.insurance?.estimatedPremium && (
                                <span className="text-muted-foreground font-mono">
                                  {formatCurrency(s.insurance.estimatedPremium, s.insurance.currency)}
                                </span>
                              )}
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-[12px] text-muted-foreground mb-3">
                        <span className="truncate max-w-[200px]">{s.shipper?.name || "Unknown shipper"}</span>
                        <span className="text-primary/40">→</span>
                        <span className="truncate max-w-[200px]">{s.consignee?.name || "Unknown consignee"}</span>
                        {s.portOfLoading && (
                          <>
                            <span className="text-border">|</span>
                            <span>{s.portOfLoading} → {s.portOfDischarge || "?"}</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-primary/60 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.6, delay: i * 0.05 }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {completedStages}/{STAGES.length}
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: "bg-blue-400/10 text-blue-400",
    PENDING_REVIEW: "bg-amber-400/10 text-amber-400",
    APPROVED: "bg-emerald-400/10 text-emerald-400",
    REJECTED: "bg-red-400/10 text-red-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${styles[status] || "bg-muted text-muted-foreground"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
