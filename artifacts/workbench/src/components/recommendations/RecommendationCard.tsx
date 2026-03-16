import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Shield,
  TrendingDown,
  Clock,
  FileWarning,
  Route,
  Truck,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Pencil,
  Zap,
} from "lucide-react";

interface Recommendation {
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
  createdAt: string;
  expiresAt?: string | null;
  respondedAt?: string | null;
}

const typeIcons: Record<string, typeof AlertTriangle> = {
  COMPLIANCE_ESCALATION: Shield,
  RISK_MITIGATION: AlertTriangle,
  DELAY_WARNING: Clock,
  MARGIN_WARNING: DollarSign,
  DOCUMENT_CORRECTION: FileWarning,
  ROUTE_ADJUSTMENT: Route,
  CARRIER_SWITCH: Truck,
  INSURANCE_ADJUSTMENT: Shield,
};

const urgencyColors: Record<string, string> = {
  CRITICAL: "text-red-400 bg-red-500/10 border-red-500/30",
  HIGH: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  MEDIUM: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  LOW: "text-blue-400 bg-blue-500/10 border-blue-500/30",
};

const urgencyBadgeColors: Record<string, string> = {
  CRITICAL: "bg-red-500/20 text-red-300 border-red-500/40",
  HIGH: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  MEDIUM: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  LOW: "bg-blue-500/20 text-blue-300 border-blue-500/40",
};

const statusBadgeColors: Record<string, string> = {
  ACCEPTED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  MODIFIED: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  REJECTED: "bg-red-500/20 text-red-300 border-red-500/40",
  IMPLEMENTED: "bg-violet-500/20 text-violet-300 border-violet-500/40",
  EXPIRED: "bg-white/10 text-white/40 border-white/20",
  SUPERSEDED: "bg-white/10 text-white/40 border-white/20",
};

interface Props {
  recommendation: Recommendation;
  onRespond?: (id: string, action: "ACCEPTED" | "MODIFIED" | "REJECTED", notes?: string) => void;
  showShipmentRef?: boolean;
  compact?: boolean;
}

export function RecommendationCard({ recommendation: rec, onRespond, showShipmentRef, compact }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [responding, setResponding] = useState(false);
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [modifyNotes, setModifyNotes] = useState("");

  const Icon = typeIcons[rec.type] || Zap;
  const colorClass = urgencyColors[rec.urgency] || urgencyColors.LOW;
  const badgeColor = urgencyBadgeColors[rec.urgency] || urgencyBadgeColors.LOW;
  const isPending = rec.status === "PENDING" || rec.status === "SHOWN";

  const handleRespond = (action: "ACCEPTED" | "MODIFIED" | "REJECTED", notes?: string) => {
    if (onRespond) {
      setResponding(true);
      onRespond(rec.id, action, notes);
    }
  };

  const handleModifySubmit = () => {
    handleRespond("MODIFIED", modifyNotes);
    setShowModifyModal(false);
    setModifyNotes("");
  };

  return (
    <>
      <motion.div
        layout
        className={`border rounded-lg p-4 ${colorClass} transition-all`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <Icon size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-medium text-white truncate">{rec.title}</h4>
              <span className={`px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded border ${badgeColor}`}>
                {rec.urgency}
              </span>
              {!isPending && (
                <span className={`px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded border ${statusBadgeColors[rec.status] || "bg-white/10 text-white/60 border-white/20"}`}>
                  {rec.status}
                </span>
              )}
            </div>

            {showShipmentRef && (
              <p className="text-[11px] text-white/40 mt-0.5">Shipment: {rec.shipmentId.substring(0, 16)}...</p>
            )}

            {!compact && (
              <p className="text-xs text-white/60 mt-1 line-clamp-2">{rec.explanation}</p>
            )}

            <div className="flex items-center gap-3 mt-2 text-[11px] text-white/40">
              <span>Confidence: {(rec.confidence * 100).toFixed(0)}%</span>
              {rec.expectedDelayImpactDays != null && (
                <span>Delay: {rec.expectedDelayImpactDays > 0 ? "+" : ""}{rec.expectedDelayImpactDays}d</span>
              )}
              {rec.expectedMarginImpactPct != null && (
                <span>Margin: {rec.expectedMarginImpactPct > 0 ? "+" : ""}{rec.expectedMarginImpactPct.toFixed(1)}%</span>
              )}
              {rec.expectedRiskReduction != null && (
                <span>Risk: -{rec.expectedRiskReduction.toFixed(0)}</span>
              )}
            </div>

            {!compact && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 mt-2 text-[11px] text-white/50 hover:text-white/80 transition-colors"
              >
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {expanded ? "Less" : "Details"}
              </button>
            )}

            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <p className="text-xs text-white/50 mb-2">
                      <span className="text-white/70 font-medium">Recommended: </span>
                      {rec.recommendedAction}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {rec.reasonCodes.map((code) => (
                        <span key={code} className="px-1.5 py-0.5 text-[10px] bg-white/5 rounded text-white/40">
                          {code}
                        </span>
                      ))}
                    </div>
                    {rec.expiresAt && (
                      <p className="text-[10px] text-white/30 mt-2">
                        Expires: {new Date(rec.expiresAt).toLocaleDateString()} {new Date(rec.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {isPending && onRespond && !responding && (
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleRespond("ACCEPTED")}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-emerald-500/20 text-emerald-300 rounded hover:bg-emerald-500/30 transition-colors border border-emerald-500/30"
                >
                  <Check size={12} /> Accept
                </button>
                <button
                  onClick={() => setShowModifyModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-blue-500/20 text-blue-300 rounded hover:bg-blue-500/30 transition-colors border border-blue-500/30"
                >
                  <Pencil size={12} /> Modify
                </button>
                <button
                  onClick={() => handleRespond("REJECTED")}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-red-500/20 text-red-300 rounded hover:bg-red-500/30 transition-colors border border-red-500/30"
                >
                  <X size={12} /> Reject
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showModifyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="rounded-xl bg-[#1a1a2e] border border-white/10 p-5 w-full max-w-md"
            >
              <div className="flex items-center gap-2 mb-3 text-blue-300">
                <Pencil className="w-5 h-5" />
                <h2 className="text-[16px] font-semibold text-white">Modify Recommendation</h2>
              </div>
              <p className="text-[12px] text-white/50 mb-1">{rec.title}</p>
              <p className="text-[11px] text-white/30 mb-4">
                <span className="text-white/50 font-medium">Current action: </span>
                {rec.recommendedAction}
              </p>
              <label className="text-[11px] font-medium text-white/60 uppercase tracking-wider mb-1.5 block">
                Modification Notes
              </label>
              <textarea
                className="w-full p-3 rounded-lg bg-black/30 border border-white/10 focus:border-blue-500/40 outline-none resize-none h-28 text-[13px] text-white placeholder-white/30 mb-4"
                placeholder="Describe how you would like to modify this recommendation..."
                value={modifyNotes}
                onChange={(e) => setModifyNotes(e.target.value)}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setShowModifyModal(false); setModifyNotes(""); }}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium text-white/60 hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleModifySubmit}
                  disabled={!modifyNotes.trim()}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium bg-blue-500 hover:bg-blue-500/90 text-white disabled:opacity-50 transition-colors"
                >
                  Submit Modification
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
