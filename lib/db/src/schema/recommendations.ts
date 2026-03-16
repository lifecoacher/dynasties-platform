import { pgTable, text, timestamp, jsonb, index, real, integer } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { shipmentsTable } from "./shipments";

export const recommendationsTable = pgTable(
  "recommendations",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipmentsTable.id),
    fingerprint: text("fingerprint"),
    type: text("type", {
      enum: [
        "CARRIER_SWITCH",
        "ROUTE_ADJUSTMENT",
        "INSURANCE_ADJUSTMENT",
        "COMPLIANCE_ESCALATION",
        "DELAY_WARNING",
        "MARGIN_WARNING",
        "DOCUMENT_CORRECTION",
        "RISK_MITIGATION",
        "PRICING_ALERT",
      ],
    }).notNull(),
    title: text("title").notNull(),
    explanation: text("explanation").notNull(),
    reasonCodes: jsonb("reason_codes").$type<string[]>().notNull(),
    confidence: real("confidence").notNull(),
    urgency: text("urgency", {
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    }).notNull(),
    expectedDelayImpactDays: real("expected_delay_impact_days"),
    expectedMarginImpactPct: real("expected_margin_impact_pct"),
    expectedRiskReduction: real("expected_risk_reduction"),
    recommendedAction: text("recommended_action").notNull(),
    status: text("status", {
      enum: ["PENDING", "SHOWN", "ACCEPTED", "MODIFIED", "REJECTED", "IMPLEMENTED", "EXPIRED", "SUPERSEDED"],
    })
      .notNull()
      .default("PENDING"),
    sourceAgent: text("source_agent").notNull(),
    externalReasonCodes: jsonb("external_reason_codes").$type<string[]>(),
    signalEvidence: jsonb("signal_evidence").$type<Record<string, unknown>[]>(),
    intelligenceEnriched: text("intelligence_enriched").default("false"),
    sourceData: jsonb("source_data").$type<Record<string, unknown>>(),
    supersededById: text("superseded_by_id"),
    expiresAt: timestamp("expires_at"),
    respondedAt: timestamp("responded_at"),
    respondedBy: text("responded_by"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("recommendations_company_id_idx").on(table.companyId),
    index("recommendations_shipment_id_idx").on(table.shipmentId),
    index("recommendations_type_idx").on(table.type),
    index("recommendations_status_idx").on(table.status),
    index("recommendations_urgency_idx").on(table.urgency),
    index("recommendations_created_at_idx").on(table.createdAt),
    index("recommendations_fingerprint_idx").on(table.fingerprint),
  ],
);

export type Recommendation = typeof recommendationsTable.$inferSelect;
export type InsertRecommendation = typeof recommendationsTable.$inferInsert;
