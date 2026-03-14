import { pgTable, text, timestamp, jsonb, index, real, numeric, integer } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const tradeLaneStatsTable = pgTable(
  "trade_lane_stats",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    origin: text("origin").notNull(),
    destination: text("destination").notNull(),
    carrier: text("carrier"),
    shipmentCount: integer("shipment_count").notNull().default(0),
    avgCost: numeric("avg_cost", { precision: 12, scale: 2 }),
    minCost: numeric("min_cost", { precision: 12, scale: 2 }),
    maxCost: numeric("max_cost", { precision: 12, scale: 2 }),
    avgTransitDays: real("avg_transit_days"),
    delayCount: integer("delay_count").notNull().default(0),
    delayFrequency: real("delay_frequency"),
    avgDocumentCount: real("avg_document_count"),
    documentComplexity: text("document_complexity", {
      enum: ["LOW", "MEDIUM", "HIGH"],
    }),
    carrierPerformanceScore: real("carrier_performance_score"),
    agentAdvisory: jsonb("agent_advisory"),
    lastUpdated: timestamp("last_updated").notNull().defaultNow(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("trade_lane_stats_company_id_idx").on(table.companyId),
    index("trade_lane_stats_origin_dest_idx").on(table.origin, table.destination),
    index("trade_lane_stats_carrier_idx").on(table.carrier),
  ],
);

export type TradeLaneStat = typeof tradeLaneStatsTable.$inferSelect;
export type InsertTradeLaneStat = typeof tradeLaneStatsTable.$inferInsert;
