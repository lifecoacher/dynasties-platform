import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  integer,
  boolean,
  numeric,
} from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { shipmentsTable } from "./shipments";
import { usersTable } from "./users";

export const workflowTasksTable = pgTable(
  "workflow_tasks",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    shipmentId: text("shipment_id")
      .references(() => shipmentsTable.id),
    recommendationId: text("recommendation_id"),
    snapshotId: text("snapshot_id"),
    taskType: text("task_type", {
      enum: [
        "COMPLIANCE_CASE",
        "PRICING_REVIEW",
        "CARRIER_REVIEW",
        "ROUTE_REVIEW",
        "INSURANCE_REVIEW",
        "DOCUMENT_CORRECTION_TASK",
        "DISRUPTION_RESPONSE_TASK",
        "RISK_MITIGATION_TASK",
        "DELAY_RESPONSE_TASK",
      ],
    }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status", {
      enum: ["OPEN", "IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELLED"],
    })
      .notNull()
      .default("OPEN"),
    priority: text("priority", {
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    })
      .notNull()
      .default("MEDIUM"),
    assignedTo: text("assigned_to")
      .references(() => usersTable.id),
    createdBy: text("created_by")
      .notNull()
      .references(() => usersTable.id),
    creationSource: text("creation_source", {
      enum: ["MANUAL", "AUTO_POLICY", "RECOMMENDATION"],
    }).default("MANUAL"),
    policyDecisionId: text("policy_decision_id"),
    dueAt: timestamp("due_at"),
    completedAt: timestamp("completed_at"),
    escalationLevel: integer("escalation_level").default(0),
    escalatedAt: timestamp("escalated_at"),
    lastEscalationCheck: timestamp("last_escalation_check"),
    priorityScore: numeric("priority_score"),
    executionNotes: text("execution_notes"),
    completionNotes: text("completion_notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("workflow_tasks_company_id_idx").on(table.companyId),
    index("workflow_tasks_shipment_id_idx").on(table.shipmentId),
    index("workflow_tasks_recommendation_id_idx").on(table.recommendationId),
    index("workflow_tasks_task_type_idx").on(table.taskType),
    index("workflow_tasks_status_idx").on(table.status),
    index("workflow_tasks_assigned_to_idx").on(table.assignedTo),
    index("workflow_tasks_due_at_idx").on(table.dueAt),
    index("workflow_tasks_created_at_idx").on(table.createdAt),
    index("workflow_tasks_priority_score_idx").on(table.priorityScore),
    index("workflow_tasks_escalation_level_idx").on(table.escalationLevel),
  ],
);

export const taskEventsTable = pgTable(
  "task_events",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    taskId: text("task_id")
      .notNull()
      .references(() => workflowTasksTable.id),
    eventType: text("event_type", {
      enum: [
        "CREATED",
        "ASSIGNED",
        "STATUS_CHANGED",
        "PRIORITY_CHANGED",
        "NOTE_ADDED",
        "DUE_DATE_CHANGED",
        "COMPLETED",
        "CANCELLED",
        "REOPENED",
        "ESCALATED",
        "AUTO_CREATED",
        "PRIORITY_REFRESHED",
      ],
    }).notNull(),
    actorId: text("actor_id")
      .notNull()
      .references(() => usersTable.id),
    beforeValue: text("before_value"),
    afterValue: text("after_value"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("task_events_company_id_idx").on(table.companyId),
    index("task_events_task_id_idx").on(table.taskId),
    index("task_events_event_type_idx").on(table.eventType),
    index("task_events_created_at_idx").on(table.createdAt),
  ],
);

export const policyDecisionsTable = pgTable(
  "policy_decisions",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    recommendationId: text("recommendation_id").notNull(),
    shipmentId: text("shipment_id"),
    recommendationType: text("recommendation_type").notNull(),
    urgency: text("urgency").notNull(),
    confidence: numeric("confidence").notNull(),
    intelligenceEnriched: boolean("intelligence_enriched").default(false),
    outcome: text("outcome", {
      enum: [
        "ADVISORY_ONLY",
        "REQUIRES_MANUAL_APPROVAL",
        "AUTO_CREATE_TASK",
        "AUTO_ESCALATE_EXISTING_TASK",
        "REFRESH_EXISTING_TASK_PRIORITY",
      ],
    }).notNull(),
    taskTypeResolved: text("task_type_resolved"),
    priorityResolved: text("priority_resolved"),
    dueHoursResolved: integer("due_hours_resolved"),
    reason: text("reason").notNull(),
    taskId: text("task_id"),
    applied: boolean("applied").default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("policy_decisions_company_id_idx").on(table.companyId),
    index("policy_decisions_recommendation_id_idx").on(table.recommendationId),
    index("policy_decisions_outcome_idx").on(table.outcome),
    index("policy_decisions_created_at_idx").on(table.createdAt),
  ],
);

export const operationalNotificationsTable = pgTable(
  "operational_notifications",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    userId: text("user_id")
      .references(() => usersTable.id),
    eventType: text("event_type", {
      enum: [
        "TASK_ASSIGNED",
        "TASK_AUTO_CREATED",
        "TASK_OVERDUE",
        "TASK_ESCALATED",
        "RECOMMENDATION_CHANGED",
        "TASK_COMPLETED",
        "TASK_BLOCKED",
      ],
    }).notNull(),
    title: text("title").notNull(),
    message: text("message"),
    severity: text("severity", {
      enum: ["INFO", "WARNING", "CRITICAL"],
    })
      .notNull()
      .default("INFO"),
    relatedTaskId: text("related_task_id"),
    relatedShipmentId: text("related_shipment_id"),
    relatedRecommendationId: text("related_recommendation_id"),
    read: boolean("read").default(false),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("op_notifications_company_id_idx").on(table.companyId),
    index("op_notifications_user_id_idx").on(table.userId),
    index("op_notifications_event_type_idx").on(table.eventType),
    index("op_notifications_read_idx").on(table.read),
    index("op_notifications_created_at_idx").on(table.createdAt),
  ],
);

export type WorkflowTask = typeof workflowTasksTable.$inferSelect;
export type InsertWorkflowTask = typeof workflowTasksTable.$inferInsert;
export type TaskEvent = typeof taskEventsTable.$inferSelect;
export type InsertTaskEvent = typeof taskEventsTable.$inferInsert;
export type PolicyDecision = typeof policyDecisionsTable.$inferSelect;
export type InsertPolicyDecision = typeof policyDecisionsTable.$inferInsert;
export type OperationalNotification = typeof operationalNotificationsTable.$inferSelect;
export type InsertOperationalNotification = typeof operationalNotificationsTable.$inferInsert;
