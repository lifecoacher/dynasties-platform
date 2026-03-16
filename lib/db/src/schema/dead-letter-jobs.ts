import { pgTable, text, timestamp, jsonb, index, integer } from "drizzle-orm/pg-core";

export const deadLetterJobsTable = pgTable(
  "dead_letter_jobs",
  {
    id: text("id").primaryKey(),
    queueName: text("queue_name").notNull(),
    jobBody: jsonb("job_body").notNull(),
    errorMessage: text("error_message").notNull(),
    errorStack: text("error_stack"),
    attemptCount: integer("attempt_count").notNull(),
    status: text("status", {
      enum: ["FAILED", "RETRIED", "RESOLVED"],
    })
      .notNull()
      .default("FAILED"),
    resolvedBy: text("resolved_by"),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("dlj_queue_name_idx").on(table.queueName),
    index("dlj_status_idx").on(table.status),
    index("dlj_created_at_idx").on(table.createdAt),
  ],
);

export type DeadLetterJob = typeof deadLetterJobsTable.$inferSelect;
export type InsertDeadLetterJob = typeof deadLetterJobsTable.$inferInsert;
