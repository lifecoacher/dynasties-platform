import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
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
    dueAt: timestamp("due_at"),
    completedAt: timestamp("completed_at"),
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

export type WorkflowTask = typeof workflowTasksTable.$inferSelect;
export type InsertWorkflowTask = typeof workflowTasksTable.$inferInsert;
export type TaskEvent = typeof taskEventsTable.$inferSelect;
export type InsertTaskEvent = typeof taskEventsTable.$inferInsert;
