import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import {
  Anchor,
  Ship,
  ChevronRight,
  Zap,
  TrendingUp,
  Activity,
  Network,
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

function ScoreGauge({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct >= 70 ? "bg-[#E05252]" : pct >= 40 ? "bg-[#D4A24C]" : "bg-primary";
  const textColor = pct >= 70 ? "text-[#E05252]" : pct >= 40 ? "text-[#D4A24C]" : "text-primary";
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${textColor}`}>{Math.round(value)}</div>
      <div className="h-1.5 bg-slate-100 rounded-full mt-2">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function CarrierDossier() {
  const params = useParams<{ carrierId: string }>();
  const carrierId = params.carrierId || "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["dossier", "carrier", carrierId],
    queryFn: () => apiFetch<any>(`/dossiers/carriers/${encodeURIComponent(carrierId)}`),
    enabled: !!carrierId,
  });

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/analytics" className="hover:text-slate-600">Analytics</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-700">Carrier Dossier</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Anchor className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{carrierId}</h1>
            <p className="text-sm text-slate-500">Carrier Intelligence Dossier</p>
          </div>
        </div>

        {isLoading && <div className="text-slate-400">Loading dossier...</div>}
        {error && <div className="text-red-500">Failed to load dossier data</div>}

        {data && (
          <>
            {data.score && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <ScoreGauge label="Composite Risk" value={data.score.compositeScore} />
                <ScoreGauge label="Performance" value={100 - data.score.performanceScore} />
                <ScoreGauge label="Anomaly" value={data.score.anomalyScore} />
                <ScoreGauge label="Reliability" value={100 - data.score.reliabilityScore} />
                <ScoreGauge label="Lane Stress" value={data.score.laneStressExposure} />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Ship className="w-4 h-4" /> Shipments ({data.shipments?.length ?? 0})
                </h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {(data.shipments || []).map((s: any) => (
                    <Link key={s.id} href={`/shipments/${s.id}`}>
                      <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer text-sm">
                        <div>
                          <span className="font-mono text-xs text-slate-600">{s.reference || s.id.slice(0, 8)}</span>
                          <span className="ml-2 text-slate-400">{s.portOfLoading} → {s.portOfDischarge}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            s.status === "IN_TRANSIT" ? "bg-primary/15 text-primary" :
                            s.status === "COMPLETED" ? "bg-primary/15 text-primary" :
                            "bg-slate-100 text-slate-600"
                          }`}>{s.status}</span>
                          <ChevronRight className="w-3 h-3 text-slate-400" />
                        </div>
                      </div>
                    </Link>
                  ))}
                  {(!data.shipments || data.shipments.length === 0) && (
                    <div className="text-slate-400 text-sm">No shipments for this carrier</div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Active Recommendations ({data.recommendations?.length ?? 0})
                </h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {(data.recommendations || []).map((r: any) => (
                    <div key={r.id} className="p-2 rounded-lg border border-slate-100 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-700">{r.type}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          r.urgency === "CRITICAL" ? "bg-red-100 text-red-700" :
                          r.urgency === "HIGH" ? "bg-[#D4A24C]/15 text-[#D4A24C]" :
                          "bg-slate-100 text-slate-600"
                        }`}>{r.urgency}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1 truncate">{r.title}</div>
                    </div>
                  ))}
                  {(!data.recommendations || data.recommendations.length === 0) && (
                    <div className="text-slate-400 text-sm">No active recommendations</div>
                  )}
                </div>
              </div>
            </div>

            {data.outcomePatterns && data.outcomePatterns.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Outcome Patterns
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {data.outcomePatterns.map((o: any, i: number) => (
                    <div key={i} className="text-sm p-2 rounded-lg bg-slate-50">
                      <span className="text-slate-500">{o.action}</span>
                      {o.evaluation && <span className="text-slate-400 ml-1">({o.evaluation})</span>}
                      <span className="font-medium ml-1">{o.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.laneExposure && data.laneExposure.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Lane Stress Exposure
                </h3>
                <div className="space-y-2">
                  {data.laneExposure.map((l: any, i: number) => (
                    <Link key={i} href={`/lanes/${l.originPort}/${l.destinationPort}`}>
                      <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer text-sm">
                        <span className="text-slate-600">{l.originPort} → {l.destinationPort}</span>
                        <span className="text-xs text-slate-500">Stress: {Math.round(l.compositeStressScore)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {data.graphEdges && data.graphEdges.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Network className="w-4 h-4" /> Graph Relationships
                </h3>
                <div className="space-y-1">
                  {data.graphEdges.slice(0, 10).map((e: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-600 py-1">
                      <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">{e.sourceType}:{e.sourceId.slice(0, 12)}</span>
                      <span className="text-slate-400">—{e.edgeType}→</span>
                      <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">{e.targetType}:{e.targetId.slice(0, 12)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
