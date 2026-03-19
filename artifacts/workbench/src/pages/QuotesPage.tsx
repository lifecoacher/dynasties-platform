import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  Plus,
  Search,
  Loader2,
  FileText,
  ArrowRight,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRightLeft,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListQuotes, useCreateQuote } from "@/hooks/use-quotes";
import { formatCurrency } from "@/lib/format";

type FilterTab = "ALL" | "DRAFT" | "SENT" | "ACCEPTED" | "CONVERTED" | "EXPIRED" | "REJECTED";

const TABS: { value: FilterTab; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "SENT", label: "Sent" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "CONVERTED", label: "Converted" },
];

const STATUS_CONFIG: Record<string, { color: string; icon: typeof FileText; bg: string }> = {
  DRAFT: { color: "text-gray-400", icon: FileText, bg: "bg-gray-500/10" },
  SENT: { color: "text-blue-400", icon: Send, bg: "bg-blue-500/10" },
  ACCEPTED: { color: "text-emerald-400", icon: CheckCircle2, bg: "bg-emerald-500/10" },
  EXPIRED: { color: "text-amber-400", icon: Clock, bg: "bg-amber-500/10" },
  CONVERTED: { color: "text-[#00BFA6]", icon: ArrowRightLeft, bg: "bg-[#00BFA6]/10" },
  REJECTED: { color: "text-red-400", icon: XCircle, bg: "bg-red-500/10" },
};

export default function QuotesPage() {
  const { data: response, isLoading } = useListQuotes();
  const createQuote = useCreateQuote();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [search, setSearch] = useState("");

  const quotes = (response?.data || []) as any[];

  const filtered = quotes.filter((q: any) => {
    const matchesTab = activeTab === "ALL" || q.status === activeTab;
    const matchesSearch =
      !search ||
      q.quoteNumber?.toLowerCase().includes(search.toLowerCase()) ||
      q.origin?.toLowerCase().includes(search.toLowerCase()) ||
      q.destination?.toLowerCase().includes(search.toLowerCase()) ||
      q.commodity?.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleCreate = async () => {
    try {
      const result = await createQuote.mutateAsync({});
      navigate(`/quotes/${result.data.id}`);
    } catch (e) {
      console.error("Failed to create quote", e);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-[1200px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[22px] font-semibold text-foreground tracking-tight">
              Quotes
            </h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Create, manage, and convert quotes to shipments
            </p>
          </div>
          <button
            onClick={handleCreate}
            disabled={createQuote.isPending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#00BFA6] text-white text-[13px] font-medium hover:bg-[#00BFA6]/90 transition-colors disabled:opacity-50"
          >
            {createQuote.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            New Quote
          </button>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-1 bg-[#0D1219] rounded-lg p-1">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                  activeTab === tab.value
                    ? "bg-[#1a2233] text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search quotes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0D1219] border border-[#1a2233] text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#00BFA6]/50"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#00BFA6]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-[14px] text-muted-foreground">No quotes found</p>
            <button
              onClick={handleCreate}
              className="mt-3 text-[13px] text-[#00BFA6] hover:underline"
            >
              Create your first quote
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {filtered.map((quote: any) => {
                const cfg = STATUS_CONFIG[quote.status] || STATUS_CONFIG.DRAFT;
                const Icon = cfg.icon;
                return (
                  <motion.div
                    key={quote.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <Link href={`/quotes/${quote.id}`}>
                      <div className="group flex items-center gap-4 p-4 rounded-xl bg-[#121821] border border-[#1a2233] hover:border-[#00BFA6]/30 transition-all cursor-pointer">
                        <div className={`p-2.5 rounded-lg ${cfg.bg}`}>
                          <Icon className={`w-4 h-4 ${cfg.color}`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-medium text-foreground">
                              {quote.quoteNumber}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${cfg.bg} ${cfg.color}`}
                            >
                              {quote.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            {quote.origin && (
                              <span className="text-[12px] text-muted-foreground">
                                {quote.origin}
                                {quote.destination && (
                                  <>
                                    {" "}
                                    <ArrowRight className="inline w-3 h-3" />{" "}
                                    {quote.destination}
                                  </>
                                )}
                              </span>
                            )}
                            {quote.commodity && (
                              <span className="text-[12px] text-muted-foreground/60">
                                {quote.commodity}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          {quote.quotedAmount && (
                            <span className="text-[14px] font-medium text-foreground">
                              {formatCurrency(parseFloat(quote.quotedAmount), quote.currency || "USD")}
                            </span>
                          )}
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {format(new Date(quote.createdAt), "MMM d, yyyy")}
                          </div>
                        </div>

                        {quote.convertedShipmentId && (
                          <div className="flex items-center gap-1 px-2 py-1 rounded bg-[#00BFA6]/10 text-[#00BFA6] text-[10px] font-medium">
                            <ArrowRightLeft className="w-3 h-3" />
                            Shipment
                          </div>
                        )}
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
