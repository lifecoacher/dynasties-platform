import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import {
  Users,
  Shield,
  Ship,
  ChevronRight,
  Zap,
  AlertTriangle,
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

export default function EntityDossier() {
  const params = useParams<{ entityId: string }>();
  const entityId = params.entityId || "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["dossier", "entity", entityId],
    queryFn: () => apiFetch<any>(`/dossiers/entities/${encodeURIComponent(entityId)}`),
    enabled: !!entityId,
  });

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/analytics" className="hover:text-slate-600">Analytics</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-700">Entity Dossier</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{entityId}</h1>
            <p className="text-sm text-slate-500">Entity / Counterparty Intelligence Dossier</p>
          </div>
        </div>

        {isLoading && <div className="text-slate-400">Loading dossier...</div>}
        {error && <div className="text-red-500">Failed to load dossier data</div>}

        {data && (
          <>
            {data.score && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ScoreGauge label="Composite Risk" value={data.score.compositeScore} />
                <ScoreGauge label="Sanctions Risk" value={data.score.sanctionsRiskScore} />
                <ScoreGauge label="Denied Party" value={data.score.deniedPartyConfidence} />
                <ScoreGauge label="Doc Irregularity" value={data.score.documentationIrregularity} />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Compliance Signals
                </h3>
                {data.complianceSignals?.relevantSanctions?.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-xs font-semibold text-slate-500 mb-2">SANCTIONS MATCHES</h4>
                    <div className="space-y-2">
                      {data.complianceSignals.relevantSanctions.map((s: any, i: number) => (
                        <div key={i} className="p-2 rounded-lg bg-red-50 border border-red-100 text-sm">
                          <div className="font-medium text-red-800">{s.entityName}</div>
                          <div className="text-xs text-red-600">
                            {s.listSource} | Score: {s.matchScore ?? "N/A"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {data.complianceSignals?.relevantDenied?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 mb-2">DENIED PARTY MATCHES</h4>
                    <div className="space-y-2">
                      {data.complianceSignals.relevantDenied.map((d: any, i: number) => (
                        <div key={i} className="p-2 rounded-lg bg-amber-50 border border-amber-100 text-sm">
                          <div className="font-medium text-amber-800">{d.partyName}</div>
                          <div className="text-xs text-amber-600">
                            {d.listSource} | Score: {d.matchScore ?? "N/A"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(!data.complianceSignals?.relevantSanctions?.length && !data.complianceSignals?.relevantDenied?.length) && (
                  <div className="text-slate-400 text-sm">No compliance signals detected</div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Ship className="w-4 h-4" /> Related Shipments ({data.shipments?.length ?? 0})
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
                            s.shipper === data.entityName ? "bg-violet-100 text-violet-700" :
                            s.consignee === data.entityName ? "bg-blue-100 text-blue-700" :
                            "bg-slate-100 text-slate-600"
                          }`}>{s.shipper === data.entityName ? "Shipper" : s.consignee === data.entityName ? "Consignee" : "Party"}</span>
                          <ChevronRight className="w-3 h-3 text-slate-400" />
                        </div>
                      </div>
                    </Link>
                  ))}
                  {(!data.shipments || data.shipments.length === 0) && (
                    <div className="text-slate-400 text-sm">No related shipments</div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Compliance Recommendations ({data.recommendations?.length ?? 0})
                </h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {(data.recommendations || []).map((r: any) => (
                    <Link key={r.id} href={`/shipments/${r.shipmentId}`}>
                      <div className="p-2 rounded-lg border border-slate-100 text-sm hover:bg-slate-50 cursor-pointer">
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
                    </Link>
                  ))}
                  {(!data.recommendations || data.recommendations.length === 0) && (
                    <div className="text-slate-400 text-sm">No compliance recommendations</div>
                  )}
                </div>
              </div>

              {data.graphEdges && data.graphEdges.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <Network className="w-4 h-4" /> Graph Relationships
                  </h3>
                  <div className="space-y-1 max-h-80 overflow-y-auto">
                    {data.graphEdges.map((e: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-600 py-1">
                        <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">{e.sourceType}:{e.sourceId.slice(0, 12)}</span>
                        <span className="text-slate-400">—{e.edgeType}→</span>
                        <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">{e.targetType}:{e.targetId.slice(0, 12)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
