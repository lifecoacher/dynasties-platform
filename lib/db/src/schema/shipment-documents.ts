import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { shipmentsTable } from "./shipments";
import { ingestedDocumentsTable } from "./ingested-documents";

export const shipmentDocumentsTable = pgTable(
  "shipment_documents",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipmentsTable.id),
    documentId: text("document_id").references(
      () => ingestedDocumentsTable.id,
    ),
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
    s3Key: text("s3_key"),
    isGenerated: boolean("is_generated").notNull().default(false),
    generatedAt: timestamp("generated_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("shipment_documents_company_id_idx").on(table.companyId),
    index("shipment_documents_shipment_id_idx").on(table.shipmentId),
    index("shipment_documents_type_idx").on(table.documentType),
  ],
);

export type ShipmentDocument = typeof shipmentDocumentsTable.$inferSelect;
export type InsertShipmentDocument =
  typeof shipmentDocumentsTable.$inferInsert;
