import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { 
  useGetShipment, 
  useGetShipmentCompliance, 
  useGetShipmentRisk, 
  useGetShipmentInsurance,
  useGetShipmentEvents,
  useGetShipmentDocuments,
  useGetShipmentCorrections
} from "@workspace/api-client-react";
import { useShipmentActions } from "@/hooks/use-shipment-actions";
import { StatusBadge } from "@/components/StatusBadge";
import { RiskPanel } from "@/components/RiskPanel";
import { CompliancePanel } from "@/components/CompliancePanel";
import { InsuranceQuoteCard } from "@/components/InsuranceQuoteCard";
import { AgentActionLog } from "@/components/AgentActionLog";
import { ConfidenceIndicator } from "@/components/ConfidenceIndicator";
import { ArrowLeft, Save, CheckCircle2, XCircle, Loader2, FileBox, ExternalLink, Pencil, Brain } from "lucide-react";
import { motion } from "framer-motion";
import { humanizeDocType } from "@/lib/format";

const EDITABLE_FIELDS = [
  { key: "commodity", label: "Commodity", type: "text" },
  { key: "hsCode", label: "HS Code", type: "text" },
  { key: "portOfLoading", label: "Port of Loading", type: "text" },
  { key: "portOfDischarge", label: "Port of Discharge", type: "text" },
  { key: "vessel", label: "Vessel", type: "text" },
  { key: "voyage", label: "Voyage", type: "text" },
  { key: "bookingNumber", label: "Booking Number", type: "text" },
  { key: "blNumber", label: "B/L Number", type: "text" },
  { key: "packageCount", label: "Package Count", type: "number" },
  { key: "grossWeight", label: "Gross Weight", type: "number" },
  { key: "weightUnit", label: "Weight Unit", type: "text" },
  { key: "volume", label: "Volume", type: "number" },
  { key: "volumeUnit", label: "Volume Unit", type: "text" },
  { key: "incoterms", label: "Incoterms", type: "text" },
];

export default function ShipmentDetail() {
  const [, params] = useRoute("/shipments/:id");
  const id = params?.id || "";

  const { data: shipmentRes, isLoading: loadingShipment } = useGetShipment(id);
  const { data: complianceRes } = useGetShipmentCompliance(id);
  const { data: riskRes } = useGetShipmentRisk(id);
  const { data: insuranceRes } = useGetShipmentInsurance(id);
  const { data: eventsRes } = useGetShipmentEvents(id);
  const { data: docsRes } = useGetShipmentDocuments(id);
  const { data: correctionsRes } = useGetShipmentCorrections(id);

  const { approve, reject, updateFields } = useShipmentActions(id);
  
  const shipment = shipmentRes?.data;
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);

  useEffect(() => {
    if (shipment) {
      const initialData: Record<string, any> = {};
      EDITABLE_FIELDS.forEach(field => {
        initialData[field.key] = (shipment as any)[field.key] || "";
      });
      setFormData(initialData);
      setHasChanges(false);
    }
  }, [shipment]);

  const handleFieldChange = (key: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const cleanData = { ...formData };
    EDITABLE_FIELDS.filter(f => f.type === 'number').forEach(f => {
      if (cleanData[f.key] !== "") {
        cleanData[f.key] = Number(cleanData[f.key]);
      } else {
        cleanData[f.key] = null;
      }
    });
    
    updateFields.mutate({ id, data: { fields: cleanData } }, {
      onSuccess: () => setHasChanges(false)
    });
  };

  const isPendingReview = shipment?.status === "DRAFT" || shipment?.status === "PENDING_REVIEW";

  if (loadingShipment || !shipment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  const visibleFields = EDITABLE_FIELDS.filter(field => {
    const val = formData[field.key];
    return isPendingReview || (val !== "" && val != null);
  });

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-[1400px] mx-auto pb-24">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/" className="p-2 rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div className="flex-grow">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-display font-bold text-foreground">{shipment.reference}</h1>
            <StatusBadge status={shipment.status} />
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Created {new Date(shipment.createdAt).toLocaleString()}
          </p>
        </div>
        
        <Link
          href={`/shipments/${id}/trace`}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 font-semibold text-sm transition-all border border-violet-500/20"
        >
          <Brain className="w-4 h-4" />
          View AI Decision Trace
        </Link>

        {isPendingReview && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowRejectModal(true)}
              className="px-4 py-2.5 rounded-lg font-semibold border border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all"
            >
              Reject
            </button>
            <button
              onClick={() => approve.mutate({ id, data: {} })}
              disabled={approve.isPending || hasChanges}
              className="px-6 py-2.5 rounded-lg font-semibold bg-success hover:bg-success/90 text-success-foreground shadow-lg shadow-success/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {approve.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              Approve Shipment
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          
          <div className="glass-panel rounded-xl p-6 grid grid-cols-2 gap-6">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Shipper</div>
              {shipment.shipper ? (
                <div>
                  <div className="font-bold text-lg text-primary">{shipment.shipper.name}</div>
                  <div className="text-sm text-muted-foreground mt-1">{shipment.shipper.address || ''}</div>
                </div>
              ) : <div className="text-muted-foreground italic">Unresolved</div>}
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Consignee</div>
              {shipment.consignee ? (
                <div>
                  <div className="font-bold text-lg text-primary">{shipment.consignee.name}</div>
                  <div className="text-sm text-muted-foreground mt-1">{shipment.consignee.address || ''}</div>
                </div>
              ) : <div className="text-muted-foreground italic">Unresolved</div>}
            </div>
          </div>

          <div className="glass-panel rounded-xl p-6 relative">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-display font-bold">Extracted Fields</h3>
              {hasChanges && (
                <button
                  onClick={handleSave}
                  disabled={updateFields.isPending}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold text-sm flex items-center gap-2 shadow-md hover:shadow-lg transition-all animate-in fade-in"
                >
                  {updateFields.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Corrections
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              {visibleFields.map((field) => {
                const confidence = shipment.extractionConfidence?.[field.key] as number | undefined;
                return (
                  <div key={field.key} className="space-y-1.5">
                    <label className="text-sm font-semibold text-foreground/80 flex items-center">
                      {field.label}
                      <ConfidenceIndicator confidence={confidence} fieldName={field.label} />
                    </label>
                    {isPendingReview ? (
                      <input
                        type={field.type}
                        value={formData[field.key] ?? ''}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        className="w-full px-3 py-2.5 rounded-lg bg-background border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                      />
                    ) : (
                      <div className="px-3 py-2.5 rounded-lg bg-background/50 border border-border/30 text-sm text-foreground">
                        {formData[field.key] || <span className="text-muted-foreground italic">Not specified</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {correctionsRes?.data && correctionsRes.data.length > 0 && (
              <div className="mt-8 pt-6 border-t border-border">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-accent" /> Correction History
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2 text-sm">
                  {correctionsRes.data.map((c: any) => (
                    <div key={c.id} className="flex justify-between bg-secondary/30 p-2 rounded">
                      <span><span className="font-medium">{c.fieldName}</span> changed by {c.correctedBy}</span>
                      <span className="text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <AgentActionLog events={eventsRes?.data} />

        </div>

        <div className="space-y-6">
          <CompliancePanel screenings={complianceRes?.data} />
          <RiskPanel risk={riskRes?.data} />
          <InsuranceQuoteCard quote={insuranceRes?.data} />
          
          <div className="glass-panel rounded-xl p-6">
            <h3 className="text-lg font-display font-bold mb-4 flex items-center gap-2">
              <FileBox className="w-5 h-5 text-primary" /> Source Documents
            </h3>
            {docsRes?.data && docsRes.data.length > 0 ? (
              <div className="space-y-3">
                {docsRes.data.map((doc: any) => (
                  <div key={doc.id} className="p-3 rounded-lg bg-secondary/50 border border-border/50 flex items-center justify-between group hover:border-primary/50 transition-colors">
                    <div className="truncate pr-4">
                      <div className="text-sm font-semibold truncate" title={doc.fileName}>{doc.fileName}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{humanizeDocType(doc.documentType)}</div>
                    </div>
                    <button className="p-1.5 rounded bg-background text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100">
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Documents processed via pipeline ingestion.</p>
            )}
          </div>

        </div>
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel rounded-xl p-6 w-full max-w-md border border-destructive/20 shadow-2xl"
          >
            <div className="flex items-center gap-3 mb-4 text-destructive">
              <XCircle className="w-6 h-6" />
              <h2 className="text-xl font-bold">Reject Shipment</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Please provide a reason for rejecting this shipment draft. This will be logged in the event history.
            </p>
            <textarea
              className="w-full p-3 rounded-lg bg-background border border-border focus:border-destructive outline-none resize-none h-32 mb-6"
              placeholder="Reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 rounded-lg font-semibold hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  reject.mutate({ id, data: { reason: rejectReason } });
                  setShowRejectModal(false);
                }}
                disabled={!rejectReason.trim() || reject.isPending}
                className="px-4 py-2 rounded-lg font-semibold bg-destructive hover:bg-destructive/90 text-destructive-foreground disabled:opacity-50 transition-colors"
              >
                {reject.isPending ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
