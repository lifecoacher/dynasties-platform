import { db } from "@workspace/db";
import {
  portCongestionSnapshotsTable,
  disruptionEventsTable,
  weatherRiskEventsTable,
  predictiveAlertsTable,
  laneScoresTable,
  portScoresTable,
  carrierScoresTable,
  shipmentsTable,
} from "@workspace/db/schema";
import { eq, and, or, sql, desc, gte, inArray } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";

export type AlertType =
  | "CONGESTION_TREND"
  | "DISRUPTION_CLUSTER"
  | "WEATHER_FORECAST"
  | "CARRIER_DEGRADATION"
  | "LANE_STRESS_RISING"
  | "PORT_RISK_ESCALATION";

export interface PredictiveAlertResult {
  id: string;
  alertType: AlertType;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  description: string;
  affectedPorts?: string[];
  affectedLanes?: string[];
  confidenceScore: number;
  predictedImpactDays?: number;
  trendData?: Record<string, unknown>;
}

function tenantOrGlobal(col: any, companyId: string) {
  return or(eq(col, companyId), sql`${col} IS NULL`);
}

export async function runPredictiveAnalysis(companyId: string): Promise<PredictiveAlertResult[]> {
  const alerts: PredictiveAlertResult[] = [];

  const [congestionAlerts, disruptionAlerts, weatherAlerts, laneAlerts, portAlerts, carrierAlerts] = await Promise.all([
    detectCongestionTrends(companyId),
    detectDisruptionClusters(companyId),
    detectWeatherForecasts(companyId),
    detectLaneStressRising(companyId),
    detectPortRiskEscalation(companyId),
    detectCarrierDegradation(companyId),
  ]);

  alerts.push(...congestionAlerts, ...disruptionAlerts, ...weatherAlerts, ...laneAlerts, ...portAlerts, ...carrierAlerts);

  const affectedShipmentIds = await findAffectedShipments(companyId, alerts);

  for (const alert of alerts) {
    const id = generateId("pal");
    alert.id = id;

    await db.insert(predictiveAlertsTable).values({
      id,
      companyId,
      alertType: alert.alertType,
      severity: alert.severity,
      title: alert.title,
      description: alert.description,
      affectedPorts: alert.affectedPorts ?? [],
      affectedLanes: alert.affectedLanes ?? [],
      affectedShipmentIds: affectedShipmentIds,
      trendData: alert.trendData,
      confidenceScore: alert.confidenceScore,
      predictedImpactDays: alert.predictedImpactDays,
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
    });
  }

  return alerts;
}

async function detectCongestionTrends(companyId: string): Promise<PredictiveAlertResult[]> {
  const alerts: PredictiveAlertResult[] = [];
  const lookback = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const snapshots = await db
    .select()
    .from(portCongestionSnapshotsTable)
    .where(
      and(
        tenantOrGlobal(portCongestionSnapshotsTable.companyId, companyId),
        gte(portCongestionSnapshotsTable.snapshotTimestamp, lookback),
      ),
    )
    .orderBy(desc(portCongestionSnapshotsTable.snapshotTimestamp))
    .limit(200);

  const byPort: Record<string, any[]> = {};
  for (const snap of snapshots) {
    const port = snap.portCode;
    if (!byPort[port]) byPort[port] = [];
    byPort[port].push(snap);
  }

  const LEVEL_MAP: Record<string, number> = { low: 1, moderate: 2, high: 3, severe: 4, critical: 5 };

  for (const [portCode, portSnaps] of Object.entries(byPort)) {
    if (portSnaps.length < 2) continue;

    const sorted = portSnaps.sort(
      (a: any, b: any) => new Date(a.snapshotTimestamp).getTime() - new Date(b.snapshotTimestamp).getTime(),
    );

    const levels = sorted.map((s: any) => LEVEL_MAP[s.congestionLevel] ?? 2);
    const recent = levels.slice(-3);
    const earlier = levels.slice(0, Math.max(1, levels.length - 3));

    const recentAvg = recent.reduce((a: number, b: number) => a + b, 0) / recent.length;
    const earlierAvg = earlier.reduce((a: number, b: number) => a + b, 0) / earlier.length;

    if (recentAvg > earlierAvg + 0.8 && recentAvg >= 3) {
      const severity = recentAvg >= 4 ? "CRITICAL" : recentAvg >= 3 ? "WARNING" : "INFO";
      const confidence = Math.min(0.5 + (recentAvg - earlierAvg) * 0.15, 0.95);

      alerts.push({
        id: "",
        alertType: "CONGESTION_TREND",
        severity: severity as any,
        title: `Congestion rising at ${portCode}`,
        description: `Port ${portCode} congestion trend is increasing — recent average level ${recentAvg.toFixed(1)} vs prior ${earlierAvg.toFixed(1)} over ${sorted.length} snapshots.`,
        affectedPorts: [portCode],
        confidenceScore: confidence,
        predictedImpactDays: recentAvg >= 4 ? 5 : 2,
        trendData: { recentAvg, earlierAvg, snapshotCount: sorted.length },
      });
    }
  }

  return alerts;
}

async function detectDisruptionClusters(companyId: string): Promise<PredictiveAlertResult[]> {
  const alerts: PredictiveAlertResult[] = [];
  const lookback = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const disruptions = await db
    .select()
    .from(disruptionEventsTable)
    .where(
      and(
        tenantOrGlobal(disruptionEventsTable.companyId, companyId),
        gte(disruptionEventsTable.startDate, lookback),
      ),
    )
    .limit(200);

  const byRegion: Record<string, any[]> = {};
  for (const d of disruptions) {
    const region = d.affectedRegion ?? "unknown";
    if (!byRegion[region]) byRegion[region] = [];
    byRegion[region].push(d);
  }

  for (const [region, events] of Object.entries(byRegion)) {
    if (events.length >= 3) {
      const SEVERITY_MAP: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
      const avgSeverity = events.reduce((s: number, e: any) => s + (SEVERITY_MAP[e.severity] ?? 2), 0) / events.length;

      const severity = avgSeverity >= 3 ? "CRITICAL" : avgSeverity >= 2 ? "WARNING" : "INFO";
      const confidence = Math.min(0.5 + events.length * 0.05, 0.9);

      alerts.push({
        id: "",
        alertType: "DISRUPTION_CLUSTER",
        severity: severity as any,
        title: `Disruption cluster in ${region}`,
        description: `${events.length} disruption events detected in ${region} within 30 days. Average severity: ${avgSeverity.toFixed(1)}/4.`,
        confidenceScore: confidence,
        predictedImpactDays: avgSeverity >= 3 ? 7 : 3,
        trendData: { eventCount: events.length, avgSeverity, region },
      });
    }
  }

  return alerts;
}

async function detectWeatherForecasts(companyId: string): Promise<PredictiveAlertResult[]> {
  const alerts: PredictiveAlertResult[] = [];
  const futureWindow = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const weatherEvents = await db
    .select()
    .from(weatherRiskEventsTable)
    .where(
      and(
        tenantOrGlobal(weatherRiskEventsTable.companyId, companyId),
        inArray(weatherRiskEventsTable.status, ["forecast", "active"]),
      ),
    )
    .limit(50);

  const SEVERITY_MAP: Record<string, number> = { low: 1, medium: 2, high: 3, extreme: 4 };

  for (const w of weatherEvents) {
    const sev = SEVERITY_MAP[w.severity] ?? 2;
    if (sev >= 3) {
      const ports: string[] = [];
      if (w.affectedPorts && Array.isArray(w.affectedPorts)) {
        ports.push(...(w.affectedPorts as string[]));
      }

      const severity = sev >= 4 ? "CRITICAL" : "WARNING";
      alerts.push({
        id: "",
        alertType: "WEATHER_FORECAST",
        severity: severity as any,
        title: `${w.eventType} weather risk: ${w.eventName ?? "active event"}`,
        description: `${w.eventType} event with ${w.severity} severity. ${w.description ?? ""}`.trim(),
        affectedPorts: ports,
        confidenceScore: Math.min(0.6 + sev * 0.1, 0.95),
        predictedImpactDays: sev >= 4 ? 7 : 3,
        trendData: { eventType: w.eventType, severity: w.severity },
      });
    }
  }

  return alerts;
}

async function detectLaneStressRising(companyId: string): Promise<PredictiveAlertResult[]> {
  const alerts: PredictiveAlertResult[] = [];

  const lanes = await db
    .select()
    .from(laneScoresTable)
    .where(tenantOrGlobal(laneScoresTable.companyId, companyId))
    .orderBy(desc(laneScoresTable.compositeStressScore))
    .limit(50);

  for (const lane of lanes) {
    if (lane.compositeStressScore >= 0.65) {
      const severity = lane.compositeStressScore >= 0.85 ? "CRITICAL" : "WARNING";
      const laneKey = `${lane.originPort}-${lane.destinationPort}`;

      alerts.push({
        id: "",
        alertType: "LANE_STRESS_RISING",
        severity: severity as any,
        title: `High lane stress: ${laneKey}`,
        description: `Trade lane ${laneKey} has composite stress score of ${(lane.compositeStressScore * 100).toFixed(0)}%. Congestion: ${(lane.congestionScore * 100).toFixed(0)}%, Disruption: ${(lane.disruptionScore * 100).toFixed(0)}%.`,
        affectedLanes: [laneKey],
        affectedPorts: [lane.originPort, lane.destinationPort],
        confidenceScore: Math.min(lane.compositeStressScore + 0.1, 0.95),
        predictedImpactDays: lane.compositeStressScore >= 0.85 ? 5 : 2,
        trendData: {
          congestionScore: lane.congestionScore,
          disruptionScore: lane.disruptionScore,
          delayStressScore: lane.delayStressScore,
          marketPressureScore: lane.marketPressureScore,
        },
      });
    }
  }

  return alerts;
}

async function detectPortRiskEscalation(companyId: string): Promise<PredictiveAlertResult[]> {
  const alerts: PredictiveAlertResult[] = [];

  const ports = await db
    .select()
    .from(portScoresTable)
    .where(tenantOrGlobal(portScoresTable.companyId, companyId))
    .orderBy(desc(portScoresTable.compositeScore))
    .limit(50);

  for (const port of ports) {
    if (port.compositeScore >= 0.6) {
      const severity = port.compositeScore >= 0.8 ? "CRITICAL" : "WARNING";

      alerts.push({
        id: "",
        alertType: "PORT_RISK_ESCALATION",
        severity: severity as any,
        title: `Port risk elevated: ${port.portCode}`,
        description: `Port ${port.portCode} composite score ${(port.compositeScore * 100).toFixed(0)}%. Congestion: ${(port.congestionSeverity * 100).toFixed(0)}%, Weather: ${(port.weatherExposure * 100).toFixed(0)}%, Disruption: ${(port.disruptionExposure * 100).toFixed(0)}%.`,
        affectedPorts: [port.portCode],
        confidenceScore: Math.min(port.compositeScore + 0.1, 0.95),
        trendData: {
          congestionSeverity: port.congestionSeverity,
          weatherExposure: port.weatherExposure,
          disruptionExposure: port.disruptionExposure,
        },
      });
    }
  }

  return alerts;
}

async function detectCarrierDegradation(companyId: string): Promise<PredictiveAlertResult[]> {
  const alerts: PredictiveAlertResult[] = [];

  const carriers = await db
    .select()
    .from(carrierScoresTable)
    .where(tenantOrGlobal(carrierScoresTable.companyId, companyId))
    .limit(50);

  for (const c of carriers) {
    if (c.reliabilityScore < 0.4 || c.anomalyScore > 0.6) {
      const severity = c.reliabilityScore < 0.2 || c.anomalyScore > 0.8 ? "CRITICAL" : "WARNING";

      alerts.push({
        id: "",
        alertType: "CARRIER_DEGRADATION",
        severity: severity as any,
        title: `Carrier reliability concern: ${c.carrierName}`,
        description: `Carrier ${c.carrierName} shows reliability score ${(c.reliabilityScore * 100).toFixed(0)}%, anomaly score ${(c.anomalyScore * 100).toFixed(0)}%.`,
        confidenceScore: Math.min(0.5 + c.anomalyScore * 0.3, 0.9),
        trendData: {
          reliabilityScore: c.reliabilityScore,
          anomalyScore: c.anomalyScore,
          performanceScore: c.performanceScore,
        },
      });
    }
  }

  return alerts;
}

async function findAffectedShipments(companyId: string, alerts: PredictiveAlertResult[]): Promise<string[]> {
  const allPorts = new Set<string>();
  for (const a of alerts) {
    if (a.affectedPorts) a.affectedPorts.forEach((p) => allPorts.add(p));
  }

  if (allPorts.size === 0) return [];

  const portArr = Array.from(allPorts);
  const shipments = await db
    .select({ id: shipmentsTable.id })
    .from(shipmentsTable)
    .where(
      and(
        eq(shipmentsTable.companyId, companyId),
        inArray(shipmentsTable.status, ["DRAFT", "PENDING_REVIEW", "APPROVED"]),
        or(
          inArray(shipmentsTable.portOfLoading, portArr),
          inArray(shipmentsTable.portOfDischarge, portArr),
        ),
      ),
    )
    .limit(100);

  return shipments.map((s) => s.id);
}

export async function getActiveAlerts(companyId: string) {
  return db
    .select()
    .from(predictiveAlertsTable)
    .where(
      and(
        eq(predictiveAlertsTable.companyId, companyId),
        eq(predictiveAlertsTable.status, "ACTIVE"),
      ),
    )
    .orderBy(desc(predictiveAlertsTable.createdAt))
    .limit(50);
}

export async function acknowledgeAlert(id: string, companyId: string) {
  return db
    .update(predictiveAlertsTable)
    .set({ status: "ACKNOWLEDGED", updatedAt: new Date() })
    .where(and(eq(predictiveAlertsTable.id, id), eq(predictiveAlertsTable.companyId, companyId)));
}
