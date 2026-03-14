import { pgTable, text, real, numeric, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { shipmentsTable } from "./shipments";

export const invoicesTable = pgTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipmentsTable.id),
    invoiceNumber: text("invoice_number").notNull().unique(),
    status: text("status", {
      enum: ["DRAFT", "ISSUED", "SENT", "PAID", "CANCELLED", "OVERDUE"],
    }).notNull(),
    billToEntityId: text("bill_to_entity_id"),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    taxTotal: numeric("tax_total", { precision: 12, scale: 2 }).notNull().default("0"),
    grandTotal: numeric("grand_total", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("USD"),
    lineItems: jsonb("line_items").notNull(),
    dueDate: timestamp("due_date"),
    issuedAt: timestamp("issued_at"),
    pdfStorageKey: text("pdf_storage_key"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("invoices_company_id_idx").on(table.companyId),
    index("invoices_shipment_id_idx").on(table.shipmentId),
    index("invoices_invoice_number_idx").on(table.invoiceNumber),
    index("invoices_status_idx").on(table.status),
  ],
);
