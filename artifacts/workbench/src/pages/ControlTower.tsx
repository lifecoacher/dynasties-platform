import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  Shield,
  Clock,
  DollarSign,
  FileWarning,
  TrendingUp,
  RefreshCw,
  ArrowRight,
  Globe,
  Download,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { RecommendationCard } from "@/components/recommendations/RecommendationCard";
import {
  useListPendingRecommendations,
  useListShipments,
  useRespondToRecommendation,
} from "@workspace/api-client-react";
import {
  HighRiskPortsWidget,
  ActiveDisruptionsWidget,
  SanctionsAlertsWidget,
  CongestionHotspotsWidget,
  WeatherRisksWidget,
} from "@/components/intelligence/IntelligenceWidgets";
import { useTriggerIngestion } from "@/hooks/use-intelligence";

interface StatCardProps {
  icon: typeof AlertTriangle;
  label: string;
  value: number;
  color: string;
}

function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  return (
    <div className={`border rounded-lg p-4 ${color}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} />
        <span className="text-xs uppercase tracking-wider text-white/50">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

export default function ControlTower() {
  const [, navigate] = useLocation();
  const { data: recsData, refetch: refetchRecs } = useListPendingRecommendations();
  const { data: shipmentsData } = useListShipments();
  const respondMutation = useRespondToRecommendation();
  const triggerIngestion = useTriggerIngestion();
  const [ingesting, setIngesting] = useState(false);

  const handleIngestAll = useCallback(async () => {
    setIngesting(true);
    const sources = ["vessel_positions", "port_congestion", "sanctions", "denied_parties", "disruptions", "weather_risk"];
    for (const sourceType of sources) {
      triggerIngestion.mutate(sourceType);
    }
    setTimeout(() => setIngesting(false), 4000);
  }, [triggerIngestion]);

  const recommendations = (recsData?.data || []) as any[];
  const shipments = (shipmentsData?.data || []) as any[];

  const criticalRecs = recommendations.filter((r: any) => r.urgency === "CRITICAL");
  const highRecs = recommendations.filter((r: any) => r.urgency === "HIGH");
  const otherRecs = recommendations.filter((r: any) => r.urgency === "MEDIUM" || r.urgency === "LOW");

  const complianceAlerts = recommendations.filter((r: any) => r.type === "COMPLIANCE_ESCALATION");
  const delayWarnings = recommendations.filter((r: any) => r.type === "DELAY_WARNING");
  const marginWarnings = recommendations.filter((r: any) => r.type === "MARGIN_WARNING");
  const docCorrections = recommendations.filter((r: any) => r.type === "DOCUMENT_CORRECTION");

  const needsIntervention = shipments.filter((s: any) =>
    s.status === "PENDING_REVIEW" ||
    recommendations.some((r: any) => r.shipmentId === s.id && (r.urgency === "CRITICAL" || r.urgency === "HIGH"))
  );

  const handleRespond = useCallback((id: string, action: "ACCEPTED" | "MODIFIED" | "REJECTED", notes?: string) => {
    respondMutation.mutate(
      { id, data: { action, modificationNotes: notes } },
      { onSuccess: () => refetchRecs() },
    );
  }, [respondMutation, refetchRecs]);

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-[1200px]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Control Tower</h1>
            <p className="text-sm text-white/50 mt-1">AI-powered operational intelligence and intervention center</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleIngestAll}
              disabled={ingesting}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-violet-500/10 text-violet-300 rounded-lg border border-violet-500/20 hover:bg-violet-500/20 transition-colors disabled:opacity-50"
            >
              <Download size={14} className={ingesting ? "animate-pulse" : ""} />
              {ingesting ? "Ingesting..." : "Ingest Intel"}
            </button>
            <button
              onClick={() => refetchRecs()}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white/5 text-white/60 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={AlertTriangle}
            label="Critical"
            value={criticalRecs.length}
            color="bg-red-500/5 border-red-500/20"
          />
          <StatCard
            icon={Shield}
            label="Compliance"
            value={complianceAlerts.length}
            color="bg-amber-500/5 border-amber-500/20"
          />
          <StatCard
            icon={Clock}
            label="Delay Risk"
            value={delayWarnings.length}
            color="bg-yellow-500/5 border-yellow-500/20"
          />
          <StatCard
            icon={DollarSign}
            label="Margin Risk"
            value={marginWarnings.length}
            color="bg-blue-500/5 border-blue-500/20"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section>
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3 flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-400" />
              Urgent Recommendations
              <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded-full">
                {criticalRecs.length + highRecs.length}
              </span>
            </h2>
            <div className="space-y-3">
              {[...criticalRecs, ...highRecs].length === 0 && (
                <p className="text-sm text-white/30 py-8 text-center">No urgent recommendations</p>
              )}
              {[...criticalRecs, ...highRecs].map((rec: any) => (
                <RecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  onRespond={handleRespond}
                  showShipmentRef
                />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3 flex items-center gap-2">
              <TrendingUp size={14} className="text-blue-400" />
              Shipments Needing Intervention
              <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full">
                {needsIntervention.length}
              </span>
            </h2>
            <div className="space-y-2">
              {needsIntervention.length === 0 && (
                <p className="text-sm text-white/30 py-8 text-center">All shipments on track</p>
              )}
              {needsIntervention.map((s: any) => {
                const shipRecs = recommendations.filter((r: any) => r.shipmentId === s.id);
                const highestUrgency = shipRecs.reduce(
                  (max: string, r: any) => {
                    const order = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
                    return (order[r.urgency as keyof typeof order] || 0) > (order[max as keyof typeof order] || 0) ? r.urgency : max;
                  },
                  "LOW",
                );
                const urgencyColor = highestUrgency === "CRITICAL"
                  ? "border-red-500/30 bg-red-500/5"
                  : highestUrgency === "HIGH"
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-white/10 bg-white/[0.02]";

                return (
                  <motion.button
                    key={s.id}
                    onClick={() => navigate(`/shipments/${s.id}`)}
                    className={`w-full text-left border rounded-lg p-3 hover:bg-white/5 transition-colors ${urgencyColor}`}
                    whileHover={{ x: 4 }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{s.reference}</span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-white/10 rounded text-white/60 uppercase">
                            {s.status}
                          </span>
                        </div>
                        <p className="text-xs text-white/40 mt-0.5">
                          {shipRecs.length} recommendation{shipRecs.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <ArrowRight size={14} className="text-white/30" />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </section>
        </div>

        {otherRecs.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileWarning size={14} className="text-yellow-400" />
              Other Recommendations
              <span className="text-[10px] bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 rounded-full">
                {otherRecs.length}
              </span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {otherRecs.map((rec: any) => (
                <RecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  onRespond={handleRespond}
                  showShipmentRef
                />
              ))}
            </div>
          </section>
        )}

        <div className="border-t border-white/10 pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe size={16} className="text-violet-400" />
            <h2 className="text-lg font-bold text-white">External Intelligence</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HighRiskPortsWidget />
            <ActiveDisruptionsWidget />
            <SanctionsAlertsWidget />
            <CongestionHotspotsWidget />
            <WeatherRisksWidget />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
