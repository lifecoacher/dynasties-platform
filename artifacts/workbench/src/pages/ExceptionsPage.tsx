import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  AlertCircle,
  Shield,
  XCircle,
  CheckCircle2,
  Loader2,
  Clock,
  ArrowRight,
  X,
  ArrowUpCircle,
  Send,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListExceptions, useAlertsSummary, useResolveException, useEscalateException } from "@/hooks/use-exceptions";

const SEVERITY_META: Record<string, { dot: string; text: string; icon: typeof AlertTriangle }> = {
  CRITICAL: { dot: "bg-[#E05252]", text: "text-[#E05252]", icon: XCircle },
  HIGH: { dot: "bg-[#D4A24C]", text: "text-[#D4A24C]", icon: AlertTriangle },
  MEDIUM: { dot: "bg-[#C9A227]", text: "text-[#B5932B]", icon: AlertCircle },
  LOW: { dot: "bg-blue-500", text: "text-blue-500", icon: Shield },
};

const FILTER_TABS = [
  { key: "ACTIVE", label: "Active" },
  { key: "OPEN", label: "Open" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "ESCALATED", label: "Escalated" },
  { key: "RESOLVED", label: "Resolved" },
  { key: "", label: "All" },
];

function humanizeType(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function deriveVoice(summary: any) {
  const critical = summary?.bySeverity?.CRITICAL ?? 0;
  const high = summary?.bySeverity?.HIGH ?? 0;
  const total = summary?.needsAttention ?? 0;

  if (critical > 0) return { text: `${critical} critical exception${critical > 1 ? "s" : ""} — resolve immediately`, color: "text-[#E05252]" };
  if (high > 0) return { text: `${high} exception${high > 1 ? "s" : ""} need your attention`, color: "text-[#D4A24C]" };
  if (total > 0) return { text: `${total} exception${total > 1 ? "s" : ""} to review`, color: "text-foreground/60" };
  return { text: "No exceptions detected. System operating normally.", color: "text-primary/60" };
}

function deriveImpact(exc: any) {
  const type = exc.exceptionType?.toLowerCase() || "";
  if (type.includes("customs") || type.includes("compliance")) return "May delay clearance";
  if (type.includes("delay") || type.includes("schedule")) return "Delivery timeline at risk";
  if (type.includes("document") || type.includes("missing")) return "Missing documentation";
  if (type.includes("rate") || type.includes("cost") || type.includes("billing")) return "Cost impact";
  if (type.includes("carrier") || type.includes("vessel")) return "Routing affected";
  if (type.includes("damage") || type.includes("cargo")) return "Cargo integrity concern";
  if (exc.severity === "CRITICAL") return "Immediate action needed";
  if (exc.severity === "HIGH") return "Needs prompt resolution";
  return null;
}

export default function ExceptionsPage() {
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [selectedExc, setSelectedExc] = useState<any | null>(null);
  const { data: exceptionsRes, isLoading } = useListExceptions({ status: statusFilter || undefined });
  const { data: summaryRes } = useAlertsSummary();

  const exceptions = exceptionsRes?.data || [];
  const summary = summaryRes?.data;
  const voice = deriveVoice(summary);

  useEffect(() => { setSelectedExc(null); }, [statusFilter]);

  const critical = exceptions.filter((e: any) => e.severity === "CRITICAL");
  const high = exceptions.filter((e: any) => e.severity === "HIGH");
  const rest = exceptions.filter((e: any) => e.severity !== "CRITICAL" && e.severity !== "HIGH");

  const totalCritical = summary?.bySeverity?.CRITICAL ?? 0;
  const totalHigh = summary?.bySeverity?.HIGH ?? 0;
  const totalMedium = summary?.bySeverity?.MEDIUM ?? 0;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-1">
          <h1 className="text-[22px] font-bold text-foreground tracking-tight font-heading">Exceptions</h1>
        </div>

        <p className={`text-[13px] ${voice.color} mb-5`}>{voice.text}</p>

        {(totalCritical > 0 || totalHigh > 0 || totalMedium > 0) && (
          <div className="flex items-center gap-5 mb-6 text-[13px]">
            {totalCritical > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E05252]" />
                <span className="text-muted-foreground/60 text-[12px]">Critical</span>
                <span className="text-[17px] font-bold text-[#E05252] tabular-nums">{totalCritical}</span>
              </div>
            )}
            {totalHigh > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#D4A24C]" />
                <span className="text-muted-foreground/60 text-[12px]">High</span>
                <span className="text-[17px] font-bold text-[#D4A24C] tabular-nums">{totalHigh}</span>
              </div>
            )}
            {totalMedium > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227]" />
                <span className="text-muted-foreground/60 text-[12px]">Medium</span>
                <span className="text-[17px] font-bold text-[#B5932B] tabular-nums">{totalMedium}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-0.5 mb-6 border-b border-border/60">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-2.5 text-[12px] font-medium border-b-2 transition-colors ${
                statusFilter === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground/50 hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/30" />
              </div>
            ) : exceptions.length === 0 ? (
              <div className="text-center py-20">
                <CheckCircle2 className="w-5 h-5 text-primary/20 mx-auto mb-2" />
                <p className="text-[14px] text-foreground/50 mb-1">All clear</p>
                <p className="text-[13px] text-muted-foreground/40">No exceptions matching this filter.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {critical.length > 0 && (
                  <TriageGroup label="Critical" count={critical.length} exceptions={critical} onSelect={setSelectedExc} selectedId={selectedExc?.id} />
                )}
                {high.length > 0 && (
                  <TriageGroup label="Needs Attention" count={high.length} exceptions={high} onSelect={setSelectedExc} selectedId={selectedExc?.id} />
                )}
                {rest.length > 0 && (
                  <TriageGroup label="Informational" count={rest.length} exceptions={rest} isMinor onSelect={setSelectedExc} selectedId={selectedExc?.id} />
                )}
              </div>
            )}
          </div>

          <div>
            <AnimatePresence mode="wait">
              {selectedExc ? (
                <ExceptionDetailPanel
                  key={selectedExc.id}
                  exception={selectedExc}
                  onClose={() => setSelectedExc(null)}
                />
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border border-border/40 rounded-lg p-6 text-center sticky top-6"
                >
                  <AlertTriangle size={20} className="mx-auto text-muted-foreground/15 mb-2" />
                  <p className="text-[13px] text-muted-foreground/30">Select an exception to view details and take action</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function ExceptionDetailPanel({ exception, onClose }: { exception: any; onClose: () => void }) {
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [escalateReason, setEscalateReason] = useState("");
  const [showEscalate, setShowEscalate] = useState(false);
  const resolveMutation = useResolveException();
  const escalateMutation = useEscalateException();

  const sev = SEVERITY_META[exception.severity] || SEVERITY_META.LOW;
  const impact = deriveImpact(exception);
  const isActive = ["OPEN", "IN_PROGRESS", "ESCALATED"].includes(exception.status);
  const actions = exception.recommendedActions || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="border border-border/60 rounded-lg overflow-hidden sticky top-6"
    >
      <div className="p-4 border-b border-border/40">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${sev.dot}`} />
            <span className={`text-[11px] font-medium ${sev.text}`}>{exception.severity}</span>
            <StatusBadge status={exception.status} />
          </div>
          <button onClick={onClose} className="text-muted-foreground/30 hover:text-foreground transition-colors">
            <X size={14} />
          </button>
        </div>
        <h3 className="text-[14px] font-semibold text-foreground mb-1">{exception.title}</h3>
        <p className="text-[12px] text-muted-foreground/50">{humanizeType(exception.exceptionType)}</p>
      </div>

      <div className="p-4 space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto">
        {exception.description && (
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-medium">Description</span>
            <p className="text-[12px] text-foreground/70 mt-1">{exception.description}</p>
          </div>
        )}

        {impact && (
          <div className="px-3 py-2 rounded-lg bg-[#D4A24C]/5 border border-[#D4A24C]/10">
            <span className="text-[11px] font-medium text-[#D4A24C]">Impact: {impact}</span>
          </div>
        )}

        {actions.length > 0 && (
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-medium">Recommended Actions</span>
            <div className="mt-2 space-y-1.5">
              {actions.map((a: any, i: number) => (
                <div key={i} className="flex items-start gap-2 text-[12px]">
                  <span className={`mt-0.5 px-1 py-0.5 text-[9px] font-bold rounded ${
                    a.priority === "HIGH" ? "bg-[#E05252]/10 text-[#E05252]" : "bg-muted text-muted-foreground"
                  }`}>
                    {a.priority}
                  </span>
                  <span className="text-foreground/60">{a.action}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {exception.shipmentId && (
          <Link href={`/shipments/${exception.shipmentId}`}>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 text-primary text-[12px] font-medium hover:bg-primary/10 transition-colors cursor-pointer">
              <ArrowRight size={12} />
              View Shipment
            </div>
          </Link>
        )}

        <div className="text-[11px] text-muted-foreground/30 flex items-center gap-3">
          <span className="flex items-center gap-1"><Clock size={10} /> {new Date(exception.createdAt).toLocaleString()}</span>
          {exception.detectedFrom && <span>Source: {exception.detectedFrom}</span>}
        </div>

        {exception.resolutionNotes && (
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-medium">Resolution</span>
            <p className="text-[12px] text-foreground/60 mt-1">{exception.resolutionNotes}</p>
          </div>
        )}

        {isActive && (
          <div className="border-t border-border/30 pt-4 space-y-3">
            {!showEscalate ? (
              <>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-medium">Resolution Notes</label>
                  <textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Describe how this was resolved..."
                    className="w-full mt-1 px-3 py-2 text-[12px] bg-background border border-border/60 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (!resolutionNotes.trim()) return;
                      resolveMutation.mutate({ id: exception.id, resolutionNotes }, {
                        onSuccess: () => onClose(),
                      });
                    }}
                    disabled={!resolutionNotes.trim() || resolveMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors"
                  >
                    {resolveMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                    Resolve
                  </button>
                  <button
                    onClick={() => setShowEscalate(true)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-medium bg-[#D4A24C]/10 text-[#D4A24C] rounded-lg hover:bg-[#D4A24C]/15 transition-colors"
                  >
                    <ArrowUpCircle size={12} />
                    Escalate
                  </button>
                </div>
                {resolveMutation.isError && (
                  <p className="text-[11px] text-[#E05252]">{(resolveMutation.error as Error).message}</p>
                )}
              </>
            ) : (
              <>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-medium">Escalation Reason</label>
                  <textarea
                    value={escalateReason}
                    onChange={(e) => setEscalateReason(e.target.value)}
                    placeholder="Why is this being escalated?"
                    className="w-full mt-1 px-3 py-2 text-[12px] bg-background border border-border/60 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-[#D4A24C]/30"
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      escalateMutation.mutate({ id: exception.id, reason: escalateReason || undefined }, {
                        onSuccess: () => onClose(),
                      });
                    }}
                    disabled={escalateMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-medium bg-[#D4A24C] text-white rounded-lg hover:bg-[#D4A24C]/90 disabled:opacity-40 transition-colors"
                  >
                    {escalateMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    Escalate
                  </button>
                  <button
                    onClick={() => setShowEscalate(false)}
                    className="px-3 py-2 text-[11px] text-muted-foreground/40 hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function TriageGroup({ label, count, exceptions, isMinor, onSelect, selectedId }: {
  label: string; count: number; exceptions: any[]; isMinor?: boolean; onSelect: (exc: any) => void; selectedId?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[13px] font-semibold text-foreground">{label}</h3>
        <span className="text-[11px] text-muted-foreground/40">{count}</span>
      </div>
      <div>
        {exceptions.map((exc: any, i: number) => {
          const sev = SEVERITY_META[exc.severity] || SEVERITY_META.LOW;
          const impact = deriveImpact(exc);
          const isSelected = exc.id === selectedId;
          return (
            <motion.div
              key={exc.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
            >
              <div
                onClick={() => onSelect(exc)}
                className={`flex items-start gap-3 px-4 py-3.5 -mx-4 rounded-xl transition-all cursor-pointer group border-b border-border/30 last:border-b-0 active:scale-[0.998] ${
                  isSelected
                    ? "bg-primary/[0.04] border-primary/20"
                    : isMinor ? "opacity-40 hover:opacity-80 hover:bg-card" : "hover:bg-card"
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${sev.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[13px] font-medium text-foreground">{exc.title}</span>
                    <span className={`text-[10px] font-medium ${sev.text}`}>{exc.severity}</span>
                    <StatusBadge status={exc.status} />
                  </div>
                  <p className="text-[12px] text-muted-foreground/50 line-clamp-1 mb-1">{exc.description}</p>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground/35">
                    <span>{humanizeType(exc.exceptionType)}</span>
                    {impact && (
                      <>
                        <span className="text-muted-foreground/15">·</span>
                        <span className={!isMinor ? "text-foreground/40" : ""}>{impact}</span>
                      </>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(exc.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 mt-1">
                  {exc.shipmentId && !isMinor && (
                    <Link href={`/shipments/${exc.shipmentId}`} onClick={(e: any) => e.stopPropagation()}>
                      <span className="text-[11px] font-medium text-primary transition-colors">
                        Shipment
                      </span>
                    </Link>
                  )}
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/15 group-hover:text-muted-foreground/40 transition-colors" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    OPEN: "text-[#E05252]/60",
    IN_PROGRESS: "text-[#B5932B]/70",
    ESCALATED: "text-[#D4A24C]/70",
    ACKNOWLEDGED: "text-blue-500/50",
    RESOLVED: "text-primary/50",
  };
  return (
    <span className={`text-[10px] font-medium ${colors[status] || "text-muted-foreground/40"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
