import { db } from "@workspace/db";
import { reportSnapshotsTable } from "@workspace/db/schema";
import { generateId } from "@workspace/shared-utils";
import { eq, and, desc } from "drizzle-orm";
import { getLaneStrategies, type LaneStrategyResult } from "./lane-strategy.js";
import { getCarrierAllocations, type CarrierAllocationResult } from "./carrier-allocation.js";
import { getLatestPortfolioSnapshot, type PortfolioSnapshot } from "./portfolio-views.js";
import { getLatestAttribution, type InterventionAttribution } from "./attribution.js";
import { getNetworkRecommendations, type NetworkRecommendationResult } from "./network-optimization.js";

export type ReportType =
  | "EXECUTIVE_SUMMARY"
  | "PORTFOLIO_RISK"
  | "LANE_STRATEGY"
  | "CARRIER_ALLOCATION"
  | "VALUE_ATTRIBUTION"
  | "RECOMMENDATION_PERFORMANCE";

export interface ReportResult {
  id: string;
  reportType: ReportType;
  title: string;
  data: Record<string, unknown>;
  generatedAt: Date;
  periodStart: Date | null;
  periodEnd: Date | null;
}

export async function generateReport(
  companyId: string,
  reportType: ReportType,
  userId?: string,
  periodStart?: Date,
  periodEnd?: Date,
): Promise<ReportResult> {
  let data: Record<string, unknown>;
  let title: string;

  switch (reportType) {
    case "EXECUTIVE_SUMMARY":
      data = await buildExecutiveSummary(companyId);
      title = "Executive Summary Report";
      break;
    case "PORTFOLIO_RISK":
      data = await buildPortfolioRiskReport(companyId);
      title = "Portfolio Risk Report";
      break;
    case "LANE_STRATEGY":
      data = await buildLaneStrategyReport(companyId);
      title = "Lane Strategy Report";
      break;
    case "CARRIER_ALLOCATION":
      data = await buildCarrierAllocationReport(companyId);
      title = "Carrier Allocation Report";
      break;
    case "VALUE_ATTRIBUTION":
      data = await buildAttributionReport(companyId);
      title = "Value Attribution Report";
      break;
    case "RECOMMENDATION_PERFORMANCE":
      data = await buildRecommendationPerformanceReport(companyId);
      title = "Recommendation Performance Report";
      break;
    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }

  const id = generateId("rpt");
  const generatedAt = new Date();

  await db.insert(reportSnapshotsTable).values({
    id,
    companyId,
    reportType,
    title,
    reportData: data,
    format: "JSON",
    generatedBy: userId ?? null,
    periodStart: periodStart ?? null,
    periodEnd: periodEnd ?? null,
  });

  return { id, reportType, title, data, generatedAt, periodStart: periodStart ?? null, periodEnd: periodEnd ?? null };
}

export async function getReportHistory(
  companyId: string,
  reportType?: ReportType,
  limit = 20,
): Promise<ReportResult[]> {
  const conditions = reportType
    ? and(eq(reportSnapshotsTable.companyId, companyId), eq(reportSnapshotsTable.reportType, reportType))
    : eq(reportSnapshotsTable.companyId, companyId);

  const rows = await db
    .select()
    .from(reportSnapshotsTable)
    .where(conditions)
    .orderBy(desc(reportSnapshotsTable.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    reportType: r.reportType as ReportType,
    title: r.title,
    data: r.reportData,
    generatedAt: r.createdAt,
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
  }));
}

export function convertToCSV(data: Record<string, unknown>[], columns?: string[]): string {
  if (data.length === 0) return "";
  const keys = columns ?? Object.keys(data[0]);
  const header = keys.join(",");
  const rows = data.map((row) =>
    keys.map((k) => {
      const val = (row as any)[k];
      if (val === null || val === undefined) return "";
      const str = typeof val === "object" ? JSON.stringify(val) : String(val);
      return str.includes(",") || str.includes('"') || str.includes("\n")
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(","),
  );
  return [header, ...rows].join("\n");
}

export function formatReportForExport(
  report: ReportResult,
  format: "JSON" | "CSV",
): { content: string; contentType: string; filename: string } {
  const timestamp = new Date().toISOString().slice(0, 10);
  const base = `${report.reportType.toLowerCase()}_${timestamp}`;

  if (format === "CSV") {
    const rows = extractTabularData(report.data);
    return {
      content: convertToCSV(rows),
      contentType: "text/csv",
      filename: `${base}.csv`,
    };
  }

  return {
    content: JSON.stringify(report.data, null, 2),
    contentType: "application/json",
    filename: `${base}.json`,
  };
}

function extractTabularData(data: Record<string, unknown>): Record<string, unknown>[] {
  for (const val of Object.values(data)) {
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object") {
      return val as Record<string, unknown>[];
    }
  }
  return [data];
}

async function buildExecutiveSummary(companyId: string): Promise<Record<string, unknown>> {
  const [lanes, carriers, portfolio, attribution, recommendations] = await Promise.all([
    getLaneStrategies(companyId, 10),
    getCarrierAllocations(companyId, 10),
    getLatestPortfolioSnapshot(companyId),
    getLatestAttribution(companyId),
    getNetworkRecommendations(companyId, { status: "OPEN" }),
  ]);

  const stressedLanes = lanes.filter((l) => l.strategy !== "STABLE" && l.strategy !== "MONITOR_CLOSELY");
  const problemCarriers = carriers.filter((c) => c.allocation === "AVOID_CURRENT_CONDITIONS" || c.allocation === "REDUCE_ALLOCATION");
  const criticalRecs = recommendations.filter((r) => r.priority === "CRITICAL" || r.priority === "HIGH");

  return {
    generatedAt: new Date().toISOString(),
    networkHealth: {
      stressedLanes: stressedLanes.length,
      totalLanes: lanes.length,
      problemCarriers: problemCarriers.length,
      totalCarriers: carriers.length,
      openRecommendations: recommendations.length,
      criticalRecommendations: criticalRecs.length,
    },
    portfolio: portfolio ? {
      activeShipments: portfolio.activeShipments,
      totalShipments: portfolio.totalShipments,
      riskDistribution: portfolio.riskDistribution,
      marginAtRisk: portfolio.marginAtRisk,
      delayExposure: portfolio.delayExposure,
    } : null,
    attribution: attribution ? {
      delaysAvoided: attribution.delaysAvoided,
      marginProtected: attribution.marginProtected,
      recommendationsAccepted: attribution.recommendationsAccepted,
      recommendationsTotal: attribution.recommendationsTotal,
    } : null,
    topIssues: [
      ...stressedLanes.slice(0, 3).map((l) => ({ type: "LANE", identifier: `${l.originPort}-${l.destinationPort}`, strategy: l.strategy, stress: l.stressScore })),
      ...problemCarriers.slice(0, 3).map((c) => ({ type: "CARRIER", identifier: c.carrierName, allocation: c.allocation, reliability: c.reliabilityScore })),
      ...criticalRecs.slice(0, 3).map((r) => ({ type: "RECOMMENDATION", identifier: r.scopeIdentifier, title: r.title, priority: r.priority })),
    ],
  };
}

async function buildPortfolioRiskReport(companyId: string): Promise<Record<string, unknown>> {
  const portfolio = await getLatestPortfolioSnapshot(companyId);
  if (!portfolio) return { message: "No portfolio data available" };
  return {
    generatedAt: new Date().toISOString(),
    ...portfolio,
  };
}

async function buildLaneStrategyReport(companyId: string): Promise<Record<string, unknown>> {
  const lanes = await getLaneStrategies(companyId, 50);
  return {
    generatedAt: new Date().toISOString(),
    totalLanes: lanes.length,
    byStrategy: groupBy(lanes, "strategy"),
    lanes: lanes.map((l) => ({
      lane: `${l.originPort}-${l.destinationPort}`,
      strategy: l.strategy,
      confidence: l.confidence,
      stressScore: l.stressScore,
      delayExposure: l.delayExposure,
      shipmentCount: l.shipmentCount,
      suggestedActions: l.suggestedActions,
    })),
  };
}

async function buildCarrierAllocationReport(companyId: string): Promise<Record<string, unknown>> {
  const carriers = await getCarrierAllocations(companyId, 50);
  return {
    generatedAt: new Date().toISOString(),
    totalCarriers: carriers.length,
    byAllocation: groupBy(carriers, "allocation"),
    carriers: carriers.map((c) => ({
      carrier: c.carrierName,
      allocation: c.allocation,
      confidence: c.confidence,
      reliabilityScore: c.reliabilityScore,
      riskAdjustedScore: c.riskAdjustedScore,
      shipmentCount: c.shipmentCount,
      suggestedActions: c.suggestedActions,
    })),
  };
}

async function buildAttributionReport(companyId: string): Promise<Record<string, unknown>> {
  const attribution = await getLatestAttribution(companyId);
  if (!attribution) return { message: "No attribution data available" };
  return {
    generatedAt: new Date().toISOString(),
    ...attribution,
  };
}

async function buildRecommendationPerformanceReport(companyId: string): Promise<Record<string, unknown>> {
  const allRecs = await getNetworkRecommendations(companyId);
  const byStatus = groupBy(allRecs, "status");
  const byScope = groupBy(allRecs, "scope");
  const byPriority = groupBy(allRecs, "priority");

  return {
    generatedAt: new Date().toISOString(),
    totalRecommendations: allRecs.length,
    byStatus,
    byScope,
    byPriority,
    recommendations: allRecs.map((r) => ({
      id: r.id,
      scope: r.scope,
      type: r.type,
      priority: r.priority,
      title: r.title,
      status: r.status,
      suggestedAction: r.suggestedAction,
    })),
  };
}

function groupBy<T>(items: T[], key: keyof T): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of items) {
    const val = String(item[key]);
    result[val] = (result[val] ?? 0) + 1;
  }
  return result;
}
