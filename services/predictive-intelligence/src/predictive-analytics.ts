import { db } from "@workspace/db";
import {
  predictiveAlertsTable,
  preShipmentRiskReportsTable,
  bookingDecisionsTable,
  recommendationsTable,
  releaseGateHoldsTable,
  mitigationPlaybooksTable,
} from "@workspace/db/schema";
import { eq, and, gte, lte, sql, count, avg, desc } from "drizzle-orm";

export interface AlertAccuracyMetrics {
  totalAlerts: number;
  resolvedAlerts: number;
  expiredAlerts: number;
  avgConfidence: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
}

export interface BookingDistributionMetrics {
  totalDecisions: number;
  byStatus: Record<string, number>;
  avgRiskScore: number;
  avgReadinessScore: number;
  avgConfidence: number;
  blockedRate: number;
  approvalRate: number;
}

export interface GateHoldMetrics {
  totalHolds: number;
  activeHolds: number;
  releasedHolds: number;
  overriddenHolds: number;
  byGateType: Record<string, number>;
  bySeverity: Record<string, number>;
}

export interface PlaybookMetrics {
  totalPlaybooks: number;
  completedPlaybooks: number;
  inProgressPlaybooks: number;
  avgCompletionRate: number;
  byPriority: Record<string, number>;
}

export interface PredictivePerformanceSummary {
  alerts: AlertAccuracyMetrics;
  bookings: BookingDistributionMetrics;
  gateHolds: GateHoldMetrics;
  playbooks: PlaybookMetrics;
  period: { start: string; end: string };
}

export async function getPredictivePerformance(
  companyId: string,
  periodDays: number = 30,
): Promise<PredictivePerformanceSummary> {
  const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
  const periodEnd = new Date();

  const [alerts, bookings, gateHolds, playbooks] = await Promise.all([
    computeAlertMetrics(companyId, periodStart),
    computeBookingMetrics(companyId, periodStart),
    computeGateHoldMetrics(companyId, periodStart),
    computePlaybookMetrics(companyId, periodStart),
  ]);

  return {
    alerts,
    bookings,
    gateHolds,
    playbooks,
    period: { start: periodStart.toISOString(), end: periodEnd.toISOString() },
  };
}

async function computeAlertMetrics(
  companyId: string,
  since: Date,
): Promise<AlertAccuracyMetrics> {
  const allAlerts = await db
    .select()
    .from(predictiveAlertsTable)
    .where(
      and(
        eq(predictiveAlertsTable.companyId, companyId),
        gte(predictiveAlertsTable.createdAt, since),
      ),
    );

  const bySeverity: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let totalConfidence = 0;
  let resolvedCount = 0;
  let expiredCount = 0;

  for (const alert of allAlerts) {
    bySeverity[alert.severity] = (bySeverity[alert.severity] ?? 0) + 1;
    byType[alert.alertType] = (byType[alert.alertType] ?? 0) + 1;
    totalConfidence += alert.confidenceScore;
    if (alert.status === "RESOLVED") resolvedCount++;
    if (alert.status === "EXPIRED") expiredCount++;
  }

  return {
    totalAlerts: allAlerts.length,
    resolvedAlerts: resolvedCount,
    expiredAlerts: expiredCount,
    avgConfidence: allAlerts.length > 0 ? totalConfidence / allAlerts.length : 0,
    bySeverity,
    byType,
  };
}

async function computeBookingMetrics(
  companyId: string,
  since: Date,
): Promise<BookingDistributionMetrics> {
  const decisions = await db
    .select()
    .from(bookingDecisionsTable)
    .where(
      and(
        eq(bookingDecisionsTable.companyId, companyId),
        gte(bookingDecisionsTable.createdAt, since),
      ),
    );

  const byStatus: Record<string, number> = {};
  let totalRisk = 0;
  let totalReadiness = 0;
  let totalConfidence = 0;
  let blockedCount = 0;
  let approvedCount = 0;

  for (const d of decisions) {
    byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
    totalRisk += d.overallRiskScore;
    totalReadiness += d.readinessScore;
    totalConfidence += d.confidence;
    if (d.status === "BLOCKED") blockedCount++;
    if (d.status === "APPROVED" || d.status === "APPROVED_WITH_CAUTION") approvedCount++;
  }

  const total = decisions.length || 1;

  return {
    totalDecisions: decisions.length,
    byStatus,
    avgRiskScore: totalRisk / total,
    avgReadinessScore: totalReadiness / total,
    avgConfidence: totalConfidence / total,
    blockedRate: blockedCount / total,
    approvalRate: approvedCount / total,
  };
}

async function computeGateHoldMetrics(
  companyId: string,
  since: Date,
): Promise<GateHoldMetrics> {
  const holds = await db
    .select()
    .from(releaseGateHoldsTable)
    .where(
      and(
        eq(releaseGateHoldsTable.companyId, companyId),
        gte(releaseGateHoldsTable.createdAt, since),
      ),
    );

  const byGateType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  let activeCount = 0;
  let releasedCount = 0;
  let overriddenCount = 0;

  for (const h of holds) {
    byGateType[h.gateType] = (byGateType[h.gateType] ?? 0) + 1;
    bySeverity[h.severity] = (bySeverity[h.severity] ?? 0) + 1;
    if (h.status === "ACTIVE") activeCount++;
    if (h.status === "RELEASED") releasedCount++;
    if (h.status === "OVERRIDDEN") overriddenCount++;
  }

  return {
    totalHolds: holds.length,
    activeHolds: activeCount,
    releasedHolds: releasedCount,
    overriddenHolds: overriddenCount,
    byGateType,
    bySeverity,
  };
}

async function computePlaybookMetrics(
  companyId: string,
  since: Date,
): Promise<PlaybookMetrics> {
  const playbooks = await db
    .select()
    .from(mitigationPlaybooksTable)
    .where(
      and(
        eq(mitigationPlaybooksTable.companyId, companyId),
        gte(mitigationPlaybooksTable.createdAt, since),
      ),
    );

  const byPriority: Record<string, number> = {};
  let completedCount = 0;
  let inProgressCount = 0;
  let totalCompletionRate = 0;

  for (const p of playbooks) {
    byPriority[p.priority] = (byPriority[p.priority] ?? 0) + 1;
    if (p.status === "COMPLETED") completedCount++;
    if (p.status === "IN_PROGRESS") inProgressCount++;
    totalCompletionRate += p.totalSteps > 0 ? p.completedSteps / p.totalSteps : 0;
  }

  return {
    totalPlaybooks: playbooks.length,
    completedPlaybooks: completedCount,
    inProgressPlaybooks: inProgressCount,
    avgCompletionRate: playbooks.length > 0 ? totalCompletionRate / playbooks.length : 0,
    byPriority,
  };
}
