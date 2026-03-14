import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { claimsTable } from "./claims";

export const claimCommunicationsTable = pgTable(
  "claim_communications",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    claimId: text("claim_id")
      .notNull()
      .references(() => claimsTable.id),
    direction: text("direction", {
      enum: ["INBOUND", "OUTBOUND", "INTERNAL"],
    }).notNull(),
    communicationType: text("communication_type", {
      enum: ["NOTE", "EMAIL", "DOCUMENT", "STATUS_UPDATE"],
    }).notNull(),
    subject: text("subject"),
    body: text("body").notNull(),
    attachmentKeys: jsonb("attachment_keys"),
    author: text("author").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("claim_communications_company_id_idx").on(table.companyId),
    index("claim_communications_claim_id_idx").on(table.claimId),
  ],
);

export type ClaimCommunication = typeof claimCommunicationsTable.$inferSelect;
export type InsertClaimCommunication = typeof claimCommunicationsTable.$inferInsert;
