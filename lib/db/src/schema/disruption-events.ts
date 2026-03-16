import { pgTable, text, timestamp, jsonb, index, real } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const disruptionEventsTable = pgTable(
  "disruption_events",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").references(() => companiesTable.id),
    sourceId: text("source_id").notNull(),
    eventType: text("event_type", {
      enum: [
        "port_closure",
        "canal_blockage",
        "labor_strike",
        "geopolitical",
        "natural_disaster",
        "piracy",
        "regulatory_change",
        "infrastructure_failure",
      ],
    }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    severity: text("severity", {
      enum: ["low", "medium", "high", "critical"],
    }).notNull(),
    status: text("status", {
      enum: ["active", "monitoring", "resolved", "expired"],
    }).notNull().default("active"),
    affectedRegion: text("affected_region"),
    affectedPorts: jsonb("affected_ports").$type<string[]>(),
    affectedLanes: jsonb("affected_lanes").$type<string[]>(),
    estimatedImpactDays: real("estimated_impact_days"),
    confidence: real("confidence"),
    startDate: timestamp("start_date").notNull(),
    expectedEndDate: timestamp("expected_end_date"),
    resolvedDate: timestamp("resolved_date"),
    fingerprint: text("fingerprint").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("de_company_id_idx").on(table.companyId),
    index("de_event_type_idx").on(table.eventType),
    index("de_severity_idx").on(table.severity),
    index("de_status_idx").on(table.status),
    index("de_fingerprint_idx").on(table.fingerprint),
    index("de_start_date_idx").on(table.startDate),
  ],
);

export const weatherRiskEventsTable = pgTable(
  "weather_risk_events",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").references(() => companiesTable.id),
    sourceId: text("source_id").notNull(),
    eventType: text("event_type", {
      enum: ["typhoon", "hurricane", "storm", "fog", "ice", "monsoon", "flooding", "extreme_heat"],
    }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    severity: text("severity", {
      enum: ["low", "medium", "high", "critical"],
    }).notNull(),
    status: text("status", {
      enum: ["forecast", "active", "passing", "resolved"],
    }).notNull().default("forecast"),
    affectedRegion: text("affected_region"),
    affectedPorts: jsonb("affected_ports").$type<string[]>(),
    latitude: real("latitude"),
    longitude: real("longitude"),
    radiusKm: real("radius_km"),
    windSpeedKnots: real("wind_speed_knots"),
    confidence: real("confidence"),
    forecastDate: timestamp("forecast_date").notNull(),
    expectedStartDate: timestamp("expected_start_date"),
    expectedEndDate: timestamp("expected_end_date"),
    fingerprint: text("fingerprint").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("wre_company_id_idx").on(table.companyId),
    index("wre_event_type_idx").on(table.eventType),
    index("wre_severity_idx").on(table.severity),
    index("wre_status_idx").on(table.status),
    index("wre_fingerprint_idx").on(table.fingerprint),
  ],
);

export type DisruptionEvent = typeof disruptionEventsTable.$inferSelect;
export type InsertDisruptionEvent = typeof disruptionEventsTable.$inferInsert;
export type WeatherRiskEvent = typeof weatherRiskEventsTable.$inferSelect;
export type InsertWeatherRiskEvent = typeof weatherRiskEventsTable.$inferInsert;
