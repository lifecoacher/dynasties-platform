import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Brain,
  AlertTriangle,
  TrendingUp,
  Shield,
  RefreshCw,
  CheckCircle,
  Clock,
  Activity,
  BarChart3,
  Loader2,
  ChevronRight,
  Eye,
} from "lucide-react";
import { Link } from "wouter";

const BASE = `${import.meta.env.BASE_URL}api`;

function useAuthHeaders() {
  const token = localStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

interface RiskDistribution {
  riskLevel: string;
  count: number;
}

interface AlertsByType {
  alertType: string;
  count: number;
}

interface AlertsBySeverity {
  severity: string;
  count: number;
}

interface PredictiveAlert {
  id: string;
  alertType: string;
  severity: string;
  title: string;
  description: string;
  confidenceScore: number;
  status: string;
  affectedPorts: string[] | null;
  affectedLanes: string[] | null;
  affectedShipmentIds: string[] | null;
  createdAt: string;
}

interface PatternSummary {
  patternType: string;
  count: number;
  avgTrendStrength: string | null;
}

interface AnalyticsData {
  riskDistribution: RiskDistribution[];
  alertsByType: AlertsByType[];
  alertsBySeverity: AlertsBySeverity[];
  recentAlerts: PredictiveAlert[];
  patternSummary: PatternSummary[];
  upcomingShipments: number;
  evaluatedShipments: number;
  evaluationCoverage: string;
}

interface Pattern {
  id: string;
  patternType: string;
  subjectKey: string;
  subjectName: string | null;
  sampleCount: number;
  avgValue: number;
  trendDirection: string | null;
  trendStrength: number | null;
  computedAt: string;
}

export default function PredictiveIntelligence() {
  const headers = useAuthHeaders();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [alerts, setAlerts] = useState<PredictiveAlert[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [computingPatterns, setComputingPatterns] = useState(false);
  const [tab, setTab] = useState<"overview" | "alerts" | "patterns" | "performance">("overview");
  const [performance, setPerformance] = useState<any>(null);
  const [loadingPerformance, setLoadingPerformance] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [analyticsRes, alertsRes, patternsRes] = await Promise.all([
        fetch(`${BASE}/predictive/analytics`, { headers }),
        fetch(`${BASE}/predictive/alerts`, { headers }),
        fetch(`${BASE}/predictive/patterns`, { headers }),
      ]);
      const [analyticsJson, alertsJson, patternsJson] = await Promise.all([
        analyticsRes.json(),
        alertsRes.json(),
        patternsRes.json(),
      ]);
      setAnalytics(analyticsJson.data);
      setAlerts(alertsJson.data || []);
      setPatterns(patternsJson.data || []);
    } catch (e) {
      console.error("Failed to fetch predictive data", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const runAnalysis = async () => {
    setRunningAnalysis(true);
    try {
      await fetch(`${BASE}/predictive/analyze`, { method: "POST", headers });
      await fetchData();
    } catch (e) {
      console.error("Analysis failed", e);
    }
    setRunningAnalysis(false);
  };

  const fetchPerformance = async () => {
    setLoadingPerformance(true);
    try {
      const res = await fetch(`${BASE}/predictive/performance`, { headers });
      const json = await res.json();
      setPerformance(json.data);
    } catch (e) {
      console.error("Failed to fetch performance", e);
    }
    setLoadingPerformance(false);
  };

  useEffect(() => {
    if (tab === "performance" && !performance) fetchPerformance();
  }, [tab]);

  const computePatterns = async () => {
    setComputingPatterns(true);
    try {
      await fetch(`${BASE}/predictive/patterns/compute`, { method: "POST", headers });
      await fetchData();
    } catch (e) {
      console.error("Pattern compute failed", e);
    }
    setComputingPatterns(false);
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      await fetch(`${BASE}/predictive/alerts/${alertId}/acknowledge`, {
        method: "PATCH",
        headers,
      });
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (e) {
      console.error("Acknowledge failed", e);
    }
  };

  const riskLevelColor = (level: string) => {
    switch (level) {
      case "CRITICAL": return "text-red-400 bg-red-500/10 border-red-500/20";
      case "HIGH": return "text-orange-400 bg-orange-500/10 border-orange-500/20";
      case "MODERATE": return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
      case "LOW": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      default: return "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";
    }
  };

  const severityColor = (sev: string) => {
    switch (sev) {
      case "CRITICAL": return "bg-red-500/10 text-red-400 border-red-500/30";
      case "WARNING": return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "INFO": return "bg-blue-500/10 text-blue-400 border-blue-500/30";
      default: return "bg-zinc-500/10 text-zinc-400 border-zinc-500/30";
    }
  };

  const trendIcon = (dir: string | null) => {
    if (dir === "RISING") return <TrendingUp className="w-3.5 h-3.5 text-red-400" />;
    if (dir === "FALLING") return <TrendingUp className="w-3.5 h-3.5 text-emerald-400 rotate-180" />;
    return <Activity className="w-3.5 h-3.5 text-zinc-400" />;
  };

  const alertTypeLabel = (t: string) =>
    t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const patternTypeLabel = (t: string) => {
    const map: Record<string, string> = {
      LANE_DELAY_AVG: "Lane Delays",
      PORT_DISRUPTION_FREQ: "Port Disruptions",
      CARRIER_PERFORMANCE: "Carrier Performance",
      ENTITY_COMPLIANCE_INCIDENTS: "Compliance Incidents",
    };
    return map[t] || t;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Predictive Intelligence
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pre-shipment risk evaluation, disruption forecasting, and historical pattern analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runAnalysis}
            disabled={runningAnalysis}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 flex items-center gap-1.5 border border-primary/20"
          >
            {runningAnalysis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            Run Disruption Analysis
          </button>
          <button
            onClick={computePatterns}
            disabled={computingPatterns}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 disabled:opacity-50 flex items-center gap-1.5 border border-violet-500/20"
          >
            {computingPatterns ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
            Compute Patterns
          </button>
          <button
            onClick={fetchData}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 flex items-center gap-1.5 border border-zinc-700"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          icon={<Shield className="w-4 h-4 text-emerald-400" />}
          label="Evaluation Coverage"
          value={`${analytics?.evaluationCoverage ?? 0}%`}
          sub={`${analytics?.evaluatedShipments ?? 0} of ${analytics?.upcomingShipments ?? 0} evaluated`}
        />
        <MetricCard
          icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
          label="Active Alerts"
          value={String(alerts.length)}
          sub={`${alerts.filter((a) => a.severity === "CRITICAL").length} critical`}
        />
        <MetricCard
          icon={<TrendingUp className="w-4 h-4 text-blue-400" />}
          label="Patterns Tracked"
          value={String(patterns.length)}
          sub={`${analytics?.patternSummary?.length ?? 0} categories`}
        />
        <MetricCard
          icon={<Activity className="w-4 h-4 text-violet-400" />}
          label="Risk Distribution"
          value={String(analytics?.riskDistribution?.length ?? 0)}
          sub="risk levels observed"
        />
      </div>

      <div className="flex gap-1 border-b border-border">
        {(["overview", "alerts", "patterns", "performance"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "overview" ? "Overview" : t === "alerts" ? `Alerts (${alerts.length})` : t === "patterns" ? `Patterns (${patterns.length})` : "Performance"}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Risk Distribution
            </h3>
            {analytics?.riskDistribution && analytics.riskDistribution.length > 0 ? (
              <div className="space-y-3">
                {["CRITICAL", "HIGH", "MODERATE", "LOW"].map((level) => {
                  const item = analytics.riskDistribution.find((r) => r.riskLevel === level);
                  const total = analytics.riskDistribution.reduce((s, r) => s + r.count, 0);
                  const pct = item && total > 0 ? (item.count / total) * 100 : 0;
                  return (
                    <div key={level} className="flex items-center gap-3">
                      <span className={`text-xs font-medium w-20 px-2 py-0.5 rounded border ${riskLevelColor(level)}`}>
                        {level}
                      </span>
                      <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            level === "CRITICAL" ? "bg-red-500" : level === "HIGH" ? "bg-orange-500" : level === "MODERATE" ? "bg-yellow-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-10 text-right">
                        {item?.count ?? 0}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No risk evaluations yet. Evaluate shipments to see distribution.</p>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Active Alerts by Severity
            </h3>
            {analytics?.alertsBySeverity && analytics.alertsBySeverity.length > 0 ? (
              <div className="space-y-3">
                {analytics.alertsBySeverity.map((item) => (
                  <div key={item.severity} className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${severityColor(item.severity)}`}>
                      {item.severity}
                    </span>
                    <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          item.severity === "CRITICAL" ? "bg-red-500" : item.severity === "WARNING" ? "bg-amber-500" : "bg-blue-500"
                        }`}
                        style={{ width: `${Math.min((item.count / 10) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-10 text-right">{item.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active alerts. Run disruption analysis to detect issues.</p>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card border border-border rounded-xl p-5 col-span-2"
          >
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              Recent Alerts
            </h3>
            {analytics?.recentAlerts && analytics.recentAlerts.length > 0 ? (
              <div className="space-y-2">
                {analytics.recentAlerts.slice(0, 5).map((alert) => (
                  <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border mt-0.5 ${severityColor(alert.severity)}`}>
                      {alert.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{alert.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{alert.description}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(alert.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recent alerts.</p>
            )}
          </motion.div>
        </div>
      )}

      {tab === "alerts" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {alerts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No active alerts. Run disruption analysis to detect potential issues.</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div key={alert.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${severityColor(alert.severity)}`}>
                      {alert.severity}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{alert.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{alert.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700">
                          {alertTypeLabel(alert.alertType)}
                        </span>
                        <span>Confidence: {(alert.confidenceScore * 100).toFixed(0)}%</span>
                        {alert.affectedPorts && alert.affectedPorts.length > 0 && (
                          <span>Ports: {alert.affectedPorts.join(", ")}</span>
                        )}
                        {alert.affectedShipmentIds && alert.affectedShipmentIds.length > 0 && (
                          <span>{alert.affectedShipmentIds.length} shipment(s) affected</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="px-2.5 py-1 text-[10px] font-medium rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700 flex items-center gap-1 shrink-0"
                  >
                    <CheckCircle className="w-3 h-3" />
                    Acknowledge
                  </button>
                </div>
              </div>
            ))
          )}
        </motion.div>
      )}

      {tab === "patterns" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {patterns.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No patterns computed yet. Click "Compute Patterns" to analyze historical data.</p>
            </div>
          ) : (
            <>
              {["LANE_DELAY_AVG", "PORT_DISRUPTION_FREQ", "CARRIER_PERFORMANCE", "ENTITY_COMPLIANCE_INCIDENTS"].map(
                (type) => {
                  const grouped = patterns.filter((p) => p.patternType === type);
                  if (grouped.length === 0) return null;
                  return (
                    <div key={type} className="bg-card border border-border rounded-xl p-5">
                      <h3 className="text-sm font-semibold text-foreground mb-3">
                        {patternTypeLabel(type)}
                        <span className="ml-2 text-xs text-muted-foreground font-normal">({grouped.length})</span>
                      </h3>
                      <div className="divide-y divide-border">
                        {grouped.map((p) => (
                          <div key={p.id} className="py-2.5 flex items-center gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground truncate">{p.subjectName || p.subjectKey}</p>
                              <p className="text-xs text-muted-foreground">
                                {p.sampleCount} samples · Avg: {p.avgValue.toFixed(2)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {trendIcon(p.trendDirection)}
                              <span className="text-[10px] text-muted-foreground">
                                {p.trendDirection || "STABLE"}
                              </span>
                              {p.trendStrength !== null && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-zinc-800 rounded border border-zinc-700 text-zinc-400">
                                  {(p.trendStrength * 100).toFixed(0)}%
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                },
              )}
            </>
          )}
        </motion.div>
      )}

      {tab === "performance" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {loadingPerformance && !performance ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : performance ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
                  label="Alerts (30d)"
                  value={String(performance.alerts.totalAlerts)}
                  sub={`${performance.alerts.resolvedAlerts} resolved, ${performance.alerts.expiredAlerts} expired`}
                />
                <MetricCard
                  icon={<Shield className="w-4 h-4 text-cyan-400" />}
                  label="Booking Decisions"
                  value={String(performance.bookings.totalDecisions)}
                  sub={`${Math.round(performance.bookings.approvalRate * 100)}% approval rate`}
                />
                <MetricCard
                  icon={<Activity className="w-4 h-4 text-orange-400" />}
                  label="Gate Holds"
                  value={String(performance.gateHolds.totalHolds)}
                  sub={`${performance.gateHolds.activeHolds} active, ${performance.gateHolds.overriddenHolds} overridden`}
                />
                <MetricCard
                  icon={<BarChart3 className="w-4 h-4 text-teal-400" />}
                  label="Playbooks"
                  value={String(performance.playbooks.totalPlaybooks)}
                  sub={`${Math.round(performance.playbooks.avgCompletionRate * 100)}% avg completion`}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Booking Distribution</h3>
                  <div className="space-y-2">
                    {Object.entries(performance.bookings.byStatus || {}).map(([status, cnt]: [string, any]) => (
                      <div key={status} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{status.replace(/_/g, " ")}</span>
                        <span className="font-mono text-foreground">{cnt}</span>
                      </div>
                    ))}
                    <div className="border-t border-border pt-2 mt-2 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Avg Risk Score</span>
                        <span className="font-mono text-foreground">{Math.round(performance.bookings.avgRiskScore * 100)}%</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Avg Readiness</span>
                        <span className="font-mono text-foreground">{Math.round(performance.bookings.avgReadinessScore * 100)}%</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Blocked Rate</span>
                        <span className="font-mono text-red-400">{Math.round(performance.bookings.blockedRate * 100)}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Gate Hold Analysis</h3>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground mb-2">By Gate Type:</p>
                    {Object.entries(performance.gateHolds.byGateType || {}).map(([type, cnt]: [string, any]) => (
                      <div key={type} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{type.replace(/_/g, " ")}</span>
                        <span className="font-mono text-foreground">{cnt}</span>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground mb-2 mt-3">By Severity:</p>
                    {Object.entries(performance.gateHolds.bySeverity || {}).map(([sev, cnt]: [string, any]) => (
                      <div key={sev} className="flex items-center justify-between text-xs">
                        <span className={`${
                          sev === "CRITICAL" ? "text-red-400" :
                          sev === "HIGH" ? "text-orange-400" : "text-amber-400"
                        }`}>{sev}</span>
                        <span className="font-mono text-foreground">{cnt}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Alert Accuracy</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Average Confidence</span>
                      <span className="font-mono text-foreground">{Math.round(performance.alerts.avgConfidence * 100)}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2 mt-3">By Severity:</p>
                    {Object.entries(performance.alerts.bySeverity || {}).map(([sev, cnt]: [string, any]) => (
                      <div key={sev} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{sev}</span>
                        <span className="font-mono text-foreground">{cnt}</span>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground mb-2 mt-3">By Type:</p>
                    {Object.entries(performance.alerts.byType || {}).map(([type, cnt]: [string, any]) => (
                      <div key={type} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{type.replace(/_/g, " ")}</span>
                        <span className="font-mono text-foreground">{cnt}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Playbook Execution</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Completed</span>
                      <span className="font-mono text-emerald-400">{performance.playbooks.completedPlaybooks}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">In Progress</span>
                      <span className="font-mono text-amber-400">{performance.playbooks.inProgressPlaybooks}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2 mt-3">By Priority:</p>
                    {Object.entries(performance.playbooks.byPriority || {}).map(([pri, cnt]: [string, any]) => (
                      <div key={pri} className="flex items-center justify-between text-xs">
                        <span className={`${
                          pri === "CRITICAL" ? "text-red-400" :
                          pri === "HIGH" ? "text-orange-400" : "text-amber-400"
                        }`}>{pri}</span>
                        <span className="font-mono text-foreground">{cnt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={fetchPerformance}
                  disabled={loadingPerformance}
                  className="px-3 py-1.5 text-xs font-medium rounded bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {loadingPerformance ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Refresh
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No performance data available yet.</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}
