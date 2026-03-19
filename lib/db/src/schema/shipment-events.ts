import {
  pgTable,
  text,
  timestamp,
  jsonb,
  boolean,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { shipmentsTable } from "./shipments";

export const shipmentEventTypeEnum = pgEnum("shipment_event_type", [
  "SHIPMENT_CREATED",
  "BOOKING_CONFIRMED",
  "PICKED_UP",
  "DEPARTED_ORIGIN",
  "ARRIVED_TRANSSHIPMENT",
  "DEPARTED_TRANSSHIPMENT",
  "ARRIVED_DESTINATION",
  "CUSTOMS_HOLD",
  "CUSTOMS_RELEASED",
  "DELAYED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "UNKNOWN",
]);

export const shipmentEventSourceEnum = pgEnum("shipment_event_source", [
  "IMPORT",
  "MANUAL",
  "API",
  "SYSTEM",
]);

export const shipmentEventsTable = pgTable(
  "shipment_events",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipmentsTable.id),
    eventType: shipmentEventTypeEnum("event_type").notNull(),
    eventTimestamp: timestamp("event_timestamp").notNull(),
    location: text("location"),
    source: shipmentEventSourceEnum("source").notNull(),
    rawPayload: jsonb("raw_payload"),
    normalizedData: jsonb("normalized_data"),
    isCriticalEvent: boolean("is_critical_event").notNull().default(false),
    requiresAttention: boolean("requires_attention").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("shipment_events_company_id_idx").on(table.companyId),
    index("shipment_events_shipment_id_idx").on(table.shipmentId),
    index("shipment_events_event_type_idx").on(table.eventType),
    index("shipment_events_event_timestamp_idx").on(table.eventTimestamp),
    uniqueIndex("shipment_events_dedup_idx").on(
      table.shipmentId,
      table.eventType,
      table.eventTimestamp,
    ),
  ],
);

export type ShipmentEvent = typeof shipmentEventsTable.$inferSelect;
export type InsertShipmentEvent = typeof shipmentEventsTable.$inferInsert;

export const SHIPMENT_EVENT_TYPES = [
  "SHIPMENT_CREATED",
  "BOOKING_CONFIRMED",
  "PICKED_UP",
  "DEPARTED_ORIGIN",
  "ARRIVED_TRANSSHIPMENT",
  "DEPARTED_TRANSSHIPMENT",
  "ARRIVED_DESTINATION",
  "CUSTOMS_HOLD",
  "CUSTOMS_RELEASED",
  "DELAYED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "UNKNOWN",
] as const;

export type ShipmentEventType = (typeof SHIPMENT_EVENT_TYPES)[number];

export const CRITICAL_EVENT_TYPES: ShipmentEventType[] = [
  "CUSTOMS_HOLD",
  "DELAYED",
];

export const EVENT_TYPE_LABELS: Record<ShipmentEventType, string> = {
  SHIPMENT_CREATED: "Shipment Created",
  BOOKING_CONFIRMED: "Booking Confirmed",
  PICKED_UP: "Picked Up",
  DEPARTED_ORIGIN: "Departed Origin",
  ARRIVED_TRANSSHIPMENT: "Arrived at Transshipment",
  DEPARTED_TRANSSHIPMENT: "Departed Transshipment",
  ARRIVED_DESTINATION: "Arrived at Destination",
  CUSTOMS_HOLD: "Customs Hold",
  CUSTOMS_RELEASED: "Customs Released",
  DELAYED: "Delayed",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  UNKNOWN: "Unknown Event",
};

export const EVENT_STATUS_MAP: Record<string, string> = {
  DELIVERED: "DELIVERED",
  OUT_FOR_DELIVERY: "IN_TRANSIT",
  CUSTOMS_RELEASED: "CUSTOMS",
  CUSTOMS_HOLD: "CUSTOMS",
  ARRIVED_DESTINATION: "AT_PORT",
  DEPARTED_TRANSSHIPMENT: "IN_TRANSIT",
  ARRIVED_TRANSSHIPMENT: "IN_TRANSIT",
  DEPARTED_ORIGIN: "IN_TRANSIT",
  PICKED_UP: "IN_TRANSIT",
  BOOKING_CONFIRMED: "BOOKED",
  SHIPMENT_CREATED: "DRAFT",
};
