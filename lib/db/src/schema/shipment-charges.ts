import { pgTable, text, real, numeric, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { shipmentsTable } from "./shipments";

export const shipmentChargesTable = pgTable(
  "shipment_charges",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipmentsTable.id),
    chargeCode: text("charge_code").notNull(),
    description: text("description").notNull(),
    chargeType: text("charge_type", {
      enum: ["FREIGHT", "ORIGIN", "DESTINATION", "DOCUMENTATION", "INSURANCE", "CUSTOMS", "SURCHARGE", "OTHER"],
    }).notNull(),
    quantity: real("quantity").notNull().default(1),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("USD"),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    taxRate: numeric("tax_rate", { precision: 5, scale: 4 }).default("0"),
    taxAmount: numeric("tax_amount", { precision: 12, scale: 2 }).default("0"),
    source: text("source", {
      enum: ["RATE_TABLE", "RULE_ENGINE", "AGENT", "MANUAL"],
    }).notNull(),
    rateTableId: text("rate_table_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("shipment_charges_company_id_idx").on(table.companyId),
    index("shipment_charges_shipment_id_idx").on(table.shipmentId),
  ],
);
