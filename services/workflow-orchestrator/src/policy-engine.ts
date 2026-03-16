import { db } from "@workspace/db";
import {
  policyDecisionsTable,
  workflowTasksTable,
  taskEventsTable,
  operationalNotificationsTable,
} from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";

export type PolicyOutcome =
  | "ADVISORY_ONLY"
  | "REQUIRES_MANUAL_APPROVAL"
  | "AUTO_CREATE_TASK"
  | "AUTO_ESCALATE_EXISTING_TASK"
  | "REFRESH_EXISTING_TASK_PRIORITY";

export interface RecommendationInput {
  id: string;
  companyId: string;
  shipmentId: string | null;
  type: string;
  urgency: string;
  confidence: number;
  title: string;
  explanation: string | null;
  recommendedAction: string | null;
  intelligenceEnriched: boolean;
  expectedDelayImpactDays: number | null;
  expectedMarginImpactPct: number | null;
  expectedRiskReduction: number | null;
  reasonCodes: string[];
  externalReasonCodes: string[] | null;
}

export interface PolicyResult {
  outcome: PolicyOutcome;
  taskType: string;
  priority: string;
  dueHours: number;
  reason: string;
}

const RECOMMENDATION_TO_TASK_TYPE: Record<string, string> = {
  COMPLIANCE_ESCALATION: "COMPLIANCE_CASE",
  PRICING_ALERT: "PRICING_REVIEW",
  CARRIER_SWITCH: "CARRIER_REVIEW",
  ROUTE_ADJUSTMENT: "ROUTE_REVIEW",
  INSURANCE_ADJUSTMENT: "INSURANCE_REVIEW",
  DOCUMENT_CORRECTION: "DOCUMENT_CORRECTION_TASK",
  RISK_MITIGATION: "RISK_MITIGATION_TASK",
  DELAY_WARNING: "DELAY_RESPONSE_TASK",
  MARGIN_WARNING: "PRICING_REVIEW",
};

interface PolicyRule {
  minConfidence: number;
  urgencyThresholds: Record<string, PolicyOutcome>;
  intelBoost: boolean;
  defaultOutcome: PolicyOutcome;
}

const POLICY_RULES: Record<string, PolicyRule> = {
  COMPLIANCE_ESCALATION: {
    minConfidence: 0,
    urgencyThresholds: {
      CRITICAL: "AUTO_CREATE_TASK",
      HIGH: "AUTO_CREATE_TASK",
      MEDIUM: "REQUIRES_MANUAL_APPROVAL",
      LOW: "REQUIRES_MANUAL_APPROVAL",
    },
    intelBoost: true,
    defaultOutcome: "REQUIRES_MANUAL_APPROVAL",
  },
  DOCUMENT_CORRECTION: {
    minConfidence: 0.7,
    urgencyThresholds: {
      CRITICAL: "AUTO_CREATE_TASK",
      HIGH: "AUTO_CREATE_TASK",
      MEDIUM: "REQUIRES_MANUAL_APPROVAL",
      LOW: "ADVISORY_ONLY",
    },
    intelBoost: false,
    defaultOutcome: "ADVISORY_ONLY",
  },
  DELAY_WARNING: {
    minConfidence: 0.6,
    urgencyThresholds: {
      CRITICAL: "AUTO_CREATE_TASK",
      HIGH: "AUTO_CREATE_TASK",
      MEDIUM: "REQUIRES_MANUAL_APPROVAL",
      LOW: "ADVISORY_ONLY",
    },
    intelBoost: true,
    defaultOutcome: "ADVISORY_ONLY",
  },
  PRICING_ALERT: {
    minConfidence: 0.65,
    urgencyThresholds: {
      CRITICAL: "AUTO_CREATE_TASK",
      HIGH: "REQUIRES_MANUAL_APPROVAL",
      MEDIUM: "REQUIRES_MANUAL_APPROVAL",
      LOW: "ADVISORY_ONLY",
    },
    intelBoost: true,
    defaultOutcome: "ADVISORY_ONLY",
  },
  ROUTE_ADJUSTMENT: {
    minConfidence: 0.6,
    urgencyThresholds: {
      CRITICAL: "AUTO_CREATE_TASK",
      HIGH: "AUTO_CREATE_TASK",
      MEDIUM: "REQUIRES_MANUAL_APPROVAL",
      LOW: "ADVISORY_ONLY",
    },
    intelBoost: true,
    defaultOutcome: "REQUIRES_MANUAL_APPROVAL",
  },
  CARRIER_SWITCH: {
    minConfidence: 0.7,
    urgencyThresholds: {
      CRITICAL: "AUTO_CREATE_TASK",
      HIGH: "REQUIRES_MANUAL_APPROVAL",
      MEDIUM: "REQUIRES_MANUAL_APPROVAL",
      LOW: "ADVISORY_ONLY",
    },
    intelBoost: true,
    defaultOutcome: "REQUIRES_MANUAL_APPROVAL",
  },
  RISK_MITIGATION: {
    minConfidence: 0.5,
    urgencyThresholds: {
      CRITICAL: "AUTO_CREATE_TASK",
      HIGH: "AUTO_CREATE_TASK",
      MEDIUM: "REQUIRES_MANUAL_APPROVAL",
      LOW: "ADVISORY_ONLY",
    },
    intelBoost: true,
    defaultOutcome: "REQUIRES_MANUAL_APPROVAL",
  },
  INSURANCE_ADJUSTMENT: {
    minConfidence: 0.6,
    urgencyThresholds: {
      CRITICAL: "AUTO_CREATE_TASK",
      HIGH: "REQUIRES_MANUAL_APPROVAL",
      MEDIUM: "ADVISORY_ONLY",
      LOW: "ADVISORY_ONLY",
    },
    intelBoost: true,
    defaultOutcome: "ADVISORY_ONLY",
  },
  MARGIN_WARNING: {
    minConfidence: 0.5,
    urgencyThresholds: {
      CRITICAL: "AUTO_CREATE_TASK",
      HIGH: "REQUIRES_MANUAL_APPROVAL",
      MEDIUM: "ADVISORY_ONLY",
      LOW: "ADVISORY_ONLY",
    },
    intelBoost: false,
    defaultOutcome: "ADVISORY_ONLY",
  },
};

const PRIORITY_MAP: Record<string, string> = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
};

const DUE_HOURS: Record<string, Record<string, number>> = {
  COMPLIANCE_CASE: { CRITICAL: 2, HIGH: 8, MEDIUM: 48, LOW: 168 },
  PRICING_REVIEW: { CRITICAL: 4, HIGH: 24, MEDIUM: 72, LOW: 168 },
  CARRIER_REVIEW: { CRITICAL: 4, HIGH: 24, MEDIUM: 72, LOW: 168 },
  ROUTE_REVIEW: { CRITICAL: 4, HIGH: 12, MEDIUM: 48, LOW: 168 },
  INSURANCE_REVIEW: { CRITICAL: 8, HIGH: 24, MEDIUM: 72, LOW: 168 },
  DOCUMENT_CORRECTION_TASK: { CRITICAL: 4, HIGH: 12, MEDIUM: 48, LOW: 168 },
  DISRUPTION_RESPONSE_TASK: { CRITICAL: 2, HIGH: 8, MEDIUM: 24, LOW: 72 },
  RISK_MITIGATION_TASK: { CRITICAL: 4, HIGH: 12, MEDIUM: 48, LOW: 168 },
  DELAY_RESPONSE_TASK: { CRITICAL: 2, HIGH: 8, MEDIUM: 24, LOW: 72 },
};

export function evaluatePolicy(rec: RecommendationInput): PolicyResult {
  const rule = POLICY_RULES[rec.type];
  const taskType = RECOMMENDATION_TO_TASK_TYPE[rec.type] || "RISK_MITIGATION_TASK";
  const priority = PRIORITY_MAP[rec.urgency] || "MEDIUM";
  const dueHours = DUE_HOURS[taskType]?.[priority] ?? 72;

  if (!rule) {
    return {
      outcome: "ADVISORY_ONLY",
      taskType,
      priority,
      dueHours,
      reason: `No policy rule for recommendation type ${rec.type}`,
    };
  }

  if (rec.confidence < rule.minConfidence) {
    return {
      outcome: "ADVISORY_ONLY",
      taskType,
      priority,
      dueHours,
      reason: `Confidence ${(rec.confidence * 100).toFixed(0)}% below threshold ${(rule.minConfidence * 100).toFixed(0)}%`,
    };
  }

  let outcome = rule.urgencyThresholds[rec.urgency] || rule.defaultOutcome;

  if (rule.intelBoost && rec.intelligenceEnriched && outcome === "REQUIRES_MANUAL_APPROVAL") {
    outcome = "AUTO_CREATE_TASK";
  }

  if (rule.intelBoost && rec.intelligenceEnriched && outcome === "ADVISORY_ONLY" && rec.confidence >= 0.75) {
    outcome = "REQUIRES_MANUAL_APPROVAL";
  }

  if (
    outcome === "AUTO_CREATE_TASK" &&
    rec.urgency === "CRITICAL" &&
    rec.confidence >= 0.85 &&
    rec.intelligenceEnriched &&
    (rec.expectedDelayImpactDays ?? 0) >= 7
  ) {
    outcome = "AUTO_ESCALATE_EXISTING_TASK";
  }

  const reasons: string[] = [];
  reasons.push(`Type=${rec.type}, Urgency=${rec.urgency}, Confidence=${(rec.confidence * 100).toFixed(0)}%`);
  if (rec.intelligenceEnriched) reasons.push("Intel-enriched");
  reasons.push(`Policy outcome: ${outcome}`);

  return {
    outcome,
    taskType,
    priority,
    dueHours,
    reason: reasons.join("; "),
  };
}

export async function applyPolicy(
  rec: RecommendationInput,
  systemUserId: string,
): Promise<{ decisionId: string; taskId: string | null; outcome: PolicyOutcome }> {
  const result = evaluatePolicy(rec);
  const decisionId = generateId("pol");
  let taskId: string | null = null;

  const existingActiveTasks = await db
    .select({ id: workflowTasksTable.id, priority: workflowTasksTable.priority })
    .from(workflowTasksTable)
    .where(
      and(
        eq(workflowTasksTable.companyId, rec.companyId),
        eq(workflowTasksTable.recommendationId, rec.id),
        inArray(workflowTasksTable.status, ["OPEN", "IN_PROGRESS", "BLOCKED"]),
      ),
    )
    .limit(1);

  const hasActiveTask = existingActiveTasks.length > 0;

  let finalOutcome = result.outcome;

  if (hasActiveTask && finalOutcome === "AUTO_CREATE_TASK") {
    finalOutcome = "REFRESH_EXISTING_TASK_PRIORITY";
  }

  if (!hasActiveTask && finalOutcome === "AUTO_ESCALATE_EXISTING_TASK") {
    finalOutcome = "AUTO_CREATE_TASK";
  }

  await db.insert(policyDecisionsTable).values({
    id: decisionId,
    companyId: rec.companyId,
    recommendationId: rec.id,
    shipmentId: rec.shipmentId,
    recommendationType: rec.type,
    urgency: rec.urgency,
    confidence: String(rec.confidence),
    intelligenceEnriched: rec.intelligenceEnriched,
    outcome: finalOutcome,
    taskTypeResolved: result.taskType,
    priorityResolved: result.priority,
    dueHoursResolved: result.dueHours,
    reason: result.reason,
    applied: false,
    metadata: {
      reasonCodes: rec.reasonCodes,
      externalReasonCodes: rec.externalReasonCodes,
      expectedDelayImpactDays: rec.expectedDelayImpactDays,
      expectedMarginImpactPct: rec.expectedMarginImpactPct,
      expectedRiskReduction: rec.expectedRiskReduction,
    },
  });

  if (finalOutcome === "AUTO_CREATE_TASK" && !hasActiveTask) {
    taskId = await autoCreateTask(rec, result, decisionId, systemUserId);
  } else if (finalOutcome === "REFRESH_EXISTING_TASK_PRIORITY" && hasActiveTask) {
    taskId = existingActiveTasks[0]!.id;
    await refreshTaskPriority(taskId, rec, result, systemUserId);
  } else if (finalOutcome === "AUTO_ESCALATE_EXISTING_TASK" && hasActiveTask) {
    taskId = existingActiveTasks[0]!.id;
    await escalateExistingTask(taskId, rec, systemUserId);
  }

  await db
    .update(policyDecisionsTable)
    .set({ applied: true, taskId })
    .where(eq(policyDecisionsTable.id, decisionId));

  return { decisionId, taskId, outcome: finalOutcome };
}

async function autoCreateTask(
  rec: RecommendationInput,
  result: PolicyResult,
  decisionId: string,
  systemUserId: string,
): Promise<string> {
  const taskId = generateId("tsk");
  const dueAt = new Date(Date.now() + result.dueHours * 60 * 60 * 1000);

  await db.transaction(async (tx) => {
    await tx.insert(workflowTasksTable).values({
      id: taskId,
      companyId: rec.companyId,
      shipmentId: rec.shipmentId,
      recommendationId: rec.id,
      taskType: result.taskType as any,
      title: rec.title,
      description: rec.explanation,
      status: "OPEN",
      priority: result.priority as any,
      createdBy: systemUserId,
      creationSource: "AUTO_POLICY",
      policyDecisionId: decisionId,
      dueAt,
      executionNotes: rec.recommendedAction,
      priorityScore: String(computePriorityScore(rec, result)),
      metadata: {
        recommendationType: rec.type,
        urgency: rec.urgency,
        confidence: rec.confidence,
        reasonCodes: rec.reasonCodes,
        externalReasonCodes: rec.externalReasonCodes,
        intelligenceEnriched: rec.intelligenceEnriched,
        autoCreated: true,
      },
    });

    await tx.insert(taskEventsTable).values({
      id: generateId("tev"),
      companyId: rec.companyId,
      taskId,
      eventType: "AUTO_CREATED",
      actorId: systemUserId,
      afterValue: "OPEN",
      notes: `Auto-created by policy: ${result.reason}`,
      metadata: { policyDecisionId: decisionId, recommendationId: rec.id },
    });

    await tx.insert(operationalNotificationsTable).values({
      id: generateId("ntf"),
      companyId: rec.companyId,
      eventType: "TASK_AUTO_CREATED",
      title: `Auto-created: ${rec.title}`,
      message: `A ${result.taskType.replace(/_/g, " ")} task was auto-created from a ${rec.urgency} ${rec.type} recommendation.`,
      severity: rec.urgency === "CRITICAL" ? "CRITICAL" : rec.urgency === "HIGH" ? "WARNING" : "INFO",
      relatedTaskId: taskId,
      relatedShipmentId: rec.shipmentId,
      relatedRecommendationId: rec.id,
    });
  });

  return taskId;
}

async function refreshTaskPriority(
  taskId: string,
  rec: RecommendationInput,
  result: PolicyResult,
  systemUserId: string,
): Promise<void> {
  const [task] = await db
    .select()
    .from(workflowTasksTable)
    .where(eq(workflowTasksTable.id, taskId))
    .limit(1);

  if (!task) return;

  const PRIORITY_ORDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const currentIdx = PRIORITY_ORDER.indexOf(task.priority);
  const newIdx = PRIORITY_ORDER.indexOf(result.priority);

  if (newIdx > currentIdx) {
    await db
      .update(workflowTasksTable)
      .set({
        priority: result.priority as any,
        priorityScore: String(computePriorityScore(rec, result)),
        updatedAt: new Date(),
      })
      .where(eq(workflowTasksTable.id, taskId));

    await db.insert(taskEventsTable).values({
      id: generateId("tev"),
      companyId: rec.companyId,
      taskId,
      eventType: "PRIORITY_REFRESHED",
      actorId: systemUserId,
      beforeValue: task.priority,
      afterValue: result.priority,
      notes: `Priority refreshed by policy: ${result.reason}`,
    });
  }
}

async function escalateExistingTask(
  taskId: string,
  rec: RecommendationInput,
  systemUserId: string,
): Promise<void> {
  const [task] = await db
    .select()
    .from(workflowTasksTable)
    .where(eq(workflowTasksTable.id, taskId))
    .limit(1);

  if (!task) return;

  const newLevel = (task.escalationLevel ?? 0) + 1;

  await db
    .update(workflowTasksTable)
    .set({
      escalationLevel: newLevel,
      escalatedAt: new Date(),
      priority: "CRITICAL" as any,
      updatedAt: new Date(),
    })
    .where(eq(workflowTasksTable.id, taskId));

  await db.insert(taskEventsTable).values({
    id: generateId("tev"),
    companyId: rec.companyId,
    taskId,
    eventType: "ESCALATED",
    actorId: systemUserId,
    beforeValue: String(task.escalationLevel ?? 0),
    afterValue: String(newLevel),
    notes: `Escalated due to ${rec.type} recommendation change`,
  });

  await db.insert(operationalNotificationsTable).values({
    id: generateId("ntf"),
    companyId: rec.companyId,
    eventType: "TASK_ESCALATED",
    title: `Escalated: ${task.title}`,
    message: `Task escalated to L${newLevel} due to new ${rec.urgency} ${rec.type} recommendation.`,
    severity: "CRITICAL",
    relatedTaskId: taskId,
    relatedShipmentId: rec.shipmentId,
    relatedRecommendationId: rec.id,
    userId: task.assignedTo,
  });
}

export function computePriorityScore(
  rec: RecommendationInput,
  result: PolicyResult,
): number {
  const priorityWeight: Record<string, number> = {
    CRITICAL: 1.0,
    HIGH: 0.75,
    MEDIUM: 0.5,
    LOW: 0.25,
  };

  const pw = priorityWeight[result.priority] || 0.5;
  const confidence = rec.confidence;
  const delayImpact = Math.min((rec.expectedDelayImpactDays ?? 0) / 14, 1);
  const marginImpact = Math.min(Math.abs(rec.expectedMarginImpactPct ?? 0) / 20, 1);
  const riskImpact = Math.min((rec.expectedRiskReduction ?? 0) / 30, 1);
  const intelBonus = rec.intelligenceEnriched ? 0.1 : 0;

  return (
    pw * 0.3 +
    confidence * 0.2 +
    delayImpact * 0.15 +
    marginImpact * 0.15 +
    riskImpact * 0.1 +
    intelBonus +
    0 // recency placeholder
  );
}
