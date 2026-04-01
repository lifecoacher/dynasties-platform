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

  const existingTasks = await db
    .select()
    .from(workflowTasksTable)
    .where(
      and(
        eq(workflowTasksTable.shipmentId, shipmentId),
        eq(workflowTasksTable.companyId, companyId),
        inArray(workflowTasksTable.status, ["OPEN", "IN_PROGRESS", "BLOCKED"]),
      ),
    );

  const tasksByRecId = new Map<string, typeof existingTasks[0]>();
  for (const task of existingTasks) {
    const recId = (task.metadata as Record<string, unknown>)?.recommendationId as string | undefined;
    if (recId) tasksByRecId.set(recId, task);
  }

  const activeRecIds = new Set(activeRecs.map((r) => r.id));

  for (const rec of activeRecs) {
    const taskType = REC_TYPE_TO_TASK_TYPE[rec.type] ?? "RISK_MITIGATION_TASK";
    const priority = URGENCY_TO_PRIORITY[rec.urgency] ?? "MEDIUM";
    const existingTask = tasksByRecId.get(rec.id);

    if (existingTask) {
      await db
        .update(workflowTasksTable)
        .set({
          priority: priority as any,
          title: `[AI] ${rec.title}`,
          description: rec.explanation,
          metadata: {
            ...(existingTask.metadata as Record<string, unknown> || {}),
            recommendationId: rec.id,
            analysisRunId,
            aiGenerated: true,
            recommendationType: rec.type,
            confidence: rec.confidence,
          },
        })
        .where(eq(workflowTasksTable.id, existingTask.id));
      updated++;
    } else {
      const existingByType = existingTasks.find(
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
            metadata: {
              ...(existingByType.metadata as Record<string, unknown> || {}),
              recommendationId: rec.id,
              analysisRunId,
              aiGenerated: true,
              recommendationType: rec.type,
              confidence: rec.confidence,
            },
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
          metadata: {
            recommendationId: rec.id,
            analysisRunId,
            aiGenerated: true,
            recommendationType: rec.type,
            confidence: rec.confidence,
            urgency: rec.urgency,
          },
        });
        created++;
      }
    }
  }

  for (const task of existingTasks) {
    const recId = (task.metadata as Record<string, unknown>)?.recommendationId as string | undefined;
    if (recId && !activeRecIds.has(recId)) {
      const isAiGenerated = (task.metadata as Record<string, unknown>)?.aiGenerated;
      if (isAiGenerated) {
        await db
          .update(workflowTasksTable)
          .set({
            status: "COMPLETED",
            metadata: {
              ...(task.metadata as Record<string, unknown> || {}),
              suppressedByAnalysis: analysisRunId,
              suppressedAt: new Date().toISOString(),
            },
          })
          .where(eq(workflowTasksTable.id, task.id));
        suppressed++;
      }
    }
  }

  return { created, updated, suppressed };
}
