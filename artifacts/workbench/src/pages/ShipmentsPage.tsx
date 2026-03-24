import { useState } from "react";
import { useListShipments } from "@workspace/api-client-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  Search,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Filter,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { normalizeRiskScore, riskColor, formatPortCode } from "@/lib/format";

type FilterTab = "ALL" | "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";

const TABS: { value: FilterTab; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING_REVIEW", label: "Review" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

function deriveVoice(shipments: any[]) {
  const pendingReview = shipments.filter((s) => s.status === "PENDING_REVIEW").length;
  const flagged = shipments.filter((s) => s.compliance?.status === "FLAGGED" || s.compliance?.status === "ALERT").length;
  const highRisk = shipments.filter((s) => {
    const score = normalizeRiskScore(s.risk?.compositeScore);
    return score != null && score >= 60;
  }).length;

  if (flagged > 0) return { text: `${flagged} shipment${flagged > 1 ? "s" : ""} flagged for compliance review`, color: "text-[#D4A24C]" };
  if (highRisk > 0) return { text: `${highRisk} shipment${highRisk > 1 ? "s" : ""} with elevated risk`, color: "text-[#D4A24C]" };
  if (pendingReview > 0) return { text: `${pendingReview} shipment${pendingReview > 1 ? "s" : ""} awaiting your review`, color: "text-foreground/70" };
  return { text: "All shipments on track", color: "text-primary/60" };
}

function needsCare(s: any) {
  const score = normalizeRiskScore(s.risk?.compositeScore);
  return s.status === "PENDING_REVIEW"
    || s.compliance?.status === "FLAGGED"
    || s.compliance?.status === "ALERT"
    || (score != null && score >= 60);
}

export default function ShipmentsPage() {
  const { data: response, isLoading } = useListShipments();
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [search, setSearch] = useState("");

  const shipments = (response?.data || []) as any[];
  const voice = deriveVoice(shipments);

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
      <div className="px-6 py-8">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-[22px] font-bold text-foreground tracking-tight font-heading">Shipments</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-lg bg-background border border-border text-[13px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all w-52"
            />
          </div>
        </div>

        {!isLoading && shipments.length > 0 && (
          <p className={`text-[13px] ${voice.color} mb-5`}>{voice.text}</p>
        )}

        <div className="flex items-center gap-0.5 mb-6 border-b border-border/60">
          {TABS.map((tab) => {
            const count = tab.value === "ALL" ? shipments.length : shipments.filter((s) => s.status === tab.value).length;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`relative px-4 py-2.5 text-[13px] font-medium transition-colors ${
                  activeTab === tab.value
                    ? "text-foreground"
                    : "text-muted-foreground/60 hover:text-foreground"
                }`}
              >
                {tab.label}
                {count > 0 && <span className="ml-1.5 text-[11px] text-muted-foreground/40">{count}</span>}
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
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/30" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            {shipments.length === 0 ? (
              <>
                <p className="text-[15px] text-foreground/60 mb-1">No shipments yet</p>
                <p className="text-[13px] text-muted-foreground/40">Create your first shipment or import documents to get started.</p>
              </>
            ) : (
              <>
                <Filter className="w-5 h-5 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-[13px] text-muted-foreground/50">No shipments match your filters</p>
              </>
            )}
          </div>
        ) : (
          <div>
            {filtered.map((s: any, i: number) => {
              const score = normalizeRiskScore(s.risk?.compositeScore);
              const important = needsCare(s);

              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                >
                  <Link href={`/shipments/${s.id}`}>
                    <div className={`flex items-center gap-4 px-4 py-3.5 -mx-4 rounded-xl hover:bg-card transition-all cursor-pointer group border-b border-border/30 last:border-b-0 active:scale-[0.998] ${important ? "" : "opacity-40 hover:opacity-80"}`}>
                      <StatusDot status={s.status} />

                      <div className="w-[72px] shrink-0">
                        <StatusLabel status={s.status} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-semibold text-foreground font-mono">{s.reference}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[12px] text-muted-foreground/50">
                          {s.shipper?.name || s.consignee?.name ? (
                            <>
                              <span className="truncate max-w-[160px]">{s.shipper?.name || "Pending"}</span>
                              <span className="text-primary/25">→</span>
                              <span className="truncate max-w-[160px]">{s.consignee?.name || "Pending"}</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground/30 italic">Incomplete Shipment</span>
                          )}
                          {s.portOfLoading && (
                            <>
                              <span className="text-muted-foreground/15">·</span>
                              <span className="text-muted-foreground/40">{formatPortCode(s.portOfLoading)} → {formatPortCode(s.portOfDischarge)}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3.5 shrink-0">
                        {s.compliance?.status === "CLEAR" ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary/35" />
                        ) : s.compliance?.status ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-[#D4A24C]" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-muted-foreground/20" />
                        )}

                        {score != null && (
                          <span className={`text-[12px] font-semibold tabular-nums ${riskColor(score)}`}>
                            {score}
                          </span>
                        )}

                        <span className="text-[11px] text-muted-foreground/30 tabular-nums">
                          {format(new Date(s.createdAt), "MMM d")}
                        </span>

                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/15 group-hover:text-muted-foreground/40 transition-colors" />
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
    CANCELLED: "bg-[#E05252]/30",
  };
  return <span className={`w-2 h-2 rounded-full shrink-0 ${colors[status] || "bg-muted-foreground/30"}`} />;
}

function StatusLabel({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: "text-muted-foreground/50",
    PENDING_REVIEW: "text-[#D4A24C]",
    APPROVED: "text-primary",
    REJECTED: "text-[#E05252]",
    IN_TRANSIT: "text-primary",
    BOOKED: "text-primary/60",
    AT_PORT: "text-[#D4A24C]",
    CUSTOMS: "text-[#D4A24C]",
    DELIVERED: "text-muted-foreground/50",
    CLOSED: "text-muted-foreground/50",
    CANCELLED: "text-[#E05252]/50",
  };
  return (
    <span className={`text-[11px] font-semibold uppercase tracking-wide ${styles[status] || "text-muted-foreground/40"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
