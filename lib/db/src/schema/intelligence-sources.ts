import { pgTable, text, timestamp, jsonb, index, integer } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const intelligenceSourcesTable = pgTable(
  "intelligence_sources",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").references(() => companiesTable.id),
    sourceName: text("source_name").notNull(),
    sourceType: text("source_type", {
      enum: [
        "vessel_positions",
        "port_congestion",
        "sanctions",
        "denied_parties",
        "disruptions",
        "weather_risk",
        "lane_market_signals",
      ],
    }).notNull(),
    providerName: text("provider_name").notNull(),
    ingestionMethod: text("ingestion_method", {
      enum: ["api_poll", "webhook", "file_import", "streaming"],
    }).notNull(),
    scheduleExpression: text("schedule_expression"),
    authConfig: jsonb("auth_config").$type<Record<string, unknown>>(),
    sourceStatus: text("source_status", {
      enum: ["active", "paused", "error", "disabled"],
    }).notNull().default("active"),
    lastSyncedAt: timestamp("last_synced_at"),
    lastSuccessAt: timestamp("last_success_at"),
    lastFailureAt: timestamp("last_failure_at"),
    failureCount: integer("failure_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("is_company_id_idx").on(table.companyId),
    index("is_source_type_idx").on(table.sourceType),
    index("is_status_idx").on(table.sourceStatus),
  ],
);

export type IntelligenceSource = typeof intelligenceSourcesTable.$inferSelect;
export type InsertIntelligenceSource = typeof intelligenceSourcesTable.$inferInsert;
