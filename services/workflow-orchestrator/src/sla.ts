import { db } from "@workspace/db";
import {
  workflowTasksTable,
  taskEventsTable,
  operationalNotificationsTable,
} from "@workspace/db/schema";
import { eq, and, lt, inArray, isNull, or } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";

interface SlaRule {
  dueSlaHours: Record<string, number>;
  escalationThresholds: number[];
  maxEscalationLevel: number;
}

const SLA_RULES: Record<string, SlaRule> = {
  COMPLIANCE_CASE: {
    dueSlaHours: { CRITICAL: 2, HIGH: 8, MEDIUM: 48, LOW: 168 },
    escalationThresholds: [0.5, 0.75, 1.0],
    maxEscalationLevel: 3,
  },
  PRICING_REVIEW: {
    dueSlaHours: { CRITICAL: 4, HIGH: 24, MEDIUM: 72, LOW: 168 },
    escalationThresholds: [0.75, 1.0],
    maxEscalationLevel: 2,
  },
  CARRIER_REVIEW: {
    dueSlaHours: { CRITICAL: 4, HIGH: 24, MEDIUM: 72, LOW: 168 },
    escalationThresholds: [0.75, 1.0],
    maxEscalationLevel: 2,
  },
  ROUTE_REVIEW: {
    dueSlaHours: { CRITICAL: 4, HIGH: 12, MEDIUM: 48, LOW: 168 },
    escalationThresholds: [0.5, 0.75, 1.0],
    maxEscalationLevel: 3,
  },
  INSURANCE_REVIEW: {
    dueSlaHours: { CRITICAL: 8, HIGH: 24, MEDIUM: 72, LOW: 168 },
    escalationThresholds: [0.75, 1.0],
    maxEscalationLevel: 2,
  },
  DOCUMENT_CORRECTION_TASK: {
    dueSlaHours: { CRITICAL: 4, HIGH: 12, MEDIUM: 48, LOW: 168 },
    escalationThresholds: [0.75, 1.0],
    maxEscalationLevel: 2,
  },
  DISRUPTION_RESPONSE_TASK: {
    dueSlaHours: { CRITICAL: 2, HIGH: 8, MEDIUM: 24, LOW: 72 },
    escalationThresholds: [0.5, 0.75, 1.0],
    maxEscalationLevel: 3,
  },
  RISK_MITIGATION_TASK: {
    dueSlaHours: { CRITICAL: 4, HIGH: 12, MEDIUM: 48, LOW: 168 },
    escalationThresholds: [0.5, 0.75, 1.0],
    maxEscalationLevel: 3,
  },
  DELAY_RESPONSE_TASK: {
    dueSlaHours: { CRITICAL: 2, HIGH: 8, MEDIUM: 24, LOW: 72 },
    escalationThresholds: [0.5, 0.75, 1.0],
    maxEscalationLevel: 3,
  },
};

export function getSlaHours(taskType: string, priority: string): number {
  const rule = SLA_RULES[taskType];
  if (!rule) return 72;
  return rule.dueSlaHours[priority] ?? 72;
}

export function computeDueDate(taskType: string, priority: string, from?: Date): Date {
  const hours = getSlaHours(taskType, priority);
  const base = from || new Date();
  return new Date(base.getTime() + hours * 60 * 60 * 1000);
}

export interface EscalationCheckResult {
  taskId: string;
  shouldEscalate: boolean;
  currentLevel: number;
  newLevel: number;
  isOverdue: boolean;
  slaPercentUsed: number;
  priority: string;
}

export function checkEscalation(task: {
  id: string;
  taskType: string;
  priority: string;
  dueAt: Date | null;
  escalationLevel: number | null;
  status: string;
  createdAt: Date;
}): EscalationCheckResult {
  const rule = SLA_RULES[task.taskType];
  const currentLevel = task.escalationLevel ?? 0;
  const now = new Date();

  if (!rule || !task.dueAt) {
    return {
      taskId: task.id,
      shouldEscalate: false,
      currentLevel,
      newLevel: currentLevel,
      isOverdue: false,
      slaPercentUsed: 0,
      priority: task.priority,
    };
  }

  const totalSlaMs = task.dueAt.getTime() - task.createdAt.getTime();
  const elapsedMs = now.getTime() - task.createdAt.getTime();
  const slaPercentUsed = totalSlaMs > 0 ? elapsedMs / totalSlaMs : 0;
  const isOverdue = now > task.dueAt;

  let shouldEscalate = false;
  let newLevel = currentLevel;

  for (let i = 0; i < rule.escalationThresholds.length; i++) {
    const threshold = rule.escalationThresholds[i]!;
    const levelForThreshold = i + 1;
    if (slaPercentUsed >= threshold && currentLevel < levelForThreshold && levelForThreshold <= rule.maxEscalationLevel) {
      shouldEscalate = true;
      newLevel = levelForThreshold;
    }
  }

  return {
    taskId: task.id,
    shouldEscalate,
    currentLevel,
    newLevel,
    isOverdue,
    slaPercentUsed,
    priority: task.priority,
  };
}

export async function runEscalationCheck(
  companyId: string,
  systemUserId: string,
): Promise<EscalationCheckResult[]> {
  const activeTasks = await db
    .select()
    .from(workflowTasksTable)
    .where(
      and(
        eq(workflowTasksTable.companyId, companyId),
        inArray(workflowTasksTable.status, ["OPEN", "IN_PROGRESS", "BLOCKED"]),
      ),
    );

  const results: EscalationCheckResult[] = [];

  for (const task of activeTasks) {
    const check = checkEscalation({
      id: task.id,
      taskType: task.taskType,
      priority: task.priority,
      dueAt: task.dueAt,
      escalationLevel: task.escalationLevel,
      status: task.status,
      createdAt: task.createdAt,
    });

    if (check.shouldEscalate) {
      const PRIORITY_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
      const currentPriorityIdx = PRIORITY_ORDER.indexOf(task.priority);
      const escalatedPriority = PRIORITY_ORDER[Math.min(currentPriorityIdx + 1, 3)]!;

      await db
        .update(workflowTasksTable)
        .set({
          escalationLevel: check.newLevel,
          escalatedAt: new Date(),
          lastEscalationCheck: new Date(),
          priority: escalatedPriority as any,
          updatedAt: new Date(),
        })
        .where(eq(workflowTasksTable.id, task.id));

      await db.insert(taskEventsTable).values({
        id: generateId("tev"),
        companyId,
        taskId: task.id,
        eventType: "ESCALATED",
        actorId: systemUserId,
        beforeValue: `L${check.currentLevel}/${task.priority}`,
        afterValue: `L${check.newLevel}/${escalatedPriority}`,
        notes: `SLA ${(check.slaPercentUsed * 100).toFixed(0)}% used. Escalated from L${check.currentLevel} to L${check.newLevel}.${check.isOverdue ? " OVERDUE." : ""}`,
      });

      await db.insert(operationalNotificationsTable).values({
        id: generateId("ntf"),
        companyId,
        userId: task.assignedTo,
        eventType: check.isOverdue ? "TASK_OVERDUE" : "TASK_ESCALATED",
        title: check.isOverdue
          ? `Overdue: ${task.title}`
          : `Escalated to L${check.newLevel}: ${task.title}`,
        message: `SLA ${(check.slaPercentUsed * 100).toFixed(0)}% consumed. Priority elevated to ${escalatedPriority}.`,
        severity: check.isOverdue || escalatedPriority === "CRITICAL" ? "CRITICAL" : "WARNING",
        relatedTaskId: task.id,
        relatedShipmentId: task.shipmentId,
      });
    } else {
      await db
        .update(workflowTasksTable)
        .set({ lastEscalationCheck: new Date() })
        .where(eq(workflowTasksTable.id, task.id));
    }

    results.push(check);
  }

  return results;
}
