import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { DocumentWorkspace } from "../components/documents/DocumentWorkspace";
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
  Navigation,
  MapPin,
  Anchor,
  Ship,
  Truck,
  PackageCheck,
  Clock,
  Plus,
  Calendar,
} from "lucide-react";
import { OutcomeForm, type OutcomeData } from "@/components/recommendations/OutcomeForm";
import { useToast } from "@/hooks/use-toast";
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
  if (type.includes("DECISION")) return <Brain className="w-3.5 h-3.5" />;
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
  if (type.includes("COMPLIANCE")) return "text-primary bg-primary/10";
  if (type.includes("DECISION")) return "text-primary bg-primary/10";
  if (type.includes("RISK")) return "text-[#D4A24C] bg-[#D4A24C]/10";
  if (type.includes("INSURANCE")) return "text-muted-foreground bg-muted/50";
  if (type.includes("EXTRACT")) return "text-primary bg-primary/10";
  if (type.includes("APPROVED")) return "text-primary bg-primary/10";
  if (type.includes("REJECTED")) return "text-[#E05252] bg-[#E05252]/10";
  if (type.includes("EXCEPTION")) return "text-[#E05252] bg-[#E05252]/10";
  return "text-primary bg-primary/10";
}

const LOGISTICS_EVENT_LABELS: Record<string, string> = {
  SHIPMENT_CREATED: "Shipment Created",
  BOOKING_CONFIRMED: "Booking Confirmed",
  PICKED_UP: "Picked Up",
  DEPARTED_ORIGIN: "Departed Origin",
  ARRIVED_TRANSSHIPMENT: "At Transshipment",
  DEPARTED_TRANSSHIPMENT: "Left Transshipment",
  ARRIVED_DESTINATION: "Arrived Destination",
  CUSTOMS_HOLD: "Customs Hold",
  CUSTOMS_RELEASED: "Customs Released",
  DELAYED: "Delayed",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  UNKNOWN: "Unknown",
};

const LOGISTICS_EVENT_ICONS: Record<string, React.ReactNode> = {
  SHIPMENT_CREATED: <FileBox className="w-3.5 h-3.5" />,
  BOOKING_CONFIRMED: <ClipboardCheck className="w-3.5 h-3.5" />,
  PICKED_UP: <Truck className="w-3.5 h-3.5" />,
  DEPARTED_ORIGIN: <Ship className="w-3.5 h-3.5" />,
  ARRIVED_TRANSSHIPMENT: <Anchor className="w-3.5 h-3.5" />,
  DEPARTED_TRANSSHIPMENT: <Ship className="w-3.5 h-3.5" />,
  ARRIVED_DESTINATION: <Anchor className="w-3.5 h-3.5" />,
  CUSTOMS_HOLD: <AlertCircle className="w-3.5 h-3.5" />,
  CUSTOMS_RELEASED: <CheckCircle2 className="w-3.5 h-3.5" />,
  DELAYED: <Clock className="w-3.5 h-3.5" />,
  OUT_FOR_DELIVERY: <Truck className="w-3.5 h-3.5" />,
  DELIVERED: <PackageCheck className="w-3.5 h-3.5" />,
  UNKNOWN: <Bot className="w-3.5 h-3.5" />,
};

function getLogisticsColor(type: string) {
  if (type === "DELIVERED") return "text-primary bg-primary/10";
  if (type === "CUSTOMS_HOLD" || type === "DELAYED") return "text-[#E05252] bg-[#E05252]/10";
  if (type === "CUSTOMS_RELEASED") return "text-primary bg-primary/10";
  if (type.includes("DEPARTED") || type.includes("PICKED") || type === "OUT_FOR_DELIVERY") return "text-[#4EAEE3] bg-[#4EAEE3]/10";
  if (type.includes("ARRIVED")) return "text-[#D4A24C] bg-[#D4A24C]/10";
  if (type === "BOOKING_CONFIRMED") return "text-primary bg-primary/10";
  return "text-muted-foreground bg-muted/50";
}

function getSourceBadge(source: string) {
  const styles: Record<string, string> = {
    IMPORT: "bg-violet-500/10 text-violet-400",
    MANUAL: "bg-blue-500/10 text-blue-400",
    API: "bg-orange-500/10 text-orange-400",
    SYSTEM: "bg-muted text-muted-foreground",
  };
  return styles[source] || styles.SYSTEM;
}

const SHIPMENT_EVENT_OPTIONS = [
  "SHIPMENT_CREATED", "BOOKING_CONFIRMED", "PICKED_UP", "DEPARTED_ORIGIN",
  "ARRIVED_TRANSSHIPMENT", "DEPARTED_TRANSSHIPMENT", "ARRIVED_DESTINATION",
  "CUSTOMS_HOLD", "CUSTOMS_RELEASED", "DELAYED", "OUT_FOR_DELIVERY", "DELIVERED",
];

export default function ShipmentDetail() {
  const [, params] = useRoute("/shipments/:id");
  const id = params?.id || "";

  const { data: shipmentRes, isLoading: loadingShipment } = useGetShipment(id);
  const { data: complianceRes } = useGetShipmentCompliance(id);
  const { data: riskRes } = useGetShipmentRisk(id);
  const { data: docValRes } = useQuery({
    queryKey: [`/api/shipments/${id}/document-validation`],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch(`${import.meta.env.BASE_URL}api/shipments/${id}/document-validation`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { data: null };
      return res.json();
    },
    enabled: !!id,
  });
  const { data: routingPricingRes } = useQuery({
    queryKey: [`/api/shipments/${id}/routing-pricing`],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch(`${import.meta.env.BASE_URL}api/shipments/${id}/routing-pricing`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { data: null };
      return res.json();
    },
    enabled: !!id,
  });
  const { data: decisionRes, refetch: refetchDecision } = useQuery({
    queryKey: [`/api/shipments/${id}/decision`],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch(`${import.meta.env.BASE_URL}api/shipments/${id}/decision`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { data: null };
      return res.json();
    },
    enabled: !!id,
  });
  const { data: timelineRes, refetch: refetchTimeline } = useQuery({
    queryKey: [`/api/shipments/${id}/timeline`],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch(`${import.meta.env.BASE_URL}api/shipments/${id}/timeline`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { data: { events: [], derivedStatus: null } };
      return res.json();
    },
    enabled: !!id,
  });
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
  const complianceArr = (complianceRes?.data || []) as any[];
  const compliance = Array.isArray(complianceArr) ? complianceArr[0] || null : complianceArr;
  const risk = riskRes?.data as any;
  const docValidation = docValRes?.data as any;
  const routingPricing = routingPricingRes?.data as any;
  const decision = decisionRes?.data as any;
  const insurance = insuranceRes?.data as any;
  const events = (eventsRes?.data || []) as any[];
  const docs = (docsRes?.data || []) as any[];
  const corrections = (correctionsRes?.data || []) as any[];
  const timelineEvents = (timelineRes?.data?.events || []) as any[];
  const derivedStatus = timelineRes?.data?.derivedStatus as string | null;

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventFormData, setEventFormData] = useState({
    eventType: "",
    timestamp: "",
    location: "",
    description: "",
  });
  const [submittingEvent, setSubmittingEvent] = useState(false);
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
  const [bookingDecision, setBookingDecision] = useState<any>(null);
  const [gateHolds, setGateHolds] = useState<any[]>([]);
  const [scenarioComparison, setScenarioComparison] = useState<any>(null);
  const [playbooks, setPlaybooks] = useState<any[]>([]);
  const [evaluatingBooking, setEvaluatingBooking] = useState(false);
  const [evaluatingGates, setEvaluatingGates] = useState(false);
  const [evaluatingScenarios, setEvaluatingScenarios] = useState(false);
  const [weatherContext, setWeatherContext] = useState<any>(null);
  const [runningCompliance, setRunningCompliance] = useState(false);
  const [runningDocValidation, setRunningDocValidation] = useState(false);
  const [runningRoutingPricing, setRunningRoutingPricing] = useState(false);
  const [runningDecision, setRunningDecision] = useState(false);
  const [expandedRoute, setExpandedRoute] = useState<number | null>(null);
  const { toast } = useToast();
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

  const runComplianceCheck = async () => {
    setRunningCompliance(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${BASE}/shipments/${id}/compliance-check`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`Compliance check failed: ${res.status}`);
      qc.invalidateQueries({ queryKey: [`/api/shipments/${id}/compliance`] });
      qc.invalidateQueries({ queryKey: [`/api/shipments/${id}/risk`] });
      qc.invalidateQueries({ queryKey: [`/api/shipments/${id}/events`] });
      toast({ title: "Compliance check complete", description: "Screening and risk scoring finished successfully." });
    } catch (err) {
      console.error("[compliance-check]", err);
      toast({ title: "Compliance check failed", description: "An error occurred during screening. Please try again.", variant: "destructive" });
    } finally {
      setRunningCompliance(false);
    }
  };

  const runDocValidationCheck = async () => {
    setRunningDocValidation(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${BASE}/shipments/${id}/document-validation-check`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`Document validation failed: ${res.status}`);
      qc.invalidateQueries({ queryKey: [`/api/shipments/${id}/document-validation`] });
      qc.invalidateQueries({ queryKey: [`/api/shipments/${id}/events`] });
      toast({ title: "Document validation complete", description: "Documentation review finished successfully." });
    } catch (err) {
      console.error("[doc-validation]", err);
      toast({ title: "Document validation failed", description: "An error occurred during validation. Please try again.", variant: "destructive" });
    } finally {
      setRunningDocValidation(false);
    }
  };

  const runRoutingPricingCheck = async () => {
    setRunningRoutingPricing(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${BASE}/shipments/${id}/routing-pricing`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`Routing & pricing failed: ${res.status}`);
      qc.invalidateQueries({ queryKey: [`/api/shipments/${id}/routing-pricing`] });
      qc.invalidateQueries({ queryKey: [`/api/shipments/${id}/events`] });
      toast({ title: "Routing & pricing complete", description: "Route options and cost estimates generated." });
    } catch (err) {
      console.error("[routing-pricing]", err);
      toast({ title: "Routing & pricing failed", description: "An error occurred. Please try again.", variant: "destructive" });
    } finally {
      setRunningRoutingPricing(false);
    }
  };

  const runDecisionEngine = async () => {
    setRunningDecision(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${BASE}/shipments/${id}/decision`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`Decision engine failed: ${res.status}`);
      refetchDecision();
      qc.invalidateQueries({ queryKey: [`/api/shipments/${id}/events`] });
      toast({ title: "Decision computed", description: "Global decision engine evaluation complete." });
    } catch (err) {
      console.error("[decision-engine]", err);
      toast({ title: "Decision engine failed", description: "An error occurred during evaluation. Please try again.", variant: "destructive" });
    } finally {
      setRunningDecision(false);
    }
  };

  const submitEvent = async () => {
    if (!eventFormData.timestamp) {
      toast({ title: "Timestamp required", variant: "destructive" });
      return;
    }
    setSubmittingEvent(true);
    try {
      const token = getAuthToken();
      const body: Record<string, any> = {
        timestamp: eventFormData.timestamp,
        source: "MANUAL",
      };
      if (eventFormData.eventType) body.eventType = eventFormData.eventType;
      if (eventFormData.description) body.description = eventFormData.description;
      if (eventFormData.location) body.location = eventFormData.location;

      const res = await fetch(`${BASE}/shipments/${id}/shipment-events`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error || "Failed");
      }
      refetchTimeline();
      qc.invalidateQueries({ queryKey: [`/api/shipments/${id}`] });
      setEventFormData({ eventType: "", timestamp: "", location: "", description: "" });
      setShowEventForm(false);
      toast({ title: "Event recorded", description: "Shipment timeline updated." });
    } catch (err: any) {
      toast({ title: "Failed to record event", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingEvent(false);
    }
  };

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
    fetch(`${BASE}/predictive/booking-decision/${id}`, { headers: h }).then((r) => r.json()).then((j) => setBookingDecision(j.data)).catch(() => {});
    fetch(`${BASE}/predictive/holds/${id}`, { headers: h }).then((r) => r.json()).then((j) => setGateHolds(j.data || [])).catch(() => {});
    fetch(`${BASE}/predictive/scenarios/${id}`, { headers: h }).then((r) => r.json()).then((j) => setScenarioComparison(j.data)).catch(() => {});
    fetch(`${BASE}/predictive/playbooks/${id}`, { headers: h }).then((r) => r.json()).then((j) => setPlaybooks(j.data || [])).catch(() => {});
    fetch(`${BASE}/shipments/${id}/weather-context`, { headers: h }).then((r) => {
      if (!r.ok) throw new Error();
      return r.json();
    }).then((j) => {
      setWeatherContext(j.data);
      try { sessionStorage.setItem(`weather_${id}`, JSON.stringify(j.data)); } catch {}
    }).catch(() => {
      setWeatherContext(null);
      try { sessionStorage.removeItem(`weather_${id}`); } catch {}
    });
  }, [id]);

  const runBookingDecision = async () => {
    setEvaluatingBooking(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${BASE}/predictive/booking-decision/${id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const json = await res.json();
      setBookingDecision(json.data);
    } catch (e) { console.error(e); }
    setEvaluatingBooking(false);
  };

  const runReleaseGates = async () => {
    setEvaluatingGates(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${BASE}/predictive/release-gates/${id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const json = await res.json();
      setGateHolds(json.data?.holds || []);
    } catch (e) { console.error(e); }
    setEvaluatingGates(false);
  };

  const runScenarioComparison = async () => {
    setEvaluatingScenarios(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${BASE}/predictive/scenarios/${id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const json = await res.json();
      setScenarioComparison(json.data);
    } catch (e) { console.error(e); }
    setEvaluatingScenarios(false);
  };

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
                className="px-4 py-2 rounded-lg text-[13px] font-medium bg-primary hover:bg-primary/90 text-white disabled:opacity-50 transition-colors flex items-center gap-1.5"
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

            <div className="p-5 rounded-xl bg-card border border-card-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-primary" />
                  Shipment Journey
                  {derivedStatus && (
                    <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded ${
                      derivedStatus === "DELIVERED" ? "bg-primary/10 text-primary" :
                      derivedStatus === "CUSTOMS" ? "bg-[#D4A24C]/10 text-[#D4A24C]" :
                      derivedStatus === "IN_TRANSIT" ? "bg-[#4EAEE3]/10 text-[#4EAEE3]" :
                      "bg-muted text-muted-foreground"
                    }`}>{derivedStatus}</span>
                  )}
                </h3>
                <button
                  onClick={() => setShowEventForm(!showEventForm)}
                  className="px-2 py-1 text-[10px] font-medium rounded bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1 border border-primary/20"
                >
                  <Plus className="w-3 h-3" />
                  Add Event
                </button>
              </div>

              <AnimatePresence>
                {showEventForm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 p-3 rounded-lg bg-muted/30 border border-card-border space-y-2"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={eventFormData.eventType}
                        onChange={(e) => setEventFormData({ ...eventFormData, eventType: e.target.value })}
                        className="px-2 py-1.5 text-[11px] rounded bg-background border border-card-border text-foreground"
                      >
                        <option value="">Auto-classify from description</option>
                        {SHIPMENT_EVENT_OPTIONS.map((t) => (
                          <option key={t} value={t}>{LOGISTICS_EVENT_LABELS[t] || t}</option>
                        ))}
                      </select>
                      <input
                        type="datetime-local"
                        value={eventFormData.timestamp}
                        onChange={(e) => setEventFormData({ ...eventFormData, timestamp: e.target.value })}
                        className="px-2 py-1.5 text-[11px] rounded bg-background border border-card-border text-foreground"
                        placeholder="Timestamp"
                      />
                    </div>
                    <input
                      type="text"
                      value={eventFormData.location}
                      onChange={(e) => setEventFormData({ ...eventFormData, location: e.target.value })}
                      className="w-full px-2 py-1.5 text-[11px] rounded bg-background border border-card-border text-foreground"
                      placeholder="Location (e.g. CNSHA, Shanghai)"
                    />
                    <input
                      type="text"
                      value={eventFormData.description}
                      onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })}
                      className="w-full px-2 py-1.5 text-[11px] rounded bg-background border border-card-border text-foreground"
                      placeholder="Description (optional — used for AI classification if no type selected)"
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setShowEventForm(false)} className="px-3 py-1 text-[10px] rounded bg-muted text-muted-foreground hover:bg-muted/80">Cancel</button>
                      <button onClick={submitEvent} disabled={submittingEvent} className="px-3 py-1 text-[10px] font-medium rounded bg-primary text-background hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1">
                        {submittingEvent ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        Record Event
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {timelineEvents.length > 0 ? (
                <div className="relative ml-3 border-l-2 border-primary/20 space-y-0">
                  {timelineEvents.map((evt: any, i: number) => (
                    <motion.div
                      key={evt.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="relative pl-6 py-2 group"
                    >
                      <div className={`absolute -left-[11px] top-3 w-5 h-5 rounded-full flex items-center justify-center border-2 border-background ${
                        i === timelineEvents.length - 1 ? "bg-primary ring-2 ring-primary/30" : "bg-card"
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${
                          i === timelineEvents.length - 1 ? "bg-background" : "bg-primary/60"
                        }`} />
                      </div>
                      <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors">
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${getLogisticsColor(evt.eventType)}`}>
                          {LOGISTICS_EVENT_ICONS[evt.eventType] || <Bot className="w-3.5 h-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-foreground">
                            {LOGISTICS_EVENT_LABELS[evt.eventType] || evt.eventType}
                            {evt.isCriticalEvent && <span className="ml-1.5 text-[9px] font-bold text-[#E05252]">CRITICAL</span>}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {evt.location && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <MapPin className="w-2.5 h-2.5" /> {evt.location}
                              </span>
                            )}
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${getSourceBadge(evt.source)}`}>
                              {evt.source}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground/60 shrink-0 font-mono">
                          {format(new Date(evt.eventTimestamp), "MMM d, HH:mm")}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground text-center py-4">No shipment events recorded yet. Add the first event above.</p>
              )}
            </div>

            <DocumentWorkspace shipmentId={id} />

            {events.length > 0 && (
              <div className="p-5 rounded-xl bg-card border border-card-border">
                <h3 className="text-[14px] font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-primary" />
                  Agent Processing Timeline
                </h3>
                <div className="space-y-2">
                  {events.filter((event: any, idx: number, arr: any[]) => arr.findIndex((e: any) => e.id === event.id) === idx).map((event: any, i: number) => (
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
            <div className={`p-4 rounded-xl border ${
              decision?.finalStatus === "BLOCKED" ? "bg-[#E05252]/5 border-[#E05252]/20" :
              decision?.finalStatus === "REVIEW" ? "bg-[#D4A24C]/5 border-[#D4A24C]/20" :
              decision?.finalStatus === "APPROVED" ? "bg-primary/5 border-primary/20" :
              "bg-card border-card-border"
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" />
                  <h3 className="text-[13px] font-semibold text-foreground">Shipment Decision</h3>
                </div>
                <button
                  onClick={runDecisionEngine}
                  disabled={runningDecision}
                  className="px-2 py-1 text-[10px] font-medium rounded bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 flex items-center gap-1 border border-primary/20"
                >
                  {runningDecision ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  {decision ? "Re-evaluate" : "Compute"}
                </button>
              </div>
              {decision ? (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      decision.finalStatus === "BLOCKED" ? "bg-[#E05252]/10 text-[#E05252]" :
                      decision.finalStatus === "REVIEW" ? "bg-[#D4A24C]/10 text-[#D4A24C]" :
                      decision.finalStatus === "APPROVED" ? "bg-primary/10 text-primary" :
                      "bg-muted text-muted-foreground"
                    }`}>{decision.finalStatus}</span>
                    <span className={`text-[10px] font-medium ${decision.releaseAllowed ? "text-primary" : "text-[#E05252]"}`}>
                      {decision.releaseAllowed ? "Release Allowed" : "Release Blocked"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-3">{decision.decisionReason}</p>

                  {decision.unifiedRisk && (
                    <div className="mb-3 p-2 rounded-lg bg-background/50 border border-border/50">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Unified Risk</p>
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className={`text-lg font-bold tabular-nums ${
                          decision.unifiedRisk.level === "CRITICAL" ? "text-[#E05252]" :
                          decision.unifiedRisk.level === "HIGH" ? "text-[#D4A24C]" :
                          decision.unifiedRisk.level === "MODERATE" ? "text-[#D4A24C]/80" : "text-primary"
                        }`}>{Math.round(decision.unifiedRisk.finalScore)}</span>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                          decision.unifiedRisk.level === "CRITICAL" ? "bg-[#E05252]/10 text-[#E05252]" :
                          decision.unifiedRisk.level === "HIGH" ? "bg-[#D4A24C]/10 text-[#D4A24C]" :
                          decision.unifiedRisk.level === "MODERATE" ? "bg-[#D4A24C]/8 text-[#D4A24C]/80" : "bg-primary/10 text-primary"
                        }`}>{decision.unifiedRisk.level}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-muted-foreground">Base Risk</span>
                          <span className="font-mono text-foreground">{Math.round(decision.unifiedRisk.baseScore)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-muted-foreground">Dynamic Risk</span>
                          <span className="font-mono text-foreground">{Math.round(decision.unifiedRisk.dynamicScore)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {decision.blockReasons?.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[10px] font-semibold text-[#E05252] mb-1">Block Reasons</p>
                      {decision.blockReasons.map((r: string, i: number) => (
                        <p key={i} className="text-[10px] text-[#E05252]/80 leading-relaxed">• {r}</p>
                      ))}
                    </div>
                  )}

                  {decision.reviewReasons?.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[10px] font-semibold text-[#D4A24C] mb-1">Review Reasons</p>
                      {decision.reviewReasons.map((r: string, i: number) => (
                        <p key={i} className="text-[10px] text-[#D4A24C]/80 leading-relaxed">• {r}</p>
                      ))}
                    </div>
                  )}

                  {decision.inputSnapshot && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1">Input Sources</p>
                      <div className="grid grid-cols-2 gap-1">
                        {decision.inputSnapshot.complianceStatus && (
                          <div className="text-[10px]">
                            <span className="text-muted-foreground">Compliance: </span>
                            <span className={decision.inputSnapshot.complianceStatus === "BLOCKED" ? "text-[#E05252]" : decision.inputSnapshot.complianceStatus === "ALERT" ? "text-[#D4A24C]" : "text-primary"}>{decision.inputSnapshot.complianceStatus}</span>
                          </div>
                        )}
                        {decision.inputSnapshot.docValidationStatus && (
                          <div className="text-[10px]">
                            <span className="text-muted-foreground">Docs: </span>
                            <span className={decision.inputSnapshot.docValidationStatus === "BLOCKED" ? "text-[#E05252]" : decision.inputSnapshot.docValidationStatus === "REVIEW" ? "text-[#D4A24C]" : "text-primary"}>{decision.inputSnapshot.docValidationStatus}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {decision.decidedAt && (
                    <p className="text-[9px] text-muted-foreground/60 mt-2">
                      Computed {new Date(decision.decidedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">Click "Compute" to run the decision engine across all agent outputs.</p>
              )}
            </div>

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
                        rec.urgency === "HIGH" ? "border-[#D4A24C]/30 bg-[#D4A24C]/5" :
                        rec.urgency === "MEDIUM" ? "border-[#D4A24C]/20 bg-[#D4A24C]/3" : "border-white/10 bg-white/[0.02]";
                      const urgencyBadge = rec.urgency === "CRITICAL" ? "bg-red-500/20 text-red-300" :
                        rec.urgency === "HIGH" ? "bg-[#D4A24C]/20 text-[#D4A24C]" :
                        rec.urgency === "MEDIUM" ? "bg-[#D4A24C]/15 text-[#D4A24C]/80" : "bg-primary/15 text-primary/80";
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
                              className="px-2 py-0.5 text-[10px] font-medium bg-primary/20 text-primary rounded hover:bg-primary/30 border border-primary/30"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => { setShowModifyModal(rec.id); setModifyNotes(""); }}
                              className="px-2 py-0.5 text-[10px] font-medium bg-primary/15 text-primary/80 rounded hover:bg-primary/20 border border-primary/20"
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
                              <span className={`px-1 py-0.5 text-[9px] uppercase rounded ${rec.status === "ACCEPTED" ? "bg-primary/20 text-primary" : "bg-primary/15 text-primary/80"}`}>
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
                                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-primary/20 text-primary rounded hover:bg-primary/30 border border-primary/30"
                                >
                                  <ClipboardCheck size={10} /> Record Outcome
                                </button>
                                <button
                                  onClick={() => createTaskMutation.mutate(rec.id)}
                                  disabled={createTaskMutation.isPending}
                                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-[#D4A24C]/20 text-[#D4A24C] rounded hover:bg-[#D4A24C]/30 border border-[#D4A24C]/30 disabled:opacity-50"
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
                          <div key={rec.id} className="border border-primary/20 rounded-lg p-3 bg-primary/5 mb-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[12px] font-medium text-foreground">{rec.title}</span>
                              <span className="px-1 py-0.5 text-[9px] uppercase rounded bg-primary/20 text-primary">
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
                <GitCompareArrows className="w-4 h-4 text-primary" />
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
                      <div key={diff.type} className={`border rounded-lg p-3 ${hasChanges ? "border-primary/20 bg-primary/5" : "border-white/10 bg-white/[0.02]"}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-mono font-medium text-foreground">{diff.type}</span>
                          {hasChanges && <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">CHANGED</span>}
                        </div>
                        <p className="text-[10px] text-muted-foreground mb-2">{diff.triggerSummary}</p>
                        {diff.scoreDelta && (
                          <div className="flex flex-wrap gap-2 text-[10px]">
                            {diff.scoreDelta.confidence !== 0 && (
                              <span className={`flex items-center gap-0.5 ${diff.scoreDelta.confidence > 0 ? "text-primary" : "text-[#E05252]"}`}>
                                {diff.scoreDelta.confidence > 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                                Conf: {diff.scoreDelta.confidence > 0 ? "+" : ""}{diff.scoreDelta.confidence}
                              </span>
                            )}
                            {diff.scoreDelta.delayImpact !== 0 && (
                              <span className={`flex items-center gap-0.5 ${diff.scoreDelta.delayImpact < 0 ? "text-primary" : "text-[#E05252]"}`}>
                                {diff.scoreDelta.delayImpact < 0 ? <ArrowDownRight size={10} /> : <ArrowUpRight size={10} />}
                                Delay: {diff.scoreDelta.delayImpact > 0 ? "+" : ""}{diff.scoreDelta.delayImpact}d
                              </span>
                            )}
                            {diff.scoreDelta.marginImpact !== 0 && (
                              <span className={`flex items-center gap-0.5 ${diff.scoreDelta.marginImpact > 0 ? "text-primary" : "text-[#E05252]"}`}>
                                {diff.scoreDelta.marginImpact > 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                                Margin: {diff.scoreDelta.marginImpact > 0 ? "+" : ""}{diff.scoreDelta.marginImpact}%
                              </span>
                            )}
                            {diff.scoreDelta.riskReduction !== 0 && (
                              <span className={`flex items-center gap-0.5 ${diff.scoreDelta.riskReduction > 0 ? "text-primary" : "text-[#E05252]"}`}>
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

            <div className="p-4 rounded-xl bg-card border border-card-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <h3 className="text-[13px] font-semibold text-foreground">Compliance</h3>
                </div>
                <button
                  onClick={runComplianceCheck}
                  disabled={runningCompliance}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  {runningCompliance ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  {runningCompliance ? "Running..." : compliance ? "Re-Run Check" : "Run Compliance Check"}
                </button>
              </div>
              {compliance ? (
                <>
                  <div className={`flex items-center gap-1.5 text-[14px] font-semibold ${compliance.status === "CLEAR" ? "text-primary" : compliance.status === "ALERT" ? "text-[#D4A24C]" : "text-[#E05252]"}`}>
                    {compliance.status === "CLEAR" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {compliance.status}
                  </div>
                  <div className="flex gap-4 mt-2 text-[11px] text-muted-foreground">
                    <span>{compliance.screenedParties ?? 0} parties screened</span>
                    <span>{compliance.matchCount ?? 0} matches</span>
                  </div>
                  {compliance.matches && compliance.matches.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {(compliance.matches as any[]).map((m: any, i: number) => (
                        <div key={i} className="text-[11px] px-2 py-1.5 rounded bg-[#E05252]/10 text-[#E05252] border border-[#E05252]/20">
                          {m.matchedEntry || m.entityName || "Unknown"} — {m.listName || "Sanctions List"} ({m.matchType || "fuzzy"})
                        </div>
                      ))}
                    </div>
                  )}
                  {compliance.screenedAt && (
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Screened {new Date(compliance.screenedAt).toLocaleString()}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-[12px] text-muted-foreground">No screening completed yet. Click "Run Compliance Check" to screen all parties.</p>
              )}
            </div>

            {risk && (
              <div className="p-4 rounded-xl bg-card border border-card-border">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-[#D4A24C]" />
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
                                className={`h-full rounded-full ${normalized < 30 ? "bg-primary" : normalized < 60 ? "bg-[#D4A24C]" : "bg-[#E05252]"}`}
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
                  <ClipboardCheck className="w-4 h-4 text-primary" />
                  <h3 className="text-[13px] font-semibold text-foreground">Document Validation</h3>
                </div>
                <button
                  onClick={runDocValidationCheck}
                  disabled={runningDocValidation}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  {runningDocValidation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  {runningDocValidation ? "Validating..." : docValidation ? "Re-Run Validation" : "Run Document Validation"}
                </button>
              </div>
              {docValidation ? (
                <>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`flex items-center gap-1.5 text-[14px] font-semibold ${docValidation.status === "READY" ? "text-primary" : docValidation.status === "REVIEW" ? "text-[#D4A24C]" : "text-[#E05252]"}`}>
                      {docValidation.status === "READY" ? <CheckCircle2 className="w-4 h-4" /> : docValidation.status === "REVIEW" ? <AlertCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      {docValidation.status}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${docValidation.readinessLevel === "COMPLETE" ? "bg-primary/10 text-primary" : docValidation.readinessLevel === "PARTIAL" ? "bg-[#D4A24C]/10 text-[#D4A24C]" : "bg-[#E05252]/10 text-[#E05252]"}`}>
                      {docValidation.readinessLevel}
                    </span>
                  </div>

                  {docValidation.missingDocuments?.length > 0 && (
                    <div className="mb-2">
                      <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Missing Documents</h4>
                      <div className="space-y-1">
                        {(docValidation.missingDocuments as any[]).map((d: any, i: number) => (
                          <div key={i} className={`text-[11px] px-2 py-1.5 rounded ${d.severity === "CRITICAL" ? "bg-[#E05252]/10 text-[#E05252] border border-[#E05252]/20" : "bg-[#D4A24C]/10 text-[#D4A24C] border border-[#D4A24C]/20"}`}>
                            {d.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {docValidation.missingFields?.length > 0 && (
                    <div className="mb-2">
                      <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Missing Fields</h4>
                      <div className="space-y-1">
                        {(docValidation.missingFields as any[]).slice(0, 5).map((f: any, i: number) => (
                          <div key={i} className={`text-[11px] px-2 py-1.5 rounded ${f.severity === "CRITICAL" ? "bg-[#E05252]/10 text-[#E05252] border border-[#E05252]/20" : "bg-[#D4A24C]/10 text-[#D4A24C] border border-[#D4A24C]/20"}`}>
                            {f.field} — {f.documentType || "document"}
                          </div>
                        ))}
                        {docValidation.missingFields.length > 5 && (
                          <p className="text-[10px] text-muted-foreground">+{docValidation.missingFields.length - 5} more</p>
                        )}
                      </div>
                    </div>
                  )}

                  {docValidation.inconsistencies?.length > 0 && (
                    <div className="mb-2">
                      <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Inconsistencies</h4>
                      <div className="space-y-1">
                        {(docValidation.inconsistencies as any[]).map((inc: any, i: number) => (
                          <div key={i} className="text-[11px] px-2 py-1.5 rounded bg-[#D4A24C]/10 text-[#D4A24C] border border-[#D4A24C]/20">
                            {inc.field}: {inc.values?.join(" vs ")}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {docValidation.suspiciousFindings?.length > 0 && (
                    <div className="mb-2">
                      <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Suspicious Findings</h4>
                      <div className="space-y-1">
                        {(docValidation.suspiciousFindings as any[]).map((s: any, i: number) => (
                          <div key={i} className={`text-[11px] px-2 py-1.5 rounded ${s.severity === "CRITICAL" ? "bg-[#E05252]/10 text-[#E05252] border border-[#E05252]/20" : "bg-[#D4A24C]/10 text-[#D4A24C] border border-[#D4A24C]/20"}`}>
                            <span className="font-semibold">{s.title}</span>
                            {s.detail && <span className="block mt-0.5 opacity-80">{s.detail}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {docValidation.reasoningSummary && (
                    <div className="mt-2 p-2 rounded bg-secondary/30 border border-border/50">
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{docValidation.reasoningSummary}</p>
                    </div>
                  )}

                  {docValidation.recommendedActions?.length > 0 && (
                    <div className="mt-2">
                      <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Recommended Actions</h4>
                      <ul className="space-y-1">
                        {(docValidation.recommendedActions as string[]).map((a: string, i: number) => (
                          <li key={i} className="text-[11px] text-muted-foreground flex gap-1.5">
                            <span className="text-primary shrink-0">•</span>
                            <span>{a}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {docValidation.validatedAt && (
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Validated {new Date(docValidation.validatedAt).toLocaleString()}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-[12px] text-muted-foreground">No validation completed yet. Click "Run Document Validation" to check documentation completeness.</p>
              )}
            </div>

            <div className="p-4 rounded-xl bg-card border border-card-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-primary" />
                  <h3 className="text-[13px] font-semibold text-foreground">Routing & Pricing</h3>
                </div>
                <button
                  onClick={runRoutingPricingCheck}
                  disabled={runningRoutingPricing}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  {runningRoutingPricing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  {runningRoutingPricing ? "Analyzing..." : routingPricing ? "Re-Analyze Routes" : "Generate Route & Pricing"}
                </button>
              </div>
              {routingPricing ? (
                <>
                  {routingPricing.recommendationSummary && (
                    <div className="mb-3 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-[11px] text-foreground leading-relaxed">{routingPricing.recommendationSummary}</p>
                    </div>
                  )}

                  <div className="space-y-2 mb-3">
                    {(routingPricing.routeOptions as any[])?.map((route: any, i: number) => {
                      const isRecommended = i === Number(routingPricing.recommendedRouteIndex);
                      const isExpanded = expandedRoute === i;
                      return (
                        <div key={i} className={`rounded-lg border ${isRecommended ? "border-primary/40 bg-primary/5" : "border-card-border bg-card"}`}>
                          <button
                            onClick={() => setExpandedRoute(isExpanded ? null : i)}
                            className="w-full text-left p-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <MapPin className={`w-3.5 h-3.5 ${isRecommended ? "text-primary" : "text-muted-foreground"}`} />
                                <span className="text-[12px] font-semibold text-foreground">{route.label}</span>
                                {isRecommended && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-bold uppercase">Recommended</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-[11px] font-semibold text-foreground">${route.estimatedCost?.toLocaleString()}</span>
                                <span className="text-[10px] text-muted-foreground">{route.totalTransitDays}d</span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${route.costConfidence === "HIGH" ? "bg-primary/10 text-primary" : route.costConfidence === "MEDIUM" ? "bg-[#D4A24C]/10 text-[#D4A24C]" : "bg-[#E05252]/10 text-[#E05252]"}`}>
                                  {route.costConfidence}
                                </span>
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${route.type === "DIRECT" ? "bg-primary/10 text-primary" : route.type === "TRANSSHIPMENT" ? "bg-[#D4A24C]/10 text-[#D4A24C]" : "bg-blue-500/10 text-blue-400"}`}>
                                {route.type}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {route.legs?.map((l: any) => l.from).join(" → ")} → {route.legs?.[route.legs.length - 1]?.to}
                              </span>
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="px-3 pb-3 space-y-2 border-t border-card-border/50 pt-2">
                              <div>
                                <h5 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Route Legs</h5>
                                <div className="space-y-1">
                                  {(route.legs as any[])?.map((leg: any, li: number) => (
                                    <div key={li} className="flex items-center gap-2 text-[11px] text-foreground">
                                      <span className="text-muted-foreground">{leg.from}</span>
                                      <span className="text-primary">→</span>
                                      <span className="text-muted-foreground">{leg.to}</span>
                                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary/50 text-muted-foreground">{leg.mode}</span>
                                      <span className="text-[10px] text-muted-foreground ml-auto">{leg.transitDays}d</span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <h5 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Cost Breakdown</h5>
                                <div className="space-y-0.5">
                                  {(route.costBreakdown as any[])?.map((cb: any, ci: number) => (
                                    <div key={ci} className="flex items-center justify-between text-[11px]">
                                      <span className="text-muted-foreground">{cb.label}</span>
                                      <span className="text-foreground font-medium">${cb.amount.toLocaleString()}</span>
                                    </div>
                                  ))}
                                  <div className="flex items-center justify-between text-[11px] font-semibold border-t border-card-border/50 pt-1 mt-1">
                                    <span className="text-foreground">Total</span>
                                    <span className="text-primary">${route.estimatedCost?.toLocaleString()}</span>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground">
                                    Range: ${route.costRange?.low?.toLocaleString()} – ${route.costRange?.high?.toLocaleString()}
                                  </p>
                                </div>
                              </div>

                              {route.advantages?.length > 0 && (
                                <div>
                                  <h5 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Advantages</h5>
                                  <ul className="space-y-0.5">
                                    {(route.advantages as string[]).map((a: string, ai: number) => (
                                      <li key={ai} className="text-[11px] text-muted-foreground flex gap-1.5">
                                        <span className="text-primary shrink-0">+</span>
                                        <span>{a}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {route.disadvantages?.length > 0 && (
                                <div>
                                  <h5 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Disadvantages</h5>
                                  <ul className="space-y-0.5">
                                    {(route.disadvantages as string[]).map((d: string, di: number) => (
                                      <li key={di} className="text-[11px] text-muted-foreground flex gap-1.5">
                                        <span className="text-[#E05252] shrink-0">−</span>
                                        <span>{d}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {routingPricing.riskFactors?.length > 0 && (
                    <div className="mb-2">
                      <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Risk Factors</h4>
                      <div className="space-y-1">
                        {(routingPricing.riskFactors as any[]).map((rf: any, i: number) => (
                          <div key={i} className={`text-[11px] px-2 py-1.5 rounded ${rf.severity === "HIGH" ? "bg-[#E05252]/10 text-[#E05252] border border-[#E05252]/20" : rf.severity === "MEDIUM" ? "bg-[#D4A24C]/10 text-[#D4A24C] border border-[#D4A24C]/20" : "bg-secondary/50 text-muted-foreground border border-border/30"}`}>
                            <span className="font-semibold">{rf.title}</span>
                            <span className="block mt-0.5 opacity-80">{rf.detail}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {routingPricing.reasoning && (
                    <div className="mt-2 p-2 rounded bg-secondary/30 border border-border/50">
                      <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Analysis</h4>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{routingPricing.reasoning}</p>
                    </div>
                  )}

                  {routingPricing.analyzedAt && (
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Analyzed {new Date(routingPricing.analyzedAt).toLocaleString()}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-[12px] text-muted-foreground">No routing analysis yet. Click "Generate Route & Pricing" to evaluate route options and cost estimates.</p>
              )}
            </div>

            <div className="p-4 rounded-xl bg-card border border-card-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" />
                  <h3 className="text-[13px] font-semibold text-foreground">Pre-Shipment Risk</h3>
                </div>
                <button
                  onClick={evaluatePreShipmentRisk}
                  disabled={evaluatingRisk}
                  className="px-2 py-1 text-[10px] font-medium rounded bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 flex items-center gap-1 border border-primary/20"
                >
                  {evaluatingRisk ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  {predictiveRisk ? "Re-evaluate" : "Evaluate"}
                </button>
              </div>
              {predictiveRisk ? (
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`text-2xl font-bold tabular-nums ${
                      predictiveRisk.riskLevel === "CRITICAL" ? "text-[#E05252]" :
                      predictiveRisk.riskLevel === "HIGH" ? "text-[#D4A24C]" :
                      predictiveRisk.riskLevel === "MODERATE" ? "text-[#D4A24C]/80" : "text-primary"
                    }`}>
                      {Math.round(predictiveRisk.overallRiskScore * 100)}
                    </span>
                    <div>
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                        predictiveRisk.riskLevel === "CRITICAL" ? "bg-[#E05252]/10 text-[#E05252]" :
                        predictiveRisk.riskLevel === "HIGH" ? "bg-[#D4A24C]/10 text-[#D4A24C]" :
                        predictiveRisk.riskLevel === "MODERATE" ? "bg-[#D4A24C]/8 text-[#D4A24C]/80" : "bg-primary/10 text-primary"
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
                                className={`h-full rounded-full ${comp.score < 0.3 ? "bg-primary" : comp.score < 0.6 ? "bg-[#D4A24C]" : "bg-[#E05252]"}`}
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
                  {(() => {
                    if (!weatherContext?.portWeather) return null;
                    const adversePorts = Object.values(weatherContext.portWeather as Record<string, any>).filter((pw: any) => {
                      if (!pw.live) return false;
                      const beaufort = pw.live.seaState?.windBeaufort ?? 0;
                      const risk = pw.live.seaState?.operationalRisk;
                      return beaufort >= 4 || risk === "high" || risk === "critical";
                    });
                    if (adversePorts.length === 0) return null;
                    return (
                      <div className="mt-2 pt-2 border-t border-border">
                        {adversePorts.map((pw: any) => (
                          <p key={pw.portCode} className="text-[10px] text-[#D4A24C] leading-relaxed">
                            Weather signal: {pw.live?.seaState?.description ?? "Adverse conditions"} at {pw.portCode} (+{Math.min(Math.round((pw.live?.seaState?.windBeaufort ?? 4) * 0.5), 5)} risk pts)
                          </p>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">Click evaluate to assess pre-shipment risk</p>
              )}
            </div>

            <div className="p-4 rounded-xl bg-card border border-card-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Radar className="w-4 h-4 text-primary" />
                  <h3 className="text-[13px] font-semibold text-foreground">Port Weather</h3>
                </div>
                {weatherContext?.hasLiveData && (
                  <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    Live · OpenWeather
                  </span>
                )}
              </div>
              {weatherContext && Object.keys(weatherContext.portWeather || {}).length > 0 ? (
                <div className="space-y-3">
                  {Object.values(weatherContext.portWeather).map((pw: any) => (
                    <div key={pw.portCode} className="space-y-1.5">
                      <p className="text-[11px] font-medium text-foreground">{pw.portName} ({pw.portCode})</p>
                      {pw.live ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground">Conditions</span>
                            <span className="text-foreground capitalize">{pw.live?.current?.description ?? "N/A"}</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground">Temperature</span>
                            <span className="text-foreground">{pw.live?.current?.tempC != null ? `${pw.live.current.tempC}°C` : "N/A"}</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground">Wind</span>
                            <span className="text-foreground">{pw.live?.current?.windSpeedKmh ?? "N/A"} km/h{pw.live?.seaState?.windBeaufort != null ? ` (Beaufort ${pw.live.seaState.windBeaufort})` : ""}</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground">Sea State</span>
                            <span className={`font-medium ${
                              pw.live?.seaState?.operationalRisk === "critical" ? "text-[#E05252]" :
                              pw.live?.seaState?.operationalRisk === "high" ? "text-[#D4A24C]" :
                              pw.live?.seaState?.operationalRisk === "moderate" ? "text-[#D4A24C]/80" : "text-primary"
                            }`}>{pw.live?.seaState?.description ?? "N/A"}</span>
                          </div>
                          {pw.live?.alerts && pw.live.alerts.length > 0 && (
                            <div className="mt-1 pt-1 border-t border-border">
                              {pw.live.alerts.map((a: any, i: number) => (
                                <p key={i} className="text-[10px] text-[#D4A24C]">⚠ {a.event}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : pw.seededEvents && pw.seededEvents.length > 0 ? (
                        <div className="space-y-1">
                          {pw.seededEvents.map((ev: any) => (
                            <div key={ev.id} className="flex items-center justify-between text-[10px]">
                              <span className="text-muted-foreground capitalize">{ev.eventType}</span>
                              <span className={`font-medium ${
                                ev.severity === "critical" ? "text-[#E05252]" :
                                ev.severity === "high" ? "text-[#D4A24C]" :
                                ev.severity === "medium" ? "text-[#D4A24C]/80" : "text-muted-foreground"
                              }`}>{ev.severity}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground">No active weather alerts</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">Weather data unavailable</p>
              )}
            </div>

            {readiness && readiness.shipmentId && (
              <div className="p-4 rounded-xl bg-card border border-card-border">
                <div className="flex items-center gap-2 mb-3">
                  <ClipboardCheck className="w-4 h-4 text-primary" />
                  <h3 className="text-[13px] font-semibold text-foreground">Readiness</h3>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-2xl font-bold tabular-nums ${
                    readiness.readinessLevel === "READY" ? "text-primary" :
                    readiness.readinessLevel === "NEEDS_ATTENTION" ? "text-[#D4A24C]" : "text-[#E05252]"
                  }`}>
                    {Math.round(readiness.overallScore * 100)}%
                  </span>
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                    readiness.readinessLevel === "READY" ? "bg-primary/10 text-primary" :
                    readiness.readinessLevel === "NEEDS_ATTENTION" ? "bg-[#D4A24C]/10 text-[#D4A24C]" : "bg-[#E05252]/10 text-[#E05252]"
                  }`}>{readiness.readinessLevel?.replace(/_/g, " ")}</span>
                </div>
                {readiness.components && (
                  <div className="space-y-1.5">
                    {Object.entries(readiness.components).map(([key, comp]: [string, any]) => (
                      <div key={key} className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                        <span className={`font-medium ${
                          comp.status === "READY" ? "text-primary" :
                          comp.status === "NEEDS_ATTENTION" ? "text-[#D4A24C]" : "text-[#E05252]"
                        }`}>{Math.round(comp.score * 100)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="p-4 rounded-xl bg-card border border-card-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-primary/70" />
                  <h3 className="text-[13px] font-semibold text-foreground">Booking Decision</h3>
                </div>
                <button
                  onClick={runBookingDecision}
                  disabled={evaluatingBooking}
                  className="px-2 py-1 text-[10px] font-medium rounded bg-primary/10 text-primary/80 hover:bg-primary/20 disabled:opacity-50 flex items-center gap-1 border border-primary/20"
                >
                  {evaluatingBooking ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  {bookingDecision ? "Re-evaluate" : "Evaluate"}
                </button>
              </div>
              {bookingDecision ? (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      bookingDecision.status === "APPROVED" ? "bg-primary/10 text-primary" :
                      bookingDecision.status === "APPROVED_WITH_CAUTION" ? "bg-[#D4A24C]/10 text-[#D4A24C]" :
                      bookingDecision.status === "BLOCKED" ? "bg-[#E05252]/10 text-[#E05252]" :
                      bookingDecision.status === "RECOMMEND_ALTERNATIVE" ? "bg-primary/10 text-primary" :
                      "bg-[#D4A24C]/10 text-[#D4A24C]"
                    }`}>{bookingDecision.status.replace(/_/g, " ")}</span>
                    <span className="text-[10px] text-muted-foreground">
                      Confidence: {Math.round(bookingDecision.confidence * 100)}%
                    </span>
                  </div>
                  {bookingDecision.reasonCodes?.length > 0 && (
                    <div className="space-y-0.5 mb-2">
                      {bookingDecision.reasonCodes.slice(0, 4).map((r: string, i: number) => (
                        <p key={i} className="text-[10px] text-[#D4A24C]/80">• {r.replace(/_/g, " ")}</p>
                      ))}
                    </div>
                  )}
                  {bookingDecision.requiredActions?.length > 0 && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-[10px] text-muted-foreground mb-1">Required Actions:</p>
                      {bookingDecision.requiredActions.slice(0, 3).map((a: string, i: number) => (
                        <p key={i} className="text-[10px] text-foreground">→ {a}</p>
                      ))}
                    </div>
                  )}
                  {bookingDecision.recommendedAlternatives?.length > 0 && (
                    <div className="pt-2 mt-2 border-t border-border">
                      <p className="text-[10px] text-muted-foreground mb-1">Alternatives:</p>
                      {bookingDecision.recommendedAlternatives.map((alt: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-[10px] mb-0.5">
                          <span className="text-primary">{alt.type.replace(/_/g, " ")}</span>
                          <span className="text-primary">-{Math.round(alt.estimatedRiskReduction * 100)}% risk</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">Click evaluate to get a booking decision</p>
              )}
            </div>

            <div className="p-4 rounded-xl bg-card border border-card-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#D4A24C]" />
                  <h3 className="text-[13px] font-semibold text-foreground">Release Gates</h3>
                </div>
                <button
                  onClick={runReleaseGates}
                  disabled={evaluatingGates}
                  className="px-2 py-1 text-[10px] font-medium rounded bg-[#D4A24C]/10 text-[#D4A24C] hover:bg-[#D4A24C]/20 disabled:opacity-50 flex items-center gap-1 border border-[#D4A24C]/20"
                >
                  {evaluatingGates ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Check Gates
                </button>
              </div>
              {gateHolds.length > 0 ? (
                <div className="space-y-2">
                  {gateHolds.map((hold: any) => (
                    <div key={hold.id} className="p-2 rounded-lg bg-background border border-border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-foreground">{hold.gateType?.replace(/_/g, " ")}</span>
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                          hold.severity === "CRITICAL" ? "bg-[#E05252]/10 text-[#E05252]" :
                          hold.severity === "HIGH" ? "bg-[#D4A24C]/10 text-[#D4A24C]" :
                          "bg-[#D4A24C]/10 text-[#D4A24C]"
                        }`}>{hold.severity}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{hold.reason}</p>
                      <p className="text-[10px] text-primary/70 mt-0.5">→ {hold.requiredAction}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {decision?.releaseAllowed === true ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                      <p className="text-[11px] text-primary">No active holds — clear to proceed</p>
                    </>
                  ) : decision?.releaseAllowed === false ? (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 text-[#E05252]" />
                      <p className="text-[11px] text-[#E05252]">Release blocked by decision engine — resolve issues above</p>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5 text-[#D4A24C]" />
                      <p className="text-[11px] text-[#D4A24C]">No decision computed — run decision engine to determine release status</p>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-card border border-card-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <GitCompareArrows className="w-4 h-4 text-primary" />
                  <h3 className="text-[13px] font-semibold text-foreground">Scenario Comparison</h3>
                </div>
                <button
                  onClick={runScenarioComparison}
                  disabled={evaluatingScenarios}
                  className="px-2 py-1 text-[10px] font-medium rounded bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 flex items-center gap-1 border border-primary/20"
                >
                  {evaluatingScenarios ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Compare
                </button>
              </div>
              {scenarioComparison ? (
                <div>
                  <div className="p-2 rounded-lg bg-background border border-border mb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-foreground">{scenarioComparison.baseline?.label || scenarioComparison.baselineScenario?.label || "Current Plan"}</span>
                      <span className="text-[10px] font-mono text-foreground">
                        Risk: {Math.round(((scenarioComparison.baseline?.riskScore ?? scenarioComparison.baselineScenario?.riskScore ?? 0) * 100))}
                      </span>
                    </div>
                  </div>
                  {(scenarioComparison.alternatives || scenarioComparison.alternativeScenarios || []).map((alt: any, i: number) => (
                    <div key={i} className={`p-2 rounded-lg border mb-1.5 ${
                      (scenarioComparison.bestAlternative === alt.scenarioType)
                        ? "border-primary/30 bg-primary/5" : "border-border bg-background"
                    }`}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-semibold text-foreground">{alt.label}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-mono ${alt.riskDelta < 0 ? "text-primary" : "text-[#E05252]"}`}>
                            {alt.riskDelta < 0 ? "↓" : "↑"}{Math.abs(Math.round(alt.riskDelta * 100))}
                          </span>
                          {scenarioComparison.bestAlternative === alt.scenarioType && (
                            <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-primary/10 text-primary">BEST</span>
                          )}
                        </div>
                      </div>
                      <p className="text-[9px] text-muted-foreground">{alt.recommendation}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">Click compare to evaluate alternatives</p>
              )}
            </div>

            {playbooks.length > 0 && (
              <div className="p-4 rounded-xl bg-card border border-card-border">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <h3 className="text-[13px] font-semibold text-foreground">Mitigation Playbooks</h3>
                </div>
                <div className="space-y-2">
                  {playbooks.slice(0, 5).map((pb: any) => (
                    <div key={pb.id} className="p-2 rounded-lg bg-background border border-border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-foreground">{pb.triggerCondition?.replace(/_/g, " ")}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                          pb.priority === "CRITICAL" ? "bg-[#E05252]/10 text-[#E05252]" :
                          pb.priority === "HIGH" ? "bg-[#D4A24C]/10 text-[#D4A24C]" :
                          "bg-[#D4A24C]/10 text-[#D4A24C]"
                        }`}>{pb.priority}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${pb.totalSteps > 0 ? (pb.completedSteps / pb.totalSteps) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-muted-foreground font-mono">{pb.completedSteps}/{pb.totalSteps}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {insurance && (
              <div className="p-4 rounded-xl bg-card border border-card-border">
                <div className="flex items-center gap-2 mb-3">
                  <Umbrella className="w-4 h-4 text-primary" />
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
                    <span className="font-semibold text-primary">{formatCurrency(insurance.estimatedPremium, insurance.currency)}</span>
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
                  <div className="flex items-center gap-2 mb-3 text-primary">
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
                    className="w-full p-3 rounded-lg bg-background border border-card-border focus:border-primary/40 outline-none resize-none h-28 text-[13px] mb-4"
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
                      className="px-4 py-2 rounded-lg text-[13px] font-medium bg-primary hover:bg-primary/90 text-white disabled:opacity-50 transition-colors"
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
    DRAFT: "bg-primary/10 text-primary",
    PENDING_REVIEW: "bg-[#D4A24C]/10 text-[#D4A24C]",
    APPROVED: "bg-primary/10 text-primary",
    REJECTED: "bg-[#E05252]/10 text-red-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${styles[status] || "bg-muted text-muted-foreground"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
