import {
  pgTable,
  text,
  timestamp,
  real,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { shipmentsTable } from "./shipments";

export const shipmentDecisionsTable = pgTable(
  "shipment_decisions",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipmentsTable.id),
    finalStatus: text("final_status", {
      enum: ["APPROVED", "BLOCKED", "REJECTED", "REVIEW"],
    }).notNull(),
    releaseAllowed: boolean("release_allowed").notNull(),
    decisionReason: text("decision_reason").notNull(),
    baseRiskScore: real("base_risk_score"),
    dynamicRiskScore: real("dynamic_risk_score"),
    finalRiskScore: real("final_risk_score"),
    complianceStatus: text("compliance_status"),
    docValidationStatus: text("doc_validation_status"),
    readinessScore: real("readiness_score"),
    shipmentStatus: text("shipment_status"),
    inputSnapshot: jsonb("input_snapshot")
      .notNull()
      .$type<{
        complianceStatus: string | null;
        complianceMatchCount: number;
        docValidationStatus: string | null;
        docReadinessLevel: string | null;
        baseRiskScore: number | null;
        baseRiskLevel: string | null;
        dynamicRiskScore: number | null;
        dynamicRiskLevel: string | null;
        readinessScore: number | null;
        shipmentStatus: string;
        gateHoldsCount: number;
        activeHolds: string[];
      }>(),
    decidedAt: timestamp("decided_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("shipment_decisions_company_id_idx").on(table.companyId),
    uniqueIndex("shipment_decisions_shipment_id_uniq").on(table.shipmentId),
    index("shipment_decisions_final_status_idx").on(table.finalStatus),
    index("shipment_decisions_decided_at_idx").on(table.decidedAt),
  ],
);

export type ShipmentDecision =
  typeof shipmentDecisionsTable.$inferSelect;
export type InsertShipmentDecision =
  typeof shipmentDecisionsTable.$inferInsert;
