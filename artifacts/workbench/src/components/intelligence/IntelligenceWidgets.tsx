import { motion } from "framer-motion";
import {
  Anchor,
  AlertOctagon,
  CloudLightning,
  Shield,
  TrendingDown,
  Loader2,
  MapPin,
  Ship,
  Zap,
} from "lucide-react";
import {
  useHighRiskPorts,
  useActiveDisruptions,
  useWeatherRisks,
  useSanctionsAlerts,
  useCongestion,
} from "@/hooks/use-intelligence";

const severityColor: Record<string, string> = {
  critical: "text-[#E05252] bg-[#E05252]/10 border-[#E05252]/20",
  high: "text-[#D4A24C] bg-[#D4A24C]/10 border-[#D4A24C]/20",
  medium: "text-[#D4A24C]/80 bg-[#D4A24C]/5 border-[#D4A24C]/15",
  low: "text-primary/80 bg-primary/5 border-primary/15",
};

const congestionColor: Record<string, string> = {
  critical: "text-[#E05252] bg-[#E05252]/15",
  high: "text-[#D4A24C] bg-[#D4A24C]/15",
  moderate: "text-[#D4A24C]/80 bg-[#D4A24C]/10",
  low: "text-primary bg-primary/15",
};

export function HighRiskPortsWidget() {
  const { data, isLoading } = useHighRiskPorts();

  return (
    <WidgetContainer
      icon={Anchor}
      title="High-Risk Ports"
      count={data?.length ?? 0}
      iconColor="text-[#E05252]"
      badgeColor="bg-[#E05252]/20 text-[#E05252]"
      isLoading={isLoading}
    >
      {data?.length === 0 && <EmptyState text="No high-risk ports detected" />}
      {data?.map((port: any) => (
        <motion.div
          key={port.portCode}
          className="border border-border rounded-lg p-3 bg-secondary/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin size={12} className="text-[#E05252]" />
              <span className="text-sm font-medium text-foreground">{port.portName}</span>
              <span className="text-[10px] text-muted-foreground font-mono">{port.portCode}</span>
            </div>
            {port.congestionLevel && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${congestionColor[port.congestionLevel] || "text-muted-foreground bg-secondary"}`}>
                {port.congestionLevel.toUpperCase()}
              </span>
            )}
          </div>
          {port.disruptions.length > 0 && (
            <div className="mt-1.5">
              {port.disruptions.map((d: string, i: number) => (
                <p key={i} className="text-[11px] text-[#E05252]/70 flex items-center gap-1">
                  <AlertOctagon size={10} /> {d}
                </p>
              ))}
            </div>
          )}
          {port.weatherAlerts.length > 0 && (
            <div className="mt-1">
              {port.weatherAlerts.map((w: string, i: number) => (
                <p key={i} className="text-[11px] text-[#D4A24C]/70 flex items-center gap-1">
                  <CloudLightning size={10} /> {w}
                </p>
              ))}
            </div>
          )}
        </motion.div>
      ))}
    </WidgetContainer>
  );
}

export function ActiveDisruptionsWidget() {
  const { data, isLoading } = useActiveDisruptions();

  return (
    <WidgetContainer
      icon={AlertOctagon}
      title="Active Disruptions"
      count={data?.length ?? 0}
      iconColor="text-[#D4A24C]"
      badgeColor="bg-[#D4A24C]/20 text-[#D4A24C]"
      isLoading={isLoading}
    >
      {data?.length === 0 && <EmptyState text="No active disruptions" />}
      {data?.map((d: any) => (
        <motion.div
          key={d.id}
          className={`border rounded-lg p-3 ${severityColor[d.severity] || "border-border bg-secondary/30"}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-foreground">{d.title}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground uppercase">{d.status}</span>
          </div>
          {d.description && (
            <p className="text-[11px] text-muted-foreground line-clamp-2">{d.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
            <span>{d.eventType?.replace(/_/g, " ")}</span>
            {d.estimatedImpactDays && <span>~{d.estimatedImpactDays}d impact</span>}
            {d.affectedPorts?.length > 0 && (
              <span className="font-mono">{(d.affectedPorts as string[]).join(", ")}</span>
            )}
          </div>
        </motion.div>
      ))}
    </WidgetContainer>
  );
}

export function SanctionsAlertsWidget() {
  const { data, isLoading } = useSanctionsAlerts();
  const totalCount = (data?.sanctions?.length ?? 0) + (data?.deniedParties?.length ?? 0);

  return (
    <WidgetContainer
      icon={Shield}
      title="Sanctions Alerts"
      count={totalCount}
      iconColor="text-[#E05252]"
      badgeColor="bg-[#E05252]/20 text-[#E05252]"
      isLoading={isLoading}
    >
      {totalCount === 0 && <EmptyState text="No sanctions alerts" />}
      {data?.sanctions?.map((s: any) => (
        <div key={s.id} className="border border-[#E05252]/20 rounded-lg p-3 bg-[#E05252]/5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{s.entityName}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#E05252]/20 text-[#E05252]">{s.entityType}</span>
          </div>
          <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
            <span>{s.listName}</span>
            {s.country && <span>• {s.country}</span>}
            {s.sanctionProgram && <span>• {s.sanctionProgram}</span>}
          </div>
        </div>
      ))}
      {data?.deniedParties?.map((dp: any) => (
        <div key={dp.id} className="border border-[#E05252]/20 rounded-lg p-3 bg-[#E05252]/5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{dp.partyName}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#E05252]/20 text-[#E05252]">denied</span>
          </div>
          <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
            <span>{dp.listName}</span>
            {dp.country && <span>• {dp.country}</span>}
          </div>
        </div>
      ))}
    </WidgetContainer>
  );
}

export function CongestionHotspotsWidget() {
  const { data, isLoading } = useCongestion();
  const hotspots = data?.filter((c: any) => c.congestionLevel === "high" || c.congestionLevel === "critical") ?? [];

  return (
    <WidgetContainer
      icon={TrendingDown}
      title="Congestion Hotspots"
      count={hotspots.length}
      iconColor="text-[#D4A24C]"
      badgeColor="bg-[#D4A24C]/20 text-[#D4A24C]"
      isLoading={isLoading}
    >
      {hotspots.length === 0 && <EmptyState text="No congestion hotspots" />}
      {hotspots.map((c: any) => (
        <div key={c.id} className={`border rounded-lg p-3 ${congestionColor[c.congestionLevel] ? `border-border ${congestionColor[c.congestionLevel].split(" ")[1]}` : "border-border bg-secondary/30"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ship size={12} className="text-[#D4A24C]" />
              <span className="text-sm font-medium text-foreground">{c.portName}</span>
              <span className="text-[10px] text-muted-foreground font-mono">{c.portCode}</span>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${congestionColor[c.congestionLevel] || "text-muted-foreground bg-secondary"}`}>
              {c.congestionLevel.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
            {c.waitingVessels != null && <span>{c.waitingVessels} vessels waiting</span>}
            {c.avgWaitDays != null && <span>{c.avgWaitDays}d avg wait</span>}
            {c.capacityUtilization != null && <span>{Math.round(c.capacityUtilization * 100)}% capacity</span>}
            {c.trendDirection && (
              <span className={
                c.trendDirection === "worsening" ? "text-[#E05252]" :
                c.trendDirection === "improving" ? "text-primary" : ""
              }>
                {c.trendDirection === "worsening" ? "↑" : c.trendDirection === "improving" ? "↓" : "→"} {c.trendDirection}
              </span>
            )}
          </div>
        </div>
      ))}
    </WidgetContainer>
  );
}

export function WeatherRisksWidget() {
  const { data, isLoading } = useWeatherRisks();

  return (
    <WidgetContainer
      icon={CloudLightning}
      title="Weather Risks"
      count={data?.length ?? 0}
      iconColor="text-[#D4A24C]"
      badgeColor="bg-[#D4A24C]/20 text-[#D4A24C]"
      isLoading={isLoading}
    >
      {data?.length === 0 && <EmptyState text="No weather risks" />}
      {data?.map((w: any) => (
        <div key={w.id} className={`border rounded-lg p-3 ${severityColor[w.severity] || "border-border bg-secondary/30"}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-foreground">{w.title}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground uppercase">{w.status}</span>
          </div>
          {w.description && (
            <p className="text-[11px] text-muted-foreground line-clamp-2">{w.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
            <span>{w.eventType}</span>
            {w.windSpeedKnots && <span>{w.windSpeedKnots} kts</span>}
            {w.affectedPorts?.length > 0 && (
              <span className="font-mono">{(w.affectedPorts as string[]).join(", ")}</span>
            )}
          </div>
        </div>
      ))}
    </WidgetContainer>
  );
}

function WidgetContainer({
  icon: Icon,
  title,
  count,
  iconColor,
  badgeColor,
  isLoading,
  children,
}: {
  icon: typeof Anchor;
  title: string;
  count: number;
  iconColor: string;
  badgeColor: string;
  isLoading: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
        <Icon size={14} className={iconColor} />
        {title}
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${badgeColor}`}>
          {isLoading ? <Loader2 size={10} className="animate-spin" /> : count}
        </span>
      </h2>
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground py-6 text-center">{text}</p>;
}
