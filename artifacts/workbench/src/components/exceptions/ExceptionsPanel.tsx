import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  AlertCircle,
  Shield,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  Loader2,
  ChevronDown,
  ChevronUp,
  Scan,
  UserPlus,
  MessageSquare,
  XCircle,
} from "lucide-react";
import { useShipmentAlerts, useDetectExceptions, useResolveException, useEscalateException } from "@/hooks/use-exceptions";
import { useToast } from "@/hooks/use-toast";

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string; icon: typeof AlertTriangle }> = {
  CRITICAL: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30", icon: XCircle },
  HIGH: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/30", icon: AlertTriangle },
  MEDIUM: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/30", icon: AlertCircle },
  LOW: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30", icon: Shield },
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  OPEN: { bg: "bg-red-500/10", text: "text-red-400" },
  IN_PROGRESS: { bg: "bg-yellow-500/10", text: "text-yellow-400" },
  ESCALATED: { bg: "bg-orange-500/10", text: "text-orange-400" },
  ACKNOWLEDGED: { bg: "bg-blue-500/10", text: "text-blue-400" },
  RESOLVED: { bg: "bg-green-500/10", text: "text-green-400" },
};

function humanizeType(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ExceptionsPanel({ shipmentId }: { shipmentId: string }) {
  const { data: alertsRes, isLoading } = useShipmentAlerts(shipmentId);
  const detect = useDetectExceptions();
  const resolve = useResolveException();
  const escalate = useEscalateException();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");

  const alerts = alertsRes?.data;
  const exceptions = alerts?.exceptions || [];

  const handleDetect = async () => {
    try {
      const result = await detect.mutateAsync(shipmentId);
      const count = result?.data?.detected ?? 0;
      toast({
        title: count > 0 ? `${count} exception${count > 1 ? "s" : ""} detected` : "No new exceptions",
        description: count > 0 ? "Review the exceptions below." : "All checks passed.",
      });
    } catch (err: any) {
      toast({ title: "Detection failed", description: err.message, variant: "destructive" });
    }
  };

  const handleResolve = async (id: string) => {
    if (!resolveNotes.trim()) return;
    try {
      await resolve.mutateAsync({ id, resolutionNotes: resolveNotes });
      toast({ title: "Exception resolved" });
      setResolveId(null);
      setResolveNotes("");
    } catch (err: any) {
      toast({ title: "Failed to resolve", description: err.message, variant: "destructive" });
    }
  };

  const handleEscalate = async (id: string) => {
    try {
      await escalate.mutateAsync({ id });
      toast({ title: "Exception escalated" });
    } catch (err: any) {
      toast({ title: "Failed to escalate", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-5 rounded-xl bg-card border border-card-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-semibold text-foreground flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-primary" />
          Exceptions & Alerts
          {alerts && alerts.total > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400">
              {alerts.total} active
            </span>
          )}
        </h3>
        <button
          onClick={handleDetect}
          disabled={detect.isPending}
          className="px-2 py-1 text-[10px] font-medium rounded bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 flex items-center gap-1 border border-primary/20"
        >
          {detect.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scan className="w-3.5 h-3.5" />}
          {detect.isPending ? "Scanning..." : "Run Detection"}
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : exceptions.length === 0 ? (
        <div className="text-center py-6">
          <CheckCircle2 className="w-8 h-8 text-primary/40 mx-auto mb-2" />
          <p className="text-[12px] text-muted-foreground">No active exceptions. Click "Run Detection" to scan.</p>
        </div>
      ) : (
        <>
          {alerts && (
            <div className="flex gap-2 mb-3">
              {Object.entries(alerts.bySeverity as Record<string, number>)
                .filter(([, count]) => count > 0)
                .map(([sev, count]) => {
                  const style = SEVERITY_STYLES[sev] || SEVERITY_STYLES.LOW;
                  return (
                    <span key={sev} className={`px-2 py-0.5 rounded text-[10px] font-medium ${style.bg} ${style.text}`}>
                      {count} {sev}
                    </span>
                  );
                })}
            </div>
          )}

          <div className="space-y-2">
            {exceptions.map((exc: any) => {
              const style = SEVERITY_STYLES[exc.severity] || SEVERITY_STYLES.LOW;
              const statusStyle = STATUS_STYLES[exc.status] || STATUS_STYLES.OPEN;
              const isExpanded = expanded === exc.id;
              const Icon = style.icon;

              return (
                <motion.div
                  key={exc.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`border rounded-lg ${style.border} overflow-hidden`}
                >
                  <button
                    onClick={() => setExpanded(isExpanded ? null : exc.id)}
                    className="w-full flex items-start gap-3 p-3 text-left hover:bg-white/[0.02] transition-colors"
                  >
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${style.bg}`}>
                      <Icon className={`w-3.5 h-3.5 ${style.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[12px] font-semibold text-foreground truncate">{exc.title}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                          {exc.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{humanizeType(exc.type)}</p>
                    </div>
                    <div className="shrink-0 text-muted-foreground">
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
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
                        <div className="px-3 pb-3 border-t border-white/5 pt-2">
                          <p className="text-[11px] text-muted-foreground mb-3">{exc.description}</p>

                          {exc.recommendedActions && (exc.recommendedActions as any[]).length > 0 && (
                            <div className="mb-3">
                              <p className="text-[10px] font-medium text-foreground mb-1.5">Recommended Actions</p>
                              <div className="space-y-1">
                                {(exc.recommendedActions as any[]).map((action: any, i: number) => (
                                  <div key={i} className="flex items-start gap-2 text-[10px]">
                                    <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${
                                      action.priority === "HIGH" ? "bg-red-500/10 text-red-400" :
                                      action.priority === "MEDIUM" ? "bg-yellow-500/10 text-yellow-400" :
                                      "bg-blue-500/10 text-blue-400"
                                    }`}>
                                      {action.priority}
                                    </span>
                                    <span className="text-muted-foreground">{action.action}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {exc.createdAt && (
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-3">
                              <Clock className="w-3 h-3" />
                              Detected {new Date(exc.createdAt).toLocaleString()}
                            </p>
                          )}

                          {resolveId === exc.id ? (
                            <div className="space-y-2">
                              <textarea
                                className="w-full p-2 rounded-lg bg-background border border-card-border focus:border-primary/40 outline-none resize-none h-16 text-[11px]"
                                placeholder="Resolution notes..."
                                value={resolveNotes}
                                onChange={(e) => setResolveNotes(e.target.value)}
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleResolve(exc.id)}
                                  disabled={!resolveNotes.trim() || resolve.isPending}
                                  className="px-2 py-1 text-[10px] font-medium rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 disabled:opacity-50 flex items-center gap-1"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  Confirm
                                </button>
                                <button
                                  onClick={() => { setResolveId(null); setResolveNotes(""); }}
                                  className="px-2 py-1 text-[10px] font-medium rounded text-muted-foreground hover:text-foreground"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              {exc.status !== "ESCALATED" && (
                                <button
                                  onClick={() => handleEscalate(exc.id)}
                                  disabled={escalate.isPending}
                                  className="px-2 py-1 text-[10px] font-medium rounded bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 disabled:opacity-50 flex items-center gap-1 border border-orange-500/20"
                                >
                                  <ArrowUpRight className="w-3 h-3" />
                                  Escalate
                                </button>
                              )}
                              <button
                                onClick={() => setResolveId(exc.id)}
                                className="px-2 py-1 text-[10px] font-medium rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 flex items-center gap-1 border border-green-500/20"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Resolve
                              </button>
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
        </>
      )}
    </div>
  );
}
