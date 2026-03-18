import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useRoute } from "wouter";
import {
  Users,
  Search,
  Loader2,
  ArrowRight,
  ChevronLeft,
  Building2,
  Mail,
  CreditCard,
  AlertTriangle,
  DollarSign,
  FileText,
  Shield,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useBillingCustomers, useBillingCustomer } from "@/hooks/use-billing";

function formatCurrency(val: number | string, currency = "USD") {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}

function RiskBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    LOW: "bg-emerald-500/10 text-emerald-400",
    MEDIUM: "bg-amber-500/10 text-amber-400",
    HIGH: "bg-red-500/10 text-red-400",
    CRITICAL: "bg-red-500/20 text-red-300",
    HOLD: "bg-zinc-500/10 text-zinc-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${map[status] || map.LOW}`}>
      {status}
    </span>
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
  };
  const s = map[status] || map.DRAFT;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status.replace(/_/g, " ")}
    </span>
  );
}

function CustomersList() {
  const { data: customers, isLoading } = useBillingCustomers();
  const [search, setSearch] = useState("");

  const filtered = (customers || []).filter((c: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.customerName?.toLowerCase().includes(q) || c.billingEmail?.toLowerCase().includes(q);
  });

  return (
    <div className="px-8 py-8 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/billing">
          <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </Link>
        <div>
          <h1 className="text-[22px] font-semibold text-foreground">Billing Customers</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            {(customers || []).length} customer profiles
          </p>
        </div>
      </div>

      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search customers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-card-border text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Users className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-[14px] text-muted-foreground">No billing customers found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filtered.map((c: any, idx: number) => (
            <Link key={c.id} href={`/billing/customers/${c.id}`}>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-card border border-card-border rounded-xl p-5 hover:border-primary/30 transition-colors cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-[15px] font-semibold text-foreground group-hover:text-primary transition-colors">
                      {c.customerName}
                    </p>
                    <p className="text-[12px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3" />
                      {c.billingEmail}
                    </p>
                  </div>
                  <RiskBadge status={c.riskStatus} />
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Exposure</p>
                    <p className="text-[14px] font-semibold text-foreground">{formatCurrency(c.currentExposure)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Credit Limit</p>
                    <p className="text-[14px] font-semibold text-foreground">{c.creditLimit ? formatCurrency(c.creditLimit) : "—"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Terms</p>
                    <p className="text-[14px] font-medium text-foreground">{c.paymentTerms}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                    c.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-500/10 text-zinc-400"
                  }`}>
                    {c.status}
                  </span>
                  {c.balanceEligibility === "ELIGIBLE" && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      Finance Eligible
                    </span>
                  )}
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CustomerDetail() {
  const [, params] = useRoute("/billing/customers/:id");
  const customerId = params?.id || "";
  const { data: customer, isLoading } = useBillingCustomer(customerId);

  if (isLoading || !customer) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const invoices = customer.invoices || [];
  const receivables = customer.receivables || [];
  const totalOutstanding = receivables.reduce((s: number, r: any) => s + Number(r.outstandingAmount || 0), 0);

  return (
    <div className="px-8 py-8 max-w-[1200px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/billing/customers">
          <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </Link>
        <div className="flex-1">
          <h1 className="text-[22px] font-semibold text-foreground">{customer.customerName}</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">{customer.billingEmail}</p>
        </div>
        <RiskBadge status={customer.riskStatus} />
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-card-border rounded-xl p-5">
          <DollarSign className="w-4 h-4 text-primary mb-2" />
          <p className="text-[18px] font-semibold text-foreground">{formatCurrency(customer.currentExposure)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Current Exposure</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card border border-card-border rounded-xl p-5">
          <Shield className="w-4 h-4 text-amber-400 mb-2" />
          <p className="text-[18px] font-semibold text-foreground">{customer.creditLimit ? formatCurrency(customer.creditLimit) : "No limit"}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Credit Limit</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-card-border rounded-xl p-5">
          <AlertTriangle className="w-4 h-4 text-amber-400 mb-2" />
          <p className="text-[18px] font-semibold text-foreground">{formatCurrency(totalOutstanding)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Outstanding</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card border border-card-border rounded-xl p-5">
          <FileText className="w-4 h-4 text-sky-400 mb-2" />
          <p className="text-[18px] font-semibold text-foreground">{invoices.length}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Total Invoices</p>
        </motion.div>
      </div>

      <div className="bg-card border border-card-border rounded-xl p-6 mb-8">
        <h3 className="text-[14px] font-semibold text-foreground mb-4">Profile Details</h3>
        <div className="grid grid-cols-3 gap-6 text-[12px]">
          <div>
            <p className="text-muted-foreground mb-1">Address</p>
            <p className="text-foreground">{customer.billingAddress || "—"}</p>
            <p className="text-foreground">{[customer.billingCity, customer.billingCountry].filter(Boolean).join(", ") || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Payment Terms</p>
            <p className="text-foreground font-medium">{customer.paymentTerms}</p>
            <p className="text-muted-foreground mt-2 mb-1">Preferred Method</p>
            <p className="text-foreground font-medium">{customer.preferredPaymentMethod || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Balance Eligibility</p>
            <p className={`font-medium ${customer.balanceEligibility === "ELIGIBLE" ? "text-primary" : "text-muted-foreground"}`}>
              {customer.balanceEligibility}
            </p>
            {customer.notes && (
              <>
                <p className="text-muted-foreground mt-2 mb-1">Notes</p>
                <p className="text-foreground">{customer.notes}</p>
              </>
            )}
          </div>
        </div>
      </div>

      {invoices.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-card-border">
            <h3 className="text-[14px] font-semibold text-foreground">Invoices</h3>
          </div>
          <div className="divide-y divide-card-border">
            {invoices.map((inv: any) => (
              <Link key={inv.id} href={`/billing/invoices/${inv.id}`}>
                <div className="flex items-center px-6 py-3.5 hover:bg-white/[0.02] transition-colors cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="text-[13px] font-mono font-medium text-primary">{inv.invoiceNumber}</span>
                      <StatusPill status={inv.status} />
                    </div>
                  </div>
                  <div className="text-right pl-4">
                    <p className="text-[14px] font-semibold text-foreground">{formatCurrency(inv.grandTotal)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "No due date"}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/30 ml-4" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BillingCustomers() {
  const [isDetail] = useRoute("/billing/customers/:id");

  return (
    <AppLayout hideRightPanel>
      {isDetail ? <CustomerDetail /> : <CustomersList />}
    </AppLayout>
  );
}
