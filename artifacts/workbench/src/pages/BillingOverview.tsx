import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Clock,
  FileText,
  Users,
  Loader2,
  ArrowRight,
  CheckCircle2,
  XCircle,
  CreditCard,
  Receipt,
  Banknote,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  useReceivablesOverview,
  useBillingInvoices,
  useBillingCustomers,
  useBillingAccount,
} from "@/hooks/use-billing";

function formatCurrency(val: number | string, currency = "USD") {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}

function KpiCard({
  label,
  value,
  subtitle,
  icon: Icon,
  color,
  trend,
}: {
  label: string;
  value: string;
  subtitle?: string;
  icon: any;
  color: string;
  trend?: string;
}) {
  const colorMap: Record<string, string> = {
    teal: "bg-primary/10 text-primary",
    amber: "bg-amber-500/10 text-amber-400",
    red: "bg-red-500/10 text-red-400",
    blue: "bg-blue-500/10 text-blue-400",
    green: "bg-emerald-500/10 text-emerald-400",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-card-border rounded-xl p-5"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[color] || colorMap.teal}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
        {trend && (
          <span className="text-[11px] font-medium text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
            {trend}
          </span>
        )}
      </div>
      <p className="text-[24px] font-semibold text-foreground leading-tight">{value}</p>
      <p className="text-[12px] text-muted-foreground mt-1">{label}</p>
      {subtitle && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{subtitle}</p>}
    </motion.div>
  );
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
    FINANCED: { bg: "bg-primary/10", text: "text-primary", dot: "bg-primary" },
  };
  const s = map[status] || map.DRAFT;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function BillingOverview() {
  const { data: overview, isLoading: loadingOverview } = useReceivablesOverview();
  const { data: invoices, isLoading: loadingInvoices } = useBillingInvoices();
  const { data: customers } = useBillingCustomers();
  const { data: account } = useBillingAccount();

  const isLoading = loadingOverview || loadingInvoices;

  if (isLoading) {
    return (
      <AppLayout hideRightPanel>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const recentInvoices = (invoices || []).slice(0, 8);
  const totalInvoiced = (invoices || []).reduce((s: number, i: any) => s + Number(i.grandTotal || 0), 0);
  const paidInvoices = (invoices || []).filter((i: any) => i.status === "PAID");
  const overdueInvoices = (invoices || []).filter((i: any) => i.status === "OVERDUE");
  const disputedInvoices = (invoices || []).filter((i: any) => i.status === "DISPUTED");

  return (
    <AppLayout hideRightPanel>
      <div className="px-8 py-8 max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[22px] font-semibold text-foreground">Billing & Receivables</h1>
            <p className="text-[13px] text-muted-foreground mt-1">
              {account?.legalEntityName || "Revenue management"} — {(invoices || []).length} invoices
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/billing/customers">
              <button className="px-4 py-2 rounded-lg text-[13px] font-medium bg-card border border-card-border text-foreground hover:bg-white/[0.04] transition-colors">
                <Users className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                Customers
              </button>
            </Link>
            <Link href="/billing/invoices">
              <button className="px-4 py-2 rounded-lg text-[13px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                <FileText className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                All Invoices
              </button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <KpiCard
            label="Total Outstanding"
            value={formatCurrency(overview?.totalOutstanding || 0)}
            subtitle={`${overview?.receivableCount || 0} open receivables`}
            icon={DollarSign}
            color="teal"
          />
          <KpiCard
            label="Collected This Month"
            value={formatCurrency(overview?.paidThisMonth || 0)}
            subtitle={`${paidInvoices.length} invoices paid`}
            icon={TrendingUp}
            color="green"
            trend={paidInvoices.length > 0 ? `${paidInvoices.length} paid` : undefined}
          />
          <KpiCard
            label="Overdue"
            value={formatCurrency(overview?.totalOverdue || 0)}
            subtitle={`${overview?.countOverdue || 0} invoices past due`}
            icon={Clock}
            color="amber"
          />
          <KpiCard
            label="Disputed"
            value={formatCurrency(overview?.totalDisputed || 0)}
            subtitle={`${disputedInvoices.length} active disputes`}
            icon={AlertTriangle}
            color="red"
          />
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          <KpiCard
            label="Total Invoiced"
            value={formatCurrency(totalInvoiced)}
            icon={Receipt}
            color="blue"
          />
          <KpiCard
            label="Active Customers"
            value={String((customers || []).filter((c: any) => c.status === "ACTIVE").length)}
            icon={Users}
            color="teal"
          />
          <KpiCard
            label="Financed Amount"
            value={formatCurrency(overview?.totalFinanced || 0)}
            subtitle={`${overview?.financedCount || 0} records`}
            icon={Banknote}
            color="green"
          />
          <KpiCard
            label="Platform Revenue"
            value={formatCurrency(overview?.platformRevenue || 0)}
            subtitle={overview?.averageFinancingRate ? `${(overview.averageFinancingRate * 100).toFixed(1)}% avg rate` : "From financing spreads"}
            icon={TrendingUp}
            color="teal"
            trend={Number(overview?.platformRevenue || 0) > 0 ? "Earning" : undefined}
          />
        </div>

        {overview?.aging && (
          <div className="bg-card border border-card-border rounded-xl p-6 mb-8">
            <h3 className="text-[14px] font-semibold text-foreground mb-4">Aging Summary</h3>
            <div className="grid grid-cols-5 gap-4">
              {[
                { label: "Current", key: "current", color: "bg-emerald-500" },
                { label: "1–30 days", key: "days1to30", color: "bg-sky-500" },
                { label: "31–60 days", key: "days31to60", color: "bg-amber-500" },
                { label: "61–90 days", key: "days61to90", color: "bg-orange-500" },
                { label: "90+ days", key: "days90plus", color: "bg-red-500" },
              ].map((bucket) => {
                const val = Number(overview.aging[bucket.key] || 0);
                const total = Number(overview.totalOutstanding || 1);
                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                return (
                  <div key={bucket.key}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${bucket.color}`} />
                      <span className="text-[12px] text-muted-foreground">{bucket.label}</span>
                    </div>
                    <p className="text-[18px] font-semibold text-foreground">{formatCurrency(val)}</p>
                    <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${bucket.color}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">{pct}%</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-card-border">
            <h3 className="text-[14px] font-semibold text-foreground">Recent Invoices</h3>
            <Link href="/billing/invoices">
              <span className="text-[12px] text-primary hover:text-primary/80 cursor-pointer flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          </div>
          <div className="divide-y divide-card-border">
            {recentInvoices.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Receipt className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-[13px] text-muted-foreground">No invoices yet</p>
              </div>
            ) : (
              recentInvoices.map((inv: any) => (
                <Link key={inv.id} href={`/billing/invoices/${inv.id}`}>
                  <div className="flex items-center px-6 py-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="text-[13px] font-mono font-medium text-foreground">
                          {inv.invoiceNumber}
                        </span>
                        <StatusPill status={inv.status} />
                      </div>
                      <p className="text-[12px] text-muted-foreground mt-0.5 truncate">
                        {inv.customer?.customerName || inv.billToName || "—"}{" "}
                        {inv.shipmentId && <span className="text-muted-foreground/50">· Shipment linked</span>}
                      </p>
                    </div>
                    <div className="text-right pl-4">
                      <p className="text-[14px] font-semibold text-foreground">{formatCurrency(inv.grandTotal, inv.currency)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "No due date"}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground/30 ml-4" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
