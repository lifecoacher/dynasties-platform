import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  Zap,
  AlertTriangle,
  Anchor,
  Ship,
  MapPin,
  Users,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { getAuthToken } from "@workspace/api-client-react";

const BASE = `${import.meta.env.BASE_URL}api`;

async function apiFetch<T>(path: string): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();
  return json.data;
}

function useRecommendationAnalytics() {
  return useQuery({
    queryKey: ["analytics", "recommendations"],
    queryFn: () => apiFetch<any>("/analytics/recommendations"),
    staleTime: 30_000,
  });
}

function useScoreAnalytics() {
  return useQuery({
    queryKey: ["analytics", "scores"],
    queryFn: () => apiFetch<any>("/analytics/scores"),
    staleTime: 60_000,
  });
}

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: any;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-slate-200 p-5"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm text-slate-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </motion.div>
  );
}

function ScoreBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct >= 70 ? "bg-red-500" : pct >= 40 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-slate-600 w-40 truncate">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-mono text-slate-700 w-10 text-right">{Math.round(value)}</span>
    </div>
  );
}

export default function AnalyticsPage() {
  const { data: recData, isLoading: recLoading } = useRecommendationAnalytics();
  const { data: scoreData, isLoading: scoreLoading } = useScoreAnalytics();

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-violet-600" />
            Recommendation Analytics
          </h1>
          <p className="text-slate-500 mt-1">Quality metrics and scoring intelligence</p>
        </div>

        {recLoading ? (
          <div className="text-slate-400">Loading analytics...</div>
        ) : recData ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Total Recommendations"
                value={recData.totals?.total ?? 0}
                icon={BarChart3}
                color="bg-violet-500"
              />
              <StatCard
                label="Acceptance Rate"
                value={`${recData.totals?.overallAcceptanceRate ?? 0}%`}
                sub={`${(recData.totals?.accepted ?? 0) + (recData.totals?.modified ?? 0) + (recData.totals?.implemented ?? 0)} accepted/modified/implemented`}
                icon={CheckCircle2}
                color="bg-emerald-500"
              />
              <StatCard
                label="Intel Enriched"
                value={`${recData.totals?.intelEnrichmentRate ?? 0}%`}
                sub={`${recData.totals?.intelEnriched ?? 0} enriched recs`}
                icon={Zap}
                color="bg-blue-500"
              />
              <StatCard
                label="Pending"
                value={recData.totals?.pending ?? 0}
                icon={Clock}
                color="bg-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">By Type</h3>
                <div className="space-y-3">
                  {(recData.byType || []).map((t: any) => (
                    <div key={t.type} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 font-mono text-xs">{t.type}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400">Total: {t.total}</span>
                        <span className="text-emerald-600">Accept: {t.acceptanceRate}%</span>
                        <span className="text-blue-600">Impl: {t.implementationRate}%</span>
                        {t.intelEnriched > 0 && (
                          <span className="text-violet-600 text-xs">Intel: {t.intelEnriched}</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!recData.byType || recData.byType.length === 0) && (
                    <div className="text-slate-400 text-sm">No recommendations yet</div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">By Urgency</h3>
                <div className="space-y-3">
                  {(recData.byUrgency || []).map((u: any) => {
                    const colors: Record<string, string> = {
                      CRITICAL: "bg-red-500",
                      HIGH: "bg-orange-500",
                      MEDIUM: "bg-amber-500",
                      LOW: "bg-slate-400",
                    };
                    return (
                      <div key={u.urgency} className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${colors[u.urgency] || "bg-slate-300"}`} />
                        <span className="text-sm text-slate-600 w-20">{u.urgency}</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full">
                          <div
                            className={`h-2 rounded-full ${colors[u.urgency] || "bg-slate-300"}`}
                            style={{
                              width: `${Math.min(100, (u.total / Math.max(1, recData.totals?.total ?? 1)) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-mono text-slate-700 w-8 text-right">{u.total}</span>
                      </div>
                    );
                  })}
                </div>

                {recData.outcomes && recData.outcomes.total > 0 && (
                  <div className="mt-6 pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-semibold text-slate-500 mb-2">OUTCOMES RECORDED</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-slate-600">Total: {recData.outcomes.total}</div>
                      <div className="text-slate-600">With Delay: {recData.outcomes.withDelay}</div>
                      <div className="text-slate-600">With Cost: {recData.outcomes.withCost}</div>
                      {recData.outcomes.avgEvaluation !== null && (
                        <div className="text-slate-600">Avg Eval: {recData.outcomes.avgEvaluation}/5</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}

        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-violet-600" />
            Persistent Scoring
          </h2>

          {scoreLoading ? (
            <div className="text-slate-400">Loading scores...</div>
          ) : scoreData ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Ship className="w-4 h-4" />
                  Trade Lane Stress ({scoreData.lanes?.length ?? 0})
                </h3>
                <div className="space-y-2">
                  {(scoreData.lanes || []).slice(0, 10).map((l: any) => (
                    <ScoreBar
                      key={l.id}
                      label={`${l.originPort} → ${l.destinationPort}`}
                      value={l.compositeStressScore}
                    />
                  ))}
                  {(!scoreData.lanes || scoreData.lanes.length === 0) && (
                    <div className="text-slate-400 text-sm">No lane scores yet. Run intelligence ingestion first.</div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Port Risk ({scoreData.ports?.length ?? 0})
                </h3>
                <div className="space-y-2">
                  {(scoreData.ports || []).slice(0, 10).map((p: any) => (
                    <ScoreBar
                      key={p.id}
                      label={`${p.portName || p.portCode}`}
                      value={p.compositeScore}
                    />
                  ))}
                  {(!scoreData.ports || scoreData.ports.length === 0) && (
                    <div className="text-slate-400 text-sm">No port scores yet.</div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Anchor className="w-4 h-4" />
                  Carrier Risk ({scoreData.carriers?.length ?? 0})
                </h3>
                <div className="space-y-2">
                  {(scoreData.carriers || []).slice(0, 10).map((c: any) => (
                    <ScoreBar
                      key={c.id}
                      label={c.carrierName}
                      value={c.compositeScore}
                    />
                  ))}
                  {(!scoreData.carriers || scoreData.carriers.length === 0) && (
                    <div className="text-slate-400 text-sm">No carrier scores yet.</div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Entity Risk ({scoreData.entities?.length ?? 0})
                </h3>
                <div className="space-y-2">
                  {(scoreData.entities || []).slice(0, 10).map((e: any) => (
                    <ScoreBar
                      key={e.id}
                      label={e.entityName}
                      value={e.compositeScore}
                    />
                  ))}
                  {(!scoreData.entities || scoreData.entities.length === 0) && (
                    <div className="text-slate-400 text-sm">No entity scores yet.</div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AppLayout>
  );
}
