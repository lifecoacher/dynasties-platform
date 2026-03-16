import { pgTable, text, timestamp, real, index, integer } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const vesselPositionsTable = pgTable(
  "vessel_positions",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").references(() => companiesTable.id),
    sourceId: text("source_id").notNull(),
    vesselName: text("vessel_name").notNull(),
    imo: text("imo"),
    mmsi: text("mmsi"),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    heading: real("heading"),
    speed: real("speed"),
    status: text("status", {
      enum: ["underway", "anchored", "moored", "at_berth", "drifting", "unknown"],
    }).notNull().default("unknown"),
    destination: text("destination"),
    eta: timestamp("eta"),
    fingerprint: text("fingerprint").notNull(),
    positionTimestamp: timestamp("position_timestamp").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("vp_company_id_idx").on(table.companyId),
    index("vp_imo_idx").on(table.imo),
    index("vp_mmsi_idx").on(table.mmsi),
    index("vp_vessel_name_idx").on(table.vesselName),
    index("vp_fingerprint_idx").on(table.fingerprint),
    index("vp_position_ts_idx").on(table.positionTimestamp),
  ],
);

export const vesselPortCallsTable = pgTable(
  "vessel_port_calls",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").references(() => companiesTable.id),
    sourceId: text("source_id").notNull(),
    vesselName: text("vessel_name").notNull(),
    imo: text("imo"),
    portCode: text("port_code").notNull(),
    portName: text("port_name").notNull(),
    callType: text("call_type", {
      enum: ["arrival", "departure", "in_port"],
    }).notNull(),
    arrivalTime: timestamp("arrival_time"),
    departureTime: timestamp("departure_time"),
    berthDurationHours: real("berth_duration_hours"),
    fingerprint: text("fingerprint").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("vpc_company_id_idx").on(table.companyId),
    index("vpc_imo_idx").on(table.imo),
    index("vpc_port_code_idx").on(table.portCode),
    index("vpc_fingerprint_idx").on(table.fingerprint),
  ],
);

export type VesselPosition = typeof vesselPositionsTable.$inferSelect;
export type InsertVesselPosition = typeof vesselPositionsTable.$inferInsert;
export type VesselPortCall = typeof vesselPortCallsTable.$inferSelect;
export type InsertVesselPortCall = typeof vesselPortCallsTable.$inferInsert;
