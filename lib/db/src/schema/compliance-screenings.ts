import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { shipmentsTable } from "./shipments";

export const complianceScreeningsTable = pgTable(
  "compliance_screenings",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipmentsTable.id),
    status: text("status", {
      enum: ["CLEAR", "ALERT", "BLOCKED"],
    }).notNull(),
    screenedParties: integer("screened_parties").notNull(),
    matchCount: integer("match_count").notNull().default(0),
    matches: jsonb("matches")
      .notNull()
      .$type<
        Array<{
          listName: string;
          matchedEntry: string;
          similarity: number;
          matchType: string;
          recommendation: string;
        }>
      >()
      .default([]),
    listsChecked: jsonb("lists_checked")
      .notNull()
      .$type<string[]>()
      .default([]),
    screenedAt: timestamp("screened_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("compliance_screenings_company_id_idx").on(table.companyId),
    index("compliance_screenings_shipment_id_idx").on(table.shipmentId),
    index("compliance_screenings_status_idx").on(table.status),
  ],
);

export type ComplianceScreening =
  typeof complianceScreeningsTable.$inferSelect;
export type InsertComplianceScreening =
  typeof complianceScreeningsTable.$inferInsert;
