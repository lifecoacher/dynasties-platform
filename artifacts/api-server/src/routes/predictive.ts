import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  shipmentsTable,
  preShipmentRiskReportsTable,
  predictiveAlertsTable,
  historicalPatternsTable,
} from "@workspace/db/schema";
import { eq, and, desc, inArray, sql, count } from "drizzle-orm";
import { getCompanyId } from "../middlewares/tenant.js";
import {
  evaluatePreShipmentRisk,
  getLatestRiskReport,
  getRiskReportHistory,
  runPredictiveAnalysis,
  getActiveAlerts,
  acknowledgeAlert,
  computeReadinessScore,
  computeHistoricalPatterns,
  getPatterns,
  generateEarlyRecommendations,
  batchGenerateEarlyRecommendations,
} from "@workspace/svc-predictive-intelligence";

const router: IRouter = Router();

router.post("/predictive/risk-evaluation/:shipmentId", async (req, res) => {
  const companyId = getCompanyId(req);
  const { shipmentId } = req.params;

  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(and(eq(shipmentsTable.id, shipmentId), eq(shipmentsTable.companyId, companyId)))
    .limit(1);

  if (!shipment) {
    res.status(404).json({ error: "Shipment not found" });
    return;
  }

  const result = await evaluatePreShipmentRisk({
    shipmentId,
    companyId,
    portOfLoading: shipment.portOfLoading,
    portOfDischarge: shipment.portOfDischarge,
    carrierId: shipment.carrierId,
    shipperId: shipment.shipperId,
    consigneeId: shipment.consigneeId,
    etd: shipment.etd ? new Date(shipment.etd) : null,
  });

  res.json({ data: result });
});

router.get("/predictive/risk-report/:shipmentId", async (req, res) => {
  const companyId = getCompanyId(req);
  const { shipmentId } = req.params;
  const report = await getLatestRiskReport(shipmentId, companyId);
  res.json({ data: report });
});

router.get("/predictive/risk-history/:shipmentId", async (req, res) => {
  const companyId = getCompanyId(req);
  const { shipmentId } = req.params;
  const history = await getRiskReportHistory(shipmentId, companyId);
  res.json({ data: history });
});

router.post("/predictive/analyze", async (req, res) => {
  const companyId = getCompanyId(req);
  const alerts = await runPredictiveAnalysis(companyId);
  res.json({ data: { alertsGenerated: alerts.length, alerts } });
});

router.get("/predictive/alerts", async (req, res) => {
  const companyId = getCompanyId(req);
  const alerts = await getActiveAlerts(companyId);
  res.json({ data: alerts });
});

router.patch("/predictive/alerts/:id/acknowledge", async (req, res) => {
  const companyId = getCompanyId(req);
  await acknowledgeAlert(req.params.id, companyId);
  res.json({ data: { success: true } });
});

router.get("/predictive/readiness/:shipmentId", async (req, res) => {
  const companyId = getCompanyId(req);
  const { shipmentId } = req.params;
  const result = await computeReadinessScore(shipmentId, companyId);
  res.json({ data: result });
});

router.post("/predictive/patterns/compute", async (req, res) => {
  const companyId = getCompanyId(req);
  const result = await computeHistoricalPatterns(companyId);
  res.json({ data: result });
});

router.get("/predictive/patterns", async (req, res) => {
  const companyId = getCompanyId(req);
  const patternType = req.query.type as string | undefined;
  const patterns = await getPatterns(companyId, patternType);
  res.json({ data: patterns });
});

router.post("/predictive/early-recommendations/:shipmentId", async (req, res) => {
  const companyId = getCompanyId(req);
  const { shipmentId } = req.params;
  const result = await generateEarlyRecommendations(shipmentId, companyId);
  res.json({ data: result });
});

router.post("/predictive/early-recommendations-batch", async (req, res) => {
  const companyId = getCompanyId(req);
  const result = await batchGenerateEarlyRecommendations(companyId);
  res.json({ data: result });
});

router.get("/predictive/analytics", async (req, res) => {
  const companyId = getCompanyId(req);

  const [riskDistribution, alertsByType, alertsBySeverity, recentAlerts, patternSummary] = await Promise.all([
    db
      .select({
        riskLevel: preShipmentRiskReportsTable.riskLevel,
        count: count(),
      })
      .from(preShipmentRiskReportsTable)
      .where(eq(preShipmentRiskReportsTable.companyId, companyId))
      .groupBy(preShipmentRiskReportsTable.riskLevel),

    db
      .select({
        alertType: predictiveAlertsTable.alertType,
        count: count(),
      })
      .from(predictiveAlertsTable)
      .where(eq(predictiveAlertsTable.companyId, companyId))
      .groupBy(predictiveAlertsTable.alertType),

    db
      .select({
        severity: predictiveAlertsTable.severity,
        count: count(),
      })
      .from(predictiveAlertsTable)
      .where(
        and(
          eq(predictiveAlertsTable.companyId, companyId),
          eq(predictiveAlertsTable.status, "ACTIVE"),
        ),
      )
      .groupBy(predictiveAlertsTable.severity),

    db
      .select()
      .from(predictiveAlertsTable)
      .where(
        and(
          eq(predictiveAlertsTable.companyId, companyId),
          eq(predictiveAlertsTable.status, "ACTIVE"),
        ),
      )
      .orderBy(desc(predictiveAlertsTable.createdAt))
      .limit(10),

    db
      .select({
        patternType: historicalPatternsTable.patternType,
        count: count(),
        avgTrendStrength: sql`AVG(${historicalPatternsTable.trendStrength})`.as("avgTrendStrength"),
      })
      .from(historicalPatternsTable)
      .where(eq(historicalPatternsTable.companyId, companyId))
      .groupBy(historicalPatternsTable.patternType),
  ]);

  const upcomingShipments = await db
    .select({ id: shipmentsTable.id, status: shipmentsTable.status })
    .from(shipmentsTable)
    .where(
      and(
        eq(shipmentsTable.companyId, companyId),
        inArray(shipmentsTable.status, ["DRAFT", "PENDING_REVIEW", "APPROVED"]),
      ),
    );

  const evaluatedShipments = await db
    .select({ shipmentId: preShipmentRiskReportsTable.shipmentId })
    .from(preShipmentRiskReportsTable)
    .where(eq(preShipmentRiskReportsTable.companyId, companyId))
    .groupBy(preShipmentRiskReportsTable.shipmentId);

  res.json({
    data: {
      riskDistribution,
      alertsByType,
      alertsBySeverity,
      recentAlerts,
      patternSummary,
      upcomingShipments: upcomingShipments.length,
      evaluatedShipments: evaluatedShipments.length,
      evaluationCoverage:
        upcomingShipments.length > 0
          ? ((evaluatedShipments.length / upcomingShipments.length) * 100).toFixed(1)
          : "0",
    },
  });
});

export default router;
