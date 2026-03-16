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
  PRICING_ALERT: TrendingDown,
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

interface Props {
  recommendation: Recommendation;
  onRespond?: (id: string, action: "ACCEPTED" | "MODIFIED" | "REJECTED", notes?: string) => void;
  showShipmentRef?: boolean;
  compact?: boolean;
}

export function RecommendationCard({ recommendation: rec, onRespond, showShipmentRef, compact }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [responding, setResponding] = useState(false);

  const Icon = typeIcons[rec.type] || Zap;
  const colorClass = urgencyColors[rec.urgency] || urgencyColors.LOW;
  const badgeColor = urgencyBadgeColors[rec.urgency] || urgencyBadgeColors.LOW;
  const isPending = rec.status === "PENDING" || rec.status === "SHOWN";

  const handleRespond = (action: "ACCEPTED" | "MODIFIED" | "REJECTED") => {
    if (onRespond) {
      setResponding(true);
      onRespond(rec.id, action);
    }
  };

  return (
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
              <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded bg-white/10 text-white/60 border border-white/20">
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
                onClick={() => handleRespond("MODIFIED")}
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
  );
}
