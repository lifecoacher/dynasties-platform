import { pgTable, text, timestamp, jsonb, index, real, integer, boolean } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { usersTable } from "./users";

export const tenantPoliciesTable = pgTable(
  "tenant_policies",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    policyKey: text("policy_key").notNull(),
    policyValue: jsonb("policy_value").$type<Record<string, unknown>>().notNull(),
    description: text("description"),
    category: text("category", {
      enum: [
        "RECOMMENDATION_THRESHOLDS",
        "BOOKING_GATE_THRESHOLDS",
        "SLA_RULES",
        "AUTO_TASK_RULES",
        "ESCALATION_TIMINGS",
        "INTELLIGENCE_WEIGHTING",
        "RISK_TOLERANCES",
        "STRATEGIC_SENSITIVITY",
        "OPERATING_MODE",
      ],
    }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    version: integer("version").notNull().default(1),
    updatedBy: text("updated_by").references(() => usersTable.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("tp_company_id_idx").on(table.companyId),
    index("tp_policy_key_idx").on(table.policyKey),
    index("tp_category_idx").on(table.category),
    index("tp_company_key_idx").on(table.companyId, table.policyKey),
  ],
);

export const policyVersionsTable = pgTable(
  "policy_versions",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    policyId: text("policy_id")
      .notNull()
      .references(() => tenantPoliciesTable.id),
    policyKey: text("policy_key").notNull(),
    previousValue: jsonb("previous_value").$type<Record<string, unknown>>(),
    newValue: jsonb("new_value").$type<Record<string, unknown>>().notNull(),
    version: integer("version").notNull(),
    changedBy: text("changed_by")
      .notNull()
      .references(() => usersTable.id),
    changeReason: text("change_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("pv_company_id_idx").on(table.companyId),
    index("pv_policy_id_idx").on(table.policyId),
    index("pv_created_at_idx").on(table.createdAt),
  ],
);

export const operatingModesTable = pgTable(
  "operating_modes",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    modeName: text("mode_name", {
      enum: [
        "ADVISORY",
        "APPROVAL_HEAVY",
        "SEMI_AUTONOMOUS",
        "HIGH_COMPLIANCE",
        "MARGIN_PROTECTION",
        "DISRUPTION_SENSITIVE",
        "CUSTOM",
      ],
    }).notNull(),
    isActive: boolean("is_active").notNull().default(false),
    policyOverrides: jsonb("policy_overrides").$type<Record<string, Record<string, unknown>>>().notNull(),
    description: text("description"),
    activatedBy: text("activated_by").references(() => usersTable.id),
    activatedAt: timestamp("activated_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("om_company_id_idx").on(table.companyId),
    index("om_mode_name_idx").on(table.modeName),
    index("om_is_active_idx").on(table.isActive),
  ],
);

export const reportSnapshotsTable = pgTable(
  "report_snapshots",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    reportType: text("report_type", {
      enum: [
        "EXECUTIVE_SUMMARY",
        "PORTFOLIO_RISK",
        "LANE_STRATEGY",
        "CARRIER_ALLOCATION",
        "VALUE_ATTRIBUTION",
        "RECOMMENDATION_PERFORMANCE",
      ],
    }).notNull(),
    title: text("title").notNull(),
    reportData: jsonb("report_data").$type<Record<string, unknown>>().notNull(),
    format: text("format", {
      enum: ["JSON", "CSV"],
    }).notNull().default("JSON"),
    generatedBy: text("generated_by").references(() => usersTable.id),
    periodStart: timestamp("period_start"),
    periodEnd: timestamp("period_end"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("rs_company_id_idx").on(table.companyId),
    index("rs_report_type_idx").on(table.reportType),
    index("rs_created_at_idx").on(table.createdAt),
  ],
);

export const policySimulationsTable = pgTable(
  "policy_simulations",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    simulationName: text("simulation_name").notNull(),
    policyChanges: jsonb("policy_changes").$type<Record<string, Record<string, unknown>>>().notNull(),
    baselineSummary: jsonb("baseline_summary").$type<Record<string, unknown>>().notNull(),
    simulatedSummary: jsonb("simulated_summary").$type<Record<string, unknown>>().notNull(),
    impactAnalysis: jsonb("impact_analysis").$type<Record<string, unknown>>().notNull(),
    simulatedBy: text("simulated_by")
      .notNull()
      .references(() => usersTable.id),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("ps_company_id_idx").on(table.companyId),
    index("ps_created_at_idx").on(table.createdAt),
  ],
);

export type TenantPolicy = typeof tenantPoliciesTable.$inferSelect;
export type InsertTenantPolicy = typeof tenantPoliciesTable.$inferInsert;
export type PolicyVersion = typeof policyVersionsTable.$inferSelect;
export type OperatingMode = typeof operatingModesTable.$inferSelect;
export type ReportSnapshot = typeof reportSnapshotsTable.$inferSelect;
export type PolicySimulation = typeof policySimulationsTable.$inferSelect;
