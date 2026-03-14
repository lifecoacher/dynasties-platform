import {
  pgTable,
  text,
  timestamp,
  real,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { ingestedEmailsTable } from "./ingested-emails";

export const ingestedDocumentsTable = pgTable(
  "ingested_documents",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    emailId: text("email_id").references(() => ingestedEmailsTable.id),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    documentType: text("document_type", {
      enum: [
        "BOL",
        "COMMERCIAL_INVOICE",
        "PACKING_LIST",
        "CERTIFICATE_OF_ORIGIN",
        "ARRIVAL_NOTICE",
        "CUSTOMS_DECLARATION",
        "RATE_CONFIRMATION",
        "HBL",
        "SHIPMENT_SUMMARY",
        "INVOICE",
        "UNKNOWN",
      ],
    }).notNull(),
    documentTypeConfidence: real("document_type_confidence"),
    s3Key: text("s3_key").notNull(),
    extractedData: jsonb("extracted_data"),
    extractionStatus: text("extraction_status", {
      enum: ["PENDING", "PROCESSING", "EXTRACTED", "FAILED"],
    }).notNull(),
    extractionError: text("extraction_error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("ingested_documents_company_id_idx").on(table.companyId),
    index("ingested_documents_email_id_idx").on(table.emailId),
    index("ingested_documents_status_idx").on(table.extractionStatus),
    index("ingested_documents_type_idx").on(table.documentType),
  ],
);

export type IngestedDocument = typeof ingestedDocumentsTable.$inferSelect;
export type InsertIngestedDocument = typeof ingestedDocumentsTable.$inferInsert;
