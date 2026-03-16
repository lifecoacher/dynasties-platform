import { db } from "@workspace/db";
import {
  portCongestionSnapshotsTable,
  disruptionEventsTable,
  weatherRiskEventsTable,
  laneMarketSignalsTable,
  vesselPositionsTable,
  tradeGraphEdgesTable,
  laneScoresTable,
  portScoresTable,
  carrierScoresTable,
  entityScoresTable,
  shipmentsTable,
  tradeLaneStatsTable,
} from "@workspace/db/schema";
import { eq, and, or, sql, desc, inArray } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";

export interface ScoringResult {
  lanesScored: number;
  portsScored: number;
  carriersScored: number;
  entitiesScored: number;
}

function tenantOrGlobalFilter(col: any, companyId: string) {
  return or(eq(col, companyId), sql`${col} IS NULL`);
}

export async function computeAndPersistScores(companyId: string): Promise<ScoringResult> {
  const lanesScored = await scoreLanes(companyId);
  const portsScored = await scorePorts(companyId);
  const carriersScored = await scoreCarriers(companyId);
  const entitiesScored = await scoreEntities(companyId);

  return { lanesScored, portsScored, carriersScored, entitiesScored };
}

async function scoreLanes(companyId: string): Promise<number> {
  const lanes = await db
    .select({
      origin: tradeLaneStatsTable.origin,
      destination: tradeLaneStatsTable.destination,
      delayFrequency: tradeLaneStatsTable.delayFrequency,
    })
    .from(tradeLaneStatsTable)
    .where(eq(tradeLaneStatsTable.companyId, companyId))
    .limit(200);

  let scored = 0;

  for (const lane of lanes) {
    const portCodes = [lane.origin, lane.destination];
    const laneKey = `${lane.origin}-${lane.destination}`;

    const congestionRows = await db
      .select()
      .from(portCongestionSnapshotsTable)
      .where(
        and(
          inArray(portCongestionSnapshotsTable.portCode, portCodes),
          tenantOrGlobalFilter(portCongestionSnapshotsTable.companyId, companyId),
        ),
      )
      .orderBy(desc(portCongestionSnapshotsTable.snapshotTimestamp))
      .limit(4);

    let congestionScore = 0;
    for (const snap of congestionRows) {
      const lvl = CONGESTION_MAP[snap.congestionLevel] ?? 0;
      if (lvl > congestionScore) congestionScore = lvl;
    }

    const disruptions = await db
      .select()
      .from(disruptionEventsTable)
      .where(
        and(
          inArray(disruptionEventsTable.status, ["active", "monitoring"]),
          tenantOrGlobalFilter(disruptionEventsTable.companyId, companyId),
        ),
      )
      .limit(50);

    let disruptionScore = 0;
    for (const d of disruptions) {
      const ports = (d.affectedPorts as string[]) || [];
      const dLanes = (d.affectedLanes as string[]) || [];
      if (ports.some((p) => portCodes.includes(p)) || dLanes.includes(laneKey)) {
        const s = SEVERITY_MAP[d.severity] ?? 0;
        if (s > disruptionScore) disruptionScore = s;
      }
    }

    const delayStressScore = Math.min(100, Math.round((lane.delayFrequency ?? 0) * 150));

    const marketSignals = await db
      .select()
      .from(laneMarketSignalsTable)
      .where(
        and(
          eq(laneMarketSignalsTable.originPort, lane.origin),
          eq(laneMarketSignalsTable.destinationPort, lane.destination),
          tenantOrGlobalFilter(laneMarketSignalsTable.companyId, companyId),
        ),
      )
      .orderBy(desc(laneMarketSignalsTable.signalDate))
      .limit(3);

    let marketPressureScore = 0;
    for (const ms of marketSignals) {
      const mag = ms.magnitude ?? 0;
      const dir = ms.direction === "up" ? 1 : ms.direction === "down" ? -0.5 : 0;
      const score = Math.min(100, Math.round(mag * dir * 20));
      if (score > marketPressureScore) marketPressureScore = score;
    }

    const compositeStressScore = Math.round(
      congestionScore * 0.25 +
      disruptionScore * 0.3 +
      delayStressScore * 0.25 +
      marketPressureScore * 0.2,
    );

    const existing = await db
      .select({ id: laneScoresTable.id })
      .from(laneScoresTable)
      .where(
        and(
          eq(laneScoresTable.companyId, companyId),
          eq(laneScoresTable.originPort, lane.origin),
          eq(laneScoresTable.destinationPort, lane.destination),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(laneScoresTable)
        .set({
          congestionScore,
          disruptionScore,
          delayStressScore,
          marketPressureScore,
          compositeStressScore,
          metadata: { updatedBy: "scoring-service" },
          updatedAt: new Date(),
        })
        .where(eq(laneScoresTable.id, existing[0].id));
    } else {
      await db.insert(laneScoresTable).values({
        id: generateId(),
        companyId,
        originPort: lane.origin,
        destinationPort: lane.destination,
        congestionScore,
        disruptionScore,
        delayStressScore,
        marketPressureScore,
        compositeStressScore,
        metadata: { updatedBy: "scoring-service" },
        updatedAt: new Date(),
      });
    }

    scored++;
  }

  return scored;
}

async function scorePorts(companyId: string): Promise<number> {
  const congestionSnapshots = await db
    .select()
    .from(portCongestionSnapshotsTable)
    .where(tenantOrGlobalFilter(portCongestionSnapshotsTable.companyId, companyId))
    .orderBy(desc(portCongestionSnapshotsTable.snapshotTimestamp))
    .limit(100);

  const portMap = new Map<string, {
    portName: string | null;
    congestion: number;
    weather: number;
    disruption: number;
  }>();

  for (const snap of congestionSnapshots) {
    const existing = portMap.get(snap.portCode) || {
      portName: snap.portName,
      congestion: 0,
      weather: 0,
      disruption: 0,
    };
    const lvl = CONGESTION_MAP[snap.congestionLevel] ?? 0;
    if (lvl > existing.congestion) existing.congestion = lvl;
    portMap.set(snap.portCode, existing);
  }

  const weatherEvents = await db
    .select()
    .from(weatherRiskEventsTable)
    .where(
      and(
        inArray(weatherRiskEventsTable.status, ["forecast", "active"]),
        tenantOrGlobalFilter(weatherRiskEventsTable.companyId, companyId),
      ),
    )
    .limit(50);

  for (const w of weatherEvents) {
    const ports = (w.affectedPorts as string[]) || [];
    for (const p of ports) {
      const existing = portMap.get(p) || { portName: null, congestion: 0, weather: 0, disruption: 0 };
      const s = SEVERITY_MAP[w.severity] ?? 0;
      if (s > existing.weather) existing.weather = s;
      portMap.set(p, existing);
    }
  }

  const disruptions = await db
    .select()
    .from(disruptionEventsTable)
    .where(
      and(
        inArray(disruptionEventsTable.status, ["active", "monitoring"]),
        tenantOrGlobalFilter(disruptionEventsTable.companyId, companyId),
      ),
    )
    .limit(50);

  for (const d of disruptions) {
    const ports = (d.affectedPorts as string[]) || [];
    for (const p of ports) {
      const existing = portMap.get(p) || { portName: null, congestion: 0, weather: 0, disruption: 0 };
      const s = SEVERITY_MAP[d.severity] ?? 0;
      if (s > existing.disruption) existing.disruption = s;
      portMap.set(p, existing);
    }
  }

  let scored = 0;
  for (const [portCode, data] of portMap) {
    const operationalVolatility = Math.round(
      (data.congestion + data.weather + data.disruption) / 3,
    );
    const compositeScore = Math.round(
      data.congestion * 0.35 + data.weather * 0.25 + data.disruption * 0.25 + operationalVolatility * 0.15,
    );

    const existing = await db
      .select({ id: portScoresTable.id })
      .from(portScoresTable)
      .where(
        and(
          eq(portScoresTable.companyId, companyId),
          eq(portScoresTable.portCode, portCode),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(portScoresTable)
        .set({
          portName: data.portName,
          congestionSeverity: data.congestion,
          weatherExposure: data.weather,
          disruptionExposure: data.disruption,
          operationalVolatility,
          compositeScore,
          updatedAt: new Date(),
        })
        .where(eq(portScoresTable.id, existing[0].id));
    } else {
      await db.insert(portScoresTable).values({
        id: generateId(),
        companyId,
        portCode,
        portName: data.portName,
        congestionSeverity: data.congestion,
        weatherExposure: data.weather,
        disruptionExposure: data.disruption,
        operationalVolatility,
        compositeScore,
        updatedAt: new Date(),
      });
    }
    scored++;
  }

  return scored;
}

async function scoreCarriers(companyId: string): Promise<number> {
  const carrierEdges = await db
    .select({
      targetId: tradeGraphEdgesTable.targetId,
    })
    .from(tradeGraphEdgesTable)
    .where(
      and(
        eq(tradeGraphEdgesTable.companyId, companyId),
        eq(tradeGraphEdgesTable.edgeType, "SHIPPER_USES_CARRIER"),
      ),
    )
    .limit(200);

  const carrierIds = [...new Set(carrierEdges.map((e) => e.targetId))];
  if (carrierIds.length === 0) return 0;

  let scored = 0;

  for (const carrierId of carrierIds) {
    const shipmentEdges = await db
      .select({ sourceId: tradeGraphEdgesTable.sourceId })
      .from(tradeGraphEdgesTable)
      .where(
        and(
          eq(tradeGraphEdgesTable.companyId, companyId),
          eq(tradeGraphEdgesTable.edgeType, "SHIPPER_USES_CARRIER"),
          eq(tradeGraphEdgesTable.targetId, carrierId),
        ),
      )
      .limit(100);

    const shipperIds = [...new Set(shipmentEdges.map((e) => e.sourceId))];
    if (shipperIds.length === 0) continue;

    const shipments = await db
      .select({
        id: shipmentsTable.id,
        status: shipmentsTable.status,
        vessel: shipmentsTable.vessel,
        portOfLoading: shipmentsTable.portOfLoading,
        portOfDischarge: shipmentsTable.portOfDischarge,
        shipper: shipmentsTable.shipper,
      })
      .from(shipmentsTable)
      .where(
        and(
          eq(shipmentsTable.companyId, companyId),
          inArray(shipmentsTable.shipper, shipperIds),
        ),
      )
      .limit(100);

    const totalShipments = shipments.length;
    const completedOk = shipments.filter((s) => s.status === "COMPLETED" || s.status === "DELIVERED").length;
    const performanceScore = totalShipments > 0 ? Math.round((completedOk / totalShipments) * 100) : 50;

    const vesselNames = [...new Set(shipments.map((s) => s.vessel).filter(Boolean) as string[])];
    let anomalyScore = 0;
    if (vesselNames.length > 0) {
      const positions = await db
        .select()
        .from(vesselPositionsTable)
        .where(
          and(
            inArray(vesselPositionsTable.vesselName, vesselNames),
            tenantOrGlobalFilter(vesselPositionsTable.companyId, companyId),
          ),
        )
        .orderBy(desc(vesselPositionsTable.positionTimestamp))
        .limit(10);

      const anomalies = positions.filter(
        (p) => p.navigationStatus === "anchored" || p.navigationStatus === "moored",
      );
      anomalyScore = Math.min(100, anomalies.length * 25);
    }

    const reliabilityScore = Math.max(0, performanceScore - Math.round(anomalyScore * 0.3));

    const portCodes = [...new Set(
      shipments.flatMap((s) => [s.portOfLoading, s.portOfDischarge]).filter(Boolean) as string[],
    )];
    let laneStressExposure = 0;
    if (portCodes.length > 0) {
      const laneScores = await db
        .select({ compositeStressScore: laneScoresTable.compositeStressScore })
        .from(laneScoresTable)
        .where(
          and(
            eq(laneScoresTable.companyId, companyId),
            or(
              inArray(laneScoresTable.originPort, portCodes),
              inArray(laneScoresTable.destinationPort, portCodes),
            ),
          ),
        )
        .limit(20);

      if (laneScores.length > 0) {
        laneStressExposure = Math.round(
          laneScores.reduce((sum, ls) => sum + ls.compositeStressScore, 0) / laneScores.length,
        );
      }
    }

    const compositeScore = Math.round(
      (100 - performanceScore) * 0.3 + anomalyScore * 0.25 + (100 - reliabilityScore) * 0.25 + laneStressExposure * 0.2,
    );

    const existing = await db
      .select({ id: carrierScoresTable.id })
      .from(carrierScoresTable)
      .where(
        and(
          eq(carrierScoresTable.companyId, companyId),
          eq(carrierScoresTable.carrierName, carrierId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(carrierScoresTable)
        .set({
          performanceScore,
          anomalyScore,
          reliabilityScore,
          laneStressExposure,
          compositeScore,
          updatedAt: new Date(),
        })
        .where(eq(carrierScoresTable.id, existing[0].id));
    } else {
      await db.insert(carrierScoresTable).values({
        id: generateId(),
        companyId,
        carrierName: carrierId,
        performanceScore,
        anomalyScore,
        reliabilityScore,
        laneStressExposure,
        compositeScore,
        updatedAt: new Date(),
      });
    }
    scored++;
  }

  return scored;
}

async function scoreEntities(companyId: string): Promise<number> {
  const sanctionsEdges = await db
    .select()
    .from(tradeGraphEdgesTable)
    .where(
      and(
        eq(tradeGraphEdgesTable.companyId, companyId),
        eq(tradeGraphEdgesTable.edgeType, "ENTITY_SANCTIONS_MATCH"),
      ),
    )
    .limit(200);

  const entityIds = [...new Set(sanctionsEdges.map((e) => e.targetId))];
  if (entityIds.length === 0) return 0;

  let scored = 0;

  for (const entityId of entityIds) {
    const edges = sanctionsEdges.filter((e) => e.targetId === entityId);
    const maxWeight = Math.max(...edges.map((e) => e.weight ?? 0));
    const sanctionsRiskScore = Math.round(maxWeight * 100);

    let deniedPartyConfidence = 0;
    const dpEdges = await db
      .select()
      .from(tradeGraphEdgesTable)
      .where(
        and(
          eq(tradeGraphEdgesTable.companyId, companyId),
          eq(tradeGraphEdgesTable.edgeType, "ENTITY_DENIED_PARTY_MATCH"),
          eq(tradeGraphEdgesTable.targetId, entityId),
        ),
      )
      .limit(10);

    if (dpEdges.length > 0) {
      deniedPartyConfidence = Math.round(Math.max(...dpEdges.map((e) => e.weight ?? 0)) * 100);
    }

    const documentationIrregularity = 0;

    const compositeScore = Math.round(
      sanctionsRiskScore * 0.5 + deniedPartyConfidence * 0.35 + documentationIrregularity * 0.15,
    );

    const existing = await db
      .select({ id: entityScoresTable.id })
      .from(entityScoresTable)
      .where(
        and(
          eq(entityScoresTable.companyId, companyId),
          eq(entityScoresTable.entityId, entityId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(entityScoresTable)
        .set({
          sanctionsRiskScore,
          deniedPartyConfidence,
          documentationIrregularity,
          compositeScore,
          updatedAt: new Date(),
        })
        .where(eq(entityScoresTable.id, existing[0].id));
    } else {
      await db.insert(entityScoresTable).values({
        id: generateId(),
        companyId,
        entityId,
        entityName: entityId,
        sanctionsRiskScore,
        deniedPartyConfidence,
        documentationIrregularity,
        compositeScore,
        updatedAt: new Date(),
      });
    }
    scored++;
  }

  return scored;
}

const CONGESTION_MAP: Record<string, number> = {
  low: 10,
  moderate: 30,
  high: 65,
  critical: 90,
};

const SEVERITY_MAP: Record<string, number> = {
  low: 15,
  medium: 40,
  high: 70,
  critical: 95,
};
