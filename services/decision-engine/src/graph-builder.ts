import { db } from "@workspace/db";
import {
  tradeGraphEdgesTable,
  shipmentsTable,
  entitiesTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";

export async function buildGraphEdges(
  shipmentId: string,
  companyId: string,
): Promise<{ edgesCreated: number }> {
  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(and(eq(shipmentsTable.id, shipmentId), eq(shipmentsTable.companyId, companyId)))
    .limit(1);

  if (!shipment) return { edgesCreated: 0 };

  const edges: Array<{
    edgeType: (typeof tradeGraphEdgesTable.edgeType.enumValues)[number];
    sourceType: (typeof tradeGraphEdgesTable.sourceType.enumValues)[number];
    sourceId: string;
    targetType: (typeof tradeGraphEdgesTable.targetType.enumValues)[number];
    targetId: string;
    properties?: Record<string, unknown>;
  }> = [];

  if (shipment.shipperId && shipment.carrierId) {
    edges.push({
      edgeType: "SHIPPER_USES_CARRIER",
      sourceType: "ENTITY",
      sourceId: shipment.shipperId,
      targetType: "ENTITY",
      targetId: shipment.carrierId,
    });
  }

  if (shipment.shipperId && shipment.consigneeId) {
    edges.push({
      edgeType: "SHIPPER_SHIPS_TO_CONSIGNEE",
      sourceType: "ENTITY",
      sourceId: shipment.shipperId,
      targetType: "ENTITY",
      targetId: shipment.consigneeId,
    });
  }

  if (shipment.portOfLoading) {
    edges.push({
      edgeType: "SHIPMENT_ROUTED_VIA_PORT",
      sourceType: "SHIPMENT",
      sourceId: shipmentId,
      targetType: "PORT",
      targetId: shipment.portOfLoading,
      properties: { role: "loading" },
    });
  }

  if (shipment.portOfDischarge) {
    edges.push({
      edgeType: "SHIPMENT_ROUTED_VIA_PORT",
      sourceType: "SHIPMENT",
      sourceId: shipmentId,
      targetType: "PORT",
      targetId: shipment.portOfDischarge,
      properties: { role: "discharge" },
    });
  }

  if (shipment.portOfLoading && shipment.portOfDischarge) {
    const laneId = `${shipment.portOfLoading}-${shipment.portOfDischarge}`;
    edges.push({
      edgeType: "SHIPMENT_ON_TRADE_LANE",
      sourceType: "SHIPMENT",
      sourceId: shipmentId,
      targetType: "TRADE_LANE",
      targetId: laneId,
    });

    if (shipment.commodity) {
      edges.push({
        edgeType: "COMMODITY_ON_LANE",
        sourceType: "COMMODITY",
        sourceId: shipment.hsCode || shipment.commodity,
        targetType: "TRADE_LANE",
        targetId: laneId,
      });
    }
  }

  if (shipment.vessel && shipment.portOfLoading && shipment.portOfDischarge) {
    const laneId = `${shipment.portOfLoading}-${shipment.portOfDischarge}`;
    edges.push({
      edgeType: "VESSEL_OPERATES_LANE",
      sourceType: "VESSEL",
      sourceId: shipment.vessel,
      targetType: "TRADE_LANE",
      targetId: laneId,
    });
  }

  let edgesCreated = 0;
  for (const edge of edges) {
    const existing = await db
      .select({ id: tradeGraphEdgesTable.id, occurrenceCount: tradeGraphEdgesTable.occurrenceCount })
      .from(tradeGraphEdgesTable)
      .where(
        and(
          eq(tradeGraphEdgesTable.companyId, companyId),
          eq(tradeGraphEdgesTable.edgeType, edge.edgeType),
          eq(tradeGraphEdgesTable.sourceType, edge.sourceType),
          eq(tradeGraphEdgesTable.sourceId, edge.sourceId),
          eq(tradeGraphEdgesTable.targetType, edge.targetType),
          eq(tradeGraphEdgesTable.targetId, edge.targetId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(tradeGraphEdgesTable)
        .set({
          occurrenceCount: (existing[0]!.occurrenceCount || 0) + 1,
          lastSeen: new Date(),
        })
        .where(eq(tradeGraphEdgesTable.id, existing[0]!.id));
    } else {
      await db.insert(tradeGraphEdgesTable).values({
        id: generateId(),
        companyId,
        edgeType: edge.edgeType,
        sourceType: edge.sourceType,
        sourceId: edge.sourceId,
        targetType: edge.targetType,
        targetId: edge.targetId,
        properties: edge.properties || null,
      });
      edgesCreated++;
    }
  }

  return { edgesCreated };
}
