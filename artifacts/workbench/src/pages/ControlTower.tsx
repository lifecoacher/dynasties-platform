import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  RefreshCw,
  ArrowRight,
  Download,
  Zap,
  CheckCircle2,
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
import { useToast } from "@/hooks/use-toast";

const BASE = `${import.meta.env.BASE_URL}api`;

type SortMode = "impact" | "margin" | "delay" | "risk" | "recency";

export default function ControlTower() {
  const [, navigate] = useLocation();
  const [viewMode, setViewMode] = useState<"urgency" | "impact">("urgency");
  const [sortBy, setSortBy] = useState<SortMode>("impact");
  const { data: recsData, refetch: refetchRecs } = useListPendingRecommendations();
  const { data: shipmentsData } = useListShipments();
  const respondMutation = useRespondToRecommendation();
  const triggerIngestion = useTriggerIngestion();
  const { toast } = useToast();
  const [ingesting, setIngesting] = useState(false);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);

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

  const hasSignals = criticalRecs.length > 0 || complianceAlerts.length > 0 || delayWarnings.length > 0 || marginWarnings.length > 0;

  const handleRespond = useCallback(async (id: string, action: "ACCEPTED" | "MODIFIED" | "REJECTED" | "IGNORED", notes?: string) => {
    setActionInFlight(id);
    const refetchAll = () => {
      refetchRecs();
      if (viewMode === "impact") refetchPrioritized();
    };
    const actionLabel = action.charAt(0) + action.slice(1).toLowerCase();

    if (action === "IGNORED") {
      const token = getAuthToken();
      try {
        const res = await fetch(`${BASE}/recommendations/${id}/ignore`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        toast({ title: `Recommendation ${actionLabel}` });
        refetchAll();
      } catch (err: any) {
        toast({ variant: "destructive", title: "Action failed", description: err?.message || "Could not ignore recommendation" });
      } finally {
        setActionInFlight(null);
      }
      return;
    }
    respondMutation.mutate(
      { id, data: { action, modificationNotes: notes } },
      {
        onSuccess: () => {
          toast({ title: `Recommendation ${actionLabel}` });
          refetchAll();
          setActionInFlight(null);
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: "Action failed", description: err?.message || "Could not respond to recommendation" });
          setActionInFlight(null);
        },
      },
    );
  }, [respondMutation, refetchRecs, refetchPrioritized, viewMode, toast]);

  const handleRefresh = useCallback(() => {
    refetchRecs();
    if (viewMode === "impact") refetchPrioritized();
  }, [refetchRecs, refetchPrioritized, viewMode]);

  const voiceText = criticalRecs.length > 0
    ? `${criticalRecs.length} critical recommendation${criticalRecs.length > 1 ? "s" : ""} — review now`
    : hasSignals
      ? "Active warnings detected. Review recommended actions."
      : "All routes monitored. No active threats.";

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-[1000px]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold text-foreground tracking-tight font-heading">Control Tower</h1>
            <p className={`text-[13px] mt-1 ${criticalRecs.length > 0 ? "text-[#E05252]" : hasSignals ? "text-[#D4A24C]" : "text-primary/60"}`}>
              {voiceText}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("urgency")}
                className={`px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  viewMode === "urgency" ? "bg-primary/10 text-primary" : "text-muted-foreground/50 hover:text-foreground"
                }`}
              >
                Urgency
              </button>
              <button
                onClick={() => setViewMode("impact")}
                className={`px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  viewMode === "impact" ? "bg-primary/10 text-primary" : "text-muted-foreground/50 hover:text-foreground"
                }`}
              >
                Impact
              </button>
            </div>
            <button
              onClick={handleIngestAll}
              disabled={ingesting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-primary/10 text-primary rounded-lg hover:bg-primary/15 transition-colors disabled:opacity-50"
            >
              <Download size={13} className={ingesting ? "animate-pulse" : ""} />
              {ingesting ? "Ingesting..." : "Ingest"}
            </button>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-muted-foreground/40 rounded-lg hover:text-muted-foreground transition-colors"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        {hasSignals && (
          <div className="flex items-center gap-6 text-[13px]">
            {criticalRecs.length > 0 && (
              <div>
                <span className="text-muted-foreground/50 text-[11px] uppercase tracking-wider">Critical</span>
                <div className="mt-0.5">
                  <span className="text-[18px] font-bold text-[#E05252] tabular-nums">{criticalRecs.length}</span>
                </div>
              </div>
            )}
            {complianceAlerts.length > 0 && (
              <>
                <div className="w-px h-7 bg-border/50" />
                <div>
                  <span className="text-muted-foreground/50 text-[11px] uppercase tracking-wider">Compliance</span>
                  <div className="mt-0.5">
                    <span className="text-[18px] font-bold text-[#D4A24C] tabular-nums">{complianceAlerts.length}</span>
                  </div>
                </div>
              </>
            )}
            {delayWarnings.length > 0 && (
              <>
                <div className="w-px h-7 bg-border/50" />
                <div>
                  <span className="text-muted-foreground/50 text-[11px] uppercase tracking-wider">Delay Risk</span>
                  <div className="mt-0.5">
                    <span className="text-[18px] font-bold text-[#D4A24C] tabular-nums">{delayWarnings.length}</span>
                  </div>
                </div>
              </>
            )}
            {marginWarnings.length > 0 && (
              <>
                <div className="w-px h-7 bg-border/50" />
                <div>
                  <span className="text-muted-foreground/50 text-[11px] uppercase tracking-wider">Margin</span>
                  <div className="mt-0.5">
                    <span className="text-[18px] font-bold text-foreground/70 tabular-nums">{marginWarnings.length}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {viewMode === "impact" ? (
          <ImpactPriorityView
            data={prioritizedData || []}
            sortBy={sortBy}
            onSortChange={setSortBy}
            onRespond={handleRespond}
            navigate={navigate}
            actionInFlight={actionInFlight}
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
            actionInFlight={actionInFlight}
          />
        )}

        <div className="pt-4">
          <h2 className="text-[15px] font-semibold text-foreground font-heading mb-4">External Intelligence</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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
  actionInFlight,
}: {
  data: any[];
  sortBy: SortMode;
  onSortChange: (s: SortMode) => void;
  onRespond: (id: string, action: "ACCEPTED" | "MODIFIED" | "REJECTED" | "IGNORED", notes?: string) => void;
  navigate: (path: string) => void;
  actionInFlight: string | null;
}) {
  const sortOptions: { value: SortMode; label: string }[] = [
    { value: "impact", label: "Impact" },
    { value: "margin", label: "Margin" },
    { value: "delay", label: "Delay" },
    { value: "risk", label: "Risk" },
    { value: "recency", label: "Recent" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-muted-foreground/60 uppercase tracking-wider flex items-center gap-2">
          Priority Queue
          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">
            {data.length}
          </span>
        </h2>
        <div className="flex gap-1">
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSortChange(opt.value)}
              className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                sortBy === opt.value
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground/40 hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {data.length === 0 && (
          <div className="text-center py-16">
            <CheckCircle2 className="w-5 h-5 text-primary/20 mx-auto mb-2" />
            <h3 className="text-[14px] font-medium text-foreground/60 mb-1">No active recommendations</h3>
            <p className="text-[13px] text-muted-foreground/40">Monitoring all routes. Recommendations will surface when needed.</p>
          </div>
        )}
        {data.map((rec: any) => (
          <div key={rec.id} className="relative">
            {rec.isRecentlyChanged && (
              <div className="absolute -left-1 top-0 bottom-0 w-0.5 bg-primary rounded-full" />
            )}
            {rec.isIntelligenceTriggered && (
              <div className="absolute -right-1 top-2">
                <div className="flex items-center gap-1 bg-primary/10 text-primary text-[9px] px-1.5 py-0.5 rounded-full">
                  <Zap size={8} />
                  Intel
                </div>
              </div>
            )}
            <div className={`${rec.isRecentlyChanged ? "pl-2" : ""}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono text-muted-foreground/40 bg-background px-1.5 py-0.5 rounded">
                  Score: {rec.impactScore}
                </span>
              </div>
              <RecommendationCard
                recommendation={rec}
                onRespond={onRespond}
                showShipmentRef
                isLoading={actionInFlight === rec.id}
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
  actionInFlight,
}: {
  criticalRecs: any[];
  highRecs: any[];
  otherRecs: any[];
  needsIntervention: any[];
  recommendations: any[];
  onRespond: (id: string, action: "ACCEPTED" | "MODIFIED" | "REJECTED" | "IGNORED", notes?: string) => void;
  navigate: (path: string) => void;
  actionInFlight: string | null;
}) {
  const urgentRecs = [...criticalRecs, ...highRecs];
  const hasUrgent = urgentRecs.length > 0;
  const hasIntervention = needsIntervention.length > 0;

  return (
    <>
      {(hasUrgent || hasIntervention) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {hasUrgent && (
            <section>
              <h2 className="text-[13px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-3 flex items-center gap-2">
                Urgent Recommendations
                <span className="text-[10px] bg-[#E05252]/10 text-[#E05252] px-1.5 py-0.5 rounded-full font-bold">
                  {urgentRecs.length}
                </span>
              </h2>
              <div className="space-y-3">
                {urgentRecs.map((rec: any) => (
                  <RecommendationCard
                    key={rec.id}
                    recommendation={rec}
                    onRespond={onRespond}
                    showShipmentRef
                    isLoading={actionInFlight === rec.id}
                  />
                ))}
              </div>
            </section>
          )}

          {hasIntervention && (
            <section>
              <h2 className="text-[13px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-3 flex items-center gap-2">
                Shipments Needing Intervention
                <span className="text-[10px] bg-[#D4A24C]/10 text-[#D4A24C] px-1.5 py-0.5 rounded-full font-bold">
                  {needsIntervention.length}
                </span>
              </h2>
              <div className="space-y-2">
                {needsIntervention.map((s: any) => {
                  const shipRecs = recommendations.filter((r: any) => r.shipmentId === s.id);
                  const highestUrgency = shipRecs.reduce(
                    (max: string, r: any) => {
                      const order = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
                      return (order[r.urgency as keyof typeof order] || 0) > (order[max as keyof typeof order] || 0) ? r.urgency : max;
                    },
                    "LOW",
                  );
                  const urgencyBorder = highestUrgency === "CRITICAL"
                    ? "border-[#E05252]/20"
                    : highestUrgency === "HIGH"
                      ? "border-[#D4A24C]/20"
                      : "border-border/60";

                  return (
                    <motion.button
                      key={s.id}
                      onClick={() => navigate(`/shipments/${s.id}`)}
                      className={`w-full text-left border rounded-lg p-3 hover:bg-card transition-all ${urgencyBorder}`}
                      whileHover={{ x: 2 }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-foreground">{s.reference}</span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-background rounded text-muted-foreground/50 uppercase">
                              {s.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground/40 mt-0.5">
                            {shipRecs.length} recommendation{shipRecs.length !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <ArrowRight size={14} className="text-muted-foreground/20" />
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {!hasUrgent && !hasIntervention && (
        <div className="text-center py-14">
          <CheckCircle2 className="w-5 h-5 text-primary/20 mx-auto mb-2" />
          <h3 className="text-[14px] font-medium text-foreground/60 mb-1">No urgent actions</h3>
          <p className="text-[13px] text-muted-foreground/40">All shipments on track. Recommendations will surface when needed.</p>
        </div>
      )}

      {otherRecs.length > 0 && (
        <section>
          <h2 className="text-[13px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-3 flex items-center gap-2">
            Other Recommendations
            <span className="text-[10px] bg-background text-muted-foreground/50 px-1.5 py-0.5 rounded-full font-bold">
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
                isLoading={actionInFlight === rec.id}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
