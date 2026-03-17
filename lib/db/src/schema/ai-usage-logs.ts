import {
  pgTable,
  text,
  timestamp,
  index,
  integer,
  real,
  jsonb,
} from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const aiUsageLogsTable = pgTable(
  "ai_usage_logs",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").references(() => companiesTable.id),
    taskType: text("task_type").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    latencyMs: integer("latency_ms").notNull().default(0),
    status: text("status", { enum: ["success", "error", "fallback"] }).notNull(),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("ai_usage_logs_company_id_idx").on(table.companyId),
    index("ai_usage_logs_task_type_idx").on(table.taskType),
    index("ai_usage_logs_created_at_idx").on(table.createdAt),
  ],
);

export type AiUsageLog = typeof aiUsageLogsTable.$inferSelect;
export type InsertAiUsageLog = typeof aiUsageLogsTable.$inferInsert;
