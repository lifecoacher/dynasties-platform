import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { shipmentsTable } from "./shipments";

export const routingPricingResultsTable = pgTable(
  "routing_pricing_results",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipmentsTable.id),
    recommendedRouteIndex: text("recommended_route_index").notNull().default("0"),
    routeOptions: jsonb("route_options")
      .notNull()
      .$type<
        Array<{
          label: string;
          type: "DIRECT" | "TRANSSHIPMENT" | "ALTERNATIVE";
          legs: Array<{
            from: string;
            to: string;
            mode: string;
            transitDays: number;
          }>;
          totalTransitDays: number;
          estimatedCost: number;
          costRange: { low: number; high: number };
          currency: string;
          costBreakdown: Array<{
            code: string;
            label: string;
            amount: number;
          }>;
          costConfidence: "HIGH" | "MEDIUM" | "LOW";
          advantages: string[];
          disadvantages: string[];
        }>
      >()
      .default([]),
    riskFactors: jsonb("risk_factors")
      .notNull()
      .$type<
        Array<{
          code: string;
          title: string;
          severity: "LOW" | "MEDIUM" | "HIGH";
          detail: string;
        }>
      >()
      .default([]),
    recommendationSummary: text("recommendation_summary"),
    reasoning: text("reasoning"),
    analyzedAt: timestamp("analyzed_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("routing_pricing_results_company_id_idx").on(table.companyId),
    uniqueIndex("routing_pricing_results_shipment_id_uniq").on(table.shipmentId),
    index("routing_pricing_results_analyzed_at_idx").on(table.analyzedAt),
  ],
);

export type RoutingPricingResult =
  typeof routingPricingResultsTable.$inferSelect;
export type InsertRoutingPricingResult =
  typeof routingPricingResultsTable.$inferInsert;
