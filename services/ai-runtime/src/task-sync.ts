import { db } from "@workspace/db";
import {
  workflowTasksTable,
  recommendationsTable,
} from "@workspace/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";

const REC_TYPE_TO_TASK_TYPE: Record<string, string> = {
  COMPLIANCE_ESCALATION: "COMPLIANCE_CASE",
  DOCUMENT_CORRECTION: "DOCUMENT_CORRECTION_TASK",
  ROUTE_ADJUSTMENT: "ROUTE_REVIEW",
  CARRIER_SWITCH: "CARRIER_REVIEW",
  PRICING_ALERT: "PRICING_REVIEW",
  PRICING_ADJUSTMENT: "PRICING_REVIEW",
  INSURANCE_ADJUSTMENT: "INSURANCE_REVIEW",
  MARGIN_WARNING: "PRICING_REVIEW",
  DELAY_WARNING: "DELAY_RESPONSE_TASK",
  RISK_MITIGATION: "RISK_MITIGATION_TASK",
  DELAY_MITIGATION: "DELAY_RESPONSE_TASK",
  DISRUPTION_RESPONSE: "DISRUPTION_RESPONSE_TASK",
  SHIPMENT_HOLD: "HOLD_REVIEW_TASK",
  SHIPMENT_RELEASE: "RELEASE_REVIEW_TASK",
  CUSTOMER_COMMUNICATION: "CUSTOMER_COMMUNICATION_TASK",
  CLAIMS_READINESS: "CLAIMS_TASK",
  QUEUE_REPRIORITIZATION: "OPERATIONAL_FOLLOWUP_TASK",
  WORKFLOW_ESCALATION: "ESCALATION_TASK",
  OPERATIONAL_FOLLOWUP: "OPERATIONAL_FOLLOWUP_TASK",
};

const URGENCY_TO_PRIORITY: Record<string, string> = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
};

export interface TaskSyncResult {
  created: number;
  updated: number;
  suppressed: number;
  reopened: number;
}

function buildTaskMetadata(
  rec: typeof recommendationsTable.$inferSelect,
  analysisRunId: string,
  existing?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...(existing || {}),
    recommendationId: rec.id,
    analysisRunId,
    aiGenerated: true,
    recommendationType: rec.type,
    confidence: rec.confidence,
    urgency: rec.urgency,
    priorityReason: buildPriorityReason(rec),
    lastSyncedAt: new Date().toISOString(),
  };
}

function buildPriorityReason(
  rec: typeof recommendationsTable.$inferSelect,
): string {
  const parts: string[] = [];
  if (rec.urgency === "CRITICAL") parts.push("Critical urgency");
  else if (rec.urgency === "HIGH") parts.push("High urgency");

  if (rec.expectedDelayImpactDays && Math.abs(Number(rec.expectedDelayImpactDays)) > 2) {
    parts.push(`${Math.abs(Number(rec.expectedDelayImpactDays))}d delay impact`);
  }
  if (rec.expectedMarginImpactPct && Math.abs(Number(rec.expectedMarginImpactPct)) > 5) {
    parts.push(`${Math.abs(Number(rec.expectedMarginImpactPct))}% margin impact`);
  }
  if (rec.intelligenceEnriched === "true") {
    parts.push("Intelligence-enriched");
  }

  return parts.length > 0 ? parts.join("; ") : `AI recommendation: ${rec.type}`;
}

export async function syncTasksFromRecommendations(
  shipmentId: string,
  companyId: string,
  activeRecs: Array<typeof recommendationsTable.$inferSelect>,
  analysisRunId: string,
): Promise<TaskSyncResult> {
  let created = 0;
  let updated = 0;
  let suppressed = 0;
  let reopened = 0;

  const activeTasks = await db
    .select()
    .from(workflowTasksTable)
    .where(
      and(
        eq(workflowTasksTable.shipmentId, shipmentId),
        eq(workflowTasksTable.companyId, companyId),
        inArray(workflowTasksTable.status, ["OPEN", "IN_PROGRESS", "BLOCKED"]),
      ),
    );

  const completedAiTasks = await db
    .select()
    .from(workflowTasksTable)
    .where(
      and(
        eq(workflowTasksTable.shipmentId, shipmentId),
        eq(workflowTasksTable.companyId, companyId),
        inArray(workflowTasksTable.status, ["COMPLETED", "CANCELLED"]),
      ),
    );

  const activeTasksByRecId = new Map<string, typeof activeTasks[0]>();
  for (const task of activeTasks) {
    const recId = (task.metadata as Record<string, unknown>)?.recommendationId as string | undefined;
    if (recId) activeTasksByRecId.set(recId, task);
  }

  const completedTasksByRecId = new Map<string, typeof completedAiTasks[0]>();
  for (const task of completedAiTasks) {
    const meta = task.metadata as Record<string, unknown> | undefined;
    const recId = meta?.recommendationId as string | undefined;
    if (recId && meta?.aiGenerated) completedTasksByRecId.set(recId, task);
  }

  const activeRecIds = new Set(activeRecs.map((r) => r.id));

  for (const rec of activeRecs) {
    const taskType = REC_TYPE_TO_TASK_TYPE[rec.type] ?? "RISK_MITIGATION_TASK";
    const priority = URGENCY_TO_PRIORITY[rec.urgency] ?? "MEDIUM";
    const existingActive = activeTasksByRecId.get(rec.id);

    if (existingActive) {
      await db
        .update(workflowTasksTable)
        .set({
          priority: priority as any,
          title: `[AI] ${rec.title}`,
          description: rec.explanation,
          metadata: buildTaskMetadata(rec, analysisRunId, existingActive.metadata as Record<string, unknown>),
        })
        .where(eq(workflowTasksTable.id, existingActive.id));
      updated++;
      continue;
    }

    const completedTask = completedTasksByRecId.get(rec.id);
    if (completedTask) {
      const completedMeta = completedTask.metadata as Record<string, unknown> | undefined;
      if (completedMeta?.operatorLocked) {
        continue;
      }
      await db
        .update(workflowTasksTable)
        .set({
          status: "OPEN",
          priority: priority as any,
          title: `[AI] ${rec.title}`,
          description: rec.explanation,
          completedAt: null,
          metadata: {
            ...buildTaskMetadata(rec, analysisRunId, completedTask.metadata as Record<string, unknown>),
            reopenedAt: new Date().toISOString(),
            reopenReason: "Risk returned after prior resolution",
          },
        })
        .where(eq(workflowTasksTable.id, completedTask.id));
      reopened++;
      continue;
    }

    const existingByType = activeTasks.find(
      (t) =>
        t.taskType === taskType &&
        !(t.metadata as Record<string, unknown>)?.recommendationId,
    );

    if (existingByType) {
      await db
        .update(workflowTasksTable)
        .set({
          priority: priority as any,
          title: `[AI] ${rec.title}`,
          description: rec.explanation,
          metadata: buildTaskMetadata(rec, analysisRunId, existingByType.metadata as Record<string, unknown>),
        })
        .where(eq(workflowTasksTable.id, existingByType.id));
      updated++;
    } else {
      await db.insert(workflowTasksTable).values({
        id: generateId(),
        companyId,
        shipmentId,
        taskType: taskType as any,
        title: `[AI] ${rec.title}`,
        description: rec.explanation,
        status: "OPEN",
        priority: priority as any,
        creationSource: "RECOMMENDATION",
        metadata: buildTaskMetadata(rec, analysisRunId),
      });
      created++;
    }
  }

  for (const task of activeTasks) {
    const meta = task.metadata as Record<string, unknown> | undefined;
    const recId = meta?.recommendationId as string | undefined;
    if (recId && !activeRecIds.has(recId)) {
      const isAiGenerated = meta?.aiGenerated;
      const isOperatorLocked = meta?.operatorLocked === true;
      if (isAiGenerated && !isOperatorLocked) {
        await db
          .update(workflowTasksTable)
          .set({
            status: "COMPLETED",
            completedAt: new Date(),
            metadata: {
              ...(meta || {}),
              suppressedByAnalysis: analysisRunId,
              suppressedAt: new Date().toISOString(),
            },
          })
          .where(eq(workflowTasksTable.id, task.id));
        suppressed++;
      }
    }
  }

  return { created, updated, suppressed, reopened };
}

export async function handleRecommendationResponse(
  recId: string,
  action: "ACCEPTED" | "MODIFIED" | "REJECTED" | "IGNORED",
  companyId?: string,
  shipmentId?: string,
): Promise<void> {
  const conditions = [
    inArray(workflowTasksTable.status, ["OPEN", "IN_PROGRESS", "BLOCKED"]),
  ];
  if (companyId) conditions.push(eq(workflowTasksTable.companyId, companyId));
  if (shipmentId) conditions.push(eq(workflowTasksTable.shipmentId, shipmentId));

  const linkedTasks = await db
    .select()
    .from(workflowTasksTable)
    .where(and(...conditions));

  const matchingTasks = linkedTasks.filter((t) => {
    const meta = t.metadata as Record<string, unknown> | undefined;
    return meta?.recommendationId === recId && meta?.aiGenerated;
  });

  for (const matchingTask of matchingTasks) {
    if (action === "ACCEPTED" || action === "MODIFIED") {
      await db
        .update(workflowTasksTable)
        .set({
          status: "IN_PROGRESS",
          metadata: {
            ...(matchingTask.metadata as Record<string, unknown> || {}),
            operatorAction: action,
            operatorActionAt: new Date().toISOString(),
            operatorLocked: true,
          },
        })
        .where(eq(workflowTasksTable.id, matchingTask.id));
    } else if (action === "REJECTED" || action === "IGNORED") {
      await db
        .update(workflowTasksTable)
        .set({
          status: "CANCELLED",
          completedAt: new Date(),
          metadata: {
            ...(matchingTask.metadata as Record<string, unknown> || {}),
            operatorAction: action,
            operatorActionAt: new Date().toISOString(),
            operatorLocked: true,
            cancelReason: `Recommendation ${action.toLowerCase()} by operator`,
          },
        })
        .where(eq(workflowTasksTable.id, matchingTask.id));
    }
  }
}
