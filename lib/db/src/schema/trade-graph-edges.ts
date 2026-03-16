import { pgTable, text, timestamp, jsonb, index, integer, real } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const tradeGraphEdgesTable = pgTable(
  "trade_graph_edges",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    edgeType: text("edge_type", {
      enum: [
        "SHIPPER_USES_CARRIER",
        "SHIPPER_SHIPS_TO_CONSIGNEE",
        "SHIPMENT_ROUTED_VIA_PORT",
        "SHIPMENT_ON_TRADE_LANE",
        "COMMODITY_ON_LANE",
        "SHIPMENT_INSURED_BY",
        "CLAIM_ON_SHIPMENT",
        "CARRIER_PERFORMANCE_ON_LANE",
        "EXCEPTION_WITH_CARRIER",
        "EXCEPTION_AT_PORT",
        "FORWARDER_HANDLES_LANE",
        "VESSEL_OPERATES_LANE",
        "VESSEL_AT_PORT",
        "PORT_CONGESTION_SNAPSHOT",
        "LANE_DISRUPTION",
        "LANE_WEATHER_RISK",
        "LANE_MARKET_SIGNAL",
        "ENTITY_SANCTIONS_MATCH",
        "ENTITY_DENIED_PARTY_MATCH",
        "SHIPMENT_VESSEL_TRACKING",
      ],
    }).notNull(),
    sourceType: text("source_type", {
      enum: ["SHIPMENT", "ENTITY", "PORT", "TRADE_LANE", "COMMODITY", "CLAIM", "EXCEPTION", "VESSEL", "DISRUPTION", "WEATHER", "SANCTIONS", "MARKET_SIGNAL", "CONGESTION"],
    }).notNull(),
    sourceId: text("source_id").notNull(),
    targetType: text("target_type", {
      enum: ["SHIPMENT", "ENTITY", "PORT", "TRADE_LANE", "COMMODITY", "CLAIM", "EXCEPTION", "VESSEL", "DISRUPTION", "WEATHER", "SANCTIONS", "MARKET_SIGNAL", "CONGESTION"],
    }).notNull(),
    targetId: text("target_id").notNull(),
    weight: real("weight").default(1.0),
    occurrenceCount: integer("occurrence_count").notNull().default(1),
    confidence: real("confidence"),
    firstSeen: timestamp("first_seen").notNull().defaultNow(),
    lastSeen: timestamp("last_seen").notNull().defaultNow(),
    sourceMetadata: text("source_metadata"),
    properties: jsonb("properties").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("tge_company_id_idx").on(table.companyId),
    index("tge_edge_type_idx").on(table.edgeType),
    index("tge_source_idx").on(table.sourceType, table.sourceId),
    index("tge_target_idx").on(table.targetType, table.targetId),
    index("tge_last_seen_idx").on(table.lastSeen),
  ],
);

export type TradeGraphEdge = typeof tradeGraphEdgesTable.$inferSelect;
export type InsertTradeGraphEdge = typeof tradeGraphEdgesTable.$inferInsert;
