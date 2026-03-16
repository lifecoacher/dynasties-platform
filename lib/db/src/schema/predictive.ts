import { pgTable, text, timestamp, jsonb, index, real, integer, boolean } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { shipmentsTable } from "./shipments";

export const preShipmentRiskReportsTable = pgTable(
  "pre_shipment_risk_reports",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipmentsTable.id),
    overallRiskScore: real("overall_risk_score").notNull(),
    laneStressScore: real("lane_stress_score").notNull().default(0),
    portCongestionScore: real("port_congestion_score").notNull().default(0),
    disruptionRiskScore: real("disruption_risk_score").notNull().default(0),
    weatherExposureScore: real("weather_exposure_score").notNull().default(0),
    carrierReliabilityScore: real("carrier_reliability_score").notNull().default(0),
    entityComplianceScore: real("entity_compliance_score").notNull().default(0),
    riskLevel: text("risk_level", {
      enum: ["LOW", "MODERATE", "HIGH", "CRITICAL"],
    }).notNull(),
    mitigations: jsonb("mitigations").$type<string[]>().notNull(),
    componentDetails: jsonb("component_details").$type<Record<string, unknown>>(),
    readinessScore: real("readiness_score"),
    readinessComponents: jsonb("readiness_components").$type<Record<string, unknown>>(),
    evaluatedAt: timestamp("evaluated_at").notNull().defaultNow(),
    shipmentEtd: timestamp("shipment_etd"),
    daysUntilDeparture: integer("days_until_departure"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("psr_company_id_idx").on(table.companyId),
    index("psr_shipment_id_idx").on(table.shipmentId),
    index("psr_risk_level_idx").on(table.riskLevel),
    index("psr_overall_risk_idx").on(table.overallRiskScore),
  ],
);

export const predictiveAlertsTable = pgTable(
  "predictive_alerts",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    alertType: text("alert_type", {
      enum: [
        "CONGESTION_TREND",
        "DISRUPTION_CLUSTER",
        "WEATHER_FORECAST",
        "CARRIER_DEGRADATION",
        "LANE_STRESS_RISING",
        "PORT_RISK_ESCALATION",
      ],
    }).notNull(),
    severity: text("severity", {
      enum: ["INFO", "WARNING", "CRITICAL"],
    }).notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    affectedPorts: jsonb("affected_ports").$type<string[]>(),
    affectedLanes: jsonb("affected_lanes").$type<string[]>(),
    affectedShipmentIds: jsonb("affected_shipment_ids").$type<string[]>(),
    trendData: jsonb("trend_data").$type<Record<string, unknown>>(),
    confidenceScore: real("confidence_score").notNull().default(0),
    predictedImpactDays: real("predicted_impact_days"),
    status: text("status", {
      enum: ["ACTIVE", "ACKNOWLEDGED", "RESOLVED", "EXPIRED"],
    })
      .notNull()
      .default("ACTIVE"),
    expiresAt: timestamp("expires_at"),
    resolvedAt: timestamp("resolved_at"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("pa_company_id_idx").on(table.companyId),
    index("pa_alert_type_idx").on(table.alertType),
    index("pa_severity_idx").on(table.severity),
    index("pa_status_idx").on(table.status),
  ],
);

export const historicalPatternsTable = pgTable(
  "historical_patterns",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    patternType: text("pattern_type", {
      enum: [
        "LANE_DELAY_AVG",
        "PORT_DISRUPTION_FREQ",
        "CARRIER_PERFORMANCE",
        "ENTITY_COMPLIANCE_INCIDENTS",
        "CONGESTION_TREND",
        "WEATHER_SEASONALITY",
      ],
    }).notNull(),
    subjectKey: text("subject_key").notNull(),
    subjectName: text("subject_name"),
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),
    sampleCount: integer("sample_count").notNull().default(0),
    avgValue: real("avg_value").notNull().default(0),
    minValue: real("min_value"),
    maxValue: real("max_value"),
    trendDirection: text("trend_direction", {
      enum: ["RISING", "STABLE", "FALLING"],
    }),
    trendStrength: real("trend_strength"),
    patternData: jsonb("pattern_data").$type<Record<string, unknown>>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    computedAt: timestamp("computed_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("hp_company_id_idx").on(table.companyId),
    index("hp_pattern_type_idx").on(table.patternType),
    index("hp_subject_key_idx").on(table.subjectKey),
  ],
);

export type PreShipmentRiskReport = typeof preShipmentRiskReportsTable.$inferSelect;
export type PredictiveAlert = typeof predictiveAlertsTable.$inferSelect;
export type HistoricalPattern = typeof historicalPatternsTable.$inferSelect;
