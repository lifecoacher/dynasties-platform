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
  Filter,
  ArrowUpRight,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useListExceptions, useAlertsSummary } from "@/hooks/use-exceptions";

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

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-primary" />
              Exceptions & Alerts
            </h1>
            <p className="text-[13px] text-muted-foreground mt-1">
              Monitor, triage, and resolve operational exceptions across all shipments.
            </p>
          </div>
        </div>

        {summary && (
          <div className="grid grid-cols-4 gap-3">
            {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((sev) => {
              const style = SEVERITY_STYLES[sev];
              const count = summary.bySeverity[sev] ?? 0;
              const Icon = style.icon;
              return (
                <div key={sev} className={`p-4 rounded-xl bg-card border ${style.border}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-4 h-4 ${style.text}`} />
                    <span className={`text-[11px] font-medium ${style.text}`}>{sev}</span>
                  </div>
                  <p className="text-[24px] font-bold text-foreground">{count}</p>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-1 border-b border-card-border">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-2 text-[12px] font-medium border-b-2 transition-colors ${
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
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : exceptions.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle2 className="w-10 h-10 text-primary/30 mx-auto mb-3" />
            <p className="text-[14px] text-muted-foreground">No exceptions matching this filter.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {exceptions.map((exc: any, i: number) => {
              const sevStyle = SEVERITY_STYLES[exc.severity] || SEVERITY_STYLES.LOW;
              const statusStyle = STATUS_STYLES[exc.status] || STATUS_STYLES.OPEN;
              const Icon = sevStyle.icon;

              return (
                <motion.div
                  key={exc.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link href={exc.shipmentId ? `/shipments/${exc.shipmentId}` : "#"}>
                    <div className={`p-4 rounded-xl bg-card border ${sevStyle.border} hover:bg-white/[0.02] transition-colors cursor-pointer group`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${sevStyle.bg}`}>
                          <Icon className={`w-4 h-4 ${sevStyle.text}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[13px] font-semibold text-foreground">{exc.title}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${sevStyle.bg} ${sevStyle.text}`}>
                              {exc.severity}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                              {exc.status.replace(/_/g, " ")}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-1 mb-1">{exc.description}</p>
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span>{humanizeType(exc.exceptionType)}</span>
                            {exc.detectedFrom && <span className="opacity-60">{exc.detectedFrom}</span>}
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(exc.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
