import {
  pgTable,
  text,
  timestamp,
  real,
  numeric,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { shipmentsTable } from "./shipments";

export const insuranceQuotesTable = pgTable(
  "insurance_quotes",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipmentsTable.id),
    coverageType: text("coverage_type", {
      enum: ["ALL_RISK", "NAMED_PERILS", "TOTAL_LOSS"],
    }).notNull(),
    estimatedInsuredValue: numeric("estimated_insured_value", { precision: 12, scale: 2 }).notNull(),
    estimatedPremium: numeric("estimated_premium", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("USD"),
    coverageRationale: text("coverage_rationale").notNull(),
    exclusions: jsonb("exclusions")
      .notNull()
      .$type<string[]>()
      .default([]),
    confidenceScore: real("confidence_score").notNull(),
    quotedAt: timestamp("quoted_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("insurance_quotes_company_id_idx").on(table.companyId),
    uniqueIndex("insurance_quotes_shipment_id_uniq").on(table.shipmentId),
  ],
);

export type InsuranceQuote = typeof insuranceQuotesTable.$inferSelect;
export type InsertInsuranceQuote = typeof insuranceQuotesTable.$inferInsert;
