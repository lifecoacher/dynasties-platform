import { db } from "@workspace/db";
import {
  intelligenceSourcesTable,
  ingestionRunsTable,
  vesselPositionsTable,
  vesselPortCallsTable,
  portCongestionSnapshotsTable,
  sanctionsEntitiesTable,
  deniedPartiesTable,
  disruptionEventsTable,
  weatherRiskEventsTable,
  laneMarketSignalsTable,
  eventsTable,
} from "@workspace/db/schema";
import { sql } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import { eq, and } from "drizzle-orm";
import { publishIntelligenceLinkingJob, publishReanalysisJob } from "@workspace/queue";
import { computeFingerprint } from "./fingerprint.js";
import {
  VesselPositionAdapter,
  PortCongestionAdapter,
  SanctionsAdapter,
  DeniedPartiesAdapter,
  DisruptionAdapter,
  WeatherRiskAdapter,
} from "./adapters/index.js";
import type {
  VesselPositionRecord,
  PortCongestionRecord,
  SanctionsRecord,
  DeniedPartyRecord,
  DisruptionRecord,
  WeatherRiskRecord,
  IntelligenceAdapter,
} from "./adapters/index.js";

function getAdapter(sourceType: string): IntelligenceAdapter<any> {
  switch (sourceType) {
    case "vessel_positions": return new VesselPositionAdapter();
    case "port_congestion": return new PortCongestionAdapter();
    case "sanctions": return new SanctionsAdapter();
    case "denied_parties": return new DeniedPartiesAdapter();
    case "disruptions": return new DisruptionAdapter();
    case "weather_risk": return new WeatherRiskAdapter();
    default: throw new Error(`No adapter for source type: ${sourceType}`);
  }
}

export async function runIngestionPipeline(
  sourceId: string,
  sourceType: string,
  companyId: string | null,
): Promise<{ runId: string; persisted: number; deduplicated: number; failed: number }> {
  const runId = generateId();
  const effectiveCompanyId = companyId || "GLOBAL";

  await db.insert(ingestionRunsTable).values({
    id: runId,
    companyId: companyId,
    sourceId,
    sourceType,
    status: "running",
    startedAt: new Date(),
  });

  try {
    const adapter = getAdapter(sourceType);
    const rawRecords = await adapter.fetch();

    const { valid, invalid } = adapter.validate(rawRecords);

    await db
      .update(ingestionRunsTable)
      .set({ recordsFetched: rawRecords.length, recordsValidated: valid.length, recordsFailed: invalid })
      .where(eq(ingestionRunsTable.id, runId));

    let persisted = 0;
    let deduplicated = 0;
    const persistedIds: string[] = [];

    switch (sourceType) {
      case "vessel_positions":
        ({ persisted, deduplicated } = await persistVesselPositions(valid as VesselPositionRecord[], sourceId, companyId));
        break;
      case "port_congestion":
        ({ persisted, deduplicated } = await persistPortCongestion(valid as PortCongestionRecord[], sourceId, companyId));
        break;
      case "sanctions":
        ({ persisted, deduplicated } = await persistSanctions(valid as SanctionsRecord[], sourceId, companyId));
        break;
      case "denied_parties":
        ({ persisted, deduplicated } = await persistDeniedParties(valid as DeniedPartyRecord[], sourceId, companyId));
        break;
      case "disruptions":
        ({ persisted, deduplicated } = await persistDisruptions(valid as DisruptionRecord[], sourceId, companyId));
        break;
      case "weather_risk":
        ({ persisted, deduplicated } = await persistWeatherRisk(valid as WeatherRiskRecord[], sourceId, companyId));
        break;
    }

    await db
      .update(ingestionRunsTable)
      .set({
        status: invalid > 0 ? "partial" : "completed",
        recordsPersisted: persisted,
        recordsDeduplicated: deduplicated,
        recordsFailed: invalid,
        completedAt: new Date(),
      })
      .where(eq(ingestionRunsTable.id, runId));

    await db
      .update(intelligenceSourcesTable)
      .set({
        lastSyncedAt: new Date(),
        lastSuccessAt: new Date(),
        failureCount: 0,
      })
      .where(eq(intelligenceSourcesTable.id, sourceId));

    if (persisted > 0 && companyId) {
      publishIntelligenceLinkingJob({
        companyId,
        sourceType,
        recordIds: persistedIds,
        ingestionRunId: runId,
      });

      const affectedContext = collectAffectedContext(sourceType, valid);
      publishReanalysisJob({
        companyId,
        sourceType,
        ingestionRunId: runId,
        affectedPorts: affectedContext.portCodes,
        affectedLanes: affectedContext.laneKeys,
        affectedEntities: affectedContext.entityIds,
        affectedVessels: affectedContext.vesselNames,
      });
    }

    await db.insert(eventsTable).values({
      id: generateId(),
      companyId: companyId,
      eventType: "INTELLIGENCE_INGESTED",
      entityType: "intelligence_source",
      entityId: sourceId,
      actorType: "SERVICE",
      serviceId: "intelligence-ingestion",
      metadata: {
        runId,
        sourceType,
        fetched: rawRecords.length,
        validated: valid.length,
        persisted,
        deduplicated,
        failed: invalid,
      },
    });

    console.log(
      `[intelligence-ingestion] ${sourceType} completed: fetched=${rawRecords.length} persisted=${persisted} deduped=${deduplicated} failed=${invalid}`,
    );

    return { runId, persisted, deduplicated, failed: invalid };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await db
      .update(ingestionRunsTable)
      .set({
        status: "failed",
        errorMessage: errMsg,
        completedAt: new Date(),
      })
      .where(eq(ingestionRunsTable.id, runId));

    await db
      .update(intelligenceSourcesTable)
      .set({
        lastSyncedAt: new Date(),
        lastFailureAt: new Date(),
        failureCount: sql`${intelligenceSourcesTable.failureCount} + 1`,
      })
      .where(eq(intelligenceSourcesTable.id, sourceId))
      .catch(() => {});

    throw err;
  }
}

async function persistVesselPositions(
  records: VesselPositionRecord[],
  sourceId: string,
  companyId: string | null,
): Promise<{ persisted: number; deduplicated: number }> {
  let persisted = 0;
  let deduplicated = 0;

  for (const r of records) {
    const fp = computeFingerprint(r.vesselName, r.imo, r.mmsi, r.positionTimestamp);
    const existing = await db
      .select({ id: vesselPositionsTable.id })
      .from(vesselPositionsTable)
      .where(eq(vesselPositionsTable.fingerprint, fp))
      .limit(1);

    if (existing.length > 0) {
      deduplicated++;
      continue;
    }

    await db.insert(vesselPositionsTable).values({
      id: generateId(),
      companyId,
      sourceId,
      vesselName: r.vesselName,
      imo: r.imo ?? null,
      mmsi: r.mmsi ?? null,
      latitude: r.latitude,
      longitude: r.longitude,
      heading: r.heading ?? null,
      speed: r.speed ?? null,
      status: r.status,
      destination: r.destination ?? null,
      eta: r.eta ? new Date(r.eta) : null,
      fingerprint: fp,
      positionTimestamp: new Date(r.positionTimestamp),
    });
    persisted++;
  }

  return { persisted, deduplicated };
}

async function persistPortCongestion(
  records: PortCongestionRecord[],
  sourceId: string,
  companyId: string | null,
): Promise<{ persisted: number; deduplicated: number }> {
  let persisted = 0;
  let deduplicated = 0;

  for (const r of records) {
    const fp = computeFingerprint(r.portCode, r.snapshotTimestamp);
    const existing = await db
      .select({ id: portCongestionSnapshotsTable.id })
      .from(portCongestionSnapshotsTable)
      .where(eq(portCongestionSnapshotsTable.fingerprint, fp))
      .limit(1);

    if (existing.length > 0) {
      deduplicated++;
      continue;
    }

    await db.insert(portCongestionSnapshotsTable).values({
      id: generateId(),
      companyId,
      sourceId,
      portCode: r.portCode,
      portName: r.portName,
      congestionLevel: r.congestionLevel,
      waitingVessels: r.waitingVessels ?? null,
      avgWaitDays: r.avgWaitDays ?? null,
      avgBerthDays: r.avgBerthDays ?? null,
      capacityUtilization: r.capacityUtilization ?? null,
      trendDirection: r.trendDirection ?? null,
      fingerprint: fp,
      snapshotTimestamp: new Date(r.snapshotTimestamp),
    });
    persisted++;
  }

  return { persisted, deduplicated };
}

async function persistSanctions(
  records: SanctionsRecord[],
  sourceId: string,
  companyId: string | null,
): Promise<{ persisted: number; deduplicated: number }> {
  let persisted = 0;
  let deduplicated = 0;

  for (const r of records) {
    const fp = computeFingerprint(r.listName, r.entityName, r.entityType);
    const existing = await db
      .select({ id: sanctionsEntitiesTable.id })
      .from(sanctionsEntitiesTable)
      .where(eq(sanctionsEntitiesTable.fingerprint, fp))
      .limit(1);

    if (existing.length > 0) {
      deduplicated++;
      continue;
    }

    await db.insert(sanctionsEntitiesTable).values({
      id: generateId(),
      companyId,
      sourceId,
      listName: r.listName,
      entityName: r.entityName,
      entityType: r.entityType,
      aliases: r.aliases ?? null,
      country: r.country ?? null,
      sanctionProgram: r.sanctionProgram ?? null,
      listingDate: r.listingDate ? new Date(r.listingDate) : null,
      expirationDate: r.expirationDate ? new Date(r.expirationDate) : null,
      identifiers: r.identifiers ?? null,
      status: r.status,
      fingerprint: fp,
      sourceQuality: r.sourceQuality ?? null,
    });
    persisted++;
  }

  return { persisted, deduplicated };
}

async function persistDeniedParties(
  records: DeniedPartyRecord[],
  sourceId: string,
  companyId: string | null,
): Promise<{ persisted: number; deduplicated: number }> {
  let persisted = 0;
  let deduplicated = 0;

  for (const r of records) {
    const fp = computeFingerprint(r.listName, r.partyName, r.partyType);
    const existing = await db
      .select({ id: deniedPartiesTable.id })
      .from(deniedPartiesTable)
      .where(eq(deniedPartiesTable.fingerprint, fp))
      .limit(1);

    if (existing.length > 0) {
      deduplicated++;
      continue;
    }

    await db.insert(deniedPartiesTable).values({
      id: generateId(),
      companyId,
      sourceId,
      listName: r.listName,
      partyName: r.partyName,
      partyType: r.partyType,
      country: r.country ?? null,
      address: r.address ?? null,
      reason: r.reason ?? null,
      aliases: r.aliases ?? null,
      status: r.status,
      fingerprint: fp,
      sourceQuality: r.sourceQuality ?? null,
      listingDate: r.listingDate ? new Date(r.listingDate) : null,
    });
    persisted++;
  }

  return { persisted, deduplicated };
}

async function persistDisruptions(
  records: DisruptionRecord[],
  sourceId: string,
  companyId: string | null,
): Promise<{ persisted: number; deduplicated: number }> {
  let persisted = 0;
  let deduplicated = 0;

  for (const r of records) {
    const fp = computeFingerprint(r.eventType, r.title, r.startDate);
    const existing = await db
      .select({ id: disruptionEventsTable.id })
      .from(disruptionEventsTable)
      .where(eq(disruptionEventsTable.fingerprint, fp))
      .limit(1);

    if (existing.length > 0) {
      deduplicated++;
      continue;
    }

    await db.insert(disruptionEventsTable).values({
      id: generateId(),
      companyId,
      sourceId,
      eventType: r.eventType,
      title: r.title,
      description: r.description ?? null,
      severity: r.severity,
      status: r.status,
      affectedRegion: r.affectedRegion ?? null,
      affectedPorts: r.affectedPorts ?? null,
      affectedLanes: r.affectedLanes ?? null,
      estimatedImpactDays: r.estimatedImpactDays ?? null,
      confidence: r.confidence ?? null,
      startDate: new Date(r.startDate),
      expectedEndDate: r.expectedEndDate ? new Date(r.expectedEndDate) : null,
      fingerprint: fp,
    });
    persisted++;
  }

  return { persisted, deduplicated };
}

async function persistWeatherRisk(
  records: WeatherRiskRecord[],
  sourceId: string,
  companyId: string | null,
): Promise<{ persisted: number; deduplicated: number }> {
  let persisted = 0;
  let deduplicated = 0;

  for (const r of records) {
    const fp = computeFingerprint(r.eventType, r.title, r.forecastDate);
    const existing = await db
      .select({ id: weatherRiskEventsTable.id })
      .from(weatherRiskEventsTable)
      .where(eq(weatherRiskEventsTable.fingerprint, fp))
      .limit(1);

    if (existing.length > 0) {
      deduplicated++;
      continue;
    }

    await db.insert(weatherRiskEventsTable).values({
      id: generateId(),
      companyId,
      sourceId,
      eventType: r.eventType,
      title: r.title,
      description: r.description ?? null,
      severity: r.severity,
      status: r.status,
      affectedRegion: r.affectedRegion ?? null,
      affectedPorts: r.affectedPorts ?? null,
      latitude: r.latitude ?? null,
      longitude: r.longitude ?? null,
      radiusKm: r.radiusKm ?? null,
      windSpeedKnots: r.windSpeedKnots ?? null,
      confidence: r.confidence ?? null,
      forecastDate: new Date(r.forecastDate),
      expectedStartDate: r.expectedStartDate ? new Date(r.expectedStartDate) : null,
      expectedEndDate: r.expectedEndDate ? new Date(r.expectedEndDate) : null,
      fingerprint: fp,
    });
    persisted++;
  }

  return { persisted, deduplicated };
}

function collectAffectedContext(
  sourceType: string,
  records: any[],
): { portCodes: string[]; laneKeys: string[]; entityIds: string[]; vesselNames: string[] } {
  const portCodes = new Set<string>();
  const laneKeys = new Set<string>();
  const entityIds = new Set<string>();
  const vesselNames = new Set<string>();

  for (const r of records) {
    switch (sourceType) {
      case "port_congestion":
        if (r.portCode) portCodes.add(r.portCode);
        break;
      case "disruptions":
      case "weather_risk":
        if (r.affectedPorts) {
          for (const p of r.affectedPorts) portCodes.add(p);
        }
        if (r.affectedLanes) {
          for (const l of r.affectedLanes) laneKeys.add(l);
        }
        break;
      case "sanctions":
      case "denied_parties":
        if (r.entityName) entityIds.add(r.entityName);
        if (r.partyName) entityIds.add(r.partyName);
        break;
      case "vessel_positions":
        if (r.vesselName) vesselNames.add(r.vesselName);
        break;
    }
  }

  return {
    portCodes: [...portCodes],
    laneKeys: [...laneKeys],
    entityIds: [...entityIds],
    vesselNames: [...vesselNames],
  };
}

export { computeFingerprint } from "./fingerprint.js";
export {
  VesselPositionAdapter,
  PortCongestionAdapter,
  SanctionsAdapter,
  DeniedPartiesAdapter,
  DisruptionAdapter,
  WeatherRiskAdapter,
} from "./adapters/index.js";
