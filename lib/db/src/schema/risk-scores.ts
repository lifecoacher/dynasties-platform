import {
  pgTable,
  text,
  timestamp,
  real,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { shipmentsTable } from "./shipments";

export const riskScoresTable = pgTable(
  "risk_scores",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipmentsTable.id),
    compositeScore: real("composite_score").notNull(),
    subScores: jsonb("sub_scores")
      .notNull()
      .$type<{
        cargoType: number;
        tradeLane: number;
        counterparty: number;
        routeGeopolitical: number;
        seasonal: number;
        documentCompleteness: number;
      }>(),
    primaryRiskFactors: jsonb("primary_risk_factors")
      .notNull()
      .$type<Array<{ factor: string; explanation: string }>>()
      .default([]),
    recommendedAction: text("recommended_action", {
      enum: ["AUTO_APPROVE", "OPERATOR_REVIEW", "ESCALATE"],
    }).notNull(),
    scoredAt: timestamp("scored_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("risk_scores_company_id_idx").on(table.companyId),
    uniqueIndex("risk_scores_shipment_id_uniq").on(table.shipmentId),
  ],
);

export type RiskScore = typeof riskScoresTable.$inferSelect;
export type InsertRiskScore = typeof riskScoresTable.$inferInsert;
