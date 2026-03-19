import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { shipmentsTable } from "./shipments";

export const generatedDocTypeEnum = pgEnum("generated_doc_type", [
  "COMMERCIAL_INVOICE",
  "PACKING_LIST",
  "BILL_OF_LADING",
  "CUSTOMS_DECLARATION",
  "SHIPMENT_SUMMARY",
]);

export const generatedDocStatusEnum = pgEnum("generated_doc_status", [
  "DRAFT",
  "GENERATED",
  "BLOCKED",
  "SUPERSEDED",
]);

export const generatedDocumentsTable = pgTable(
  "shipment_documents_generated",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipmentsTable.id),
    invoiceId: text("invoice_id"),
    documentType: generatedDocTypeEnum("document_type").notNull(),
    versionNumber: integer("version_number").notNull().default(1),
    generationStatus: generatedDocStatusEnum("generation_status").notNull().default("GENERATED"),
    sourceSnapshot: jsonb("source_snapshot").notNull(),
    validationSnapshot: jsonb("validation_snapshot"),
    htmlContent: text("html_content"),
    storageKey: text("storage_key"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    supersededBy: text("superseded_by"),
  },
  (table) => [
    index("gen_docs_company_id_idx").on(table.companyId),
    index("gen_docs_shipment_id_idx").on(table.shipmentId),
    index("gen_docs_doc_type_idx").on(table.documentType),
    index("gen_docs_status_idx").on(table.generationStatus),
    index("gen_docs_shipment_type_idx").on(table.shipmentId, table.documentType),
  ],
);

export type GeneratedDocument = typeof generatedDocumentsTable.$inferSelect;
export type InsertGeneratedDocument = typeof generatedDocumentsTable.$inferInsert;

export const GENERATED_DOC_TYPES = [
  "COMMERCIAL_INVOICE",
  "PACKING_LIST",
  "BILL_OF_LADING",
  "CUSTOMS_DECLARATION",
  "SHIPMENT_SUMMARY",
] as const;

export type GeneratedDocType = (typeof GENERATED_DOC_TYPES)[number];

export const DOC_TYPE_LABELS: Record<GeneratedDocType, string> = {
  COMMERCIAL_INVOICE: "Commercial Invoice",
  PACKING_LIST: "Packing List",
  BILL_OF_LADING: "Bill of Lading (Draft)",
  CUSTOMS_DECLARATION: "Customs Declaration",
  SHIPMENT_SUMMARY: "Shipment Summary",
};
