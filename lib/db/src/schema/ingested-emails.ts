import {
  pgTable,
  text,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const ingestedEmailsTable = pgTable(
  "ingested_emails",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    messageId: text("message_id").notNull(),
    fromAddress: text("from_address").notNull(),
    toAddress: text("to_address").notNull(),
    subject: text("subject"),
    bodyText: text("body_text"),
    s3Key: text("s3_key").notNull(),
    attachmentCount: integer("attachment_count").notNull().default(0),
    status: text("status", {
      enum: ["RECEIVED", "PROCESSING", "PROCESSED", "FAILED"],
    }).notNull(),
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("ingested_emails_company_id_idx").on(table.companyId),
    index("ingested_emails_status_idx").on(table.status),
    index("ingested_emails_created_at_idx").on(table.createdAt),
  ],
);

export type IngestedEmail = typeof ingestedEmailsTable.$inferSelect;
export type InsertIngestedEmail = typeof ingestedEmailsTable.$inferInsert;
