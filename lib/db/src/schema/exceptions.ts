import { pgTable, text, timestamp, jsonb, index, boolean } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { shipmentsTable } from "./shipments";

export const EXCEPTION_TYPES = [
  "EXTRACTION_FAILURE",
  "DOCUMENT_CONFLICT",
  "COMPLIANCE_ALERT",
  "HIGH_RISK",
  "MISSING_DOCUMENT",
  "BILLING_DISCREPANCY",
  "CUSTOMS_HOLD",
  "DELAYED_SHIPMENT",
  "MISSING_DOCUMENTS",
  "DOCUMENT_BLOCKED",
  "REWEIGH_RECLASS",
  "MISSED_PICKUP",
  "DELIVERY_EXCEPTION",
  "OSD_DAMAGE_SHORTAGE",
  "MAJOR_INVOICE_VARIANCE",
  "UNMATCHED_CARRIER_INVOICE",
  "RELEASE_BLOCKED",
  "HIGH_RISK_REVIEW",
] as const;

export type ExceptionType = (typeof EXCEPTION_TYPES)[number];

export const EXCEPTION_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type ExceptionSeverity = (typeof EXCEPTION_SEVERITIES)[number];

export const EXCEPTION_STATUSES = ["OPEN", "IN_PROGRESS", "ACKNOWLEDGED", "RESOLVED", "ESCALATED"] as const;
export type ExceptionStatus = (typeof EXCEPTION_STATUSES)[number];

export const EXCEPTION_SOURCES = ["EVENT", "DOCUMENT", "RECONCILIATION", "DECISION", "MANUAL", "SYSTEM"] as const;
export type ExceptionSource = (typeof EXCEPTION_SOURCES)[number];

export const exceptionsTable = pgTable(
  "exceptions",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    shipmentId: text("shipment_id")
      .references(() => shipmentsTable.id),
    invoiceId: text("invoice_id"),
    documentId: text("document_id"),
    exceptionType: text("exception_type", {
      enum: [...EXCEPTION_TYPES],
    }).notNull(),
    severity: text("severity", {
      enum: [...EXCEPTION_SEVERITIES],
    }).notNull(),
    status: text("status", {
      enum: [...EXCEPTION_STATUSES],
    })
      .notNull()
      .default("OPEN"),
    detectedFrom: text("detected_from", {
      enum: [...EXCEPTION_SOURCES],
    }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    detectedBy: text("detected_by").notNull(),
    impactSummary: text("impact_summary"),
    recommendedAction: text("recommended_action"),
    recommendedActions: jsonb("recommended_actions"),
    requiresEscalation: boolean("requires_escalation").notNull().default(false),
    agentClassification: jsonb("agent_classification"),
    assignedToUserId: text("assigned_to_user_id"),
    dueAt: timestamp("due_at"),
    resolvedBy: text("resolved_by"),
    resolvedAt: timestamp("resolved_at"),
    resolutionNotes: text("resolution_notes"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("exceptions_company_id_idx").on(table.companyId),
    index("exceptions_shipment_id_idx").on(table.shipmentId),
    index("exceptions_type_idx").on(table.exceptionType),
    index("exceptions_status_idx").on(table.status),
    index("exceptions_severity_idx").on(table.severity),
    index("exceptions_detected_from_idx").on(table.detectedFrom),
    index("exceptions_assigned_to_idx").on(table.assignedToUserId),
  ],
);

export type Exception = typeof exceptionsTable.$inferSelect;
export type InsertException = typeof exceptionsTable.$inferInsert;
