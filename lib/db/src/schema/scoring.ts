import { pgTable, text, timestamp, jsonb, index, real } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const laneScoresTable = pgTable(
  "lane_scores",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").references(() => companiesTable.id),
    originPort: text("origin_port").notNull(),
    destinationPort: text("destination_port").notNull(),
    congestionScore: real("congestion_score").notNull().default(0),
    disruptionScore: real("disruption_score").notNull().default(0),
    delayStressScore: real("delay_stress_score").notNull().default(0),
    marketPressureScore: real("market_pressure_score").notNull().default(0),
    compositeStressScore: real("composite_stress_score").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("lane_scores_company_id_idx").on(table.companyId),
    index("lane_scores_origin_dest_idx").on(table.originPort, table.destinationPort),
    index("lane_scores_composite_idx").on(table.compositeStressScore),
  ],
);

export const portScoresTable = pgTable(
  "port_scores",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").references(() => companiesTable.id),
    portCode: text("port_code").notNull(),
    portName: text("port_name"),
    congestionSeverity: real("congestion_severity").notNull().default(0),
    weatherExposure: real("weather_exposure").notNull().default(0),
    disruptionExposure: real("disruption_exposure").notNull().default(0),
    operationalVolatility: real("operational_volatility").notNull().default(0),
    compositeScore: real("composite_score").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("port_scores_company_id_idx").on(table.companyId),
    index("port_scores_port_code_idx").on(table.portCode),
    index("port_scores_composite_idx").on(table.compositeScore),
  ],
);

export const carrierScoresTable = pgTable(
  "carrier_scores",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").references(() => companiesTable.id),
    carrierName: text("carrier_name").notNull(),
    performanceScore: real("performance_score").notNull().default(0),
    anomalyScore: real("anomaly_score").notNull().default(0),
    reliabilityScore: real("reliability_score").notNull().default(0),
    laneStressExposure: real("lane_stress_exposure").notNull().default(0),
    compositeScore: real("composite_score").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("carrier_scores_company_id_idx").on(table.companyId),
    index("carrier_scores_carrier_name_idx").on(table.carrierName),
    index("carrier_scores_composite_idx").on(table.compositeScore),
  ],
);

export const entityScoresTable = pgTable(
  "entity_scores",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").references(() => companiesTable.id),
    entityId: text("entity_id").notNull(),
    entityName: text("entity_name").notNull(),
    sanctionsRiskScore: real("sanctions_risk_score").notNull().default(0),
    deniedPartyConfidence: real("denied_party_confidence").notNull().default(0),
    documentationIrregularity: real("documentation_irregularity").notNull().default(0),
    compositeScore: real("composite_score").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("entity_scores_company_id_idx").on(table.companyId),
    index("entity_scores_entity_id_idx").on(table.entityId),
    index("entity_scores_composite_idx").on(table.compositeScore),
  ],
);

export type LaneScore = typeof laneScoresTable.$inferSelect;
export type PortScore = typeof portScoresTable.$inferSelect;
export type CarrierScore = typeof carrierScoresTable.$inferSelect;
export type EntityScore = typeof entityScoresTable.$inferSelect;
