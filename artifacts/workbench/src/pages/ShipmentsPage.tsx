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
  Ship,
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
      <div className="px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[22px] font-bold text-foreground tracking-tight font-heading">Shipments</h1>
            <p className="text-[13px] text-muted-foreground mt-1">
              {shipments.length} total
            </p>
          </div>

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
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            {shipments.length === 0 ? (
              <>
                <p className="text-[15px] text-muted-foreground mb-1">No shipments yet</p>
                <p className="text-[13px] text-muted-foreground/60">Create your first shipment or import documents to get started.</p>
              </>
            ) : (
              <>
                <Filter className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-[13px] text-muted-foreground">No shipments match your filters</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-px">
            {filtered.map((s: any, i: number) => {
              const score = normalizeRiskScore(s.risk?.compositeScore);

              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                >
                  <Link href={`/shipments/${s.id}`}>
                    <div className="flex items-center gap-4 px-4 py-4 -mx-4 rounded-lg hover:bg-white/[0.02] transition-colors cursor-pointer group border-b border-white/[0.03] last:border-b-0">
                      <StatusIndicator status={s.status} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5">
                          <span className="text-[14px] font-semibold text-foreground font-mono">{s.reference}</span>
                          <StatusLabel status={s.status} />
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[12px] text-muted-foreground">
                          {s.shipper?.name || s.consignee?.name ? (
                            <>
                              <span className="truncate max-w-[180px]">{s.shipper?.name || "Pending"}</span>
                              <span className="text-primary/40">→</span>
                              <span className="truncate max-w-[180px]">{s.consignee?.name || "Pending"}</span>
                            </>
                          ) : (
                            <span className="text-muted-foreground/50 italic">Incomplete Shipment</span>
                          )}
                          {s.portOfLoading && (
                            <>
                              <span className="text-white/[0.06]">|</span>
                              <span className="text-muted-foreground/60">{formatPortCode(s.portOfLoading)} → {formatPortCode(s.portOfDischarge)}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        {s.compliance?.status === "CLEAR" ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary/50" />
                        ) : s.compliance?.status ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-[#D4A24C]" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-muted-foreground/30" />
                        )}

                        {score != null && (
                          <span className={`text-[12px] font-semibold tabular-nums ${riskColor(score)}`}>
                            {score}
                          </span>
                        )}

                        <span className="text-[11px] text-muted-foreground/50">
                          {format(new Date(s.createdAt), "MMM d")}
                        </span>

                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/20 group-hover:text-muted-foreground transition-colors" />
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
    CANCELLED: "bg-[#E05252]/40",
  };
  return <span className={`w-2 h-2 rounded-full shrink-0 ${colors[status] || "bg-muted-foreground/40"}`} />;
}

function StatusLabel({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: "text-muted-foreground/60",
    PENDING_REVIEW: "text-[#D4A24C]",
    APPROVED: "text-primary",
    REJECTED: "text-[#E05252]",
    IN_TRANSIT: "text-primary",
    BOOKED: "text-primary/80",
    AT_PORT: "text-[#D4A24C]",
    CUSTOMS: "text-[#D4A24C]",
    DELIVERED: "text-muted-foreground/60",
    CLOSED: "text-muted-foreground/60",
    CANCELLED: "text-[#E05252]/70",
  };
  return (
    <span className={`text-[11px] font-medium ${styles[status] || "text-muted-foreground/60"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
