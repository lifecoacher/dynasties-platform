import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Shield,
  RefreshCw,
  Loader2,
  Anchor,
  Truck,
  Globe,
  DollarSign,
  Activity,
  BarChart3,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

const BASE = `${import.meta.env.BASE_URL}api`;

function useAuthHeaders() {
  const token = localStorage.getItem("auth_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

type Tab = "overview" | "lanes" | "carriers" | "portfolio" | "attribution";

const STRATEGY_COLORS: Record<string, string> = {
  STABLE: "text-primary",
  MONITOR_CLOSELY: "text-[#D4A24C]/80",
  REDUCE_EXPOSURE: "text-[#D4A24C]",
  REROUTE_CONDITIONAL: "text-[#E05252]",
  REPRICE_LANE: "text-[#D4A24C]",
  TIGHTEN_GATES: "text-[#E05252]",
};

const STRATEGY_BG: Record<string, string> = {
  STABLE: "bg-primary/10 border-primary/20",
  MONITOR_CLOSELY: "bg-[#D4A24C]/8 border-[#D4A24C]/15",
  REDUCE_EXPOSURE: "bg-[#D4A24C]/10 border-[#D4A24C]/20",
  REROUTE_CONDITIONAL: "bg-[#E05252]/10 border-red-500/20",
  REPRICE_LANE: "bg-[#D4A24C]/10 border-[#D4A24C]/20",
  TIGHTEN_GATES: "bg-[#E05252]/10 border-[#E05252]/20",
};

const ALLOCATION_COLORS: Record<string, string> = {
  PREFERRED: "text-primary",
  ACCEPTABLE_MONITOR: "text-[#D4A24C]/80",
  AVOID_CURRENT_CONDITIONS: "text-[#E05252]",
  INCREASE_ALLOCATION: "text-primary",
  REDUCE_ALLOCATION: "text-[#D4A24C]",
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "text-[#E05252] bg-[#E05252]/10",
  HIGH: "text-[#D4A24C] bg-[#D4A24C]/10",
  MEDIUM: "text-[#D4A24C]/80 bg-[#D4A24C]/10",
  LOW: "text-slate-400 bg-slate-500/10",
};

export default function StrategyIntelligence() {
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(false);
  const [executiveSummary, setExecutiveSummary] = useState<any>(null);
  const [laneStrategies, setLaneStrategies] = useState<any[]>([]);
  const [carrierAllocations, setCarrierAllocations] = useState<any[]>([]);
  const [networkRecs, setNetworkRecs] = useState<any[]>([]);
  const [portfolio, setPortfolio] = useState<any>(null);
  const [attribution, setAttribution] = useState<any>(null);
  const headers = useAuthHeaders();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, lanesRes, carriersRes, recsRes, portRes, attrRes] = await Promise.all([
        fetch(`${BASE}/strategic/executive-summary`, { headers }),
        fetch(`${BASE}/strategic/lane-strategies`, { headers }),
        fetch(`${BASE}/strategic/carrier-allocations`, { headers }),
        fetch(`${BASE}/strategic/network-recommendations`, { headers }),
        fetch(`${BASE}/strategic/portfolio`, { headers }),
        fetch(`${BASE}/strategic/attribution`, { headers }),
      ]);

      if (sumRes.ok) setExecutiveSummary((await sumRes.json()).data);
      if (lanesRes.ok) setLaneStrategies((await lanesRes.json()).data ?? []);
      if (carriersRes.ok) setCarrierAllocations((await carriersRes.json()).data ?? []);
      if (recsRes.ok) setNetworkRecs((await recsRes.json()).data ?? []);
      if (portRes.ok) setPortfolio((await portRes.json()).data);
      if (attrRes.ok) setAttribution((await attrRes.json()).data);
    } catch (e) {
      console.error("Failed to fetch strategic data", e);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => { fetchData(); }, []);

  const runCompute = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetch(`${BASE}/strategic/lane-strategies/compute`, { method: "POST", headers }),
        fetch(`${BASE}/strategic/carrier-allocations/compute`, { method: "POST", headers }),
        fetch(`${BASE}/strategic/network-recommendations/generate`, { method: "POST", headers }),
        fetch(`${BASE}/strategic/portfolio/compute`, { method: "POST", headers }),
        fetch(`${BASE}/strategic/attribution/compute`, { method: "POST", headers }),
      ]);
      await fetchData();
    } catch (e) {
      console.error("Failed to compute strategies", e);
    } finally {
      setLoading(false);
    }
  };

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "overview", label: "Executive Summary", icon: Target },
    { key: "lanes", label: "Lane Strategy", icon: Globe },
    { key: "carriers", label: "Carrier Allocation", icon: Truck },
    { key: "portfolio", label: "Portfolio Risk", icon: Shield },
    { key: "attribution", label: "Value Attribution", icon: DollarSign },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Target className="w-6 h-6 text-primary/70" />
              Strategic Intelligence
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Network optimization, portfolio risk, and intervention value
            </p>
          </div>
          <button
            onClick={runCompute}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {loading ? "Computing..." : "Run Analysis"}
          </button>
        </div>

        <div className="flex gap-1 mb-6 bg-[#12121a] rounded-lg p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-primary/20 text-primary/70"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {loading && !executiveSummary ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary/70" />
          </div>
        ) : (
          <>
            {tab === "overview" && <OverviewTab summary={executiveSummary} networkRecs={networkRecs} />}
            {tab === "lanes" && <LanesTab lanes={laneStrategies} />}
            {tab === "carriers" && <CarriersTab carriers={carrierAllocations} />}
            {tab === "portfolio" && <PortfolioTab portfolio={portfolio} />}
            {tab === "attribution" && <AttributionTab attribution={attribution} />}
          </>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color = "text-primary/70", sub }: {
  label: string; value: string | number; icon: any; color?: string; sub?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#12121a] border border-white/5 rounded-xl p-4"
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </motion.div>
  );
}

function TrendBadge({ trend }: { trend: string | null }) {
  if (!trend) return <span className="text-xs text-slate-500">—</span>;
  const config: Record<string, { icon: any; color: string }> = {
    improving: { icon: TrendingDown, color: "text-primary" },
    stable: { icon: Minus, color: "text-slate-400" },
    worsening: { icon: TrendingUp, color: "text-[#E05252]" },
  };
  const c = config[trend] ?? config.stable;
  return (
    <span className={`flex items-center gap-1 text-xs ${c.color}`}>
      <c.icon className="w-3 h-3" />
      {trend}
    </span>
  );
}

function OverviewTab({ summary, networkRecs }: { summary: any; networkRecs: any[] }) {
  if (!summary) {
    return (
      <div className="text-center text-slate-500 py-16">
        <Target className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p>No strategic data yet. Click "Run Analysis" to compute.</p>
      </div>
    );
  }

  const nh = summary.networkHealth;
  const port = summary.portfolio;
  const attr = summary.attribution;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Stressed Lanes"
          value={`${nh.stressedLanes} / ${nh.totalLanes}`}
          icon={AlertTriangle}
          color={nh.stressedLanes > 0 ? "text-[#D4A24C]" : "text-primary"}
        />
        <MetricCard
          label="Problem Carriers"
          value={`${nh.problemCarriers} / ${nh.totalCarriers}`}
          icon={Truck}
          color={nh.problemCarriers > 0 ? "text-[#E05252]" : "text-primary"}
        />
        <MetricCard
          label="Open Recommendations"
          value={nh.openRecommendations}
          icon={Activity}
          sub={`${nh.criticalRecommendations} critical`}
        />
        <MetricCard
          label="Active Shipments"
          value={port?.activeShipments ?? 0}
          icon={Anchor}
        />
      </div>

      {port && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="Margin at Risk"
            value={`$${(port.marginAtRisk ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            icon={DollarSign}
            color="text-[#D4A24C]"
          />
          <MetricCard
            label="Mitigated Exposure"
            value={`$${(port.mitigatedExposure ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            icon={Shield}
            color="text-primary"
          />
          <MetricCard
            label="Risk Trend"
            value={port.trends?.riskTrend ?? "—"}
            icon={BarChart3}
          />
          <MetricCard
            label="Delays Avoided"
            value={attr?.delaysAvoided ?? 0}
            icon={CheckCircle}
            color="text-primary"
            sub={attr ? `$${attr.marginProtected?.toLocaleString()} protected` : undefined}
          />
        </div>
      )}

      {port?.riskDistribution && (
        <div className="bg-[#12121a] border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Risk Distribution</h3>
          <div className="flex gap-2 h-6">
            {["low", "medium", "high", "critical"].map((level) => {
              const count = port.riskDistribution[level] ?? 0;
              const total = Object.values(port.riskDistribution as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
              const pct = total > 0 ? (count / total) * 100 : 0;
              const colors: Record<string, string> = { low: "bg-primary", medium: "bg-[#D4A24C]/70", high: "bg-[#D4A24C]", critical: "bg-[#E05252]" };
              return pct > 0 ? (
                <div
                  key={level}
                  className={`${colors[level]} rounded flex items-center justify-center text-xs font-medium`}
                  style={{ width: `${Math.max(pct, 5)}%` }}
                  title={`${level}: ${count}`}
                >
                  {count}
                </div>
              ) : null;
            })}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-slate-500">
            {["low", "medium", "high", "critical"].map((level) => (
              <span key={level} className="capitalize">{level}: {port.riskDistribution[level] ?? 0}</span>
            ))}
          </div>
        </div>
      )}

      {summary.topRecommendations?.length > 0 && (
        <div className="bg-[#12121a] border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Top Strategic Recommendations</h3>
          <div className="space-y-2">
            {summary.topRecommendations.map((rec: any) => (
              <div key={rec.id} className="flex items-start gap-3 p-3 bg-white/[0.02] rounded-lg border border-white/5">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[rec.priority] ?? ""}`}>
                  {rec.priority}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{rec.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{rec.suggestedAction}</p>
                </div>
                <span className="text-xs text-slate-500 shrink-0">{rec.scope}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {networkRecs.length > 0 && (
        <div className="bg-[#12121a] border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-medium text-slate-300 mb-3">
            All Network Recommendations ({networkRecs.length})
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {networkRecs.map((rec: any) => (
              <div key={rec.id} className="flex items-start gap-3 p-3 bg-white/[0.02] rounded-lg border border-white/5">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${PRIORITY_COLORS[rec.priority] ?? ""}`}>
                  {rec.priority}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{rec.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{rec.description}</p>
                </div>
                <span className="text-xs text-slate-500 shrink-0 uppercase">{rec.scope}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LanesTab({ lanes }: { lanes: any[] }) {
  if (lanes.length === 0) {
    return (
      <div className="text-center text-slate-500 py-16">
        <Globe className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p>No lane strategies computed yet. Click "Run Analysis" to generate.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
        {["STABLE", "MONITOR_CLOSELY", "REDUCE_EXPOSURE", "REROUTE_CONDITIONAL", "REPRICE_LANE", "TIGHTEN_GATES"].map((s) => {
          const count = lanes.filter((l) => l.strategy === s).length;
          return (
            <div key={s} className={`text-center p-2 rounded-lg border ${STRATEGY_BG[s]}`}>
              <div className={`text-lg font-bold ${STRATEGY_COLORS[s]}`}>{count}</div>
              <div className="text-xs text-slate-400 mt-0.5">{s.replace(/_/g, " ")}</div>
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        {lanes.map((lane) => (
          <motion.div
            key={lane.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-[#12121a] border border-white/5 rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{lane.originPort} → {lane.destinationPort}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${STRATEGY_BG[lane.strategy]} ${STRATEGY_COLORS[lane.strategy]}`}>
                  {lane.strategy.replace(/_/g, " ")}
                </span>
              </div>
              <span className="text-xs text-slate-500">{lane.shipmentCount} shipments</span>
            </div>

            <div className="grid grid-cols-4 md:grid-cols-8 gap-3 text-xs">
              <div><span className="text-slate-500">Stress</span><div className="font-medium mt-0.5">{(lane.stressScore * 100).toFixed(0)}%</div></div>
              <div><span className="text-slate-500">Delay</span><div className="font-medium mt-0.5">{(lane.delayExposure * 100).toFixed(0)}%</div></div>
              <div><span className="text-slate-500">Disruption</span><div className="font-medium mt-0.5">{(lane.disruptionFrequency * 100).toFixed(0)}%</div></div>
              <div><span className="text-slate-500">Congestion</span><div className="font-medium mt-0.5">{(lane.congestionTrend * 100).toFixed(0)}%</div></div>
              <div><span className="text-slate-500">Recs</span><div className="font-medium mt-0.5">{lane.recommendationVolume}</div></div>
              <div><span className="text-slate-500">Tasks</span><div className="font-medium mt-0.5">{lane.taskVolume}</div></div>
              <div><span className="text-slate-500">Exceptions</span><div className="font-medium mt-0.5">{lane.exceptionCount}</div></div>
              <div><span className="text-slate-500">Confidence</span><div className="font-medium mt-0.5">{(lane.confidence * 100).toFixed(0)}%</div></div>
            </div>

            {lane.suggestedActions?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <div className="flex flex-wrap gap-2">
                  {lane.suggestedActions.map((action: string, i: number) => (
                    <span key={i} className="text-xs text-slate-400 bg-white/[0.03] px-2 py-1 rounded">
                      {action}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function CarriersTab({ carriers }: { carriers: any[] }) {
  if (carriers.length === 0) {
    return (
      <div className="text-center text-slate-500 py-16">
        <Truck className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p>No carrier allocations computed yet. Click "Run Analysis" to generate.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {["PREFERRED", "INCREASE_ALLOCATION", "ACCEPTABLE_MONITOR", "REDUCE_ALLOCATION", "AVOID_CURRENT_CONDITIONS"].map((a) => {
          const count = carriers.filter((c) => c.allocation === a).length;
          return (
            <div key={a} className="text-center p-2 rounded-lg border border-white/5 bg-[#12121a]">
              <div className={`text-lg font-bold ${ALLOCATION_COLORS[a]}`}>{count}</div>
              <div className="text-xs text-slate-400 mt-0.5">{a.replace(/_/g, " ")}</div>
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        {carriers.map((carrier) => (
          <motion.div
            key={carrier.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-[#12121a] border border-white/5 rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{carrier.carrierName}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border border-white/10 ${ALLOCATION_COLORS[carrier.allocation]}`}>
                  {carrier.allocation.replace(/_/g, " ")}
                </span>
              </div>
              <span className="text-xs text-slate-500">{carrier.shipmentCount} shipments</span>
            </div>

            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-xs">
              <div><span className="text-slate-500">Reliability</span><div className="font-medium mt-0.5">{(carrier.reliabilityScore * 100).toFixed(0)}%</div></div>
              <div><span className="text-slate-500">Rec Rate</span><div className="font-medium mt-0.5">{(carrier.recommendationTriggerRate * 100).toFixed(0)}%</div></div>
              <div><span className="text-slate-500">Switch Rate</span><div className="font-medium mt-0.5">{(carrier.switchAwayRate * 100).toFixed(0)}%</div></div>
              <div><span className="text-slate-500">Disruption</span><div className="font-medium mt-0.5">{(carrier.disruptionExposure * 100).toFixed(0)}%</div></div>
              <div><span className="text-slate-500">Lane Perf</span><div className="font-medium mt-0.5">{(carrier.lanePerformance * 100).toFixed(0)}%</div></div>
              <div><span className="text-slate-500">Confidence</span><div className="font-medium mt-0.5">{(carrier.confidence * 100).toFixed(0)}%</div></div>
            </div>

            {carrier.suggestedActions?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <div className="flex flex-wrap gap-2">
                  {carrier.suggestedActions.map((action: string, i: number) => (
                    <span key={i} className="text-xs text-slate-400 bg-white/[0.03] px-2 py-1 rounded">
                      {action}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function PortfolioTab({ portfolio }: { portfolio: any }) {
  if (!portfolio) {
    return (
      <div className="text-center text-slate-500 py-16">
        <Shield className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p>No portfolio snapshot yet. Click "Run Analysis" to generate.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total Shipments" value={portfolio.totalShipments} icon={Anchor} />
        <MetricCard label="Active" value={portfolio.activeShipments} icon={Activity} color="text-primary" />
        <MetricCard
          label="Margin at Risk"
          value={`$${(portfolio.marginAtRisk ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={DollarSign}
          color="text-[#D4A24C]"
        />
        <MetricCard
          label="Delay Exposure"
          value={(portfolio.delayExposure ?? 0).toFixed(1)}
          icon={AlertTriangle}
          color="text-[#D4A24C]"
          sub="aggregate score"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricCard
          label="Mitigated Exposure"
          value={`$${(portfolio.mitigatedExposure ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={Shield}
          color="text-primary"
        />
        <MetricCard
          label="Unmitigated Exposure"
          value={`$${(portfolio.unmitigatedExposure ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={AlertTriangle}
          color="text-[#E05252]"
        />
      </div>

      {portfolio.trends && (
        <div className="bg-[#12121a] border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Trends</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <span className="text-xs text-slate-500">Risk</span>
              <div className="mt-1"><TrendBadge trend={portfolio.trends.riskTrend} /></div>
            </div>
            <div>
              <span className="text-xs text-slate-500">Delay</span>
              <div className="mt-1"><TrendBadge trend={portfolio.trends.delayTrend} /></div>
            </div>
            <div>
              <span className="text-xs text-slate-500">Compliance</span>
              <div className="mt-1"><TrendBadge trend={portfolio.trends.complianceTrend} /></div>
            </div>
          </div>
        </div>
      )}

      {portfolio.exposureByLane?.length > 0 && (
        <ExposureTable title="Exposure by Lane" data={portfolio.exposureByLane} keyField="lane" />
      )}
      {portfolio.exposureByCarrier?.length > 0 && (
        <ExposureTable title="Exposure by Carrier" data={portfolio.exposureByCarrier} keyField="carrier" />
      )}
      {portfolio.exposureByPort?.length > 0 && (
        <ExposureTable title="Exposure by Port" data={portfolio.exposureByPort} keyField="port" />
      )}
    </div>
  );
}

function ExposureTable({ title, data, keyField }: { title: string; data: any[]; keyField: string }) {
  return (
    <div className="bg-[#12121a] border border-white/5 rounded-xl p-5">
      <h3 className="text-sm font-medium text-slate-300 mb-3">{title}</h3>
      <div className="space-y-1.5">
        {data.slice(0, 10).map((item: any, i: number) => {
          const maxExp = Math.max(...data.map((d: any) => d.exposure), 1);
          return (
            <div key={i} className="flex items-center gap-3 text-xs">
              <span className="w-32 truncate text-slate-300 shrink-0">{item[keyField]}</span>
              <div className="flex-1 bg-white/[0.03] rounded h-4">
                <div
                  className="bg-primary/40 h-full rounded"
                  style={{ width: `${(item.exposure / maxExp) * 100}%` }}
                />
              </div>
              <span className="text-slate-400 shrink-0 w-10 text-right">{item.exposure?.toFixed(1)}</span>
              <span className="text-slate-500 shrink-0 w-8 text-right">{item.shipmentCount}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AttributionTab({ attribution }: { attribution: any }) {
  if (!attribution) {
    return (
      <div className="text-center text-slate-500 py-16">
        <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p>No attribution data yet. Click "Run Analysis" to compute.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Delays Avoided"
          value={attribution.delaysAvoided}
          icon={CheckCircle}
          color="text-primary"
          sub={`~${attribution.estimatedDaysSaved?.toFixed(1)} days saved`}
        />
        <MetricCard
          label="Margin Protected"
          value={`$${(attribution.marginProtected ?? 0).toLocaleString()}`}
          icon={DollarSign}
          color="text-primary"
        />
        <MetricCard
          label="Risks Mitigated"
          value={attribution.risksMitigated}
          icon={Shield}
          color="text-primary"
        />
        <MetricCard
          label="Recs Accepted"
          value={`${attribution.recommendationsAccepted} / ${attribution.recommendationsTotal}`}
          icon={Activity}
          sub={attribution.recommendationsTotal > 0
            ? `${((attribution.recommendationsAccepted / attribution.recommendationsTotal) * 100).toFixed(0)}% acceptance`
            : "no data"}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Interventions Triggered"
          value={attribution.interventionsTriggered}
          icon={Activity}
          color="text-[#D4A24C]"
        />
        <MetricCard
          label="Interventions Completed"
          value={attribution.interventionsCompleted}
          icon={CheckCircle}
          color="text-primary"
        />
        <MetricCard
          label="Tasks Auto-Created"
          value={attribution.tasksAutoCreated}
          icon={Target}
          color="text-primary/70"
        />
        <MetricCard
          label="Booking Holds → Prevented"
          value={attribution.bookingHoldsPreventedIssues}
          icon={Shield}
          color="text-primary"
        />
      </div>

      <div className="bg-[#12121a] border border-white/5 rounded-xl p-5">
        <h3 className="text-sm font-medium text-slate-300 mb-3">Intelligence Impact Comparison</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white/[0.02] rounded-lg border border-white/5">
            <span className="text-xs text-slate-500">Intelligence-Enriched Acceptance</span>
            <div className="text-xl font-bold text-primary/70 mt-1">
              {(attribution.intelligenceEnrichedImpact * 100).toFixed(0)}%
            </div>
          </div>
          <div className="p-4 bg-white/[0.02] rounded-lg border border-white/5">
            <span className="text-xs text-slate-500">Internal-Only Acceptance</span>
            <div className="text-xl font-bold text-slate-300 mt-1">
              {(attribution.internalOnlyImpact * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>

      {attribution.attributionDetails?.length > 0 && (
        <div className="bg-[#12121a] border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Attribution Methodology</h3>
          <div className="space-y-2">
            {attribution.attributionDetails.map((d: any, i: number) => (
              <div key={i} className="flex items-center gap-3 text-xs p-2 bg-white/[0.02] rounded border border-white/5">
                <span className="text-slate-500 w-20 shrink-0">{d.category}</span>
                <span className="text-slate-300 flex-1">{d.metric}</span>
                <span className="text-white font-medium w-16 text-right">
                  {typeof d.value === "number" && d.value < 1 && d.value > 0
                    ? `${(d.value * 100).toFixed(0)}%`
                    : d.value}
                </span>
                <span className="text-slate-600 w-64 text-right truncate" title={d.methodology}>{d.methodology}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
