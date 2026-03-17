import { db } from "@workspace/db";
import {
  shipmentsTable,
  tradeGraphEdgesTable,
  eventsTable,
} from "@workspace/db/schema";
import { eq, and, or, inArray, sql } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import { publishDecisionJob } from "@workspace/queue";

export interface ReanalysisResult {
  shipmentsIdentified: number;
  shipmentsQueued: number;
  skippedDuplicate: number;
  trigger: string;
}

const recentlyQueued = new Map<string, number>();
const THROTTLE_MS = 5 * 60 * 1000;
const MAX_BATCH_SIZE = 50;

function isRecentlyQueued(shipmentId: string): boolean {
  const lastQueued = recentlyQueued.get(shipmentId);
  if (!lastQueued) return false;
  return Date.now() - lastQueued < THROTTLE_MS;
}

function markQueued(shipmentId: string): void {
  recentlyQueued.set(shipmentId, Date.now());
  if (recentlyQueued.size > 5000) {
    const cutoff = Date.now() - THROTTLE_MS;
    for (const [key, ts] of recentlyQueued) {
      if (ts < cutoff) recentlyQueued.delete(key);
    }
  }
}

export async function findImpactedShipments(
  companyId: string,
  sourceType: string,
  portCodes: string[],
  laneKeys: string[],
  entityIds: string[],
  vesselNames: string[],
): Promise<Array<{ shipmentId: string; reason: string }>> {
  const impacted: Array<{ shipmentId: string; reason: string }> = [];
  const seen = new Set<string>();

  const activeStatuses = ["DRAFT", "PENDING", "APPROVED", "IN_TRANSIT", "AT_PORT"] as const;

  if (portCodes.length > 0) {
    const portShipments = await db
      .select({
        id: shipmentsTable.id,
        portOfLoading: shipmentsTable.portOfLoading,
        portOfDischarge: shipmentsTable.portOfDischarge,
      })
      .from(shipmentsTable)
      .where(
        and(
          eq(shipmentsTable.companyId, companyId),
          inArray(shipmentsTable.status, activeStatuses),
          or(
            inArray(shipmentsTable.portOfLoading, portCodes),
            inArray(shipmentsTable.portOfDischarge, portCodes),
          ),
        ),
      )
      .limit(MAX_BATCH_SIZE * 2);

    for (const s of portShipments) {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        const matchingPorts = portCodes.filter(
          (p) => p === s.portOfLoading || p === s.portOfDischarge,
        );
        impacted.push({
          shipmentId: s.id,
          reason: `${sourceType}: port match [${matchingPorts.join(",")}]`,
        });
      }
    }
  }

  if (laneKeys.length > 0) {
    const laneParts = laneKeys.map((lk) => {
      const [origin, dest] = lk.split("-");
      return { origin, dest };
    });

    for (const { origin, dest } of laneParts) {
      if (!origin || !dest) continue;
      const laneShipments = await db
        .select({ id: shipmentsTable.id })
        .from(shipmentsTable)
        .where(
          and(
            eq(shipmentsTable.companyId, companyId),
            inArray(shipmentsTable.status, activeStatuses),
            eq(shipmentsTable.portOfLoading, origin),
            eq(shipmentsTable.portOfDischarge, dest),
          ),
        )
        .limit(MAX_BATCH_SIZE);

      for (const s of laneShipments) {
        if (!seen.has(s.id)) {
          seen.add(s.id);
          impacted.push({
            shipmentId: s.id,
            reason: `${sourceType}: lane match [${origin}-${dest}]`,
          });
        }
      }
    }
  }

  if (entityIds.length > 0) {
    const sanctionsEdges = await db
      .select({
        sourceId: tradeGraphEdgesTable.sourceId,
        targetId: tradeGraphEdgesTable.targetId,
      })
      .from(tradeGraphEdgesTable)
      .where(
        and(
          eq(tradeGraphEdgesTable.companyId, companyId),
          inArray(tradeGraphEdgesTable.edgeType, [
            "ENTITY_SANCTIONS_MATCH",
            "ENTITY_DENIED_PARTY_MATCH",
            "SHIPPER_USES_CARRIER",
            "SHIPPER_SHIPS_TO_CONSIGNEE",
          ]),
          or(
            inArray(tradeGraphEdgesTable.sourceId, entityIds),
            inArray(tradeGraphEdgesTable.targetId, entityIds),
          ),
        ),
      )
      .limit(MAX_BATCH_SIZE * 2);

    const linkedEntityIds = new Set<string>();
    for (const edge of sanctionsEdges) {
      linkedEntityIds.add(edge.sourceId);
      linkedEntityIds.add(edge.targetId);
    }

    if (linkedEntityIds.size > 0) {
      const entityShipments = await db
        .select({ id: shipmentsTable.id })
        .from(shipmentsTable)
        .where(
          and(
            eq(shipmentsTable.companyId, companyId),
            inArray(shipmentsTable.status, activeStatuses),
            or(
              inArray(shipmentsTable.shipperId, [...linkedEntityIds]),
              inArray(shipmentsTable.consigneeId, [...linkedEntityIds]),
            ),
          ),
        )
        .limit(MAX_BATCH_SIZE);

      for (const s of entityShipments) {
        if (!seen.has(s.id)) {
          seen.add(s.id);
          impacted.push({
            shipmentId: s.id,
            reason: `${sourceType}: entity match via graph edges`,
          });
        }
      }
    }
  }

  if (vesselNames.length > 0) {
    const vesselShipments = await db
      .select({ id: shipmentsTable.id })
      .from(shipmentsTable)
      .where(
        and(
          eq(shipmentsTable.companyId, companyId),
          inArray(shipmentsTable.status, activeStatuses),
          inArray(shipmentsTable.vessel, vesselNames),
        ),
      )
      .limit(MAX_BATCH_SIZE);

    for (const s of vesselShipments) {
      if (!seen.has(s.id)) {
        seen.add(s.id);
        impacted.push({
          shipmentId: s.id,
          reason: `${sourceType}: vessel match [${vesselNames.join(",")}]`,
        });
      }
    }
  }

  return impacted.slice(0, MAX_BATCH_SIZE);
}

export async function triggerReanalysis(
  companyId: string,
  sourceType: string,
  impactedShipments: Array<{ shipmentId: string; reason: string }>,
  ingestionRunId: string,
): Promise<ReanalysisResult> {
  let shipmentsQueued = 0;
  let skippedDuplicate = 0;

  for (const { shipmentId, reason } of impactedShipments) {
    if (isRecentlyQueued(shipmentId)) {
      skippedDuplicate++;
      console.log(`[reanalysis] skipping ${shipmentId}: recently queued`);
      continue;
    }

    markQueued(shipmentId);
    publishDecisionJob({
      companyId,
      shipmentId,
      trigger: "intelligence_change" as any,
    });
    shipmentsQueued++;

    console.log(`[reanalysis] queued ${shipmentId}: ${reason}`);
  }

  await db.insert(eventsTable).values({
    id: generateId(),
    companyId,
    eventType: "INTELLIGENCE_REANALYSIS_TRIGGERED",
    entityType: "ingestion_run",
    entityId: ingestionRunId,
    actorType: "SERVICE",
    serviceId: "intelligence-ingestion",
    metadata: {
      sourceType,
      shipmentsIdentified: impactedShipments.length,
      shipmentsQueued,
      skippedDuplicate,
      reasons: impactedShipments.map((s) => ({
        shipmentId: s.shipmentId,
        reason: s.reason,
      })),
    },
  });

  return {
    shipmentsIdentified: impactedShipments.length,
    shipmentsQueued,
    skippedDuplicate,
    trigger: `ingestion:${sourceType}`,
  };
}

export function extractAffectedContext(
  sourceType: string,
  ingestionMetadata: Record<string, unknown>,
): {
  portCodes: string[];
  laneKeys: string[];
  entityIds: string[];
  vesselNames: string[];
} {
  const portCodes: string[] = [];
  const laneKeys: string[] = [];
  const entityIds: string[] = [];
  const vesselNames: string[] = [];

  const affectedPorts = ingestionMetadata.affectedPorts as string[] | undefined;
  const affectedLanes = ingestionMetadata.affectedLanes as string[] | undefined;
  const affectedEntities = ingestionMetadata.affectedEntities as string[] | undefined;
  const affectedVessels = ingestionMetadata.affectedVessels as string[] | undefined;

  if (affectedPorts) portCodes.push(...affectedPorts);
  if (affectedLanes) laneKeys.push(...affectedLanes);
  if (affectedEntities) entityIds.push(...affectedEntities);
  if (affectedVessels) vesselNames.push(...affectedVessels);

  switch (sourceType) {
    case "port_congestion":
      break;
    case "disruptions":
    case "weather_risk":
      break;
    case "sanctions":
    case "denied_parties":
      break;
    case "vessel_positions":
      break;
  }

  return { portCodes, laneKeys, entityIds, vesselNames };
}

export { recentlyQueued as _recentlyQueuedForTesting };
