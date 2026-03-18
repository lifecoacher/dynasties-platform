import { pgTable, text, real, numeric, integer, jsonb, timestamp, index, boolean } from "drizzle-orm/pg-core";
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
      .references(() => shipmentsTable.id),
    customerBillingProfileId: text("customer_billing_profile_id"),
    invoiceNumber: text("invoice_number").notNull().unique(),
    status: text("status", {
      enum: ["DRAFT", "ISSUED", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE", "DISPUTED", "CANCELLED", "FINANCED"],
    }).notNull(),
    billToEntityId: text("bill_to_entity_id"),
    billToName: text("bill_to_name"),
    billToEmail: text("bill_to_email"),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
    discountTotal: numeric("discount_total", { precision: 12, scale: 2 }).notNull().default("0"),
    taxTotal: numeric("tax_total", { precision: 12, scale: 2 }).notNull().default("0"),
    financeFee: numeric("finance_fee", { precision: 12, scale: 2 }).notNull().default("0"),
    dynastiesSpread: numeric("dynasties_spread", { precision: 12, scale: 2 }).notNull().default("0"),
    grandTotal: numeric("grand_total", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("USD"),
    lineItems: jsonb("line_items").notNull(),
    paymentTerms: text("payment_terms", {
      enum: ["DUE_ON_RECEIPT", "NET_15", "NET_30", "NET_60", "NET_90"],
    }),
    financeEligible: boolean("finance_eligible").notNull().default(false),
    financeStatus: text("finance_status", {
      enum: ["NONE", "OFFERED", "ACCEPTED", "REQUESTED", "APPROVED", "FUNDED", "DECLINED", "REPAID"],
    }).notNull().default("NONE"),
    paymentMethod: text("payment_method", {
      enum: ["PAY_NOW", "PAY_LATER", "FINANCED", "PENDING"],
    }),
    dueDate: timestamp("due_date"),
    issuedAt: timestamp("issued_at"),
    sentAt: timestamp("sent_at"),
    paidAt: timestamp("paid_at"),
    pdfStorageKey: text("pdf_storage_key"),
    invoiceSource: text("invoice_source", {
      enum: ["MANUAL", "SHIPMENT", "WORKFLOW", "AUTO_RULE"],
    }).notNull().default("MANUAL"),
    notes: text("notes"),
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
    index("invoices_customer_bp_idx").on(table.customerBillingProfileId),
    index("invoices_due_date_idx").on(table.dueDate),
  ],
);

export type Invoice = typeof invoicesTable.$inferSelect;
export type InsertInvoice = typeof invoicesTable.$inferInsert;
