import {
  pgTable,
  text,
  timestamp,
  numeric,
  real,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { entitiesTable } from "./entities";
import { shipmentsTable } from "./shipments";

export const QUOTE_STATUSES = [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "EXPIRED",
  "CONVERTED",
  "REJECTED",
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_CHARGE_TYPES = [
  "FREIGHT",
  "FUEL_SURCHARGE",
  "CUSTOMS",
  "DOCUMENTATION",
  "STORAGE",
  "INSURANCE",
  "HANDLING",
  "PORT_CHARGES",
  "INSPECTION",
  "OTHER",
] as const;

export type QuoteChargeType = (typeof QUOTE_CHARGE_TYPES)[number];

export const quotesTable = pgTable(
  "quotes",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    customerId: text("customer_id").references(() => entitiesTable.id),
    quoteNumber: text("quote_number").notNull(),
    version: integer("version").notNull().default(1),
    status: text("status", {
      enum: [...QUOTE_STATUSES],
    }).notNull().default("DRAFT"),
    origin: text("origin"),
    destination: text("destination"),
    portOfLoading: text("port_of_loading"),
    portOfDischarge: text("port_of_discharge"),
    incoterms: text("incoterms"),
    cargoSummary: text("cargo_summary"),
    commodity: text("commodity"),
    hsCode: text("hs_code"),
    quantity: integer("quantity"),
    packageCount: integer("package_count"),
    grossWeight: real("gross_weight"),
    weightUnit: text("weight_unit", { enum: ["KG", "LB"] }),
    volume: real("volume"),
    volumeUnit: text("volume_unit", { enum: ["CBM", "CFT"] }),
    currency: text("currency").notNull().default("USD"),
    quotedAmount: numeric("quoted_amount", { precision: 12, scale: 2 }),
    pricingSnapshot: jsonb("pricing_snapshot"),
    validUntil: timestamp("valid_until"),
    notes: text("notes"),
    convertedShipmentId: text("converted_shipment_id").references(() => shipmentsTable.id),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("quotes_company_id_idx").on(table.companyId),
    index("quotes_customer_id_idx").on(table.customerId),
    index("quotes_status_idx").on(table.status),
    index("quotes_created_at_idx").on(table.createdAt),
    uniqueIndex("quotes_company_quote_number_idx").on(table.companyId, table.quoteNumber),
  ],
);

export type Quote = typeof quotesTable.$inferSelect;
export type InsertQuote = typeof quotesTable.$inferInsert;

export const quoteLineItemsTable = pgTable(
  "quote_line_items",
  {
    id: text("id").primaryKey(),
    quoteId: text("quote_id")
      .notNull()
      .references(() => quotesTable.id, { onDelete: "cascade" }),
    chargeType: text("charge_type", {
      enum: [...QUOTE_CHARGE_TYPES],
    }).notNull(),
    description: text("description").notNull(),
    quantity: real("quantity").notNull().default(1),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("USD"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("quote_line_items_quote_id_idx").on(table.quoteId),
  ],
);

export type QuoteLineItem = typeof quoteLineItemsTable.$inferSelect;
export type InsertQuoteLineItem = typeof quoteLineItemsTable.$inferInsert;
