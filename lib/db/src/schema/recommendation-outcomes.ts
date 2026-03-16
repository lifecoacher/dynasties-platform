import { pgTable, text, timestamp, jsonb, index, real, numeric } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { recommendationsTable } from "./recommendations";
import { shipmentsTable } from "./shipments";

export const recommendationOutcomesTable = pgTable(
  "recommendation_outcomes",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    recommendationId: text("recommendation_id")
      .notNull()
      .references(() => recommendationsTable.id),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipmentsTable.id),
    action: text("action", {
      enum: ["ACCEPTED", "MODIFIED", "REJECTED", "IMPLEMENTED", "IGNORED"],
    }).notNull(),
    modificationNotes: text("modification_notes"),
    actorId: text("actor_id").notNull(),
    actorType: text("actor_type", {
      enum: ["USER", "SYSTEM", "AGENT"],
    }).notNull(),
    actualDelayDays: real("actual_delay_days"),
    actualClaimOccurred: text("actual_claim_occurred", {
      enum: ["YES", "NO", "PENDING"],
    }),
    actualCostDelta: numeric("actual_cost_delta", { precision: 12, scale: 2 }),
    actualMarginDelta: numeric("actual_margin_delta", { precision: 12, scale: 2 }),
    postDecisionNotes: text("post_decision_notes"),
    outcomeEvaluation: text("outcome_evaluation", {
      enum: ["POSITIVE", "NEUTRAL", "NEGATIVE", "PENDING"],
    }).default("PENDING"),
    outcomeData: jsonb("outcome_data").$type<Record<string, unknown>>(),
    decidedAt: timestamp("decided_at").notNull().defaultNow(),
    evaluatedAt: timestamp("evaluated_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("rec_outcomes_company_id_idx").on(table.companyId),
    index("rec_outcomes_recommendation_id_idx").on(table.recommendationId),
    index("rec_outcomes_shipment_id_idx").on(table.shipmentId),
    index("rec_outcomes_action_idx").on(table.action),
    index("rec_outcomes_evaluation_idx").on(table.outcomeEvaluation),
  ],
);

export type RecommendationOutcome = typeof recommendationOutcomesTable.$inferSelect;
export type InsertRecommendationOutcome = typeof recommendationOutcomesTable.$inferInsert;
