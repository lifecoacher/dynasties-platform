import { pgTable, text, real, numeric, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const rateTablesTable = pgTable(
  "rate_tables",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    carrier: text("carrier").notNull(),
    origin: text("origin").notNull(),
    destination: text("destination").notNull(),
    containerType: text("container_type"),
    chargeCode: text("charge_code").notNull(),
    description: text("description").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("USD"),
    validFrom: timestamp("valid_from"),
    validTo: timestamp("valid_to"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("rate_tables_company_id_idx").on(table.companyId),
    index("rate_tables_carrier_idx").on(table.carrier),
    index("rate_tables_origin_dest_idx").on(table.origin, table.destination),
  ],
);
