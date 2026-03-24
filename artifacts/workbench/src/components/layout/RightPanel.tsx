import { useState } from "react";
import { useListShipments, useListEvents } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  FileText,
  Shield,
  TrendingUp,
  Umbrella,
  DollarSign,
  FileOutput,
  Receipt,
  BarChart3,
  ChevronRight,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { Link } from "wouter";
import { agentLabel, normalizeRiskScore, riskColor, riskLabel } from "@/lib/format";
import { useAlertsSummary } from "@/hooks/use-exceptions";

function getEventIcon(type: string) {
  if (type.includes("EXTRACT")) return <FileText className="w-3.5 h-3.5" />;
  if (type.includes("COMPLIANCE")) return <Shield className="w-3.5 h-3.5" />;
  if (type.includes("RISK")) return <TrendingUp className="w-3.5 h-3.5" />;
  if (type.includes("INSURANCE")) return <Umbrella className="w-3.5 h-3.5" />;
  if (type.includes("PRIC")) return <DollarSign className="w-3.5 h-3.5" />;
  if (type.includes("DOCGEN") || type.includes("DOCUMENT_GENERATED")) return <FileOutput className="w-3.5 h-3.5" />;
  if (type.includes("BILLING") || type.includes("INVOICE")) return <Receipt className="w-3.5 h-3.5" />;
  if (type.includes("TRADE_LANE")) return <BarChart3 className="w-3.5 h-3.5" />;
  if (type.includes("APPROVED")) return <CheckCircle2 className="w-3.5 h-3.5" />;
  return <Bot className="w-3.5 h-3.5" />;
}

function getEventColor(type: string) {
  if (type.includes("COMPLIANCE")) return "text-primary bg-primary/10";
  if (type.includes("RISK")) return "text-[#D4A24C] bg-[#D4A24C]/10";
  if (type.includes("INSURANCE")) return "text-muted-foreground bg-muted/50";
  if (type.includes("EXTRACT")) return "text-primary bg-primary/10";
  if (type.includes("APPROVED")) return "text-primary bg-primary/10";
  if (type.includes("EXCEPTION")) return "text-[#E05252] bg-[#E05252]/10";
  return "text-primary bg-primary/10";
}

function summarizeEvents(events: any[]) {
  const counts: Record<string, number> = {};
  for (const e of events) {
    const cat = e.eventType.includes("COMPLIANCE") ? "compliance"
      : e.eventType.includes("RISK") ? "risk"
      : e.eventType.includes("EXTRACT") ? "extraction"
      : e.eventType.includes("INSURANCE") ? "insurance"
      : e.eventType.includes("PRIC") ? "pricing"
      : e.eventType.includes("EXCEPTION") ? "exception"
      : e.eventType.includes("APPROVED") ? "approval"
      : "processing";
    counts[cat] = (counts[cat] || 0) + 1;
  }

  const summaries: { text: string; icon: typeof Shield; color: string }[] = [];
  if (counts.exception) summaries.push({ text: `${counts.exception} exception${counts.exception > 1 ? "s" : ""} detected`, icon: AlertTriangle, color: "text-[#D4A24C]" });
  if (counts.compliance) summaries.push({ text: `${counts.compliance} compliance check${counts.compliance > 1 ? "s" : ""} completed`, icon: Shield, color: "text-primary" });
  if (counts.risk) summaries.push({ text: `${counts.risk} risk assessment${counts.risk > 1 ? "s" : ""} run`, icon: TrendingUp, color: "text-primary" });
  if (counts.approval) summaries.push({ text: `${counts.approval} shipment${counts.approval > 1 ? "s" : ""} approved`, icon: CheckCircle2, color: "text-primary" });
  if (counts.extraction) summaries.push({ text: `${counts.extraction} document${counts.extraction > 1 ? "s" : ""} processed`, icon: FileText, color: "text-primary" });
  if (counts.pricing) summaries.push({ text: `${counts.pricing} pricing update${counts.pricing > 1 ? "s" : ""}`, icon: DollarSign, color: "text-primary" });
  if (counts.insurance) summaries.push({ text: `${counts.insurance} insurance quote${counts.insurance > 1 ? "s" : ""}`, icon: Umbrella, color: "text-muted-foreground" });
  if (counts.processing) summaries.push({ text: `${counts.processing} other event${counts.processing > 1 ? "s" : ""}`, icon: Bot, color: "text-muted-foreground" });

  return summaries;
}

export function RightPanel() {
  const [showRawLog, setShowRawLog] = useState(false);
  const { data: eventsRes } = useListEvents();
  const { data: shipmentsRes } = useListShipments();
  const { data: alertsRes } = useAlertsSummary();

  const events = ((eventsRes?.data || []) as any[]).slice(0, 30);
  const shipments = (shipmentsRes?.data || []) as any[];
  const alertsSummary = alertsRes?.data;

  const alerts = shipments
    .filter((s: any) => {
      const score = normalizeRiskScore(s.risk?.compositeScore);
      return (score != null && score >= 60) || s.compliance?.status === "FLAGGED" || s.compliance?.status === "ALERT";
    })
    .slice(0, 6);

  const summaries = summarizeEvents(events);
  const needsAttention = alertsSummary?.needsAttention ?? 0;

  return (
    <aside className="w-[280px] h-screen flex flex-col bg-sidebar border-l border-sidebar-border shrink-0 sticky top-0">
      <div className="px-5 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </div>
          <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">Intelligence</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-5">
          {needsAttention > 0 || alerts.length > 0 ? (
            <>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Attention Required</p>
              {alerts.length > 0 ? (
                <div className="space-y-1.5 mb-6">
                  {alerts.map((s: any) => {
                    const score = normalizeRiskScore(s.risk?.compositeScore);
                    return (
                      <Link key={s.id} href={`/shipments/${s.id}`}>
                        <div className="flex items-center gap-2.5 py-2 px-2.5 -mx-2.5 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer group">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#D4A24C] shrink-0" />
                          <div className="flex-1 min-w-0">
                            <span className="text-[12px] font-medium text-foreground/90 font-mono block truncate">{s.reference}</span>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                              {s.compliance?.status && s.compliance.status !== "CLEAR" && (
                                <span className="text-[#D4A24C]">{s.compliance.status}</span>
                              )}
                              {score != null && score >= 60 && (
                                <span className={riskColor(score)}>Risk {score}</span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[12px] text-muted-foreground mb-6">
                  {needsAttention} exception{needsAttention > 1 ? "s" : ""} need review.
                </p>
              )}
            </>
          ) : (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1.5">
                <CheckCircle2 className="w-4 h-4 text-primary/50" />
                <span className="text-[13px] font-medium text-foreground/80">All clear</span>
              </div>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                No active alerts. System is operating normally.
              </p>
            </div>
          )}

          {summaries.length > 0 && (
            <>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recent Activity</p>
              <div className="space-y-2 mb-4">
                {summaries.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <div key={i} className="flex items-center gap-2.5">
                      <Icon className={`w-3.5 h-3.5 ${s.color} shrink-0`} />
                      <span className="text-[12px] text-foreground/70">{s.text}</span>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setShowRawLog(!showRawLog)}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className={`w-3 h-3 transition-transform ${showRawLog ? "rotate-0" : "-rotate-90"}`} />
                {showRawLog ? "Hide" : "Show"} event log
              </button>

              <AnimatePresence>
                {showRawLog && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-3 space-y-0.5">
                      {events.slice(0, 15).map((event: any) => (
                        <div
                          key={event.id}
                          className="flex items-start gap-2 py-1.5 text-[11px]"
                        >
                          <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 ${getEventColor(event.eventType)}`}>
                            {getEventIcon(event.eventType)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-foreground/70 leading-snug block truncate">
                              {agentLabel(event.eventType)}
                            </span>
                            <span className="text-muted-foreground/50">
                              {format(new Date(event.createdAt), "HH:mm")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
