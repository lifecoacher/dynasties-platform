import { pgTable, text, timestamp, jsonb, index, real, integer, boolean } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { shipmentsTable } from "./shipments";

export const bookingDecisionsTable = pgTable(
  "booking_decisions",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipmentsTable.id),
    status: text("status", {
      enum: ["APPROVED", "APPROVED_WITH_CAUTION", "REQUIRES_REVIEW", "BLOCKED", "RECOMMEND_ALTERNATIVE"],
    }).notNull(),
    confidence: real("confidence").notNull(),
    overallRiskScore: real("overall_risk_score").notNull(),
    readinessScore: real("readiness_score").notNull(),
    reasonCodes: jsonb("reason_codes").$type<string[]>().notNull(),
    requiredActions: jsonb("required_actions").$type<string[]>().notNull(),
    recommendedAlternatives: jsonb("recommended_alternatives").$type<Array<{
      type: string;
      description: string;
      estimatedRiskReduction: number;
    }>>(),
    inputScores: jsonb("input_scores").$type<{
      laneStress: number;
      portCongestion: number;
      disruptionRisk: number;
      weatherExposure: number;
      carrierReliability: number;
      entityCompliance: number;
    }>().notNull(),
    decidedAt: timestamp("decided_at").notNull().defaultNow(),
    decidedBy: text("decided_by"),
    overriddenBy: text("overridden_by"),
    overrideReason: text("override_reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("bd_company_id_idx").on(table.companyId),
    index("bd_shipment_id_idx").on(table.shipmentId),
    index("bd_status_idx").on(table.status),
  ],
);

export const releaseGateHoldsTable = pgTable(
  "release_gate_holds",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipmentsTable.id),
    gateType: text("gate_type", {
      enum: [
        "COMPLIANCE_BLOCK",
        "READINESS_REVIEW",
        "DISRUPTION_APPROVAL",
        "DOCUMENT_HOLD",
        "LANE_STRESS_HOLD",
        "WEATHER_HOLD",
        "MANAGER_APPROVAL",
      ],
    }).notNull(),
    status: text("status", {
      enum: ["ACTIVE", "RELEASED", "OVERRIDDEN", "EXPIRED"],
    })
      .notNull()
      .default("ACTIVE"),
    severity: text("severity", {
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    }).notNull(),
    reason: text("reason").notNull(),
    policyRule: text("policy_rule").notNull(),
    requiredAction: text("required_action").notNull(),
    resolvedBy: text("resolved_by"),
    resolvedAt: timestamp("resolved_at"),
    resolutionNotes: text("resolution_notes"),
    triggerData: jsonb("trigger_data").$type<Record<string, unknown>>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("rgh_company_id_idx").on(table.companyId),
    index("rgh_shipment_id_idx").on(table.shipmentId),
    index("rgh_gate_type_idx").on(table.gateType),
    index("rgh_status_idx").on(table.status),
  ],
);

export const mitigationPlaybooksTable = pgTable(
  "mitigation_playbooks",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipmentsTable.id),
    triggerCondition: text("trigger_condition").notNull(),
    triggerSource: text("trigger_source", {
      enum: ["RISK_EVALUATION", "ALERT", "GATE_HOLD", "BOOKING_DECISION", "MANUAL"],
    }).notNull(),
    status: text("status", {
      enum: ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
    })
      .notNull()
      .default("PENDING"),
    steps: jsonb("steps").$type<Array<{
      stepId: string;
      type: string;
      title: string;
      description: string;
      status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
      linkedRecommendationId?: string;
      linkedTaskId?: string;
      completedAt?: string;
    }>>().notNull(),
    totalSteps: integer("total_steps").notNull(),
    completedSteps: integer("completed_steps").notNull().default(0),
    priority: text("priority", {
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("mp_company_id_idx").on(table.companyId),
    index("mp_shipment_id_idx").on(table.shipmentId),
    index("mp_status_idx").on(table.status),
  ],
);

export const scenarioComparisonsTable = pgTable(
  "scenario_comparisons",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipmentsTable.id),
    baselineScenario: jsonb("baseline_scenario").$type<{
      label: string;
      riskScore: number;
      readinessScore: number;
      estimatedCost: number | null;
      estimatedTransitDays: number | null;
      details: Record<string, unknown>;
    }>().notNull(),
    alternativeScenarios: jsonb("alternative_scenarios").$type<Array<{
      scenarioType: string;
      label: string;
      riskScore: number;
      readinessScore: number;
      estimatedCost: number | null;
      estimatedTransitDays: number | null;
      riskDelta: number;
      costDelta: number | null;
      transitDelta: number | null;
      recommendation: string;
      details: Record<string, unknown>;
    }>>().notNull(),
    bestAlternative: text("best_alternative"),
    computedAt: timestamp("computed_at").notNull().defaultNow(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("sc_company_id_idx").on(table.companyId),
    index("sc_shipment_id_idx").on(table.shipmentId),
  ],
);

export type BookingDecision = typeof bookingDecisionsTable.$inferSelect;
export type ReleaseGateHold = typeof releaseGateHoldsTable.$inferSelect;
export type MitigationPlaybook = typeof mitigationPlaybooksTable.$inferSelect;
export type ScenarioComparison = typeof scenarioComparisonsTable.$inferSelect;
