import { db } from "@workspace/db";
import {
  interventionAttributionsTable,
  recommendationsTable,
  workflowTasksTable,
  bookingDecisionsTable,
  releaseGateHoldsTable,
  mitigationPlaybooksTable,
  predictiveAlertsTable,
  shipmentsTable,
} from "@workspace/db/schema";
import { generateId } from "@workspace/shared-utils";
import { eq, and, desc, sql, gte, ne } from "drizzle-orm";

interface AttributionDetail {
  category: string;
  metric: string;
  value: number;
  methodology: string;
}

export interface InterventionAttribution {
  id: string;
  period: "DAILY" | "WEEKLY" | "MONTHLY";
  delaysAvoided: number;
  estimatedDaysSaved: number;
  marginProtected: number;
  risksMitigated: number;
  interventionsTriggered: number;
  interventionsCompleted: number;
  tasksAutoCreated: number;
  bookingHoldsPreventedIssues: number;
  recommendationsAccepted: number;
  recommendationsTotal: number;
  intelligenceEnrichedImpact: number;
  internalOnlyImpact: number;
  attributionDetails: AttributionDetail[];
}

export async function computeAttribution(
  companyId: string,
  period: "DAILY" | "WEEKLY" | "MONTHLY" = "WEEKLY",
): Promise<InterventionAttribution> {
  const periodDays = period === "DAILY" ? 1 : period === "WEEKLY" ? 7 : 30;
  const since = new Date(Date.now() - periodDays * 86400000);

  const [recs, tasks, bookingDecs, holds, playbooks, alerts] = await Promise.all([
    db.select().from(recommendationsTable)
      .where(and(eq(recommendationsTable.companyId, companyId), gte(recommendationsTable.createdAt, since))),
    db.select().from(workflowTasksTable)
      .where(and(eq(workflowTasksTable.companyId, companyId), gte(workflowTasksTable.createdAt, since))),
    db.select().from(bookingDecisionsTable)
      .where(and(eq(bookingDecisionsTable.companyId, companyId), gte(bookingDecisionsTable.createdAt, since))),
    db.select().from(releaseGateHoldsTable)
      .where(and(eq(releaseGateHoldsTable.companyId, companyId), gte(releaseGateHoldsTable.createdAt, since))),
    db.select().from(mitigationPlaybooksTable)
      .where(and(eq(mitigationPlaybooksTable.companyId, companyId), gte(mitigationPlaybooksTable.createdAt, since))),
    db.select().from(predictiveAlertsTable)
      .where(and(eq(predictiveAlertsTable.companyId, companyId), gte(predictiveAlertsTable.createdAt, since))),
  ]);

  const acceptedRecs = recs.filter((r) => r.status === "ACCEPTED" || r.status === "IMPLEMENTED");
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED");
  const autoTasks = tasks.filter((t) => t.creationSource === "AUTO_POLICY" || t.creationSource === "RECOMMENDATION");

  const blockedBookings = bookingDecs.filter((b) =>
    b.status === "BLOCKED" || b.status === "REQUIRES_REVIEW",
  );
  const cautionBookings = bookingDecs.filter((b) => b.status === "APPROVED_WITH_CAUTION");

  const resolvedHolds = holds.filter((h) => h.status === "RELEASED" || h.status === "OVERRIDDEN");

  const completedPlaybooks = playbooks.filter((p) => p.status === "COMPLETED");

  const resolvedAlerts = alerts.filter((a) => a.status === "RESOLVED" || a.status === "ACKNOWLEDGED");

  const AVG_DELAY_SAVED_PER_INTERVENTION = 1.5;
  const AVG_MARGIN_PROTECTED_PER_HOLD = 2500;
  const AVG_MARGIN_PROTECTED_PER_REC = 1200;

  const delaysAvoided = blockedBookings.length + resolvedHolds.length + completedPlaybooks.length;
  const estimatedDaysSaved = delaysAvoided * AVG_DELAY_SAVED_PER_INTERVENTION;

  const marginProtected =
    blockedBookings.length * AVG_MARGIN_PROTECTED_PER_HOLD +
    acceptedRecs.length * AVG_MARGIN_PROTECTED_PER_REC;

  const risksMitigated = resolvedAlerts.length + cautionBookings.length;

  const interventionsTriggered = recs.length + holds.length + playbooks.length;
  const interventionsCompleted = acceptedRecs.length + resolvedHolds.length + completedPlaybooks.length;

  const enrichedRecs = recs.filter((r) => {
    const meta = r.metadata as any;
    return meta?.externalReasonCodes?.length > 0 || meta?.enriched === true;
  });
  const internalRecs = recs.filter((r) => {
    const meta = r.metadata as any;
    return !meta?.externalReasonCodes?.length && !meta?.enriched;
  });

  const enrichedAccepted = enrichedRecs.filter((r) => r.status === "ACCEPTED" || r.status === "IMPLEMENTED").length;
  const internalAccepted = internalRecs.filter((r) => r.status === "ACCEPTED" || r.status === "IMPLEMENTED").length;

  const enrichedImpact = enrichedRecs.length > 0 ? enrichedAccepted / enrichedRecs.length : 0;
  const internalImpact = internalRecs.length > 0 ? internalAccepted / internalRecs.length : 0;

  const attributionDetails: AttributionDetail[] = [
    { category: "Delays", metric: "Booking blocks preventing delays", value: blockedBookings.length, methodology: "Count of BLOCKED/REQUIRES_REVIEW booking decisions in period" },
    { category: "Delays", metric: "Gate holds preventing issues", value: resolvedHolds.length, methodology: "Count of released/overridden gate holds in period" },
    { category: "Delays", metric: "Avg days saved per intervention", value: AVG_DELAY_SAVED_PER_INTERVENTION, methodology: "Fixed estimate: 1.5 days avg based on industry delay analysis" },
    { category: "Margin", metric: "Per-hold margin protection", value: AVG_MARGIN_PROTECTED_PER_HOLD, methodology: "Fixed estimate: $2,500 avg cargo value at risk per hold" },
    { category: "Margin", metric: "Per-recommendation margin protection", value: AVG_MARGIN_PROTECTED_PER_REC, methodology: "Fixed estimate: $1,200 avg value per accepted recommendation" },
    { category: "Automation", metric: "Auto-created tasks", value: autoTasks.length, methodology: "Count of tasks with creation_source AUTO_POLICY or RECOMMENDATION" },
    { category: "Intelligence", metric: "Enriched rec acceptance rate", value: enrichedImpact, methodology: "Accepted enriched recs / total enriched recs" },
    { category: "Intelligence", metric: "Internal-only rec acceptance rate", value: internalImpact, methodology: "Accepted internal recs / total internal recs" },
    { category: "Playbooks", metric: "Completed playbooks", value: completedPlaybooks.length, methodology: "Count of playbooks with COMPLETED status in period" },
    { category: "Alerts", metric: "Resolved predictive alerts", value: resolvedAlerts.length, methodology: "Count of resolved/acknowledged predictive alerts in period" },
  ];

  const id = generateId("att");
  const result: InterventionAttribution = {
    id,
    period,
    delaysAvoided,
    estimatedDaysSaved,
    marginProtected,
    risksMitigated,
    interventionsTriggered,
    interventionsCompleted,
    tasksAutoCreated: autoTasks.length,
    bookingHoldsPreventedIssues: blockedBookings.length,
    recommendationsAccepted: acceptedRecs.length,
    recommendationsTotal: recs.length,
    intelligenceEnrichedImpact: enrichedImpact,
    internalOnlyImpact: internalImpact,
    attributionDetails,
  };

  await db.insert(interventionAttributionsTable).values({
    id,
    companyId,
    period,
    delaysAvoided: result.delaysAvoided,
    estimatedDaysSaved: result.estimatedDaysSaved,
    marginProtected: result.marginProtected,
    risksMitigated: result.risksMitigated,
    interventionsTriggered: result.interventionsTriggered,
    interventionsCompleted: result.interventionsCompleted,
    tasksAutoCreated: result.tasksAutoCreated,
    bookingHoldsPreventedIssues: result.bookingHoldsPreventedIssues,
    recommendationsAccepted: result.recommendationsAccepted,
    recommendationsTotal: result.recommendationsTotal,
    intelligenceEnrichedImpact: result.intelligenceEnrichedImpact,
    internalOnlyImpact: result.internalOnlyImpact,
    attributionDetails: result.attributionDetails,
    computedAt: new Date(),
  });

  return result;
}

export async function getLatestAttribution(
  companyId: string,
  period?: "DAILY" | "WEEKLY" | "MONTHLY",
): Promise<InterventionAttribution | null> {
  const conditions = [eq(interventionAttributionsTable.companyId, companyId)];
  if (period) conditions.push(eq(interventionAttributionsTable.period, period));

  const rows = await db
    .select()
    .from(interventionAttributionsTable)
    .where(and(...conditions))
    .orderBy(desc(interventionAttributionsTable.computedAt))
    .limit(1);

  if (rows.length === 0) return null;
  const r = rows[0];

  return {
    id: r.id,
    period: r.period as "DAILY" | "WEEKLY" | "MONTHLY",
    delaysAvoided: r.delaysAvoided,
    estimatedDaysSaved: r.estimatedDaysSaved,
    marginProtected: r.marginProtected,
    risksMitigated: r.risksMitigated,
    interventionsTriggered: r.interventionsTriggered,
    interventionsCompleted: r.interventionsCompleted,
    tasksAutoCreated: r.tasksAutoCreated,
    bookingHoldsPreventedIssues: r.bookingHoldsPreventedIssues,
    recommendationsAccepted: r.recommendationsAccepted,
    recommendationsTotal: r.recommendationsTotal,
    intelligenceEnrichedImpact: r.intelligenceEnrichedImpact,
    internalOnlyImpact: r.internalOnlyImpact,
    attributionDetails: r.attributionDetails as AttributionDetail[],
  };
}

export async function getAttributionHistory(
  companyId: string,
  limit = 12,
): Promise<InterventionAttribution[]> {
  const rows = await db
    .select()
    .from(interventionAttributionsTable)
    .where(eq(interventionAttributionsTable.companyId, companyId))
    .orderBy(desc(interventionAttributionsTable.computedAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    period: r.period as "DAILY" | "WEEKLY" | "MONTHLY",
    delaysAvoided: r.delaysAvoided,
    estimatedDaysSaved: r.estimatedDaysSaved,
    marginProtected: r.marginProtected,
    risksMitigated: r.risksMitigated,
    interventionsTriggered: r.interventionsTriggered,
    interventionsCompleted: r.interventionsCompleted,
    tasksAutoCreated: r.tasksAutoCreated,
    bookingHoldsPreventedIssues: r.bookingHoldsPreventedIssues,
    recommendationsAccepted: r.recommendationsAccepted,
    recommendationsTotal: r.recommendationsTotal,
    intelligenceEnrichedImpact: r.intelligenceEnrichedImpact,
    internalOnlyImpact: r.internalOnlyImpact,
    attributionDetails: r.attributionDetails as AttributionDetail[],
  }));
}
