import { db } from "@workspace/db";
import {
  shipmentEventsTable,
  shipmentsTable,
  eventsTable,
  CRITICAL_EVENT_TYPES,
  type ShipmentEventType,
  type InsertShipmentEvent,
} from "@workspace/db/schema";
import { generateId } from "@workspace/shared-utils";
import { eq, and, asc } from "drizzle-orm";
import { classifyEvent, classifyByHeuristics } from "./classifier.js";
import { updateShipmentStatusFromEvents, computeShipmentStatus } from "./status-engine.js";

export { classifyEvent, classifyByHeuristics } from "./classifier.js";
export { computeShipmentStatus, updateShipmentStatusFromEvents } from "./status-engine.js";

export interface RawEventInput {
  description?: string;
  eventType?: string;
  timestamp: string;
  location?: string;
  source: "IMPORT" | "MANUAL" | "API" | "SYSTEM";
  rawPayload?: Record<string, any>;
}

export interface IngestResult {
  eventId: string;
  eventType: ShipmentEventType;
  confidence: number;
  derivedStatus: string;
  isDuplicate: boolean;
}

export async function ingestEvent(
  companyId: string,
  shipmentId: string,
  input: RawEventInput,
): Promise<IngestResult> {
  const [shipment] = await db
    .select({ id: shipmentsTable.id })
    .from(shipmentsTable)
    .where(
      and(eq(shipmentsTable.id, shipmentId), eq(shipmentsTable.companyId, companyId)),
    )
    .limit(1);

  if (!shipment) throw new Error("Shipment not found");

  const eventTimestamp = parseTimestamp(input.timestamp);
  if (!eventTimestamp) throw new Error("Invalid timestamp");

  let eventType: ShipmentEventType;
  let confidence: number;

  if (input.eventType && isValidEventType(input.eventType)) {
    eventType = input.eventType as ShipmentEventType;
    confidence = 1.0;
  } else if (input.description) {
    const classification = await classifyEvent({
      description: input.description,
      timestamp: input.timestamp,
      location: input.location,
    });
    eventType = classification.eventType;
    confidence = classification.confidence;
  } else {
    eventType = "UNKNOWN";
    confidence = 0;
  }

  const isCritical = CRITICAL_EVENT_TYPES.includes(eventType);
  const eventId = generateId("sev");

  try {
    await db.insert(shipmentEventsTable).values({
      id: eventId,
      companyId,
      shipmentId,
      eventType,
      eventTimestamp,
      location: input.location || null,
      source: input.source,
      rawPayload: input.rawPayload || { description: input.description },
      normalizedData: {
        originalDescription: input.description,
        classifiedType: eventType,
        confidence,
      },
      isCriticalEvent: isCritical,
      requiresAttention: isCritical,
    });
  } catch (err: any) {
    const msg = err.message || "";
    const causeCode = err.cause?.code;
    const causeMsg = err.cause?.message || "";
    if (msg.includes("duplicate key") || msg.includes("unique constraint") || msg.includes("dedup") || err.code === "23505" || causeCode === "23505" || causeMsg.includes("duplicate key")) {
      return {
        eventId: "",
        eventType,
        confidence,
        derivedStatus: "",
        isDuplicate: true,
      };
    }
    throw err;
  }

  const derivedStatus = await updateShipmentStatusFromEvents(shipmentId, companyId);

  return {
    eventId,
    eventType,
    confidence,
    derivedStatus,
    isDuplicate: false,
  };
}

export async function ingestBatch(
  companyId: string,
  shipmentId: string,
  events: RawEventInput[],
): Promise<IngestResult[]> {
  const results: IngestResult[] = [];

  const sorted = [...events].sort((a, b) => {
    const tA = new Date(a.timestamp).getTime();
    const tB = new Date(b.timestamp).getTime();
    return tA - tB;
  });

  for (const event of sorted) {
    try {
      const result = await ingestEvent(companyId, shipmentId, event);
      results.push(result);
    } catch (err: any) {
      results.push({
        eventId: "",
        eventType: "UNKNOWN",
        confidence: 0,
        derivedStatus: "",
        isDuplicate: false,
      });
    }
  }

  return results;
}

export async function getTimeline(
  companyId: string,
  shipmentId: string,
): Promise<{
  events: typeof shipmentEventsTable.$inferSelect[];
  derivedStatus: string;
}> {
  const events = await db
    .select()
    .from(shipmentEventsTable)
    .where(
      and(
        eq(shipmentEventsTable.shipmentId, shipmentId),
        eq(shipmentEventsTable.companyId, companyId),
      ),
    )
    .orderBy(asc(shipmentEventsTable.eventTimestamp));

  const { derivedStatus } = await computeShipmentStatus(shipmentId, companyId);

  return { events, derivedStatus };
}

export async function createShipmentCreatedEvent(
  companyId: string,
  shipmentId: string,
  timestamp?: Date,
): Promise<string> {
  const eventId = generateId("sev");

  try {
    await db.insert(shipmentEventsTable).values({
      id: eventId,
      companyId,
      shipmentId,
      eventType: "SHIPMENT_CREATED",
      eventTimestamp: timestamp || new Date(),
      source: "SYSTEM",
      rawPayload: { auto: true },
      normalizedData: { classifiedType: "SHIPMENT_CREATED", confidence: 1.0 },
      isCriticalEvent: false,
      requiresAttention: false,
    });
  } catch (err: any) {
    const msg = err.message || "";
    const causeCode = err.cause?.code;
    const causeMsg = err.cause?.message || "";
    if (msg.includes("duplicate key") || msg.includes("unique constraint") || msg.includes("dedup") || err.code === "23505" || causeCode === "23505" || causeMsg.includes("duplicate key")) {
      return "";
    }
    throw err;
  }

  return eventId;
}

function parseTimestamp(value: string): Date | null {
  if (!value || value.trim() === "") return null;

  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    return d;
  }

  const formats = [
    /^(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2})?:?(\d{2})?/,
    /^(\d{4})(\d{2})(\d{2})/,
  ];

  for (const fmt of formats) {
    const match = value.match(fmt);
    if (match) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }

  return null;
}

function isValidEventType(type: string): boolean {
  const valid = [
    "SHIPMENT_CREATED", "BOOKING_CONFIRMED", "PICKED_UP", "DEPARTED_ORIGIN",
    "ARRIVED_TRANSSHIPMENT", "DEPARTED_TRANSSHIPMENT", "ARRIVED_DESTINATION",
    "CUSTOMS_HOLD", "CUSTOMS_RELEASED", "DELAYED", "OUT_FOR_DELIVERY", "DELIVERED", "UNKNOWN",
  ];
  return valid.includes(type);
}
