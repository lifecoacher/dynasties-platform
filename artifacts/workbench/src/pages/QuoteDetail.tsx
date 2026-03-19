import { useState, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  ArrowLeft,
  Loader2,
  Save,
  Send,
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  Plus,
  Trash2,
  Ship,
  FileText,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  useQuote,
  useUpdateQuote,
  useAddLineItem,
  useDeleteLineItem,
  useQuoteAction,
} from "@/hooks/use-quotes";
import { formatCurrency } from "@/lib/format";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  SENT: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  ACCEPTED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  EXPIRED: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  CONVERTED: "bg-[#00BFA6]/10 text-[#00BFA6] border-[#00BFA6]/20",
  REJECTED: "bg-red-500/10 text-red-400 border-red-500/20",
};

const CHARGE_TYPES = [
  "FREIGHT", "FUEL_SURCHARGE", "CUSTOMS", "DOCUMENTATION",
  "STORAGE", "INSURANCE", "HANDLING", "PORT_CHARGES", "INSPECTION", "OTHER",
];

export default function QuoteDetail() {
  const [, params] = useRoute("/quotes/:id");
  const [, navigate] = useLocation();
  const quoteId = params?.id;
  const { data: response, isLoading } = useQuote(quoteId);
  const updateQuote = useUpdateQuote();
  const addLineItem = useAddLineItem();
  const deleteLineItem = useDeleteLineItem();
  const quoteAction = useQuoteAction();

  const quote = response?.data;
  const isDraft = quote?.status === "DRAFT";
  const isEditable = isDraft;
  const isSent = quote?.status === "SENT";
  const isAccepted = quote?.status === "ACCEPTED";
  const isConverted = quote?.status === "CONVERTED";

  const [form, setForm] = useState<Record<string, any>>({});
  const [showLineItemForm, setShowLineItemForm] = useState(false);
  const [newLineItem, setNewLineItem] = useState({
    chargeType: "FREIGHT",
    description: "",
    quantity: 1,
    unitPrice: "",
    amount: "",
  });

  useEffect(() => {
    if (quote && !Object.keys(form).length) {
      setForm({
        origin: quote.origin || "",
        destination: quote.destination || "",
        portOfLoading: quote.portOfLoading || "",
        portOfDischarge: quote.portOfDischarge || "",
        incoterms: quote.incoterms || "",
        commodity: quote.commodity || "",
        hsCode: quote.hsCode || "",
        packageCount: quote.packageCount || "",
        grossWeight: quote.grossWeight || "",
        weightUnit: quote.weightUnit || "KG",
        volume: quote.volume || "",
        volumeUnit: quote.volumeUnit || "CBM",
        currency: quote.currency || "USD",
        validUntil: quote.validUntil ? format(new Date(quote.validUntil), "yyyy-MM-dd") : "",
        notes: quote.notes || "",
      });
    }
  }, [quote]);

  const handleSave = async () => {
    if (!quoteId) return;
    const data: Record<string, any> = { ...form };
    if (data.packageCount) data.packageCount = parseInt(data.packageCount);
    if (data.grossWeight) data.grossWeight = parseFloat(data.grossWeight);
    if (data.volume) data.volume = parseFloat(data.volume);
    Object.keys(data).forEach((k) => {
      if (data[k] === "" || data[k] === null) delete data[k];
    });
    await updateQuote.mutateAsync({ id: quoteId, data });
  };

  const handleAddLineItem = async () => {
    if (!quoteId || !newLineItem.description || !newLineItem.unitPrice) return;
    const qty = newLineItem.quantity || 1;
    const up = parseFloat(newLineItem.unitPrice);
    const amt = newLineItem.amount ? newLineItem.amount : (qty * up).toFixed(2);
    await addLineItem.mutateAsync({
      quoteId,
      data: {
        chargeType: newLineItem.chargeType,
        description: newLineItem.description,
        quantity: qty,
        unitPrice: up.toFixed(2),
        amount: amt,
      },
    });
    setNewLineItem({ chargeType: "FREIGHT", description: "", quantity: 1, unitPrice: "", amount: "" });
    setShowLineItemForm(false);
  };

  const handleDeleteLineItem = async (itemId: string) => {
    if (!quoteId) return;
    await deleteLineItem.mutateAsync({ quoteId, itemId });
  };

  const handleAction = async (action: "send" | "accept" | "reject" | "convert") => {
    if (!quoteId) return;
    const result = await quoteAction.mutateAsync({ id: quoteId, action });
    if (action === "convert" && result?.data?.shipment?.id) {
      navigate(`/shipments/${result.data.shipment.id}`);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin text-[#00BFA6]" />
        </div>
      </AppLayout>
    );
  }

  if (!quote) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
          <p className="text-muted-foreground">Quote not found</p>
          <Link href="/quotes" className="text-[#00BFA6] text-sm hover:underline">
            Back to quotes
          </Link>
        </div>
      </AppLayout>
    );
  }

  const lineItems = quote.lineItems || [];
  const statusStyle = STATUS_STYLES[quote.status] || STATUS_STYLES.DRAFT;

  return (
    <AppLayout>
      <div className="p-6 max-w-[1100px] mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/quotes">
            <button className="p-2 rounded-lg hover:bg-[#1a2233] transition-colors">
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-[20px] font-semibold text-foreground">
                {quote.quoteNumber}
              </h1>
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase border ${statusStyle}`}>
                {quote.status}
              </span>
            </div>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Created {format(new Date(quote.createdAt), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isDraft && (
              <>
                <button
                  onClick={handleSave}
                  disabled={updateQuote.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1a2233] text-foreground text-[12px] font-medium hover:bg-[#222d3d] transition-colors disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {updateQuote.isPending ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => handleAction("send")}
                  disabled={quoteAction.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-[12px] font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send Quote
                </button>
              </>
            )}
            {isSent && (
              <>
                <button
                  onClick={() => handleAction("reject")}
                  disabled={quoteAction.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600/20 text-red-400 text-[12px] font-medium hover:bg-red-600/30 transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Reject
                </button>
                <button
                  onClick={() => handleAction("accept")}
                  disabled={quoteAction.isPending}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-[12px] font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Accept
                </button>
              </>
            )}
            {isAccepted && (
              <button
                onClick={() => handleAction("convert")}
                disabled={quoteAction.isPending}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#00BFA6] text-white text-[13px] font-medium hover:bg-[#00BFA6]/90 transition-colors disabled:opacity-50"
              >
                {quoteAction.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRightLeft className="w-4 h-4" />
                )}
                Convert to Shipment
              </button>
            )}
          </div>
        </div>

        {isConverted && quote.convertedShipmentId && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-[#00BFA6]/10 border border-[#00BFA6]/20 flex items-center gap-3"
          >
            <Ship className="w-5 h-5 text-[#00BFA6]" />
            <div className="flex-1">
              <p className="text-[13px] font-medium text-[#00BFA6]">
                Converted to Shipment
              </p>
              <p className="text-[11px] text-[#00BFA6]/70 mt-0.5">
                This quote has been converted. All commercial data was carried over.
              </p>
            </div>
            <Link href={`/shipments/${quote.convertedShipmentId}`}>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00BFA6] text-white text-[12px] font-medium hover:bg-[#00BFA6]/90 transition-colors">
                View Shipment
                <ExternalLink className="w-3 h-3" />
              </button>
            </Link>
          </motion.div>
        )}

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="rounded-xl bg-[#121821] border border-[#1a2233] p-5">
              <h2 className="text-[14px] font-semibold text-foreground mb-4">Route & Logistics</h2>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Origin" value={form.origin} field="origin" editable={isEditable} onChange={(v) => setForm({ ...form, origin: v })} />
                <Field label="Destination" value={form.destination} field="destination" editable={isEditable} onChange={(v) => setForm({ ...form, destination: v })} />
                <Field label="Port of Loading" value={form.portOfLoading} field="portOfLoading" editable={isEditable} onChange={(v) => setForm({ ...form, portOfLoading: v })} />
                <Field label="Port of Discharge" value={form.portOfDischarge} field="portOfDischarge" editable={isEditable} onChange={(v) => setForm({ ...form, portOfDischarge: v })} />
                <Field label="Incoterms" value={form.incoterms} field="incoterms" editable={isEditable} onChange={(v) => setForm({ ...form, incoterms: v })} />
                <Field label="Valid Until" value={form.validUntil} field="validUntil" editable={isEditable} onChange={(v) => setForm({ ...form, validUntil: v })} type="date" />
              </div>
            </div>

            <div className="rounded-xl bg-[#121821] border border-[#1a2233] p-5">
              <h2 className="text-[14px] font-semibold text-foreground mb-4">Cargo Details</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Field label="Commodity" value={form.commodity} field="commodity" editable={isEditable} onChange={(v) => setForm({ ...form, commodity: v })} />
                </div>
                <Field label="HS Code" value={form.hsCode} field="hsCode" editable={isEditable} onChange={(v) => setForm({ ...form, hsCode: v })} />
                <Field label="Package Count" value={form.packageCount} field="packageCount" editable={isEditable} onChange={(v) => setForm({ ...form, packageCount: v })} />
                <Field label="Gross Weight" value={form.grossWeight} field="grossWeight" editable={isEditable} onChange={(v) => setForm({ ...form, grossWeight: v })} />
                <Field label="Volume" value={form.volume} field="volume" editable={isEditable} onChange={(v) => setForm({ ...form, volume: v })} />
              </div>
            </div>

            {form.notes !== undefined && (
              <div className="rounded-xl bg-[#121821] border border-[#1a2233] p-5">
                <h2 className="text-[14px] font-semibold text-foreground mb-3">Notes</h2>
                {isEditable ? (
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-[#0D1219] border border-[#1a2233] text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#00BFA6]/50 resize-none"
                    placeholder="Add notes..."
                  />
                ) : (
                  <p className="text-[13px] text-muted-foreground">{quote.notes || "No notes"}</p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-xl bg-[#121821] border border-[#1a2233] p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[14px] font-semibold text-foreground">Line Items</h2>
                {quote.quotedAmount && (
                  <span className="text-[16px] font-semibold text-foreground">
                    {formatCurrency(parseFloat(quote.quotedAmount), quote.currency || "USD")}
                  </span>
                )}
              </div>

              {lineItems.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-[12px] text-muted-foreground">No line items yet</p>
                </div>
              ) : (
                <div className="space-y-2 mb-4">
                  {lineItems.map((li: any) => (
                    <div
                      key={li.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-[#0D1219] border border-[#1a2233]"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase bg-[#1a2233] text-muted-foreground">
                            {li.chargeType}
                          </span>
                          <span className="text-[12px] text-foreground truncate">
                            {li.description}
                          </span>
                        </div>
                        {li.quantity > 1 && (
                          <span className="text-[10px] text-muted-foreground">
                            {li.quantity} x {formatCurrency(parseFloat(li.unitPrice), li.currency || "USD")}
                          </span>
                        )}
                      </div>
                      <span className="text-[13px] font-medium text-foreground whitespace-nowrap">
                        {formatCurrency(parseFloat(li.amount), li.currency || "USD")}
                      </span>
                      {isDraft && (
                        <button
                          onClick={() => handleDeleteLineItem(li.id)}
                          className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {isDraft && !showLineItemForm && (
                <button
                  onClick={() => setShowLineItemForm(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-[#1a2233] text-[12px] text-muted-foreground hover:border-[#00BFA6]/30 hover:text-foreground transition-colors w-full justify-center"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Line Item
                </button>
              )}

              {isDraft && showLineItemForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="border border-[#1a2233] rounded-lg p-3 space-y-3"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Type</label>
                      <select
                        value={newLineItem.chargeType}
                        onChange={(e) => setNewLineItem({ ...newLineItem, chargeType: e.target.value })}
                        className="w-full mt-1 px-2 py-1.5 rounded bg-[#0D1219] border border-[#1a2233] text-[12px] text-foreground focus:outline-none focus:border-[#00BFA6]/50"
                      >
                        {CHARGE_TYPES.map((ct) => (
                          <option key={ct} value={ct}>{ct.replace(/_/g, " ")}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Description</label>
                      <input
                        value={newLineItem.description}
                        onChange={(e) => setNewLineItem({ ...newLineItem, description: e.target.value })}
                        className="w-full mt-1 px-2 py-1.5 rounded bg-[#0D1219] border border-[#1a2233] text-[12px] text-foreground focus:outline-none focus:border-[#00BFA6]/50"
                        placeholder="Description"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Unit Price</label>
                      <input
                        value={newLineItem.unitPrice}
                        onChange={(e) => setNewLineItem({ ...newLineItem, unitPrice: e.target.value })}
                        className="w-full mt-1 px-2 py-1.5 rounded bg-[#0D1219] border border-[#1a2233] text-[12px] text-foreground focus:outline-none focus:border-[#00BFA6]/50"
                        placeholder="0.00"
                        type="number"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Quantity</label>
                      <input
                        value={newLineItem.quantity}
                        onChange={(e) => setNewLineItem({ ...newLineItem, quantity: parseInt(e.target.value) || 1 })}
                        className="w-full mt-1 px-2 py-1.5 rounded bg-[#0D1219] border border-[#1a2233] text-[12px] text-foreground focus:outline-none focus:border-[#00BFA6]/50"
                        placeholder="1"
                        type="number"
                        min="1"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowLineItemForm(false)}
                      className="px-3 py-1.5 rounded text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddLineItem}
                      disabled={addLineItem.isPending || !newLineItem.description || !newLineItem.unitPrice}
                      className="px-3 py-1.5 rounded bg-[#00BFA6] text-white text-[11px] font-medium hover:bg-[#00BFA6]/90 transition-colors disabled:opacity-50"
                    >
                      {addLineItem.isPending ? "Adding..." : "Add"}
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            {quote.pricingSnapshot && (
              <div className="rounded-xl bg-[#121821] border border-[#1a2233] p-5">
                <h2 className="text-[14px] font-semibold text-foreground mb-3">Accepted Pricing Snapshot</h2>
                <div className="p-3 rounded-lg bg-[#0D1219] border border-[#1a2233]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-muted-foreground">Accepted Amount</span>
                    <span className="text-[14px] font-semibold text-emerald-400">
                      {formatCurrency(
                        parseFloat((quote.pricingSnapshot as any).quotedAmount || "0"),
                        (quote.pricingSnapshot as any).currency || "USD",
                      )}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Accepted on {format(new Date((quote.pricingSnapshot as any).acceptedAt), "MMM d, yyyy 'at' h:mm a")}
                  </div>
                  <div className="mt-2 space-y-1">
                    {((quote.pricingSnapshot as any).lineItems || []).map((li: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">{li.description}</span>
                        <span className="text-foreground">{formatCurrency(parseFloat(li.amount), "USD")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Field({
  label,
  value,
  editable,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  field: string;
  editable: boolean;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</label>
      {editable ? (
        <input
          type={type}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full mt-1 px-3 py-2 rounded-lg bg-[#0D1219] border border-[#1a2233] text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#00BFA6]/50"
        />
      ) : (
        <p className="mt-1 text-[13px] text-foreground">{value || "-"}</p>
      )}
    </div>
  );
}
