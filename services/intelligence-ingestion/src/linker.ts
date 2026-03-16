import { db } from "@workspace/db";
import {
  tradeGraphEdgesTable,
  vesselPositionsTable,
  portCongestionSnapshotsTable,
  disruptionEventsTable,
  weatherRiskEventsTable,
  sanctionsEntitiesTable,
  deniedPartiesTable,
  laneMarketSignalsTable,
  shipmentsTable,
  entitiesTable,
  ingestionRunsTable,
} from "@workspace/db/schema";
import { generateId } from "@workspace/shared-utils";
import { eq, and, or, ilike, sql } from "drizzle-orm";

async function upsertEdge(
  companyId: string,
  edgeType: string,
  sourceType: string,
  sourceId: string,
  targetType: string,
  targetId: string,
  confidence: number | null,
  properties?: Record<string, unknown>,
): Promise<boolean> {
  const existing = await db
    .select({ id: tradeGraphEdgesTable.id, occurrenceCount: tradeGraphEdgesTable.occurrenceCount })
    .from(tradeGraphEdgesTable)
    .where(
      and(
        eq(tradeGraphEdgesTable.companyId, companyId),
        eq(tradeGraphEdgesTable.edgeType, edgeType as any),
        eq(tradeGraphEdgesTable.sourceType, sourceType as any),
        eq(tradeGraphEdgesTable.sourceId, sourceId),
        eq(tradeGraphEdgesTable.targetType, targetType as any),
        eq(tradeGraphEdgesTable.targetId, targetId),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(tradeGraphEdgesTable)
      .set({
        occurrenceCount: existing[0].occurrenceCount + 1,
        lastSeen: new Date(),
        confidence: confidence ?? existing[0].occurrenceCount > 1 ? 0.9 : undefined,
        properties: properties ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(tradeGraphEdgesTable.id, existing[0].id));
    return false;
  }

  await db.insert(tradeGraphEdgesTable).values({
    id: generateId(),
    companyId,
    edgeType: edgeType as any,
    sourceType: sourceType as any,
    sourceId,
    targetType: targetType as any,
    targetId,
    confidence,
    properties: properties ?? null,
  });
  return true;
}

export async function linkVesselPositions(companyId: string): Promise<number> {
  let edgesCreated = 0;

  const positions = await db
    .select()
    .from(vesselPositionsTable)
    .where(eq(vesselPositionsTable.companyId, companyId))
    .limit(100);

  const shipments = await db
    .select({ id: shipmentsTable.id, vessel: shipmentsTable.vessel, portOfLoading: shipmentsTable.portOfLoading, portOfDischarge: shipmentsTable.portOfDischarge })
    .from(shipmentsTable)
    .where(eq(shipmentsTable.companyId, companyId));

  for (const pos of positions) {
    if (pos.destination) {
      const isNew = await upsertEdge(
        companyId,
        "VESSEL_AT_PORT",
        "VESSEL",
        pos.vesselName,
        "PORT",
        pos.destination,
        0.8,
        { status: pos.status, speed: pos.speed, eta: pos.eta },
      );
      if (isNew) edgesCreated++;
    }

    for (const shipment of shipments) {
      if (shipment.vessel && shipment.vessel.toLowerCase() === pos.vesselName.toLowerCase()) {
        const isNew = await upsertEdge(
          companyId,
          "SHIPMENT_VESSEL_TRACKING",
          "SHIPMENT",
          shipment.id,
          "VESSEL",
          pos.vesselName,
          0.95,
          { latitude: pos.latitude, longitude: pos.longitude, status: pos.status },
        );
        if (isNew) edgesCreated++;
      }
    }
  }

  return edgesCreated;
}

export async function linkPortCongestion(companyId: string): Promise<number> {
  let edgesCreated = 0;

  const snapshots = await db
    .select()
    .from(portCongestionSnapshotsTable)
    .where(eq(portCongestionSnapshotsTable.companyId, companyId))
    .limit(100);

  for (const snap of snapshots) {
    const isNew = await upsertEdge(
      companyId,
      "PORT_CONGESTION_SNAPSHOT",
      "CONGESTION",
      snap.id,
      "PORT",
      snap.portCode,
      null,
      { congestionLevel: snap.congestionLevel, waitingVessels: snap.waitingVessels, avgWaitDays: snap.avgWaitDays },
    );
    if (isNew) edgesCreated++;
  }

  return edgesCreated;
}

export async function linkDisruptions(companyId: string): Promise<number> {
  let edgesCreated = 0;

  const disruptions = await db
    .select()
    .from(disruptionEventsTable)
    .where(
      and(
        eq(disruptionEventsTable.companyId, companyId),
        eq(disruptionEventsTable.status, "active"),
      ),
    )
    .limit(100);

  for (const d of disruptions) {
    if (d.affectedLanes && Array.isArray(d.affectedLanes)) {
      for (const lane of d.affectedLanes) {
        const isNew = await upsertEdge(
          companyId,
          "LANE_DISRUPTION",
          "DISRUPTION",
          d.id,
          "TRADE_LANE",
          lane,
          d.confidence,
          { severity: d.severity, eventType: d.eventType, estimatedImpactDays: d.estimatedImpactDays },
        );
        if (isNew) edgesCreated++;
      }
    }
    if (d.affectedPorts && Array.isArray(d.affectedPorts)) {
      for (const port of d.affectedPorts) {
        const isNew = await upsertEdge(
          companyId,
          "LANE_DISRUPTION",
          "DISRUPTION",
          d.id,
          "PORT",
          port,
          d.confidence,
          { severity: d.severity, eventType: d.eventType },
        );
        if (isNew) edgesCreated++;
      }
    }
  }

  return edgesCreated;
}

export async function linkWeatherRisks(companyId: string): Promise<number> {
  let edgesCreated = 0;

  const events = await db
    .select()
    .from(weatherRiskEventsTable)
    .where(
      and(
        eq(weatherRiskEventsTable.companyId, companyId),
      ),
    )
    .limit(100);

  for (const w of events) {
    if (w.affectedPorts && Array.isArray(w.affectedPorts)) {
      for (const port of w.affectedPorts) {
        const isNew = await upsertEdge(
          companyId,
          "LANE_WEATHER_RISK",
          "WEATHER",
          w.id,
          "PORT",
          port,
          w.confidence,
          { severity: w.severity, eventType: w.eventType, windSpeedKnots: w.windSpeedKnots },
        );
        if (isNew) edgesCreated++;
      }
    }
  }

  return edgesCreated;
}

export async function linkSanctions(companyId: string): Promise<number> {
  let edgesCreated = 0;

  const sanctions = await db
    .select()
    .from(sanctionsEntitiesTable)
    .where(
      and(
        eq(sanctionsEntitiesTable.status, "active"),
        or(
          eq(sanctionsEntitiesTable.companyId, companyId),
          sql`${sanctionsEntitiesTable.companyId} IS NULL`,
        ),
      ),
    )
    .limit(200);

  const entities = await db
    .select({ id: entitiesTable.id, name: entitiesTable.name })
    .from(entitiesTable)
    .where(eq(entitiesTable.companyId, companyId));

  for (const s of sanctions) {
    for (const entity of entities) {
      const nameMatch = entity.name.toLowerCase().includes(s.entityName.toLowerCase()) ||
        s.entityName.toLowerCase().includes(entity.name.toLowerCase());

      const aliasMatch = s.aliases?.some(
        (a: string) => entity.name.toLowerCase().includes(a.toLowerCase()),
      );

      if (nameMatch || aliasMatch) {
        const isNew = await upsertEdge(
          companyId,
          "ENTITY_SANCTIONS_MATCH",
          "SANCTIONS",
          s.id,
          "ENTITY",
          entity.id,
          nameMatch ? 0.85 : 0.6,
          { listName: s.listName, sanctionProgram: s.sanctionProgram, matchType: nameMatch ? "name" : "alias" },
        );
        if (isNew) edgesCreated++;
      }
    }
  }

  return edgesCreated;
}

export async function runIntelligenceLinking(
  companyId: string,
  sourceType: string,
  ingestionRunId: string,
): Promise<number> {
  let totalEdges = 0;

  switch (sourceType) {
    case "vessel_positions":
      totalEdges = await linkVesselPositions(companyId);
      break;
    case "port_congestion":
      totalEdges = await linkPortCongestion(companyId);
      break;
    case "disruptions":
      totalEdges = await linkDisruptions(companyId);
      break;
    case "weather_risk":
      totalEdges = await linkWeatherRisks(companyId);
      break;
    case "sanctions":
    case "denied_parties":
      totalEdges = await linkSanctions(companyId);
      break;
  }

  if (ingestionRunId) {
    await db
      .update(ingestionRunsTable)
      .set({ graphEdgesCreated: totalEdges })
      .where(eq(ingestionRunsTable.id, ingestionRunId));
  }

  console.log(
    `[intelligence-linking] ${sourceType} linking completed: edges=${totalEdges} company=${companyId}`,
  );

  return totalEdges;
}
