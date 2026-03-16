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
  Globe,
  Radio,
  Anchor,
  CloudLightning,
  Ban,
  TrendingUp,
  Activity,
} from "lucide-react";

interface SignalEvidence {
  signalId: string;
  signalType: string;
  severity: string;
  summary: string;
  externalReasonCode: string;
}

interface Recommendation {
  id: string;
  shipmentId: string;
  type: string;
  title: string;
  explanation: string;
  reasonCodes: string[];
  externalReasonCodes?: string[] | null;
  signalEvidence?: SignalEvidence[] | null;
  intelligenceEnriched?: string | null;
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
  PRICING_ALERT: TrendingUp,
};

const urgencyColors: Record<string, string> = {
  CRITICAL: "text-[#E05252] bg-[#E05252]/10 border-[#E05252]/30",
  HIGH: "text-[#D4A24C] bg-[#D4A24C]/10 border-[#D4A24C]/30",
  MEDIUM: "text-[#D4A24C]/80 bg-[#D4A24C]/5 border-[#D4A24C]/20",
  LOW: "text-primary/80 bg-primary/5 border-primary/20",
};

const urgencyBadgeColors: Record<string, string> = {
  CRITICAL: "bg-[#E05252]/20 text-[#E05252] border-[#E05252]/40",
  HIGH: "bg-[#D4A24C]/20 text-[#D4A24C] border-[#D4A24C]/40",
  MEDIUM: "bg-[#D4A24C]/10 text-[#D4A24C]/80 border-[#D4A24C]/30",
  LOW: "bg-primary/10 text-primary/80 border-primary/30",
};

const statusBadgeColors: Record<string, string> = {
  ACCEPTED: "bg-primary/20 text-primary border-primary/40",
  MODIFIED: "bg-primary/10 text-primary/70 border-primary/30",
  REJECTED: "bg-[#E05252]/20 text-[#E05252] border-[#E05252]/40",
  IMPLEMENTED: "bg-primary/20 text-primary border-primary/40",
  EXPIRED: "bg-white/10 text-white/40 border-white/20",
  SUPERSEDED: "bg-white/10 text-white/40 border-white/20",
};

const externalReasonCodeIcons: Record<string, typeof Globe> = {
  PORT_CONGESTION_HIGH: Anchor,
  PORT_CONGESTION_CRITICAL: Anchor,
  LANE_DISRUPTION_ACTIVE: Radio,
  LANE_DISRUPTION_CRITICAL: Radio,
  WEATHER_RISK_ELEVATED: CloudLightning,
  WEATHER_RISK_CRITICAL: CloudLightning,
  SANCTIONS_MATCH_POSSIBLE: Ban,
  SANCTIONS_MATCH_HIGH_CONFIDENCE: Ban,
  MARKET_RATE_PRESSURE: TrendingUp,
  MARKET_RATE_SURGE: TrendingUp,
  VESSEL_ANOMALY_DETECTED: Activity,
  MULTI_SIGNAL_ESCALATION: Globe,
};

const externalReasonCodeColors: Record<string, string> = {
  PORT_CONGESTION_HIGH: "bg-[#D4A24C]/15 text-[#D4A24C] border-[#D4A24C]/30",
  PORT_CONGESTION_CRITICAL: "bg-[#E05252]/15 text-[#E05252] border-[#E05252]/30",
  LANE_DISRUPTION_ACTIVE: "bg-[#D4A24C]/15 text-[#D4A24C] border-[#D4A24C]/30",
  LANE_DISRUPTION_CRITICAL: "bg-[#E05252]/15 text-[#E05252] border-[#E05252]/30",
  WEATHER_RISK_ELEVATED: "bg-[#D4A24C]/15 text-[#D4A24C] border-[#D4A24C]/30",
  WEATHER_RISK_CRITICAL: "bg-[#E05252]/15 text-[#E05252] border-[#E05252]/30",
  SANCTIONS_MATCH_POSSIBLE: "bg-[#D4A24C]/15 text-[#D4A24C] border-[#D4A24C]/30",
  SANCTIONS_MATCH_HIGH_CONFIDENCE: "bg-[#E05252]/15 text-[#E05252] border-[#E05252]/30",
  MARKET_RATE_PRESSURE: "bg-[#D4A24C]/15 text-[#D4A24C] border-[#D4A24C]/30",
  MARKET_RATE_SURGE: "bg-[#E05252]/15 text-[#E05252] border-[#E05252]/30",
  VESSEL_ANOMALY_DETECTED: "bg-primary/15 text-primary border-primary/30",
  MULTI_SIGNAL_ESCALATION: "bg-[#E05252]/15 text-[#E05252] border-[#E05252]/30",
};

const externalReasonCodeLabels: Record<string, string> = {
  PORT_CONGESTION_HIGH: "Port Congestion",
  PORT_CONGESTION_CRITICAL: "Critical Congestion",
  LANE_DISRUPTION_ACTIVE: "Lane Disruption",
  LANE_DISRUPTION_CRITICAL: "Critical Disruption",
  WEATHER_RISK_ELEVATED: "Weather Risk",
  WEATHER_RISK_CRITICAL: "Severe Weather",
  SANCTIONS_MATCH_POSSIBLE: "Sanctions Alert",
  SANCTIONS_MATCH_HIGH_CONFIDENCE: "Sanctions Match",
  MARKET_RATE_PRESSURE: "Rate Pressure",
  MARKET_RATE_SURGE: "Rate Surge",
  VESSEL_ANOMALY_DETECTED: "Vessel Anomaly",
  MULTI_SIGNAL_ESCALATION: "Multi-Signal",
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
  const isEnriched = rec.intelligenceEnriched === "true";
  const extCodes = rec.externalReasonCodes || [];
  const evidence = rec.signalEvidence || [];

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
              {isEnriched && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded border bg-primary/20 text-primary border-primary/40">
                  <Globe size={9} /> Intel
                </span>
              )}
              {!isPending && (
                <span className={`px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded border ${statusBadgeColors[rec.status] || "bg-white/10 text-white/60 border-white/20"}`}>
                  {rec.status}
                </span>
              )}
            </div>

            {showShipmentRef && (
              <p className="text-[11px] text-white/40 mt-0.5">Shipment: {rec.shipmentId.substring(0, 16)}...</p>
            )}

            {extCodes.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {extCodes.map((code) => {
                  const ExtIcon = externalReasonCodeIcons[code] || Globe;
                  const colorCls = externalReasonCodeColors[code] || "bg-white/10 text-white/50 border-white/20";
                  const label = externalReasonCodeLabels[code] || code.replace(/_/g, " ");
                  return (
                    <span key={code} className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border ${colorCls}`}>
                      <ExtIcon size={9} />
                      {label}
                    </span>
                  );
                })}
              </div>
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
                    <div className="flex flex-wrap gap-1 mb-2">
                      {rec.reasonCodes.map((code) => (
                        <span key={code} className="px-1.5 py-0.5 text-[10px] bg-white/5 rounded text-white/40">
                          {code}
                        </span>
                      ))}
                    </div>

                    {evidence.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-white/5">
                        <p className="text-[10px] font-medium text-primary/80 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <Globe size={10} /> Signal Evidence ({evidence.length})
                        </p>
                        <div className="space-y-1">
                          {evidence.map((sig, i) => (
                            <div key={sig.signalId || i} className="flex items-start gap-1.5 text-[10px] text-white/50">
                              <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                sig.severity === "CRITICAL" ? "bg-[#E05252]" :
                                sig.severity === "HIGH" ? "bg-[#D4A24C]" :
                                sig.severity === "MEDIUM" ? "bg-[#D4A24C]/60" : "bg-primary/60"
                              }`} />
                              <span className="leading-tight">{sig.summary}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

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
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-primary/20 text-primary rounded hover:bg-primary/30 transition-colors border border-primary/30"
                >
                  <Check size={12} /> Accept
                </button>
                <button
                  onClick={() => setShowModifyModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-primary/10 text-primary/70 rounded hover:bg-primary/20 transition-colors border border-primary/20"
                >
                  <Pencil size={12} /> Modify
                </button>
                <button
                  onClick={() => handleRespond("REJECTED")}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-[#E05252]/20 text-[#E05252] rounded hover:bg-[#E05252]/30 transition-colors border border-[#E05252]/30"
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
              className="rounded-xl bg-card border border-card-border p-5 w-full max-w-md"
            >
              <div className="flex items-center gap-2 mb-3 text-primary">
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
                className="w-full p-3 rounded-lg bg-background border border-border focus:border-primary/40 outline-none resize-none h-28 text-[13px] text-foreground placeholder-muted-foreground/50 mb-4"
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
                  className="px-4 py-2 rounded-lg text-[13px] font-medium bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 transition-colors"
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
