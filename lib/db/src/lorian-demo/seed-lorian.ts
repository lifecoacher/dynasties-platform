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
  billingAccountsTable,
  customerBillingProfilesTable,
  chargeRulesTable,
  invoicesTable,
  invoiceLineItemsTable,
  receivablesTable,
  paymentOptionConfigsTable,
  balanceFinancingRecordsTable,
  commercialEventsTable,
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

  const shipmentCreationDaysAgo: Record<number, number> = {
    1: 18, 2: 16, 3: 14, 4: 15, 5: 24, 6: 22, 7: 27,
    8: 19, 9: 14, 10: 15, 11: 20, 12: 14, 13: 17,
    14: 21, 15: 14, 16: 18, 17: 28, 18: 15, 19: 19, 20: 16,
  };

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
    createdAt: spreadTime(shipmentCreationDaysAgo[s.n] ?? 10, s.n * 73 + 42),
  }));
  await db.insert(shipmentsTable).values(shipments);

  // ── 5. Risk Scores ──
  console.log("5. Risk Scores...");
  const activeShipmentIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
  const riskScoreDefs = [
    { i: 0,  composite: 0.285, cargo: 0.12, lane: 0.22, counter: 0.08, geo: 0.18, seasonal: 0.10, docs: 0.05 },
    { i: 1,  composite: 0.552, cargo: 0.18, lane: 0.35, counter: 0.12, geo: 0.42, seasonal: 0.15, docs: 0.08 },
    { i: 2,  composite: 0.628, cargo: 0.22, lane: 0.38, counter: 0.15, geo: 0.45, seasonal: 0.20, docs: 0.10 },
    { i: 3,  composite: 0.483, cargo: 0.15, lane: 0.28, counter: 0.18, geo: 0.32, seasonal: 0.12, docs: 0.06 },
    { i: 4,  composite: 0.721, cargo: 0.25, lane: 0.40, counter: 0.10, geo: 0.48, seasonal: 0.22, docs: 0.12 },
    { i: 5,  composite: 0.356, cargo: 0.10, lane: 0.20, counter: 0.08, geo: 0.22, seasonal: 0.08, docs: 0.04 },
    { i: 6,  composite: 0.220, cargo: 0.08, lane: 0.12, counter: 0.05, geo: 0.10, seasonal: 0.06, docs: 0.03 },
    { i: 7,  composite: 0.304, cargo: 0.12, lane: 0.18, counter: 0.06, geo: 0.15, seasonal: 0.08, docs: 0.04 },
    { i: 8,  composite: 0.268, cargo: 0.10, lane: 0.15, counter: 0.07, geo: 0.12, seasonal: 0.06, docs: 0.03 },
    { i: 9,  composite: 0.456, cargo: 0.18, lane: 0.30, counter: 0.12, geo: 0.35, seasonal: 0.14, docs: 0.07 },
    { i: 10, composite: 0.523, cargo: 0.20, lane: 0.32, counter: 0.14, geo: 0.38, seasonal: 0.18, docs: 0.09 },
    { i: 11, composite: 0.385, cargo: 0.14, lane: 0.22, counter: 0.10, geo: 0.25, seasonal: 0.10, docs: 0.05 },
    { i: 12, composite: 0.687, cargo: 0.24, lane: 0.38, counter: 0.18, geo: 0.45, seasonal: 0.20, docs: 0.11 },
    { i: 13, composite: 0.421, cargo: 0.16, lane: 0.25, counter: 0.10, geo: 0.28, seasonal: 0.12, docs: 0.06 },
    { i: 14, composite: 0.205, cargo: 0.06, lane: 0.10, counter: 0.04, geo: 0.08, seasonal: 0.05, docs: 0.02 },
    { i: 15, composite: 0.589, cargo: 0.22, lane: 0.35, counter: 0.14, geo: 0.40, seasonal: 0.18, docs: 0.10 },
    { i: 16, composite: 0.182, cargo: 0.05, lane: 0.08, counter: 0.03, geo: 0.06, seasonal: 0.04, docs: 0.02 },
    { i: 17, composite: 0.320, cargo: 0.10, lane: 0.18, counter: 0.08, geo: 0.18, seasonal: 0.08, docs: 0.04 },
    { i: 18, composite: 0.645, cargo: 0.22, lane: 0.36, counter: 0.16, geo: 0.42, seasonal: 0.19, docs: 0.10 },
    { i: 19, composite: 0.408, cargo: 0.15, lane: 0.24, counter: 0.10, geo: 0.26, seasonal: 0.12, docs: 0.06 },
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
      primaryRiskFactors: r.composite > 0.50
        ? [{ factor: "High trade lane stress", explanation: "Lane shows elevated disruption signals" }, { factor: "Geopolitical risk", explanation: "Route passes through elevated-risk region" }]
        : r.composite > 0.30
        ? [{ factor: "Moderate lane activity", explanation: "Lane shows moderate congestion signals" }]
        : [{ factor: "Standard risk profile", explanation: "No elevated risk factors detected" }],
      recommendedAction: r.composite > 0.60 ? "ESCALATE" as const : r.composite > 0.35 ? "OPERATOR_REVIEW" as const : "AUTO_APPROVE" as const,
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
      congestionScore: deterministicValue(i * 5 + 1, 0.15, 0.72),
      disruptionScore: deterministicValue(i * 5 + 2, 0.10, 0.65),
      delayStressScore: deterministicValue(i * 5 + 3, 0.08, 0.55),
      marketPressureScore: deterministicValue(i * 5 + 4, 0.05, 0.45),
      compositeStressScore: deterministicValue(i * 5 + 5, 0.22, 0.75),
    })),
  );
  await db.insert(portScoresTable).values(
    PORTS.map((port, i) => ({
      id: lid("psc", i + 1),
      companyId: LORIAN_COMPANY_ID,
      portCode: port.code,
      portName: port.name,
      congestionSeverity: deterministicValue(i * 5 + 100, 0.12, 0.72),
      weatherExposure: deterministicValue(i * 5 + 101, 0.08, 0.55),
      disruptionExposure: deterministicValue(i * 5 + 102, 0.10, 0.62),
      operationalVolatility: deterministicValue(i * 5 + 103, 0.05, 0.35),
      compositeScore: deterministicValue(i * 5 + 104, 0.18, 0.68),
    })),
  );
  await db.insert(carrierScoresTable).values(
    CARRIERS.map((carrier, i) => ({
      id: lid("csc", i + 1),
      companyId: LORIAN_COMPANY_ID,
      carrierName: carrier.name,
      performanceScore: deterministicValue(i * 5 + 200, 0.55, 0.92),
      anomalyScore: deterministicValue(i * 5 + 201, 0.02, 0.25),
      reliabilityScore: deterministicValue(i * 5 + 202, 0.65, 0.92),
      laneStressExposure: deterministicValue(i * 5 + 203, 0.08, 0.45),
      compositeScore: deterministicValue(i * 5 + 204, 0.45, 0.88),
    })),
  );
  await db.insert(entityScoresTable).values(
    [...SHIPPERS, ...CONSIGNEES].map((ent, i) => ({
      id: lid("esc", i + 1),
      companyId: LORIAN_COMPANY_ID,
      entityId: ent.id,
      entityName: ent.name,
      sanctionsRiskScore: deterministicValue(i * 4 + 300, 0.005, 0.12),
      deniedPartyConfidence: deterministicValue(i * 4 + 301, 0.002, 0.08),
      documentationIrregularity: deterministicValue(i * 4 + 302, 0.01, 0.18),
      compositeScore: deterministicValue(i * 4 + 303, 0.01, 0.22),
    })),
  );

  // ── 16. Intelligence Snapshots (for active shipments) ──
  console.log("16. Intelligence Snapshots...");
  const intelDefs = [
    { i: 0,  congestion: 0.42, disruption: 0.28, weather: 0.18, sanctions: 0.02, vessel: 0.12, market: 0.22, composite: 0.25 },
    { i: 1,  congestion: 0.58, disruption: 0.52, weather: 0.30, sanctions: 0.03, vessel: 0.18, market: 0.35, composite: 0.48 },
    { i: 2,  congestion: 0.55, disruption: 0.48, weather: 0.35, sanctions: 0.05, vessel: 0.22, market: 0.30, composite: 0.42 },
    { i: 3,  congestion: 0.38, disruption: 0.35, weather: 0.15, sanctions: 0.08, vessel: 0.10, market: 0.25, composite: 0.32 },
    { i: 4,  congestion: 0.68, disruption: 0.55, weather: 0.42, sanctions: 0.02, vessel: 0.28, market: 0.38, composite: 0.58 },
    { i: 5,  congestion: 0.32, disruption: 0.22, weather: 0.12, sanctions: 0.02, vessel: 0.08, market: 0.18, composite: 0.20 },
    { i: 6,  congestion: 0.15, disruption: 0.08, weather: 0.05, sanctions: 0.01, vessel: 0.05, market: 0.10, composite: 0.10 },
    { i: 7,  congestion: 0.28, disruption: 0.18, weather: 0.10, sanctions: 0.02, vessel: 0.10, market: 0.15, composite: 0.18 },
    { i: 8,  congestion: 0.25, disruption: 0.15, weather: 0.08, sanctions: 0.01, vessel: 0.08, market: 0.12, composite: 0.15 },
    { i: 9,  congestion: 0.48, disruption: 0.40, weather: 0.22, sanctions: 0.04, vessel: 0.15, market: 0.28, composite: 0.38 },
    { i: 10, congestion: 0.52, disruption: 0.45, weather: 0.25, sanctions: 0.03, vessel: 0.20, market: 0.32, composite: 0.42 },
    { i: 11, congestion: 0.22, disruption: 0.12, weather: 0.08, sanctions: 0.06, vessel: 0.06, market: 0.14, composite: 0.16 },
    { i: 12, congestion: 0.62, disruption: 0.58, weather: 0.38, sanctions: 0.10, vessel: 0.25, market: 0.36, composite: 0.55 },
    { i: 13, congestion: 0.45, disruption: 0.38, weather: 0.20, sanctions: 0.02, vessel: 0.15, market: 0.25, composite: 0.35 },
    { i: 14, congestion: 0.18, disruption: 0.10, weather: 0.05, sanctions: 0.01, vessel: 0.05, market: 0.08, composite: 0.10 },
    { i: 15, congestion: 0.58, disruption: 0.50, weather: 0.28, sanctions: 0.02, vessel: 0.22, market: 0.34, composite: 0.48 },
    { i: 16, congestion: 0.12, disruption: 0.05, weather: 0.03, sanctions: 0.01, vessel: 0.04, market: 0.06, composite: 0.08 },
    { i: 17, congestion: 0.30, disruption: 0.20, weather: 0.12, sanctions: 0.01, vessel: 0.08, market: 0.16, composite: 0.18 },
    { i: 18, congestion: 0.60, disruption: 0.52, weather: 0.32, sanctions: 0.08, vessel: 0.24, market: 0.35, composite: 0.52 },
    { i: 19, congestion: 0.40, disruption: 0.32, weather: 0.16, sanctions: 0.02, vessel: 0.12, market: 0.22, composite: 0.28 },
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
      externalReasonCodes: d.composite > 0.40
        ? ["LANE_STRESS_ELEVATED", "PORT_CONGESTION_HIGH", "DISRUPTION_ACTIVE"]
        : d.composite > 0.20
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
    { i: 0,  overall: 0.2036, lane: 0.35, port: 0.28, disruption: 0.15, weather: 0.12, carrier: 0.82, entity: 0.91, readiness: 0.78 },
    { i: 1,  overall: 0.4422, lane: 0.62, port: 0.48, disruption: 0.42, weather: 0.22, carrier: 0.71, entity: 0.85, readiness: 0.62 },
    { i: 2,  overall: 0.6724, lane: 0.72, port: 0.55, disruption: 0.58, weather: 0.38, carrier: 0.65, entity: 0.82, readiness: 0.55 },
    { i: 3,  overall: 0.5326, lane: 0.45, port: 0.38, disruption: 0.48, weather: 0.18, carrier: 0.78, entity: 0.72, readiness: 0.68 },
    { i: 4,  overall: 0.7677, lane: 0.78, port: 0.68, disruption: 0.62, weather: 0.45, carrier: 0.58, entity: 0.88, readiness: 0.42 },
    { i: 5,  overall: 0.3287, lane: 0.38, port: 0.32, disruption: 0.25, weather: 0.15, carrier: 0.76, entity: 0.90, readiness: 0.72 },
    { i: 6,  overall: 0.1250, lane: 0.15, port: 0.10, disruption: 0.08, weather: 0.05, carrier: 0.92, entity: 0.95, readiness: 0.95 },
    { i: 7,  overall: 0.2555, lane: 0.30, port: 0.22, disruption: 0.18, weather: 0.10, carrier: 0.85, entity: 0.92, readiness: 0.75 },
    { i: 8,  overall: 0.2426, lane: 0.28, port: 0.20, disruption: 0.16, weather: 0.08, carrier: 0.80, entity: 0.88, readiness: 0.80 },
    { i: 9,  overall: 0.4815, lane: 0.55, port: 0.42, disruption: 0.38, weather: 0.20, carrier: 0.72, entity: 0.78, readiness: 0.58 },
    { i: 10, overall: 0.3786, lane: 0.42, port: 0.35, disruption: 0.32, weather: 0.18, carrier: 0.75, entity: 0.86, readiness: 0.65 },
    { i: 11, overall: 0.2293, lane: 0.22, port: 0.18, disruption: 0.12, weather: 0.08, carrier: 0.88, entity: 0.92, readiness: 0.82 },
    { i: 12, overall: 0.7240, lane: 0.75, port: 0.62, disruption: 0.65, weather: 0.35, carrier: 0.60, entity: 0.68, readiness: 0.38 },
    { i: 13, overall: 0.4585, lane: 0.52, port: 0.40, disruption: 0.35, weather: 0.22, carrier: 0.78, entity: 0.85, readiness: 0.60 },
    { i: 14, overall: 0.1820, lane: 0.20, port: 0.15, disruption: 0.10, weather: 0.05, carrier: 0.90, entity: 0.94, readiness: 0.88 },
    { i: 15, overall: 0.6388, lane: 0.68, port: 0.55, disruption: 0.52, weather: 0.30, carrier: 0.68, entity: 0.82, readiness: 0.48 },
    { i: 16, overall: 0.1050, lane: 0.12, port: 0.08, disruption: 0.05, weather: 0.03, carrier: 0.95, entity: 0.96, readiness: 0.92 },
    { i: 17, overall: 0.2840, lane: 0.32, port: 0.25, disruption: 0.20, weather: 0.12, carrier: 0.82, entity: 0.90, readiness: 0.76 },
    { i: 18, overall: 0.6530, lane: 0.70, port: 0.58, disruption: 0.55, weather: 0.28, carrier: 0.62, entity: 0.70, readiness: 0.40 },
    { i: 19, overall: 0.4216, lane: 0.48, port: 0.35, disruption: 0.30, weather: 0.16, carrier: 0.76, entity: 0.84, readiness: 0.66 },
  ];
  await db.insert(preShipmentRiskReportsTable).values(
    riskReportDefs.map((r) => {
      const riskLevel = r.overall > 0.70 ? "CRITICAL" as const : r.overall > 0.50 ? "HIGH" as const : r.overall > 0.30 ? "MODERATE" as const : "LOW" as const;
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
          laneStress: { score: r.lane, label: "Lane Stress", detail: `Lane stress score: ${Math.round(r.lane * 100)}%` },
          portCongestion: { score: r.port, label: "Port Congestion", detail: `Congestion index: ${Math.round(r.port * 100)}%` },
          disruptionRisk: { score: r.disruption, label: "Disruption Risk", detail: `Active disruption score: ${Math.round(r.disruption * 100)}%` },
          weatherExposure: { score: r.weather, label: "Weather Exposure", detail: `Weather risk: ${Math.round(r.weather * 100)}%` },
          carrierReliability: { score: r.carrier, label: "Carrier Reliability", detail: `Carrier on-time: ${Math.round(r.carrier * 100)}%` },
          entityCompliance: { score: r.entity, label: "Entity Compliance", detail: `Compliance score: ${Math.round(r.entity * 100)}%` },
        },
        readinessScore: r.readiness,
        readinessComponents: {
          documentCompleteness: { score: Math.min(r.readiness + 0.05, 1), label: "Documents" },
          carrierConfirmation: { score: Math.min(r.readiness + 0.02, 1), label: "Carrier" },
          complianceClearance: { score: Math.min(r.readiness - 0.03, 1), label: "Compliance" },
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
    { i: 0,  overall: 0.28, readiness: 0.72, status: "APPROVED" as const, confidence: 0.91 },
    { i: 1,  overall: 0.62, readiness: 0.55, status: "REQUIRES_REVIEW" as const, confidence: 0.74 },
    { i: 2,  overall: 0.44, readiness: 0.68, status: "APPROVED_WITH_CAUTION" as const, confidence: 0.82 },
    { i: 3,  overall: 0.55, readiness: 0.61, status: "APPROVED_WITH_CAUTION" as const, confidence: 0.78 },
    { i: 4,  overall: 0.71, readiness: 0.45, status: "REQUIRES_REVIEW" as const, confidence: 0.68 },
    { i: 5,  overall: 0.35, readiness: 0.82, status: "APPROVED" as const, confidence: 0.88 },
    { i: 6,  overall: 0.18, readiness: 0.95, status: "APPROVED" as const, confidence: 0.96 },
    { i: 7,  overall: 0.32, readiness: 0.74, status: "APPROVED" as const, confidence: 0.89 },
    { i: 8,  overall: 0.41, readiness: 0.66, status: "APPROVED_WITH_CAUTION" as const, confidence: 0.81 },
    { i: 9,  overall: 0.48, readiness: 0.58, status: "APPROVED_WITH_CAUTION" as const, confidence: 0.76 },
    { i: 10, overall: 0.58, readiness: 0.52, status: "REQUIRES_REVIEW" as const, confidence: 0.72 },
    { i: 11, overall: 0.38, readiness: 0.71, status: "APPROVED" as const, confidence: 0.85 },
    { i: 12, overall: 0.75, readiness: 0.38, status: "REQUIRES_REVIEW" as const, confidence: 0.65 },
    { i: 13, overall: 0.52, readiness: 0.63, status: "APPROVED_WITH_CAUTION" as const, confidence: 0.79 },
    { i: 14, overall: 0.22, readiness: 0.88, status: "APPROVED" as const, confidence: 0.93 },
    { i: 15, overall: 0.65, readiness: 0.48, status: "REQUIRES_REVIEW" as const, confidence: 0.71 },
    { i: 16, overall: 0.15, readiness: 0.92, status: "APPROVED" as const, confidence: 0.95 },
    { i: 17, overall: 0.30, readiness: 0.78, status: "APPROVED" as const, confidence: 0.90 },
    { i: 18, overall: 0.68, readiness: 0.42, status: "REQUIRES_REVIEW" as const, confidence: 0.67 },
    { i: 19, overall: 0.46, readiness: 0.64, status: "APPROVED_WITH_CAUTION" as const, confidence: 0.80 },
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
        carrierReliability: Math.round((0.95 - b.overall * 0.3) * 100) / 100,
        entityCompliance: Math.round((0.92 - b.overall * 0.15) * 100) / 100,
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

  // ─── BILLING & RECEIVABLES ───────────────────────────────────────
  console.log("\n--- Seeding Billing & Receivables ---");

  const BILLING_ACCOUNT_ID = "ba_lor_001";
  const PAY_CONFIG_ID = "poc_lor_001";

  await db.insert(billingAccountsTable).values({
    id: BILLING_ACCOUNT_ID,
    companyId: LORIAN_COMPANY_ID,
    legalEntityName: "Lorian Freight Forwarding Ltd",
    billingEmail: "billing@lorian.demo",
    currency: "USD",
    invoicePrefix: "LOR-INV",
    defaultPaymentTerms: "NET_30",
    collectionsContactName: "James Thornton",
    collectionsContactEmail: "collections@lorian.demo",
    collectionsContactPhone: "+1-555-0142",
    paymentProviderStatus: "ACTIVE",
    balanceProviderStatus: "ACTIVE",
    financeEnabled: true,
    spreadModel: "MARKUP",
    spreadBps: 75,
    platformFeeAmount: "0",
    platformFeeCurrency: "USD",
    branding: { accentColor: "#00BFA6", companyName: "Lorian" },
    status: "ACTIVE",
  }).onConflictDoNothing();

  await db.insert(paymentOptionConfigsTable).values({
    id: PAY_CONFIG_ID,
    companyId: LORIAN_COMPANY_ID,
    billingAccountId: BILLING_ACCOUNT_ID,
    payNowEnabled: true,
    payLaterEnabled: true,
    net30Enabled: true,
    net60Enabled: true,
    achEnabled: true,
    cardEnabled: true,
    wireEnabled: true,
    balanceOfferVisible: true,
    feeHandling: "PASS_THROUGH",
  }).onConflictDoNothing();

  const customerProfiles = [
    { id: "cbp_lor_001", entityId: CONSIGNEES[0].id, name: CONSIGNEES[0].name, email: "ap@pacificcoast.com", country: "United States", city: "Los Angeles", terms: "NET_30" as const, credit: "500000", exposure: "142500", risk: "LOW" as const, eligibility: "ELIGIBLE" as const, method: "ACH" as const },
    { id: "cbp_lor_002", entityId: CONSIGNEES[1].id, name: CONSIGNEES[1].name, email: "finance@eurodist.nl", country: "Netherlands", city: "Rotterdam", terms: "NET_60" as const, credit: "750000", exposure: "385200", risk: "LOW" as const, eligibility: "ELIGIBLE" as const, method: "WIRE" as const },
    { id: "cbp_lor_003", entityId: CONSIGNEES[2].id, name: CONSIGNEES[2].name, email: "billing@atlantictrade.com", country: "United States", city: "New York", terms: "NET_30" as const, credit: "300000", exposure: "98700", risk: "MEDIUM" as const, eligibility: "ELIGIBLE" as const, method: "ACH" as const },
    { id: "cbp_lor_004", entityId: CONSIGNEES[3].id, name: CONSIGNEES[3].name, email: "accounts@gulflogistics.ae", country: "UAE", city: "Dubai", terms: "NET_30" as const, credit: "400000", exposure: "215000", risk: "LOW" as const, eligibility: "ELIGIBLE" as const, method: "WIRE" as const },
    { id: "cbp_lor_005", entityId: CONSIGNEES[4].id, name: CONSIGNEES[4].name, email: "payments@londonimport.co.uk", country: "United Kingdom", city: "London", terms: "NET_60" as const, credit: "600000", exposure: "278500", risk: "LOW" as const, eligibility: "ELIGIBLE" as const, method: "WIRE" as const },
    { id: "cbp_lor_006", entityId: CONSIGNEES[5].id, name: CONSIGNEES[5].name, email: "rechnung@bavaria-supplies.de", country: "Germany", city: "Munich", terms: "NET_30" as const, credit: "350000", exposure: "189300", risk: "MEDIUM" as const, eligibility: "PENDING_REVIEW" as const, method: "WIRE" as const },
  ];

  await db.insert(customerBillingProfilesTable).values(
    customerProfiles.map((c) => ({
      id: c.id,
      companyId: LORIAN_COMPANY_ID,
      billingAccountId: BILLING_ACCOUNT_ID,
      customerName: c.name,
      customerExternalId: c.entityId,
      billingEmail: c.email,
      billingAddress: `${c.city} Business District`,
      billingCity: c.city,
      billingCountry: c.country,
      paymentTerms: c.terms,
      creditLimit: c.credit,
      currentExposure: c.exposure,
      riskStatus: c.risk,
      balanceEligibility: c.eligibility,
      preferredPaymentMethod: c.method,
      defaultCurrency: "USD",
      entityId: c.entityId,
      status: "ACTIVE" as const,
    })),
  ).onConflictDoNothing();

  const chargeRulesDefs = [
    { id: "cr_lor_001", name: "Ocean Freight - Base Rate", type: "BASE_FREIGHT" as const, method: "FLAT" as const, amount: "4500.00", auto: true, priority: 10 },
    { id: "cr_lor_002", name: "Cargo Insurance (0.35%)", type: "INSURANCE" as const, method: "PERCENTAGE" as const, amount: null, pct: 0.35, auto: true, priority: 20 },
    { id: "cr_lor_003", name: "Customs Brokerage Fee", type: "CUSTOMS_HANDLING" as const, method: "FLAT" as const, amount: "350.00", auto: true, priority: 30 },
    { id: "cr_lor_004", name: "Documentation Fee", type: "DOCUMENTATION" as const, method: "FLAT" as const, amount: "150.00", auto: true, priority: 40 },
    { id: "cr_lor_005", name: "Fuel Surcharge (BAF)", type: "FUEL_SURCHARGE" as const, method: "PER_UNIT" as const, amount: null, rate: "12.50", auto: true, priority: 50 },
    { id: "cr_lor_006", name: "Congestion Surcharge", type: "DISRUPTION_SURCHARGE" as const, method: "FLAT" as const, amount: "275.00", auto: false, priority: 60 },
    { id: "cr_lor_007", name: "Storage/Demurrage", type: "STORAGE" as const, method: "PER_UNIT" as const, amount: null, rate: "85.00", auto: false, priority: 70 },
  ];

  await db.insert(chargeRulesTable).values(
    chargeRulesDefs.map((r) => ({
      id: r.id,
      companyId: LORIAN_COMPANY_ID,
      billingAccountId: BILLING_ACCOUNT_ID,
      name: r.name,
      chargeType: r.type,
      calculationMethod: r.method,
      baseAmount: r.amount,
      ratePerUnit: (r as any).rate || null,
      percentageBasis: (r as any).pct || null,
      currency: "USD",
      autoApply: r.auto,
      priority: r.priority,
      isActive: true,
    })),
  ).onConflictDoNothing();

  const invoiceDefs = [
    { id: "inv_lor_001", num: "LOR-INV-2026-0001", status: "PAID" as const, cust: 0, shp: 7, subtotal: "18250.00", tax: "0", fee: "0", spread: "0", grand: "18250.00", terms: "NET_30" as const, source: "SHIPMENT" as const, dueAgo: 15, issuedAgo: 45, paidAgo: 12, finEligible: true, finStatus: "NONE" as const },
    { id: "inv_lor_002", num: "LOR-INV-2026-0002", status: "PAID" as const, cust: 1, shp: 6, subtotal: "12800.00", tax: "0", fee: "0", spread: "0", grand: "12800.00", terms: "NET_60" as const, source: "SHIPMENT" as const, dueAgo: 5, issuedAgo: 55, paidAgo: 8, finEligible: true, finStatus: "NONE" as const },
    { id: "inv_lor_003", num: "LOR-INV-2026-0003", status: "PAID" as const, cust: 5, shp: 17, subtotal: "32500.00", tax: "1625.00", fee: "0", spread: "0", grand: "34125.00", terms: "NET_30" as const, source: "SHIPMENT" as const, dueAgo: 20, issuedAgo: 50, paidAgo: 22, finEligible: false, finStatus: "NONE" as const },
    { id: "inv_lor_004", num: "LOR-INV-2026-0004", status: "SENT" as const, cust: 0, shp: 1, subtotal: "9750.00", tax: "0", fee: "0", spread: "0", grand: "9750.00", terms: "NET_30" as const, source: "SHIPMENT" as const, dueAgo: -12, issuedAgo: 18, paidAgo: null, finEligible: true, finStatus: "OFFERED" as const },
    { id: "inv_lor_005", num: "LOR-INV-2026-0005", status: "SENT" as const, cust: 1, shp: 2, subtotal: "21400.00", tax: "1070.00", fee: "0", spread: "0", grand: "22470.00", terms: "NET_60" as const, source: "SHIPMENT" as const, dueAgo: -30, issuedAgo: 20, paidAgo: null, finEligible: true, finStatus: "NONE" as const },
    { id: "inv_lor_006", num: "LOR-INV-2026-0006", status: "OVERDUE" as const, cust: 2, shp: 4, subtotal: "15200.00", tax: "760.00", fee: "0", spread: "0", grand: "15960.00", terms: "NET_30" as const, source: "SHIPMENT" as const, dueAgo: 8, issuedAgo: 38, paidAgo: null, finEligible: true, finStatus: "NONE" as const },
    { id: "inv_lor_007", num: "LOR-INV-2026-0007", status: "DISPUTED" as const, cust: 3, shp: 8, subtotal: "28900.00", tax: "1445.00", fee: "0", spread: "0", grand: "30345.00", terms: "NET_30" as const, source: "SHIPMENT" as const, dueAgo: 3, issuedAgo: 33, paidAgo: null, finEligible: true, finStatus: "NONE" as const },
    { id: "inv_lor_008", num: "LOR-INV-2026-0008", status: "DRAFT" as const, cust: 4, shp: 11, subtotal: "11500.00", tax: "575.00", fee: "0", spread: "0", grand: "12075.00", terms: "NET_60" as const, source: "SHIPMENT" as const, dueAgo: -45, issuedAgo: null, paidAgo: null, finEligible: false, finStatus: "NONE" as const },
    { id: "inv_lor_009", num: "LOR-INV-2026-0009", status: "PARTIALLY_PAID" as const, cust: 4, shp: 14, subtotal: "19800.00", tax: "990.00", fee: "245.00", spread: "52.00", grand: "21087.00", terms: "NET_30" as const, source: "SHIPMENT" as const, dueAgo: -2, issuedAgo: 28, paidAgo: null, finEligible: true, finStatus: "FUNDED" as const },
  ];

  for (const inv of invoiceDefs) {
    const shipNum = inv.shp;
    await db.insert(invoicesTable).values({
      id: inv.id,
      companyId: LORIAN_COMPANY_ID,
      shipmentId: lid("shp", shipNum),
      customerBillingProfileId: customerProfiles[inv.cust].id,
      invoiceNumber: inv.num,
      status: inv.status,
      billToEntityId: customerProfiles[inv.cust].entityId,
      billToName: customerProfiles[inv.cust].name,
      billToEmail: customerProfiles[inv.cust].email,
      subtotal: inv.subtotal,
      discountTotal: "0",
      taxTotal: inv.tax,
      financeFee: inv.fee,
      dynastiesSpread: inv.spread,
      grandTotal: inv.grand,
      currency: "USD",
      lineItems: [],
      paymentTerms: inv.terms,
      financeEligible: inv.finEligible,
      financeStatus: inv.finStatus,
      paymentMethod: inv.status === "PAID" ? "PAY_NOW" as const : inv.finStatus === "FUNDED" ? "FINANCED" as const : "PENDING" as const,
      dueDate: inv.dueAgo !== null ? daysAgo(inv.dueAgo) : null,
      issuedAt: inv.issuedAgo !== null ? daysAgo(inv.issuedAgo) : null,
      sentAt: ["SENT", "PAID", "OVERDUE", "DISPUTED", "PARTIALLY_PAID"].includes(inv.status) && inv.issuedAgo ? daysAgo(inv.issuedAgo - 1) : null,
      paidAt: inv.paidAgo !== null ? daysAgo(inv.paidAgo) : null,
      invoiceSource: inv.source,
    }).onConflictDoNothing();
  }

  const lineItemDefs = [
    { inv: "inv_lor_001", items: [
      { id: "ili_lor_001a", type: "FREIGHT" as const, desc: "Ocean Freight - Hamburg → Shanghai (Industrial Machinery)", qty: 1, unit: "15000.00", amt: "15000.00" },
      { id: "ili_lor_001b", type: "INSURANCE" as const, desc: "Cargo Insurance (Industrial Machinery)", qty: 1, unit: "2380.00", amt: "2380.00" },
      { id: "ili_lor_001c", type: "CUSTOMS" as const, desc: "Customs Brokerage", qty: 1, unit: "350.00", amt: "350.00" },
      { id: "ili_lor_001d", type: "FEE" as const, desc: "Documentation Fee", qty: 1, unit: "150.00", amt: "150.00" },
      { id: "ili_lor_001e", type: "SURCHARGE" as const, desc: "Fuel Surcharge (BAF)", qty: 1, unit: "370.00", amt: "370.00" },
    ]},
    { inv: "inv_lor_002", items: [
      { id: "ili_lor_002a", type: "FREIGHT" as const, desc: "Ocean Freight - Shenzhen → Rotterdam (Textile Fabrics)", qty: 1, unit: "9500.00", amt: "9500.00" },
      { id: "ili_lor_002b", type: "INSURANCE" as const, desc: "Cargo Insurance (Textiles)", qty: 1, unit: "322.00", amt: "322.00" },
      { id: "ili_lor_002c", type: "CUSTOMS" as const, desc: "EU Customs Processing", qty: 1, unit: "2628.00", amt: "2628.00" },
      { id: "ili_lor_002d", type: "FEE" as const, desc: "Documentation", qty: 1, unit: "350.00", amt: "350.00" },
    ]},
    { inv: "inv_lor_003", items: [
      { id: "ili_lor_003a", type: "FREIGHT" as const, desc: "Ocean Freight - Busan → Vancouver (Agricultural Equipment)", qty: 1, unit: "26000.00", amt: "26000.00" },
      { id: "ili_lor_003b", type: "INSURANCE" as const, desc: "Cargo Insurance (Heavy Machinery)", qty: 1, unit: "3750.00", amt: "3750.00" },
      { id: "ili_lor_003c", type: "CUSTOMS" as const, desc: "Canada Customs Brokerage", qty: 1, unit: "450.00", amt: "450.00" },
      { id: "ili_lor_003d", type: "FEE" as const, desc: "Oversize Cargo Documentation", qty: 1, unit: "250.00", amt: "250.00" },
      { id: "ili_lor_003e", type: "SURCHARGE" as const, desc: "Heavy Lift Surcharge", qty: 1, unit: "2050.00", amt: "2050.00" },
    ]},
    { inv: "inv_lor_004", items: [
      { id: "ili_lor_004a", type: "FREIGHT" as const, desc: "Ocean Freight - Shanghai → Los Angeles (Consumer Electronics)", qty: 1, unit: "7200.00", amt: "7200.00" },
      { id: "ili_lor_004b", type: "INSURANCE" as const, desc: "Cargo Insurance (Electronics)", qty: 1, unit: "997.50", amt: "997.50" },
      { id: "ili_lor_004c", type: "CUSTOMS" as const, desc: "US Customs Clearance", qty: 1, unit: "350.00", amt: "350.00" },
      { id: "ili_lor_004d", type: "FEE" as const, desc: "Documentation Fee", qty: 1, unit: "150.00", amt: "150.00" },
      { id: "ili_lor_004e", type: "SURCHARGE" as const, desc: "Peak Season Surcharge", qty: 1, unit: "1052.50", amt: "1052.50" },
    ]},
    { inv: "inv_lor_006", items: [
      { id: "ili_lor_006a", type: "FREIGHT" as const, desc: "Ocean Freight - Singapore → New York (Polymer Resins)", qty: 1, unit: "11500.00", amt: "11500.00" },
      { id: "ili_lor_006b", type: "INSURANCE" as const, desc: "Cargo Insurance (Chemicals)", qty: 1, unit: "1820.00", amt: "1820.00" },
      { id: "ili_lor_006c", type: "CUSTOMS" as const, desc: "Customs Handling", qty: 1, unit: "350.00", amt: "350.00" },
      { id: "ili_lor_006d", type: "SURCHARGE" as const, desc: "Hazmat Documentation Fee", qty: 1, unit: "1530.00", amt: "1530.00" },
    ]},
    { inv: "inv_lor_007", items: [
      { id: "ili_lor_007a", type: "FREIGHT" as const, desc: "Ocean Freight - Shanghai → Jebel Ali (Precision Lenses)", qty: 1, unit: "8200.00", amt: "8200.00" },
      { id: "ili_lor_007b", type: "INSURANCE" as const, desc: "High-Value Cargo Insurance", qty: 1, unit: "1102.50", amt: "1102.50" },
      { id: "ili_lor_007c", type: "CUSTOMS" as const, desc: "UAE Customs Clearance", qty: 1, unit: "350.00", amt: "350.00" },
      { id: "ili_lor_007d", type: "STORAGE" as const, desc: "Warehouse Storage (3 days)", qty: 3, unit: "85.00", amt: "255.00" },
      { id: "ili_lor_007e", type: "SURCHARGE" as const, desc: "Congestion Surcharge + BAF", qty: 1, unit: "18992.50", amt: "18992.50" },
    ]},
    { inv: "inv_lor_009", items: [
      { id: "ili_lor_009a", type: "FREIGHT" as const, desc: "Ocean Freight - Shanghai → Rotterdam (Solar Panels)", qty: 1, unit: "14500.00", amt: "14500.00" },
      { id: "ili_lor_009b", type: "INSURANCE" as const, desc: "Cargo Insurance (Solar Equipment)", qty: 1, unit: "1365.00", amt: "1365.00" },
      { id: "ili_lor_009c", type: "CUSTOMS" as const, desc: "EU Customs Processing", qty: 1, unit: "350.00", amt: "350.00" },
      { id: "ili_lor_009d", type: "FEE" as const, desc: "Documentation", qty: 1, unit: "150.00", amt: "150.00" },
      { id: "ili_lor_009e", type: "SURCHARGE" as const, desc: "Fuel Surcharge", qty: 1, unit: "3435.00", amt: "3435.00" },
      { id: "ili_lor_009f", type: "FINANCE_FEE" as const, desc: "Balance Finance Fee (30-day)", qty: 1, unit: "245.00", amt: "245.00" },
    ]},
  ];

  for (const group of lineItemDefs) {
    await db.insert(invoiceLineItemsTable).values(
      group.items.map((li) => ({
        id: li.id,
        invoiceId: group.inv,
        lineType: li.type,
        description: li.desc,
        quantity: li.qty,
        unitPrice: li.unit,
        amount: li.amt,
        editable: true,
      })),
    ).onConflictDoNothing();
  }

  const receivableDefs = [
    { id: "rcv_lor_001", inv: "inv_lor_001", cust: "cbp_lor_001", orig: "18250.00", out: "0", due: 15, overdue: 0, coll: "CURRENT" as const, disp: "NONE" as const, fin: "NONE" as const, settle: "SETTLED" as const },
    { id: "rcv_lor_002", inv: "inv_lor_002", cust: "cbp_lor_002", orig: "12800.00", out: "0", due: 5, overdue: 0, coll: "CURRENT" as const, disp: "NONE" as const, fin: "NONE" as const, settle: "SETTLED" as const },
    { id: "rcv_lor_003", inv: "inv_lor_003", cust: "cbp_lor_006", orig: "34125.00", out: "0", due: 20, overdue: 0, coll: "CURRENT" as const, disp: "NONE" as const, fin: "NONE" as const, settle: "SETTLED" as const },
    { id: "rcv_lor_004", inv: "inv_lor_004", cust: "cbp_lor_001", orig: "9750.00", out: "9750.00", due: -12, overdue: 0, coll: "CURRENT" as const, disp: "NONE" as const, fin: "NONE" as const, settle: "UNSETTLED" as const },
    { id: "rcv_lor_005", inv: "inv_lor_005", cust: "cbp_lor_002", orig: "22470.00", out: "22470.00", due: -30, overdue: 0, coll: "CURRENT" as const, disp: "NONE" as const, fin: "NONE" as const, settle: "UNSETTLED" as const },
    { id: "rcv_lor_006", inv: "inv_lor_006", cust: "cbp_lor_003", orig: "15960.00", out: "15960.00", due: 8, overdue: 8, coll: "FOLLOW_UP" as const, disp: "NONE" as const, fin: "NONE" as const, settle: "UNSETTLED" as const },
    { id: "rcv_lor_007", inv: "inv_lor_007", cust: "cbp_lor_004", orig: "30345.00", out: "30345.00", due: 3, overdue: 3, coll: "ESCALATED" as const, disp: "OPEN" as const, fin: "NONE" as const, settle: "UNSETTLED" as const },
    { id: "rcv_lor_009", inv: "inv_lor_009", cust: "cbp_lor_005", orig: "21087.00", out: "10543.50", due: -2, overdue: 0, coll: "CURRENT" as const, disp: "NONE" as const, fin: "FUNDED" as const, settle: "PARTIALLY_SETTLED" as const },
  ];

  await db.insert(receivablesTable).values(
    receivableDefs.map((r) => ({
      id: r.id,
      companyId: LORIAN_COMPANY_ID,
      invoiceId: r.inv,
      customerBillingProfileId: r.cust,
      originalAmount: r.orig,
      outstandingAmount: r.out,
      currency: "USD",
      dueDate: daysAgo(r.due),
      daysOverdue: r.overdue,
      collectionsStatus: r.coll,
      disputeStatus: r.disp,
      disputeReason: r.disp === "OPEN" ? "Customer disputes congestion surcharge amount on Gulf Logistics shipment" : null,
      financeStatus: r.fin,
      settlementStatus: r.settle,
      payments: r.settle === "SETTLED" ? [{ amount: r.orig, method: "ACH", date: daysAgo(r.due > 0 ? r.due - 2 : 2).toISOString(), reference: `PAY-${r.id}` }] : r.settle === "PARTIALLY_SETTLED" ? [{ amount: "10543.50", method: "WIRE", date: daysAgo(5).toISOString(), reference: `PAY-${r.id}-PARTIAL` }] : null,
    })),
  ).onConflictDoNothing();

  await db.insert(balanceFinancingRecordsTable).values([
    {
      id: "bfr_lor_001",
      companyId: LORIAN_COMPANY_ID,
      invoiceId: "inv_lor_009",
      customerBillingProfileId: "cbp_lor_005",
      applicationStatus: "FUNDED" as const,
      termDays: 30,
      financedAmount: "21087.00",
      providerFeeRate: 0.018,
      providerFeeAmount: "379.57",
      clientFacingFeeRate: 0.0255,
      clientFacingFeeAmount: "245.00",
      dynastiesSpreadAmount: "52.00",
      providerExternalRef: "BAL-SBX-20260215-001",
      providerName: "balance",
      settlementStatus: "PENDING" as const,
      requestedAt: daysAgo(28),
      decidedAt: daysAgo(27),
      fundedAt: daysAgo(26),
    },
    {
      id: "bfr_lor_002",
      companyId: LORIAN_COMPANY_ID,
      invoiceId: "inv_lor_004",
      customerBillingProfileId: "cbp_lor_001",
      applicationStatus: "APPROVED" as const,
      termDays: 30,
      financedAmount: "9750.00",
      providerFeeRate: 0.018,
      providerFeeAmount: "175.50",
      clientFacingFeeRate: 0.025,
      clientFacingFeeAmount: "243.75",
      dynastiesSpreadAmount: "68.25",
      providerExternalRef: "BAL-SBX-20260310-002",
      providerName: "balance",
      settlementStatus: "PENDING" as const,
      requestedAt: daysAgo(5),
      decidedAt: daysAgo(4),
    },
  ]).onConflictDoNothing();

  const commercialEventDefs = [
    { id: "ce_lor_001", type: "INVOICE_CREATED" as const, entity: "INVOICE" as const, entityId: "inv_lor_001", actor: "USER" as const, actorId: USERS.admin.id, amt: "18250.00", desc: "Invoice LOR-INV-2026-0001 created for shipment", ago: 45 },
    { id: "ce_lor_002", type: "INVOICE_SENT" as const, entity: "INVOICE" as const, entityId: "inv_lor_001", actor: "SYSTEM" as const, actorId: null, amt: "18250.00", desc: "Invoice sent to Pacific Coast Importers", ago: 44 },
    { id: "ce_lor_003", type: "PAYMENT_RECEIVED" as const, entity: "INVOICE" as const, entityId: "inv_lor_001", actor: "SYSTEM" as const, actorId: null, amt: "18250.00", desc: "Full payment received via ACH", ago: 12 },
    { id: "ce_lor_004", type: "INVOICE_PAID" as const, entity: "INVOICE" as const, entityId: "inv_lor_001", actor: "SYSTEM" as const, actorId: null, amt: "18250.00", desc: "Invoice marked as paid", ago: 12 },
    { id: "ce_lor_015", type: "INVOICE_CREATED" as const, entity: "INVOICE" as const, entityId: "inv_lor_002", actor: "USER" as const, actorId: USERS.admin.id, amt: "12800.00", desc: "Invoice LOR-INV-2026-0002 created for shipment", ago: 55 },
    { id: "ce_lor_016", type: "INVOICE_SENT" as const, entity: "INVOICE" as const, entityId: "inv_lor_002", actor: "SYSTEM" as const, actorId: null, amt: "12800.00", desc: "Invoice sent to Meridian Shipping GmbH", ago: 54 },
    { id: "ce_lor_017", type: "PAYMENT_RECEIVED" as const, entity: "INVOICE" as const, entityId: "inv_lor_002", actor: "SYSTEM" as const, actorId: null, amt: "12800.00", desc: "Full payment received via wire transfer", ago: 8 },
    { id: "ce_lor_018", type: "INVOICE_PAID" as const, entity: "INVOICE" as const, entityId: "inv_lor_002", actor: "SYSTEM" as const, actorId: null, amt: "12800.00", desc: "Invoice marked as paid", ago: 8 },
    { id: "ce_lor_019", type: "INVOICE_CREATED" as const, entity: "INVOICE" as const, entityId: "inv_lor_003", actor: "USER" as const, actorId: USERS.manager.id, amt: "34125.00", desc: "Invoice LOR-INV-2026-0003 created for shipment", ago: 50 },
    { id: "ce_lor_020", type: "INVOICE_SENT" as const, entity: "INVOICE" as const, entityId: "inv_lor_003", actor: "SYSTEM" as const, actorId: null, amt: "34125.00", desc: "Invoice sent to Eurasian Industrial Supply", ago: 49 },
    { id: "ce_lor_021", type: "PAYMENT_RECEIVED" as const, entity: "INVOICE" as const, entityId: "inv_lor_003", actor: "SYSTEM" as const, actorId: null, amt: "34125.00", desc: "Full payment received via ACH", ago: 22 },
    { id: "ce_lor_022", type: "INVOICE_PAID" as const, entity: "INVOICE" as const, entityId: "inv_lor_003", actor: "SYSTEM" as const, actorId: null, amt: "34125.00", desc: "Invoice marked as paid", ago: 22 },
    { id: "ce_lor_005", type: "INVOICE_CREATED" as const, entity: "INVOICE" as const, entityId: "inv_lor_006", actor: "USER" as const, actorId: USERS.manager.id, amt: "15960.00", desc: "Invoice LOR-INV-2026-0006 created", ago: 38 },
    { id: "ce_lor_006", type: "INVOICE_SENT" as const, entity: "INVOICE" as const, entityId: "inv_lor_006", actor: "SYSTEM" as const, actorId: null, amt: "15960.00", desc: "Invoice sent to Atlantic Trade Partners", ago: 37 },
    { id: "ce_lor_007", type: "INVOICE_OVERDUE" as const, entity: "INVOICE" as const, entityId: "inv_lor_006", actor: "SYSTEM" as const, actorId: null, amt: "15960.00", desc: "Invoice is now overdue (8 days past due)", ago: 0 },
    { id: "ce_lor_008", type: "INVOICE_DISPUTED" as const, entity: "INVOICE" as const, entityId: "inv_lor_007", actor: "USER" as const, actorId: null, amt: "30345.00", desc: "Customer disputes congestion surcharge", ago: 3 },
    { id: "ce_lor_009", type: "BALANCE_REQUESTED" as const, entity: "FINANCING" as const, entityId: "bfr_lor_001", actor: "USER" as const, actorId: USERS.admin.id, amt: "21087.00", desc: "Balance financing requested for INV-2026-0009", ago: 28 },
    { id: "ce_lor_010", type: "BALANCE_APPROVED" as const, entity: "FINANCING" as const, entityId: "bfr_lor_001", actor: "PROVIDER" as const, actorId: null, amt: "21087.00", desc: "Balance approved 30-day financing", ago: 27 },
    { id: "ce_lor_011", type: "BALANCE_FUNDED" as const, entity: "FINANCING" as const, entityId: "bfr_lor_001", actor: "PROVIDER" as const, actorId: null, amt: "21087.00", desc: "Funds disbursed to Lorian account", ago: 26 },
    { id: "ce_lor_012", type: "SPREAD_RECORDED" as const, entity: "FINANCING" as const, entityId: "bfr_lor_001", actor: "SYSTEM" as const, actorId: null, amt: "52.00", desc: "Dynasties spread recorded: 75bps markup", ago: 26 },
    { id: "ce_lor_013", type: "CUSTOMER_CREATED" as const, entity: "CUSTOMER" as const, entityId: "cbp_lor_001", actor: "USER" as const, actorId: USERS.admin.id, amt: null, desc: "Customer billing profile created for Pacific Coast Importers", ago: 60 },
    { id: "ce_lor_014", type: "INVOICE_PARTIALLY_PAID" as const, entity: "INVOICE" as const, entityId: "inv_lor_009", actor: "SYSTEM" as const, actorId: null, amt: "10543.50", desc: "Partial payment received ($10,543.50 of $21,087.00)", ago: 5 },
  ];

  await db.insert(commercialEventsTable).values(
    commercialEventDefs.map((e) => ({
      id: e.id,
      companyId: LORIAN_COMPANY_ID,
      eventType: e.type,
      entityType: e.entity,
      entityId: e.entityId,
      actorType: e.actor,
      actorId: e.actorId,
      amount: e.amt,
      currency: e.amt ? "USD" : null,
      description: e.desc,
      createdAt: daysAgo(e.ago),
    })),
  ).onConflictDoNothing();

  console.log(`  Billing account: ${BILLING_ACCOUNT_ID}`);
  console.log(`  Customer profiles: ${customerProfiles.length}`);
  console.log(`  Charge rules: ${chargeRulesDefs.length}`);
  console.log(`  Invoices: ${invoiceDefs.length}`);
  console.log(`  Receivables: ${receivableDefs.length}`);
  console.log(`  Financing records: 2`);
  console.log(`  Commercial events: ${commercialEventDefs.length}`);

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
