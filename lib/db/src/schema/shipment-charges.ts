import { pgTable, text, real, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
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
    unitPrice: real("unit_price").notNull(),
    currency: text("currency").notNull().default("USD"),
    totalAmount: real("total_amount").notNull(),
    taxRate: real("tax_rate").default(0),
    taxAmount: real("tax_amount").default(0),
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
