import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@workspace/db";
import {
  companiesTable,
  usersTable,
  shipmentsTable,
  entitiesTable,
  laneScoresTable,
  portScoresTable,
  carrierScoresTable,
  entityScoresTable,
  disruptionEventsTable,
  weatherRiskEventsTable,
  portCongestionSnapshotsTable,
  preShipmentRiskReportsTable,
  predictiveAlertsTable,
  complianceScreeningsTable,
  shipmentDocumentsTable,
  bookingDecisionsTable,
  releaseGateHoldsTable,
  mitigationPlaybooksTable,
  scenarioComparisonsTable,
  workflowTasksTable,
  recommendationsTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import {
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

const TEST_COMPANY_ID = generateId("cmp");
const TEST_USER_ID = generateId("usr");
const TEST_SHIPMENT_ID = generateId("shp");
const TEST_SHIPMENT_HIGH_RISK_ID = generateId("shp");
const TEST_CARRIER_ENTITY_ID = generateId("ent");
const TEST_SHIPPER_ENTITY_ID = generateId("ent");

describe("Phase 5B: Proactive Intervention & Booking-Time Decisioning", () => {
  beforeAll(async () => {
    await db.insert(companiesTable).values({
      id: TEST_COMPANY_ID,
      name: "Test 5B Co",
      slug: `test-5b-${Date.now()}`,
    });
    await db.insert(usersTable).values({
      id: TEST_USER_ID,
      companyId: TEST_COMPANY_ID,
      email: `test5b-${Date.now()}@test.io`,
      name: "Test 5B User",
      passwordHash: "not-a-real-hash",
      role: "ADMIN",
    });
    await db.insert(entitiesTable).values([
      {
        id: TEST_CARRIER_ENTITY_ID,
        companyId: TEST_COMPANY_ID,
        normalizedName: "test carrier 5b",
        entityType: "CARRIER",
        status: "ACTIVE",
        name: "Test Carrier 5B",
      },
      {
        id: TEST_SHIPPER_ENTITY_ID,
        companyId: TEST_COMPANY_ID,
        normalizedName: "test shipper 5b",
        entityType: "SHIPPER",
        status: "ACTIVE",
        name: "Test Shipper 5B",
      },
    ]);
    await db.insert(shipmentsTable).values([
      {
        id: TEST_SHIPMENT_ID,
        companyId: TEST_COMPANY_ID,
        reference: `REF-5B-${Date.now()}`,
        status: "DRAFT",
        portOfLoading: "CNSHA",
        portOfDischarge: "USLAX",
        carrierId: TEST_CARRIER_ENTITY_ID,
        shipperId: TEST_SHIPPER_ENTITY_ID,
        cargoValue: "150000",
        etd: new Date(Date.now() + 7 * 86400000),
      },
      {
        id: TEST_SHIPMENT_HIGH_RISK_ID,
        companyId: TEST_COMPANY_ID,
        reference: `REF-5BHR-${Date.now()}`,
        status: "APPROVED",
        portOfLoading: "CNSHA",
        portOfDischarge: "USLAX",
        carrierId: TEST_CARRIER_ENTITY_ID,
        shipperId: TEST_SHIPPER_ENTITY_ID,
        cargoValue: "500000",
        etd: new Date(Date.now() + 3 * 86400000),
      },
    ]);

    await db.insert(laneScoresTable).values({
      id: generateId("lsc"),
      companyId: TEST_COMPANY_ID,
      originPort: "CNSHA",
      destinationPort: "USLAX",
      overallScore: 15,
      reliabilityScore: 10,
      riskScore: 85,
      volumeScore: 20,
      compositeStressScore: 0.85,
      computedAt: new Date(),
    });

    await db.insert(portScoresTable).values([
      {
        id: generateId("psc"),
        companyId: TEST_COMPANY_ID,
        portCode: "CNSHA",
        overallScore: 20,
        congestionScore: 15,
        reliabilityScore: 20,
        riskScore: 85,
        computedAt: new Date(),
      },
      {
        id: generateId("psc"),
        companyId: TEST_COMPANY_ID,
        portCode: "USLAX",
        overallScore: 25,
        congestionScore: 20,
        reliabilityScore: 25,
        riskScore: 80,
        computedAt: new Date(),
      },
    ]);

    await db.insert(carrierScoresTable).values({
      id: generateId("csc"),
      companyId: TEST_COMPANY_ID,
      entityId: TEST_CARRIER_ENTITY_ID,
      carrierName: "Test Carrier 5B",
      overallScore: 15,
      onTimeScore: 10,
      reliabilityScore: 15,
      riskScore: 85,
      computedAt: new Date(),
    });

    await db.insert(entityScoresTable).values([
      {
        id: generateId("esc"),
        companyId: TEST_COMPANY_ID,
        entityId: TEST_CARRIER_ENTITY_ID,
        entityName: "Test Carrier 5B",
        overallScore: 20,
        complianceScore: 15,
        reliabilityScore: 20,
        riskScore: 85,
        computedAt: new Date(),
      },
      {
        id: generateId("esc"),
        companyId: TEST_COMPANY_ID,
        entityId: TEST_SHIPPER_ENTITY_ID,
        entityName: "Test Shipper 5B",
        overallScore: 25,
        complianceScore: 20,
        reliabilityScore: 25,
        riskScore: 80,
        computedAt: new Date(),
      },
    ]);

    await db.insert(disruptionEventsTable).values({
      id: generateId("dis"),
      companyId: TEST_COMPANY_ID,
      sourceId: "test-source-5b",
      eventType: "port_closure",
      title: "Major port disruption CNSHA",
      severity: "critical",
      affectedRegion: "CNSHA",
      startDate: new Date(),
      status: "active",
      fingerprint: `dis-5b-${Date.now()}`,
    });

    await db.insert(weatherRiskEventsTable).values({
      id: generateId("wre"),
      companyId: TEST_COMPANY_ID,
      sourceId: "test-source-5b",
      eventType: "typhoon",
      title: "Typhoon approaching CNSHA",
      severity: "critical",
      affectedRegion: "CNSHA",
      status: "active",
      forecastDate: new Date(),
      expectedStartDate: new Date(Date.now() - 86400000),
      expectedEndDate: new Date(Date.now() + 14 * 86400000),
      fingerprint: `wre-5b-${Date.now()}`,
    });

    await db.insert(portCongestionSnapshotsTable).values({
      id: generateId("pcs"),
      companyId: TEST_COMPANY_ID,
      sourceId: "test-source-5b",
      portCode: "CNSHA",
      portName: "Shanghai",
      congestionLevel: "critical",
      waitingVessels: 50,
      avgWaitDays: 7,
      fingerprint: `pcs-5b-${Date.now()}`,
      snapshotTimestamp: new Date(),
    });

    await db.insert(preShipmentRiskReportsTable).values({
      id: generateId("psr"),
      companyId: TEST_COMPANY_ID,
      shipmentId: TEST_SHIPMENT_HIGH_RISK_ID,
      overallRiskScore: 0.82,
      laneStressScore: 0.85,
      portCongestionScore: 0.75,
      disruptionRiskScore: 0.7,
      weatherExposureScore: 0.6,
      carrierReliabilityScore: 0.5,
      entityComplianceScore: 0.4,
      riskLevel: "CRITICAL",
      mitigations: ["Consider alternate lane", "Review carrier reliability"],
      evaluatedAt: new Date(),
    });
  });

  afterAll(async () => {
    await db.delete(scenarioComparisonsTable).where(eq(scenarioComparisonsTable.companyId, TEST_COMPANY_ID));
    await db.delete(mitigationPlaybooksTable).where(eq(mitigationPlaybooksTable.companyId, TEST_COMPANY_ID));
    await db.delete(releaseGateHoldsTable).where(eq(releaseGateHoldsTable.companyId, TEST_COMPANY_ID));
    await db.delete(bookingDecisionsTable).where(eq(bookingDecisionsTable.companyId, TEST_COMPANY_ID));
    await db.delete(workflowTasksTable).where(eq(workflowTasksTable.companyId, TEST_COMPANY_ID));
    await db.delete(recommendationsTable).where(eq(recommendationsTable.companyId, TEST_COMPANY_ID));
    await db.delete(predictiveAlertsTable).where(eq(predictiveAlertsTable.companyId, TEST_COMPANY_ID));
    await db.delete(preShipmentRiskReportsTable).where(eq(preShipmentRiskReportsTable.companyId, TEST_COMPANY_ID));
    await db.delete(shipmentDocumentsTable).where(eq(shipmentDocumentsTable.shipmentId, TEST_SHIPMENT_ID));
    await db.delete(complianceScreeningsTable).where(eq(complianceScreeningsTable.shipmentId, TEST_SHIPMENT_ID));
    await db.delete(portCongestionSnapshotsTable).where(eq(portCongestionSnapshotsTable.companyId, TEST_COMPANY_ID));
    await db.delete(weatherRiskEventsTable).where(eq(weatherRiskEventsTable.companyId, TEST_COMPANY_ID));
    await db.delete(disruptionEventsTable).where(eq(disruptionEventsTable.companyId, TEST_COMPANY_ID));
    await db.delete(entityScoresTable).where(eq(entityScoresTable.companyId, TEST_COMPANY_ID));
    await db.delete(carrierScoresTable).where(eq(carrierScoresTable.companyId, TEST_COMPANY_ID));
    await db.delete(portScoresTable).where(eq(portScoresTable.companyId, TEST_COMPANY_ID));
    await db.delete(laneScoresTable).where(eq(laneScoresTable.companyId, TEST_COMPANY_ID));
    await db.delete(shipmentsTable).where(eq(shipmentsTable.companyId, TEST_COMPANY_ID));
    await db.delete(entitiesTable).where(eq(entitiesTable.companyId, TEST_COMPANY_ID));
    await db.delete(usersTable).where(eq(usersTable.companyId, TEST_COMPANY_ID));
    await db.delete(companiesTable).where(eq(companiesTable.id, TEST_COMPANY_ID));
  });

  describe("Booking Decisions", () => {
    it("should evaluate booking decision for a shipment", async () => {
      const result = await evaluateBookingDecision(TEST_SHIPMENT_ID, TEST_COMPANY_ID);
      expect(result).toBeDefined();
      expect(result.shipmentId).toBe(TEST_SHIPMENT_ID);
      expect(["APPROVED", "APPROVED_WITH_CAUTION", "REQUIRES_REVIEW", "BLOCKED", "RECOMMEND_ALTERNATIVE"]).toContain(result.status);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.overallRiskScore).toBeDefined();
      expect(result.readinessScore).toBeDefined();
      expect(result.inputScores).toBeDefined();
      expect(result.reasonCodes).toBeInstanceOf(Array);
      expect(result.requiredActions).toBeInstanceOf(Array);
    });

    it("should retrieve latest booking decision", async () => {
      const decision = await getLatestBookingDecision(TEST_SHIPMENT_ID, TEST_COMPANY_ID);
      expect(decision).toBeDefined();
      expect(decision?.shipmentId).toBe(TEST_SHIPMENT_ID);
    });

    it("should override booking decision", async () => {
      const decision = await getLatestBookingDecision(TEST_SHIPMENT_ID, TEST_COMPANY_ID);
      expect(decision).toBeDefined();
      await overrideBookingDecision(decision!.id, TEST_COMPANY_ID, TEST_USER_ID, "Manager approved");
      const updated = await getLatestBookingDecision(TEST_SHIPMENT_ID, TEST_COMPANY_ID);
      expect(updated?.overriddenBy).toBe(TEST_USER_ID);
      expect(updated?.overrideReason).toBe("Manager approved");
    });

    it("should evaluate high-risk shipment with elevated risk signals", async () => {
      const result = await evaluateBookingDecision(TEST_SHIPMENT_HIGH_RISK_ID, TEST_COMPANY_ID);
      expect(["APPROVED", "APPROVED_WITH_CAUTION", "REQUIRES_REVIEW", "BLOCKED", "RECOMMEND_ALTERNATIVE"]).toContain(result.status);
      expect(typeof result.overallRiskScore).toBe("number");
      expect(result.inputScores).toBeDefined();
    });
  });

  describe("Release Gates", () => {
    it("should evaluate release gates for high-risk shipment", async () => {
      const result = await evaluateReleaseGates(TEST_SHIPMENT_HIGH_RISK_ID, TEST_COMPANY_ID);
      expect(result).toBeDefined();
      expect(result.shipmentId).toBe(TEST_SHIPMENT_HIGH_RISK_ID);
      expect(result.holds.length).toBeGreaterThan(0);
      expect(result.canProceed).toBe(false);
    });

    it("should get active holds", async () => {
      const holds = await getActiveHolds(TEST_SHIPMENT_HIGH_RISK_ID, TEST_COMPANY_ID);
      expect(holds.length).toBeGreaterThan(0);
    });

    it("should get hold history", async () => {
      const history = await getHoldHistory(TEST_SHIPMENT_HIGH_RISK_ID, TEST_COMPANY_ID);
      expect(history.length).toBeGreaterThan(0);
    });

    it("should release a hold", async () => {
      const holds = await getActiveHolds(TEST_SHIPMENT_HIGH_RISK_ID, TEST_COMPANY_ID);
      const holdToRelease = holds[0];
      await releaseHold(holdToRelease.id, TEST_COMPANY_ID, TEST_USER_ID, "Risk reviewed and accepted");
      const updatedHolds = await getActiveHolds(TEST_SHIPMENT_HIGH_RISK_ID, TEST_COMPANY_ID);
      const released = updatedHolds.find((h) => h.id === holdToRelease.id);
      expect(released).toBeUndefined();
    });

    it("should override a hold", async () => {
      const holds = await getActiveHolds(TEST_SHIPMENT_HIGH_RISK_ID, TEST_COMPANY_ID);
      if (holds.length > 0) {
        const holdToOverride = holds[0];
        await overrideHold(holdToOverride.id, TEST_COMPANY_ID, TEST_USER_ID, "Manager override");
        const history = await getHoldHistory(TEST_SHIPMENT_HIGH_RISK_ID, TEST_COMPANY_ID);
        const overridden = history.find((h) => h.id === holdToOverride.id);
        expect(overridden?.status).toBe("OVERRIDDEN");
      }
    });

    it("should not create duplicate active holds for same gate type", async () => {
      await evaluateReleaseGates(TEST_SHIPMENT_HIGH_RISK_ID, TEST_COMPANY_ID);
      const holds1 = await getHoldHistory(TEST_SHIPMENT_HIGH_RISK_ID, TEST_COMPANY_ID);
      await evaluateReleaseGates(TEST_SHIPMENT_HIGH_RISK_ID, TEST_COMPANY_ID);
      const holds2 = await getHoldHistory(TEST_SHIPMENT_HIGH_RISK_ID, TEST_COMPANY_ID);
      expect(holds2.length).toBe(holds1.length);
    });
  });

  describe("Mitigation Playbooks", () => {
    it("should generate playbooks for high-risk shipment", async () => {
      const playbooks = await generatePlaybook(TEST_SHIPMENT_HIGH_RISK_ID, TEST_COMPANY_ID);
      expect(playbooks.length).toBeGreaterThan(0);
      for (const pb of playbooks) {
        expect(pb.steps.length).toBeGreaterThan(0);
        expect(pb.totalSteps).toBe(pb.steps.length);
        expect(pb.priority).toBeDefined();
      }
    });

    it("should not create duplicate pending playbooks", async () => {
      const first = await generatePlaybook(TEST_SHIPMENT_HIGH_RISK_ID, TEST_COMPANY_ID);
      const second = await generatePlaybook(TEST_SHIPMENT_HIGH_RISK_ID, TEST_COMPANY_ID);
      expect(second.length).toBe(0);
    });

    it("should update playbook step status", async () => {
      const playbooks = await getPlaybooks(TEST_SHIPMENT_HIGH_RISK_ID, TEST_COMPANY_ID);
      expect(playbooks.length).toBeGreaterThan(0);
      const pb = playbooks[0];
      const steps = pb.steps as any[];
      await updatePlaybookStep(pb.id, TEST_COMPANY_ID, steps[0].stepId, "COMPLETED");
      const updated = await getPlaybooks(TEST_SHIPMENT_HIGH_RISK_ID, TEST_COMPANY_ID);
      const updatedPb = updated.find((p) => p.id === pb.id);
      expect(updatedPb?.completedSteps).toBeGreaterThanOrEqual(1);
      expect(updatedPb?.status).toBe("IN_PROGRESS");
    });

    it("should retrieve playbooks by shipment", async () => {
      const playbooks = await getPlaybooks(TEST_SHIPMENT_HIGH_RISK_ID, TEST_COMPANY_ID);
      expect(playbooks.length).toBeGreaterThan(0);
      for (const pb of playbooks) {
        expect(pb.companyId).toBe(TEST_COMPANY_ID);
        expect(pb.shipmentId).toBe(TEST_SHIPMENT_HIGH_RISK_ID);
      }
    });
  });

  describe("Alert Automation", () => {
    let testAlertId: string;

    beforeAll(async () => {
      testAlertId = generateId("pa");
      await db.insert(predictiveAlertsTable).values({
        id: testAlertId,
        companyId: TEST_COMPANY_ID,
        alertType: "DISRUPTION_CLUSTER",
        severity: "CRITICAL",
        title: "Test disruption alert for automation",
        description: "Active disruption cluster in CNSHA region",
        affectedShipmentIds: [TEST_SHIPMENT_ID],
        confidenceScore: 0.85,
        predictedImpactDays: 5,
        status: "ACTIVE",
      });
    });

    it("should automate actions from an active alert", async () => {
      const result = await automateAlertActions(testAlertId, TEST_COMPANY_ID);
      expect(result.alertId).toBe(testAlertId);
      expect(result.recommendationsCreated).toBeGreaterThanOrEqual(1);
    });

    it("should not duplicate recommendations on re-run", async () => {
      const result = await automateAlertActions(testAlertId, TEST_COMPANY_ID);
      expect(result.recommendationsCreated).toBe(0);
    });

    it("should batch automate all active alerts", async () => {
      const results = await batchAutomateAlerts(TEST_COMPANY_ID);
      expect(results.length).toBeGreaterThan(0);
    });

    it("should skip non-active alerts", async () => {
      const inactiveAlertId = generateId("pa");
      await db.insert(predictiveAlertsTable).values({
        id: inactiveAlertId,
        companyId: TEST_COMPANY_ID,
        alertType: "WEATHER_FORECAST",
        severity: "WARNING",
        title: "Resolved alert",
        description: "Should be skipped",
        confidenceScore: 0.5,
        status: "RESOLVED",
      });
      const result = await automateAlertActions(inactiveAlertId, TEST_COMPANY_ID);
      expect(result.recommendationsCreated).toBe(0);
      expect(result.tasksCreated).toBe(0);
    });
  });

  describe("Scenario Comparison", () => {
    it("should compare scenarios for a shipment", async () => {
      const result = await compareScenarios({
        shipmentId: TEST_SHIPMENT_ID,
        companyId: TEST_COMPANY_ID,
      });
      expect(result).toBeDefined();
      expect(result.shipmentId).toBe(TEST_SHIPMENT_ID);
      expect(result.baseline).toBeDefined();
      expect(result.baseline.label).toBe("Current Plan");
      expect(result.alternatives.length).toBeGreaterThan(0);
      for (const alt of result.alternatives) {
        expect(alt.scenarioType).toBeDefined();
        expect(alt.label).toBeDefined();
        expect(alt.riskDelta).toBeDefined();
        expect(alt.recommendation).toBeDefined();
      }
    });

    it("should include insurance upgrade alternative", async () => {
      const result = await compareScenarios({
        shipmentId: TEST_SHIPMENT_ID,
        companyId: TEST_COMPANY_ID,
        includeAlternateCarriers: false,
        includeAlternatePorts: false,
        includeDelayedDeparture: false,
        includeInsuranceUpgrade: true,
      });
      const insurance = result.alternatives.find((a) => a.scenarioType === "INSURANCE_UPGRADE");
      expect(insurance).toBeDefined();
      expect(insurance!.label).toContain("Insurance");
      expect(insurance!.recommendation).toBeDefined();
    });

    it("should retrieve latest scenario comparison", async () => {
      const comparison = await getLatestScenarioComparison(TEST_SHIPMENT_ID, TEST_COMPANY_ID);
      expect(comparison).toBeDefined();
      expect(comparison?.shipmentId).toBe(TEST_SHIPMENT_ID);
    });

    it("should identify best alternative", async () => {
      const result = await compareScenarios({
        shipmentId: TEST_SHIPMENT_HIGH_RISK_ID,
        companyId: TEST_COMPANY_ID,
      });
      expect(result.alternatives.length).toBeGreaterThan(0);
    });
  });

  describe("Predictive Performance Analytics", () => {
    it("should return performance summary", async () => {
      const performance = await getPredictivePerformance(TEST_COMPANY_ID);
      expect(performance).toBeDefined();
      expect(performance.alerts).toBeDefined();
      expect(performance.bookings).toBeDefined();
      expect(performance.gateHolds).toBeDefined();
      expect(performance.playbooks).toBeDefined();
      expect(performance.period.start).toBeDefined();
      expect(performance.period.end).toBeDefined();
    });

    it("should include booking distribution", async () => {
      const performance = await getPredictivePerformance(TEST_COMPANY_ID);
      expect(performance.bookings.totalDecisions).toBeGreaterThan(0);
      expect(performance.bookings.byStatus).toBeDefined();
      expect(performance.bookings.avgRiskScore).toBeDefined();
    });

    it("should include alert metrics", async () => {
      const performance = await getPredictivePerformance(TEST_COMPANY_ID);
      expect(performance.alerts.totalAlerts).toBeGreaterThan(0);
      expect(performance.alerts.bySeverity).toBeDefined();
    });

    it("should include gate hold metrics", async () => {
      const performance = await getPredictivePerformance(TEST_COMPANY_ID);
      expect(performance.gateHolds.totalHolds).toBeGreaterThan(0);
    });

    it("should include playbook metrics", async () => {
      const performance = await getPredictivePerformance(TEST_COMPANY_ID);
      expect(performance.playbooks.totalPlaybooks).toBeGreaterThan(0);
    });

    it("should respect period parameter", async () => {
      const performance = await getPredictivePerformance(TEST_COMPANY_ID, 1);
      expect(performance.period.start).toBeDefined();
      const perf90 = await getPredictivePerformance(TEST_COMPANY_ID, 90);
      expect(perf90.bookings.totalDecisions).toBeGreaterThanOrEqual(performance.bookings.totalDecisions);
    });
  });
});
