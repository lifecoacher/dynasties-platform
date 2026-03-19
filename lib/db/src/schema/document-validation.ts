import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { shipmentsTable } from "./shipments";

export const documentValidationResultsTable = pgTable(
  "document_validation_results",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipmentsTable.id),
    status: text("status", {
      enum: ["READY", "REVIEW", "BLOCKED"],
    }).notNull(),
    readinessLevel: text("readiness_level", {
      enum: ["COMPLETE", "PARTIAL", "INSUFFICIENT"],
    }).notNull(),
    missingDocuments: jsonb("missing_documents")
      .notNull()
      .$type<
        Array<{
          code: string;
          label: string;
          reason: string;
          severity: "WARNING" | "CRITICAL";
        }>
      >()
      .default([]),
    missingFields: jsonb("missing_fields")
      .notNull()
      .$type<
        Array<{
          documentType?: string | null;
          field: string;
          severity: "WARNING" | "CRITICAL";
          detail: string;
        }>
      >()
      .default([]),
    inconsistencies: jsonb("inconsistencies")
      .notNull()
      .$type<
        Array<{
          code: string;
          field: string;
          values: string[];
          severity: "WARNING" | "CRITICAL";
          detail: string;
        }>
      >()
      .default([]),
    suspiciousFindings: jsonb("suspicious_findings")
      .notNull()
      .$type<
        Array<{
          code: string;
          title: string;
          detail: string;
          severity: "WARNING" | "CRITICAL";
        }>
      >()
      .default([]),
    recommendedActions: jsonb("recommended_actions")
      .notNull()
      .$type<string[]>()
      .default([]),
    reasoningSummary: text("reasoning_summary"),
    sourceDocuments: jsonb("source_documents")
      .notNull()
      .$type<
        Array<{
          documentId: string;
          documentType?: string | null;
          filename?: string | null;
          validationState: "VALID" | "INCOMPLETE" | "CONFLICTED" | "UNKNOWN";
        }>
      >()
      .default([]),
    validatedAt: timestamp("validated_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("doc_validation_results_company_id_idx").on(table.companyId),
    uniqueIndex("doc_validation_results_shipment_id_uniq").on(table.shipmentId),
    index("doc_validation_results_status_idx").on(table.status),
  ],
);

export type DocumentValidationResult =
  typeof documentValidationResultsTable.$inferSelect;
export type InsertDocumentValidationResult =
  typeof documentValidationResultsTable.$inferInsert;
