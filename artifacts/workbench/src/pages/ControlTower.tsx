import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Zap,
  SortDesc,
  Filter,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { RecommendationCard } from "@/components/recommendations/RecommendationCard";
import {
  useListPendingRecommendations,
  useListShipments,
  useRespondToRecommendation,
  getAuthToken,
} from "@workspace/api-client-react";
import {
  HighRiskPortsWidget,
  ActiveDisruptionsWidget,
  SanctionsAlertsWidget,
  CongestionHotspotsWidget,
  WeatherRisksWidget,
} from "@/components/intelligence/IntelligenceWidgets";
import { useTriggerIngestion } from "@/hooks/use-intelligence";

const BASE = `${import.meta.env.BASE_URL}api`;

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
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

type SortMode = "impact" | "margin" | "delay" | "risk" | "recency";

export default function ControlTower() {
  const [, navigate] = useLocation();
  const [viewMode, setViewMode] = useState<"urgency" | "impact">("urgency");
  const [sortBy, setSortBy] = useState<SortMode>("impact");
  const { data: recsData, refetch: refetchRecs } = useListPendingRecommendations();
  const { data: shipmentsData } = useListShipments();
  const respondMutation = useRespondToRecommendation();
  const triggerIngestion = useTriggerIngestion();
  const [ingesting, setIngesting] = useState(false);

  const { data: prioritizedData, refetch: refetchPrioritized } = useQuery({
    queryKey: ["recommendations", "prioritized", sortBy],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch(`${BASE}/recommendations/prioritized?sortBy=${sortBy}`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      return json.data;
    },
    staleTime: 15_000,
    enabled: viewMode === "impact",
  });

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

  const needsIntervention = shipments.filter((s: any) =>
    s.status === "PENDING_REVIEW" ||
    recommendations.some((r: any) => r.shipmentId === s.id && (r.urgency === "CRITICAL" || r.urgency === "HIGH"))
  );

  const handleRespond = useCallback((id: string, action: "ACCEPTED" | "MODIFIED" | "REJECTED", notes?: string) => {
    respondMutation.mutate(
      { id, data: { action, modificationNotes: notes } },
      {
        onSuccess: () => {
          refetchRecs();
          if (viewMode === "impact") refetchPrioritized();
        },
      },
    );
  }, [respondMutation, refetchRecs, refetchPrioritized, viewMode]);

  const handleRefresh = useCallback(() => {
    refetchRecs();
    if (viewMode === "impact") refetchPrioritized();
  }, [refetchRecs, refetchPrioritized, viewMode]);

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-[1200px]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Control Tower</h1>
            <p className="text-sm text-muted-foreground mt-1">AI-powered operational intelligence and intervention center</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-secondary rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setViewMode("urgency")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === "urgency" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                By Urgency
              </button>
              <button
                onClick={() => setViewMode("impact")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === "impact" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                By Impact
              </button>
            </div>
            <button
              onClick={handleIngestAll}
              disabled={ingesting}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-lg border border-primary/20 hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              <Download size={14} className={ingesting ? "animate-pulse" : ""} />
              {ingesting ? "Ingesting..." : "Ingest Intel"}
            </button>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-secondary text-muted-foreground rounded-lg border border-border hover:bg-muted transition-colors"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={AlertTriangle} label="Critical" value={criticalRecs.length} color="bg-[#E05252]/5 border-[#E05252]/20" />
          <StatCard icon={Shield} label="Compliance" value={complianceAlerts.length} color="bg-[#D4A24C]/5 border-[#D4A24C]/20" />
          <StatCard icon={Clock} label="Delay Risk" value={delayWarnings.length} color="bg-[#D4A24C]/5 border-[#D4A24C]/20" />
          <StatCard icon={DollarSign} label="Margin Risk" value={marginWarnings.length} color="bg-primary/5 border-primary/20" />
        </div>

        {viewMode === "impact" ? (
          <ImpactPriorityView
            data={prioritizedData || []}
            sortBy={sortBy}
            onSortChange={setSortBy}
            onRespond={handleRespond}
            navigate={navigate}
          />
        ) : (
          <UrgencyView
            criticalRecs={criticalRecs}
            highRecs={highRecs}
            otherRecs={otherRecs}
            needsIntervention={needsIntervention}
            recommendations={recommendations}
            onRespond={handleRespond}
            navigate={navigate}
          />
        )}

        <div className="border-t border-border pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe size={16} className="text-primary" />
            <h2 className="text-lg font-bold text-foreground">External Intelligence</h2>
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

function ImpactPriorityView({
  data,
  sortBy,
  onSortChange,
  onRespond,
  navigate,
}: {
  data: any[];
  sortBy: SortMode;
  onSortChange: (s: SortMode) => void;
  onRespond: (id: string, action: "ACCEPTED" | "MODIFIED" | "REJECTED", notes?: string) => void;
  navigate: (path: string) => void;
}) {
  const sortOptions: { value: SortMode; label: string }[] = [
    { value: "impact", label: "Impact Score" },
    { value: "margin", label: "Margin Impact" },
    { value: "delay", label: "Delay Impact" },
    { value: "risk", label: "Risk Reduction" },
    { value: "recency", label: "Most Recent" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <SortDesc size={14} className="text-primary" />
          Priority Queue
          <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
            {data.length}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <Filter size={12} className="text-muted-foreground" />
          <div className="flex gap-1">
            {sortOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onSortChange(opt.value)}
                className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                  sortBy === opt.value
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {data.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">No active recommendations</p>
        )}
        {data.map((rec: any) => (
          <div key={rec.id} className="relative">
            {rec.isRecentlyChanged && (
              <div className="absolute -left-1 top-0 bottom-0 w-1 bg-primary rounded-full" />
            )}
            {rec.isIntelligenceTriggered && (
              <div className="absolute -right-1 top-2">
                <div className="flex items-center gap-1 bg-primary/20 text-primary text-[9px] px-1.5 py-0.5 rounded-full">
                  <Zap size={8} />
                  Intel
                </div>
              </div>
            )}
            <div className={`${rec.isRecentlyChanged ? "pl-2" : ""}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                  Score: {rec.impactScore}
                </span>
              </div>
              <RecommendationCard
                recommendation={rec}
                onRespond={onRespond}
                showShipmentRef
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UrgencyView({
  criticalRecs,
  highRecs,
  otherRecs,
  needsIntervention,
  recommendations,
  onRespond,
  navigate,
}: {
  criticalRecs: any[];
  highRecs: any[];
  otherRecs: any[];
  needsIntervention: any[];
  recommendations: any[];
  onRespond: (id: string, action: "ACCEPTED" | "MODIFIED" | "REJECTED", notes?: string) => void;
  navigate: (path: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-[#E05252]" />
            Urgent Recommendations
            <span className="text-[10px] bg-[#E05252]/20 text-[#E05252] px-1.5 py-0.5 rounded-full">
              {criticalRecs.length + highRecs.length}
            </span>
          </h2>
          <div className="space-y-3">
            {[...criticalRecs, ...highRecs].length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">No urgent recommendations</p>
            )}
            {[...criticalRecs, ...highRecs].map((rec: any) => (
              <RecommendationCard
                key={rec.id}
                recommendation={rec}
                onRespond={onRespond}
                showShipmentRef
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <TrendingUp size={14} className="text-[#D4A24C]" />
            Shipments Needing Intervention
            <span className="text-[10px] bg-[#D4A24C]/20 text-[#D4A24C] px-1.5 py-0.5 rounded-full">
              {needsIntervention.length}
            </span>
          </h2>
          <div className="space-y-2">
            {needsIntervention.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">All shipments on track</p>
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
                ? "border-[#E05252]/30 bg-[#E05252]/5"
                : highestUrgency === "HIGH"
                  ? "border-[#D4A24C]/30 bg-[#D4A24C]/5"
                  : "border-border bg-secondary/30";

              return (
                <motion.button
                  key={s.id}
                  onClick={() => navigate(`/shipments/${s.id}`)}
                  className={`w-full text-left border rounded-lg p-3 hover:bg-muted/30 transition-colors ${urgencyColor}`}
                  whileHover={{ x: 4 }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{s.reference}</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-secondary rounded text-muted-foreground uppercase">
                          {s.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {shipRecs.length} recommendation{shipRecs.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <ArrowRight size={14} className="text-muted-foreground" />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>
      </div>

      {otherRecs.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <FileWarning size={14} className="text-muted-foreground" />
            Other Recommendations
            <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full">
              {otherRecs.length}
            </span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {otherRecs.map((rec: any) => (
              <RecommendationCard
                key={rec.id}
                recommendation={rec}
                onRespond={onRespond}
                showShipmentRef
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
