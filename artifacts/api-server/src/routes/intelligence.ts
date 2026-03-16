import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  intelligenceSourcesTable,
  ingestionRunsTable,
  vesselPositionsTable,
  portCongestionSnapshotsTable,
  sanctionsEntitiesTable,
  deniedPartiesTable,
  disruptionEventsTable,
  weatherRiskEventsTable,
  laneMarketSignalsTable,
  shipmentsTable,
} from "@workspace/db/schema";
import { eq, and, desc, inArray, or, sql } from "drizzle-orm";
import { getCompanyId } from "../middlewares/tenant.js";
import { requireMinRole } from "../middlewares/auth.js";
import { generateId } from "@workspace/shared-utils";
import { publishIngestionJob } from "@workspace/queue";

const router: IRouter = Router();

router.get("/intelligence/sources", async (req, res) => {
  const companyId = getCompanyId(req);
  const sources = await db
    .select()
    .from(intelligenceSourcesTable)
    .where(
      or(
        eq(intelligenceSourcesTable.companyId, companyId),
        sql`${intelligenceSourcesTable.companyId} IS NULL`,
      ),
    )
    .orderBy(desc(intelligenceSourcesTable.createdAt));

  res.json({ data: sources });
});

router.get("/intelligence/ports/high-risk", async (req, res) => {
  const companyId = getCompanyId(req);

  const congestion = await db
    .select()
    .from(portCongestionSnapshotsTable)
    .where(
      and(
        or(
          eq(portCongestionSnapshotsTable.companyId, companyId),
          sql`${portCongestionSnapshotsTable.companyId} IS NULL`,
        ),
        inArray(portCongestionSnapshotsTable.congestionLevel, ["high", "critical"]),
      ),
    )
    .orderBy(desc(portCongestionSnapshotsTable.snapshotTimestamp))
    .limit(20);

  const disruptions = await db
    .select()
    .from(disruptionEventsTable)
    .where(
      and(
        or(
          eq(disruptionEventsTable.companyId, companyId),
          sql`${disruptionEventsTable.companyId} IS NULL`,
        ),
        inArray(disruptionEventsTable.status, ["active", "monitoring"]),
      ),
    )
    .orderBy(desc(disruptionEventsTable.startDate))
    .limit(20);

  const portRisks = new Map<string, { portCode: string; portName: string; congestionLevel: string | null; disruptions: string[]; weatherAlerts: string[] }>();

  for (const c of congestion) {
    portRisks.set(c.portCode, {
      portCode: c.portCode,
      portName: c.portName,
      congestionLevel: c.congestionLevel,
      disruptions: [],
      weatherAlerts: [],
    });
  }

  for (const d of disruptions) {
    const ports = (d.affectedPorts as string[]) || [];
    for (const port of ports) {
      if (!portRisks.has(port)) {
        portRisks.set(port, { portCode: port, portName: port, congestionLevel: null, disruptions: [], weatherAlerts: [] });
      }
      portRisks.get(port)!.disruptions.push(d.title);
    }
  }

  const weather = await db
    .select()
    .from(weatherRiskEventsTable)
    .where(
      and(
        or(
          eq(weatherRiskEventsTable.companyId, companyId),
          sql`${weatherRiskEventsTable.companyId} IS NULL`,
        ),
        inArray(weatherRiskEventsTable.status, ["forecast", "active"]),
      ),
    )
    .orderBy(desc(weatherRiskEventsTable.forecastDate))
    .limit(20);

  for (const w of weather) {
    const ports = (w.affectedPorts as string[]) || [];
    for (const port of ports) {
      if (!portRisks.has(port)) {
        portRisks.set(port, { portCode: port, portName: port, congestionLevel: null, disruptions: [], weatherAlerts: [] });
      }
      portRisks.get(port)!.weatherAlerts.push(w.title);
    }
  }

  res.json({ data: Array.from(portRisks.values()) });
});

router.get("/intelligence/disruptions", async (req, res) => {
  const companyId = getCompanyId(req);

  const disruptions = await db
    .select()
    .from(disruptionEventsTable)
    .where(
      and(
        or(
          eq(disruptionEventsTable.companyId, companyId),
          sql`${disruptionEventsTable.companyId} IS NULL`,
        ),
        inArray(disruptionEventsTable.status, ["active", "monitoring"]),
      ),
    )
    .orderBy(desc(disruptionEventsTable.startDate))
    .limit(50);

  res.json({ data: disruptions });
});

router.get("/intelligence/weather-risks", async (req, res) => {
  const companyId = getCompanyId(req);

  const events = await db
    .select()
    .from(weatherRiskEventsTable)
    .where(
      and(
        or(
          eq(weatherRiskEventsTable.companyId, companyId),
          sql`${weatherRiskEventsTable.companyId} IS NULL`,
        ),
        inArray(weatherRiskEventsTable.status, ["forecast", "active"]),
      ),
    )
    .orderBy(desc(weatherRiskEventsTable.forecastDate))
    .limit(50);

  res.json({ data: events });
});

router.get("/intelligence/sanctions-alerts", async (req, res) => {
  const companyId = getCompanyId(req);

  const sanctions = await db
    .select()
    .from(sanctionsEntitiesTable)
    .where(
      and(
        or(
          eq(sanctionsEntitiesTable.companyId, companyId),
          sql`${sanctionsEntitiesTable.companyId} IS NULL`,
        ),
        eq(sanctionsEntitiesTable.status, "active"),
      ),
    )
    .orderBy(desc(sanctionsEntitiesTable.createdAt))
    .limit(50);

  const denied = await db
    .select()
    .from(deniedPartiesTable)
    .where(
      and(
        or(
          eq(deniedPartiesTable.companyId, companyId),
          sql`${deniedPartiesTable.companyId} IS NULL`,
        ),
        eq(deniedPartiesTable.status, "active"),
      ),
    )
    .orderBy(desc(deniedPartiesTable.createdAt))
    .limit(50);

  res.json({ data: { sanctions, deniedParties: denied } });
});

router.get("/intelligence/congestion", async (req, res) => {
  const companyId = getCompanyId(req);

  const snapshots = await db
    .select()
    .from(portCongestionSnapshotsTable)
    .where(
      or(
        eq(portCongestionSnapshotsTable.companyId, companyId),
        sql`${portCongestionSnapshotsTable.companyId} IS NULL`,
      ),
    )
    .orderBy(desc(portCongestionSnapshotsTable.snapshotTimestamp))
    .limit(50);

  res.json({ data: snapshots });
});

router.get("/intelligence/vessels", async (req, res) => {
  const companyId = getCompanyId(req);

  const positions = await db
    .select()
    .from(vesselPositionsTable)
    .where(
      or(
        eq(vesselPositionsTable.companyId, companyId),
        sql`${vesselPositionsTable.companyId} IS NULL`,
      ),
    )
    .orderBy(desc(vesselPositionsTable.positionTimestamp))
    .limit(50);

  res.json({ data: positions });
});

router.get("/intelligence/shipment/:id/summary", async (req, res) => {
  const companyId = getCompanyId(req);
  const shipmentId = req.params.id;

  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(
      and(
        eq(shipmentsTable.id, shipmentId),
        eq(shipmentsTable.companyId, companyId),
      ),
    )
    .limit(1);

  if (!shipment) {
    res.status(404).json({ error: "Shipment not found" });
    return;
  }

  const portCodes = [shipment.portOfLoading, shipment.portOfDischarge].filter(Boolean) as string[];

  const tenantOrGlobal = or(
    eq(portCongestionSnapshotsTable.companyId, companyId),
    sql`${portCongestionSnapshotsTable.companyId} IS NULL`,
  );

  const congestion = portCodes.length > 0
    ? await db
        .select()
        .from(portCongestionSnapshotsTable)
        .where(and(inArray(portCongestionSnapshotsTable.portCode, portCodes), tenantOrGlobal))
        .orderBy(desc(portCongestionSnapshotsTable.snapshotTimestamp))
        .limit(10)
    : [];

  const disruptions = await db
    .select()
    .from(disruptionEventsTable)
    .where(
      and(
        inArray(disruptionEventsTable.status, ["active", "monitoring"]),
        or(
          eq(disruptionEventsTable.companyId, companyId),
          sql`${disruptionEventsTable.companyId} IS NULL`,
        ),
      ),
    )
    .orderBy(desc(disruptionEventsTable.startDate))
    .limit(20);

  const relevantDisruptions = disruptions.filter((d) => {
    const ports = (d.affectedPorts as string[]) || [];
    const lanes = (d.affectedLanes as string[]) || [];
    const laneId = shipment.portOfLoading && shipment.portOfDischarge
      ? `${shipment.portOfLoading}-${shipment.portOfDischarge}`
      : null;
    return ports.some((p) => portCodes.includes(p)) || (laneId && lanes.includes(laneId));
  });

  const weather = await db
    .select()
    .from(weatherRiskEventsTable)
    .where(
      and(
        inArray(weatherRiskEventsTable.status, ["forecast", "active"]),
        or(
          eq(weatherRiskEventsTable.companyId, companyId),
          sql`${weatherRiskEventsTable.companyId} IS NULL`,
        ),
      ),
    )
    .limit(20);

  const relevantWeather = weather.filter((w) => {
    const ports = (w.affectedPorts as string[]) || [];
    return ports.some((p) => portCodes.includes(p));
  });

  res.json({
    data: {
      shipmentId,
      portCongestion: congestion,
      disruptions: relevantDisruptions,
      weatherRisks: relevantWeather,
    },
  });
});

router.get("/intelligence/ingestion-runs", async (req, res) => {
  const companyId = getCompanyId(req);

  const runs = await db
    .select()
    .from(ingestionRunsTable)
    .where(
      or(
        eq(ingestionRunsTable.companyId, companyId),
        sql`${ingestionRunsTable.companyId} IS NULL`,
      ),
    )
    .orderBy(desc(ingestionRunsTable.startedAt))
    .limit(50);

  res.json({ data: runs });
});

router.post("/intelligence/ingest", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  const { sourceType } = req.body;

  if (!sourceType) {
    res.status(400).json({ error: "sourceType is required" });
    return;
  }

  const validTypes = ["vessel_positions", "port_congestion", "sanctions", "denied_parties", "disruptions", "weather_risk"];
  if (!validTypes.includes(sourceType)) {
    res.status(400).json({ error: `Invalid sourceType. Must be one of: ${validTypes.join(", ")}` });
    return;
  }

  let [source] = await db
    .select()
    .from(intelligenceSourcesTable)
    .where(
      and(
        eq(intelligenceSourcesTable.sourceType, sourceType),
        or(
          eq(intelligenceSourcesTable.companyId, companyId),
          sql`${intelligenceSourcesTable.companyId} IS NULL`,
        ),
      ),
    )
    .limit(1);

  if (!source) {
    const sourceId = generateId();
    [source] = await db.insert(intelligenceSourcesTable).values({
      id: sourceId,
      companyId,
      sourceName: `${sourceType} feed`,
      sourceType: sourceType as any,
      providerName: "fixture",
      ingestionMethod: "api_poll",
      sourceStatus: "active",
    }).returning();
  }

  publishIngestionJob({
    sourceId: source.id,
    sourceType,
    companyId,
    trigger: "manual",
  });

  res.json({ data: { message: "Ingestion started", sourceId: source.id, sourceType } });
});

export default router;
