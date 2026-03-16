import { db } from "@workspace/db";
import {
  shipmentsTable,
  preShipmentRiskReportsTable,
  portfolioSnapshotsTable,
  bookingDecisionsTable,
} from "@workspace/db/schema";
import { generateId } from "@workspace/shared-utils";
import { eq, and, desc, sql, gte } from "drizzle-orm";

export interface PortfolioSnapshot {
  id: string;
  totalShipments: number;
  activeShipments: number;
  riskDistribution: { low: number; medium: number; high: number; critical: number };
  delayExposure: number;
  complianceExposure: number;
  marginAtRisk: number;
  mitigatedExposure: number;
  unmitigatedExposure: number;
  exposureByLane: Array<{ lane: string; exposure: number; shipmentCount: number }>;
  exposureByCarrier: Array<{ carrier: string; exposure: number; shipmentCount: number }>;
  exposureByPort: Array<{ port: string; exposure: number; shipmentCount: number }>;
  trends: { riskTrend: string; delayTrend: string; complianceTrend: string } | null;
}

export async function computePortfolioSnapshot(
  companyId: string,
  period: "DAILY" | "WEEKLY" | "MONTHLY" = "DAILY",
): Promise<PortfolioSnapshot> {
  const activeStatuses = ["BOOKED", "IN_TRANSIT", "AT_PORT", "CUSTOMS", "PENDING"];

  const allShipments = await db
    .select({
      id: shipmentsTable.id,
      status: shipmentsTable.status,
      carrier: shipmentsTable.carrier,
      portOfLoading: shipmentsTable.portOfLoading,
      portOfDischarge: shipmentsTable.portOfDischarge,
      cargoValue: shipmentsTable.cargoValue,
    })
    .from(shipmentsTable)
    .where(eq(shipmentsTable.companyId, companyId));

  const activeShipments = allShipments.filter((s) =>
    activeStatuses.includes(s.status ?? ""),
  );

  const shipmentIds = activeShipments.map((s) => s.id);

  const riskReports = shipmentIds.length > 0
    ? await db
        .select()
        .from(preShipmentRiskReportsTable)
        .where(eq(preShipmentRiskReportsTable.companyId, companyId))
        .orderBy(desc(preShipmentRiskReportsTable.createdAt))
    : [];

  const latestRiskByShipment = new Map<string, typeof riskReports[0]>();
  for (const r of riskReports) {
    if (!latestRiskByShipment.has(r.shipmentId)) {
      latestRiskByShipment.set(r.shipmentId, r);
    }
  }

  const riskDist = { low: 0, medium: 0, high: 0, critical: 0 };
  let totalDelayExposure = 0;
  let totalComplianceExposure = 0;
  let totalMarginAtRisk = 0;

  for (const ship of activeShipments) {
    const risk = latestRiskByShipment.get(ship.id);
    const riskScore = risk?.overallRiskScore ?? 0;
    const riskLevel = risk?.riskLevel ?? "LOW";

    if (riskLevel === "LOW") riskDist.low++;
    else if (riskLevel === "MODERATE") riskDist.medium++;
    else if (riskLevel === "HIGH") riskDist.high++;
    else riskDist.critical++;

    const laneStress = risk?.laneStressScore ?? 0;
    const portCongestion = risk?.portCongestionScore ?? 0;
    totalDelayExposure += Math.max(laneStress, portCongestion);

    totalComplianceExposure += risk?.entityComplianceScore ?? 0;

    const cargoVal = ship.cargoValue ?? 0;
    totalMarginAtRisk += cargoVal * Math.max(riskScore, 0) * 0.05;
  }

  const bookingDecisions = await db
    .select()
    .from(bookingDecisionsTable)
    .where(
      and(
        eq(bookingDecisionsTable.companyId, companyId),
        gte(bookingDecisionsTable.createdAt, new Date(Date.now() - 30 * 86400000)),
      ),
    );

  const mitigatedCount = bookingDecisions.filter(
    (b) => b.status === "APPROVED_WITH_CAUTION" || b.status === "REQUIRES_REVIEW" || b.status === "BLOCKED",
  ).length;
  const mitigatedRatio = Math.min(mitigatedCount * 0.1, 1);
  const mitigatedExposureAmt = mitigatedRatio * totalMarginAtRisk;
  const unmitigatedExposure = Math.max(0, totalMarginAtRisk - mitigatedExposureAmt);

  const laneExposureMap = new Map<string, { exposure: number; count: number }>();
  const carrierExposureMap = new Map<string, { exposure: number; count: number }>();
  const portExposureMap = new Map<string, { exposure: number; count: number }>();

  for (const ship of activeShipments) {
    const risk = latestRiskByShipment.get(ship.id);
    const riskScore = risk?.overallRiskScore ?? 0;
    const exposure = Math.max(riskScore, 0);

    if (ship.portOfLoading && ship.portOfDischarge) {
      const lane = `${ship.portOfLoading}-${ship.portOfDischarge}`;
      const laneEntry = laneExposureMap.get(lane) ?? { exposure: 0, count: 0 };
      laneEntry.exposure += exposure;
      laneEntry.count++;
      laneExposureMap.set(lane, laneEntry);
    }

    if (ship.carrier) {
      const carrierEntry = carrierExposureMap.get(ship.carrier) ?? { exposure: 0, count: 0 };
      carrierEntry.exposure += exposure;
      carrierEntry.count++;
      carrierExposureMap.set(ship.carrier, carrierEntry);
    }

    for (const port of [ship.portOfLoading, ship.portOfDischarge].filter(Boolean)) {
      const portEntry = portExposureMap.get(port!) ?? { exposure: 0, count: 0 };
      portEntry.exposure += exposure;
      portEntry.count++;
      portExposureMap.set(port!, portEntry);
    }
  }

  const exposureByLane = [...laneExposureMap.entries()]
    .map(([lane, v]) => ({ lane, exposure: v.exposure, shipmentCount: v.count }))
    .sort((a, b) => b.exposure - a.exposure)
    .slice(0, 20);

  const exposureByCarrier = [...carrierExposureMap.entries()]
    .map(([carrier, v]) => ({ carrier, exposure: v.exposure, shipmentCount: v.count }))
    .sort((a, b) => b.exposure - a.exposure)
    .slice(0, 20);

  const exposureByPort = [...portExposureMap.entries()]
    .map(([port, v]) => ({ port, exposure: v.exposure, shipmentCount: v.count }))
    .sort((a, b) => b.exposure - a.exposure)
    .slice(0, 20);

  const trends = await computeTrends(companyId);

  const id = generateId("psn");
  const snapshot: PortfolioSnapshot = {
    id,
    totalShipments: allShipments.length,
    activeShipments: activeShipments.length,
    riskDistribution: riskDist,
    delayExposure: totalDelayExposure,
    complianceExposure: totalComplianceExposure,
    marginAtRisk: totalMarginAtRisk,
    mitigatedExposure: mitigatedExposureAmt,
    unmitigatedExposure,
    exposureByLane,
    exposureByCarrier,
    exposureByPort,
    trends,
  };

  await db.insert(portfolioSnapshotsTable).values({
    id,
    companyId,
    period,
    totalShipments: snapshot.totalShipments,
    activeShipments: snapshot.activeShipments,
    riskDistribution: snapshot.riskDistribution,
    delayExposure: snapshot.delayExposure,
    complianceExposure: snapshot.complianceExposure,
    marginAtRisk: snapshot.marginAtRisk,
    mitigatedExposure: snapshot.mitigatedExposure,
    unmitigatedExposure: snapshot.unmitigatedExposure,
    exposureByLane: snapshot.exposureByLane,
    exposureByCarrier: snapshot.exposureByCarrier,
    exposureByPort: snapshot.exposureByPort,
    trends: snapshot.trends as any,
    snapshotAt: new Date(),
  });

  return snapshot;
}

export async function getLatestPortfolioSnapshot(
  companyId: string,
): Promise<PortfolioSnapshot | null> {
  const rows = await db
    .select()
    .from(portfolioSnapshotsTable)
    .where(eq(portfolioSnapshotsTable.companyId, companyId))
    .orderBy(desc(portfolioSnapshotsTable.snapshotAt))
    .limit(1);

  if (rows.length === 0) return null;

  const r = rows[0];
  return {
    id: r.id,
    totalShipments: r.totalShipments,
    activeShipments: r.activeShipments,
    riskDistribution: r.riskDistribution as any,
    delayExposure: r.delayExposure,
    complianceExposure: r.complianceExposure,
    marginAtRisk: r.marginAtRisk,
    mitigatedExposure: r.mitigatedExposure,
    unmitigatedExposure: r.unmitigatedExposure,
    exposureByLane: r.exposureByLane as any ?? [],
    exposureByCarrier: r.exposureByCarrier as any ?? [],
    exposureByPort: r.exposureByPort as any ?? [],
    trends: r.trends as any,
  };
}

export async function getPortfolioHistory(
  companyId: string,
  limit = 30,
): Promise<PortfolioSnapshot[]> {
  const rows = await db
    .select()
    .from(portfolioSnapshotsTable)
    .where(eq(portfolioSnapshotsTable.companyId, companyId))
    .orderBy(desc(portfolioSnapshotsTable.snapshotAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    totalShipments: r.totalShipments,
    activeShipments: r.activeShipments,
    riskDistribution: r.riskDistribution as any,
    delayExposure: r.delayExposure,
    complianceExposure: r.complianceExposure,
    marginAtRisk: r.marginAtRisk,
    mitigatedExposure: r.mitigatedExposure,
    unmitigatedExposure: r.unmitigatedExposure,
    exposureByLane: r.exposureByLane as any ?? [],
    exposureByCarrier: r.exposureByCarrier as any ?? [],
    exposureByPort: r.exposureByPort as any ?? [],
    trends: r.trends as any,
  }));
}

async function computeTrends(companyId: string) {
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000);
  const fourWeeksAgo = new Date(Date.now() - 28 * 86400000);

  const recentSnapshots = await db
    .select()
    .from(portfolioSnapshotsTable)
    .where(
      and(
        eq(portfolioSnapshotsTable.companyId, companyId),
        gte(portfolioSnapshotsTable.snapshotAt, fourWeeksAgo),
      ),
    )
    .orderBy(desc(portfolioSnapshotsTable.snapshotAt));

  if (recentSnapshots.length < 2) return null;

  const recent = recentSnapshots.filter((s) => s.snapshotAt >= twoWeeksAgo);
  const older = recentSnapshots.filter((s) => s.snapshotAt < twoWeeksAgo);

  if (recent.length === 0 || older.length === 0) return null;

  const avgRecent = (field: keyof typeof recent[0]) =>
    recent.reduce((sum, s) => sum + (Number(s[field]) || 0), 0) / recent.length;
  const avgOlder = (field: keyof typeof older[0]) =>
    older.reduce((sum, s) => sum + (Number(s[field]) || 0), 0) / older.length;

  const trend = (recent: number, older: number) => {
    const delta = recent - older;
    if (Math.abs(delta) < 0.05 * Math.max(Math.abs(older), 1)) return "stable" as const;
    return delta < 0 ? "improving" as const : "worsening" as const;
  };

  return {
    riskTrend: trend(avgRecent("marginAtRisk"), avgOlder("marginAtRisk")),
    delayTrend: trend(avgRecent("delayExposure"), avgOlder("delayExposure")),
    complianceTrend: trend(avgRecent("complianceExposure"), avgOlder("complianceExposure")),
  };
}
