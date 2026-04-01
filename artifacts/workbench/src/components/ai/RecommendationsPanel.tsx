import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Shield,
  Clock,
  FileWarning,
  Route,
  Truck,
  DollarSign,
  Check,
  X,
  Pencil,
  Zap,
  Globe,
  TrendingUp,
  EyeOff,
  ChevronDown,
  ChevronUp,
  ListTodo,
  Loader2,
  HandMetal,
  Megaphone,
  ClipboardList,
  ArrowUpCircle,
  RefreshCw,
  Pause,
  Play,
} from "lucide-react";
import {
  useRecommendationsWithTasks,
  useAcceptRecommendation,
  useRejectRecommendation,
  useModifyRecommendation,
  useIgnoreRecommendation,
} from "../../hooks/use-ai-runtime";

const typeIcons: Record<string, typeof AlertTriangle> = {
  COMPLIANCE_ESCALATION: Shield,
  RISK_MITIGATION: AlertTriangle,
  DELAY_WARNING: Clock,
  DELAY_MITIGATION: Clock,
  MARGIN_WARNING: DollarSign,
  DOCUMENT_CORRECTION: FileWarning,
  ROUTE_ADJUSTMENT: Route,
  CARRIER_SWITCH: Truck,
  INSURANCE_ADJUSTMENT: Shield,
  PRICING_ALERT: TrendingUp,
  SHIPMENT_HOLD: Pause,
  SHIPMENT_RELEASE: Play,
  CUSTOMER_COMMUNICATION: Megaphone,
  CLAIMS_READINESS: ClipboardList,
  QUEUE_REPRIORITIZATION: ArrowUpCircle,
  WORKFLOW_ESCALATION: ArrowUpCircle,
  OPERATIONAL_FOLLOWUP: RefreshCw,
};

const typeLabels: Record<string, string> = {
  COMPLIANCE_ESCALATION: "Compliance",
  RISK_MITIGATION: "Risk",
  DELAY_WARNING: "Delay",
  DELAY_MITIGATION: "Delay Fix",
  MARGIN_WARNING: "Margin",
  DOCUMENT_CORRECTION: "Document",
  ROUTE_ADJUSTMENT: "Route",
  CARRIER_SWITCH: "Carrier",
  INSURANCE_ADJUSTMENT: "Insurance",
  PRICING_ALERT: "Pricing",
  SHIPMENT_HOLD: "Hold",
  SHIPMENT_RELEASE: "Release",
  CUSTOMER_COMMUNICATION: "Comms",
  CLAIMS_READINESS: "Claims",
  QUEUE_REPRIORITIZATION: "Queue",
  WORKFLOW_ESCALATION: "Escalation",
  OPERATIONAL_FOLLOWUP: "Follow-up",
};

const urgencyColors: Record<string, string> = {
  CRITICAL: "border-[#E05252]/30 bg-[#E05252]/5",
  HIGH: "border-[#D4A24C]/30 bg-[#D4A24C]/5",
  MEDIUM: "border-[#D4A24C]/15 bg-[#D4A24C]/3",
  LOW: "border-primary/20 bg-primary/3",
};

const urgencyDotColors: Record<string, string> = {
  CRITICAL: "bg-[#E05252]",
  HIGH: "bg-[#D4A24C]",
  MEDIUM: "bg-[#D4A24C]/60",
  LOW: "bg-primary/60",
};

const urgencyBadgeColors: Record<string, string> = {
  CRITICAL: "bg-[#E05252]/15 text-[#E05252] border-[#E05252]/30",
  HIGH: "bg-[#D4A24C]/15 text-[#D4A24C] border-[#D4A24C]/30",
  MEDIUM: "bg-[#D4A24C]/8 text-[#D4A24C]/70 border-[#D4A24C]/20",
  LOW: "bg-primary/8 text-primary/70 border-primary/20",
};

const statusBadgeColors: Record<string, string> = {
  ACCEPTED: "bg-primary/15 text-primary border-primary/30",
  MODIFIED: "bg-primary/10 text-primary/70 border-primary/25",
  REJECTED: "bg-[#E05252]/15 text-[#E05252] border-[#E05252]/30",
  IMPLEMENTED: "bg-primary/20 text-primary border-primary/40",
  IGNORED: "bg-black/[0.04] text-foreground/40 border-black/[0.08]",
  EXPIRED: "bg-black/[0.04] text-foreground/35 border-black/[0.06]",
  SUPERSEDED: "bg-black/[0.04] text-foreground/35 border-black/[0.06]",
};

const taskStatusColors: Record<string, string> = {
  OPEN: "text-[#D4A24C]",
  IN_PROGRESS: "text-primary",
  BLOCKED: "text-[#E05252]",
  COMPLETED: "text-primary/60",
  CANCELLED: "text-foreground/40",
};

interface LinkedTask {
  id: string;
  status: string;
  taskType: string;
  priority: string;
  priorityReason: string | null;
  assignedTo: string | null;
}

interface RecWithTask {
  id: string;
  shipmentId: string;
  type: string;
  title: string;
  explanation: string;
  reasonCodes: string[];
  confidence: number;
  urgency: string;
  expectedDelayImpactDays: number | null;
  expectedMarginImpactPct: number | null;
  expectedRiskReduction: number | null;
  recommendedAction: string;
  status: string;
  sourceAgent: string;
  intelligenceEnriched?: string | null;
  createdAt: string;
  respondedAt?: string | null;
  linkedTask: LinkedTask | null;
}

export function RecommendationsPanel({ shipmentId }: { shipmentId: string }) {
  const { data: recs, isLoading, error } = useRecommendationsWithTasks(shipmentId);
  const acceptMut = useAcceptRecommendation(shipmentId);
  const rejectMut = useRejectRecommendation(shipmentId);
  const modifyMut = useModifyRecommendation(shipmentId);
  const ignoreMut = useIgnoreRecommendation(shipmentId);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modifyModalId, setModifyModalId] = useState<string | null>(null);
  const [modifyNotes, setModifyNotes] = useState("");
  const [showResolved, setShowResolved] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-foreground/40">
        <Loader2 size={16} className="animate-spin mr-2" />
        <span className="text-xs">Loading recommendations…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-[#E05252]/70 py-4 text-center">
        Failed to load recommendations
      </div>
    );
  }

  const allRecs = (recs as RecWithTask[]) || [];
  const activeRecs = allRecs.filter(
    (r) => r.status === "PENDING" || r.status === "SHOWN",
  );
  const resolvedRecs = allRecs.filter(
    (r) => r.status !== "PENDING" && r.status !== "SHOWN",
  );

  const handleModifySubmit = () => {
    if (modifyModalId && modifyNotes.trim()) {
      modifyMut.mutate({ recId: modifyModalId, modificationNotes: modifyNotes });
      setModifyModalId(null);
      setModifyNotes("");
    }
  };

  const renderRec = (rec: RecWithTask) => {
    const Icon = typeIcons[rec.type] || Zap;
    const isPending = rec.status === "PENDING" || rec.status === "SHOWN";
    const isExpanded = expandedId === rec.id;
    const isMutating =
      acceptMut.isPending || rejectMut.isPending || modifyMut.isPending || ignoreMut.isPending;

    return (
      <motion.div
        key={rec.id}
        layout
        className={`border rounded-lg p-3 transition-all ${
          isPending
            ? urgencyColors[rec.urgency] || urgencyColors.LOW
            : "border-black/[0.06] bg-black/[0.01]"
        }`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
      >
        <div className="flex items-start gap-2.5">
          <div className={`mt-0.5 ${isPending ? "" : "opacity-40"}`}>
            <Icon size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  urgencyDotColors[rec.urgency] || urgencyDotColors.LOW
                }`}
              />
              <h4 className={`text-[13px] font-medium truncate ${isPending ? "text-foreground" : "text-foreground/50"}`}>
                {rec.title}
              </h4>
            </div>

            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span
                className={`px-1.5 py-0.5 text-[9px] font-semibold uppercase rounded border ${
                  urgencyBadgeColors[rec.urgency] || urgencyBadgeColors.LOW
                }`}
              >
                {rec.urgency}
              </span>
              <span className="px-1.5 py-0.5 text-[9px] font-medium rounded bg-black/[0.04] text-foreground/50 border border-black/[0.06]">
                {typeLabels[rec.type] || rec.type}
              </span>
              {rec.intelligenceEnriched === "true" && (
                <span className="flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-semibold uppercase rounded border bg-primary/15 text-primary border-primary/30">
                  <Globe size={8} /> Intel
                </span>
              )}
              {!isPending && (
                <span
                  className={`px-1.5 py-0.5 text-[9px] font-semibold uppercase rounded border ${
                    statusBadgeColors[rec.status] || "bg-black/[0.04] text-foreground/50 border-black/[0.06]"
                  }`}
                >
                  {rec.status}
                </span>
              )}
            </div>

            <p className={`text-[11px] mt-1.5 line-clamp-2 ${isPending ? "text-foreground/60" : "text-foreground/40"}`}>
              {rec.explanation}
            </p>

            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-foreground/40">
              <span>Conf: {(rec.confidence * 100).toFixed(0)}%</span>
              {rec.expectedDelayImpactDays != null && (
                <span>
                  Delay: {rec.expectedDelayImpactDays > 0 ? "+" : ""}
                  {rec.expectedDelayImpactDays}d
                </span>
              )}
              {rec.expectedMarginImpactPct != null && (
                <span>
                  Margin: {rec.expectedMarginImpactPct > 0 ? "+" : ""}
                  {Number(rec.expectedMarginImpactPct).toFixed(1)}%
                </span>
              )}
            </div>

            {rec.linkedTask && (
              <div className="flex items-center gap-1.5 mt-1.5 text-[10px]">
                <ListTodo size={10} className="text-foreground/40" />
                <span className={`font-medium ${taskStatusColors[rec.linkedTask.status] || "text-foreground/50"}`}>
                  {rec.linkedTask.status.replace(/_/g, " ")}
                </span>
                {rec.linkedTask.priorityReason && (
                  <span className="text-foreground/30 truncate max-w-[200px]">
                    — {rec.linkedTask.priorityReason}
                  </span>
                )}
              </div>
            )}

            <button
              onClick={() => setExpandedId(isExpanded ? null : rec.id)}
              className="flex items-center gap-0.5 mt-1.5 text-[10px] text-foreground/40 hover:text-foreground/60 transition-colors"
            >
              {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              {isExpanded ? "Less" : "Details"}
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 pt-2 border-t border-black/[0.04]">
                    <p className="text-[11px] text-foreground/50 mb-1.5">
                      <span className="text-foreground/70 font-medium">Action: </span>
                      {rec.recommendedAction}
                    </p>
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {rec.reasonCodes.map((code) => (
                        <span
                          key={code}
                          className="px-1.5 py-0.5 text-[9px] bg-black/[0.03] rounded text-foreground/40"
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                    <p className="text-[9px] text-foreground/30">
                      Source: {rec.sourceAgent} · Created{" "}
                      {new Date(rec.createdAt).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {rec.respondedAt &&
                        ` · Responded ${new Date(rec.respondedAt).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {isPending && (
              <div className="flex gap-1.5 mt-2.5">
                <button
                  onClick={() => acceptMut.mutate(rec.id)}
                  disabled={isMutating}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-primary/15 text-primary rounded hover:bg-primary/25 transition-colors border border-primary/25 disabled:opacity-50"
                >
                  <Check size={10} /> Accept
                </button>
                <button
                  onClick={() => {
                    setModifyModalId(rec.id);
                    setModifyNotes("");
                  }}
                  disabled={isMutating}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-primary/8 text-primary/70 rounded hover:bg-primary/15 transition-colors border border-primary/20 disabled:opacity-50"
                >
                  <Pencil size={10} /> Modify
                </button>
                <button
                  onClick={() => rejectMut.mutate(rec.id)}
                  disabled={isMutating}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-[#E05252]/12 text-[#E05252] rounded hover:bg-[#E05252]/20 transition-colors border border-[#E05252]/25 disabled:opacity-50"
                >
                  <X size={10} /> Reject
                </button>
                <button
                  onClick={() => ignoreMut.mutate(rec.id)}
                  disabled={isMutating}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-black/[0.03] text-foreground/40 rounded hover:bg-black/[0.06] transition-colors border border-black/[0.06] disabled:opacity-50"
                >
                  <EyeOff size={10} /> Ignore
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <HandMetal size={14} className="text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">
            Recommendations
          </h3>
          {activeRecs.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-primary/15 text-primary border border-primary/30 min-w-[18px] text-center">
              {activeRecs.length}
            </span>
          )}
        </div>
        {resolvedRecs.length > 0 && (
          <button
            onClick={() => setShowResolved(!showResolved)}
            className="text-[10px] text-foreground/40 hover:text-foreground/60 transition-colors"
          >
            {showResolved ? "Hide" : "Show"} resolved ({resolvedRecs.length})
          </button>
        )}
      </div>

      {activeRecs.length === 0 && resolvedRecs.length === 0 && (
        <div className="text-center py-6 text-[11px] text-foreground/30">
          No recommendations for this shipment
        </div>
      )}

      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {activeRecs.map(renderRec)}
        </AnimatePresence>
      </div>

      {showResolved && resolvedRecs.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/20">
          <p className="text-[10px] text-foreground/30 uppercase tracking-wider font-medium mb-2">
            Resolved
          </p>
          <div className="space-y-1.5">
            {resolvedRecs.map(renderRec)}
          </div>
        </div>
      )}

      <AnimatePresence>
        {modifyModalId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-xl bg-card border border-card-border p-5 w-full max-w-md"
            >
              <div className="flex items-center gap-2 mb-3 text-primary">
                <Pencil className="w-4 h-4" />
                <h2 className="text-[15px] font-semibold text-foreground">
                  Modify Recommendation
                </h2>
              </div>
              <label className="text-[10px] font-medium text-foreground/50 uppercase tracking-wider mb-1.5 block">
                Modification Notes
              </label>
              <textarea
                className="w-full p-3 rounded-lg bg-background border border-border focus:border-primary/40 outline-none resize-none h-24 text-[12px] text-foreground placeholder-muted-foreground/50 mb-4"
                placeholder="Describe how you would like to modify this recommendation…"
                value={modifyNotes}
                onChange={(e) => setModifyNotes(e.target.value)}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setModifyModalId(null);
                    setModifyNotes("");
                  }}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-foreground/60 hover:bg-black/[0.03] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleModifySubmit}
                  disabled={!modifyNotes.trim() || modifyMut.isPending}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 transition-colors"
                >
                  Submit
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
