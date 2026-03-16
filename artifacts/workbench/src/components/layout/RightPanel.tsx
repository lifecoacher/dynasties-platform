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
} from "lucide-react";
import { Link } from "wouter";
import { agentLabel, normalizeRiskScore, riskColor, riskLabel } from "@/lib/format";

type PanelTab = "activity" | "alerts";

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

export function RightPanel() {
  const [tab, setTab] = useState<PanelTab>("activity");
  const { data: eventsRes } = useListEvents();
  const { data: shipmentsRes } = useListShipments();

  const events = ((eventsRes?.data || []) as any[]).slice(0, 20);
  const shipments = (shipmentsRes?.data || []) as any[];

  const alerts = shipments
    .filter((s: any) => {
      const score = normalizeRiskScore(s.risk?.compositeScore);
      return (score != null && score >= 60) || s.compliance?.status === "FLAGGED" || s.compliance?.status === "ALERT";
    })
    .slice(0, 6);

  return (
    <aside className="w-[300px] h-screen flex flex-col bg-sidebar border-l border-sidebar-border shrink-0 sticky top-0">
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-1.5">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </div>
          <span className="text-[11px] font-medium text-primary uppercase tracking-wider">Agents Online</span>
        </div>
      </div>

      <div className="flex border-b border-sidebar-border">
        {(["activity", "alerts"] as PanelTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-[12px] font-medium transition-colors relative ${
              tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "activity" ? "Activity" : "Alerts"}
            {t === "alerts" && alerts.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-destructive/20 text-destructive text-[10px] font-semibold">
                {alerts.length}
              </span>
            )}
            {tab === t && (
              <motion.div
                layoutId="panel-tab"
                className="absolute bottom-0 left-2 right-2 h-[2px] bg-primary rounded-full"
              />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {tab === "activity" ? (
            <motion.div
              key="activity"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-3 space-y-1"
            >
              {events.length === 0 ? (
                <p className="text-[12px] text-muted-foreground text-center py-8">No recent activity</p>
              ) : (
                events.map((event: any, i: number) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-start gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/[0.03] transition-colors group"
                  >
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${getEventColor(event.eventType)}`}>
                      {getEventIcon(event.eventType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-foreground/90 leading-snug">
                        {agentLabel(event.eventType)}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {event.eventType.replace(/_/g, " ").toLowerCase()}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {format(new Date(event.createdAt), "HH:mm:ss")}
                      </p>
                    </div>
                  </motion.div>
                ))
              )}
            </motion.div>
          ) : (
            <motion.div
              key="alerts"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-3 space-y-2"
            >
              {alerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-8 h-8 text-primary/40 mx-auto mb-2" />
                  <p className="text-[12px] text-muted-foreground">All clear — no active alerts</p>
                </div>
              ) : (
                alerts.map((s: any) => {
                  const score = normalizeRiskScore(s.risk?.compositeScore);
                  return (
                    <Link key={s.id} href={`/shipments/${s.id}`}>
                      <div className="px-3 py-2.5 rounded-lg border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors cursor-pointer group">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[12px] font-semibold text-foreground font-mono">{s.reference}</span>
                          <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex items-center gap-3 text-[11px]">
                          {s.compliance?.status && s.compliance.status !== "CLEAR" && (
                            <span className="flex items-center gap-1 text-destructive">
                              <AlertTriangle className="w-3 h-3" />
                              {s.compliance.status}
                            </span>
                          )}
                          {score != null && score >= 60 && (
                            <span className={`flex items-center gap-1 ${riskColor(score)}`}>
                              <Activity className="w-3 h-3" />
                              Risk {score} ({riskLabel(score)})
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
