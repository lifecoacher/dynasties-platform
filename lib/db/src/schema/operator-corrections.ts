import {
  pgTable,
  text,
  timestamp,
  real,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { shipmentsTable } from "./shipments";

export const operatorCorrectionsTable = pgTable(
  "operator_corrections",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipmentsTable.id),
    fieldName: text("field_name").notNull(),
    originalValue: jsonb("original_value"),
    correctedValue: jsonb("corrected_value"),
    originalConfidence: real("original_confidence"),
    correctedBy: text("corrected_by").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("operator_corrections_company_id_idx").on(table.companyId),
    index("operator_corrections_shipment_id_idx").on(table.shipmentId),
  ],
);

export type OperatorCorrection =
  typeof operatorCorrectionsTable.$inferSelect;
export type InsertOperatorCorrection =
  typeof operatorCorrectionsTable.$inferInsert;
