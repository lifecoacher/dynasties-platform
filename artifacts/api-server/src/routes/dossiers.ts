import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  laneScoresTable,
  portScoresTable,
  carrierScoresTable,
  entityScoresTable,
  shipmentsTable,
  recommendationsTable,
  recommendationOutcomesTable,
  tradeGraphEdgesTable,
  portCongestionSnapshotsTable,
  disruptionEventsTable,
  weatherRiskEventsTable,
  sanctionsEntitiesTable,
  deniedPartiesTable,
  tradeLaneStatsTable,
  shipmentIntelligenceSnapshotsTable,
} from "@workspace/db/schema";
import { eq, and, or, sql, desc, inArray, count } from "drizzle-orm";

const router = Router();

router.get("/dossiers/lanes/:origin/:destination", async (req: Request, res: Response) => {
  const companyId = (req as any).companyId as string;
  const origin = String(req.params.origin);
  const destination = String(req.params.destination);

  const [score] = await db
    .select()
    .from(laneScoresTable)
    .where(
      and(
        eq(laneScoresTable.companyId, companyId),
        eq(laneScoresTable.originPort, origin),
        eq(laneScoresTable.destinationPort, destination),
      ),
    )
    .limit(1);

  const [stats] = await db
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

  const shipments = await db
    .select({
      id: shipmentsTable.id,
      reference: shipmentsTable.reference,
      status: shipmentsTable.status,
      shipperId: shipmentsTable.shipperId,
      consigneeId: shipmentsTable.consigneeId,
      carrierId: shipmentsTable.carrierId,
      vessel: shipmentsTable.vessel,
      etd: shipmentsTable.etd,
      eta: shipmentsTable.eta,
    })
    .from(shipmentsTable)
    .where(
      and(
        eq(shipmentsTable.companyId, companyId),
        eq(shipmentsTable.portOfLoading, origin),
        eq(shipmentsTable.portOfDischarge, destination),
      ),
    )
    .orderBy(desc(shipmentsTable.updatedAt))
    .limit(20);

  const shipmentIds = shipments.map((s) => s.id);

  const recommendations = shipmentIds.length > 0
    ? await db
        .select()
        .from(recommendationsTable)
        .where(
          and(
            eq(recommendationsTable.companyId, companyId),
            inArray(recommendationsTable.shipmentId, shipmentIds),
            inArray(recommendationsTable.status, ["PENDING", "SHOWN", "ACCEPTED", "MODIFIED"]),
          ),
        )
        .orderBy(desc(recommendationsTable.createdAt))
        .limit(20)
    : [];

  const outcomes = shipmentIds.length > 0
    ? await db
        .select({
          action: recommendationOutcomesTable.action,
          cnt: count(),
        })
        .from(recommendationOutcomesTable)
        .where(
          and(
            eq(recommendationOutcomesTable.companyId, companyId),
            inArray(recommendationOutcomesTable.shipmentId, shipmentIds),
          ),
        )
        .groupBy(recommendationOutcomesTable.action)
    : [];

  const congestion = await db
    .select()
    .from(portCongestionSnapshotsTable)
    .where(
      and(
        inArray(portCongestionSnapshotsTable.portCode, [origin, destination]),
        or(eq(portCongestionSnapshotsTable.companyId, companyId), sql`${portCongestionSnapshotsTable.companyId} IS NULL`),
      ),
    )
    .orderBy(desc(portCongestionSnapshotsTable.snapshotTimestamp))
    .limit(10);

  const disruptions = await db
    .select()
    .from(disruptionEventsTable)
    .where(
      and(
        inArray(disruptionEventsTable.status, ["active", "monitoring"]),
        or(eq(disruptionEventsTable.companyId, companyId), sql`${disruptionEventsTable.companyId} IS NULL`),
      ),
    )
    .limit(50);

  const relevantDisruptions = disruptions.filter((d) => {
    const ports = (d.affectedPorts as string[]) || [];
    const lanes = (d.affectedLanes as string[]) || [];
    return ports.includes(origin) || ports.includes(destination) || lanes.includes(`${origin}-${destination}`);
  });

  const graphEdges = await db
    .select()
    .from(tradeGraphEdgesTable)
    .where(
      and(
        eq(tradeGraphEdgesTable.companyId, companyId),
        eq(tradeGraphEdgesTable.edgeType, "SHIPMENT_ON_TRADE_LANE"),
      ),
    )
    .limit(50);

  res.json({
    data: {
      lane: { origin, destination },
      score: score || null,
      stats: stats || null,
      shipments,
      recommendations: recommendations.map(serializeRec),
      outcomePatterns: outcomes.map((o) => ({ action: o.action, count: Number(o.cnt) })),
      signals: {
        congestion,
        disruptions: relevantDisruptions,
      },
      graphEdges: graphEdges.slice(0, 20),
    },
  });
});

router.get("/dossiers/ports/:portCode", async (req: Request, res: Response) => {
  const companyId = (req as any).companyId as string;
  const portCode = String(req.params.portCode);

  const [score] = await db
    .select()
    .from(portScoresTable)
    .where(
      and(
        eq(portScoresTable.companyId, companyId),
        eq(portScoresTable.portCode, portCode),
      ),
    )
    .limit(1);

  const shipments = await db
    .select({
      id: shipmentsTable.id,
      reference: shipmentsTable.reference,
      status: shipmentsTable.status,
      shipperId: shipmentsTable.shipperId,
      carrierId: shipmentsTable.carrierId,
      vessel: shipmentsTable.vessel,
      portOfLoading: shipmentsTable.portOfLoading,
      portOfDischarge: shipmentsTable.portOfDischarge,
      etd: shipmentsTable.etd,
      eta: shipmentsTable.eta,
    })
    .from(shipmentsTable)
    .where(
      and(
        eq(shipmentsTable.companyId, companyId),
        or(
          eq(shipmentsTable.portOfLoading, portCode),
          eq(shipmentsTable.portOfDischarge, portCode),
        ),
      ),
    )
    .orderBy(desc(shipmentsTable.updatedAt))
    .limit(20);

  const shipmentIds = shipments.map((s) => s.id);

  const recommendations = shipmentIds.length > 0
    ? await db
        .select()
        .from(recommendationsTable)
        .where(
          and(
            eq(recommendationsTable.companyId, companyId),
            inArray(recommendationsTable.shipmentId, shipmentIds),
            inArray(recommendationsTable.status, ["PENDING", "SHOWN", "ACCEPTED", "MODIFIED"]),
          ),
        )
        .orderBy(desc(recommendationsTable.createdAt))
        .limit(20)
    : [];

  const congestion = await db
    .select()
    .from(portCongestionSnapshotsTable)
    .where(
      and(
        eq(portCongestionSnapshotsTable.portCode, portCode),
        or(eq(portCongestionSnapshotsTable.companyId, companyId), sql`${portCongestionSnapshotsTable.companyId} IS NULL`),
      ),
    )
    .orderBy(desc(portCongestionSnapshotsTable.snapshotTimestamp))
    .limit(10);

  const weather = await db
    .select()
    .from(weatherRiskEventsTable)
    .where(
      or(eq(weatherRiskEventsTable.companyId, companyId), sql`${weatherRiskEventsTable.companyId} IS NULL`),
    )
    .limit(50);

  const portWeather = weather.filter((w) => {
    const ports = (w.affectedPorts as string[]) || [];
    return ports.includes(portCode);
  });

  const disruptions = await db
    .select()
    .from(disruptionEventsTable)
    .where(
      and(
        inArray(disruptionEventsTable.status, ["active", "monitoring"]),
        or(eq(disruptionEventsTable.companyId, companyId), sql`${disruptionEventsTable.companyId} IS NULL`),
      ),
    )
    .limit(50);

  const portDisruptions = disruptions.filter((d) => {
    const ports = (d.affectedPorts as string[]) || [];
    return ports.includes(portCode);
  });

  const relatedLanes = await db
    .select()
    .from(laneScoresTable)
    .where(
      and(
        eq(laneScoresTable.companyId, companyId),
        or(
          eq(laneScoresTable.originPort, portCode),
          eq(laneScoresTable.destinationPort, portCode),
        ),
      ),
    )
    .orderBy(desc(laneScoresTable.compositeStressScore))
    .limit(10);

  res.json({
    data: {
      portCode,
      score: score || null,
      shipments,
      recommendations: recommendations.map(serializeRec),
      signals: {
        congestion,
        weather: portWeather,
        disruptions: portDisruptions,
      },
      relatedLanes,
    },
  });
});

router.get("/dossiers/carriers/:carrierId", async (req: Request, res: Response) => {
  const companyId = (req as any).companyId as string;
  const carrierName = decodeURIComponent(String(req.params.carrierId));

  const [score] = await db
    .select()
    .from(carrierScoresTable)
    .where(
      and(
        eq(carrierScoresTable.companyId, companyId),
        eq(carrierScoresTable.carrierName, carrierName),
      ),
    )
    .limit(1);

  const shipments = await db
    .select({
      id: shipmentsTable.id,
      reference: shipmentsTable.reference,
      status: shipmentsTable.status,
      shipperId: shipmentsTable.shipperId,
      consigneeId: shipmentsTable.consigneeId,
      vessel: shipmentsTable.vessel,
      portOfLoading: shipmentsTable.portOfLoading,
      portOfDischarge: shipmentsTable.portOfDischarge,
      etd: shipmentsTable.etd,
      eta: shipmentsTable.eta,
    })
    .from(shipmentsTable)
    .where(
      and(
        eq(shipmentsTable.companyId, companyId),
        eq(shipmentsTable.carrierId, carrierName),
      ),
    )
    .orderBy(desc(shipmentsTable.updatedAt))
    .limit(20);

  const shipmentIds = shipments.map((s) => s.id);

  const recommendations = shipmentIds.length > 0
    ? await db
        .select()
        .from(recommendationsTable)
        .where(
          and(
            eq(recommendationsTable.companyId, companyId),
            inArray(recommendationsTable.shipmentId, shipmentIds),
            inArray(recommendationsTable.status, ["PENDING", "SHOWN", "ACCEPTED", "MODIFIED"]),
          ),
        )
        .orderBy(desc(recommendationsTable.createdAt))
        .limit(20)
    : [];

  const outcomes = shipmentIds.length > 0
    ? await db
        .select({
          action: recommendationOutcomesTable.action,
          evaluation: recommendationOutcomesTable.outcomeEvaluation,
          cnt: count(),
        })
        .from(recommendationOutcomesTable)
        .where(
          and(
            eq(recommendationOutcomesTable.companyId, companyId),
            inArray(recommendationOutcomesTable.shipmentId, shipmentIds),
          ),
        )
        .groupBy(recommendationOutcomesTable.action, recommendationOutcomesTable.outcomeEvaluation)
    : [];

  const graphEdges = await db
    .select()
    .from(tradeGraphEdgesTable)
    .where(
      and(
        eq(tradeGraphEdgesTable.companyId, companyId),
        eq(tradeGraphEdgesTable.edgeType, "SHIPPER_USES_CARRIER"),
        eq(tradeGraphEdgesTable.targetId, carrierName),
      ),
    )
    .limit(20);

  const laneExposure = await db
    .select()
    .from(laneScoresTable)
    .where(eq(laneScoresTable.companyId, companyId))
    .orderBy(desc(laneScoresTable.compositeStressScore))
    .limit(50);

  const carrierPorts = [...new Set(shipments.flatMap((s) => [s.portOfLoading, s.portOfDischarge]).filter(Boolean) as string[])];
  const relevantLanes = laneExposure.filter(
    (l) => carrierPorts.includes(l.originPort) || carrierPorts.includes(l.destinationPort),
  );

  res.json({
    data: {
      carrierName,
      score: score || null,
      shipments,
      recommendations: recommendations.map(serializeRec),
      outcomePatterns: outcomes.map((o) => ({
        action: o.action,
        evaluation: o.evaluation,
        count: Number(o.cnt),
      })),
      graphEdges,
      laneExposure: relevantLanes.slice(0, 10),
    },
  });
});

router.get("/dossiers/entities/:entityId", async (req: Request, res: Response) => {
  const companyId = (req as any).companyId as string;
  const entityName = decodeURIComponent(String(req.params.entityId));

  const [score] = await db
    .select()
    .from(entityScoresTable)
    .where(
      and(
        eq(entityScoresTable.companyId, companyId),
        or(
          eq(entityScoresTable.entityId, entityName),
          eq(entityScoresTable.entityName, entityName),
        ),
      ),
    )
    .limit(1);

  const shipments = await db
    .select({
      id: shipmentsTable.id,
      reference: shipmentsTable.reference,
      status: shipmentsTable.status,
      shipperId: shipmentsTable.shipperId,
      consigneeId: shipmentsTable.consigneeId,
      carrierId: shipmentsTable.carrierId,
      portOfLoading: shipmentsTable.portOfLoading,
      portOfDischarge: shipmentsTable.portOfDischarge,
    })
    .from(shipmentsTable)
    .where(
      and(
        eq(shipmentsTable.companyId, companyId),
        or(
          eq(shipmentsTable.shipperId, entityName),
          eq(shipmentsTable.consigneeId, entityName),
          eq(shipmentsTable.notifyPartyId, entityName),
        ),
      ),
    )
    .orderBy(desc(shipmentsTable.updatedAt))
    .limit(20);

  const sanctionsMatches = await db
    .select()
    .from(tradeGraphEdgesTable)
    .where(
      and(
        eq(tradeGraphEdgesTable.companyId, companyId),
        inArray(tradeGraphEdgesTable.edgeType, ["ENTITY_SANCTIONS_MATCH", "ENTITY_DENIED_PARTY_MATCH"]),
        or(
          eq(tradeGraphEdgesTable.sourceId, entityName),
          eq(tradeGraphEdgesTable.targetId, entityName),
        ),
      ),
    )
    .limit(20);

  const sanctionsData = await db
    .select()
    .from(sanctionsEntitiesTable)
    .where(
      or(eq(sanctionsEntitiesTable.companyId, companyId), sql`${sanctionsEntitiesTable.companyId} IS NULL`),
    )
    .limit(100);

  const relevantSanctions = sanctionsData.filter(
    (s) => s.entityName.toLowerCase().includes(entityName.toLowerCase()) ||
           entityName.toLowerCase().includes(s.entityName.toLowerCase()),
  );

  const deniedParties = await db
    .select()
    .from(deniedPartiesTable)
    .where(
      or(eq(deniedPartiesTable.companyId, companyId), sql`${deniedPartiesTable.companyId} IS NULL`),
    )
    .limit(100);

  const relevantDenied = deniedParties.filter(
    (d) => d.partyName.toLowerCase().includes(entityName.toLowerCase()) ||
           entityName.toLowerCase().includes(d.partyName.toLowerCase()),
  );

  const shipmentIds = shipments.map((s) => s.id);
  const recommendations = shipmentIds.length > 0
    ? await db
        .select()
        .from(recommendationsTable)
        .where(
          and(
            eq(recommendationsTable.companyId, companyId),
            inArray(recommendationsTable.shipmentId, shipmentIds),
            inArray(recommendationsTable.type, ["COMPLIANCE_ESCALATION", "RISK_MITIGATION"]),
          ),
        )
        .orderBy(desc(recommendationsTable.createdAt))
        .limit(20)
    : [];

  const graphEdges = await db
    .select()
    .from(tradeGraphEdgesTable)
    .where(
      and(
        eq(tradeGraphEdgesTable.companyId, companyId),
        or(
          eq(tradeGraphEdgesTable.sourceId, entityName),
          eq(tradeGraphEdgesTable.targetId, entityName),
        ),
      ),
    )
    .limit(30);

  res.json({
    data: {
      entityName,
      score: score || null,
      shipments,
      recommendations: recommendations.map(serializeRec),
      complianceSignals: {
        sanctionsMatches,
        relevantSanctions,
        relevantDenied,
      },
      graphEdges,
    },
  });
});

router.get("/dossiers/graph/:nodeType/:nodeId", async (req: Request, res: Response) => {
  const companyId = (req as any).companyId as string;
  const nodeType = String(req.params.nodeType);
  const decodedId = decodeURIComponent(String(req.params.nodeId));

  const outgoing = await db
    .select()
    .from(tradeGraphEdgesTable)
    .where(
      and(
        eq(tradeGraphEdgesTable.companyId, companyId),
        eq(tradeGraphEdgesTable.sourceId, decodedId),
      ),
    )
    .limit(50);

  const incoming = await db
    .select()
    .from(tradeGraphEdgesTable)
    .where(
      and(
        eq(tradeGraphEdgesTable.companyId, companyId),
        eq(tradeGraphEdgesTable.targetId, decodedId),
      ),
    )
    .limit(50);

  const allEdges = [...outgoing, ...incoming];
  const connectedIds = new Set<string>();
  for (const e of allEdges) {
    if (e.sourceId !== decodedId) connectedIds.add(e.sourceId);
    if (e.targetId !== decodedId) connectedIds.add(e.targetId);
  }

  const edgeTypeCounts: Record<string, number> = {};
  for (const e of allEdges) {
    edgeTypeCounts[e.edgeType] = (edgeTypeCounts[e.edgeType] || 0) + 1;
  }

  res.json({
    data: {
      nodeType,
      nodeId: decodedId,
      edges: allEdges,
      connectedNodeCount: connectedIds.size,
      edgeTypeSummary: edgeTypeCounts,
    },
  });
});

function serializeRec(r: typeof recommendationsTable.$inferSelect) {
  return {
    ...r,
    confidence: Number(r.confidence),
    expectedDelayImpactDays: r.expectedDelayImpactDays != null ? Number(r.expectedDelayImpactDays) : null,
    expectedMarginImpactPct: r.expectedMarginImpactPct != null ? Number(r.expectedMarginImpactPct) : null,
    expectedRiskReduction: r.expectedRiskReduction != null ? Number(r.expectedRiskReduction) : null,
  };
}

export default router;
