import { db } from "../index.js";
import {
  companiesTable,
  usersTable,
  entitiesTable,
  shipmentsTable,
  riskScoresTable,
  tradeLaneStatsTable,
  tradeGraphEdgesTable,
  intelligenceSourcesTable,
  vesselPositionsTable,
  vesselPortCallsTable,
  portCongestionSnapshotsTable,
  sanctionsEntitiesTable,
  deniedPartiesTable,
  disruptionEventsTable,
  weatherRiskEventsTable,
  laneMarketSignalsTable,
  shipmentIntelligenceSnapshotsTable,
  laneScoresTable,
  portScoresTable,
  carrierScoresTable,
  entityScoresTable,
  recommendationsTable,
  recommendationOutcomesTable,
  workflowTasksTable,
  taskEventsTable,
  policyDecisionsTable,
  operationalNotificationsTable,
  preShipmentRiskReportsTable,
  predictiveAlertsTable,
  historicalPatternsTable,
  bookingDecisionsTable,
  releaseGateHoldsTable,
  mitigationPlaybooksTable,
  scenarioComparisonsTable,
  complianceScreeningsTable,
  laneStrategiesTable,
  carrierAllocationsTable,
  networkRecommendationsTable,
  portfolioSnapshotsTable,
  interventionAttributionsTable,
  tenantPoliciesTable,
  operatingModesTable,
  reportSnapshotsTable,
} from "../schema/index.js";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import {
  LORIAN_COMPANY_ID,
  USERS,
  PASSWORD,
  PORTS,
  CARRIERS,
  TRADE_LANES,
  SHIPPERS,
  CONSIGNEES,
  SANCTIONS_ENTITIES_DATA,
  lid,
  daysAgo,
  hoursAgo,
  minutesAgo,
  daysFromNow,
  spreadTime,
} from "./constants.js";

function normalizeEntityName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function deterministicValue(seed: number, min: number, max: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  const frac = x - Math.floor(x);
  return Math.round((min + frac * (max - min)) * 100) / 100;
}

export async function seedLorian() {
  console.log("=== SEEDING LORIAN DEMO ENVIRONMENT ===\n");

  const existing = await db.select({ id: companiesTable.id }).from(companiesTable).where(eq(companiesTable.id, LORIAN_COMPANY_ID));
  if (existing.length > 0) {
    console.log("Lorian demo already seeded. Run reset first to re-seed.");
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const now = new Date();

  // ── 1. Company ──
  console.log("1. Company...");
  await db.insert(companiesTable).values({
    id: LORIAN_COMPANY_ID,
    name: "Lorian Freight Solutions",
    slug: "lorian-freight",
    industry: "Freight Forwarding",
    country: "Singapore",
    tradeLanes: TRADE_LANES.map((l) => l.label),
    contactEmail: "admin@lorian.demo",
    contactPhone: "+65-6123-4567",
  });

  // ── 2. Users ──
  console.log("2. Users...");
  await db.insert(usersTable).values(
    Object.values(USERS).map((u) => ({
      id: u.id,
      companyId: LORIAN_COMPANY_ID,
      email: u.email,
      name: u.name,
      passwordHash,
      role: u.role,
      isActive: true,
    })),
  );

  // ── 3. Entities (Shippers + Consignees + Carrier entities) ──
  console.log("3. Entities...");
  const carrierEntities = CARRIERS.map((c, i) => ({
    id: lid("ent_carrier", i + 1),
    companyId: LORIAN_COMPANY_ID,
    name: c.full,
    normalizedName: normalizeEntityName(c.full),
    entityType: "CARRIER" as const,
    status: "VERIFIED" as const,
    country: "International",
    scacCode: c.name,
  }));
  const shipperEntities = SHIPPERS.map((s) => ({
    id: s.id,
    companyId: LORIAN_COMPANY_ID,
    name: s.name,
    normalizedName: normalizeEntityName(s.name),
    entityType: s.type as "SHIPPER",
    status: "VERIFIED" as const,
    country: s.country,
    city: s.city,
  }));
  const consigneeEntities = CONSIGNEES.map((c) => ({
    id: c.id,
    companyId: LORIAN_COMPANY_ID,
    name: c.name,
    normalizedName: normalizeEntityName(c.name),
    entityType: c.type as "CONSIGNEE",
    status: "VERIFIED" as const,
    country: c.country,
    city: c.city,
  }));
  await db.insert(entitiesTable).values([...carrierEntities, ...shipperEntities, ...consigneeEntities]);

  // ── 4. Shipments (20) ──
  console.log("4. Shipments...");
  const shipmentDefs = [
    { n: 1, ref: "LOR-2026-0001", status: "IN_TRANSIT" as const, lane: 0, shipper: 0, consignee: 0, carrier: 0, etdDaysAgo: 5, etaDaysFromNow: 18, cargoValue: 285000, commodity: "Consumer Electronics", hsCode: "8471.30", packageCount: 450, grossWeight: 12500, vessel: "Maersk Sentosa", voyage: "MS-426E" },
    { n: 2, ref: "LOR-2026-0002", status: "IN_TRANSIT" as const, lane: 1, shipper: 0, consignee: 1, carrier: 1, etdDaysAgo: 3, etaDaysFromNow: 28, cargoValue: 410000, commodity: "Semiconductor Equipment", hsCode: "8486.20", packageCount: 120, grossWeight: 8200, vessel: "MSC Fantasia", voyage: "FA-112N" },
    { n: 3, ref: "LOR-2026-0003", status: "BOOKED" as const, lane: 2, shipper: 1, consignee: 1, carrier: 2, etdDaysAgo: -3, etaDaysFromNow: 32, cargoValue: 175000, commodity: "Optical Instruments", hsCode: "9015.80", packageCount: 85, grossWeight: 3400, vessel: "COSCO Harmony", voyage: "CH-803W" },
    { n: 4, ref: "LOR-2026-0004", status: "PENDING_REVIEW" as const, lane: 3, shipper: 4, consignee: 2, carrier: 3, etdDaysAgo: -5, etaDaysFromNow: 35, cargoValue: 520000, commodity: "Polymer Resins", hsCode: "3901.10", packageCount: 200, grossWeight: 45000, vessel: "CMA CGM Marco Polo", voyage: "MP-556A" },
    { n: 5, ref: "LOR-2026-0005", status: "AT_PORT" as const, lane: 0, shipper: 0, consignee: 0, carrier: 4, etdDaysAgo: 20, etaDaysFromNow: 2, cargoValue: 138000, commodity: "LED Displays", hsCode: "8528.52", packageCount: 340, grossWeight: 9800, vessel: "Hapag Express", voyage: "HE-219P" },
    { n: 6, ref: "LOR-2026-0006", status: "CUSTOMS" as const, lane: 1, shipper: 5, consignee: 1, carrier: 5, etdDaysAgo: 28, etaDaysFromNow: -1, cargoValue: 92000, commodity: "Textile Fabrics", hsCode: "5208.31", packageCount: 600, grossWeight: 18000, vessel: "Ever Given", voyage: "EG-401R" },
    { n: 7, ref: "LOR-2026-0007", status: "DELIVERED" as const, lane: 4, shipper: 3, consignee: 5, carrier: 0, etdDaysAgo: 45, etaDaysFromNow: -10, cargoValue: 680000, commodity: "Industrial Machinery", hsCode: "8462.10", packageCount: 15, grossWeight: 42000, vessel: "Maersk Eindhoven", voyage: "ME-312K" },
    { n: 8, ref: "LOR-2026-0008", status: "IN_TRANSIT" as const, lane: 5, shipper: 1, consignee: 3, carrier: 6, etdDaysAgo: 8, etaDaysFromNow: 12, cargoValue: 315000, commodity: "Precision Lenses", hsCode: "9001.90", packageCount: 60, grossWeight: 1800, vessel: "ONE Commitment", voyage: "OC-744B" },
    { n: 9, ref: "LOR-2026-0009", status: "BOOKED" as const, lane: 6, shipper: 2, consignee: 0, carrier: 1, etdDaysAgo: -2, etaDaysFromNow: 22, cargoValue: 195000, commodity: "Auto Parts", hsCode: "8708.29", packageCount: 300, grossWeight: 14500, vessel: "MSC Meraviglia", voyage: "MM-890C" },
    { n: 10, ref: "LOR-2026-0010", status: "PENDING" as const, lane: 7, shipper: 3, consignee: 4, carrier: 2, etdDaysAgo: -7, etaDaysFromNow: 38, cargoValue: 450000, commodity: "CNC Machine Parts", hsCode: "8466.30", packageCount: 45, grossWeight: 22000, vessel: "COSCO Pride", voyage: "CP-155D" },
    { n: 11, ref: "LOR-2026-0011", status: "IN_TRANSIT" as const, lane: 8, shipper: 0, consignee: 5, carrier: 3, etdDaysAgo: 10, etaDaysFromNow: 22, cargoValue: 225000, commodity: "Batteries", hsCode: "8507.60", packageCount: 180, grossWeight: 7600, vessel: "CMA CGM Thalassa", voyage: "CT-667F" },
    { n: 12, ref: "LOR-2026-0012", status: "APPROVED" as const, lane: 9, shipper: 4, consignee: 3, carrier: 7, etdDaysAgo: -1, etaDaysFromNow: 14, cargoValue: 88000, commodity: "Specialty Chemicals", hsCode: "2933.39", packageCount: 100, grossWeight: 5500, vessel: "ZIM Kingston", voyage: "ZK-334G" },
    { n: 13, ref: "LOR-2026-0013", status: "REJECTED" as const, lane: 3, shipper: 4, consignee: 2, carrier: 4, etdDaysAgo: -10, etaDaysFromNow: 25, cargoValue: 320000, commodity: "Industrial Adhesives", hsCode: "3506.91", packageCount: 250, grossWeight: 12000, vessel: null, voyage: null },
    { n: 14, ref: "LOR-2026-0014", status: "IN_TRANSIT" as const, lane: 2, shipper: 1, consignee: 1, carrier: 0, etdDaysAgo: 12, etaDaysFromNow: 18, cargoValue: 390000, commodity: "Solar Panels", hsCode: "8541.40", packageCount: 500, grossWeight: 25000, vessel: "Maersk Seletar", voyage: "MS-502H" },
    { n: 15, ref: "LOR-2026-0015", status: "DRAFT" as const, lane: 0, shipper: 0, consignee: 0, carrier: null, etdDaysAgo: -14, etaDaysFromNow: 30, cargoValue: 155000, commodity: "Smartphone Components", hsCode: "8517.70", packageCount: 800, grossWeight: 4200, vessel: null, voyage: null },
    { n: 16, ref: "LOR-2026-0016", status: "IN_TRANSIT" as const, lane: 5, shipper: 1, consignee: 3, carrier: 5, etdDaysAgo: 6, etaDaysFromNow: 14, cargoValue: 270000, commodity: "Camera Modules", hsCode: "9002.11", packageCount: 95, grossWeight: 2100, vessel: "Ever Ace", voyage: "EA-588J" },
    { n: 17, ref: "LOR-2026-0017", status: "CLOSED" as const, lane: 4, shipper: 3, consignee: 5, carrier: 6, etdDaysAgo: 60, etaDaysFromNow: -25, cargoValue: 730000, commodity: "Turbine Blades", hsCode: "8411.99", packageCount: 8, grossWeight: 55000, vessel: "ONE Olympus", voyage: "OO-321L" },
    { n: 18, ref: "LOR-2026-0018", status: "BOOKED" as const, lane: 8, shipper: 5, consignee: 5, carrier: 7, etdDaysAgo: -4, etaDaysFromNow: 30, cargoValue: 67000, commodity: "Cotton Yarn", hsCode: "5205.11", packageCount: 400, grossWeight: 20000, vessel: "ZIM Savannah", voyage: "ZS-445M" },
    { n: 19, ref: "LOR-2026-0019", status: "CANCELLED" as const, lane: 9, shipper: 4, consignee: 3, carrier: 3, etdDaysAgo: -15, etaDaysFromNow: 10, cargoValue: 195000, commodity: "Pharmaceutical Raw Materials", hsCode: "2941.10", packageCount: 50, grossWeight: 3000, vessel: null, voyage: null },
    { n: 20, ref: "LOR-2026-0020", status: "PENDING_REVIEW" as const, lane: 6, shipper: 2, consignee: 0, carrier: 4, etdDaysAgo: -6, etaDaysFromNow: 20, cargoValue: 210000, commodity: "Automotive Sensors", hsCode: "9031.80", packageCount: 150, grossWeight: 6800, vessel: "Hapag Hamburg", voyage: "HH-278N" },
  ];

  const shipments = shipmentDefs.map((s) => ({
    id: lid("shp", s.n),
    companyId: LORIAN_COMPANY_ID,
    reference: s.ref,
    status: s.status,
    shipperId: SHIPPERS[s.shipper].id,
    consigneeId: CONSIGNEES[s.consignee].id,
    carrierId: s.carrier !== null ? carrierEntities[s.carrier].id : null,
    carrier: s.carrier !== null ? CARRIERS[s.carrier].name : null,
    portOfLoading: TRADE_LANES[s.lane].origin,
    portOfDischarge: TRADE_LANES[s.lane].destination,
    vessel: s.vessel,
    voyage: s.voyage,
    commodity: s.commodity,
    hsCode: s.hsCode,
    packageCount: s.packageCount,
    grossWeight: s.grossWeight,
    weightUnit: "KG" as const,
    volume: Math.round(s.grossWeight * 0.004 * 100) / 100,
    volumeUnit: "CBM" as const,
    freightTerms: "PREPAID" as const,
    incoterms: "CIF",
    etd: s.etdDaysAgo >= 0 ? daysAgo(s.etdDaysAgo) : daysFromNow(Math.abs(s.etdDaysAgo)),
    eta: daysFromNow(s.etaDaysFromNow),
    bookingNumber: s.status !== "DRAFT" ? `BK-${s.ref.split("-").pop()}` : null,
    cargoValue: s.cargoValue,
    blNumber: ["IN_TRANSIT", "AT_PORT", "CUSTOMS", "DELIVERED", "CLOSED"].includes(s.status) ? `BL-LOR-${String(s.n).padStart(4, "0")}` : null,
  }));
  await db.insert(shipmentsTable).values(shipments);

  // ── 5. Risk Scores ──
  console.log("5. Risk Scores...");
  const activeShipmentIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
  const riskScoreDefs = [
    { i: 0,  composite: 28.5, cargo: 12, lane: 22, counter: 8,  geo: 18, seasonal: 10, docs: 5 },
    { i: 1,  composite: 55.2, cargo: 18, lane: 35, counter: 12, geo: 42, seasonal: 15, docs: 8 },
    { i: 2,  composite: 62.8, cargo: 22, lane: 38, counter: 15, geo: 45, seasonal: 20, docs: 10 },
    { i: 3,  composite: 48.3, cargo: 15, lane: 28, counter: 18, geo: 32, seasonal: 12, docs: 6 },
    { i: 4,  composite: 72.1, cargo: 25, lane: 40, counter: 10, geo: 48, seasonal: 22, docs: 12 },
    { i: 5,  composite: 35.6, cargo: 10, lane: 20, counter: 8,  geo: 22, seasonal: 8,  docs: 4 },
    { i: 6,  composite: 22.0, cargo: 8,  lane: 12, counter: 5,  geo: 10, seasonal: 6,  docs: 3 },
    { i: 7,  composite: 30.4, cargo: 12, lane: 18, counter: 6,  geo: 15, seasonal: 8,  docs: 4 },
    { i: 8,  composite: 26.8, cargo: 10, lane: 15, counter: 7,  geo: 12, seasonal: 6,  docs: 3 },
    { i: 9,  composite: 45.6, cargo: 18, lane: 30, counter: 12, geo: 35, seasonal: 14, docs: 7 },
    { i: 10, composite: 52.3, cargo: 20, lane: 32, counter: 14, geo: 38, seasonal: 18, docs: 9 },
    { i: 11, composite: 38.5, cargo: 14, lane: 22, counter: 10, geo: 25, seasonal: 10, docs: 5 },
    { i: 12, composite: 68.7, cargo: 24, lane: 38, counter: 18, geo: 45, seasonal: 20, docs: 11 },
    { i: 13, composite: 42.1, cargo: 16, lane: 25, counter: 10, geo: 28, seasonal: 12, docs: 6 },
    { i: 14, composite: 20.5, cargo: 6,  lane: 10, counter: 4,  geo: 8,  seasonal: 5,  docs: 2 },
    { i: 15, composite: 58.9, cargo: 22, lane: 35, counter: 14, geo: 40, seasonal: 18, docs: 10 },
    { i: 16, composite: 18.2, cargo: 5,  lane: 8,  counter: 3,  geo: 6,  seasonal: 4,  docs: 2 },
    { i: 17, composite: 32.0, cargo: 10, lane: 18, counter: 8,  geo: 18, seasonal: 8,  docs: 4 },
    { i: 18, composite: 64.5, cargo: 22, lane: 36, counter: 16, geo: 42, seasonal: 19, docs: 10 },
    { i: 19, composite: 40.8, cargo: 15, lane: 24, counter: 10, geo: 26, seasonal: 12, docs: 6 },
  ];
  await db.insert(riskScoresTable).values(
    riskScoreDefs.map((r) => ({
      id: lid("rs", r.i + 1),
      companyId: LORIAN_COMPANY_ID,
      shipmentId: shipments[r.i].id,
      compositeScore: r.composite,
      subScores: {
        cargoType: r.cargo,
        tradeLane: r.lane,
        counterparty: r.counter,
        routeGeopolitical: r.geo,
        seasonal: r.seasonal,
        documentCompleteness: r.docs,
      },
      primaryRiskFactors: r.composite > 50
        ? [{ factor: "High trade lane stress", explanation: "Lane shows elevated disruption signals" }, { factor: "Geopolitical risk", explanation: "Route passes through elevated-risk region" }]
        : r.composite > 30
        ? [{ factor: "Moderate lane activity", explanation: "Lane shows moderate congestion signals" }]
        : [{ factor: "Standard risk profile", explanation: "No elevated risk factors detected" }],
      recommendedAction: r.composite > 60 ? "ESCALATE" as const : r.composite > 35 ? "OPERATOR_REVIEW" as const : "AUTO_APPROVE" as const,
      scoredAt: spreadTime(r.i % 5, r.i * 31 + 45),
    })),
  );

  // ── 6. Intelligence Sources ──
  console.log("6. Intelligence Sources...");
  const intSources = [
    { n: 1, name: "MarineTraffic AIS Feed", type: "vessel_positions" as const, provider: "MarineTraffic", method: "api_poll" as const, schedule: "*/15 * * * *" },
    { n: 2, name: "Port Congestion Monitor", type: "port_congestion" as const, provider: "PortWatch", method: "api_poll" as const, schedule: "0 */6 * * *" },
    { n: 3, name: "OFAC SDN List", type: "sanctions" as const, provider: "US Treasury OFAC", method: "file_import" as const, schedule: "0 2 * * *" },
    { n: 4, name: "EU Denied Parties", type: "denied_parties" as const, provider: "EU Commission", method: "file_import" as const, schedule: "0 3 * * *" },
    { n: 5, name: "Global Disruption Alerts", type: "disruptions" as const, provider: "Resilience360", method: "webhook" as const, schedule: null },
    { n: 6, name: "Weather Risk Service", type: "weather_risk" as const, provider: "WeatherGuard Maritime", method: "api_poll" as const, schedule: "0 */4 * * *" },
    { n: 7, name: "Freightos Baltic Index", type: "lane_market_signals" as const, provider: "Freightos", method: "api_poll" as const, schedule: "0 8 * * 1" },
  ];
  await db.insert(intelligenceSourcesTable).values(
    intSources.map((s) => ({
      id: lid("isrc", s.n),
      companyId: LORIAN_COMPANY_ID,
      sourceName: s.name,
      sourceType: s.type,
      providerName: s.provider,
      ingestionMethod: s.method,
      scheduleExpression: s.schedule,
      sourceStatus: "active" as const,
      lastSyncedAt: hoursAgo([2, 1, 6, 8, 3, 4, 1][s.n - 1]),
      lastSuccessAt: hoursAgo([2, 1, 6, 8, 3, 4, 1][s.n - 1]),
    })),
  );

  // ── 7. Disruption Events ──
  console.log("7. Disruption Events...");
  const disruptions = [
    { n: 1, type: "port_closure" as const, title: "Shanghai Port Partial Closure – Typhoon Alert", severity: "high" as const, status: "active" as const, region: "East Asia", ports: ["CNSHA"], lanes: ["CNSHA-USLAX", "CNSHA-NLRTM", "CNSHA-AEJEA"], impactDays: 4, startDaysAgo: 1 },
    { n: 2, type: "labor_strike" as const, title: "Rotterdam Dock Workers Slowdown", severity: "medium" as const, status: "monitoring" as const, region: "Europe", ports: ["NLRTM"], lanes: ["CNSZX-NLRTM", "CNSHA-NLRTM"], impactDays: 7, startDaysAgo: 3 },
    { n: 3, type: "canal_blockage" as const, title: "Suez Canal Transit Delays – Vessel Grounding", severity: "critical" as const, status: "active" as const, region: "Middle East", ports: ["AEJEA"], lanes: ["CNSHA-AEJEA", "SGSIN-AEJEA"], impactDays: 10, startDaysAgo: 2 },
    { n: 4, type: "geopolitical" as const, title: "Red Sea Security Advisory – Elevated Threat", severity: "high" as const, status: "active" as const, region: "Middle East", ports: [], lanes: ["CNSHA-NLRTM", "CNSZX-NLRTM", "CNSZX-DEHAM"], impactDays: 30, startDaysAgo: 15 },
    { n: 5, type: "natural_disaster" as const, title: "Typhoon Khanun Approaching East China Sea", severity: "high" as const, status: "active" as const, region: "East Asia", ports: ["CNSHA", "CNSZX"], lanes: ["CNSHA-USLAX", "CNSZX-NLRTM"], impactDays: 5, startDaysAgo: 0 },
    { n: 6, type: "infrastructure_failure" as const, title: "Los Angeles Terminal 7 Crane Malfunction", severity: "low" as const, status: "resolved" as const, region: "North America", ports: ["USLAX"], lanes: ["CNSHA-USLAX", "JPYOK-USLAX"], impactDays: 2, startDaysAgo: 10 },
  ];
  await db.insert(disruptionEventsTable).values(
    disruptions.map((d) => ({
      id: lid("dis", d.n),
      companyId: LORIAN_COMPANY_ID,
      sourceId: lid("isrc", 5),
      eventType: d.type,
      title: d.title,
      description: `${d.title}. Monitoring situation closely.`,
      severity: d.severity,
      status: d.status,
      affectedRegion: d.region,
      affectedPorts: d.ports,
      affectedLanes: d.lanes,
      estimatedImpactDays: d.impactDays,
      confidence: [0.82, 0.88, 0.78, 0.91, 0.85, 0.75][d.n - 1],
      startDate: daysAgo(d.startDaysAgo),
      expectedEndDate: daysFromNow(d.impactDays - d.startDaysAgo),
      resolvedDate: d.status === "resolved" ? daysAgo(d.startDaysAgo - d.impactDays) : null,
      fingerprint: `dis_fp_lor_${d.n}`,
    })),
  );

  // ── 8. Weather Risk Events ──
  console.log("8. Weather Risk Events...");
  const weatherEvents = [
    { n: 1, type: "typhoon" as const, title: "Typhoon Khanun – Western Pacific", severity: "high" as const, status: "active" as const, region: "East Asia", ports: ["CNSHA", "CNSZX"], lat: 28.5, lng: 122.1, radiusKm: 350, windKnots: 85 },
    { n: 2, type: "monsoon" as const, title: "Southwest Monsoon – Bay of Bengal", severity: "medium" as const, status: "active" as const, region: "South Asia", ports: ["SGSIN"], lat: 12.0, lng: 85.0, radiusKm: 800, windKnots: 45 },
    { n: 3, type: "fog" as const, title: "Dense Fog Advisory – North Sea Approaches", severity: "low" as const, status: "forecast" as const, region: "Europe", ports: ["NLRTM", "DEHAM", "GBFXT"], lat: 53.5, lng: 4.0, radiusKm: 200, windKnots: 10 },
    { n: 4, type: "storm" as const, title: "Pacific Storm System – Trans-Pacific Route", severity: "medium" as const, status: "forecast" as const, region: "Pacific", ports: [], lat: 35.0, lng: -160.0, radiusKm: 600, windKnots: 55 },
  ];
  await db.insert(weatherRiskEventsTable).values(
    weatherEvents.map((w) => ({
      id: lid("wre", w.n),
      companyId: LORIAN_COMPANY_ID,
      sourceId: lid("isrc", 6),
      eventType: w.type,
      title: w.title,
      description: `${w.title}. Maritime advisory issued.`,
      severity: w.severity,
      status: w.status,
      affectedRegion: w.region,
      affectedPorts: w.ports,
      latitude: w.lat,
      longitude: w.lng,
      radiusKm: w.radiusKm,
      windSpeedKnots: w.windKnots,
      confidence: [0.85, 0.78, 0.82, 0.90][w.n - 1],
      forecastDate: daysAgo(1),
      expectedStartDate: w.status === "active" ? daysAgo(1) : daysFromNow(2),
      expectedEndDate: daysFromNow(4),
      fingerprint: `wre_fp_lor_${w.n}`,
    })),
  );

  // ── 9. Sanctions & Denied Parties ──
  console.log("9. Sanctions & Denied Parties...");
  await db.insert(sanctionsEntitiesTable).values(
    SANCTIONS_ENTITIES_DATA.map((s, i) => ({
      id: lid("sanc", i + 1),
      companyId: LORIAN_COMPANY_ID,
      sourceId: lid("isrc", 3),
      listName: s.list,
      entityName: s.name,
      entityType: s.type,
      aliases: [],
      country: s.country,
      sanctionProgram: s.program,
      listingDate: daysAgo(180),
      identifiers: { source: "lorian-demo" },
      status: "active" as const,
      fingerprint: `sanc_fp_lor_${i + 1}`,
      sourceQuality: 0.95,
    })),
  );
  await db.insert(deniedPartiesTable).values([
    {
      id: lid("dp", 1),
      companyId: LORIAN_COMPANY_ID,
      sourceId: lid("isrc", 4),
      listName: "EU Denied Parties",
      partyName: "Crimson Shell Trading FZE",
      partyType: "organization" as const,
      country: "UAE",
      reason: "Proliferation concerns",
      aliases: ["Crimson Shell FZE"],
      status: "active" as const,
      fingerprint: "dp_fp_lor_1",
      sourceQuality: 0.9,
      listingDate: daysAgo(120),
    },
  ]);

  // ── 10. Port Congestion ──
  console.log("10. Port Congestion...");
  const congestionData = [
    { n: 1, port: PORTS[0], level: "high" as const, vessels: 42, waitDays: 3.2, berthDays: 2.1, capacity: 0.88, trend: "worsening" as const },
    { n: 2, port: PORTS[1], level: "moderate" as const, vessels: 28, waitDays: 1.8, berthDays: 1.5, capacity: 0.72, trend: "stable" as const },
    { n: 3, port: PORTS[2], level: "low" as const, vessels: 15, waitDays: 0.5, berthDays: 1.0, capacity: 0.55, trend: "improving" as const },
    { n: 4, port: PORTS[3], level: "high" as const, vessels: 38, waitDays: 2.8, berthDays: 2.5, capacity: 0.85, trend: "worsening" as const },
    { n: 5, port: PORTS[4], level: "moderate" as const, vessels: 22, waitDays: 1.5, berthDays: 1.8, capacity: 0.68, trend: "stable" as const },
    { n: 6, port: PORTS[5], level: "critical" as const, vessels: 55, waitDays: 4.5, berthDays: 3.0, capacity: 0.95, trend: "worsening" as const },
    { n: 7, port: PORTS[6], level: "moderate" as const, vessels: 20, waitDays: 1.2, berthDays: 1.3, capacity: 0.65, trend: "improving" as const },
    { n: 8, port: PORTS[7], level: "low" as const, vessels: 12, waitDays: 0.8, berthDays: 0.9, capacity: 0.45, trend: "stable" as const },
    { n: 9, port: PORTS[8], level: "moderate" as const, vessels: 25, waitDays: 1.6, berthDays: 1.4, capacity: 0.7, trend: "stable" as const },
    { n: 10, port: PORTS[9], level: "low" as const, vessels: 10, waitDays: 0.4, berthDays: 0.8, capacity: 0.4, trend: "improving" as const },
  ];
  await db.insert(portCongestionSnapshotsTable).values(
    congestionData.map((c) => ({
      id: lid("pcs", c.n),
      companyId: LORIAN_COMPANY_ID,
      sourceId: lid("isrc", 2),
      portCode: c.port.code,
      portName: c.port.name,
      congestionLevel: c.level,
      waitingVessels: c.vessels,
      avgWaitDays: c.waitDays,
      avgBerthDays: c.berthDays,
      capacityUtilization: c.capacity,
      trendDirection: c.trend,
      fingerprint: `pcs_fp_lor_${c.n}`,
      snapshotTimestamp: hoursAgo(6),
    })),
  );

  // ── 11. Vessel Positions ──
  console.log("11. Vessel Positions...");
  const vesselData = [
    { n: 1, vessel: "Maersk Sentosa", imo: "9619907", lat: 18.5, lng: -148.3, heading: 85, speed: 14.2, status: "underway" as const, dest: "USLAX" },
    { n: 2, vessel: "MSC Fantasia", imo: "9359791", lat: 5.2, lng: 78.5, heading: 270, speed: 16.5, status: "underway" as const, dest: "NLRTM" },
    { n: 3, vessel: "COSCO Harmony", imo: "9783473", lat: 31.2, lng: 121.5, heading: 0, speed: 0, status: "moored" as const, dest: "CNSHA" },
    { n: 4, vessel: "CMA CGM Marco Polo", imo: "9454412", lat: 1.3, lng: 103.8, heading: 0, speed: 0, status: "anchored" as const, dest: "SGSIN" },
    { n: 5, vessel: "Hapag Express", imo: "9500932", lat: 33.7, lng: -118.2, heading: 45, speed: 2.1, status: "at_berth" as const, dest: "USLAX" },
    { n: 6, vessel: "ONE Commitment", imo: "9312793", lat: 22.3, lng: 67.8, heading: 310, speed: 15.8, status: "underway" as const, dest: "AEJEA" },
    { n: 7, vessel: "Ever Ace", imo: "9893890", lat: 15.6, lng: 56.2, heading: 295, speed: 17.1, status: "underway" as const, dest: "AEJEA" },
    { n: 8, vessel: "CMA CGM Thalassa", imo: "9702143", lat: 10.2, lng: 98.5, heading: 250, speed: 13.5, status: "underway" as const, dest: "DEHAM" },
  ];
  await db.insert(vesselPositionsTable).values(
    vesselData.map((v) => ({
      id: lid("vp", v.n),
      companyId: LORIAN_COMPANY_ID,
      sourceId: lid("isrc", 1),
      vesselName: v.vessel,
      imo: v.imo,
      latitude: v.lat,
      longitude: v.lng,
      heading: v.heading,
      speed: v.speed,
      status: v.status,
      destination: v.dest,
      fingerprint: `vp_fp_lor_${v.n}`,
      positionTimestamp: hoursAgo(1),
    })),
  );

  // ── 12. Vessel Port Calls ──
  console.log("12. Vessel Port Calls...");
  await db.insert(vesselPortCallsTable).values([
    { id: lid("vpc", 1), companyId: LORIAN_COMPANY_ID, sourceId: lid("isrc", 1), vesselName: "Maersk Sentosa", imo: "9619907", portCode: "CNSHA", portName: "Shanghai", callType: "departure" as const, departureTime: daysAgo(5), fingerprint: "vpc_fp_lor_1" },
    { id: lid("vpc", 2), companyId: LORIAN_COMPANY_ID, sourceId: lid("isrc", 1), vesselName: "MSC Fantasia", imo: "9359791", portCode: "CNSZX", portName: "Shenzhen", callType: "departure" as const, departureTime: daysAgo(3), fingerprint: "vpc_fp_lor_2" },
    { id: lid("vpc", 3), companyId: LORIAN_COMPANY_ID, sourceId: lid("isrc", 1), vesselName: "Hapag Express", imo: "9500932", portCode: "USLAX", portName: "Los Angeles", callType: "arrival" as const, arrivalTime: daysAgo(0), berthDurationHours: 18, fingerprint: "vpc_fp_lor_3" },
    { id: lid("vpc", 4), companyId: LORIAN_COMPANY_ID, sourceId: lid("isrc", 1), vesselName: "Ever Given", imo: "9811000", portCode: "NLRTM", portName: "Rotterdam", callType: "arrival" as const, arrivalTime: daysAgo(1), berthDurationHours: 36, fingerprint: "vpc_fp_lor_4" },
  ]);

  // ── 13. Lane Market Signals ──
  console.log("13. Lane Market Signals...");
  const marketSignals = [
    { n: 1, origin: "CNSHA", dest: "USLAX", type: "rate_change" as const, dir: "up" as const, magnitude: 12.5, currentRate: 3850, prevRate: 3420, transitDays: 22 },
    { n: 2, origin: "CNSZX", dest: "NLRTM", type: "capacity_shift" as const, dir: "down" as const, magnitude: 8.0, currentRate: 2950, prevRate: 3050, transitDays: 28 },
    { n: 3, origin: "SGSIN", dest: "USNYC", type: "demand_surge" as const, dir: "up" as const, magnitude: 18.0, currentRate: 4200, prevRate: 3560, transitDays: 30 },
    { n: 4, origin: "CNSHA", dest: "NLRTM", type: "transit_time_change" as const, dir: "up" as const, magnitude: 3.0, currentRate: 3100, prevRate: 3050, transitDays: 32 },
    { n: 5, origin: "CNSHA", dest: "AEJEA", type: "rate_change" as const, dir: "up" as const, magnitude: 22.0, currentRate: 2800, prevRate: 2295, transitDays: 18 },
    { n: 6, origin: "JPYOK", dest: "USLAX", type: "rate_change" as const, dir: "stable" as const, magnitude: 1.5, currentRate: 3200, prevRate: 3155, transitDays: 14 },
  ];
  await db.insert(laneMarketSignalsTable).values(
    marketSignals.map((s) => ({
      id: lid("lms", s.n),
      companyId: LORIAN_COMPANY_ID,
      sourceId: lid("isrc", 7),
      originPort: s.origin,
      destinationPort: s.dest,
      laneId: `${s.origin}-${s.dest}`,
      signalType: s.type,
      direction: s.dir,
      magnitude: s.magnitude,
      currentRate: s.currentRate,
      previousRate: s.prevRate,
      rateUnit: "USD/TEU",
      avgTransitDays: s.transitDays,
      capacityUtilization: [0.82, 0.78, 0.91, 0.85, 0.73, 0.88][s.n - 1],
      confidence: [0.88, 0.85, 0.92, 0.87, 0.83, 0.90][s.n - 1],
      fingerprint: `lms_fp_lor_${s.n}`,
      signalTimestamp: hoursAgo(24),
    })),
  );

  // ── 14. Trade Lane Stats ──
  console.log("14. Trade Lane Stats...");
  await db.insert(tradeLaneStatsTable).values(
    TRADE_LANES.map((lane, i) => ({
      id: lid("tls", i + 1),
      companyId: LORIAN_COMPANY_ID,
      origin: lane.origin,
      destination: lane.destination,
      carrier: CARRIERS[i % CARRIERS.length].name,
      shipmentCount: [42, 28, 35, 18, 52, 31, 22, 15, 38, 26][i] || 20,
      avgCost: String([3800, 4200, 3600, 4800, 3900, 3400, 3200, 2800, 3100, 3700][i] || 3500),
      minCost: String([2100, 2400, 2000, 2800, 2200, 1900, 1800, 1600, 1700, 2100][i] || 2000),
      maxCost: String([5500, 6200, 5400, 6800, 5800, 5100, 4800, 4200, 4600, 5600][i] || 5000),
      avgTransitDays: [23, 28, 35, 35, 22, 30, 18, 20, 22, 38][i] || 25,
      delayCount: [3, 5, 4, 2, 6, 2, 1, 1, 3, 4][i] || 2,
      delayFrequency: [0.07, 0.18, 0.11, 0.11, 0.12, 0.06, 0.05, 0.07, 0.08, 0.15][i] || 0.10,
      avgDocumentCount: [7.2, 8.1, 7.5, 8.8, 6.9, 7.0, 6.2, 6.8, 7.1, 8.3][i] || 7.0,
      documentComplexity: (["MEDIUM", "HIGH", "MEDIUM", "HIGH", "MEDIUM", "LOW", "LOW", "MEDIUM", "MEDIUM", "HIGH"] as const)[i] || ("MEDIUM" as const),
      carrierPerformanceScore: [0.85, 0.78, 0.72, 0.88, 0.82, 0.80, 0.92, 0.84, 0.76, 0.68][i] || 0.80,
    })),
  );

  // ── 15. Scoring (Lane, Port, Carrier, Entity) ──
  console.log("15. Scoring...");
  await db.insert(laneScoresTable).values(
    TRADE_LANES.map((lane, i) => ({
      id: lid("lsc", i + 1),
      companyId: LORIAN_COMPANY_ID,
      originPort: lane.origin,
      destinationPort: lane.destination,
      congestionScore: deterministicValue(i * 5 + 1, 15, 72),
      disruptionScore: deterministicValue(i * 5 + 2, 10, 65),
      delayStressScore: deterministicValue(i * 5 + 3, 8, 55),
      marketPressureScore: deterministicValue(i * 5 + 4, 5, 45),
      compositeStressScore: deterministicValue(i * 5 + 5, 22, 75),
    })),
  );
  await db.insert(portScoresTable).values(
    PORTS.map((port, i) => ({
      id: lid("psc", i + 1),
      companyId: LORIAN_COMPANY_ID,
      portCode: port.code,
      portName: port.name,
      congestionSeverity: deterministicValue(i * 5 + 100, 12, 72),
      weatherExposure: deterministicValue(i * 5 + 101, 8, 55),
      disruptionExposure: deterministicValue(i * 5 + 102, 10, 62),
      operationalVolatility: deterministicValue(i * 5 + 103, 5, 35),
      compositeScore: deterministicValue(i * 5 + 104, 18, 68),
    })),
  );
  await db.insert(carrierScoresTable).values(
    CARRIERS.map((carrier, i) => ({
      id: lid("csc", i + 1),
      companyId: LORIAN_COMPANY_ID,
      carrierName: carrier.name,
      performanceScore: deterministicValue(i * 5 + 200, 55, 92),
      anomalyScore: deterministicValue(i * 5 + 201, 2, 25),
      reliabilityScore: deterministicValue(i * 5 + 202, 65, 92),
      laneStressExposure: deterministicValue(i * 5 + 203, 8, 45),
      compositeScore: deterministicValue(i * 5 + 204, 45, 88),
    })),
  );
  await db.insert(entityScoresTable).values(
    [...SHIPPERS, ...CONSIGNEES].map((ent, i) => ({
      id: lid("esc", i + 1),
      companyId: LORIAN_COMPANY_ID,
      entityId: ent.id,
      entityName: ent.name,
      sanctionsRiskScore: deterministicValue(i * 4 + 300, 0.5, 12),
      deniedPartyConfidence: deterministicValue(i * 4 + 301, 0.2, 8),
      documentationIrregularity: deterministicValue(i * 4 + 302, 1, 18),
      compositeScore: deterministicValue(i * 4 + 303, 1, 22),
    })),
  );

  // ── 16. Intelligence Snapshots (for active shipments) ──
  console.log("16. Intelligence Snapshots...");
  const intelDefs = [
    { i: 0,  congestion: 42, disruption: 28, weather: 18, sanctions: 2,  vessel: 12, market: 22, composite: 25 },
    { i: 1,  congestion: 58, disruption: 52, weather: 30, sanctions: 3,  vessel: 18, market: 35, composite: 48 },
    { i: 2,  congestion: 55, disruption: 48, weather: 35, sanctions: 5,  vessel: 22, market: 30, composite: 42 },
    { i: 3,  congestion: 38, disruption: 35, weather: 15, sanctions: 8,  vessel: 10, market: 25, composite: 32 },
    { i: 4,  congestion: 68, disruption: 55, weather: 42, sanctions: 2,  vessel: 28, market: 38, composite: 58 },
    { i: 5,  congestion: 32, disruption: 22, weather: 12, sanctions: 2,  vessel: 8,  market: 18, composite: 20 },
    { i: 6,  congestion: 15, disruption: 8,  weather: 5,  sanctions: 1,  vessel: 5,  market: 10, composite: 10 },
    { i: 7,  congestion: 28, disruption: 18, weather: 10, sanctions: 2,  vessel: 10, market: 15, composite: 18 },
    { i: 8,  congestion: 25, disruption: 15, weather: 8,  sanctions: 1,  vessel: 8,  market: 12, composite: 15 },
    { i: 9,  congestion: 48, disruption: 40, weather: 22, sanctions: 4,  vessel: 15, market: 28, composite: 38 },
    { i: 10, congestion: 52, disruption: 45, weather: 25, sanctions: 3,  vessel: 20, market: 32, composite: 42 },
    { i: 11, congestion: 22, disruption: 12, weather: 8,  sanctions: 6,  vessel: 6,  market: 14, composite: 16 },
    { i: 12, congestion: 62, disruption: 58, weather: 38, sanctions: 10, vessel: 25, market: 36, composite: 55 },
    { i: 13, congestion: 45, disruption: 38, weather: 20, sanctions: 2,  vessel: 15, market: 25, composite: 35 },
    { i: 14, congestion: 18, disruption: 10, weather: 5,  sanctions: 1,  vessel: 5,  market: 8,  composite: 10 },
    { i: 15, congestion: 58, disruption: 50, weather: 28, sanctions: 2,  vessel: 22, market: 34, composite: 48 },
    { i: 16, congestion: 12, disruption: 5,  weather: 3,  sanctions: 1,  vessel: 4,  market: 6,  composite: 8 },
    { i: 17, congestion: 30, disruption: 20, weather: 12, sanctions: 1,  vessel: 8,  market: 16, composite: 18 },
    { i: 18, congestion: 60, disruption: 52, weather: 32, sanctions: 8,  vessel: 24, market: 35, composite: 52 },
    { i: 19, congestion: 40, disruption: 32, weather: 16, sanctions: 2,  vessel: 12, market: 22, composite: 28 },
  ];
  await db.insert(shipmentIntelligenceSnapshotsTable).values(
    intelDefs.map((d) => ({
      id: lid("snap", d.i + 1),
      companyId: LORIAN_COMPANY_ID,
      shipmentId: shipments[d.i].id,
      congestionScore: d.congestion,
      disruptionScore: d.disruption,
      weatherRiskScore: d.weather,
      sanctionsRiskScore: d.sanctions,
      vesselRiskScore: d.vessel,
      marketPressureScore: d.market,
      compositeIntelScore: d.composite,
      linkedSignalIds: [lid("dis", (d.i % 6) + 1), lid("wre", (d.i % 4) + 1)],
      externalReasonCodes: d.composite > 40
        ? ["LANE_STRESS_ELEVATED", "PORT_CONGESTION_HIGH", "DISRUPTION_ACTIVE"]
        : d.composite > 20
        ? ["LANE_STRESS_ELEVATED", "PORT_CONGESTION_MODERATE"]
        : ["NORMAL_OPERATIONS"],
      evidenceSummary: [
        { signal: "disruption", detail: `Disruption event ${lid("dis", (d.i % 6) + 1)} affecting route` },
        { signal: "weather", detail: `Weather risk event ${lid("wre", (d.i % 4) + 1)} in region` },
      ],
      snapshotHash: `snap_hash_lor_${d.i + 1}`,
    })),
  );

  // ── 17. Pre-Shipment Risk Reports ──
  console.log("17. Pre-Shipment Risk Reports...");
  const riskReportDefs = [
    { i: 0,  overall: 20.36, lane: 35, port: 28, disruption: 15, weather: 12, carrier: 82, entity: 91, readiness: 78 },
    { i: 1,  overall: 44.22, lane: 62, port: 48, disruption: 42, weather: 22, carrier: 71, entity: 85, readiness: 62 },
    { i: 2,  overall: 67.24, lane: 72, port: 55, disruption: 58, weather: 38, carrier: 65, entity: 82, readiness: 55 },
    { i: 3,  overall: 53.26, lane: 45, port: 38, disruption: 48, weather: 18, carrier: 78, entity: 72, readiness: 68 },
    { i: 4,  overall: 76.77, lane: 78, port: 68, disruption: 62, weather: 45, carrier: 58, entity: 88, readiness: 42 },
    { i: 5,  overall: 32.87, lane: 38, port: 32, disruption: 25, weather: 15, carrier: 76, entity: 90, readiness: 72 },
    { i: 6,  overall: 12.50, lane: 15, port: 10, disruption: 8,  weather: 5,  carrier: 92, entity: 95, readiness: 95 },
    { i: 7,  overall: 25.55, lane: 30, port: 22, disruption: 18, weather: 10, carrier: 85, entity: 92, readiness: 75 },
    { i: 8,  overall: 24.26, lane: 28, port: 20, disruption: 16, weather: 8,  carrier: 80, entity: 88, readiness: 80 },
    { i: 9,  overall: 48.15, lane: 55, port: 42, disruption: 38, weather: 20, carrier: 72, entity: 78, readiness: 58 },
    { i: 10, overall: 37.86, lane: 42, port: 35, disruption: 32, weather: 18, carrier: 75, entity: 86, readiness: 65 },
    { i: 11, overall: 22.93, lane: 22, port: 18, disruption: 12, weather: 8,  carrier: 88, entity: 92, readiness: 82 },
    { i: 12, overall: 72.40, lane: 75, port: 62, disruption: 65, weather: 35, carrier: 60, entity: 68, readiness: 38 },
    { i: 13, overall: 45.85, lane: 52, port: 40, disruption: 35, weather: 22, carrier: 78, entity: 85, readiness: 60 },
    { i: 14, overall: 18.20, lane: 20, port: 15, disruption: 10, weather: 5,  carrier: 90, entity: 94, readiness: 88 },
    { i: 15, overall: 63.88, lane: 68, port: 55, disruption: 52, weather: 30, carrier: 68, entity: 82, readiness: 48 },
    { i: 16, overall: 10.50, lane: 12, port: 8,  disruption: 5,  weather: 3,  carrier: 95, entity: 96, readiness: 92 },
    { i: 17, overall: 28.40, lane: 32, port: 25, disruption: 20, weather: 12, carrier: 82, entity: 90, readiness: 76 },
    { i: 18, overall: 65.30, lane: 70, port: 58, disruption: 55, weather: 28, carrier: 62, entity: 70, readiness: 40 },
    { i: 19, overall: 42.16, lane: 48, port: 35, disruption: 30, weather: 16, carrier: 76, entity: 84, readiness: 66 },
  ];
  await db.insert(preShipmentRiskReportsTable).values(
    riskReportDefs.map((r) => {
      const riskLevel = r.overall > 70 ? "CRITICAL" as const : r.overall > 50 ? "HIGH" as const : r.overall > 30 ? "MODERATE" as const : "LOW" as const;
      return {
        id: lid("psr", r.i + 1),
        companyId: LORIAN_COMPANY_ID,
        shipmentId: shipments[r.i].id,
        overallRiskScore: r.overall,
        laneStressScore: r.lane,
        portCongestionScore: r.port,
        disruptionRiskScore: r.disruption,
        weatherExposureScore: r.weather,
        carrierReliabilityScore: r.carrier,
        entityComplianceScore: r.entity,
        riskLevel,
        mitigations: riskLevel === "LOW" ? [] : riskLevel === "CRITICAL"
          ? ["Immediate escalation required", "Activate contingency routing", "Notify all stakeholders"]
          : riskLevel === "HIGH"
          ? ["Escalate to management", "Monitor disruption events", "Verify carrier schedule"]
          : ["Monitor disruption events", "Verify carrier schedule"],
        componentDetails: {
          laneStress: { score: r.lane, label: "Lane Stress", detail: `Lane stress score: ${r.lane}` },
          portCongestion: { score: r.port, label: "Port Congestion", detail: `Congestion index: ${r.port}` },
          disruptionRisk: { score: r.disruption, label: "Disruption Risk", detail: `Active disruption score: ${r.disruption}` },
          weatherExposure: { score: r.weather, label: "Weather Exposure", detail: `Weather risk: ${r.weather}` },
          carrierReliability: { score: r.carrier, label: "Carrier Reliability", detail: `Carrier on-time: ${r.carrier}%` },
          entityCompliance: { score: r.entity, label: "Entity Compliance", detail: `Compliance score: ${r.entity}` },
        },
        readinessScore: r.readiness,
        readinessComponents: {
          documentCompleteness: { score: Math.min(r.readiness + 5, 100), label: "Documents" },
          carrierConfirmation: { score: Math.min(r.readiness + 2, 100), label: "Carrier" },
          complianceClearance: { score: Math.min(r.readiness - 3, 100), label: "Compliance" },
          bookingStatus: { score: r.readiness, label: "Booking" },
        },
        shipmentEtd: shipments[r.i].etd,
        daysUntilDeparture: shipmentDefs[r.i].etdDaysAgo < 0 ? Math.abs(shipmentDefs[r.i].etdDaysAgo) : 0,
      };
    }),
  );

  // ── 18. Predictive Alerts ──
  console.log("18. Predictive Alerts...");
  const predAlerts = [
    { n: 1, type: "CONGESTION_TREND" as const, severity: "WARNING" as const, title: "Rising Congestion at Shanghai", desc: "Port congestion at CNSHA trending upward over last 72 hours", ports: ["CNSHA"], lanes: ["CNSHA-USLAX", "CNSHA-NLRTM"], confidence: 0.82, impactDays: 3 },
    { n: 2, type: "DISRUPTION_CLUSTER" as const, severity: "CRITICAL" as const, title: "Multi-Event Disruption Cluster – East Asia", desc: "Typhoon + port closure creating compound disruption risk", ports: ["CNSHA", "CNSZX"], lanes: ["CNSHA-USLAX", "CNSZX-NLRTM", "CNSHA-NLRTM"], confidence: 0.91, impactDays: 7 },
    { n: 3, type: "WEATHER_FORECAST" as const, severity: "WARNING" as const, title: "Pacific Storm System – Trans-Pacific Routes", desc: "Storm forecast may impact transit times on JPYOK-USLAX lane", ports: [], lanes: ["JPYOK-USLAX"], confidence: 0.68, impactDays: 2 },
    { n: 4, type: "CARRIER_DEGRADATION" as const, severity: "INFO" as const, title: "ZIM Schedule Reliability Declining", desc: "ZIM on-time performance dropping on SGSIN-AEJEA lane", ports: [], lanes: ["SGSIN-AEJEA"], confidence: 0.75, impactDays: 1 },
    { n: 5, type: "LANE_STRESS_RISING" as const, severity: "WARNING" as const, title: "Suez-Related Rate Surge – Asia-Europe", desc: "Suez disruption causing rate increases on Asia-Europe lanes", ports: ["AEJEA"], lanes: ["CNSHA-AEJEA", "SGSIN-AEJEA", "CNSZX-DEHAM"], confidence: 0.87, impactDays: 14 },
  ];
  await db.insert(predictiveAlertsTable).values(
    predAlerts.map((a) => ({
      id: lid("pa", a.n),
      companyId: LORIAN_COMPANY_ID,
      alertType: a.type,
      severity: a.severity,
      title: a.title,
      description: a.desc,
      affectedPorts: a.ports,
      affectedLanes: a.lanes,
      affectedShipmentIds: activeShipmentIndices.slice(0, 3).map((i) => shipments[i].id),
      confidenceScore: a.confidence,
      predictedImpactDays: a.impactDays,
      status: "ACTIVE" as const,
      expiresAt: daysFromNow(7),
    })),
  );

  // ── 19. Historical Patterns ──
  console.log("19. Historical Patterns...");
  const patterns = [
    { n: 1, type: "LANE_DELAY_AVG" as const, key: "CNSHA-USLAX", name: "Shanghai-LA avg delay", avg: 2.3, trend: "RISING" as const },
    { n: 2, type: "PORT_DISRUPTION_FREQ" as const, key: "CNSHA", name: "Shanghai disruption frequency", avg: 0.12, trend: "RISING" as const },
    { n: 3, type: "CARRIER_PERFORMANCE" as const, key: "MAERSK", name: "Maersk on-time rate", avg: 0.82, trend: "STABLE" as const },
    { n: 4, type: "CONGESTION_TREND" as const, key: "USLAX", name: "LA congestion index", avg: 0.78, trend: "RISING" as const },
    { n: 5, type: "WEATHER_SEASONALITY" as const, key: "CNSHA-USLAX", name: "Trans-Pacific typhoon season", avg: 0.35, trend: "STABLE" as const },
    { n: 6, type: "ENTITY_COMPLIANCE_INCIDENTS" as const, key: "ent_lor_ship_01", name: "Shenzhen MegaTech compliance", avg: 0.05, trend: "FALLING" as const },
  ];
  await db.insert(historicalPatternsTable).values(
    patterns.map((p) => ({
      id: lid("hp", p.n),
      companyId: LORIAN_COMPANY_ID,
      patternType: p.type,
      subjectKey: p.key,
      subjectName: p.name,
      periodStart: daysAgo(90),
      periodEnd: now,
      sampleCount: [142, 88, 205, 175, 63, 120][p.n - 1],
      avgValue: p.avg,
      minValue: p.avg * 0.6,
      maxValue: p.avg * 1.8,
      trendDirection: p.trend,
      trendStrength: [0.65, 0.42, 0.38, 0.71, 0.55, 0.48][p.n - 1],
    })),
  );

  // ── 20. Recommendations (12) ──
  console.log("20. Recommendations...");
  const recDefs = [
    { n: 1, shipIdx: 0, type: "DELAY_WARNING" as const, title: "Typhoon may delay Maersk Sentosa", urgency: "HIGH" as const, confidence: 0.85, status: "PENDING" as const, agent: "disruption-agent" },
    { n: 2, shipIdx: 1, type: "ROUTE_ADJUSTMENT" as const, title: "Consider Cape route to avoid Suez delays", urgency: "CRITICAL" as const, confidence: 0.88, status: "SHOWN" as const, agent: "routing-agent" },
    { n: 3, shipIdx: 2, type: "CARRIER_SWITCH" as const, title: "Switch from COSCO to MAERSK for better schedule reliability", urgency: "MEDIUM" as const, confidence: 0.72, status: "PENDING" as const, agent: "carrier-agent" },
    { n: 4, shipIdx: 3, type: "COMPLIANCE_ESCALATION" as const, title: "Polymer resin shipment requires dual-use check", urgency: "HIGH" as const, confidence: 0.91, status: "ACCEPTED" as const, agent: "compliance-agent" },
    { n: 5, shipIdx: 4, type: "INSURANCE_ADJUSTMENT" as const, title: "Increase coverage for LA port congestion risk", urgency: "MEDIUM" as const, confidence: 0.68, status: "IMPLEMENTED" as const, agent: "insurance-agent" },
    { n: 6, shipIdx: 5, type: "DOCUMENT_CORRECTION" as const, title: "HS code mismatch on customs declaration", urgency: "HIGH" as const, confidence: 0.95, status: "ACCEPTED" as const, agent: "document-agent" },
    { n: 7, shipIdx: 7, type: "RISK_MITIGATION" as const, title: "High composite risk – recommend hold review", urgency: "HIGH" as const, confidence: 0.82, status: "PENDING" as const, agent: "risk-agent" },
    { n: 8, shipIdx: 8, type: "PRICING_ALERT" as const, title: "Market rate surge on JPYOK-USLAX – renegotiate booking", urgency: "MEDIUM" as const, confidence: 0.76, status: "SHOWN" as const, agent: "pricing-agent" },
    { n: 9, shipIdx: 10, type: "DELAY_WARNING" as const, title: "Battery shipment at risk from Shenzhen-Hamburg delays", urgency: "HIGH" as const, confidence: 0.83, status: "PENDING" as const, agent: "disruption-agent" },
    { n: 10, shipIdx: 11, type: "COMPLIANCE_ESCALATION" as const, title: "Specialty chemicals – sanctions screening required", urgency: "CRITICAL" as const, confidence: 0.93, status: "ACCEPTED" as const, agent: "compliance-agent" },
    { n: 11, shipIdx: 13, type: "MARGIN_WARNING" as const, title: "Solar panel shipment margin erosion from rate increase", urgency: "MEDIUM" as const, confidence: 0.71, status: "REJECTED" as const, agent: "margin-agent" },
    { n: 12, shipIdx: 19, type: "CARRIER_SWITCH" as const, title: "Consider MAERSK for JPYOK-USLAX – better reliability", urgency: "LOW" as const, confidence: 0.65, status: "PENDING" as const, agent: "carrier-agent" },
  ];
  const recommendations = recDefs.map((r) => ({
    id: lid("rec", r.n),
    companyId: LORIAN_COMPANY_ID,
    shipmentId: shipments[r.shipIdx].id,
    type: r.type,
    title: r.title,
    explanation: `${r.title}. Analysis based on current intelligence signals.`,
    reasonCodes: [`${r.type}_TRIGGERED`, "SIGNAL_CORRELATION"],
    confidence: r.confidence,
    urgency: r.urgency,
    expectedDelayImpactDays: r.type.includes("DELAY") ? [4.2, null, null, null, null, null, null, null, 3.8, null, null, null][r.n - 1] : null,
    expectedMarginImpactPct: r.type.includes("MARGIN") || r.type.includes("PRICING") ? [null, null, null, null, null, null, null, -6.5, null, null, -4.2, null][r.n - 1] : null,
    expectedRiskReduction: [22, 28, 18, 32, 15, 25, 20, 16, 24, 30, 12, 14][r.n - 1],
    recommendedAction: `Review and ${r.urgency === "CRITICAL" ? "escalate immediately" : "take action within 24 hours"}`,
    status: r.status,
    sourceAgent: r.agent,
    intelligenceEnriched: "true",
    snapshotId: lid("snap", r.shipIdx + 1),
    respondedAt: ["ACCEPTED", "REJECTED", "IMPLEMENTED"].includes(r.status) ? spreadTime(1, [180, 240, 90, 320, 150][r.n % 5]) : null,
    respondedBy: ["ACCEPTED", "REJECTED", "IMPLEMENTED"].includes(r.status) ? USERS.operator.id : null,
    expiresAt: daysFromNow(7),
    createdAt: spreadTime(2, r.n * 47 + 15),
  }));
  await db.insert(recommendationsTable).values(recommendations);

  // ── 21. Recommendation Outcomes ──
  console.log("21. Recommendation Outcomes...");
  const outcomeRecs = recDefs.filter((r) => ["ACCEPTED", "REJECTED", "IMPLEMENTED"].includes(r.status));
  await db.insert(recommendationOutcomesTable).values(
    outcomeRecs.map((r, i) => ({
      id: lid("rout", i + 1),
      companyId: LORIAN_COMPANY_ID,
      recommendationId: lid("rec", r.n),
      shipmentId: shipments[r.shipIdx].id,
      action: r.status === "IMPLEMENTED" ? "IMPLEMENTED" as const : r.status === "REJECTED" ? "REJECTED" as const : "ACCEPTED" as const,
      actorId: USERS.operator.id,
      actorType: "USER" as const,
      outcomeEvaluation: r.status === "IMPLEMENTED" ? "POSITIVE" as const : "PENDING" as const,
      decidedAt: spreadTime(1, i * 38 + 25),
    })),
  );

  // ── 22. Workflow Tasks (8) ──
  console.log("22. Workflow Tasks...");
  const taskDefs = [
    { n: 1, shipIdx: 0, type: "DISRUPTION_RESPONSE_TASK" as const, title: "Respond to typhoon impact on LOR-2026-0001", status: "OPEN" as const, priority: "HIGH" as const, source: "AUTO_POLICY" as const, recN: 1 },
    { n: 2, shipIdx: 1, type: "ROUTE_REVIEW" as const, title: "Review Suez alternative routing for LOR-2026-0002", status: "IN_PROGRESS" as const, priority: "CRITICAL" as const, source: "RECOMMENDATION" as const, recN: 2 },
    { n: 3, shipIdx: 3, type: "COMPLIANCE_CASE" as const, title: "Dual-use compliance check – polymer resins", status: "OPEN" as const, priority: "HIGH" as const, source: "AUTO_POLICY" as const, recN: 4 },
    { n: 4, shipIdx: 4, type: "INSURANCE_REVIEW" as const, title: "Adjust insurance coverage for LA congestion", status: "COMPLETED" as const, priority: "MEDIUM" as const, source: "RECOMMENDATION" as const, recN: 5 },
    { n: 5, shipIdx: 5, type: "DOCUMENT_CORRECTION_TASK" as const, title: "Fix HS code on customs declaration", status: "IN_PROGRESS" as const, priority: "HIGH" as const, source: "AUTO_POLICY" as const, recN: 6 },
    { n: 6, shipIdx: 7, type: "RISK_MITIGATION_TASK" as const, title: "Risk hold review – precision lenses shipment", status: "OPEN" as const, priority: "HIGH" as const, source: "RECOMMENDATION" as const, recN: 7 },
    { n: 7, shipIdx: 10, type: "DELAY_RESPONSE_TASK" as const, title: "Monitor delay risk for battery shipment", status: "OPEN" as const, priority: "MEDIUM" as const, source: "AUTO_POLICY" as const, recN: 9 },
    { n: 8, shipIdx: 11, type: "COMPLIANCE_CASE" as const, title: "Sanctions screening – specialty chemicals", status: "IN_PROGRESS" as const, priority: "CRITICAL" as const, source: "AUTO_POLICY" as const, recN: 10 },
  ];
  const tasks = taskDefs.map((t) => ({
    id: lid("task", t.n),
    companyId: LORIAN_COMPANY_ID,
    shipmentId: shipments[t.shipIdx].id,
    recommendationId: lid("rec", t.recN),
    taskType: t.type,
    title: t.title,
    description: `${t.title}. Auto-created from recommendation.`,
    status: t.status,
    priority: t.priority,
    assignedTo: t.status === "IN_PROGRESS" ? USERS.operator.id : USERS.manager.id,
    createdBy: USERS.admin.id,
    creationSource: t.source,
    dueAt: daysFromNow(t.priority === "CRITICAL" ? 1 : t.priority === "HIGH" ? 3 : 7),
    completedAt: t.status === "COMPLETED" ? spreadTime(0, 420 + t.n * 18) : null,
    escalationLevel: t.priority === "CRITICAL" ? 1 : 0,
    createdAt: spreadTime(2, t.n * 55 + 30),
  }));
  await db.insert(workflowTasksTable).values(tasks);

  // ── 23. Task Events ──
  console.log("23. Task Events...");
  const taskEventRows = taskDefs.flatMap((t, i) => {
    type TaskEventRow = typeof taskEventsTable.$inferInsert;
    const evts: Array<Pick<TaskEventRow, "id" | "taskId" | "eventType" | "actorId" | "notes" | "createdAt">> = [
      { id: lid("te", i * 3 + 1), taskId: lid("task", t.n), eventType: "CREATED", actorId: USERS.admin.id, notes: "Task auto-created", createdAt: spreadTime(2, t.n * 55 + 30) },
    ];
    if (t.status === "IN_PROGRESS" || t.status === "COMPLETED") {
      evts.push({ id: lid("te", i * 3 + 2), taskId: lid("task", t.n), eventType: "ASSIGNED", actorId: USERS.manager.id, notes: `Assigned to ${USERS.operator.name}`, createdAt: spreadTime(1, t.n * 42 + 120) });
    }
    if (t.status === "COMPLETED") {
      evts.push({ id: lid("te", i * 3 + 3), taskId: lid("task", t.n), eventType: "COMPLETED", actorId: USERS.operator.id, notes: "Task completed", createdAt: spreadTime(0, 420 + t.n * 18) });
    }
    return evts;
  });
  await db.insert(taskEventsTable).values(
    taskEventRows.map((e) => ({
      ...e,
      companyId: LORIAN_COMPANY_ID,
    })),
  );

  // ── 24. Policy Decisions ──
  console.log("24. Policy Decisions...");
  const policyDecisionRows = taskDefs.filter((t) => t.source === "AUTO_POLICY").map((t, i) => ({
    id: lid("pd", i + 1),
    companyId: LORIAN_COMPANY_ID,
    recommendationId: lid("rec", t.recN),
    shipmentId: shipments[t.shipIdx].id,
    recommendationType: recDefs.find((r) => r.n === t.recN)!.type,
    urgency: recDefs.find((r) => r.n === t.recN)!.urgency,
    confidence: String(recDefs.find((r) => r.n === t.recN)!.confidence),
    intelligenceEnriched: true,
    outcome: "AUTO_CREATE_TASK" as const,
    taskTypeResolved: t.type,
    priorityResolved: t.priority,
    dueHoursResolved: t.priority === "CRITICAL" ? 24 : t.priority === "HIGH" ? 72 : 168,
    reason: `Policy auto-created task: ${t.title}`,
    taskId: lid("task", t.n),
    applied: true,
    createdAt: spreadTime(2, t.n * 55 + 28),
  }));
  await db.insert(policyDecisionsTable).values(policyDecisionRows);

  // ── 25. Operational Notifications ──
  console.log("25. Operational Notifications...");
  const notifications = [
    { n: 1, userId: USERS.operator.id, type: "TASK_ASSIGNED" as const, title: "New task assigned: Route review for LOR-2026-0002", severity: "WARNING" as const, taskId: lid("task", 2), shipId: shipments[1].id },
    { n: 2, userId: USERS.manager.id, type: "TASK_AUTO_CREATED" as const, title: "Auto-created: Disruption response for LOR-2026-0001", severity: "WARNING" as const, taskId: lid("task", 1), shipId: shipments[0].id },
    { n: 3, userId: USERS.operator.id, type: "TASK_AUTO_CREATED" as const, title: "Auto-created: Compliance case for polymer resins", severity: "CRITICAL" as const, taskId: lid("task", 3), shipId: shipments[3].id },
    { n: 4, userId: USERS.operator.id, type: "TASK_COMPLETED" as const, title: "Insurance review completed for LOR-2026-0005", severity: "INFO" as const, taskId: lid("task", 4), shipId: shipments[4].id },
    { n: 5, userId: USERS.manager.id, type: "TASK_ESCALATED" as const, title: "Sanctions screening escalated for LOR-2026-0012", severity: "CRITICAL" as const, taskId: lid("task", 8), shipId: shipments[11].id },
    { n: 6, userId: USERS.admin.id, type: "RECOMMENDATION_CHANGED" as const, title: "New critical recommendation: Suez route adjustment", severity: "WARNING" as const, taskId: null, shipId: shipments[1].id },
  ];
  await db.insert(operationalNotificationsTable).values(
    notifications.map((n) => ({
      id: lid("notif", n.n),
      companyId: LORIAN_COMPANY_ID,
      userId: n.userId,
      eventType: n.type,
      title: n.title,
      severity: n.severity,
      relatedTaskId: n.taskId,
      relatedShipmentId: n.shipId,
      read: n.n <= 2,
      createdAt: spreadTime(n.n <= 3 ? 2 : 1, n.n * 73 + 42),
    })),
  );

  // ── 26. Booking Decisions ──
  console.log("26. Booking Decisions...");
  const bookingDefs = [
    { i: 0,  overall: 28, readiness: 72, status: "APPROVED" as const, confidence: 0.91 },
    { i: 1,  overall: 62, readiness: 55, status: "REQUIRES_REVIEW" as const, confidence: 0.74 },
    { i: 2,  overall: 44, readiness: 68, status: "APPROVED_WITH_CAUTION" as const, confidence: 0.82 },
    { i: 3,  overall: 55, readiness: 61, status: "APPROVED_WITH_CAUTION" as const, confidence: 0.78 },
    { i: 4,  overall: 71, readiness: 45, status: "REQUIRES_REVIEW" as const, confidence: 0.68 },
    { i: 5,  overall: 35, readiness: 82, status: "APPROVED" as const, confidence: 0.88 },
    { i: 6,  overall: 18, readiness: 95, status: "APPROVED" as const, confidence: 0.96 },
    { i: 7,  overall: 32, readiness: 74, status: "APPROVED" as const, confidence: 0.89 },
    { i: 8,  overall: 41, readiness: 66, status: "APPROVED_WITH_CAUTION" as const, confidence: 0.81 },
    { i: 9,  overall: 48, readiness: 58, status: "APPROVED_WITH_CAUTION" as const, confidence: 0.76 },
    { i: 10, overall: 58, readiness: 52, status: "REQUIRES_REVIEW" as const, confidence: 0.72 },
    { i: 11, overall: 38, readiness: 71, status: "APPROVED" as const, confidence: 0.85 },
    { i: 12, overall: 75, readiness: 38, status: "REQUIRES_REVIEW" as const, confidence: 0.65 },
    { i: 13, overall: 52, readiness: 63, status: "APPROVED_WITH_CAUTION" as const, confidence: 0.79 },
    { i: 14, overall: 22, readiness: 88, status: "APPROVED" as const, confidence: 0.93 },
    { i: 15, overall: 65, readiness: 48, status: "REQUIRES_REVIEW" as const, confidence: 0.71 },
    { i: 16, overall: 15, readiness: 92, status: "APPROVED" as const, confidence: 0.95 },
    { i: 17, overall: 30, readiness: 78, status: "APPROVED" as const, confidence: 0.90 },
    { i: 18, overall: 68, readiness: 42, status: "REQUIRES_REVIEW" as const, confidence: 0.67 },
    { i: 19, overall: 46, readiness: 64, status: "APPROVED_WITH_CAUTION" as const, confidence: 0.80 },
  ];
  await db.insert(bookingDecisionsTable).values(
    bookingDefs.map((b, j) => ({
      id: lid("bd", j + 1),
      companyId: LORIAN_COMPANY_ID,
      shipmentId: shipments[b.i].id,
      status: b.status,
      confidence: b.confidence,
      overallRiskScore: b.overall,
      readinessScore: b.readiness,
      reasonCodes: b.status === "APPROVED" ? ["ALL_CLEAR", "COMPLIANT"] : b.status === "APPROVED_WITH_CAUTION" ? ["ELEVATED_LANE_STRESS", "MONITOR_REQUIRED"] : ["ELEVATED_LANE_STRESS", "DISRUPTION_ACTIVE", "MANUAL_REVIEW_REQUIRED"],
      requiredActions: b.status === "REQUIRES_REVIEW" ? ["Manual risk review required", "Verify carrier schedule"] : [],
      inputScores: {
        laneStress: Math.round(b.overall * 0.8 * 100) / 100,
        portCongestion: Math.round(b.overall * 0.65 * 100) / 100,
        disruptionRisk: Math.round(b.overall * 0.55 * 100) / 100,
        weatherExposure: Math.round(b.overall * 0.3 * 100) / 100,
        carrierReliability: Math.round((95 - b.overall * 0.3) * 100) / 100,
        entityCompliance: Math.round((92 - b.overall * 0.15) * 100) / 100,
      },
      decidedAt: spreadTime(j % 3, j * 35 + 90),
    })),
  );

  // ── 27. Release Gate Holds ──
  console.log("27. Release Gate Holds...");
  const gateHolds = [
    { n: 1, shipIdx: 3, gate: "COMPLIANCE_BLOCK" as const, severity: "CRITICAL" as const, status: "ACTIVE" as const, reason: "Dual-use goods require export license verification", policy: "booking.compliance_block_threshold", action: "Submit export license documentation" },
    { n: 2, shipIdx: 0, gate: "DISRUPTION_APPROVAL" as const, severity: "HIGH" as const, status: "ACTIVE" as const, reason: "Active typhoon on origin route", policy: "booking.disruption_block_threshold", action: "Confirm vessel departure after typhoon clears" },
    { n: 3, shipIdx: 1, gate: "LANE_STRESS_HOLD" as const, severity: "HIGH" as const, status: "ACTIVE" as const, reason: "Suez canal disruption affecting lane", policy: "booking.lane_stress_hold_threshold", action: "Review alternative routing options" },
    { n: 4, shipIdx: 4, gate: "WEATHER_HOLD" as const, severity: "MEDIUM" as const, status: "RELEASED" as const, reason: "Weather hold cleared", policy: "booking.weather_hold_threshold", action: "No action required", },
    { n: 5, shipIdx: 11, gate: "COMPLIANCE_BLOCK" as const, severity: "CRITICAL" as const, status: "ACTIVE" as const, reason: "Specialty chemicals require sanctions screening", policy: "booking.compliance_block_threshold", action: "Complete sanctions screening process" },
  ];
  await db.insert(releaseGateHoldsTable).values(
    gateHolds.map((g) => ({
      id: lid("rgh", g.n),
      companyId: LORIAN_COMPANY_ID,
      shipmentId: shipments[g.shipIdx].id,
      gateType: g.gate,
      status: g.status,
      severity: g.severity,
      reason: g.reason,
      policyRule: g.policy,
      requiredAction: g.action,
      resolvedBy: g.status === "RELEASED" ? USERS.operator.id : null,
      resolvedAt: g.status === "RELEASED" ? spreadTime(1, 215) : null,
      resolutionNotes: g.status === "RELEASED" ? "Cleared after weather advisory lifted" : null,
      createdAt: spreadTime(3, g.n * 62 + 18),
    })),
  );

  // ── 28. Mitigation Playbooks ──
  console.log("28. Mitigation Playbooks...");
  const playbooks = [
    { n: 1, shipIdx: 0, trigger: "Typhoon disruption on CNSHA-USLAX lane", source: "ALERT" as const, priority: "HIGH" as const, steps: [
      { stepId: "s1", type: "MONITOR", title: "Track typhoon trajectory", description: "Monitor weather updates", status: "IN_PROGRESS" as const },
      { stepId: "s2", type: "NOTIFY", title: "Alert carrier and consignee", description: "Send delay notifications", status: "COMPLETED" as const },
      { stepId: "s3", type: "REROUTE", title: "Evaluate alternative routing", description: "Check northern route viability", status: "PENDING" as const },
    ]},
    { n: 2, shipIdx: 1, trigger: "Suez canal blockage – vessel rerouting decision", source: "RISK_EVALUATION" as const, priority: "CRITICAL" as const, steps: [
      { stepId: "s1", type: "ASSESS", title: "Evaluate Suez transit delay", description: "Check expected clearance timeline", status: "COMPLETED" as const },
      { stepId: "s2", type: "REROUTE", title: "Calculate Cape of Good Hope routing", description: "Assess cost and time impact", status: "IN_PROGRESS" as const },
      { stepId: "s3", type: "APPROVE", title: "Get management approval for rerouting", description: "Requires manager sign-off", status: "PENDING" as const },
      { stepId: "s4", type: "EXECUTE", title: "Submit carrier rerouting request", description: "Contact MSC operations", status: "PENDING" as const },
    ]},
    { n: 3, shipIdx: 3, trigger: "Compliance block on dual-use polymer resins", source: "GATE_HOLD" as const, priority: "HIGH" as const, steps: [
      { stepId: "s1", type: "VERIFY", title: "Check export control classification", description: "Verify ECCN for polymer resins", status: "COMPLETED" as const },
      { stepId: "s2", type: "DOCUMENT", title: "Obtain export license", description: "Apply for license if required", status: "IN_PROGRESS" as const },
      { stepId: "s3", type: "RELEASE", title: "Release compliance gate hold", description: "Clear hold after documentation", status: "PENDING" as const },
    ]},
  ];
  await db.insert(mitigationPlaybooksTable).values(
    playbooks.map((p) => ({
      id: lid("mp", p.n),
      companyId: LORIAN_COMPANY_ID,
      shipmentId: shipments[p.shipIdx].id,
      triggerCondition: p.trigger,
      triggerSource: p.source,
      status: "IN_PROGRESS" as const,
      steps: p.steps,
      totalSteps: p.steps.length,
      completedSteps: p.steps.filter((s) => s.status === "COMPLETED").length,
      priority: p.priority,
      createdAt: spreadTime(2, p.n * 85 + 42),
    })),
  );

  // ── 29. Scenario Comparisons ──
  console.log("29. Scenario Comparisons...");
  const scenarioDefs: Array<{ i: number; baseline: string; baselineRisk: number; baselineReadiness: number; cost: number; transitDays: number; route: string; alts: Array<{ type: string; label: string; risk: number; readiness: number; cost: number; transit: number; rec: string; detail: Record<string, string> }>; best: string }> = [
    { i: 0, baseline: "Current: CNSHA→USLAX via Maersk", baselineRisk: 0.28, baselineReadiness: 0.72, cost: 3800, transitDays: 23, route: "CNSHA → Pacific → USLAX",
      alts: [
        { type: "CARRIER_SWITCH", label: "Switch to COSCO – same route", risk: 0.32, readiness: 0.68, cost: 3500, transit: 24, rec: "Slightly higher risk, lower cost", detail: { carrier: "COSCO" } },
        { type: "REROUTE", label: "Route via JPYOK transshipment", risk: 0.22, readiness: 0.75, cost: 4100, transit: 27, rec: "Lower risk with +4 days transit", detail: { route: "CNSHA → JPYOK → USLAX" } },
      ], best: "REROUTE" },
    { i: 1, baseline: "Current: Suez Route via MSC", baselineRisk: 0.62, baselineReadiness: 0.55, cost: 4200, transitDays: 28, route: "CNSZX → Suez → NLRTM",
      alts: [
        { type: "REROUTE", label: "Cape of Good Hope Route", risk: 0.35, readiness: 0.70, cost: 5800, transit: 42, rec: "Lower risk but +14 days transit", detail: { route: "CNSZX → Cape → NLRTM" } },
        { type: "CARRIER_SWITCH", label: "Switch to MAERSK – partial Suez", risk: 0.55, readiness: 0.60, cost: 4500, transit: 32, rec: "Moderate risk reduction", detail: { carrier: "MAERSK" } },
      ], best: "REROUTE" },
    { i: 2, baseline: "Current: CNSHA→NLRTM via COSCO", baselineRisk: 0.44, baselineReadiness: 0.68, cost: 3600, transitDays: 35, route: "CNSHA → Suez → NLRTM",
      alts: [
        { type: "CARRIER_SWITCH", label: "Switch to CMA CGM", risk: 0.38, readiness: 0.72, cost: 3800, transit: 33, rec: "Better schedule reliability", detail: { carrier: "CMA_CGM" } },
        { type: "REROUTE", label: "Route via SGSIN transshipment", risk: 0.30, readiness: 0.78, cost: 4200, transit: 38, rec: "Reduced disruption exposure", detail: { route: "CNSHA → SGSIN → NLRTM" } },
      ], best: "CARRIER_SWITCH" },
    { i: 3, baseline: "Current: SGSIN→USNYC via CMA CGM", baselineRisk: 0.55, baselineReadiness: 0.61, cost: 4800, transitDays: 35, route: "SGSIN → Suez → USNYC",
      alts: [
        { type: "REROUTE", label: "Cape route avoiding Suez", risk: 0.30, readiness: 0.74, cost: 6200, transit: 45, rec: "Avoids Suez risk entirely", detail: { route: "SGSIN → Cape → USNYC" } },
        { type: "CARRIER_SWITCH", label: "Switch to MAERSK direct", risk: 0.48, readiness: 0.65, cost: 5100, transit: 33, rec: "Faster transit, slight risk reduction", detail: { carrier: "MAERSK" } },
      ], best: "CARRIER_SWITCH" },
    { i: 4, baseline: "Current: CNSHA→USLAX via Hapag", baselineRisk: 0.71, baselineReadiness: 0.45, cost: 3900, transitDays: 22, route: "CNSHA → Pacific → USLAX",
      alts: [
        { type: "CARRIER_SWITCH", label: "Switch to MAERSK", risk: 0.45, readiness: 0.68, cost: 4200, transit: 23, rec: "Significantly lower risk", detail: { carrier: "MAERSK" } },
        { type: "REROUTE", label: "Route via KRPUS transshipment", risk: 0.38, readiness: 0.72, cost: 4500, transit: 26, rec: "Best risk reduction", detail: { route: "CNSHA → KRPUS → USLAX" } },
      ], best: "REROUTE" },
    { i: 5, baseline: "Current: CNSZX→NLRTM via Evergreen", baselineRisk: 0.35, baselineReadiness: 0.82, cost: 3400, transitDays: 30, route: "CNSZX → Suez → NLRTM",
      alts: [
        { type: "CARRIER_SWITCH", label: "Switch to MSC", risk: 0.32, readiness: 0.80, cost: 3600, transit: 29, rec: "Similar profile, faster", detail: { carrier: "MSC" } },
      ], best: "CARRIER_SWITCH" },
    { i: 6, baseline: "Completed: DEHAM→BRSSZ via Maersk", baselineRisk: 0.18, baselineReadiness: 0.95, cost: 3200, transitDays: 18, route: "DEHAM → Atlantic → BRSSZ",
      alts: [
        { type: "CARRIER_SWITCH", label: "Alternative: MSC", risk: 0.20, readiness: 0.92, cost: 3100, transit: 19, rec: "Comparable performance", detail: { carrier: "MSC" } },
      ], best: "CARRIER_SWITCH" },
    { i: 7, baseline: "Current: CNSHA→AEJEA via ONE", baselineRisk: 0.32, baselineReadiness: 0.74, cost: 2800, transitDays: 20, route: "CNSHA → SCS → AEJEA",
      alts: [
        { type: "CARRIER_SWITCH", label: "Switch to CMA CGM", risk: 0.28, readiness: 0.78, cost: 2900, transit: 19, rec: "Better reliability", detail: { carrier: "CMA_CGM" } },
        { type: "REROUTE", label: "Via SGSIN hub", risk: 0.25, readiness: 0.80, cost: 3200, transit: 22, rec: "Lower risk with transshipment", detail: { route: "CNSHA → SGSIN → AEJEA" } },
      ], best: "CARRIER_SWITCH" },
    { i: 8, baseline: "Current: JPYOK→USLAX via MSC", baselineRisk: 0.41, baselineReadiness: 0.66, cost: 3100, transitDays: 22, route: "JPYOK → Pacific → USLAX",
      alts: [
        { type: "CARRIER_SWITCH", label: "Switch to ONE", risk: 0.35, readiness: 0.72, cost: 3300, transit: 21, rec: "Better on-time performance", detail: { carrier: "ONE" } },
        { type: "REROUTE", label: "Direct JPYOK→USLAX express", risk: 0.30, readiness: 0.78, cost: 3600, transit: 18, rec: "Fastest option, premium cost", detail: { route: "JPYOK → Direct → USLAX" } },
      ], best: "REROUTE" },
    { i: 9, baseline: "Current: CNSZX→DEHAM via COSCO", baselineRisk: 0.48, baselineReadiness: 0.58, cost: 3700, transitDays: 38, route: "CNSZX → Suez → DEHAM",
      alts: [
        { type: "REROUTE", label: "Cape route via Durban", risk: 0.28, readiness: 0.72, cost: 4800, transit: 48, rec: "Avoids Suez, +10 days", detail: { route: "CNSZX → Cape → DEHAM" } },
        { type: "CARRIER_SWITCH", label: "Switch to Hapag-Lloyd", risk: 0.42, readiness: 0.64, cost: 3900, transit: 36, rec: "Better schedule adherence", detail: { carrier: "HAPAG" } },
      ], best: "CARRIER_SWITCH" },
    { i: 10, baseline: "Current: CNSZX→DEHAM via CMA CGM", baselineRisk: 0.58, baselineReadiness: 0.52, cost: 4100, transitDays: 32, route: "CNSZX → Suez → DEHAM",
      alts: [
        { type: "CARRIER_SWITCH", label: "Switch to MAERSK", risk: 0.45, readiness: 0.62, cost: 4300, transit: 30, rec: "More reliable carrier", detail: { carrier: "MAERSK" } },
        { type: "REROUTE", label: "Northern sea route (seasonal)", risk: 0.40, readiness: 0.65, cost: 3800, transit: 25, rec: "Shorter but weather-dependent", detail: { route: "CNSZX → Arctic → DEHAM" } },
      ], best: "REROUTE" },
    { i: 11, baseline: "Current: SGSIN→AEJEA via ZIM", baselineRisk: 0.38, baselineReadiness: 0.71, cost: 2200, transitDays: 14, route: "SGSIN → Indian Ocean → AEJEA",
      alts: [
        { type: "CARRIER_SWITCH", label: "Switch to ONE", risk: 0.32, readiness: 0.76, cost: 2400, transit: 13, rec: "Faster with lower risk", detail: { carrier: "ONE" } },
      ], best: "CARRIER_SWITCH" },
    { i: 12, baseline: "Rejected: SGSIN→USNYC via Hapag", baselineRisk: 0.75, baselineReadiness: 0.38, cost: 5200, transitDays: 32, route: "SGSIN → Suez → USNYC",
      alts: [
        { type: "REROUTE", label: "Cape route avoiding conflict zone", risk: 0.40, readiness: 0.65, cost: 6500, transit: 44, rec: "Significantly safer route", detail: { route: "SGSIN → Cape → USNYC" } },
        { type: "CARRIER_SWITCH", label: "Switch to MAERSK with escort", risk: 0.55, readiness: 0.55, cost: 5800, transit: 34, rec: "Enhanced security measures", detail: { carrier: "MAERSK" } },
      ], best: "REROUTE" },
    { i: 13, baseline: "Current: CNSHA→NLRTM via Maersk", baselineRisk: 0.52, baselineReadiness: 0.63, cost: 4000, transitDays: 30, route: "CNSHA → Suez → NLRTM",
      alts: [
        { type: "CARRIER_SWITCH", label: "Switch to COSCO", risk: 0.48, readiness: 0.66, cost: 3700, transit: 32, rec: "Lower cost option", detail: { carrier: "COSCO" } },
        { type: "REROUTE", label: "Via Mediterranean transshipment", risk: 0.40, readiness: 0.70, cost: 4400, transit: 34, rec: "Reduced single-point risk", detail: { route: "CNSHA → AEJEA → NLRTM" } },
      ], best: "REROUTE" },
    { i: 14, baseline: "Draft: CNSHA→USLAX (no carrier)", baselineRisk: 0.22, baselineReadiness: 0.88, cost: 3600, transitDays: 23, route: "CNSHA → Pacific → USLAX",
      alts: [
        { type: "CARRIER_SWITCH", label: "Book with MAERSK", risk: 0.20, readiness: 0.90, cost: 3800, transit: 22, rec: "Best reliability option", detail: { carrier: "MAERSK" } },
        { type: "CARRIER_SWITCH", label: "Book with COSCO", risk: 0.25, readiness: 0.85, cost: 3400, transit: 24, rec: "Budget-friendly option", detail: { carrier: "COSCO" } },
      ], best: "CARRIER_SWITCH" },
    { i: 15, baseline: "Current: CNSHA→AEJEA via Evergreen", baselineRisk: 0.65, baselineReadiness: 0.48, cost: 2900, transitDays: 20, route: "CNSHA → SCS → AEJEA",
      alts: [
        { type: "CARRIER_SWITCH", label: "Switch to ONE", risk: 0.42, readiness: 0.68, cost: 3100, transit: 19, rec: "Significant risk improvement", detail: { carrier: "ONE" } },
        { type: "REROUTE", label: "Route via SGSIN", risk: 0.38, readiness: 0.72, cost: 3400, transit: 23, rec: "Best risk reduction", detail: { route: "CNSHA → SGSIN → AEJEA" } },
      ], best: "REROUTE" },
    { i: 16, baseline: "Completed: DEHAM→BRSSZ via ONE", baselineRisk: 0.15, baselineReadiness: 0.92, cost: 2800, transitDays: 16, route: "DEHAM → Atlantic → BRSSZ",
      alts: [
        { type: "CARRIER_SWITCH", label: "Alternative: Hapag-Lloyd", risk: 0.18, readiness: 0.90, cost: 2900, transit: 17, rec: "Comparable performance", detail: { carrier: "HAPAG" } },
      ], best: "CARRIER_SWITCH" },
    { i: 17, baseline: "Current: CNSZX→DEHAM via ZIM", baselineRisk: 0.30, baselineReadiness: 0.78, cost: 3500, transitDays: 34, route: "CNSZX → Suez → DEHAM",
      alts: [
        { type: "CARRIER_SWITCH", label: "Switch to MAERSK", risk: 0.25, readiness: 0.82, cost: 3800, transit: 32, rec: "Better reliability", detail: { carrier: "MAERSK" } },
        { type: "REROUTE", label: "Via Mediterranean hub", risk: 0.22, readiness: 0.85, cost: 4100, transit: 36, rec: "Lower disruption exposure", detail: { route: "CNSZX → AEJEA → DEHAM" } },
      ], best: "CARRIER_SWITCH" },
    { i: 18, baseline: "Cancelled: SGSIN→AEJEA via CMA CGM", baselineRisk: 0.68, baselineReadiness: 0.42, cost: 2600, transitDays: 15, route: "SGSIN → Indian Ocean → AEJEA",
      alts: [
        { type: "CARRIER_SWITCH", label: "Rebook with ONE", risk: 0.35, readiness: 0.70, cost: 2800, transit: 14, rec: "Better risk profile for rebooking", detail: { carrier: "ONE" } },
        { type: "REROUTE", label: "Via Colombo transshipment", risk: 0.30, readiness: 0.75, cost: 3100, transit: 18, rec: "Safest rebook option", detail: { route: "SGSIN → LKCMB → AEJEA" } },
      ], best: "REROUTE" },
    { i: 19, baseline: "Current: JPYOK→USLAX via Hapag", baselineRisk: 0.46, baselineReadiness: 0.64, cost: 3200, transitDays: 20, route: "JPYOK → Pacific → USLAX",
      alts: [
        { type: "CARRIER_SWITCH", label: "Switch to MAERSK", risk: 0.35, readiness: 0.72, cost: 3500, transit: 21, rec: "Better on-time performance", detail: { carrier: "MAERSK" } },
        { type: "REROUTE", label: "Via KRPUS transshipment", risk: 0.30, readiness: 0.76, cost: 3700, transit: 24, rec: "Lowest risk option", detail: { route: "JPYOK → KRPUS → USLAX" } },
      ], best: "REROUTE" },
  ];
  await db.insert(scenarioComparisonsTable).values(
    scenarioDefs.map((s, j) => ({
      id: lid("sc", j + 1),
      companyId: LORIAN_COMPANY_ID,
      shipmentId: shipments[s.i].id,
      baselineScenario: { label: s.baseline, riskScore: s.baselineRisk, readinessScore: s.baselineReadiness, estimatedCost: s.cost, estimatedTransitDays: s.transitDays, details: { route: s.route } },
      alternativeScenarios: s.alts.map((a) => ({
        scenarioType: a.type, label: a.label, riskScore: a.risk, readinessScore: a.readiness,
        estimatedCost: a.cost, estimatedTransitDays: a.transit,
        riskDelta: Math.round((a.risk - s.baselineRisk) * 100) / 100,
        costDelta: a.cost - s.cost,
        transitDelta: a.transit - s.transitDays,
        recommendation: a.rec, details: a.detail,
      })),
      bestAlternative: s.best,
    })),
  );

  // ── 29b. Compliance Screenings ──
  console.log("29b. Compliance Screenings...");
  const complianceDefs: Array<{ i: number; status: "CLEAR" | "ALERT" | "BLOCKED"; matchCount: number }> = [
    { i: 0,  status: "CLEAR", matchCount: 0 },
    { i: 1,  status: "CLEAR", matchCount: 0 },
    { i: 2,  status: "CLEAR", matchCount: 0 },
    { i: 3,  status: "ALERT", matchCount: 2 },
    { i: 4,  status: "CLEAR", matchCount: 0 },
    { i: 5,  status: "CLEAR", matchCount: 0 },
    { i: 6,  status: "CLEAR", matchCount: 0 },
    { i: 7,  status: "CLEAR", matchCount: 0 },
    { i: 8,  status: "CLEAR", matchCount: 0 },
    { i: 9,  status: "ALERT", matchCount: 1 },
    { i: 10, status: "CLEAR", matchCount: 0 },
    { i: 11, status: "ALERT", matchCount: 1 },
    { i: 12, status: "BLOCKED", matchCount: 3 },
    { i: 13, status: "CLEAR", matchCount: 0 },
    { i: 14, status: "CLEAR", matchCount: 0 },
    { i: 15, status: "CLEAR", matchCount: 0 },
    { i: 16, status: "CLEAR", matchCount: 0 },
    { i: 17, status: "CLEAR", matchCount: 0 },
    { i: 18, status: "BLOCKED", matchCount: 2 },
    { i: 19, status: "CLEAR", matchCount: 0 },
  ];
  await db.insert(complianceScreeningsTable).values(
    complianceDefs.map((c, j) => ({
      id: lid("cs", j + 1),
      companyId: LORIAN_COMPANY_ID,
      shipmentId: shipments[c.i].id,
      status: c.status,
      screenedParties: 2,
      matchCount: c.matchCount,
      matches: c.matchCount > 0
        ? Array.from({ length: c.matchCount }, (_, k) => ({
            listName: k === 0 ? "OFAC SDN" : "EU Consolidated Sanctions",
            matchedEntry: `Entity Match ${k + 1} – partial name similarity`,
            similarity: 0.72 + k * 0.08,
            matchType: "PARTIAL",
            recommendation: k === 0 ? "Manual review recommended" : "Cross-reference required",
          }))
        : [],
      listsChecked: ["OFAC SDN", "EU Consolidated", "UN Security Council", "UK Sanctions"],
      screenedAt: spreadTime(j % 4, j * 28 + 55),
    })),
  );

  // ── 30. Lane Strategies ──
  console.log("30. Lane Strategies...");
  const strategyDefs = [
    { n: 1, lane: 0, strategy: "MONITOR_CLOSELY" as const, stress: 65, delay: 2.3, disruption: 0.15, congestion: 0.8, confidence: 0.82 },
    { n: 2, lane: 1, strategy: "REDUCE_EXPOSURE" as const, stress: 78, delay: 3.5, disruption: 0.22, congestion: 0.7, confidence: 0.88 },
    { n: 3, lane: 2, strategy: "REROUTE_CONDITIONAL" as const, stress: 82, delay: 4.0, disruption: 0.25, congestion: 0.85, confidence: 0.85 },
    { n: 4, lane: 3, strategy: "STABLE" as const, stress: 35, delay: 1.2, disruption: 0.05, congestion: 0.5, confidence: 0.78 },
    { n: 5, lane: 4, strategy: "STABLE" as const, stress: 30, delay: 0.8, disruption: 0.03, congestion: 0.45, confidence: 0.75 },
    { n: 6, lane: 5, strategy: "TIGHTEN_GATES" as const, stress: 70, delay: 2.8, disruption: 0.18, congestion: 0.75, confidence: 0.8 },
    { n: 7, lane: 6, strategy: "STABLE" as const, stress: 28, delay: 0.5, disruption: 0.02, congestion: 0.35, confidence: 0.72 },
    { n: 8, lane: 7, strategy: "MONITOR_CLOSELY" as const, stress: 55, delay: 1.8, disruption: 0.1, congestion: 0.6, confidence: 0.77 },
    { n: 9, lane: 8, strategy: "REPRICE_LANE" as const, stress: 72, delay: 3.0, disruption: 0.2, congestion: 0.78, confidence: 0.84 },
    { n: 10, lane: 9, strategy: "STABLE" as const, stress: 25, delay: 0.6, disruption: 0.02, congestion: 0.4, confidence: 0.7 },
  ];
  await db.insert(laneStrategiesTable).values(
    strategyDefs.map((s) => ({
      id: lid("ls", s.n),
      companyId: LORIAN_COMPANY_ID,
      originPort: TRADE_LANES[s.lane].origin,
      destinationPort: TRADE_LANES[s.lane].destination,
      strategy: s.strategy,
      confidence: s.confidence,
      stressScore: s.stress,
      delayExposure: s.delay,
      disruptionFrequency: s.disruption,
      congestionTrend: s.congestion,
      recommendationVolume: [8, 12, 5, 10, 3, 7, 4, 11, 6, 9][s.n - 1] || 5,
      taskVolume: [4, 6, 3, 5, 2, 3, 2, 5, 3, 4][s.n - 1] || 3,
      exceptionCount: [2, 4, 1, 3, 0, 2, 1, 3, 2, 2][s.n - 1] || 1,
      marginPressure: [8.5, 14.2, 5.8, 12.1, 3.2, 7.4, 4.6, 11.8, 6.3, 9.7][s.n - 1] || 6.0,
      shipmentCount: [18, 28, 12, 22, 8, 15, 10, 25, 14, 20][s.n - 1] || 12,
      factors: [
        { dimension: "disruption_frequency", score: s.disruption * 100, weight: 0.3, detail: `${s.disruption * 100}% disruption rate` },
        { dimension: "congestion_trend", score: s.congestion * 100, weight: 0.25, detail: `${s.congestion * 100}% congestion` },
        { dimension: "delay_exposure", score: s.delay * 20, weight: 0.25, detail: `${s.delay} avg delay days` },
        { dimension: "stress_composite", score: s.stress, weight: 0.2, detail: `Composite stress: ${s.stress}` },
      ],
      suggestedActions: s.stress > 60
        ? ["Review carrier allocation", "Consider alternative routing", "Increase monitoring frequency"]
        : ["Maintain current operations"],
    })),
  );

  // ── 31. Carrier Allocations ──
  console.log("31. Carrier Allocations...");
  const allocDefs = [
    { n: 1, carrier: "MAERSK", lane: "CNSHA-USLAX", alloc: "PREFERRED" as const, reliability: 0.85, riskAdj: 0.82 },
    { n: 2, carrier: "MSC", lane: "CNSZX-NLRTM", alloc: "ACCEPTABLE_MONITOR" as const, reliability: 0.78, riskAdj: 0.72 },
    { n: 3, carrier: "COSCO", lane: "CNSHA-NLRTM", alloc: "REDUCE_ALLOCATION" as const, reliability: 0.7, riskAdj: 0.65 },
    { n: 4, carrier: "CMA_CGM", lane: "SGSIN-USNYC", alloc: "PREFERRED" as const, reliability: 0.88, riskAdj: 0.85 },
    { n: 5, carrier: "HAPAG", lane: "CNSHA-USLAX", alloc: "ACCEPTABLE_MONITOR" as const, reliability: 0.82, riskAdj: 0.78 },
    { n: 6, carrier: "EVERGREEN", lane: "CNSZX-NLRTM", alloc: "AVOID_CURRENT_CONDITIONS" as const, reliability: 0.65, riskAdj: 0.58 },
    { n: 7, carrier: "ONE", lane: "CNSHA-AEJEA", alloc: "PREFERRED" as const, reliability: 0.84, riskAdj: 0.8 },
    { n: 8, carrier: "ZIM", lane: "SGSIN-AEJEA", alloc: "REDUCE_ALLOCATION" as const, reliability: 0.68, riskAdj: 0.6 },
  ];
  await db.insert(carrierAllocationsTable).values(
    allocDefs.map((a) => ({
      id: lid("ca", a.n),
      companyId: LORIAN_COMPANY_ID,
      carrierName: a.carrier,
      lane: a.lane,
      allocation: a.alloc,
      confidence: [0.88, 0.82, 0.75, 0.91, 0.85, 0.72, 0.87, 0.78][a.n - 1],
      reliabilityScore: a.reliability,
      recommendationTriggerRate: [0.12, 0.18, 0.25, 0.08, 0.15, 0.28, 0.10, 0.22][a.n - 1],
      switchAwayRate: [0.05, 0.12, 0.18, 0.03, 0.08, 0.20, 0.06, 0.15][a.n - 1],
      disruptionExposure: [0.15, 0.22, 0.30, 0.12, 0.18, 0.35, 0.14, 0.28][a.n - 1],
      lanePerformance: [0.83, 0.76, 0.68, 0.86, 0.80, 0.62, 0.82, 0.65][a.n - 1],
      riskAdjustedScore: a.riskAdj,
      shipmentCount: [28, 18, 15, 32, 22, 8, 25, 12][a.n - 1],
      factors: [
        { dimension: "reliability", score: a.reliability * 100, weight: 0.35, detail: `${(a.reliability * 100).toFixed(0)}% on-time` },
        { dimension: "risk_adjusted", score: a.riskAdj * 100, weight: 0.35, detail: `Risk-adjusted: ${(a.riskAdj * 100).toFixed(0)}` },
        { dimension: "disruption_exposure", score: (1 - a.riskAdj) * 100, weight: 0.3, detail: "Exposure factor" },
      ],
      suggestedActions: a.alloc === "AVOID_CURRENT_CONDITIONS"
        ? ["Do not book new shipments with this carrier on this lane", "Monitor for improvement"]
        : a.alloc === "REDUCE_ALLOCATION"
        ? ["Reduce booking volume", "Shift to higher-performing carriers"]
        : ["Maintain current allocation"],
    })),
  );

  // ── 32. Network Recommendations ──
  console.log("32. Network Recommendations...");
  const netRecs = [
    { n: 1, scope: "LANE" as const, scopeId: "CNSHA-USLAX", type: "DIVERSIFY_ROUTING" as const, priority: "HIGH" as const, title: "Diversify CNSHA-USLAX routing", desc: "Multiple disruption events suggest diversifying trans-Pacific routes" },
    { n: 2, scope: "PORT" as const, scopeId: "USLAX", type: "REDUCE_PORT_TRAFFIC" as const, priority: "HIGH" as const, title: "Reduce LA port dependency", desc: "Critical congestion at USLAX – shift volume to alternate US West Coast ports" },
    { n: 3, scope: "CARRIER" as const, scopeId: "EVERGREEN", type: "SHIFT_CARRIER_VOLUME" as const, priority: "MEDIUM" as const, title: "Shift volume from Evergreen on Asia-Europe", desc: "Reliability below threshold on CNSZX-NLRTM" },
    { n: 4, scope: "LANE" as const, scopeId: "CNSHA-AEJEA", type: "TIGHTEN_RELEASE_GATES" as const, priority: "CRITICAL" as const, title: "Tighten gates on Shanghai-Jebel Ali", desc: "Suez disruption creating elevated risk" },
    { n: 5, scope: "ENTITY" as const, scopeId: "ent_lor_ship_04", type: "ESCALATE_COMPLIANCE" as const, priority: "MEDIUM" as const, title: "Enhanced screening for Hamburg Industrial Machinery", desc: "Dual-use goods require additional compliance checks" },
  ];
  await db.insert(networkRecommendationsTable).values(
    netRecs.map((nr) => ({
      id: lid("nr", nr.n),
      companyId: LORIAN_COMPANY_ID,
      scope: nr.scope,
      scopeIdentifier: nr.scopeId,
      type: nr.type,
      priority: nr.priority,
      title: nr.title,
      description: nr.desc,
      evidence: [{ signal: "composite_analysis", value: 0.75, threshold: 0.6, source: "strategic-engine" }],
      suggestedAction: nr.desc,
      estimatedImpact: { riskReduction: [28, 22, 18, 35, 25][nr.n - 1], costImpact: null, delayReduction: [2.5, 1.8, 1.2, 3.2, 2.0][nr.n - 1] },
      status: "OPEN" as const,
      fingerprint: `nr_fp_lor_${nr.n}`,
    })),
  );

  // ── 33. Portfolio Snapshots ──
  console.log("33. Portfolio Snapshots...");
  await db.insert(portfolioSnapshotsTable).values([
    {
      id: lid("ps", 1),
      companyId: LORIAN_COMPANY_ID,
      period: "DAILY" as const,
      totalShipments: 20,
      activeShipments: 13,
      riskDistribution: { low: 4, medium: 5, high: 3, critical: 1 },
      delayExposure: 3.2,
      complianceExposure: 0.15,
      marginAtRisk: 85000,
      mitigatedExposure: 45000,
      unmitigatedExposure: 40000,
      exposureByLane: TRADE_LANES.slice(0, 5).map((l, i) => ({ lane: `${l.origin}-${l.destination}`, exposure: [18500, 12200, 8800, 15600, 22100][i], shipmentCount: [4, 3, 2, 3, 5][i] })),
      exposureByCarrier: CARRIERS.slice(0, 5).map((c, i) => ({ carrier: c.name, exposure: [14200, 11800, 8500, 12400, 9200][i], shipmentCount: [4, 3, 2, 3, 2][i] })),
      exposureByPort: PORTS.slice(0, 5).map((p, i) => ({ port: p.code, exposure: [16800, 12500, 9200, 14100, 8800][i], shipmentCount: [5, 3, 2, 4, 2][i] })),
      trends: { riskTrend: "worsening", delayTrend: "worsening", complianceTrend: "stable" },
    },
    {
      id: lid("ps", 2),
      companyId: LORIAN_COMPANY_ID,
      period: "WEEKLY" as const,
      totalShipments: 20,
      activeShipments: 13,
      riskDistribution: { low: 5, medium: 4, high: 3, critical: 1 },
      delayExposure: 2.8,
      complianceExposure: 0.12,
      marginAtRisk: 72000,
      mitigatedExposure: 42000,
      unmitigatedExposure: 30000,
      trends: { riskTrend: "stable", delayTrend: "worsening", complianceTrend: "improving" },
      snapshotAt: daysAgo(7),
    },
  ]);

  // ── 34. Intervention Attributions ──
  console.log("34. Intervention Attributions...");
  await db.insert(interventionAttributionsTable).values([
    {
      id: lid("ia", 1),
      companyId: LORIAN_COMPANY_ID,
      period: "WEEKLY" as const,
      delaysAvoided: 4,
      estimatedDaysSaved: 12.5,
      marginProtected: 45000,
      risksMitigated: 7,
      interventionsTriggered: 12,
      interventionsCompleted: 5,
      tasksAutoCreated: 5,
      bookingHoldsPreventedIssues: 3,
      recommendationsAccepted: 4,
      recommendationsTotal: 12,
      intelligenceEnrichedImpact: 35000,
      internalOnlyImpact: 10000,
      attributionDetails: [
        { category: "disruption_avoidance", metric: "delays_avoided", value: 4, methodology: "counterfactual_comparison" },
        { category: "margin_protection", metric: "margin_saved", value: 45000, methodology: "pre_post_intervention" },
        { category: "compliance", metric: "holds_caught", value: 3, methodology: "gate_effectiveness" },
      ],
    },
  ]);

  // ── 35. Trade Graph Edges (key relationships) ──
  console.log("35. Trade Graph Edges...");
  type EdgeRow = typeof tradeGraphEdgesTable.$inferInsert;
  const edgeRows: Array<Pick<EdgeRow, "id" | "companyId" | "edgeType" | "sourceType" | "sourceId" | "targetType" | "targetId">> = [];
  shipments.slice(0, 10).forEach((s, i) => {
    const lane = TRADE_LANES[shipmentDefs[i].lane];
    edgeRows.push({
      id: lid("tge", edgeRows.length + 1),
      companyId: LORIAN_COMPANY_ID,
      edgeType: "SHIPMENT_ON_TRADE_LANE",
      sourceType: "SHIPMENT",
      sourceId: s.id,
      targetType: "TRADE_LANE",
      targetId: `${lane.origin}-${lane.destination}`,
    });
    if (s.carrier) {
      edgeRows.push({
        id: lid("tge", edgeRows.length + 1),
        companyId: LORIAN_COMPANY_ID,
        edgeType: "SHIPPER_USES_CARRIER",
        sourceType: "ENTITY",
        sourceId: s.shipperId!,
        targetType: "ENTITY",
        targetId: s.carrierId!,
      });
    }
    edgeRows.push({
      id: lid("tge", edgeRows.length + 1),
      companyId: LORIAN_COMPANY_ID,
      edgeType: "SHIPMENT_ROUTED_VIA_PORT",
      sourceType: "SHIPMENT",
      sourceId: s.id,
      targetType: "PORT",
      targetId: lane.origin,
    });
    edgeRows.push({
      id: lid("tge", edgeRows.length + 1),
      companyId: LORIAN_COMPANY_ID,
      edgeType: "SHIPMENT_ROUTED_VIA_PORT",
      sourceType: "SHIPMENT",
      sourceId: s.id,
      targetType: "PORT",
      targetId: lane.destination,
    });
  });
  await db.insert(tradeGraphEdgesTable).values(edgeRows);

  // ── 36. Tenant Policies (a few overrides for demo) ──
  console.log("36. Tenant Policies...");
  await db.insert(tenantPoliciesTable).values([
    {
      id: lid("tp", 1),
      companyId: LORIAN_COMPANY_ID,
      policyKey: "recommendation.auto_task_confidence",
      policyValue: { value: 0.8 },
      description: "Lorian requires 80% confidence for auto-task creation",
      category: "RECOMMENDATION_THRESHOLDS" as const,
      isActive: true,
      version: 1,
      updatedBy: USERS.admin.id,
    },
    {
      id: lid("tp", 2),
      companyId: LORIAN_COMPANY_ID,
      policyKey: "booking.compliance_block_threshold",
      policyValue: { value: 0.3 },
      description: "Lower compliance threshold – stricter screening",
      category: "BOOKING_GATE_THRESHOLDS" as const,
      isActive: true,
      version: 1,
      updatedBy: USERS.admin.id,
    },
    {
      id: lid("tp", 3),
      companyId: LORIAN_COMPANY_ID,
      policyKey: "escalation.critical_sla_hours",
      policyValue: { value: 4 },
      description: "Critical tasks must be addressed within 4 hours",
      category: "SLA_RULES" as const,
      isActive: true,
      version: 1,
      updatedBy: USERS.admin.id,
    },
  ]);

  // ── 37. Operating Mode ──
  console.log("37. Operating Mode...");
  await db.insert(operatingModesTable).values({
    id: lid("om", 1),
    companyId: LORIAN_COMPANY_ID,
    modeName: "SEMI_AUTONOMOUS" as const,
    isActive: true,
    policyOverrides: {},
    description: "Semi-autonomous mode – auto-create tasks for high-confidence recommendations, require approval for critical actions",
    activatedBy: USERS.admin.id,
    activatedAt: daysAgo(30),
  });

  // ── 38. Report Snapshots (demo reports) ──
  console.log("38. Report Snapshots...");
  await db.insert(reportSnapshotsTable).values([
    {
      id: lid("rpt", 1),
      companyId: LORIAN_COMPANY_ID,
      reportType: "EXECUTIVE_SUMMARY" as const,
      title: "Weekly Executive Summary – Lorian Freight",
      reportData: {
        activeShipments: 13,
        totalRiskExposure: 85000,
        topRisks: ["Typhoon Khanun – East Asia", "Suez Canal Delays", "LA Port Congestion"],
        interventionsSaved: "$45,000 in margin protection",
        recommendations: { total: 12, accepted: 4, pending: 5 },
      },
      format: "JSON" as const,
      generatedBy: USERS.admin.id,
      periodStart: daysAgo(7),
      periodEnd: now,
    },
    {
      id: lid("rpt", 2),
      companyId: LORIAN_COMPANY_ID,
      reportType: "PORTFOLIO_RISK" as const,
      title: "Portfolio Risk Report",
      reportData: {
        riskDistribution: { low: 4, medium: 5, high: 3, critical: 1 },
        topLanes: ["CNSHA-USLAX", "CNSZX-NLRTM", "CNSHA-NLRTM"],
        trendDirection: "worsening",
      },
      format: "JSON" as const,
      generatedBy: USERS.manager.id,
      periodStart: daysAgo(30),
      periodEnd: now,
    },
  ]);

  console.log("\n=== LORIAN DEMO SEED COMPLETE ===");
  console.log(`Company: ${LORIAN_COMPANY_ID}`);
  console.log(`Users: ${Object.values(USERS).map((u) => u.email).join(", ")}`);
  console.log(`Password: ${PASSWORD}`);
  console.log(`Shipments: ${shipments.length}`);
  console.log(`Recommendations: ${recommendations.length}`);
  console.log(`Workflow Tasks: ${tasks.length}`);
  console.log(`Disruption Events: ${disruptions.length}`);
  console.log(`Weather Risk Events: ${weatherEvents.length}`);
}

if (process.argv[1]?.endsWith("seed-lorian.ts") || process.argv[1]?.endsWith("seed-lorian.js")) {
  seedLorian().then(() => process.exit(0)).catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
}
