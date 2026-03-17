import { db } from "@workspace/db";
import {
  networkRecommendationsTable,
  laneScoresTable,
  carrierScoresTable,
  portCongestionSnapshotsTable,
  entityScoresTable,
  laneStrategiesTable,
  carrierAllocationsTable,
} from "@workspace/db/schema";
import { generateId } from "@workspace/shared-utils";
import { eq, and, desc, gte, sql, or } from "drizzle-orm";

interface NetworkRecEvidence {
  signal: string;
  value: number | string;
  threshold: number | string;
  source: string;
}

export interface NetworkRecommendationResult {
  id: string;
  scope: "LANE" | "CARRIER" | "PORT" | "ENTITY";
  scopeIdentifier: string;
  type: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  evidence: NetworkRecEvidence[];
  suggestedAction: string;
  estimatedImpact: { riskReduction: number | null; costImpact: number | null; delayReduction: number | null } | null;
  status: string;
  fingerprint: string;
}

export async function generateNetworkRecommendations(
  companyId: string,
): Promise<NetworkRecommendationResult[]> {
  const [lanes, carriers, congestion, entities, laneStrats, carrierAllocs] = await Promise.all([
    db.select().from(laneScoresTable).where(eq(laneScoresTable.companyId, companyId)),
    db.select().from(carrierScoresTable).where(eq(carrierScoresTable.companyId, companyId)),
    db.select().from(portCongestionSnapshotsTable).where(
      and(
        or(eq(portCongestionSnapshotsTable.companyId, companyId), sql`${portCongestionSnapshotsTable.companyId} IS NULL`),
        gte(portCongestionSnapshotsTable.snapshotTimestamp, new Date(Date.now() - 7 * 86400000)),
      ),
    ).orderBy(desc(portCongestionSnapshotsTable.snapshotTimestamp)),
    db.select().from(entityScoresTable).where(eq(entityScoresTable.companyId, companyId)),
    db.select().from(laneStrategiesTable).where(eq(laneStrategiesTable.companyId, companyId))
      .orderBy(desc(laneStrategiesTable.computedAt)).limit(100),
    db.select().from(carrierAllocationsTable).where(eq(carrierAllocationsTable.companyId, companyId))
      .orderBy(desc(carrierAllocationsTable.computedAt)).limit(100),
  ]);

  const existing = await db
    .select({ fingerprint: networkRecommendationsTable.fingerprint })
    .from(networkRecommendationsTable)
    .where(
      and(
        eq(networkRecommendationsTable.companyId, companyId),
        eq(networkRecommendationsTable.status, "OPEN"),
      ),
    );
  const existingFps = new Set(existing.map((e) => e.fingerprint));

  const recs: NetworkRecommendationResult[] = [];

  const latestCongestion = new Map<string, typeof congestion[0]>();
  for (const c of congestion) {
    if (!latestCongestion.has(c.portCode)) {
      latestCongestion.set(c.portCode, c);
    }
  }

  for (const [portCode, snap] of latestCongestion) {
    if (snap.congestionLevel === "critical" || snap.congestionLevel === "high") {
      const fp = `nr-port-traffic-${portCode}`;
      if (!existingFps.has(fp)) {
        recs.push(buildRec(
          "PORT", portCode, "REDUCE_PORT_TRAFFIC",
          snap.congestionLevel === "critical" ? "CRITICAL" : "HIGH",
          `Reduce traffic through ${snap.portName}`,
          `Port ${snap.portName} (${portCode}) is experiencing ${snap.congestionLevel} congestion with ${snap.waitingVessels ?? "unknown"} waiting vessels and ${snap.avgWaitDays?.toFixed(1) ?? "unknown"} avg wait days.`,
          [{ signal: "congestion_level", value: snap.congestionLevel, threshold: "high", source: "port_congestion_snapshots" },
           { signal: "avg_wait_days", value: snap.avgWaitDays ?? 0, threshold: 3, source: "port_congestion_snapshots" }],
          "Route shipments through alternate ports where feasible; defer non-urgent bookings.",
          { riskReduction: 0.15, costImpact: null, delayReduction: snap.avgWaitDays ? snap.avgWaitDays * 0.5 : null },
          fp,
        ));
      }
    }
  }

  for (const carrier of carriers) {
    if (carrier.reliabilityScore < 50 && carrier.compositeScore > 0.5) {
      const fp = `nr-carrier-shift-${carrier.carrierName}`;
      if (!existingFps.has(fp)) {
        recs.push(buildRec(
          "CARRIER", carrier.carrierName, "SHIFT_CARRIER_VOLUME",
          carrier.reliabilityScore < 30 ? "CRITICAL" : "HIGH",
          `Shift volume away from ${carrier.carrierName}`,
          `Carrier ${carrier.carrierName} has reliability score ${carrier.reliabilityScore.toFixed(0)} and composite risk ${carrier.compositeScore.toFixed(2)}.`,
          [{ signal: "reliability_score", value: carrier.reliabilityScore, threshold: 50, source: "carrier_scores" },
           { signal: "composite_score", value: carrier.compositeScore, threshold: 0.5, source: "carrier_scores" }],
          "Reduce allocation to this carrier and redistribute to higher-performing alternatives.",
          { riskReduction: 0.1, costImpact: null, delayReduction: null },
          fp,
        ));
      }
    }
  }

  for (const lane of lanes) {
    if (lane.compositeStressScore >= 0.7) {
      const fp = `nr-lane-gates-${lane.originPort}-${lane.destinationPort}`;
      if (!existingFps.has(fp)) {
        recs.push(buildRec(
          "LANE", `${lane.originPort}-${lane.destinationPort}`, "TIGHTEN_RELEASE_GATES",
          lane.compositeStressScore >= 0.85 ? "CRITICAL" : "HIGH",
          `Tighten release gates on ${lane.originPort} → ${lane.destinationPort}`,
          `Lane composite stress score is ${lane.compositeStressScore.toFixed(2)}, indicating elevated operational risk.`,
          [{ signal: "composite_stress", value: lane.compositeStressScore, threshold: 0.7, source: "lane_scores" }],
          "Apply stricter booking and release gate thresholds for this lane.",
          { riskReduction: 0.12, costImpact: null, delayReduction: null },
          fp,
        ));
      }
    }

    if (lane.disruptionScore >= 0.6 && lane.congestionScore >= 0.5) {
      const fp = `nr-lane-diversify-${lane.originPort}-${lane.destinationPort}`;
      if (!existingFps.has(fp)) {
        recs.push(buildRec(
          "LANE", `${lane.originPort}-${lane.destinationPort}`, "DIVERSIFY_ROUTING",
          "HIGH",
          `Diversify routing for ${lane.originPort} → ${lane.destinationPort}`,
          `Lane has elevated disruption (${lane.disruptionScore.toFixed(2)}) and congestion (${lane.congestionScore.toFixed(2)}) scores.`,
          [{ signal: "disruption_score", value: lane.disruptionScore, threshold: 0.6, source: "lane_scores" },
           { signal: "congestion_score", value: lane.congestionScore, threshold: 0.5, source: "lane_scores" }],
          "Identify alternative routing options to reduce concentration risk.",
          { riskReduction: 0.15, costImpact: null, delayReduction: 1.5 },
          fp,
        ));
      }
    }
  }

  for (const entity of entities) {
    if (entity.compositeScore >= 0.6) {
      const fp = `nr-entity-compliance-${entity.entityId}`;
      if (!existingFps.has(fp)) {
        recs.push(buildRec(
          "ENTITY", entity.entityName, "ESCALATE_COMPLIANCE",
          entity.compositeScore >= 0.8 ? "CRITICAL" : "HIGH",
          `Escalate compliance review for ${entity.entityName}`,
          `Entity composite compliance risk is ${entity.compositeScore.toFixed(2)}, with sanctions risk ${entity.sanctionsRiskScore.toFixed(2)}.`,
          [{ signal: "composite_score", value: entity.compositeScore, threshold: 0.6, source: "entity_scores" },
           { signal: "sanctions_risk", value: entity.sanctionsRiskScore, threshold: 0.4, source: "entity_scores" }],
          "Conduct enhanced due diligence and consider restricting new shipments.",
          { riskReduction: 0.2, costImpact: null, delayReduction: null },
          fp,
        ));
      }
    }
  }

  if (recs.length > 0) {
    await db
      .insert(networkRecommendationsTable)
      .values(
        recs.map((r) => ({
          id: r.id,
          companyId,
          scope: r.scope as any,
          scopeIdentifier: r.scopeIdentifier,
          type: r.type as any,
          priority: r.priority as any,
          title: r.title,
          description: r.description,
          evidence: r.evidence,
          suggestedAction: r.suggestedAction,
          estimatedImpact: r.estimatedImpact,
          status: "OPEN" as const,
          fingerprint: r.fingerprint,
          computedAt: new Date(),
        })),
      );
  }

  return recs.sort((a, b) => {
    const prio = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return (prio[a.priority] ?? 3) - (prio[b.priority] ?? 3);
  });
}

export async function getNetworkRecommendations(
  companyId: string,
  filters?: { scope?: string; status?: string },
): Promise<NetworkRecommendationResult[]> {
  let query = db
    .select()
    .from(networkRecommendationsTable)
    .where(eq(networkRecommendationsTable.companyId, companyId))
    .orderBy(desc(networkRecommendationsTable.computedAt))
    .limit(100);

  const rows = await query;

  return rows
    .filter((r) => {
      if (filters?.scope && r.scope !== filters.scope) return false;
      if (filters?.status && r.status !== filters.status) return false;
      return true;
    })
    .map((r) => ({
      id: r.id,
      scope: r.scope as "LANE" | "CARRIER" | "PORT" | "ENTITY",
      scopeIdentifier: r.scopeIdentifier,
      type: r.type,
      priority: r.priority as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      title: r.title,
      description: r.description,
      evidence: r.evidence as NetworkRecEvidence[],
      suggestedAction: r.suggestedAction,
      estimatedImpact: r.estimatedImpact as any,
      status: r.status,
      fingerprint: r.fingerprint,
    }));
}

export async function acknowledgeNetworkRecommendation(
  id: string,
  userId: string,
  companyId?: string,
): Promise<boolean> {
  const conditions = companyId
    ? and(eq(networkRecommendationsTable.id, id), eq(networkRecommendationsTable.companyId, companyId))
    : eq(networkRecommendationsTable.id, id);
  await db
    .update(networkRecommendationsTable)
    .set({
      status: "ACKNOWLEDGED",
      acknowledgedBy: userId,
      acknowledgedAt: new Date(),
    })
    .where(conditions);
  return true;
}

export async function updateNetworkRecommendationStatus(
  id: string,
  status: "IN_PROGRESS" | "IMPLEMENTED" | "DISMISSED",
  companyId?: string,
): Promise<boolean> {
  const conditions = companyId
    ? and(eq(networkRecommendationsTable.id, id), eq(networkRecommendationsTable.companyId, companyId))
    : eq(networkRecommendationsTable.id, id);
  await db
    .update(networkRecommendationsTable)
    .set({ status })
    .where(conditions);
  return true;
}

function buildRec(
  scope: "LANE" | "CARRIER" | "PORT" | "ENTITY",
  scopeId: string,
  type: string,
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  title: string,
  description: string,
  evidence: NetworkRecEvidence[],
  suggestedAction: string,
  estimatedImpact: { riskReduction: number | null; costImpact: number | null; delayReduction: number | null } | null,
  fingerprint: string,
): NetworkRecommendationResult {
  return {
    id: generateId("nrec"),
    scope,
    scopeIdentifier: scopeId,
    type,
    priority,
    title,
    description,
    evidence,
    suggestedAction,
    estimatedImpact,
    status: "OPEN",
    fingerprint,
  };
}
