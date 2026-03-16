import { pgTable, text, timestamp, real, index, jsonb } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const laneMarketSignalsTable = pgTable(
  "lane_market_signals",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").references(() => companiesTable.id),
    sourceId: text("source_id").notNull(),
    originPort: text("origin_port").notNull(),
    destinationPort: text("destination_port").notNull(),
    laneId: text("lane_id").notNull(),
    signalType: text("signal_type", {
      enum: ["rate_change", "capacity_shift", "demand_surge", "volume_drop", "transit_time_change"],
    }).notNull(),
    direction: text("direction", {
      enum: ["up", "down", "stable"],
    }).notNull(),
    magnitude: real("magnitude"),
    currentRate: real("current_rate"),
    previousRate: real("previous_rate"),
    rateUnit: text("rate_unit"),
    avgTransitDays: real("avg_transit_days"),
    capacityUtilization: real("capacity_utilization"),
    confidence: real("confidence"),
    fingerprint: text("fingerprint").notNull(),
    signalTimestamp: timestamp("signal_timestamp").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("lms_company_id_idx").on(table.companyId),
    index("lms_lane_id_idx").on(table.laneId),
    index("lms_signal_type_idx").on(table.signalType),
    index("lms_fingerprint_idx").on(table.fingerprint),
    index("lms_signal_ts_idx").on(table.signalTimestamp),
  ],
);

export type LaneMarketSignal = typeof laneMarketSignalsTable.$inferSelect;
export type InsertLaneMarketSignal = typeof laneMarketSignalsTable.$inferInsert;
