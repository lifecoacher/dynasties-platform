import { db } from "@workspace/db";
import { workflowTasksTable } from "@workspace/db/schema";
import { eq, and, inArray, desc, asc, sql } from "drizzle-orm";

export interface PrioritizedTask {
  id: string;
  title: string;
  taskType: string;
  status: string;
  priority: string;
  priorityScore: number;
  assignedTo: string | null;
  dueAt: Date | null;
  isOverdue: boolean;
  escalationLevel: number;
  needsAttentionNow: boolean;
  shipmentId: string | null;
  recommendationId: string | null;
  createdAt: Date;
}

export function computeRoutingScore(task: {
  priority: string;
  priorityScore: string | null;
  dueAt: Date | null;
  escalationLevel: number | null;
  status: string;
  createdAt: Date;
}): number {
  const priorityWeight: Record<string, number> = {
    CRITICAL: 100,
    HIGH: 75,
    MEDIUM: 50,
    LOW: 25,
  };

  let score = priorityWeight[task.priority] || 50;

  if (task.priorityScore) {
    score += Number(task.priorityScore) * 20;
  }

  if (task.dueAt) {
    const now = new Date();
    const hoursUntilDue = (task.dueAt.getTime() - now.getTime()) / (60 * 60 * 1000);
    if (hoursUntilDue < 0) {
      score += 50 + Math.min(Math.abs(hoursUntilDue), 48);
    } else if (hoursUntilDue < 4) {
      score += 30;
    } else if (hoursUntilDue < 24) {
      score += 15;
    }
  }

  const level = task.escalationLevel ?? 0;
  score += level * 20;

  if (task.status === "BLOCKED") {
    score += 10;
  }

  const ageHours = (Date.now() - task.createdAt.getTime()) / (60 * 60 * 1000);
  if (ageHours > 72) {
    score += 5;
  }

  return Math.round(score * 100) / 100;
}

export function needsAttentionNow(task: {
  priority: string;
  dueAt: Date | null;
  escalationLevel: number | null;
  status: string;
}): boolean {
  if (task.priority === "CRITICAL") return true;
  if (task.escalationLevel && task.escalationLevel >= 2) return true;
  if (task.dueAt && new Date() > task.dueAt) return true;
  if (task.dueAt) {
    const hoursUntilDue = (task.dueAt.getTime() - Date.now()) / (60 * 60 * 1000);
    if (hoursUntilDue < 2 && task.priority === "HIGH") return true;
  }
  if (task.status === "BLOCKED" && task.priority !== "LOW") return true;
  return false;
}

export async function getPrioritizedQueue(
  companyId: string,
  filters?: {
    queue?: string;
    assignedTo?: string;
    unassignedOnly?: boolean;
    needsAttentionOnly?: boolean;
  },
): Promise<PrioritizedTask[]> {
  const conditions = [
    eq(workflowTasksTable.companyId, companyId),
    inArray(workflowTasksTable.status, ["OPEN", "IN_PROGRESS", "BLOCKED"]),
  ];

  if (filters?.assignedTo) {
    conditions.push(eq(workflowTasksTable.assignedTo, filters.assignedTo));
  }
  if (filters?.unassignedOnly) {
    conditions.push(sql`${workflowTasksTable.assignedTo} IS NULL`);
  }

  const queueTypeMap: Record<string, string[]> = {
    compliance: ["COMPLIANCE_CASE"],
    pricing: ["PRICING_REVIEW"],
    carrier: ["CARRIER_REVIEW", "ROUTE_REVIEW"],
    insurance: ["INSURANCE_REVIEW"],
    documents: ["DOCUMENT_CORRECTION_TASK"],
    disruption: ["DISRUPTION_RESPONSE_TASK", "DELAY_RESPONSE_TASK", "RISK_MITIGATION_TASK"],
  };

  if (filters?.queue && queueTypeMap[filters.queue]) {
    conditions.push(inArray(workflowTasksTable.taskType, queueTypeMap[filters.queue]! as any[]));
  }

  const tasks = await db
    .select()
    .from(workflowTasksTable)
    .where(and(...conditions))
    .orderBy(desc(workflowTasksTable.createdAt))
    .limit(200);

  const prioritized: PrioritizedTask[] = tasks.map((t) => {
    const routingScore = computeRoutingScore(t);
    const isOverdue = t.dueAt ? new Date() > t.dueAt : false;
    const attention = needsAttentionNow({
      priority: t.priority,
      dueAt: t.dueAt,
      escalationLevel: t.escalationLevel,
      status: t.status,
    });

    return {
      id: t.id,
      title: t.title,
      taskType: t.taskType,
      status: t.status,
      priority: t.priority,
      priorityScore: routingScore,
      assignedTo: t.assignedTo,
      dueAt: t.dueAt,
      isOverdue,
      escalationLevel: t.escalationLevel ?? 0,
      needsAttentionNow: attention,
      shipmentId: t.shipmentId,
      recommendationId: t.recommendationId,
      createdAt: t.createdAt,
    };
  });

  prioritized.sort((a, b) => {
    if (a.needsAttentionNow && !b.needsAttentionNow) return -1;
    if (!a.needsAttentionNow && b.needsAttentionNow) return 1;
    return b.priorityScore - a.priorityScore;
  });

  if (filters?.needsAttentionOnly) {
    return prioritized.filter((t) => t.needsAttentionNow);
  }

  return prioritized;
}
