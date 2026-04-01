import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  real,
  integer,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { shipmentsTable } from "./shipments";

export const shipmentAiStateTable = pgTable(
  "shipment_ai_state",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipmentsTable.id),
    analysisStatus: text("analysis_status", {
      enum: ["PENDING", "ANALYZING", "CURRENT", "STALE", "FAILED"],
    })
      .notNull()
      .default("PENDING"),
    analysisVersion: integer("analysis_version").notNull().default(1),
    lastAnalyzedAt: timestamp("last_analyzed_at"),
    lastTriggerEvent: text("last_trigger_event"),
    lastTriggerSource: text("last_trigger_source"),
    lastAnalysisRunId: text("last_analysis_run_id"),
    riskScore: real("risk_score"),
    complianceRisk: real("compliance_risk"),
    marginRisk: real("margin_risk"),
    operationalReadiness: real("operational_readiness"),
    confidenceScore: real("confidence_score"),
    recommendedActionsSummary: jsonb("recommended_actions_summary").$type<string[]>(),
    explanationSnapshot: text("explanation_snapshot"),
    activeIssuesSummary: jsonb("active_issues_summary").$type<
      Array<{ type: string; severity: string; description: string }>
    >(),
    activeRecommendationCount: integer("active_recommendation_count")
      .notNull()
      .default(0),
    usedDeterministicFallback: boolean("used_deterministic_fallback")
      .notNull()
      .default(false),
    isStale: boolean("is_stale").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("shipment_ai_state_shipment_uniq").on(table.shipmentId),
    index("shipment_ai_state_company_idx").on(table.companyId),
    index("shipment_ai_state_status_idx").on(table.analysisStatus),
    index("shipment_ai_state_risk_idx").on(table.riskScore),
  ],
);

export type ShipmentAiState = typeof shipmentAiStateTable.$inferSelect;
export type InsertShipmentAiState = typeof shipmentAiStateTable.$inferInsert;

export const shipmentAiAnalysisRunsTable = pgTable(
  "shipment_ai_analysis_runs",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipmentsTable.id),
    triggerType: text("trigger_type", {
      enum: [
        "SHIPMENT_CREATED",
        "SHIPMENT_UPDATED",
        "DOCUMENT_UPLOADED",
        "DOCUMENT_VALIDATED",
        "DOCUMENT_GENERATED",
        "EXCEPTION_CREATED",
        "EXCEPTION_RESOLVED",
        "PRICING_UPDATED",
        "INSURANCE_UPDATED",
        "COMPLIANCE_UPDATED",
        "RISK_UPDATED",
        "BILLING_CHANGED",
        "INTELLIGENCE_UPDATED",
        "RECOMMENDATION_RESPONDED",
        "MANUAL",
      ],
    }).notNull(),
    triggerSourceEntityId: text("trigger_source_entity_id"),
    triggerSourceEntityType: text("trigger_source_entity_type"),
    status: text("status", {
      enum: ["STARTED", "COMPLETED", "FAILED"],
    }).notNull(),
    analysisVersion: integer("analysis_version").notNull(),
    inputSnapshotMeta: jsonb("input_snapshot_meta").$type<{
      riskScore: number | null;
      complianceStatus: string | null;
      insuranceCoverage: string | null;
      intelligenceComposite: number | null;
      signalCount: number;
      exceptionCount: number;
      chargeTotal: number | null;
    }>(),
    outputSummary: jsonb("output_summary").$type<{
      riskScore: number | null;
      complianceRisk: number | null;
      marginRisk: number | null;
      operationalReadiness: number | null;
      confidenceScore: number | null;
      recommendationsCreated: number;
      recommendationsSuperseded: number;
      recommendationsDeduplicated: number;
      tasksCreated: number;
      tasksUpdated: number;
    }>(),
    modelUsed: text("model_used"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    latencyMs: integer("latency_ms"),
    usedFallback: boolean("used_fallback").notNull().default(false),
    errorMessage: text("error_message"),
    beforeState: jsonb("before_state").$type<{
      riskScore: number | null;
      analysisVersion: number;
      activeRecommendationCount: number;
    }>(),
    afterState: jsonb("after_state").$type<{
      riskScore: number | null;
      analysisVersion: number;
      activeRecommendationCount: number;
    }>(),
    startedAt: timestamp("started_at").notNull(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("ai_analysis_runs_company_idx").on(table.companyId),
    index("ai_analysis_runs_shipment_idx").on(table.shipmentId),
    index("ai_analysis_runs_trigger_idx").on(table.triggerType),
    index("ai_analysis_runs_status_idx").on(table.status),
    index("ai_analysis_runs_created_idx").on(table.createdAt),
  ],
);

export type ShipmentAiAnalysisRun =
  typeof shipmentAiAnalysisRunsTable.$inferSelect;
export type InsertShipmentAiAnalysisRun =
  typeof shipmentAiAnalysisRunsTable.$inferInsert;

export const aiEventLogTable = pgTable(
  "ai_event_log",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    shipmentId: text("shipment_id").references(() => shipmentsTable.id),
    eventType: text("event_type", {
      enum: [
        "AI_REANALYSIS_REQUESTED",
        "AI_REANALYSIS_STARTED",
        "AI_REANALYSIS_COMPLETED",
        "AI_REANALYSIS_FAILED",
        "AI_RECOMMENDATIONS_UPDATED",
        "AI_TASKS_SYNCED",
        "AI_STATE_CREATED",
        "AI_STATE_UPDATED",
        "AI_FALLBACK_USED",
        "AI_RECOMMENDATION_RESPONDED",
      ],
    }).notNull(),
    analysisRunId: text("analysis_run_id"),
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("ai_event_log_company_idx").on(table.companyId),
    index("ai_event_log_shipment_idx").on(table.shipmentId),
    index("ai_event_log_event_type_idx").on(table.eventType),
    index("ai_event_log_created_idx").on(table.createdAt),
  ],
);

export type AiEventLog = typeof aiEventLogTable.$inferSelect;
export type InsertAiEventLog = typeof aiEventLogTable.$inferInsert;

export const AI_TRIGGER_TYPES = [
  "SHIPMENT_CREATED",
  "SHIPMENT_UPDATED",
  "DOCUMENT_UPLOADED",
  "DOCUMENT_VALIDATED",
  "DOCUMENT_GENERATED",
  "EXCEPTION_CREATED",
  "EXCEPTION_RESOLVED",
  "PRICING_UPDATED",
  "INSURANCE_UPDATED",
  "COMPLIANCE_UPDATED",
  "RISK_UPDATED",
  "BILLING_CHANGED",
  "INTELLIGENCE_UPDATED",
  "RECOMMENDATION_RESPONDED",
  "MANUAL",
] as const;

export type AiTriggerType = (typeof AI_TRIGGER_TYPES)[number];
