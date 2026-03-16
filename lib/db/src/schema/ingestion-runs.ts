import { pgTable, text, timestamp, jsonb, index, integer } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const ingestionRunsTable = pgTable(
  "ingestion_runs",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").references(() => companiesTable.id),
    sourceId: text("source_id").notNull(),
    sourceType: text("source_type").notNull(),
    status: text("status", {
      enum: ["running", "completed", "partial", "failed"],
    }).notNull().default("running"),
    recordsFetched: integer("records_fetched").notNull().default(0),
    recordsValidated: integer("records_validated").notNull().default(0),
    recordsPersisted: integer("records_persisted").notNull().default(0),
    recordsDeduplicated: integer("records_deduplicated").notNull().default(0),
    recordsFailed: integer("records_failed").notNull().default(0),
    graphEdgesCreated: integer("graph_edges_created").notNull().default(0),
    errorMessage: text("error_message"),
    errorDetails: jsonb("error_details").$type<Record<string, unknown>>(),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("ir_company_id_idx").on(table.companyId),
    index("ir_source_id_idx").on(table.sourceId),
    index("ir_source_type_idx").on(table.sourceType),
    index("ir_status_idx").on(table.status),
    index("ir_started_at_idx").on(table.startedAt),
  ],
);

export type IngestionRun = typeof ingestionRunsTable.$inferSelect;
export type InsertIngestionRun = typeof ingestionRunsTable.$inferInsert;
