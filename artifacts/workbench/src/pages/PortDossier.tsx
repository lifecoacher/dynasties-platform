import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import {
  MapPin,
  Ship,
  AlertTriangle,
  CloudRain,
  ChevronRight,
  Zap,
  TrendingUp,
  Anchor,
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
  const color = pct >= 70 ? "bg-red-500" : pct >= 40 ? "bg-amber-500" : "bg-emerald-500";
  const textColor = pct >= 70 ? "text-red-600" : pct >= 40 ? "text-amber-600" : "text-emerald-600";
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

export default function PortDossier() {
  const params = useParams<{ portCode: string }>();
  const portCode = params.portCode || "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["dossier", "port", portCode],
    queryFn: () => apiFetch<any>(`/dossiers/ports/${portCode}`),
    enabled: !!portCode,
  });

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/analytics" className="hover:text-slate-600">Analytics</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-700">Port Dossier</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{portCode}</h1>
            <p className="text-sm text-slate-500">{data?.score?.portName || "Port Intelligence Dossier"}</p>
          </div>
        </div>

        {isLoading && <div className="text-slate-400">Loading dossier...</div>}
        {error && <div className="text-red-500">Failed to load dossier data</div>}

        {data && (
          <>
            {data.score && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <ScoreGauge label="Composite Risk" value={data.score.compositeScore} />
                <ScoreGauge label="Congestion" value={data.score.congestionSeverity} />
                <ScoreGauge label="Weather" value={data.score.weatherExposure} />
                <ScoreGauge label="Disruption" value={data.score.disruptionExposure} />
                <ScoreGauge label="Volatility" value={data.score.operationalVolatility} />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Ship className="w-4 h-4" /> Shipments via {portCode} ({data.shipments?.length ?? 0})
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
                            s.status === "IN_TRANSIT" ? "bg-blue-100 text-blue-700" :
                            s.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" :
                            "bg-slate-100 text-slate-600"
                          }`}>{s.status}</span>
                          <ChevronRight className="w-3 h-3 text-slate-400" />
                        </div>
                      </div>
                    </Link>
                  ))}
                  {(!data.shipments || data.shipments.length === 0) && (
                    <div className="text-slate-400 text-sm">No shipments via this port</div>
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
                          r.urgency === "HIGH" ? "bg-orange-100 text-orange-700" :
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Anchor className="w-4 h-4" /> Congestion History
                </h3>
                <div className="space-y-2">
                  {(data.signals?.congestion || []).map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm p-2 rounded-lg bg-slate-50">
                      <span className="text-slate-600">{new Date(c.snapshotTimestamp).toLocaleDateString()}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          c.congestionLevel === "critical" ? "bg-red-100 text-red-700" :
                          c.congestionLevel === "high" ? "bg-orange-100 text-orange-700" :
                          c.congestionLevel === "moderate" ? "bg-amber-100 text-amber-700" :
                          "bg-emerald-100 text-emerald-700"
                        }`}>{c.congestionLevel}</span>
                        {c.averageWaitDays && <span className="text-xs text-slate-500">{c.averageWaitDays}d wait</span>}
                      </div>
                    </div>
                  ))}
                  {(!data.signals?.congestion || data.signals.congestion.length === 0) && (
                    <div className="text-slate-400 text-sm">No congestion history</div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <CloudRain className="w-4 h-4" /> Weather Risks
                  </h3>
                  <div className="space-y-2">
                    {(data.signals?.weather || []).map((w: any, i: number) => (
                      <div key={i} className="p-2 rounded-lg bg-blue-50 border border-blue-100 text-sm">
                        <div className="font-medium text-blue-800">{w.eventType}</div>
                        <div className="text-xs text-blue-600">Severity: {w.severity}</div>
                      </div>
                    ))}
                    {(!data.signals?.weather || data.signals.weather.length === 0) && (
                      <div className="text-slate-400 text-sm">No weather risks</div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Disruptions
                  </h3>
                  <div className="space-y-2">
                    {(data.signals?.disruptions || []).map((d: any, i: number) => (
                      <div key={i} className="p-2 rounded-lg bg-amber-50 border border-amber-100 text-sm">
                        <div className="font-medium text-amber-800">{d.eventType}</div>
                        <div className="text-xs text-amber-600">Severity: {d.severity}</div>
                      </div>
                    ))}
                    {(!data.signals?.disruptions || data.signals.disruptions.length === 0) && (
                      <div className="text-slate-400 text-sm">No active disruptions</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {data.relatedLanes && data.relatedLanes.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Connected Trade Lanes
                </h3>
                <div className="space-y-2">
                  {data.relatedLanes.map((l: any, i: number) => (
                    <Link key={i} href={`/lanes/${l.originPort}/${l.destinationPort}`}>
                      <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer text-sm">
                        <span className="text-slate-600">{l.originPort} → {l.destinationPort}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">Stress: {Math.round(l.compositeStressScore)}</span>
                          <ChevronRight className="w-3 h-3 text-slate-400" />
                        </div>
                      </div>
                    </Link>
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
