import { pgTable, text, timestamp, jsonb, index, real, integer } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const laneStrategiesTable = pgTable(
  "lane_strategies",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    originPort: text("origin_port").notNull(),
    destinationPort: text("destination_port").notNull(),
    strategy: text("strategy", {
      enum: [
        "STABLE",
        "MONITOR_CLOSELY",
        "REDUCE_EXPOSURE",
        "REROUTE_CONDITIONAL",
        "REPRICE_LANE",
        "TIGHTEN_GATES",
      ],
    }).notNull(),
    confidence: real("confidence").notNull(),
    stressScore: real("stress_score").notNull(),
    delayExposure: real("delay_exposure").notNull(),
    disruptionFrequency: real("disruption_frequency").notNull(),
    congestionTrend: real("congestion_trend").notNull(),
    recommendationVolume: integer("recommendation_volume").notNull().default(0),
    taskVolume: integer("task_volume").notNull().default(0),
    exceptionCount: integer("exception_count").notNull().default(0),
    marginPressure: real("margin_pressure").notNull().default(0),
    shipmentCount: integer("shipment_count").notNull().default(0),
    factors: jsonb("factors").$type<Array<{
      dimension: string;
      score: number;
      weight: number;
      detail: string;
    }>>().notNull(),
    suggestedActions: jsonb("suggested_actions").$type<string[]>().notNull(),
    computedAt: timestamp("computed_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("ls_company_idx").on(table.companyId),
    index("ls_origin_idx").on(table.originPort),
    index("ls_dest_idx").on(table.destinationPort),
    index("ls_strategy_idx").on(table.strategy),
  ],
);

export const carrierAllocationsTable = pgTable(
  "carrier_allocations",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    carrierName: text("carrier_name").notNull(),
    lane: text("lane"),
    allocation: text("allocation", {
      enum: [
        "PREFERRED",
        "ACCEPTABLE_MONITOR",
        "AVOID_CURRENT_CONDITIONS",
        "INCREASE_ALLOCATION",
        "REDUCE_ALLOCATION",
      ],
    }).notNull(),
    confidence: real("confidence").notNull(),
    reliabilityScore: real("reliability_score").notNull(),
    recommendationTriggerRate: real("recommendation_trigger_rate").notNull().default(0),
    switchAwayRate: real("switch_away_rate").notNull().default(0),
    disruptionExposure: real("disruption_exposure").notNull().default(0),
    lanePerformance: real("lane_performance").notNull().default(0),
    riskAdjustedScore: real("risk_adjusted_score").notNull(),
    shipmentCount: integer("shipment_count").notNull().default(0),
    factors: jsonb("factors").$type<Array<{
      dimension: string;
      score: number;
      weight: number;
      detail: string;
    }>>().notNull(),
    suggestedActions: jsonb("suggested_actions").$type<string[]>().notNull(),
    computedAt: timestamp("computed_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("ca_company_idx").on(table.companyId),
    index("ca_carrier_idx").on(table.carrierName),
    index("ca_allocation_idx").on(table.allocation),
  ],
);

export const networkRecommendationsTable = pgTable(
  "network_recommendations",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    scope: text("scope", {
      enum: ["LANE", "CARRIER", "PORT", "ENTITY"],
    }).notNull(),
    scopeIdentifier: text("scope_identifier").notNull(),
    type: text("type", {
      enum: [
        "REDUCE_PORT_TRAFFIC",
        "SHIFT_CARRIER_VOLUME",
        "TIGHTEN_RELEASE_GATES",
        "INCREASE_INSURANCE",
        "PRE_EMPTIVE_MONITORING",
        "REPRICE_LANE",
        "DIVERSIFY_ROUTING",
        "ESCALATE_COMPLIANCE",
      ],
    }).notNull(),
    priority: text("priority", {
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
    }).notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    evidence: jsonb("evidence").$type<Array<{
      signal: string;
      value: number | string;
      threshold: number | string;
      source: string;
    }>>().notNull(),
    suggestedAction: text("suggested_action").notNull(),
    estimatedImpact: jsonb("estimated_impact").$type<{
      riskReduction: number | null;
      costImpact: number | null;
      delayReduction: number | null;
    }>(),
    status: text("status", {
      enum: ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "IMPLEMENTED", "DISMISSED"],
    }).notNull().default("OPEN"),
    acknowledgedBy: text("acknowledged_by"),
    acknowledgedAt: timestamp("acknowledged_at"),
    fingerprint: text("fingerprint").notNull(),
    computedAt: timestamp("computed_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("nr_company_idx").on(table.companyId),
    index("nr_scope_idx").on(table.scope),
    index("nr_type_idx").on(table.type),
    index("nr_status_idx").on(table.status),
    index("nr_fingerprint_idx").on(table.fingerprint),
  ],
);

export const portfolioSnapshotsTable = pgTable(
  "portfolio_snapshots",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    period: text("period", {
      enum: ["DAILY", "WEEKLY", "MONTHLY"],
    }).notNull(),
    totalShipments: integer("total_shipments").notNull(),
    activeShipments: integer("active_shipments").notNull(),
    riskDistribution: jsonb("risk_distribution").$type<{
      low: number;
      medium: number;
      high: number;
      critical: number;
    }>().notNull(),
    delayExposure: real("delay_exposure").notNull(),
    complianceExposure: real("compliance_exposure").notNull(),
    marginAtRisk: real("margin_at_risk").notNull(),
    mitigatedExposure: real("mitigated_exposure").notNull(),
    unmitigatedExposure: real("unmitigated_exposure").notNull(),
    exposureByLane: jsonb("exposure_by_lane").$type<Array<{
      lane: string;
      exposure: number;
      shipmentCount: number;
    }>>(),
    exposureByCarrier: jsonb("exposure_by_carrier").$type<Array<{
      carrier: string;
      exposure: number;
      shipmentCount: number;
    }>>(),
    exposureByPort: jsonb("exposure_by_port").$type<Array<{
      port: string;
      exposure: number;
      shipmentCount: number;
    }>>(),
    trends: jsonb("trends").$type<{
      riskTrend: "improving" | "stable" | "worsening";
      delayTrend: "improving" | "stable" | "worsening";
      complianceTrend: "improving" | "stable" | "worsening";
    }>(),
    snapshotAt: timestamp("snapshot_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("ps_company_idx").on(table.companyId),
    index("ps_period_idx").on(table.period),
    index("ps_snapshot_idx").on(table.snapshotAt),
  ],
);

export const interventionAttributionsTable = pgTable(
  "intervention_attributions",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    period: text("period", {
      enum: ["DAILY", "WEEKLY", "MONTHLY"],
    }).notNull(),
    delaysAvoided: integer("delays_avoided").notNull().default(0),
    estimatedDaysSaved: real("estimated_days_saved").notNull().default(0),
    marginProtected: real("margin_protected").notNull().default(0),
    risksMitigated: integer("risks_mitigated").notNull().default(0),
    interventionsTriggered: integer("interventions_triggered").notNull().default(0),
    interventionsCompleted: integer("interventions_completed").notNull().default(0),
    tasksAutoCreated: integer("tasks_auto_created").notNull().default(0),
    bookingHoldsPreventedIssues: integer("booking_holds_prevented_issues").notNull().default(0),
    recommendationsAccepted: integer("recommendations_accepted").notNull().default(0),
    recommendationsTotal: integer("recommendations_total").notNull().default(0),
    intelligenceEnrichedImpact: real("intelligence_enriched_impact").notNull().default(0),
    internalOnlyImpact: real("internal_only_impact").notNull().default(0),
    attributionDetails: jsonb("attribution_details").$type<Array<{
      category: string;
      metric: string;
      value: number;
      methodology: string;
    }>>().notNull(),
    computedAt: timestamp("computed_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("ia_company_idx").on(table.companyId),
    index("ia_period_idx").on(table.period),
    index("ia_computed_idx").on(table.computedAt),
  ],
);
