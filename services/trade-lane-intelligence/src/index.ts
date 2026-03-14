import { db } from "@workspace/db";
import {
  shipmentsTable,
  tradeLaneStatsTable,
  shipmentChargesTable,
  shipmentDocumentsTable,
  eventsTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import { runTradeLaneAgent } from "./agent.js";
import { validateTradeLaneOutput } from "./validator.js";

export interface TradeLaneResult {
  laneId: string | null;
  origin: string;
  destination: string;
  shipmentCount: number;
  success: boolean;
  error: string | null;
}

export async function runTradeLaneUpdate(
  shipmentId: string,
  companyId: string,
): Promise<TradeLaneResult> {
  console.log(`[trade-lane] starting lane update for shipment=${shipmentId}`);

  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(eq(shipmentsTable.id, shipmentId))
    .limit(1);

  if (!shipment || shipment.companyId !== companyId) {
    return { laneId: null, origin: "", destination: "", shipmentCount: 0, success: false, error: "Shipment not found" };
  }

  const origin = (shipment.portOfLoading || "UNKNOWN").toUpperCase().trim();
  const destination = (shipment.portOfDischarge || "UNKNOWN").toUpperCase().trim();

  if (origin === "UNKNOWN" || destination === "UNKNOWN") {
    return { laneId: null, origin, destination, shipmentCount: 0, success: false, error: "Missing origin or destination" };
  }

  const charges = await db
    .select()
    .from(shipmentChargesTable)
    .where(eq(shipmentChargesTable.shipmentId, shipmentId));

  const totalCost = charges.reduce((sum, c) => sum + c.totalAmount, 0);

  const docs = await db
    .select()
    .from(shipmentDocumentsTable)
    .where(eq(shipmentDocumentsTable.shipmentId, shipmentId));

  const docCount = docs.length;

  const allLaneShipments = await db
    .select()
    .from(shipmentsTable)
    .where(
      and(
        eq(shipmentsTable.companyId, companyId),
        eq(shipmentsTable.status, "APPROVED"),
      ),
    );

  const laneShipments = allLaneShipments.filter(
    (s) =>
      (s.portOfLoading || "").toUpperCase().trim() === origin &&
      (s.portOfDischarge || "").toUpperCase().trim() === destination,
  );

  const laneCosts: number[] = [];
  let totalTransitDays = 0;
  let transitCount = 0;
  let delayCount = 0;
  let totalDocs = 0;

  for (const ls of laneShipments) {
    const lsCharges = await db
      .select()
      .from(shipmentChargesTable)
      .where(eq(shipmentChargesTable.shipmentId, ls.id));

    const cost = lsCharges.reduce((sum, c) => sum + c.totalAmount, 0);
    if (cost > 0) laneCosts.push(cost);

    if (ls.etd && ls.eta) {
      const etd = new Date(ls.etd);
      const eta = new Date(ls.eta);
      const transitDays = Math.max(1, Math.round((eta.getTime() - etd.getTime()) / (1000 * 60 * 60 * 24)));
      totalTransitDays += transitDays;
      transitCount++;
      if (transitDays > 30) delayCount++;
    }

    const lsDocs = await db
      .select()
      .from(shipmentDocumentsTable)
      .where(eq(shipmentDocumentsTable.shipmentId, ls.id));
    totalDocs += lsDocs.length;
  }

  const shipmentCount = laneShipments.length;
  const avgCost = laneCosts.length > 0 ? laneCosts.reduce((a, b) => a + b, 0) / laneCosts.length : totalCost;
  const minCost = laneCosts.length > 0 ? Math.min(...laneCosts) : totalCost;
  const maxCost = laneCosts.length > 0 ? Math.max(...laneCosts) : totalCost;
  const avgTransitDays = transitCount > 0 ? totalTransitDays / transitCount : null;
  const delayFrequency = shipmentCount > 0 ? delayCount / shipmentCount : 0;
  const avgDocumentCount = shipmentCount > 0 ? totalDocs / shipmentCount : docCount;

  const documentComplexity: "LOW" | "MEDIUM" | "HIGH" =
    avgDocumentCount <= 3 ? "LOW" : avgDocumentCount <= 6 ? "MEDIUM" : "HIGH";

  let agentAdvisory: Record<string, unknown> | null = null;
  try {
    const context = [
      `Trade Lane: ${origin} → ${destination}`,
      `Total shipments on lane: ${shipmentCount}`,
      `Average cost: $${avgCost.toFixed(2)} (range: $${minCost.toFixed(2)}-$${maxCost.toFixed(2)})`,
      `Average transit: ${avgTransitDays ? avgTransitDays.toFixed(1) + " days" : "N/A"}`,
      `Delay frequency: ${(delayFrequency * 100).toFixed(1)}%`,
      `Avg documents per shipment: ${avgDocumentCount.toFixed(1)}`,
      `Document complexity: ${documentComplexity}`,
      `Current shipment commodity: ${shipment.commodity || "Unknown"}`,
      `Current shipment carrier: ${shipment.carrierId || "Unknown"}`,
    ].join("\n");

    const agentResult = await runTradeLaneAgent(context);
    const validation = validateTradeLaneOutput(agentResult.raw);

    if (validation.valid) {
      agentAdvisory = validation.data as unknown as Record<string, unknown>;
    } else {
      console.log(`[trade-lane] agent validation failed: ${validation.errors.join("; ")}`);
    }
  } catch (err) {
    console.error("[trade-lane] agent failed:", err);
  }

  const [existingLane] = await db
    .select()
    .from(tradeLaneStatsTable)
    .where(
      and(
        eq(tradeLaneStatsTable.companyId, companyId),
        eq(tradeLaneStatsTable.origin, origin),
        eq(tradeLaneStatsTable.destination, destination),
      ),
    )
    .limit(1);

  let laneId: string;

  if (existingLane) {
    laneId = existingLane.id;
    await db
      .update(tradeLaneStatsTable)
      .set({
        shipmentCount,
        avgCost,
        minCost,
        maxCost,
        avgTransitDays,
        delayCount,
        delayFrequency,
        avgDocumentCount,
        documentComplexity,
        agentAdvisory,
        lastUpdated: new Date(),
      })
      .where(eq(tradeLaneStatsTable.id, existingLane.id));
  } else {
    laneId = generateId();
    await db.insert(tradeLaneStatsTable).values({
      id: laneId,
      companyId,
      origin,
      destination,
      shipmentCount,
      avgCost,
      minCost,
      maxCost,
      avgTransitDays,
      delayCount,
      delayFrequency,
      avgDocumentCount,
      documentComplexity,
      agentAdvisory,
      lastUpdated: new Date(),
      metadata: null,
    });
  }

  await db.insert(eventsTable).values({
    id: generateId(),
    companyId,
    eventType: "TRADE_LANE_UPDATED" as string,
    entityType: "shipment",
    entityId: shipmentId,
    serviceId: "trade-lane-intelligence",
    metadata: {
      laneId,
      origin,
      destination,
      shipmentCount,
      avgCost,
      documentComplexity,
      hasAdvisory: !!agentAdvisory,
    },
  });

  console.log(
    `[trade-lane] complete: ${origin}→${destination} shipments=${shipmentCount} avgCost=$${avgCost.toFixed(2)} lane=${existingLane ? "updated" : "created"}`,
  );

  return {
    laneId,
    origin,
    destination,
    shipmentCount,
    success: true,
    error: null,
  };
}
