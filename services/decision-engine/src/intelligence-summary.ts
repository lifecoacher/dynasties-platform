import { db } from "@workspace/db";
import {
  portCongestionSnapshotsTable,
  disruptionEventsTable,
  weatherRiskEventsTable,
  sanctionsEntitiesTable,
  deniedPartiesTable,
  vesselPositionsTable,
  laneMarketSignalsTable,
  tradeGraphEdgesTable,
} from "@workspace/db/schema";
import { eq, and, or, sql, desc, inArray } from "drizzle-orm";

export interface IntelligenceSummary {
  shipmentId: string;
  laneId: string | null;
  originPort: string | null;
  destinationPort: string | null;
  congestionScore: number;
  disruptionScore: number;
  weatherRiskScore: number;
  sanctionsRiskScore: number;
  vesselRiskScore: number;
  marketPressureScore: number;
  compositeIntelScore: number;
  linkedSignalIds: string[];
  signals: SignalDetail[];
  generatedAt: Date;
}

export interface SignalDetail {
  signalId: string;
  signalType: string;
  severity: string;
  summary: string;
  sourceTable: string;
  externalReasonCode: string;
}

function tenantOrGlobalFilter(col: any, companyId: string) {
  return or(eq(col, companyId), sql`${col} IS NULL`);
}

export async function buildIntelligenceSummary(
  shipmentId: string,
  companyId: string,
  originPort: string | null,
  destinationPort: string | null,
  vessel: string | null,
): Promise<IntelligenceSummary> {
  const laneId = originPort && destinationPort ? `${originPort}-${destinationPort}` : null;
  const portCodes = [originPort, destinationPort].filter(Boolean) as string[];
  const signals: SignalDetail[] = [];
  const linkedSignalIds: string[] = [];

  let congestionScore = 0;
  let disruptionScore = 0;
  let weatherRiskScore = 0;
  let sanctionsRiskScore = 0;
  let vesselRiskScore = 0;
  let marketPressureScore = 0;

  if (portCodes.length > 0) {
    const congestionSnapshots = await db
      .select()
      .from(portCongestionSnapshotsTable)
      .where(
        and(
          inArray(portCongestionSnapshotsTable.portCode, portCodes),
          tenantOrGlobalFilter(portCongestionSnapshotsTable.companyId, companyId),
        ),
      )
      .orderBy(desc(portCongestionSnapshotsTable.snapshotTimestamp))
      .limit(10);

    for (const snap of congestionSnapshots) {
      const levelScore = CONGESTION_LEVEL_SCORES[snap.congestionLevel] ?? 0;
      if (levelScore > congestionScore) congestionScore = levelScore;

      if (levelScore >= 50) {
        linkedSignalIds.push(snap.id);
        const isCritical = snap.congestionLevel === "critical";
        signals.push({
          signalId: snap.id,
          signalType: "port_congestion",
          severity: isCritical ? "CRITICAL" : snap.congestionLevel === "high" ? "HIGH" : "MEDIUM",
          summary: `${snap.portName || snap.portCode}: ${snap.congestionLevel} congestion (${snap.waitingVessels ?? "?"} vessels waiting, ${snap.capacityUtilization ?? "?"}% capacity)`,
          sourceTable: "port_congestion_snapshots",
          externalReasonCode: isCritical ? "PORT_CONGESTION_CRITICAL" : "PORT_CONGESTION_HIGH",
        });
      }
    }
  }

  const disruptions = await db
    .select()
    .from(disruptionEventsTable)
    .where(
      and(
        inArray(disruptionEventsTable.status, ["active", "monitoring"]),
        tenantOrGlobalFilter(disruptionEventsTable.companyId, companyId),
      ),
    )
    .orderBy(desc(disruptionEventsTable.startDate))
    .limit(100);

  for (const d of disruptions) {
    const affectedPorts = (d.affectedPorts as string[]) || [];
    const affectedLanes = (d.affectedLanes as string[]) || [];
    const portMatch = affectedPorts.some((p) => portCodes.includes(p));
    const laneMatch = laneId ? affectedLanes.includes(laneId) : false;

    if (portMatch || laneMatch) {
      const sevScore = SEVERITY_SCORES[d.severity] ?? 0;
      if (sevScore > disruptionScore) disruptionScore = sevScore;

      linkedSignalIds.push(d.id);
      const isCriticalDisruption = d.severity === "critical" || d.severity === "high";
      signals.push({
        signalId: d.id,
        signalType: "disruption",
        severity: d.severity.toUpperCase(),
        summary: `${d.eventType}: ${d.title} (${d.affectedRegion}, est. ${d.estimatedImpactDays ?? "?"} days impact)`,
        sourceTable: "disruption_events",
        externalReasonCode: isCriticalDisruption ? "LANE_DISRUPTION_CRITICAL" : "LANE_DISRUPTION_ACTIVE",
      });
    }
  }

  const weather = await db
    .select()
    .from(weatherRiskEventsTable)
    .where(
      and(
        inArray(weatherRiskEventsTable.status, ["forecast", "active"]),
        tenantOrGlobalFilter(weatherRiskEventsTable.companyId, companyId),
      ),
    )
    .limit(50);

  for (const w of weather) {
    const affectedPorts = (w.affectedPorts as string[]) || [];
    const portMatch = affectedPorts.some((p) => portCodes.includes(p));

    if (portMatch) {
      const sevScore = SEVERITY_SCORES[w.severity] ?? 0;
      if (sevScore > weatherRiskScore) weatherRiskScore = sevScore;

      linkedSignalIds.push(w.id);
      const isCriticalWeather = w.severity === "critical" || w.severity === "high";
      signals.push({
        signalId: w.id,
        signalType: "weather_risk",
        severity: w.severity.toUpperCase(),
        summary: `${w.eventType}: ${w.title} (${w.affectedRegion}${w.windSpeedKnots ? `, ${w.windSpeedKnots}kt winds` : ""})`,
        sourceTable: "weather_risk_events",
        externalReasonCode: isCriticalWeather ? "WEATHER_RISK_CRITICAL" : "WEATHER_RISK_ELEVATED",
      });
    }
  }

  const sanctionsEdges = await db
    .select()
    .from(tradeGraphEdgesTable)
    .where(
      and(
        eq(tradeGraphEdgesTable.edgeType, "ENTITY_SANCTIONS_MATCH"),
        eq(tradeGraphEdgesTable.companyId, companyId),
      ),
    )
    .limit(200);

  const shipmentEntityEdges = await db
    .select()
    .from(tradeGraphEdgesTable)
    .where(
      and(
        eq(tradeGraphEdgesTable.companyId, companyId),
        inArray(tradeGraphEdgesTable.edgeType, [
          "SHIPMENT_SHIPPER",
          "SHIPMENT_CONSIGNEE",
          "SHIPMENT_CARRIER",
          "SHIPMENT_NOTIFY_PARTY",
        ]),
        eq(tradeGraphEdgesTable.sourceId, shipmentId),
      ),
    );

  const shipmentEntityIds = new Set(shipmentEntityEdges.map((e) => e.targetId));

  for (const se of sanctionsEdges) {
    if (shipmentEntityIds.has(se.targetId)) {
      const conf = se.weight ?? 0.5;
      const score = Math.round(conf * 100);
      if (score > sanctionsRiskScore) sanctionsRiskScore = score;

      linkedSignalIds.push(se.id);
      const meta = (se.metadata as Record<string, unknown>) || {};
      signals.push({
        signalId: se.id,
        signalType: "sanctions_match",
        severity: conf >= 0.8 ? "CRITICAL" : conf >= 0.6 ? "HIGH" : "MEDIUM",
        summary: `Sanctions match: ${meta.listName || "Unknown list"} (${meta.matchType || "unknown"} match, ${(conf * 100).toFixed(0)}% confidence)`,
        sourceTable: "trade_graph_edges",
        externalReasonCode: "SANCTIONS_MATCH_POSSIBLE",
      });
    }
  }

  if (vessel) {
    const vesselPositions = await db
      .select()
      .from(vesselPositionsTable)
      .where(
        and(
          eq(vesselPositionsTable.vesselName, vessel),
          tenantOrGlobalFilter(vesselPositionsTable.companyId, companyId),
        ),
      )
      .orderBy(desc(vesselPositionsTable.positionTimestamp))
      .limit(3);

    for (const vp of vesselPositions) {
      if (vp.navigationStatus === "anchored" || vp.navigationStatus === "moored") {
        vesselRiskScore = Math.max(vesselRiskScore, 40);
        linkedSignalIds.push(vp.id);
        signals.push({
          signalId: vp.id,
          signalType: "vessel_anomaly",
          severity: "MEDIUM",
          summary: `Vessel ${vp.vesselName} is ${vp.navigationStatus} at (${vp.latitude}, ${vp.longitude})`,
          sourceTable: "vessel_positions",
          externalReasonCode: "VESSEL_ANOMALY_DETECTED",
        });
      }
    }
  }

  if (originPort && destinationPort) {
    const marketSignals = await db
      .select()
      .from(laneMarketSignalsTable)
      .where(
        and(
          eq(laneMarketSignalsTable.originPort, originPort),
          eq(laneMarketSignalsTable.destinationPort, destinationPort),
          tenantOrGlobalFilter(laneMarketSignalsTable.companyId, companyId),
        ),
      )
      .orderBy(desc(laneMarketSignalsTable.signalDate))
      .limit(5);

    for (const ms of marketSignals) {
      const mag = ms.magnitude ?? 0;
      const directionMultiplier = ms.direction === "up" ? 1 : ms.direction === "down" ? -0.5 : 0;
      const pressureScore = Math.min(100, Math.round(mag * directionMultiplier * 20));
      if (pressureScore > marketPressureScore) marketPressureScore = pressureScore;

      if (mag >= 3 || ms.signalType === "demand_surge" || ms.signalType === "capacity_shortage") {
        linkedSignalIds.push(ms.id);
        signals.push({
          signalId: ms.id,
          signalType: "market_signal",
          severity: mag >= 5 ? "HIGH" : "MEDIUM",
          summary: `${ms.signalType}: ${ms.direction} (magnitude ${mag}) on ${originPort}→${destinationPort}${ms.currentRate ? ` — rate $${ms.currentRate}` : ""}`,
          sourceTable: "lane_market_signals",
          externalReasonCode: "MARKET_RATE_PRESSURE",
        });
      }
    }
  }

  const compositeIntelScore = Math.round(
    congestionScore * 0.2 +
    disruptionScore * 0.25 +
    weatherRiskScore * 0.2 +
    sanctionsRiskScore * 0.2 +
    vesselRiskScore * 0.05 +
    marketPressureScore * 0.1
  );

  return {
    shipmentId,
    laneId,
    originPort,
    destinationPort,
    congestionScore,
    disruptionScore,
    weatherRiskScore,
    sanctionsRiskScore,
    vesselRiskScore,
    marketPressureScore,
    compositeIntelScore,
    linkedSignalIds,
    signals,
    generatedAt: new Date(),
  };
}

const CONGESTION_LEVEL_SCORES: Record<string, number> = {
  low: 10,
  moderate: 30,
  high: 65,
  critical: 90,
};

const SEVERITY_SCORES: Record<string, number> = {
  low: 15,
  medium: 40,
  high: 70,
  critical: 95,
};
