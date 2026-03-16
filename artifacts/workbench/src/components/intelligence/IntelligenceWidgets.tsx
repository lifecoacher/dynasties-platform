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
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
  high: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  low: "text-blue-400 bg-blue-500/10 border-blue-500/20",
};

const congestionColor: Record<string, string> = {
  critical: "text-red-300 bg-red-500/15",
  high: "text-amber-300 bg-amber-500/15",
  moderate: "text-yellow-300 bg-yellow-500/15",
  low: "text-emerald-300 bg-emerald-500/15",
};

export function HighRiskPortsWidget() {
  const { data, isLoading } = useHighRiskPorts();

  return (
    <WidgetContainer
      icon={Anchor}
      title="High-Risk Ports"
      count={data?.length ?? 0}
      iconColor="text-red-400"
      badgeColor="bg-red-500/20 text-red-300"
      isLoading={isLoading}
    >
      {data?.length === 0 && <EmptyState text="No high-risk ports detected" />}
      {data?.map((port: any) => (
        <motion.div
          key={port.portCode}
          className="border border-white/10 rounded-lg p-3 bg-white/[0.02]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin size={12} className="text-red-400" />
              <span className="text-sm font-medium text-white">{port.portName}</span>
              <span className="text-[10px] text-white/40 font-mono">{port.portCode}</span>
            </div>
            {port.congestionLevel && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${congestionColor[port.congestionLevel] || "text-white/40 bg-white/5"}`}>
                {port.congestionLevel.toUpperCase()}
              </span>
            )}
          </div>
          {port.disruptions.length > 0 && (
            <div className="mt-1.5">
              {port.disruptions.map((d: string, i: number) => (
                <p key={i} className="text-[11px] text-red-300/70 flex items-center gap-1">
                  <AlertOctagon size={10} /> {d}
                </p>
              ))}
            </div>
          )}
          {port.weatherAlerts.length > 0 && (
            <div className="mt-1">
              {port.weatherAlerts.map((w: string, i: number) => (
                <p key={i} className="text-[11px] text-yellow-300/70 flex items-center gap-1">
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
      iconColor="text-amber-400"
      badgeColor="bg-amber-500/20 text-amber-300"
      isLoading={isLoading}
    >
      {data?.length === 0 && <EmptyState text="No active disruptions" />}
      {data?.map((d: any) => (
        <motion.div
          key={d.id}
          className={`border rounded-lg p-3 ${severityColor[d.severity] || "border-white/10 bg-white/[0.02]"}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-white">{d.title}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 uppercase">{d.status}</span>
          </div>
          {d.description && (
            <p className="text-[11px] text-white/50 line-clamp-2">{d.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-white/40">
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
      iconColor="text-violet-400"
      badgeColor="bg-violet-500/20 text-violet-300"
      isLoading={isLoading}
    >
      {totalCount === 0 && <EmptyState text="No sanctions alerts" />}
      {data?.sanctions?.map((s: any) => (
        <div key={s.id} className="border border-violet-500/20 rounded-lg p-3 bg-violet-500/5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white">{s.entityName}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300">{s.entityType}</span>
          </div>
          <div className="flex gap-2 mt-1 text-[10px] text-white/40">
            <span>{s.listName}</span>
            {s.country && <span>• {s.country}</span>}
            {s.sanctionProgram && <span>• {s.sanctionProgram}</span>}
          </div>
        </div>
      ))}
      {data?.deniedParties?.map((dp: any) => (
        <div key={dp.id} className="border border-rose-500/20 rounded-lg p-3 bg-rose-500/5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-white">{dp.partyName}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">denied</span>
          </div>
          <div className="flex gap-2 mt-1 text-[10px] text-white/40">
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
      iconColor="text-orange-400"
      badgeColor="bg-orange-500/20 text-orange-300"
      isLoading={isLoading}
    >
      {hotspots.length === 0 && <EmptyState text="No congestion hotspots" />}
      {hotspots.map((c: any) => (
        <div key={c.id} className={`border rounded-lg p-3 ${congestionColor[c.congestionLevel] ? `border-white/10 ${congestionColor[c.congestionLevel].split(" ")[1]}` : "border-white/10 bg-white/[0.02]"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ship size={12} className="text-orange-400" />
              <span className="text-sm font-medium text-white">{c.portName}</span>
              <span className="text-[10px] text-white/40 font-mono">{c.portCode}</span>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${congestionColor[c.congestionLevel] || "text-white/40 bg-white/5"}`}>
              {c.congestionLevel.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-white/40">
            {c.waitingVessels != null && <span>{c.waitingVessels} vessels waiting</span>}
            {c.avgWaitDays != null && <span>{c.avgWaitDays}d avg wait</span>}
            {c.capacityUtilization != null && <span>{Math.round(c.capacityUtilization * 100)}% capacity</span>}
            {c.trendDirection && (
              <span className={
                c.trendDirection === "worsening" ? "text-red-400" :
                c.trendDirection === "improving" ? "text-emerald-400" : ""
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
      iconColor="text-cyan-400"
      badgeColor="bg-cyan-500/20 text-cyan-300"
      isLoading={isLoading}
    >
      {data?.length === 0 && <EmptyState text="No weather risks" />}
      {data?.map((w: any) => (
        <div key={w.id} className={`border rounded-lg p-3 ${severityColor[w.severity] || "border-white/10 bg-white/[0.02]"}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-white">{w.title}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60 uppercase">{w.status}</span>
          </div>
          {w.description && (
            <p className="text-[11px] text-white/50 line-clamp-2">{w.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-white/40">
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
      <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3 flex items-center gap-2">
        <Icon size={14} className={iconColor} />
        {title}
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${badgeColor}`}>
          {isLoading ? <Loader2 size={10} className="animate-spin" /> : count}
        </span>
      </h2>
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-white/30" />
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-white/30 py-6 text-center">{text}</p>;
}
