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
  evaluateBookingDecision,
  getLatestBookingDecision,
  overrideBookingDecision,
  evaluateReleaseGates,
  releaseHold,
  overrideHold,
  getActiveHolds,
  getHoldHistory,
  generatePlaybook,
  updatePlaybookStep,
  getPlaybooks,
  automateAlertActions,
  batchAutomateAlerts,
  compareScenarios,
  getLatestScenarioComparison,
  getPredictivePerformance,
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

// --- Phase 5B: Booking Decisions ---
router.post("/predictive/booking-decision/:shipmentId", async (req, res) => {
  const companyId = getCompanyId(req);
  const { shipmentId } = req.params;
  try {
    const result = await evaluateBookingDecision(shipmentId, companyId);
    res.json({ data: result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/predictive/booking-decision/:shipmentId", async (req, res) => {
  const companyId = getCompanyId(req);
  const decision = await getLatestBookingDecision(req.params.shipmentId, companyId);
  res.json({ data: decision });
});

router.patch("/predictive/booking-decision/:id/override", async (req, res) => {
  const companyId = getCompanyId(req);
  const { overriddenBy, reason } = req.body;
  if (!overriddenBy || !reason) {
    res.status(400).json({ error: "overriddenBy and reason are required" });
    return;
  }
  await overrideBookingDecision(req.params.id, companyId, overriddenBy, reason);
  res.json({ data: { success: true } });
});

// --- Phase 5B: Release Gates ---
router.post("/predictive/release-gates/:shipmentId", async (req, res) => {
  const companyId = getCompanyId(req);
  const result = await evaluateReleaseGates(req.params.shipmentId, companyId);
  res.json({ data: result });
});

router.get("/predictive/holds/:shipmentId", async (req, res) => {
  const companyId = getCompanyId(req);
  const holds = await getActiveHolds(req.params.shipmentId, companyId);
  res.json({ data: holds });
});

router.get("/predictive/holds-history/:shipmentId", async (req, res) => {
  const companyId = getCompanyId(req);
  const holds = await getHoldHistory(req.params.shipmentId, companyId);
  res.json({ data: holds });
});

router.patch("/predictive/holds/:id/release", async (req, res) => {
  const companyId = getCompanyId(req);
  const { resolvedBy, notes } = req.body;
  if (!resolvedBy || !notes) {
    res.status(400).json({ error: "resolvedBy and notes are required" });
    return;
  }
  await releaseHold(req.params.id, companyId, resolvedBy, notes);
  res.json({ data: { success: true } });
});

router.patch("/predictive/holds/:id/override", async (req, res) => {
  const companyId = getCompanyId(req);
  const { resolvedBy, notes } = req.body;
  if (!resolvedBy || !notes) {
    res.status(400).json({ error: "resolvedBy and notes are required" });
    return;
  }
  await overrideHold(req.params.id, companyId, resolvedBy, notes);
  res.json({ data: { success: true } });
});

// --- Phase 5B: Mitigation Playbooks ---
router.post("/predictive/playbooks/:shipmentId", async (req, res) => {
  const companyId = getCompanyId(req);
  const triggerSource = req.body.triggerSource || "MANUAL";
  const playbooks = await generatePlaybook(req.params.shipmentId, companyId, triggerSource);
  res.json({ data: playbooks });
});

router.get("/predictive/playbooks/:shipmentId", async (req, res) => {
  const companyId = getCompanyId(req);
  const playbooks = await getPlaybooks(req.params.shipmentId, companyId);
  res.json({ data: playbooks });
});

router.patch("/predictive/playbooks/:playbookId/steps/:stepId", async (req, res) => {
  const companyId = getCompanyId(req);
  const { playbookId, stepId } = req.params;
  const { status, linkedRecommendationId, linkedTaskId } = req.body;
  if (!status) {
    res.status(400).json({ error: "status is required" });
    return;
  }
  await updatePlaybookStep(playbookId, companyId, stepId, status, linkedRecommendationId, linkedTaskId);
  res.json({ data: { success: true } });
});

// --- Phase 5B: Alert Automation ---
router.post("/predictive/alerts/:id/automate", async (req, res) => {
  const companyId = getCompanyId(req);
  const result = await automateAlertActions(req.params.id, companyId);
  res.json({ data: result });
});

router.post("/predictive/alerts/automate-batch", async (req, res) => {
  const companyId = getCompanyId(req);
  const results = await batchAutomateAlerts(companyId);
  res.json({ data: results });
});

// --- Phase 5B: Scenario Comparison ---
router.post("/predictive/scenarios/:shipmentId", async (req, res) => {
  const companyId = getCompanyId(req);
  try {
    const result = await compareScenarios({
      shipmentId: req.params.shipmentId,
      companyId,
      includeAlternateCarriers: req.body.includeAlternateCarriers,
      includeAlternatePorts: req.body.includeAlternatePorts,
      includeDelayedDeparture: req.body.includeDelayedDeparture,
      includeInsuranceUpgrade: req.body.includeInsuranceUpgrade,
    });
    res.json({ data: result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/predictive/scenarios/:shipmentId", async (req, res) => {
  const companyId = getCompanyId(req);
  const comparison = await getLatestScenarioComparison(req.params.shipmentId, companyId);
  res.json({ data: comparison });
});

// --- Phase 5B: Predictive Performance Analytics ---
router.get("/predictive/performance", async (req, res) => {
  const companyId = getCompanyId(req);
  const periodDays = parseInt(req.query.days as string) || 30;
  const performance = await getPredictivePerformance(companyId, periodDays);
  res.json({ data: performance });
});

export default router;
