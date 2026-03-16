import { db } from "@workspace/db";
import {
  shipmentsTable,
  laneScoresTable,
  portScoresTable,
  carrierScoresTable,
  entityScoresTable,
  disruptionEventsTable,
  weatherRiskEventsTable,
  portCongestionSnapshotsTable,
  preShipmentRiskReportsTable,
  entitiesTable,
} from "@workspace/db/schema";
import { eq, and, or, sql, desc, inArray } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";

export interface PreShipmentRiskInput {
  shipmentId: string;
  companyId: string;
  portOfLoading?: string | null;
  portOfDischarge?: string | null;
  carrierId?: string | null;
  shipperId?: string | null;
  consigneeId?: string | null;
  etd?: Date | null;
}

export interface RiskComponent {
  score: number;
  level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  factors: string[];
}

export interface PreShipmentRiskResult {
  reportId: string;
  shipmentId: string;
  overallRiskScore: number;
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  components: {
    laneStress: RiskComponent;
    portCongestion: RiskComponent;
    disruptionRisk: RiskComponent;
    weatherExposure: RiskComponent;
    carrierReliability: RiskComponent;
    entityCompliance: RiskComponent;
  };
  mitigations: string[];
  daysUntilDeparture: number | null;
}

function tenantOrGlobal(col: any, companyId: string) {
  return or(eq(col, companyId), sql`${col} IS NULL`);
}

function scoreToLevel(score: number): "LOW" | "MODERATE" | "HIGH" | "CRITICAL" {
  if (score >= 0.75) return "CRITICAL";
  if (score >= 0.5) return "HIGH";
  if (score >= 0.25) return "MODERATE";
  return "LOW";
}

export async function evaluatePreShipmentRisk(
  input: PreShipmentRiskInput,
): Promise<PreShipmentRiskResult> {
  const ports = [input.portOfLoading, input.portOfDischarge].filter(Boolean) as string[];

  const [laneScore, portScores, carrierScore, entityScores, activeDisruptions, activeWeather, congestionSnaps] =
    await Promise.all([
      getLaneScore(input.companyId, input.portOfLoading, input.portOfDischarge),
      ports.length > 0 ? getPortScores(input.companyId, ports) : [],
      input.carrierId ? getCarrierScore(input.companyId, input.carrierId) : null,
      getEntityScores(input.companyId, [input.shipperId, input.consigneeId].filter(Boolean) as string[]),
      getActiveDisruptions(input.companyId, ports),
      getActiveWeather(input.companyId, ports),
      getCongestion(input.companyId, ports),
    ]);

  const laneStressScore = laneScore?.compositeStressScore ?? 0;
  const portCongestionScore = computePortCongestion(portScores, congestionSnaps);
  const disruptionRiskScore = computeDisruptionRisk(activeDisruptions);
  const weatherExposureScore = computeWeatherExposure(activeWeather, input.etd);
  const carrierReliabilityScore = carrierScore ? 1 - (carrierScore.reliabilityScore ?? 0) : 0;
  const entityComplianceScore = computeEntityCompliance(entityScores);

  const overallRiskScore =
    laneStressScore * 0.2 +
    portCongestionScore * 0.2 +
    disruptionRiskScore * 0.2 +
    weatherExposureScore * 0.15 +
    carrierReliabilityScore * 0.15 +
    entityComplianceScore * 0.1;

  const riskLevel = scoreToLevel(overallRiskScore);

  const laneFactors: string[] = [];
  if (laneStressScore > 0.5) laneFactors.push(`Lane stress elevated (${(laneStressScore * 100).toFixed(0)}%)`);
  if (laneScore?.congestionScore && laneScore.congestionScore > 0.5) laneFactors.push("Lane congestion detected");
  if (laneScore?.disruptionScore && laneScore.disruptionScore > 0.5) laneFactors.push("Lane disruption signals active");

  const portFactors: string[] = [];
  if (portCongestionScore > 0.5) portFactors.push(`Port congestion elevated (${(portCongestionScore * 100).toFixed(0)}%)`);
  for (const ps of portScores) {
    if (ps.congestionSeverity > 0.6) portFactors.push(`${ps.portCode}: high congestion`);
  }

  const disruptionFactors: string[] = [];
  for (const d of activeDisruptions) {
    disruptionFactors.push(`${d.eventType}: ${d.description?.slice(0, 80) ?? "active event"}`);
  }

  const weatherFactors: string[] = [];
  for (const w of activeWeather) {
    weatherFactors.push(`${w.eventType}: severity ${w.severity}`);
  }

  const carrierFactors: string[] = [];
  if (carrierReliabilityScore > 0.3) carrierFactors.push(`Carrier reliability concerns (risk ${(carrierReliabilityScore * 100).toFixed(0)}%)`);
  if (carrierScore?.anomalyScore && carrierScore.anomalyScore > 0.5) carrierFactors.push("Carrier anomaly detected");

  const entityFactors: string[] = [];
  for (const es of entityScores) {
    if (es.compositeScore > 0.3) entityFactors.push(`${es.entityName}: compliance risk (${(es.compositeScore * 100).toFixed(0)}%)`);
  }

  const mitigations = generateMitigations(
    laneStressScore,
    portCongestionScore,
    disruptionRiskScore,
    weatherExposureScore,
    carrierReliabilityScore,
    entityComplianceScore,
  );

  const daysUntilDeparture = input.etd
    ? Math.max(0, Math.round((input.etd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const reportId = generateId("psr");

  await db.insert(preShipmentRiskReportsTable).values({
    id: reportId,
    companyId: input.companyId,
    shipmentId: input.shipmentId,
    overallRiskScore,
    laneStressScore,
    portCongestionScore,
    disruptionRiskScore,
    weatherExposureScore,
    carrierReliabilityScore,
    entityComplianceScore,
    riskLevel,
    mitigations,
    componentDetails: {
      laneFactors,
      portFactors,
      disruptionFactors,
      weatherFactors,
      carrierFactors,
      entityFactors,
    },
    shipmentEtd: input.etd ?? undefined,
    daysUntilDeparture,
  });

  return {
    reportId,
    shipmentId: input.shipmentId,
    overallRiskScore,
    riskLevel,
    components: {
      laneStress: { score: laneStressScore, level: scoreToLevel(laneStressScore), factors: laneFactors },
      portCongestion: { score: portCongestionScore, level: scoreToLevel(portCongestionScore), factors: portFactors },
      disruptionRisk: { score: disruptionRiskScore, level: scoreToLevel(disruptionRiskScore), factors: disruptionFactors },
      weatherExposure: { score: weatherExposureScore, level: scoreToLevel(weatherExposureScore), factors: weatherFactors },
      carrierReliability: { score: carrierReliabilityScore, level: scoreToLevel(carrierReliabilityScore), factors: carrierFactors },
      entityCompliance: { score: entityComplianceScore, level: scoreToLevel(entityComplianceScore), factors: entityFactors },
    },
    mitigations,
    daysUntilDeparture,
  };
}

async function getLaneScore(companyId: string, origin?: string | null, dest?: string | null) {
  if (!origin || !dest) return null;
  const [row] = await db
    .select()
    .from(laneScoresTable)
    .where(
      and(
        eq(laneScoresTable.originPort, origin),
        eq(laneScoresTable.destinationPort, dest),
        tenantOrGlobal(laneScoresTable.companyId, companyId),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function getPortScores(companyId: string, ports: string[]) {
  return db
    .select()
    .from(portScoresTable)
    .where(and(inArray(portScoresTable.portCode, ports), tenantOrGlobal(portScoresTable.companyId, companyId)));
}

async function getCarrierScore(companyId: string, carrierId: string) {
  const [carrier] = await db
    .select()
    .from(entitiesTable)
    .where(eq(entitiesTable.id, carrierId))
    .limit(1);
  if (!carrier) return null;

  const [row] = await db
    .select()
    .from(carrierScoresTable)
    .where(
      and(
        eq(carrierScoresTable.carrierName, carrier.name),
        tenantOrGlobal(carrierScoresTable.companyId, companyId),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function getEntityScores(companyId: string, entityIds: string[]) {
  if (entityIds.length === 0) return [];
  return db
    .select()
    .from(entityScoresTable)
    .where(
      and(
        inArray(entityScoresTable.entityId, entityIds),
        tenantOrGlobal(entityScoresTable.companyId, companyId),
      ),
    );
}

async function getActiveDisruptions(companyId: string, ports: string[]) {
  if (ports.length === 0) return [];
  return db
    .select()
    .from(disruptionEventsTable)
    .where(
      and(
        inArray(disruptionEventsTable.status, ["active"]),
        tenantOrGlobal(disruptionEventsTable.companyId, companyId),
      ),
    )
    .limit(20);
}

async function getActiveWeather(companyId: string, ports: string[]) {
  if (ports.length === 0) return [];
  return db
    .select()
    .from(weatherRiskEventsTable)
    .where(
      and(
        inArray(weatherRiskEventsTable.status, ["forecast", "active"]),
        tenantOrGlobal(weatherRiskEventsTable.companyId, companyId),
      ),
    )
    .limit(20);
}

async function getCongestion(companyId: string, ports: string[]) {
  if (ports.length === 0) return [];
  return db
    .select()
    .from(portCongestionSnapshotsTable)
    .where(
      and(
        inArray(portCongestionSnapshotsTable.portCode, ports),
        tenantOrGlobal(portCongestionSnapshotsTable.companyId, companyId),
      ),
    )
    .orderBy(desc(portCongestionSnapshotsTable.snapshotTimestamp))
    .limit(10);
}

function computePortCongestion(portScores: any[], congestionSnaps: any[]): number {
  let score = 0;
  for (const ps of portScores) {
    score = Math.max(score, ps.congestionSeverity ?? 0);
  }
  const CONGESTION_MAP: Record<string, number> = { low: 0.2, moderate: 0.4, high: 0.7, severe: 0.9, critical: 1.0 };
  for (const snap of congestionSnaps) {
    const lvl = CONGESTION_MAP[snap.congestionLevel] ?? 0;
    score = Math.max(score, lvl);
  }
  return Math.min(score, 1);
}

function computeDisruptionRisk(disruptions: any[]): number {
  if (disruptions.length === 0) return 0;
  const SEVERITY_MAP: Record<string, number> = { low: 0.2, medium: 0.4, high: 0.7, critical: 1.0 };
  let maxSeverity = 0;
  for (const d of disruptions) {
    const sev = SEVERITY_MAP[d.severity] ?? 0.3;
    maxSeverity = Math.max(maxSeverity, sev);
  }
  const countFactor = Math.min(disruptions.length * 0.1, 0.3);
  return Math.min(maxSeverity + countFactor, 1);
}

function computeWeatherExposure(weather: any[], etd?: Date | null): number {
  if (weather.length === 0) return 0;
  const SEVERITY_MAP: Record<string, number> = { low: 0.15, medium: 0.35, high: 0.6, extreme: 0.9 };
  let maxScore = 0;
  for (const w of weather) {
    let sev = SEVERITY_MAP[w.severity] ?? 0.3;
    if (etd && w.forecastWindowStart && w.forecastWindowEnd) {
      const start = new Date(w.forecastWindowStart);
      const end = new Date(w.forecastWindowEnd);
      if (etd >= start && etd <= end) {
        sev = Math.min(sev * 1.3, 1);
      }
    }
    maxScore = Math.max(maxScore, sev);
  }
  return Math.min(maxScore, 1);
}

function computeEntityCompliance(entityScores: any[]): number {
  if (entityScores.length === 0) return 0;
  let max = 0;
  for (const e of entityScores) {
    max = Math.max(max, e.compositeScore ?? 0);
  }
  return Math.min(max, 1);
}

function generateMitigations(
  lane: number,
  port: number,
  disruption: number,
  weather: number,
  carrier: number,
  entity: number,
): string[] {
  const mitigations: string[] = [];
  if (lane > 0.5) mitigations.push("Consider alternative trade lane to reduce route stress");
  if (port > 0.6) mitigations.push("Monitor port congestion and consider schedule flexibility");
  if (disruption > 0.5) mitigations.push("Activate contingency routing due to active disruptions");
  if (weather > 0.5) mitigations.push("Delay departure or adjust schedule for weather window");
  if (carrier > 0.4) mitigations.push("Evaluate alternative carrier options for improved reliability");
  if (entity > 0.3) mitigations.push("Escalate compliance review before departure");
  if (lane > 0.7 && disruption > 0.5) mitigations.push("Strongly recommend rerouting — combined lane stress and disruption risk");
  if (weather > 0.7) mitigations.push("Review insurance coverage for weather-related delays");
  return mitigations;
}

export async function getLatestRiskReport(shipmentId: string, companyId: string) {
  const [report] = await db
    .select()
    .from(preShipmentRiskReportsTable)
    .where(
      and(
        eq(preShipmentRiskReportsTable.shipmentId, shipmentId),
        eq(preShipmentRiskReportsTable.companyId, companyId),
      ),
    )
    .orderBy(desc(preShipmentRiskReportsTable.evaluatedAt))
    .limit(1);
  return report ?? null;
}

export async function getRiskReportHistory(shipmentId: string, companyId: string) {
  return db
    .select()
    .from(preShipmentRiskReportsTable)
    .where(
      and(
        eq(preShipmentRiskReportsTable.shipmentId, shipmentId),
        eq(preShipmentRiskReportsTable.companyId, companyId),
      ),
    )
    .orderBy(desc(preShipmentRiskReportsTable.evaluatedAt))
    .limit(20);
}
