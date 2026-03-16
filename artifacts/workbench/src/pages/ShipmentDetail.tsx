import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import {
  useGetShipment,
  useGetShipmentCompliance,
  useGetShipmentRisk,
  useGetShipmentInsurance,
  useGetShipmentEvents,
  useGetShipmentDocuments,
  useGetShipmentCorrections,
  useListShipmentRecommendations,
  useRespondToRecommendation,
  useTriggerShipmentAnalysis,
  useRecordRecommendationOutcome,
  getAuthToken,
} from "@workspace/api-client-react";
import { useShipmentActions } from "@/hooks/use-shipment-actions";
import { AppLayout } from "@/components/layout/AppLayout";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  XCircle,
  Loader2,
  FileBox,
  Pencil,
  Brain,
  Shield,
  TrendingUp,
  Umbrella,
  Bot,
  FileText,
  DollarSign,
  FileOutput,
  Receipt,
  AlertCircle,
  BarChart3,
  Radar,
  RefreshCw,
  ClipboardCheck,
  ClipboardList,
  GitCompareArrows,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { OutcomeForm, type OutcomeData } from "@/components/recommendations/OutcomeForm";
import {
  normalizeRiskScore,
  riskColor,
  riskLabel,
  formatCurrency,
  humanizeDocType,
  humanizeLabel,
  humanizeCoverageType,
  agentLabel,
} from "@/lib/format";

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

function getEventIcon(type: string) {
  if (type.includes("EXTRACT")) return <FileText className="w-3.5 h-3.5" />;
  if (type.includes("COMPLIANCE")) return <Shield className="w-3.5 h-3.5" />;
  if (type.includes("RISK")) return <TrendingUp className="w-3.5 h-3.5" />;
  if (type.includes("INSURANCE")) return <Umbrella className="w-3.5 h-3.5" />;
  if (type.includes("PRIC")) return <DollarSign className="w-3.5 h-3.5" />;
  if (type.includes("DOCGEN") || type.includes("DOCUMENT_GENERATED")) return <FileOutput className="w-3.5 h-3.5" />;
  if (type.includes("BILLING") || type.includes("INVOICE")) return <Receipt className="w-3.5 h-3.5" />;
  if (type.includes("EXCEPTION")) return <AlertCircle className="w-3.5 h-3.5" />;
  if (type.includes("TRADE_LANE")) return <BarChart3 className="w-3.5 h-3.5" />;
  if (type.includes("APPROVED")) return <CheckCircle2 className="w-3.5 h-3.5" />;
  if (type.includes("REJECTED")) return <XCircle className="w-3.5 h-3.5" />;
  return <Bot className="w-3.5 h-3.5" />;
}

function getEventColor(type: string) {
  if (type.includes("COMPLIANCE")) return "text-emerald-400 bg-emerald-400/10";
  if (type.includes("RISK")) return "text-amber-400 bg-amber-400/10";
  if (type.includes("INSURANCE")) return "text-violet-400 bg-violet-400/10";
  if (type.includes("EXTRACT")) return "text-blue-400 bg-blue-400/10";
  if (type.includes("APPROVED")) return "text-emerald-400 bg-emerald-400/10";
  if (type.includes("REJECTED")) return "text-red-400 bg-red-400/10";
  if (type.includes("EXCEPTION")) return "text-red-400 bg-red-400/10";
  return "text-primary bg-primary/10";
}

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
  const { data: recsRes, refetch: refetchRecs } = useListShipmentRecommendations(id);
  const respondMutation = useRespondToRecommendation();
  const analyzeMutation = useTriggerShipmentAnalysis();
  const outcomeMutation = useRecordRecommendationOutcome();

  const { approve, reject, updateFields } = useShipmentActions(id);

  const shipment = shipmentRes?.data as any;
  const compliance = complianceRes?.data as any;
  const risk = riskRes?.data as any;
  const insurance = insuranceRes?.data as any;
  const events = (eventsRes?.data || []) as any[];
  const docs = (docsRes?.data || []) as any[];
  const corrections = (correctionsRes?.data || []) as any[];

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showModifyModal, setShowModifyModal] = useState<string | null>(null);
  const [modifyNotes, setModifyNotes] = useState("");
  const [outcomeRecId, setOutcomeRecId] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [predictiveRisk, setPredictiveRisk] = useState<any>(null);
  const [readiness, setReadiness] = useState<any>(null);
  const [evaluatingRisk, setEvaluatingRisk] = useState(false);
  const qc = useQueryClient();

  const BASE = `${import.meta.env.BASE_URL}api`;

  const createTaskMutation = useMutation({
    mutationFn: async (recId: string) => {
      const token = getAuthToken();
      const res = await fetch(`${BASE}/recommendations/${recId}/create-task`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      refetchRecs();
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
  const { data: diffData } = useQuery({
    queryKey: ["recommendations", "diff", id],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch(`${BASE}/shipments/${id}/recommendations/diff`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      return json.data;
    },
    enabled: !!id && showDiff,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (shipment) {
      const initialData: Record<string, any> = {};
      EDITABLE_FIELDS.forEach((field) => {
        initialData[field.key] = (shipment as any)[field.key] || "";
      });
      setFormData(initialData);
      setHasChanges(false);
    }
  }, [shipment]);

  useEffect(() => {
    if (!id) return;
    const token = getAuthToken();
    const h = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    Promise.all([
      fetch(`${BASE}/predictive/risk-report/${id}`, { headers: h }).then((r) => r.json()),
      fetch(`${BASE}/predictive/readiness/${id}`, { headers: h }).then((r) => r.json()),
    ]).then(([riskJson, readinessJson]) => {
      setPredictiveRisk(riskJson.data);
      setReadiness(readinessJson.data);
    }).catch(() => {});
  }, [id]);

  const evaluatePreShipmentRisk = async () => {
    setEvaluatingRisk(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${BASE}/predictive/risk-evaluation/${id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const json = await res.json();
      setPredictiveRisk(json.data);
      const readinessRes = await fetch(`${BASE}/predictive/readiness/${id}`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const readinessJson = await readinessRes.json();
      setReadiness(readinessJson.data);
    } catch (e) {
      console.error("Risk evaluation failed", e);
    }
    setEvaluatingRisk(false);
  };

  const handleFieldChange = (key: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const cleanData = { ...formData };
    EDITABLE_FIELDS.filter((f) => f.type === "number").forEach((f) => {
      if (cleanData[f.key] !== "") {
        cleanData[f.key] = Number(cleanData[f.key]);
      } else {
        cleanData[f.key] = null;
      }
    });
    updateFields.mutate({ id, data: { fields: cleanData } }, { onSuccess: () => setHasChanges(false) });
  };

  const isPendingReview = shipment?.status === "DRAFT" || shipment?.status === "PENDING_REVIEW";
  const riskScore = normalizeRiskScore(risk?.compositeScore);

  if (loadingShipment || !shipment) {
    return (
      <AppLayout hideRightPanel>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const visibleFields = EDITABLE_FIELDS.filter((field) => {
    const val = formData[field.key];
    return isPendingReview || (val !== "" && val != null);
  });

  return (
    <AppLayout hideRightPanel>
      <div className="px-6 py-6 max-w-[1200px] mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/shipments" className="p-1.5 rounded-lg hover:bg-card transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-grow">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-semibold text-foreground font-mono">{shipment.reference}</h1>
              <StatusPill status={shipment.status} />
            </div>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Created {format(new Date(shipment.createdAt), "MMM d, yyyy 'at' HH:mm")}
            </p>
          </div>

          <Link
            href={`/shipments/${id}/trace`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary text-[13px] font-medium hover:bg-primary/20 transition-colors"
          >
            <Brain className="w-3.5 h-3.5" />
            Decision Trace
          </Link>

          {isPendingReview && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRejectModal(true)}
                className="px-3.5 py-2 rounded-lg text-[13px] font-medium border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
              >
                Reject
              </button>
              <button
                onClick={() => approve.mutate({ id, data: {} })}
                disabled={approve.isPending || hasChanges}
                className="px-4 py-2 rounded-lg text-[13px] font-medium bg-emerald-500 hover:bg-emerald-500/90 text-white disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {approve.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Approve
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <div className="grid grid-cols-2 gap-4 p-5 rounded-xl bg-card border border-card-border">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Shipper</p>
                {shipment.shipper ? (
                  <div>
                    <p className="text-[14px] font-semibold text-foreground">{shipment.shipper.name}</p>
                    {shipment.shipper.address && <p className="text-[12px] text-muted-foreground mt-0.5">{shipment.shipper.address}</p>}
                  </div>
                ) : (
                  <p className="text-[13px] text-muted-foreground italic">Unresolved</p>
                )}
              </div>
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Consignee</p>
                {shipment.consignee ? (
                  <div>
                    <p className="text-[14px] font-semibold text-foreground">{shipment.consignee.name}</p>
                    {shipment.consignee.address && <p className="text-[12px] text-muted-foreground mt-0.5">{shipment.consignee.address}</p>}
                  </div>
                ) : (
                  <p className="text-[13px] text-muted-foreground italic">Unresolved</p>
                )}
              </div>
            </div>

            <div className="p-5 rounded-xl bg-card border border-card-border">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[14px] font-semibold text-foreground">Extracted Fields</h3>
                {hasChanges && (
                  <button
                    onClick={handleSave}
                    disabled={updateFields.isPending}
                    className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-[12px] font-medium flex items-center gap-1.5 hover:bg-primary/90 transition-colors"
                  >
                    {updateFields.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Save Changes
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-3">
                {visibleFields.map((field) => (
                  <div key={field.key}>
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">
                      {field.label}
                    </label>
                    {isPendingReview ? (
                      <input
                        type={field.type}
                        value={formData[field.key] ?? ""}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-background border border-card-border focus:border-primary/40 focus:ring-1 focus:ring-primary/20 outline-none transition-all text-[13px]"
                      />
                    ) : (
                      <p className="px-3 py-2 rounded-lg bg-background/50 border border-card-border/30 text-[13px] text-foreground">
                        {formData[field.key] || <span className="text-muted-foreground italic">Not specified</span>}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {corrections.length > 0 && (
                <div className="mt-5 pt-4 border-t border-card-border">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Pencil className="w-3 h-3" /> Correction History
                  </p>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto text-[12px]">
                    {corrections.map((c: any) => (
                      <div key={c.id} className="flex justify-between items-center px-3 py-1.5 rounded bg-muted/30">
                        <span>
                          <span className="font-medium">{c.fieldName}</span> — {c.correctedBy}
                        </span>
                        <span className="text-muted-foreground">{format(new Date(c.createdAt), "MMM d")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {events.length > 0 && (
              <div className="p-5 rounded-xl bg-card border border-card-border">
                <h3 className="text-[14px] font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-primary" />
                  Processing Timeline
                </h3>
                <div className="space-y-2">
                  {events.map((event: any, i: number) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${getEventColor(event.eventType)}`}>
                        {getEventIcon(event.eventType)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-foreground">{humanizeLabel(event.eventType)}</p>
                        <p className="text-[11px] text-muted-foreground">{agentLabel(event.eventType)}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground/60 shrink-0 font-mono">
                        {format(new Date(event.createdAt), "HH:mm:ss")}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {(() => {
              const recs = (recsRes?.data || []) as any[];
              if (recs.length === 0 && !analyzeMutation.isPending) return null;

              const activeRecs = recs.filter((r: any) => r.status === "PENDING" || r.status === "SHOWN");
              const decidedRecs = recs.filter((r: any) => r.status === "ACCEPTED" || r.status === "MODIFIED");
              const implementedRecs = recs.filter((r: any) => r.status === "IMPLEMENTED");

              return (
                <div className="p-4 rounded-xl bg-card border border-card-border">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Radar className="w-4 h-4 text-primary" />
                      <h3 className="text-[13px] font-semibold text-foreground">
                        AI Recommendations
                        {activeRecs.length > 0 && (
                          <span className="ml-1.5 text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                            {activeRecs.length}
                          </span>
                        )}
                      </h3>
                    </div>
                    <button
                      onClick={() => analyzeMutation.mutate({ id }, { onSuccess: () => { setTimeout(() => refetchRecs(), 2000); } })}
                      disabled={analyzeMutation.isPending}
                      className="flex items-center gap-1 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <RefreshCw size={12} className={analyzeMutation.isPending ? "animate-spin" : ""} />
                      {analyzeMutation.isPending ? "Analyzing..." : "Re-analyze"}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {activeRecs.map((rec: any) => {
                      const urgencyBorder = rec.urgency === "CRITICAL" ? "border-red-500/30 bg-red-500/5" :
                        rec.urgency === "HIGH" ? "border-amber-500/30 bg-amber-500/5" :
                        rec.urgency === "MEDIUM" ? "border-yellow-500/30 bg-yellow-500/5" : "border-white/10 bg-white/[0.02]";
                      const urgencyBadge = rec.urgency === "CRITICAL" ? "bg-red-500/20 text-red-300" :
                        rec.urgency === "HIGH" ? "bg-amber-500/20 text-amber-300" :
                        rec.urgency === "MEDIUM" ? "bg-yellow-500/20 text-yellow-300" : "bg-blue-500/20 text-blue-300";
                      return (
                        <div key={rec.id} className={`border rounded-lg p-3 ${urgencyBorder}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[12px] font-medium text-foreground">{rec.title}</span>
                                <span className={`px-1 py-0.5 text-[9px] font-bold uppercase rounded ${urgencyBadge}`}>
                                  {rec.urgency}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{rec.explanation}</p>
                              <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground/60">
                                <span>Confidence: {(rec.confidence * 100).toFixed(0)}%</span>
                                {rec.expectedDelayImpactDays != null && <span>Delay: +{rec.expectedDelayImpactDays}d</span>}
                                {rec.expectedRiskReduction != null && <span>Risk: -{rec.expectedRiskReduction}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1.5 mt-2">
                            <button
                              onClick={() => respondMutation.mutate({ id: rec.id, data: { action: "ACCEPTED" } }, { onSuccess: () => refetchRecs() })}
                              className="px-2 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-300 rounded hover:bg-emerald-500/30 border border-emerald-500/30"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => { setShowModifyModal(rec.id); setModifyNotes(""); }}
                              className="px-2 py-0.5 text-[10px] font-medium bg-blue-500/20 text-blue-300 rounded hover:bg-blue-500/30 border border-blue-500/30"
                            >
                              Modify
                            </button>
                            <button
                              onClick={() => respondMutation.mutate({ id: rec.id, data: { action: "REJECTED" } }, { onSuccess: () => refetchRecs() })}
                              className="px-2 py-0.5 text-[10px] font-medium bg-red-500/20 text-red-300 rounded hover:bg-red-500/30 border border-red-500/30"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {decidedRecs.length > 0 && (
                      <div className="pt-2 border-t border-card-border">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Decided</p>
                        {decidedRecs.map((rec: any) => (
                          <div key={rec.id} className="border border-white/10 rounded-lg p-3 bg-white/[0.02] mb-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[12px] font-medium text-foreground">{rec.title}</span>
                              <span className={`px-1 py-0.5 text-[9px] uppercase rounded ${rec.status === "ACCEPTED" ? "bg-emerald-500/20 text-emerald-300" : "bg-blue-500/20 text-blue-300"}`}>
                                {rec.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{rec.explanation}</p>
                            {outcomeRecId === rec.id ? (
                              <div className="mt-2">
                                <OutcomeForm
                                  recommendationId={rec.id}
                                  onSubmit={(recId, data) => {
                                    outcomeMutation.mutate({ id: recId, data }, { onSuccess: () => { refetchRecs(); setOutcomeRecId(null); } });
                                  }}
                                  onCancel={() => setOutcomeRecId(null)}
                                />
                              </div>
                            ) : (
                              <div className="flex gap-1.5 mt-1.5">
                                <button
                                  onClick={() => setOutcomeRecId(rec.id)}
                                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-violet-500/20 text-violet-300 rounded hover:bg-violet-500/30 border border-violet-500/30"
                                >
                                  <ClipboardCheck size={10} /> Record Outcome
                                </button>
                                <button
                                  onClick={() => createTaskMutation.mutate(rec.id)}
                                  disabled={createTaskMutation.isPending}
                                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-300 rounded hover:bg-amber-500/30 border border-amber-500/30 disabled:opacity-50"
                                >
                                  <ClipboardList size={10} /> Create Task
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {implementedRecs.length > 0 && (
                      <div className="pt-2 border-t border-card-border">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Implemented</p>
                        {implementedRecs.map((rec: any) => (
                          <div key={rec.id} className="border border-violet-500/20 rounded-lg p-3 bg-violet-500/5 mb-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[12px] font-medium text-foreground">{rec.title}</span>
                              <span className="px-1 py-0.5 text-[9px] uppercase rounded bg-violet-500/20 text-violet-300">
                                IMPLEMENTED
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{rec.explanation}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="p-4 rounded-xl bg-card border border-card-border">
              <button
                onClick={() => setShowDiff(!showDiff)}
                className="flex items-center gap-2 w-full text-left"
              >
                <GitCompareArrows className="w-4 h-4 text-violet-400" />
                <h3 className="text-[13px] font-semibold text-foreground">Recommendation Changes</h3>
                {showDiff ? <ChevronUp className="w-3 h-3 text-muted-foreground ml-auto" /> : <ChevronDown className="w-3 h-3 text-muted-foreground ml-auto" />}
              </button>
              {showDiff && (
                <div className="mt-3 space-y-3">
                  {diffData?.diffs?.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">No recommendation changes detected for this shipment.</p>
                  )}
                  {(diffData?.diffs || []).map((diff: any) => {
                    const hasChanges = Object.values(diff.changes || {}).some(Boolean);
                    return (
                      <div key={diff.type} className={`border rounded-lg p-3 ${hasChanges ? "border-violet-500/30 bg-violet-500/5" : "border-white/10 bg-white/[0.02]"}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-mono font-medium text-foreground">{diff.type}</span>
                          {hasChanges && <span className="text-[9px] bg-violet-500/20 text-violet-300 px-1.5 py-0.5 rounded-full">CHANGED</span>}
                        </div>
                        <p className="text-[10px] text-muted-foreground mb-2">{diff.triggerSummary}</p>
                        {diff.scoreDelta && (
                          <div className="flex flex-wrap gap-2 text-[10px]">
                            {diff.scoreDelta.confidence !== 0 && (
                              <span className={`flex items-center gap-0.5 ${diff.scoreDelta.confidence > 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {diff.scoreDelta.confidence > 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                                Conf: {diff.scoreDelta.confidence > 0 ? "+" : ""}{diff.scoreDelta.confidence}
                              </span>
                            )}
                            {diff.scoreDelta.delayImpact !== 0 && (
                              <span className={`flex items-center gap-0.5 ${diff.scoreDelta.delayImpact < 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {diff.scoreDelta.delayImpact < 0 ? <ArrowDownRight size={10} /> : <ArrowUpRight size={10} />}
                                Delay: {diff.scoreDelta.delayImpact > 0 ? "+" : ""}{diff.scoreDelta.delayImpact}d
                              </span>
                            )}
                            {diff.scoreDelta.marginImpact !== 0 && (
                              <span className={`flex items-center gap-0.5 ${diff.scoreDelta.marginImpact > 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {diff.scoreDelta.marginImpact > 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                                Margin: {diff.scoreDelta.marginImpact > 0 ? "+" : ""}{diff.scoreDelta.marginImpact}%
                              </span>
                            )}
                            {diff.scoreDelta.riskReduction !== 0 && (
                              <span className={`flex items-center gap-0.5 ${diff.scoreDelta.riskReduction > 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {diff.scoreDelta.riskReduction > 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                                Risk: {diff.scoreDelta.riskReduction > 0 ? "+" : ""}{diff.scoreDelta.riskReduction}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {compliance && (
              <div className="p-4 rounded-xl bg-card border border-card-border">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-[13px] font-semibold text-foreground">Compliance</h3>
                </div>
                <div className={`flex items-center gap-1.5 text-[14px] font-semibold ${compliance.status === "CLEAR" ? "text-emerald-400" : "text-red-400"}`}>
                  {compliance.status === "CLEAR" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {compliance.status}
                </div>
                {compliance.explanation && (
                  <p className="text-[12px] text-muted-foreground mt-2 leading-relaxed">{compliance.explanation}</p>
                )}
              </div>
            )}

            {risk && (
              <div className="p-4 rounded-xl bg-card border border-card-border">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                  <h3 className="text-[13px] font-semibold text-foreground">Risk Score</h3>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-3xl font-semibold tabular-nums ${riskColor(riskScore)}`}>
                    {riskScore ?? 0}
                  </span>
                  <div>
                    <p className={`text-[13px] font-semibold ${riskColor(riskScore)}`}>{riskLabel(riskScore)}</p>
                    <p className="text-[11px] text-muted-foreground">{risk.recommendedAction?.replace(/_/g, " ")}</p>
                  </div>
                </div>
                {risk.subScores && (
                  <div className="mt-3 space-y-2">
                    {Object.entries(risk.subScores).map(([key, val]: [string, any]) => {
                      const normalized = Number(val) <= 1 ? Number(val) * 100 : Number(val);
                      return (
                        <div key={key} className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${normalized < 30 ? "bg-emerald-400" : normalized < 60 ? "bg-amber-400" : "bg-red-400"}`}
                                style={{ width: `${Math.min(normalized, 100)}%` }}
                              />
                            </div>
                            <span className="font-mono w-6 text-right">{Math.round(normalized)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="p-4 rounded-xl bg-card border border-card-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-violet-400" />
                  <h3 className="text-[13px] font-semibold text-foreground">Pre-Shipment Risk</h3>
                </div>
                <button
                  onClick={evaluatePreShipmentRisk}
                  disabled={evaluatingRisk}
                  className="px-2 py-1 text-[10px] font-medium rounded bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 disabled:opacity-50 flex items-center gap-1 border border-violet-500/20"
                >
                  {evaluatingRisk ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  {predictiveRisk ? "Re-evaluate" : "Evaluate"}
                </button>
              </div>
              {predictiveRisk ? (
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`text-2xl font-bold tabular-nums ${
                      predictiveRisk.riskLevel === "CRITICAL" ? "text-red-400" :
                      predictiveRisk.riskLevel === "HIGH" ? "text-orange-400" :
                      predictiveRisk.riskLevel === "MODERATE" ? "text-yellow-400" : "text-emerald-400"
                    }`}>
                      {Math.round(predictiveRisk.overallRiskScore * 100)}
                    </span>
                    <div>
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                        predictiveRisk.riskLevel === "CRITICAL" ? "bg-red-500/10 text-red-400" :
                        predictiveRisk.riskLevel === "HIGH" ? "bg-orange-500/10 text-orange-400" :
                        predictiveRisk.riskLevel === "MODERATE" ? "bg-yellow-500/10 text-yellow-400" : "bg-emerald-500/10 text-emerald-400"
                      }`}>{predictiveRisk.riskLevel}</span>
                      {predictiveRisk.daysUntilDeparture != null && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{predictiveRisk.daysUntilDeparture}d to departure</p>
                      )}
                    </div>
                  </div>
                  {predictiveRisk.components && (
                    <div className="space-y-1.5">
                      {Object.entries(predictiveRisk.components).map(([key, comp]: [string, any]) => (
                        <div key={key} className="flex items-center justify-between text-[10px]">
                          <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${comp.score < 0.3 ? "bg-emerald-400" : comp.score < 0.6 ? "bg-amber-400" : "bg-red-400"}`}
                                style={{ width: `${Math.min(comp.score * 100, 100)}%` }}
                              />
                            </div>
                            <span className="font-mono w-5 text-right">{Math.round(comp.score * 100)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {predictiveRisk.mitigations && predictiveRisk.mitigations.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <p className="text-[10px] text-muted-foreground mb-1">Mitigations:</p>
                      {predictiveRisk.mitigations.slice(0, 3).map((m: string, i: number) => (
                        <p key={i} className="text-[10px] text-foreground leading-relaxed">• {m}</p>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">Click evaluate to assess pre-shipment risk</p>
              )}
            </div>

            {readiness && readiness.shipmentId && (
              <div className="p-4 rounded-xl bg-card border border-card-border">
                <div className="flex items-center gap-2 mb-3">
                  <ClipboardCheck className="w-4 h-4 text-blue-400" />
                  <h3 className="text-[13px] font-semibold text-foreground">Readiness</h3>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-2xl font-bold tabular-nums ${
                    readiness.readinessLevel === "READY" ? "text-emerald-400" :
                    readiness.readinessLevel === "NEEDS_ATTENTION" ? "text-amber-400" : "text-red-400"
                  }`}>
                    {Math.round(readiness.overallScore * 100)}%
                  </span>
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                    readiness.readinessLevel === "READY" ? "bg-emerald-500/10 text-emerald-400" :
                    readiness.readinessLevel === "NEEDS_ATTENTION" ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"
                  }`}>{readiness.readinessLevel?.replace(/_/g, " ")}</span>
                </div>
                {readiness.components && (
                  <div className="space-y-1.5">
                    {Object.entries(readiness.components).map(([key, comp]: [string, any]) => (
                      <div key={key} className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                        <span className={`font-medium ${
                          comp.status === "READY" ? "text-emerald-400" :
                          comp.status === "NEEDS_ATTENTION" ? "text-amber-400" : "text-red-400"
                        }`}>{Math.round(comp.score * 100)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {insurance && (
              <div className="p-4 rounded-xl bg-card border border-card-border">
                <div className="flex items-center gap-2 mb-3">
                  <Umbrella className="w-4 h-4 text-violet-400" />
                  <h3 className="text-[13px] font-semibold text-foreground">Insurance</h3>
                </div>
                <div className="space-y-2 text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Coverage</span>
                    <span className="font-medium text-foreground">{humanizeCoverageType(insurance.coverageType)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cargo Value</span>
                    <span className="font-medium text-foreground">{formatCurrency(insurance.estimatedInsuredValue || insurance.cargoValue, insurance.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Premium</span>
                    <span className="font-semibold text-emerald-400">{formatCurrency(insurance.estimatedPremium, insurance.currency)}</span>
                  </div>
                </div>
              </div>
            )}

            {docs.length > 0 && (
              <div className="p-4 rounded-xl bg-card border border-card-border">
                <div className="flex items-center gap-2 mb-3">
                  <FileBox className="w-4 h-4 text-primary" />
                  <h3 className="text-[13px] font-semibold text-foreground">Documents</h3>
                </div>
                <div className="space-y-1.5">
                  {docs.map((doc: any) => (
                    <div key={doc.id} className="px-3 py-2 rounded-lg bg-muted/30 text-[12px]">
                      <p className="font-medium text-foreground truncate">{doc.fileName}</p>
                      <p className="text-[11px] text-muted-foreground">{humanizeDocType(doc.documentType)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {showModifyModal && (() => {
            const modRec = ((recsRes?.data || []) as any[]).find((r: any) => r.id === showModifyModal);
            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="rounded-xl bg-card border border-card-border p-5 w-full max-w-md"
                >
                  <div className="flex items-center gap-2 mb-3 text-blue-400">
                    <Pencil className="w-5 h-5" />
                    <h2 className="text-[16px] font-semibold text-foreground">Modify Recommendation</h2>
                  </div>
                  {modRec && (
                    <>
                      <p className="text-[12px] text-muted-foreground mb-1">{modRec.title}</p>
                      <p className="text-[11px] text-muted-foreground/60 mb-4">
                        <span className="text-muted-foreground font-medium">Current action: </span>
                        {modRec.recommendedAction}
                      </p>
                    </>
                  )}
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
                    Modification Notes
                  </label>
                  <textarea
                    className="w-full p-3 rounded-lg bg-background border border-card-border focus:border-blue-500/40 outline-none resize-none h-28 text-[13px] mb-4"
                    placeholder="Describe how you would like to modify this recommendation..."
                    value={modifyNotes}
                    onChange={(e) => setModifyNotes(e.target.value)}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => { setShowModifyModal(null); setModifyNotes(""); }}
                      className="px-4 py-2 rounded-lg text-[13px] font-medium hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        respondMutation.mutate(
                          { id: showModifyModal, data: { action: "MODIFIED", modificationNotes: modifyNotes } },
                          { onSuccess: () => { refetchRecs(); setShowModifyModal(null); setModifyNotes(""); } },
                        );
                      }}
                      disabled={!modifyNotes.trim()}
                      className="px-4 py-2 rounded-lg text-[13px] font-medium bg-blue-500 hover:bg-blue-500/90 text-white disabled:opacity-50 transition-colors"
                    >
                      Submit Modification
                    </button>
                  </div>
                </motion.div>
              </div>
            );
          })()}
        </AnimatePresence>

        <AnimatePresence>
          {showRejectModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="rounded-xl bg-card border border-card-border p-5 w-full max-w-md"
              >
                <div className="flex items-center gap-2 mb-3 text-destructive">
                  <XCircle className="w-5 h-5" />
                  <h2 className="text-[16px] font-semibold">Reject Shipment</h2>
                </div>
                <p className="text-[13px] text-muted-foreground mb-4">
                  Provide a reason for rejection. This will be logged in the event history.
                </p>
                <textarea
                  className="w-full p-3 rounded-lg bg-background border border-card-border focus:border-primary/40 outline-none resize-none h-28 text-[13px] mb-4"
                  placeholder="Reason for rejection..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowRejectModal(false)}
                    className="px-4 py-2 rounded-lg text-[13px] font-medium hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      reject.mutate({ id, data: { reason: rejectReason } });
                      setShowRejectModal(false);
                    }}
                    disabled={!rejectReason.trim() || reject.isPending}
                    className="px-4 py-2 rounded-lg text-[13px] font-medium bg-destructive hover:bg-destructive/90 text-destructive-foreground disabled:opacity-50 transition-colors"
                  >
                    Confirm Rejection
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: "bg-blue-400/10 text-blue-400",
    PENDING_REVIEW: "bg-amber-400/10 text-amber-400",
    APPROVED: "bg-emerald-400/10 text-emerald-400",
    REJECTED: "bg-red-400/10 text-red-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${styles[status] || "bg-muted text-muted-foreground"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
