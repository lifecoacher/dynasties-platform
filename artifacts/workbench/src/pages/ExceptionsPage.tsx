import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  AlertCircle,
  Shield,
  XCircle,
  CheckCircle2,
  Loader2,
  Clock,
  ArrowRight,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListExceptions, useAlertsSummary } from "@/hooks/use-exceptions";

const SEVERITY_COLORS: Record<string, { dot: string; text: string; icon: typeof AlertTriangle }> = {
  CRITICAL: { dot: "bg-red-400", text: "text-red-400", icon: XCircle },
  HIGH: { dot: "bg-orange-400", text: "text-orange-400", icon: AlertTriangle },
  MEDIUM: { dot: "bg-yellow-400", text: "text-yellow-400", icon: AlertCircle },
  LOW: { dot: "bg-blue-400", text: "text-blue-400", icon: Shield },
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

export default function ExceptionsPage() {
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const { data: exceptionsRes, isLoading } = useListExceptions({ status: statusFilter || undefined });
  const { data: summaryRes } = useAlertsSummary();

  const exceptions = exceptionsRes?.data || [];
  const summary = summaryRes?.data;

  const criticalCount = summary?.bySeverity?.CRITICAL ?? 0;
  const highCount = summary?.bySeverity?.HIGH ?? 0;
  const totalActive = summary?.needsAttention ?? 0;

  const critical = exceptions.filter((e: any) => e.severity === "CRITICAL");
  const high = exceptions.filter((e: any) => e.severity === "HIGH");
  const rest = exceptions.filter((e: any) => e.severity !== "CRITICAL" && e.severity !== "HIGH");

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-[22px] font-bold text-foreground tracking-tight font-heading">Exceptions</h1>
          <div className="flex items-center gap-4 mt-2 text-[13px]">
            {criticalCount > 0 && (
              <span className="text-red-400 font-medium">{criticalCount} critical</span>
            )}
            {highCount > 0 && (
              <span className="text-orange-400 font-medium">{highCount} high</span>
            )}
            <span className="text-muted-foreground">
              {totalActive > 0 ? `${totalActive} need attention` : "All clear"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 mb-6 border-b border-card-border">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-2.5 text-[12px] font-medium border-b-2 transition-colors ${
                statusFilter === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : exceptions.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle2 className="w-6 h-6 text-primary/30 mx-auto mb-2" />
            <p className="text-[14px] text-muted-foreground">No exceptions matching this filter.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {critical.length > 0 && (
              <ExceptionGroup label="Critical" count={critical.length} exceptions={critical} />
            )}
            {high.length > 0 && (
              <ExceptionGroup label="Needs Attention" count={high.length} exceptions={high} />
            )}
            {rest.length > 0 && (
              <ExceptionGroup label="Other" count={rest.length} exceptions={rest} />
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function ExceptionGroup({ label, count, exceptions }: { label: string; count: number; exceptions: any[] }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[13px] font-semibold text-foreground">{label}</h3>
        <span className="text-[11px] text-muted-foreground">{count}</span>
      </div>
      <div className="space-y-px">
        {exceptions.map((exc: any, i: number) => {
          const sev = SEVERITY_COLORS[exc.severity] || SEVERITY_COLORS.LOW;
          return (
            <motion.div
              key={exc.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
            >
              <Link href={exc.shipmentId ? `/shipments/${exc.shipmentId}` : "#"}>
                <div className="flex items-start gap-3 px-4 py-4 -mx-4 rounded-lg hover:bg-white/[0.02] transition-colors cursor-pointer group border-b border-white/[0.03] last:border-b-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${sev.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[13px] font-medium text-foreground">{exc.title}</span>
                      <span className={`text-[10px] font-medium ${sev.text}`}>{exc.severity}</span>
                      <StatusBadge status={exc.status} />
                    </div>
                    <p className="text-[12px] text-muted-foreground line-clamp-1 mb-1">{exc.description}</p>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60">
                      <span>{humanizeType(exc.exceptionType)}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(exc.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/20 group-hover:text-muted-foreground transition-colors shrink-0 mt-1" />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    OPEN: "text-red-400/70",
    IN_PROGRESS: "text-yellow-400/70",
    ESCALATED: "text-orange-400/70",
    ACKNOWLEDGED: "text-blue-400/70",
    RESOLVED: "text-primary/70",
  };
  return (
    <span className={`text-[10px] font-medium ${colors[status] || "text-muted-foreground"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
