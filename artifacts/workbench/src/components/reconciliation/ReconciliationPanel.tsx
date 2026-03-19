import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuthToken } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  Scale,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Plus,
  ChevronDown,
  ChevronUp,
  DollarSign,
  FileText,
  ArrowUpDown,
  AlertCircle,
} from "lucide-react";

const BASE = `${import.meta.env.BASE_URL}api`;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  MATCHED: {
    label: "Matched",
    color: "text-primary",
    bg: "bg-primary/10 border-primary/20",
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  MINOR_VARIANCE: {
    label: "Minor Variance",
    color: "text-[#D4A24C]",
    bg: "bg-[#D4A24C]/10 border-[#D4A24C]/20",
    icon: <AlertTriangle className="w-4 h-4" />,
  },
  MAJOR_VARIANCE: {
    label: "Major Variance",
    color: "text-[#E05252]",
    bg: "bg-[#E05252]/10 border-[#E05252]/20",
    icon: <AlertCircle className="w-4 h-4" />,
  },
  UNMATCHED: {
    label: "Unmatched",
    color: "text-muted-foreground",
    bg: "bg-muted/50 border-card-border",
    icon: <XCircle className="w-4 h-4" />,
  },
};

interface ReconciliationPanelProps {
  shipmentId: string;
}

export function ReconciliationPanel({ shipmentId }: ReconciliationPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [showLineItems, setShowLineItems] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const qc = useQueryClient();

  const [form, setForm] = useState({
    carrierName: "",
    invoiceNumber: "",
    invoiceDate: "",
    totalAmount: "",
    currency: "USD",
    lineItems: [{ code: "", description: "", amount: "" }],
  });

  const { data: summaryRes, isLoading } = useQuery({
    queryKey: [`/api/shipments/${shipmentId}/financial-summary`],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch(`${BASE}/shipments/${shipmentId}/financial-summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { data: null };
      return res.json();
    },
    enabled: !!shipmentId,
  });

  const summary = summaryRes?.data;

  const handleSubmitInvoice = async () => {
    if (!form.carrierName || !form.invoiceNumber || !form.totalAmount) return;
    setSubmitting(true);
    try {
      const token = getAuthToken();
      const lineItems = form.lineItems
        .filter((li) => li.code && li.amount)
        .map((li) => ({
          code: li.code,
          description: li.description || li.code,
          amount: parseFloat(li.amount),
        }));

      await fetch(`${BASE}/shipments/${shipmentId}/carrier-invoices`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          carrierName: form.carrierName,
          invoiceNumber: form.invoiceNumber,
          invoiceDate: form.invoiceDate || new Date().toISOString(),
          totalAmount: form.totalAmount,
          currency: form.currency,
          lineItems,
        }),
      });

      qc.invalidateQueries({ queryKey: [`/api/shipments/${shipmentId}/financial-summary`] });
      qc.invalidateQueries({ queryKey: [`/api/shipments/${shipmentId}/events`] });
      setShowForm(false);
      setForm({
        carrierName: "",
        invoiceNumber: "",
        invoiceDate: "",
        totalAmount: "",
        currency: "USD",
        lineItems: [{ code: "", description: "", amount: "" }],
      });
    } catch (err) {
      console.error("Invoice submission error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReconcile = async () => {
    setReconciling(true);
    try {
      const token = getAuthToken();
      await fetch(`${BASE}/shipments/${shipmentId}/reconcile`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      qc.invalidateQueries({ queryKey: [`/api/shipments/${shipmentId}/financial-summary`] });
      qc.invalidateQueries({ queryKey: [`/api/shipments/${shipmentId}/events`] });
    } catch (err) {
      console.error("Reconciliation error:", err);
    } finally {
      setReconciling(false);
    }
  };

  const addLineItem = () => {
    setForm((f) => ({
      ...f,
      lineItems: [...f.lineItems, { code: "", description: "", amount: "" }],
    }));
  };

  if (isLoading) {
    return (
      <div className="p-5 rounded-xl bg-card border border-card-border">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-[12px]">Loading financial data...</span>
        </div>
      </div>
    );
  }

  const recon = summary?.latestReconciliation;
  const statusCfg = recon ? STATUS_CONFIG[recon.status] || STATUS_CONFIG.UNMATCHED : null;
  const discrepancy = recon?.discrepancyDetails;

  return (
    <div className="p-5 rounded-xl bg-card border border-card-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
          <Scale className="w-4 h-4 text-primary" />
          Reconciliation Engine
        </h3>
        <div className="flex items-center gap-2">
          {summary?.carrierInvoiceCount > 0 && (
            <button
              onClick={handleReconcile}
              disabled={reconciling}
              className="px-2.5 py-1 text-[10px] font-medium rounded flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
            >
              {reconciling ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowUpDown className="w-3 h-3" />}
              Reconcile
            </button>
          )}
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-2.5 py-1 text-[10px] font-medium rounded flex items-center gap-1 bg-muted text-muted-foreground border border-card-border hover:text-foreground transition-colors"
          >
            <Plus className="w-3 h-3" />
            Carrier Invoice
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-muted/30 border border-card-border">
          <p className="text-[9px] font-bold uppercase text-muted-foreground mb-1">Expected</p>
          <p className="text-[16px] font-bold text-foreground">
            ${(summary?.expectedTotal || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[9px] text-muted-foreground">
            {summary?.chargeBreakdown?.length || 0} charge{summary?.chargeBreakdown?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-muted/30 border border-card-border">
          <p className="text-[9px] font-bold uppercase text-muted-foreground mb-1">Actual</p>
          <p className="text-[16px] font-bold text-foreground">
            ${(summary?.actualTotal || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[9px] text-muted-foreground">
            {summary?.carrierInvoiceCount || 0} carrier invoice{summary?.carrierInvoiceCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div className={`p-3 rounded-lg border ${statusCfg ? statusCfg.bg : "bg-muted/30 border-card-border"}`}>
          <p className="text-[9px] font-bold uppercase text-muted-foreground mb-1">Variance</p>
          {recon ? (
            <>
              <div className="flex items-center gap-1">
                {recon.varianceAmount > 0 ? (
                  <TrendingUp className="w-3.5 h-3.5 text-[#E05252]" />
                ) : recon.varianceAmount < 0 ? (
                  <TrendingDown className="w-3.5 h-3.5 text-primary" />
                ) : null}
                <p className={`text-[16px] font-bold ${statusCfg?.color || "text-foreground"}`}>
                  {recon.variancePercentage >= 0 ? "+" : ""}{recon.variancePercentage}%
                </p>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`${statusCfg?.color}`}>{statusCfg?.icon}</span>
                <span className={`text-[9px] font-bold ${statusCfg?.color}`}>{statusCfg?.label}</span>
              </div>
            </>
          ) : (
            <p className="text-[12px] text-muted-foreground">No data</p>
          )}
        </div>
      </div>

      {recon && discrepancy && (
        <div className="mb-4">
          <button
            onClick={() => setShowLineItems(!showLineItems)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            {showLineItems ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Line-item breakdown
          </button>

          <AnimatePresence>
            {showLineItems && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-1.5 mb-2">
                  {discrepancy.lineItemVariances?.map((v: any, i: number) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded text-[11px] ${
                        Math.abs(v.variancePercent) > 5
                          ? "bg-[#E05252]/5 border border-[#E05252]/10"
                          : Math.abs(v.variancePercent) > 2
                            ? "bg-[#D4A24C]/5 border border-[#D4A24C]/10"
                            : "bg-muted/20 border border-card-border"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground">{v.chargeCode}</span>
                        <span className="text-foreground">{v.description}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px]">
                        <span className="text-muted-foreground">${v.expectedAmount.toFixed(2)}</span>
                        <span className="text-foreground font-medium">${v.actualAmount.toFixed(2)}</span>
                        <span
                          className={`font-bold ${
                            v.variance > 0 ? "text-[#E05252]" : v.variance < 0 ? "text-primary" : "text-muted-foreground"
                          }`}
                        >
                          {v.variance >= 0 ? "+" : ""}{v.variance.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {discrepancy.missingCharges?.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[10px] font-bold text-[#D4A24C] mb-1">Missing from Carrier Invoice</p>
                    {discrepancy.missingCharges.map((m: any, i: number) => (
                      <div key={i} className="flex items-center justify-between px-2.5 py-1 rounded bg-[#D4A24C]/5 border border-[#D4A24C]/10 text-[10px] mb-1">
                        <span className="text-foreground">{m.description}</span>
                        <span className="text-muted-foreground">${m.expectedAmount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {discrepancy.unexpectedCharges?.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[10px] font-bold text-[#E05252] mb-1">Unexpected Charges</p>
                    {discrepancy.unexpectedCharges.map((u: any, i: number) => (
                      <div key={i} className="flex items-center justify-between px-2.5 py-1 rounded bg-[#E05252]/5 border border-[#E05252]/10 text-[10px] mb-1">
                        <span className="text-foreground">{u.description}</span>
                        <span className="text-[#E05252] font-medium">+${u.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {discrepancy.summary && (
                  <p className="text-[10px] text-muted-foreground italic px-1">{discrepancy.summary}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {summary?.carrierInvoices?.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Carrier Invoices</p>
          <div className="space-y-1.5">
            {summary.carrierInvoices.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-muted/20 border border-card-border">
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-[11px] font-medium text-foreground">{inv.carrierName}</p>
                    <p className="text-[10px] text-muted-foreground">#{inv.invoiceNumber}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[12px] font-bold text-foreground">
                    ${inv.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    {inv.matchMethod === "EXACT" ? "Exact match" : inv.matchMethod === "FUZZY" ? "Fuzzy match" : inv.matchMethod}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 rounded-lg bg-muted/20 border border-card-border space-y-2">
              <p className="text-[11px] font-semibold text-foreground">Ingest Carrier Invoice</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  placeholder="Carrier Name"
                  value={form.carrierName}
                  onChange={(e) => setForm((f) => ({ ...f, carrierName: e.target.value }))}
                  className="px-2 py-1.5 rounded bg-background border border-card-border text-[11px] text-foreground placeholder:text-muted-foreground/50"
                />
                <input
                  placeholder="Invoice Number"
                  value={form.invoiceNumber}
                  onChange={(e) => setForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
                  className="px-2 py-1.5 rounded bg-background border border-card-border text-[11px] text-foreground placeholder:text-muted-foreground/50"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="date"
                  value={form.invoiceDate}
                  onChange={(e) => setForm((f) => ({ ...f, invoiceDate: e.target.value }))}
                  className="px-2 py-1.5 rounded bg-background border border-card-border text-[11px] text-foreground"
                />
                <input
                  placeholder="Total Amount"
                  type="number"
                  step="0.01"
                  value={form.totalAmount}
                  onChange={(e) => setForm((f) => ({ ...f, totalAmount: e.target.value }))}
                  className="px-2 py-1.5 rounded bg-background border border-card-border text-[11px] text-foreground placeholder:text-muted-foreground/50"
                />
                <select
                  value={form.currency}
                  onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                  className="px-2 py-1.5 rounded bg-background border border-card-border text-[11px] text-foreground"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="CNY">CNY</option>
                </select>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-muted-foreground mb-1">Line Items</p>
                {form.lineItems.map((li, i) => (
                  <div key={i} className="grid grid-cols-3 gap-1.5 mb-1">
                    <input
                      placeholder="Charge Code"
                      value={li.code}
                      onChange={(e) => {
                        const items = [...form.lineItems];
                        items[i] = { ...items[i], code: e.target.value };
                        setForm((f) => ({ ...f, lineItems: items }));
                      }}
                      className="px-2 py-1 rounded bg-background border border-card-border text-[10px] text-foreground placeholder:text-muted-foreground/50"
                    />
                    <input
                      placeholder="Description"
                      value={li.description}
                      onChange={(e) => {
                        const items = [...form.lineItems];
                        items[i] = { ...items[i], description: e.target.value };
                        setForm((f) => ({ ...f, lineItems: items }));
                      }}
                      className="px-2 py-1 rounded bg-background border border-card-border text-[10px] text-foreground placeholder:text-muted-foreground/50"
                    />
                    <input
                      placeholder="Amount"
                      type="number"
                      step="0.01"
                      value={li.amount}
                      onChange={(e) => {
                        const items = [...form.lineItems];
                        items[i] = { ...items[i], amount: e.target.value };
                        setForm((f) => ({ ...f, lineItems: items }));
                      }}
                      className="px-2 py-1 rounded bg-background border border-card-border text-[10px] text-foreground placeholder:text-muted-foreground/50"
                    />
                  </div>
                ))}
                <button
                  onClick={addLineItem}
                  className="text-[9px] text-primary hover:text-primary/80 font-medium mt-1"
                >
                  + Add line item
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-3 py-1 text-[10px] rounded bg-muted text-muted-foreground border border-card-border hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitInvoice}
                  disabled={submitting || !form.carrierName || !form.invoiceNumber || !form.totalAmount}
                  className="px-3 py-1 text-[10px] font-medium rounded bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <DollarSign className="w-3 h-3" />}
                  Submit & Reconcile
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!recon && summary?.carrierInvoiceCount === 0 && (
        <p className="text-[11px] text-muted-foreground text-center py-2">
          No carrier invoices yet. Submit a carrier invoice to begin reconciliation.
        </p>
      )}
    </div>
  );
}
