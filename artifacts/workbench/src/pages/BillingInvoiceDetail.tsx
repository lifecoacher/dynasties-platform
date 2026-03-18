import { useState } from "react";
import { useRoute, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  FileText,
  Loader2,
  Send,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  DollarSign,
  CreditCard,
  Banknote,
  History,
  Zap,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useBillingInvoice, useBillingAction } from "@/hooks/use-billing";

function formatCurrency(val: number | string, currency = "USD") {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; icon: any }> = {
    DRAFT: { bg: "bg-zinc-500/10 border-zinc-500/20", text: "text-zinc-400", icon: FileText },
    ISSUED: { bg: "bg-blue-500/10 border-blue-500/20", text: "text-blue-400", icon: FileText },
    SENT: { bg: "bg-sky-500/10 border-sky-500/20", text: "text-sky-400", icon: Send },
    PARTIALLY_PAID: { bg: "bg-amber-500/10 border-amber-500/20", text: "text-amber-400", icon: DollarSign },
    PAID: { bg: "bg-emerald-500/10 border-emerald-500/20", text: "text-emerald-400", icon: CheckCircle2 },
    OVERDUE: { bg: "bg-red-500/10 border-red-500/20", text: "text-red-400", icon: Clock },
    DISPUTED: { bg: "bg-orange-500/10 border-orange-500/20", text: "text-orange-400", icon: AlertTriangle },
    CANCELLED: { bg: "bg-zinc-500/10 border-zinc-500/20", text: "text-zinc-500", icon: XCircle },
    FINANCED: { bg: "bg-emerald-500/10 border-emerald-500/20", text: "text-emerald-400", icon: Banknote },
  };
  const s = map[status] || map.DRAFT;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium border ${s.bg} ${s.text}`}>
      <Icon className="w-4 h-4" />
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function BillingInvoiceDetail() {
  const [, params] = useRoute("/billing/invoices/:id");
  const invoiceId = params?.id || "";
  const { data: invoice, isLoading, refetch } = useBillingInvoice(invoiceId);
  const action = useBillingAction();
  const [acting, setActing] = useState<string | null>(null);

  const handleAction = async (path: string, body?: any) => {
    setActing(path);
    try {
      await action(`invoices/${invoiceId}/${path}`, "POST", body);
      refetch();
    } catch (e: any) {
      console.error(e);
    } finally {
      setActing(null);
    }
  };

  const handleAcceptFinancing = async () => {
    setActing("accept-financing");
    try {
      if (invoice.financeStatus === "NONE") {
        await action(`invoices/${invoiceId}/offer-financing`, "POST");
      }
      await action(`invoices/${invoiceId}/accept-financing`, "POST");
      refetch();
    } catch (e: any) {
      console.error(e);
    } finally {
      setActing(null);
    }
  };

  const handleFundFinancing = async () => {
    setActing("fund-financing");
    try {
      await action(`invoices/${invoiceId}/fund-financing`, "POST");
      refetch();
    } catch (e: any) {
      console.error(e);
    } finally {
      setActing(null);
    }
  };

  if (isLoading || !invoice) {
    return (
      <AppLayout hideRightPanel>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const lineItems = invoice.lineItemsDetail || [];
  const events = invoice.auditTrail || [];
  const receivable = invoice.receivable;
  const financing = invoice.financing;
  const customer = invoice.customer;
  const terms = invoice.financingTerms;
  const isAccepted = invoice.financeStatus === "ACCEPTED";
  const isFinanced = invoice.status === "FINANCED" || invoice.financeStatus === "FUNDED";
  const isRepaid = invoice.financeStatus === "REPAID";
  const showFinancingPanel = terms && terms.eligible && !isAccepted && !isFinanced && !isRepaid;

  const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
  const now = new Date();
  const daysOverdue = dueDate && invoice.status === "OVERDUE"
    ? Math.floor((now.getTime() - dueDate.getTime()) / 86400000)
    : 0;

  return (
    <AppLayout hideRightPanel>
      <div className="px-8 py-8 max-w-[1200px] mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/billing/invoices">
            <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <h1 className="text-[22px] font-mono font-semibold text-foreground">{invoice.invoiceNumber}</h1>
              <StatusBadge status={invoice.status} />
              {daysOverdue > 0 && (
                <span className="text-[12px] font-medium text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full">
                  {daysOverdue} {daysOverdue === 1 ? "day" : "days"} overdue
                </span>
              )}
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Created {new Date(invoice.createdAt).toLocaleDateString()}
              {invoice.shipmentId && " · Linked to shipment"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {["DRAFT", "ISSUED"].includes(invoice.status) && (
              <button
                onClick={() => handleAction("send")}
                disabled={!!acting}
                className="px-4 py-2 rounded-lg text-[13px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {acting === "send" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 inline mr-1.5 -mt-0.5" />Send Invoice</>}
              </button>
            )}
            {["SENT", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status) && !showFinancingPanel && !isAccepted && (
              <button
                onClick={() => handleAction("mark-paid")}
                disabled={!!acting}
                className="px-4 py-2 rounded-lg text-[13px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
              >
                {acting === "mark-paid" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 inline mr-1.5 -mt-0.5" />Mark Paid</>}
              </button>
            )}
            {["SENT", "PARTIALLY_PAID"].includes(invoice.status) && (
              <button
                onClick={() => handleAction("dispute", { reason: "Customer dispute" })}
                disabled={!!acting}
                className="px-4 py-2 rounded-lg text-[13px] font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-colors disabled:opacity-50"
              >
                <AlertTriangle className="w-4 h-4 inline mr-1.5 -mt-0.5" />Dispute
              </button>
            )}
            {["DRAFT", "ISSUED"].includes(invoice.status) && (
              <button
                onClick={() => handleAction("cancel")}
                disabled={!!acting}
                className="px-4 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            )}
            {invoice.status === "DISPUTED" && (
              <button
                onClick={() => handleAction("resolve-dispute")}
                disabled={!!acting}
                className="px-4 py-2 rounded-lg text-[13px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
              >
                {acting === "resolve-dispute" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4 inline mr-1.5 -mt-0.5" />Resolve Dispute</>}
              </button>
            )}
            {isFinanced && !isRepaid && (
              <button
                onClick={() => handleAction("mark-repaid")}
                disabled={!!acting}
                className="px-4 py-2 rounded-lg text-[13px] font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                {acting === "mark-repaid" ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ShieldCheck className="w-4 h-4 inline mr-1.5 -mt-0.5" />Mark Repaid</>}
              </button>
            )}
            <button
              onClick={() => { if (window.confirm("Reset this invoice to its original state? This clears all financing, dispute, and payment data added during this demo session.")) handleAction("demo-reset"); }}
              disabled={!!acting}
              className="px-3 py-2 rounded-lg text-[11px] font-medium text-zinc-500 hover:text-zinc-300 hover:bg-zinc-500/10 border border-transparent hover:border-zinc-500/20 transition-colors disabled:opacity-50"
              title="Reset invoice to original state for demo"
            >
              {acting === "demo-reset" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><RotateCcw className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />Reset (Demo)</>}
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {showFinancingPanel && (
            <motion.div
              key="financing-offer"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              className="mb-8 bg-gradient-to-br from-primary/[0.08] via-primary/[0.04] to-transparent border-2 border-primary/30 rounded-2xl p-8 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/[0.03] rounded-full -translate-y-1/2 translate-x-1/3" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-[20px] font-bold text-foreground">
                      {invoice.financeStatus === "OFFERED" ? "Accept Financing" : "Get Paid Now"}
                    </h3>
                    <p className="text-[13px] text-muted-foreground">
                      {invoice.financeStatus === "OFFERED"
                        ? "A financing offer is available — accept to receive funds instantly"
                        : "Receive funds instantly instead of waiting for payment"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-6 mb-8">
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Outstanding</p>
                    <p className="text-[22px] font-bold text-foreground">{formatCurrency(terms.outstandingAmount)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">You Receive</p>
                    <p className="text-[22px] font-bold text-emerald-400">{formatCurrency(terms.advanceAmount)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Financing Fee</p>
                    <p className="text-[18px] font-semibold text-foreground">{formatCurrency(terms.financingFee)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Rate</p>
                    <p className="text-[18px] font-semibold text-foreground">{(terms.customerRate * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Time to Funds</p>
                    <p className="text-[18px] font-semibold text-primary">Instant</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={handleAcceptFinancing}
                    disabled={!!acting}
                    className="px-8 py-3.5 rounded-xl text-[15px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-primary/20"
                  >
                    {acting === "accept-financing" ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        {invoice.financeStatus === "OFFERED" ? "Accept Financing" : "Get Paid Now"}
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleAction("mark-paid")}
                    disabled={!!acting}
                    className="px-6 py-3.5 rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors disabled:opacity-50"
                  >
                    Pay Manually Instead
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {isAccepted && (
            <motion.div
              key="financing-accepted"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="mb-8 bg-gradient-to-br from-amber-500/[0.08] via-amber-500/[0.03] to-transparent border-2 border-amber-500/30 rounded-2xl p-8"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-[20px] font-bold text-amber-400">Financing Accepted</h3>
                  <p className="text-[13px] text-muted-foreground">Awaiting funds disbursement from provider</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-6 mb-4">
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Amount to Receive</p>
                  <p className="text-[20px] font-bold text-amber-400">{formatCurrency(financing?.financedAmount || 0)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Financing Fee</p>
                  <p className="text-[16px] font-semibold text-foreground">{formatCurrency(financing?.clientFacingFeeAmount || 0)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Provider</p>
                  <p className="text-[16px] font-semibold text-foreground capitalize">{financing?.providerName || "Balance"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                  <p className="text-[16px] font-semibold text-amber-400">Pending Disbursement</p>
                </div>
              </div>
              <p className="text-[13px] text-muted-foreground mb-5">
                Click 'Disburse Funds' to transfer {formatCurrency(financing?.financedAmount || 0)} to your account.
              </p>
              <button
                onClick={handleFundFinancing}
                disabled={!!acting}
                className="px-8 py-3.5 rounded-xl text-[15px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-primary/20"
              >
                {acting === "fund-financing" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>Disburse Funds<ArrowRight className="w-5 h-5" /></>
                )}
              </button>
            </motion.div>
          )}

          {isFinanced && (
            <motion.div
              key="financing-complete"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="mb-8 bg-gradient-to-br from-emerald-500/[0.08] via-emerald-500/[0.03] to-transparent border-2 border-emerald-500/30 rounded-2xl p-8"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-[20px] font-bold text-emerald-400">
                    {isRepaid ? "Financing Complete" : "Receivable Sold — Financed"}
                  </h3>
                  <p className="text-[13px] text-muted-foreground">
                    {isRepaid ? "Financing has been fully repaid" : "Receivable transferred to financing provider — funds disbursed"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-6">
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Amount Advanced</p>
                  <p className="text-[20px] font-bold text-emerald-400">{formatCurrency(financing?.financedAmount || 0)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Financing Fee</p>
                  <p className="text-[16px] font-semibold text-foreground">{formatCurrency(invoice.financeFee)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Platform Earned</p>
                  <p className="text-[16px] font-semibold text-primary">{formatCurrency(invoice.dynastiesSpread)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                  <p className={`text-[16px] font-semibold ${isRepaid ? "text-primary" : "text-emerald-400"}`}>
                    {isRepaid ? "Repaid" : "Sold / Funded"}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-card-border rounded-xl p-5"
          >
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-3">Amount</p>
            <p className="text-[28px] font-bold text-foreground">{formatCurrency(invoice.grandTotal, invoice.currency)}</p>
            <div className="mt-3 space-y-1.5 text-[12px]">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              {Number(invoice.taxTotal) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax</span>
                  <span>{formatCurrency(invoice.taxTotal)}</span>
                </div>
              )}
              {Number(invoice.financeFee) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Finance Fee</span>
                  <span>{formatCurrency(invoice.financeFee)}</span>
                </div>
              )}
              {Number(invoice.dynastiesSpread) > 0 && (
                <div className="flex justify-between text-primary">
                  <span>Platform Earned</span>
                  <span>{formatCurrency(invoice.dynastiesSpread)}</span>
                </div>
              )}
              {Number(invoice.discountTotal) > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Discount</span>
                  <span>-{formatCurrency(invoice.discountTotal)}</span>
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card border border-card-border rounded-xl p-5"
          >
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-3">Customer</p>
            {customer ? (
              <div>
                <p className="text-[15px] font-semibold text-foreground">{customer.customerName}</p>
                <p className="text-[12px] text-muted-foreground mt-1">{customer.billingEmail}</p>
                {customer.billingAddress && (
                  <p className="text-[12px] text-muted-foreground">{customer.billingAddress}</p>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                    customer.riskStatus === "LOW" ? "bg-emerald-500/10 text-emerald-400" :
                    customer.riskStatus === "MEDIUM" ? "bg-amber-500/10 text-amber-400" :
                    "bg-red-500/10 text-red-400"
                  }`}>
                    {customer.riskStatus} Risk
                  </span>
                  <span className="text-[11px] text-muted-foreground">{customer.paymentTerms}</span>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-[15px] font-semibold text-foreground">{invoice.billToName || "—"}</p>
                <p className="text-[12px] text-muted-foreground mt-1">{invoice.billToEmail || "No email"}</p>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card border border-card-border rounded-xl p-5"
          >
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-3">Details</p>
            <div className="space-y-2.5 text-[12px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Terms</span>
                <span className="text-foreground font-medium">{invoice.paymentTerms || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date</span>
                <span className={`font-medium ${daysOverdue > 0 ? "text-red-400" : "text-foreground"}`}>
                  {dueDate ? dueDate.toLocaleDateString() : "—"}
                  {daysOverdue > 0 && ` (${daysOverdue}d overdue)`}
                </span>
              </div>
              {invoice.financeStatus !== "NONE" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Finance Status</span>
                  <span className="text-primary font-medium">{invoice.financeStatus}</span>
                </div>
              )}
              {invoice.paidAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{isFinanced ? "Financed On" : "Paid On"}</span>
                  <span className="text-emerald-400 font-medium">{new Date(invoice.paidAt).toLocaleDateString()}</span>
                </div>
              )}
              {invoice.financeEligible && !isFinanced && !isRepaid && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Finance Eligible</span>
                  <span className="text-primary font-medium">Yes</span>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {lineItems.length > 0 && (
          <div className="bg-card border border-card-border rounded-xl overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-card-border">
              <h3 className="text-[14px] font-semibold text-foreground">Line Items</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="text-left px-5 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Description</th>
                  <th className="text-left px-5 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                  <th className="text-right px-5 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Qty</th>
                  <th className="text-right px-5 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Unit Price</th>
                  <th className="text-right px-5 py-2.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {lineItems.map((li: any, idx: number) => (
                  <tr key={li.id || idx}>
                    <td className="px-5 py-3 text-[13px] text-foreground">{li.description}</td>
                    <td className="px-5 py-3">
                      <span className="text-[11px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded">{li.lineType}</span>
                    </td>
                    <td className="px-5 py-3 text-right text-[13px] text-muted-foreground">{li.quantity}</td>
                    <td className="px-5 py-3 text-right text-[13px] text-muted-foreground">{formatCurrency(li.unitPrice)}</td>
                    <td className="px-5 py-3 text-right text-[13px] font-semibold text-foreground">{formatCurrency(li.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {receivable && (
          <div className={`border rounded-xl p-6 mb-8 ${receivable.receivableTransferred ? "bg-primary/[0.04] border-primary/20" : "bg-card border-card-border"}`}>
            <h3 className="text-[14px] font-semibold text-foreground mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              Receivable
              {receivable.receivableTransferred && (
                <span className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full ml-2">Transferred</span>
              )}
            </h3>
            <div className={`grid ${receivable.receivableTransferred ? "grid-cols-5" : "grid-cols-4"} gap-6`}>
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Original Amount</p>
                <p className="text-[16px] font-semibold text-foreground">{formatCurrency(receivable.originalAmount)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Outstanding</p>
                <p className={`text-[16px] font-semibold ${receivable.receivableTransferred ? "text-primary" : Number(receivable.outstandingAmount) > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                  {formatCurrency(receivable.outstandingAmount)}{receivable.receivableTransferred && <span className="text-[11px] font-normal text-muted-foreground ml-1.5">— Transferred to Provider</span>}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Collections</p>
                <p className={`text-[13px] font-medium ${receivable.collectionsStatus === "FINANCED" ? "text-primary" : "text-foreground"}`}>
                  {receivable.collectionsStatus === "FINANCED" ? "Financed / Sold" : receivable.collectionsStatus}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Settlement</p>
                <p className="text-[13px] font-medium text-foreground">{receivable.settlementStatus}</p>
              </div>
              {receivable.receivableTransferred && (
                <div>
                  <p className="text-[11px] text-muted-foreground mb-1">Transfer Status</p>
                  <p className="text-[13px] font-medium text-primary">Transferred to Provider</p>
                </div>
              )}
            </div>
          </div>
        )}

        {events.length > 0 && (
          <div className="bg-card border border-card-border rounded-xl p-6">
            <h3 className="text-[14px] font-semibold text-foreground mb-4 flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" />
              Audit Trail
            </h3>
            <div className="space-y-3">
              {events.map((ev: any) => (
                <div key={ev.id} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary/50 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-foreground">{ev.description || ev.eventType.replace(/_/g, " ")}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(ev.createdAt).toLocaleString()}
                      {ev.actorType === "USER" && " · User action"}
                    </p>
                  </div>
                  {ev.amount && (
                    <span className="text-[12px] font-mono text-muted-foreground">{formatCurrency(ev.amount)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
