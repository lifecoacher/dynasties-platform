import { motion, AnimatePresence } from "framer-motion";
import { Clock, Activity, Zap, ChevronDown, ChevronUp, Brain, RefreshCw, AlertTriangle, FileText, Shield, TrendingUp, Loader2 } from "lucide-react";
import { useAiAnalysisHistory } from "@/hooks/use-ai-runtime";
import { format, formatDistanceToNow } from "date-fns";
import { useState } from "react";

const TRIGGER_ICONS: Record<string, React.ReactNode> = {
  SHIPMENT_CREATED: <Zap className="w-3 h-3 text-primary" />,
  SHIPMENT_UPDATED: <RefreshCw className="w-3 h-3 text-blue-500" />,
  DOCUMENT_UPLOADED: <FileText className="w-3 h-3 text-violet-500" />,
  DOCUMENT_VALIDATED: <FileText className="w-3 h-3 text-primary" />,
  DOCUMENT_GENERATED: <FileText className="w-3 h-3 text-blue-500" />,
  EXCEPTION_CREATED: <AlertTriangle className="w-3 h-3 text-[#E05252]" />,
  EXCEPTION_RESOLVED: <AlertTriangle className="w-3 h-3 text-primary" />,
  COMPLIANCE_UPDATED: <Shield className="w-3 h-3 text-primary" />,
  RISK_UPDATED: <TrendingUp className="w-3 h-3 text-[#D4A24C]" />,
  MANUAL: <Brain className="w-3 h-3 text-primary" />,
};

function humanizeTrigger(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AnalysisHistoryPanel({ shipmentId }: { shipmentId: string }) {
  const { data: runs, isLoading, error } = useAiAnalysisHistory(shipmentId);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        <span className="text-xs">Loading history…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-6 text-center">
        <AlertTriangle className="w-5 h-5 text-[#E05252] mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">Failed to load analysis history.</p>
      </div>
    );
  }

  const history = Array.isArray(runs) ? runs : [];

  if (history.length === 0) {
    return (
      <div className="py-6 text-center">
        <Activity className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">No analysis runs yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-3.5 h-3.5 text-primary" />
        <h4 className="text-[12px] font-semibold text-foreground uppercase tracking-wider">Analysis Timeline</h4>
        <span className="px-1.5 py-0.5 text-[9px] bg-muted rounded font-medium">{history.length} runs</span>
      </div>

      <div className="relative pl-5">
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border/50" />
        {history.map((run: any, i: number) => {
          const isExpanded = expandedRun === run.id;
          const duration = run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : "—";
          const timestamp = run.startedAt
            ? formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })
            : "";

          return (
            <motion.div
              key={run.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="relative mb-2"
            >
              <div className="absolute left-[-16px] top-2.5 w-2.5 h-2.5 rounded-full border-2 border-card bg-primary" />
              <button
                onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                className="w-full text-left p-2.5 rounded-lg border border-border/30 hover:border-border/60 bg-card/50 hover:bg-card transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {TRIGGER_ICONS[run.triggerType] || <Zap className="w-3 h-3 text-muted-foreground" />}
                    <span className="text-[11px] font-medium text-foreground">
                      {humanizeTrigger(run.triggerType)}
                    </span>
                    <span className={`px-1 py-0.5 text-[8px] uppercase rounded font-semibold ${
                      run.status === "COMPLETED" ? "bg-primary/10 text-primary" :
                      run.status === "FAILED" ? "bg-[#E05252]/10 text-[#E05252]" :
                      "bg-[#D4A24C]/10 text-[#D4A24C]"
                    }`}>
                      {run.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{duration}</span>
                    <span>{timestamp}</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </div>
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-1 p-3 rounded-lg bg-muted/30 border border-border/20 text-[11px] space-y-2">
                      {run.resultSummary && (
                        <div>
                          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Summary</span>
                          <p className="text-foreground mt-0.5">{run.resultSummary}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-2 text-[10px]">
                        <div>
                          <span className="text-muted-foreground">Confidence</span>
                          <p className="font-medium">{run.overallConfidence ?? "—"}%</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Recommendations</span>
                          <p className="font-medium">{run.recommendationsGenerated ?? 0}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Started</span>
                          <p className="font-medium">{run.startedAt ? format(new Date(run.startedAt), "HH:mm:ss") : "—"}</p>
                        </div>
                      </div>
                      {run.triggerSourceEntityType && (
                        <div className="text-[10px] text-muted-foreground">
                          Triggered by: {run.triggerSourceEntityType} {run.triggerSourceEntityId ? `(${run.triggerSourceEntityId.slice(0, 8)}…)` : ""}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
