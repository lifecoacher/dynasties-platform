import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  FileText,
  Search,
  Loader2,
  ArrowRight,
  Filter,
  ChevronLeft,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useBillingInvoices } from "@/hooks/use-billing";

function formatCurrency(val: number | string, currency = "USD") {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; dot: string }> = {
    DRAFT: { bg: "bg-zinc-500/10", text: "text-zinc-400", dot: "bg-zinc-400" },
    ISSUED: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
    SENT: { bg: "bg-sky-500/10", text: "text-sky-400", dot: "bg-sky-400" },
    PARTIALLY_PAID: { bg: "bg-amber-500/10", text: "text-amber-400", dot: "bg-amber-400" },
    PAID: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
    OVERDUE: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
    DISPUTED: { bg: "bg-orange-500/10", text: "text-orange-400", dot: "bg-orange-400" },
    CANCELLED: { bg: "bg-zinc-500/10", text: "text-zinc-500", dot: "bg-zinc-500" },
  };
  const s = map[status] || map.DRAFT;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status.replace(/_/g, " ")}
    </span>
  );
}

const TABS = [
  { label: "All", value: "" },
  { label: "Draft", value: "DRAFT" },
  { label: "Sent", value: "SENT" },
  { label: "Paid", value: "PAID" },
  { label: "Overdue", value: "OVERDUE" },
  { label: "Disputed", value: "DISPUTED" },
];

export default function BillingInvoices() {
  const [activeTab, setActiveTab] = useState("");
  const [search, setSearch] = useState("");
  const { data: invoices, isLoading } = useBillingInvoices(activeTab || undefined);

  const filtered = (invoices || []).filter((inv: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      inv.invoiceNumber?.toLowerCase().includes(q) ||
      inv.customer?.customerName?.toLowerCase().includes(q) ||
      inv.billToName?.toLowerCase().includes(q)
    );
  });

  return (
    <AppLayout hideRightPanel>
      <div className="px-8 py-8 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/billing">
            <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
          </Link>
          <div>
            <h1 className="text-[22px] font-semibold text-foreground">Invoices</h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              {(invoices || []).length} total invoices
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-6 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search invoices..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-card-border text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <div className="flex items-center bg-card border border-card-border rounded-lg p-1 gap-0.5">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                  activeTab === tab.value
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <FileText className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-[14px] text-muted-foreground">No invoices found</p>
          </div>
        ) : (
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="text-left px-5 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Invoice</th>
                  <th className="text-left px-5 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Customer</th>
                  <th className="text-left px-5 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                  <th className="text-left px-5 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Due Date</th>
                  <th className="text-left px-5 py-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Source</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                <AnimatePresence>
                  {filtered.map((inv: any, idx: number) => (
                    <motion.tr
                      key={inv.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.03 }}
                    >
                      <td className="px-5 py-3.5">
                        <Link href={`/billing/invoices/${inv.id}`}>
                          <span className="text-[13px] font-mono font-medium text-primary hover:text-primary/80 cursor-pointer">
                            {inv.invoiceNumber}
                          </span>
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[13px] text-foreground">
                          {inv.customer?.customerName || inv.billToName || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusPill status={inv.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-[13px] font-semibold text-foreground">
                          {formatCurrency(inv.grandTotal, inv.currency)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[12px] text-muted-foreground">
                          {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[11px] text-muted-foreground/70 bg-white/5 px-2 py-0.5 rounded">
                          {inv.invoiceSource || "MANUAL"}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <Link href={`/billing/invoices/${inv.id}`}>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 hover:text-primary cursor-pointer" />
                        </Link>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
