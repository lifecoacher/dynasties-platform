import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Download,
  Loader2,
  BarChart3,
  Shield,
  Anchor,
  Truck,
  Activity,
  Target,
  RefreshCw,
  Clock,
  AlertTriangle,
  TrendingUp,
  CheckCircle,
} from "lucide-react";

const BASE = `${import.meta.env.BASE_URL}api`;

function useAuthHeaders() {
  const token = localStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const REPORT_TYPES = [
  { key: "EXECUTIVE_SUMMARY", label: "Executive Summary", icon: BarChart3, description: "High-level network health, portfolio risk, and key issues" },
  { key: "PORTFOLIO_RISK", label: "Portfolio Risk", icon: Shield, description: "Active shipment exposure, risk distribution, margin at risk" },
  { key: "LANE_STRATEGY", label: "Lane Strategy", icon: Anchor, description: "Trade lane stress scores, strategies, and recommended actions" },
  { key: "CARRIER_ALLOCATION", label: "Carrier Allocation", icon: Truck, description: "Carrier reliability, allocation recommendations, and risk scores" },
  { key: "VALUE_ATTRIBUTION", label: "Value Attribution", icon: Activity, description: "AI intervention value — delays avoided, margin protected" },
  { key: "RECOMMENDATION_PERFORMANCE", label: "Recommendation Performance", icon: Target, description: "Recommendation acceptance, status breakdown, and priority distribution" },
] as const;

type ReportType = typeof REPORT_TYPES[number]["key"];

interface Report {
  id: string;
  reportType: ReportType;
  title: string;
  data: Record<string, unknown>;
  generatedAt: string;
  periodStart: string | null;
  periodEnd: string | null;
}

export default function ReportsPage() {
  const headers = useAuthHeaders();
  const [generating, setGenerating] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`${BASE}/reports/history?limit=30`, { headers });
      const json = await res.json();
      setReports(json.data || []);
    } catch { /* */ }
    setLoadingHistory(false);
  }, [headers]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const generateReport = async (reportType: string) => {
    setGenerating(reportType);
    try {
      const res = await fetch(`${BASE}/reports/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ reportType }),
      });
      const json = await res.json();
      if (json.data) {
        setSelectedReport(json.data);
        setReports((prev) => [json.data, ...prev]);
      }
    } catch { /* */ }
    setGenerating(null);
  };

  const exportReport = async (reportId: string, format: "JSON" | "CSV") => {
    try {
      const res = await fetch(`${BASE}/reports/${reportId}/export`, {
        method: "POST",
        headers,
        body: JSON.stringify({ format }),
      });
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `report.${format.toLowerCase()}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* */ }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Reports & Analytics
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Generate, view, and export intelligence reports</p>
      </header>

      <main className="flex-1 p-6 overflow-y-auto">
        <div className="grid grid-cols-3 gap-3 mb-6">
          {REPORT_TYPES.map((rt) => (
            <motion.button
              key={rt.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => generateReport(rt.key)}
              disabled={generating === rt.key}
              className="text-left p-4 bg-card border border-border rounded-lg hover:border-primary/30 transition-colors disabled:opacity-60"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <rt.icon className="w-4 h-4 text-primary" />
                </div>
                <h3 className="text-sm font-medium">{rt.label}</h3>
                {generating === rt.key && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary ml-auto" />}
              </div>
              <p className="text-xs text-muted-foreground">{rt.description}</p>
            </motion.button>
          ))}
        </div>

        {selectedReport && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-lg mb-6"
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">{selectedReport.title}</h2>
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{selectedReport.id}</p>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => exportReport(selectedReport.id, "JSON")}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-secondary hover:bg-muted rounded-md transition-colors"
                >
                  <Download className="w-3 h-3" />
                  JSON
                </button>
                <button
                  onClick={() => exportReport(selectedReport.id, "CSV")}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-secondary hover:bg-muted rounded-md transition-colors"
                >
                  <Download className="w-3 h-3" />
                  CSV
                </button>
              </div>
            </div>
            <div className="p-4">
              <ReportDataView data={selectedReport.data} reportType={selectedReport.reportType} />
            </div>
          </motion.div>
        )}

        <div className="bg-card border border-border rounded-lg">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Report History
            </h2>
            <button onClick={loadHistory} className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? "animate-spin" : ""}`} />
            </button>
          </div>
          <div className="divide-y divide-border">
            {reports.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">No reports generated yet. Click a report type above to generate one.</div>
            )}
            {reports.map((r) => {
              const meta = REPORT_TYPES.find((rt) => rt.key === r.reportType);
              const Icon = meta?.icon || FileText;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedReport(r)}
                  className={`w-full text-left p-3 hover:bg-white/[0.02] transition-colors ${selectedReport?.id === r.id ? "bg-primary/5" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium flex-1">{r.title}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{r.id}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 ml-5.5">
                    {r.generatedAt ? new Date(r.generatedAt).toLocaleString() : ""}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

function ReportDataView({ data, reportType }: { data: Record<string, unknown>; reportType: string }) {
  if (reportType === "EXECUTIVE_SUMMARY" && data.networkHealth) {
    const health = data.networkHealth as any;
    const portfolio = data.portfolio as any;
    const topIssues = data.topIssues as any[];

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Stressed Lanes" value={health.stressedLanes} total={health.totalLanes} color="text-[#D4A24C]" />
          <StatCard label="Problem Carriers" value={health.problemCarriers} total={health.totalCarriers} color="text-[#E05252]" />
          <StatCard label="Open Recommendations" value={health.openRecommendations} color="text-primary" />
          <StatCard label="Critical Recs" value={health.criticalRecommendations} color="text-[#E05252]" />
        </div>

        {portfolio && (
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Active Shipments" value={portfolio.activeShipments} color="text-primary" />
            <StatCard label="Margin at Risk" value={`$${(portfolio.marginAtRisk || 0).toLocaleString()}`} color="text-[#D4A24C]" />
            <StatCard label="Delay Exposure" value={`${(portfolio.delayExposure || 0).toFixed(1)}%`} color="text-[#D4A24C]" />
          </div>
        )}

        {topIssues && topIssues.length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Top Issues
            </h3>
            <div className="space-y-1.5">
              {topIssues.map((issue: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs p-2 rounded bg-secondary">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    issue.type === "LANE" ? "bg-primary/10 text-primary" :
                    issue.type === "CARRIER" ? "bg-[#D4A24C]/10 text-[#D4A24C]" :
                    "bg-muted text-muted-foreground"
                  }`}>{issue.type}</span>
                  <span className="font-mono text-foreground">{issue.identifier}</span>
                  <span className="text-muted-foreground ml-auto">
                    {issue.strategy || issue.allocation || issue.priority}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <pre className="text-[11px] font-mono text-muted-foreground bg-secondary rounded-lg p-3 overflow-auto max-h-96">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function StatCard({ label, value, total, color }: { label: string; value: string | number; total?: number; color: string }) {
  return (
    <div className="bg-secondary rounded-lg p-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-semibold mt-1 ${color}`}>
        {value}
        {total !== undefined && <span className="text-xs text-muted-foreground font-normal"> / {total}</span>}
      </p>
    </div>
  );
}
