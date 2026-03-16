import { pgTable, text, timestamp, jsonb, index, real, integer } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { shipmentsTable } from "./shipments";

export const shipmentIntelligenceSnapshotsTable = pgTable(
  "shipment_intelligence_snapshots",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipmentsTable.id),
    congestionScore: real("congestion_score").notNull().default(0),
    disruptionScore: real("disruption_score").notNull().default(0),
    weatherRiskScore: real("weather_risk_score").notNull().default(0),
    sanctionsRiskScore: real("sanctions_risk_score").notNull().default(0),
    vesselRiskScore: real("vessel_risk_score").notNull().default(0),
    marketPressureScore: real("market_pressure_score").notNull().default(0),
    compositeIntelScore: real("composite_intel_score").notNull().default(0),
    linkedSignalIds: jsonb("linked_signal_ids").$type<string[]>().notNull(),
    externalReasonCodes: jsonb("external_reason_codes").$type<string[]>().notNull(),
    evidenceSummary: jsonb("evidence_summary").$type<Record<string, unknown>[]>().notNull(),
    snapshotHash: text("snapshot_hash").notNull(),
    generatedAt: timestamp("generated_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("intel_snapshots_company_id_idx").on(table.companyId),
    index("intel_snapshots_shipment_id_idx").on(table.shipmentId),
    index("intel_snapshots_hash_idx").on(table.snapshotHash),
    index("intel_snapshots_generated_at_idx").on(table.generatedAt),
  ],
);

export type ShipmentIntelligenceSnapshot = typeof shipmentIntelligenceSnapshotsTable.$inferSelect;
