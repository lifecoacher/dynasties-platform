import { db } from "@workspace/db";
import {
  shipmentEventsTable,
  shipmentsTable,
  type ShipmentEventType,
  EVENT_STATUS_MAP,
} from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";

const STATUS_PRIORITY: ShipmentEventType[] = [
  "DELIVERED",
  "OUT_FOR_DELIVERY",
  "CUSTOMS_RELEASED",
  "CUSTOMS_HOLD",
  "ARRIVED_DESTINATION",
  "DEPARTED_TRANSSHIPMENT",
  "ARRIVED_TRANSSHIPMENT",
  "DEPARTED_ORIGIN",
  "PICKED_UP",
  "BOOKING_CONFIRMED",
  "SHIPMENT_CREATED",
];

export async function computeShipmentStatus(
  shipmentId: string,
  companyId: string,
): Promise<{ derivedStatus: string; latestEventType: ShipmentEventType | null }> {
  const events = await db
    .select({
      eventType: shipmentEventsTable.eventType,
      eventTimestamp: shipmentEventsTable.eventTimestamp,
    })
    .from(shipmentEventsTable)
    .where(
      and(
        eq(shipmentEventsTable.shipmentId, shipmentId),
        eq(shipmentEventsTable.companyId, companyId),
      ),
    )
    .orderBy(desc(shipmentEventsTable.eventTimestamp));

  if (events.length === 0) {
    return { derivedStatus: "DRAFT", latestEventType: null };
  }

  const eventTypes = new Set(events.map((e) => e.eventType));

  for (const statusEvent of STATUS_PRIORITY) {
    if (eventTypes.has(statusEvent)) {
      const mappedStatus = EVENT_STATUS_MAP[statusEvent] || "DRAFT";
      return { derivedStatus: mappedStatus, latestEventType: statusEvent };
    }
  }

  return { derivedStatus: "DRAFT", latestEventType: events[0].eventType };
}

export async function updateShipmentStatusFromEvents(
  shipmentId: string,
  companyId: string,
): Promise<string> {
  const { derivedStatus } = await computeShipmentStatus(shipmentId, companyId);

  const [shipment] = await db
    .select({ status: shipmentsTable.status })
    .from(shipmentsTable)
    .where(eq(shipmentsTable.id, shipmentId))
    .limit(1);

  if (!shipment) return derivedStatus;

  const terminalStatuses = ["APPROVED", "REJECTED", "CANCELLED", "CLOSED"];
  if (terminalStatuses.includes(shipment.status)) {
    return shipment.status;
  }

  const allowedTransitions: Record<string, string[]> = {
    DRAFT: ["BOOKED", "IN_TRANSIT", "AT_PORT", "CUSTOMS", "DELIVERED"],
    BOOKED: ["IN_TRANSIT", "AT_PORT", "CUSTOMS", "DELIVERED"],
    PENDING: ["BOOKED", "IN_TRANSIT", "AT_PORT", "CUSTOMS", "DELIVERED"],
    PENDING_REVIEW: ["BOOKED", "IN_TRANSIT", "AT_PORT", "CUSTOMS", "DELIVERED"],
    IN_TRANSIT: ["AT_PORT", "CUSTOMS", "DELIVERED"],
    AT_PORT: ["CUSTOMS", "IN_TRANSIT", "DELIVERED"],
    CUSTOMS: ["IN_TRANSIT", "AT_PORT", "DELIVERED"],
  };

  const allowed = allowedTransitions[shipment.status];
  if (!allowed || !allowed.includes(derivedStatus)) {
    return shipment.status;
  }

  await db
    .update(shipmentsTable)
    .set({ status: derivedStatus as any })
    .where(eq(shipmentsTable.id, shipmentId));

  return derivedStatus;
}
