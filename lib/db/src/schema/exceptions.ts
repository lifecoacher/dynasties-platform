import { pgTable, text, timestamp, jsonb, index, boolean } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { shipmentsTable } from "./shipments";

export const exceptionsTable = pgTable(
  "exceptions",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    shipmentId: text("shipment_id")
      .references(() => shipmentsTable.id),
    exceptionType: text("exception_type", {
      enum: [
        "EXTRACTION_FAILURE",
        "DOCUMENT_CONFLICT",
        "COMPLIANCE_ALERT",
        "HIGH_RISK",
        "MISSING_DOCUMENT",
        "BILLING_DISCREPANCY",
      ],
    }).notNull(),
    severity: text("severity", {
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    }).notNull(),
    status: text("status", {
      enum: ["OPEN", "ACKNOWLEDGED", "RESOLVED", "ESCALATED"],
    })
      .notNull()
      .default("OPEN"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    detectedBy: text("detected_by").notNull(),
    impactSummary: text("impact_summary"),
    recommendedAction: text("recommended_action"),
    requiresEscalation: boolean("requires_escalation").notNull().default(false),
    agentClassification: jsonb("agent_classification"),
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
  ],
);

export type Exception = typeof exceptionsTable.$inferSelect;
export type InsertException = typeof exceptionsTable.$inferInsert;
