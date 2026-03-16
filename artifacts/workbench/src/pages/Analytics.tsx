import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
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
  ChevronRight,
  Activity,
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

function useDiagnostics() {
  return useQuery({
    queryKey: ["analytics", "diagnostics"],
    queryFn: () => apiFetch<any>("/analytics/diagnostics"),
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

function ScoreBar({ label, value, max = 100, href }: { label: string; value: number; max?: number; href?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct >= 70 ? "bg-red-500" : pct >= 40 ? "bg-amber-500" : "bg-emerald-500";
  const content = (
    <div className={`flex items-center gap-3 ${href ? "cursor-pointer hover:bg-slate-50 rounded-lg p-1 -m-1" : ""}`}>
      <span className="text-sm text-slate-600 w-40 truncate">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-mono text-slate-700 w-10 text-right">{Math.round(value)}</span>
      {href && <ChevronRight className="w-3 h-3 text-slate-400" />}
    </div>
  );
  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

export default function AnalyticsPage() {
  const [tab, setTab] = useState<"overview" | "diagnostics">("overview");
  const { data: recData, isLoading: recLoading } = useRecommendationAnalytics();
  const { data: scoreData, isLoading: scoreLoading } = useScoreAnalytics();
  const { data: diagData, isLoading: diagLoading } = useDiagnostics();

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

        <div className="flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setTab("overview")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === "overview"
                ? "border-violet-600 text-violet-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setTab("diagnostics")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === "diagnostics"
                ? "border-violet-600 text-violet-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Diagnostics
          </button>
        </div>

        {tab === "overview" && (
          <>
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
                          href={`/lanes/${l.originPort}/${l.destinationPort}`}
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
                          href={`/ports/${p.portCode}`}
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
                          href={`/carriers/${encodeURIComponent(c.carrierName)}`}
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
                          href={`/entities/${encodeURIComponent(e.entityId)}`}
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
          </>
        )}

        {tab === "diagnostics" && (
          <DiagnosticsView data={diagData} isLoading={diagLoading} />
        )}
      </div>
    </AppLayout>
  );
}

function DiagnosticsView({ data, isLoading }: { data: any; isLoading: boolean }) {
  if (isLoading) return <div className="text-slate-400">Loading diagnostics...</div>;
  if (!data) return <div className="text-slate-400">No diagnostics data available</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4" /> Acceptance / Rejection by Type
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4 text-right">Total</th>
                <th className="pb-2 pr-4 text-right">Accepted</th>
                <th className="pb-2 pr-4 text-right">Rejected</th>
                <th className="pb-2 pr-4 text-right">Accept %</th>
                <th className="pb-2 pr-4 text-right">Reject %</th>
                <th className="pb-2 pr-4 text-right">Impl %</th>
                <th className="pb-2 pr-4 text-right">Intel Accept %</th>
                <th className="pb-2 text-right">Internal Accept %</th>
              </tr>
            </thead>
            <tbody>
              {(data.diagnosticsByType || []).map((d: any) => (
                <tr key={d.type} className="border-b border-slate-50">
                  <td className="py-2 pr-4 font-mono text-xs">{d.type}</td>
                  <td className="py-2 pr-4 text-right">{d.total}</td>
                  <td className="py-2 pr-4 text-right text-emerald-600">{d.accepted + d.modified}</td>
                  <td className="py-2 pr-4 text-right text-red-600">{d.rejected}</td>
                  <td className="py-2 pr-4 text-right font-medium">{d.acceptanceRate}%</td>
                  <td className="py-2 pr-4 text-right">{d.rejectionRate}%</td>
                  <td className="py-2 pr-4 text-right text-blue-600">{d.implementationRate}%</td>
                  <td className="py-2 pr-4 text-right text-violet-600">{d.intelEnrichedAcceptanceRate}%</td>
                  <td className="py-2 text-right">{d.internalOnlyAcceptanceRate}%</td>
                </tr>
              ))}
              {(!data.diagnosticsByType || data.diagnosticsByType.length === 0) && (
                <tr>
                  <td colSpan={9} className="py-4 text-center text-slate-400">No data yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {data.outcomeQuality && Object.keys(data.outcomeQuality).length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Outcome Quality by Type
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(data.outcomeQuality).map(([type, quality]: [string, any]) => (
              <div key={type} className="p-3 rounded-lg border border-slate-100">
                <div className="font-mono text-xs text-slate-600 mb-2">{type}</div>
                <div className="flex gap-3 text-sm">
                  <span className="text-emerald-600">+{quality.positive}</span>
                  <span className="text-slate-400">~{quality.neutral}</span>
                  <span className="text-red-600">-{quality.negative}</span>
                  <span className="text-amber-500">?{quality.pending}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.urgencyBands && data.urgencyBands.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Volume by Urgency Band
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.urgencyBands.map((u: any) => {
              const acceptRate = u.total > 0 ? Math.round((u.accepted / u.total) * 100) : 0;
              const colors: Record<string, string> = {
                CRITICAL: "border-red-200 bg-red-50",
                HIGH: "border-orange-200 bg-orange-50",
                MEDIUM: "border-amber-200 bg-amber-50",
                LOW: "border-slate-200 bg-slate-50",
              };
              return (
                <div key={u.urgency} className={`p-3 rounded-lg border ${colors[u.urgency] || "border-slate-200 bg-slate-50"}`}>
                  <div className="text-xs font-semibold text-slate-600">{u.urgency}</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">{u.total}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Accept: {acceptRate}% | Reject: {u.rejected}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data.topFalsePositives && data.topFalsePositives.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <XCircle className="w-4 h-4" /> Top False Positives (Negative Outcomes)
          </h3>
          <div className="space-y-2">
            {data.topFalsePositives.map((fp: any, i: number) => (
              <Link key={i} href={`/shipments/${fp.shipmentId}`}>
                <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer text-sm">
                  <span className="font-mono text-xs text-slate-600">{fp.shipmentId.slice(0, 12)}...</span>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500">{fp.type}</span>
                    <span className="text-red-600 font-medium">{fp.count} negative</span>
                    <ChevronRight className="w-3 h-3 text-slate-400" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
