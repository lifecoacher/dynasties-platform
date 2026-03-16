import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@workspace/db";
import {
  companiesTable,
  usersTable,
  shipmentsTable,
  entitiesTable,
  laneScoresTable,
  carrierScoresTable,
  entityScoresTable,
  portCongestionSnapshotsTable,
  tradeLaneStatsTable,
  preShipmentRiskReportsTable,
  recommendationsTable,
  workflowTasksTable,
  bookingDecisionsTable,
  releaseGateHoldsTable,
  mitigationPlaybooksTable,
  predictiveAlertsTable,
  laneStrategiesTable,
  carrierAllocationsTable,
  networkRecommendationsTable,
  portfolioSnapshotsTable,
  interventionAttributionsTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import {
  computeLaneStrategies,
  getLaneStrategies,
  computeCarrierAllocations,
  getCarrierAllocations,
  generateNetworkRecommendations,
  getNetworkRecommendations,
  acknowledgeNetworkRecommendation,
  updateNetworkRecommendationStatus,
  computePortfolioSnapshot,
  getLatestPortfolioSnapshot,
  getPortfolioHistory,
  computeAttribution,
  getLatestAttribution,
  getAttributionHistory,
} from "@workspace/svc-predictive-intelligence";

const TEST_COMPANY_ID = generateId("cmp");
const TEST_USER_ID = generateId("usr");
const TEST_SHIPMENT_1 = generateId("shp");
const TEST_SHIPMENT_2 = generateId("shp");
const TEST_ENTITY_ID = generateId("ent");

describe("Phase 6A: Strategic Intelligence & Network Optimization", () => {
  beforeAll(async () => {
    await db.insert(companiesTable).values({
      id: TEST_COMPANY_ID,
      name: "Test 6A Co",
      slug: `test-6a-${Date.now()}`,
    });

    await db.insert(usersTable).values({
      id: TEST_USER_ID,
      companyId: TEST_COMPANY_ID,
      email: `test6a-${Date.now()}@test.com`,
      passwordHash: "hash",
      name: "Test User 6A",
      role: "ADMIN",
    });

    await db.insert(entitiesTable).values({
      id: TEST_ENTITY_ID,
      companyId: TEST_COMPANY_ID,
      name: "Test Shipper 6A",
      normalizedName: "test shipper 6a",
      entityType: "SHIPPER",
      status: "VERIFIED",
    });

    await db.insert(shipmentsTable).values([
      {
        id: TEST_SHIPMENT_1,
        companyId: TEST_COMPANY_ID,
        reference: `REF-6A-${Date.now()}-1`,
        status: "IN_TRANSIT",
        portOfLoading: "CNSHA",
        portOfDischarge: "USLAX",
        carrier: "MAERSK",
        cargoValue: 50000,
      },
      {
        id: TEST_SHIPMENT_2,
        companyId: TEST_COMPANY_ID,
        reference: `REF-6A-${Date.now()}-2`,
        status: "BOOKED",
        portOfLoading: "CNSHA",
        portOfDischarge: "NLRTM",
        carrier: "MSC",
        cargoValue: 80000,
      },
    ]);

    await db.insert(laneScoresTable).values([
      {
        id: generateId("lsc"),
        companyId: TEST_COMPANY_ID,
        originPort: "CNSHA",
        destinationPort: "USLAX",
        congestionScore: 0.7,
        disruptionScore: 0.6,
        delayStressScore: 0.5,
        marketPressureScore: 0.4,
        compositeStressScore: 0.65,
        computedAt: new Date(),
      },
      {
        id: generateId("lsc"),
        companyId: TEST_COMPANY_ID,
        originPort: "CNSHA",
        destinationPort: "NLRTM",
        congestionScore: 0.3,
        disruptionScore: 0.2,
        delayStressScore: 0.1,
        marketPressureScore: 0.2,
        compositeStressScore: 0.2,
        computedAt: new Date(),
      },
    ]);

    await db.insert(carrierScoresTable).values([
      {
        id: generateId("csc"),
        companyId: TEST_COMPANY_ID,
        carrierName: "MAERSK",
        performanceScore: 85,
        anomalyScore: 10,
        reliabilityScore: 80,
        laneStressExposure: 0.3,
        compositeScore: 0.2,
      },
      {
        id: generateId("csc"),
        companyId: TEST_COMPANY_ID,
        carrierName: "MSC",
        performanceScore: 40,
        anomalyScore: 30,
        reliabilityScore: 35,
        laneStressExposure: 0.6,
        compositeScore: 0.7,
      },
    ]);

    await db.insert(entityScoresTable).values({
      id: generateId("esc"),
      companyId: TEST_COMPANY_ID,
      entityId: TEST_ENTITY_ID,
      entityName: "Test Shipper 6A",
      sanctionsRiskScore: 0.7,
      deniedPartyConfidence: 0.5,
      documentationIrregularity: 0.3,
      compositeScore: 0.65,
    });

    await db.insert(portCongestionSnapshotsTable).values({
      id: generateId("pcs"),
      companyId: TEST_COMPANY_ID,
      sourceId: "test-6a",
      portCode: "CNSHA",
      portName: "Shanghai",
      congestionLevel: "critical",
      waitingVessels: 45,
      avgWaitDays: 5.5,
      fingerprint: `pcs-6a-${Date.now()}`,
      snapshotTimestamp: new Date(),
    });

    await db.insert(tradeLaneStatsTable).values({
      id: generateId("tls"),
      companyId: TEST_COMPANY_ID,
      origin: "CNSHA",
      destination: "USLAX",
      carrier: "MAERSK",
      shipmentCount: 25,
      delayCount: 5,
      delayFrequency: 0.2,
      carrierPerformanceScore: 80,
    });

    await db.insert(preShipmentRiskReportsTable).values([
      {
        id: generateId("psr"),
        companyId: TEST_COMPANY_ID,
        shipmentId: TEST_SHIPMENT_1,
        overallRiskScore: 0.65,
        laneStressScore: 0.6,
        portCongestionScore: 0.7,
        disruptionRiskScore: 0.3,
        weatherExposureScore: 0.2,
        carrierReliabilityScore: 0.3,
        entityComplianceScore: 0.4,
        riskLevel: "HIGH",
        mitigations: [],
        componentDetails: {
          components: [
            { name: "Lane Stress", score: 0.6, weight: 0.2, level: "HIGH" },
            { name: "Port Congestion", score: 0.7, weight: 0.2, level: "HIGH" },
            { name: "Entity Compliance", score: 0.4, weight: 0.1, level: "MEDIUM" },
          ],
        },
      },
      {
        id: generateId("psr"),
        companyId: TEST_COMPANY_ID,
        shipmentId: TEST_SHIPMENT_2,
        overallRiskScore: 0.3,
        laneStressScore: 0.1,
        portCongestionScore: 0.1,
        disruptionRiskScore: 0.05,
        weatherExposureScore: 0.05,
        carrierReliabilityScore: 0.1,
        entityComplianceScore: 0.1,
        riskLevel: "LOW",
        mitigations: [],
      },
    ]);

    await db.insert(recommendationsTable).values([
      {
        id: generateId("rec"),
        companyId: TEST_COMPANY_ID,
        shipmentId: TEST_SHIPMENT_1,
        type: "CARRIER_SWITCH",
        urgency: "HIGH",
        title: "Consider switching carrier",
        explanation: "Carrier MAERSK has delays on this lane",
        reasonCodes: ["DELAY_RISK"],
        confidence: 0.8,
        recommendedAction: "Switch to alternate carrier",
        status: "ACCEPTED",
        sourceAgent: "test-agent",
        fingerprint: `rec-6a-1-${Date.now()}`,
        metadata: { enriched: true, externalReasonCodes: ["CONGESTION"] },
      },
      {
        id: generateId("rec"),
        companyId: TEST_COMPANY_ID,
        shipmentId: TEST_SHIPMENT_2,
        type: "DOCUMENT_REVIEW",
        urgency: "MEDIUM",
        title: "Review docs",
        explanation: "Missing documents detected",
        reasonCodes: ["MISSING_DOCS"],
        confidence: 0.7,
        recommendedAction: "Upload missing documents",
        status: "PENDING",
        sourceAgent: "test-agent",
        fingerprint: `rec-6a-2-${Date.now()}`,
        metadata: {},
      },
    ]);

    await db.insert(workflowTasksTable).values({
      id: generateId("wft"),
      companyId: TEST_COMPANY_ID,
      shipmentId: TEST_SHIPMENT_1,
      taskType: "CARRIER_REVIEW",
      title: "Review carrier performance",
      priority: "HIGH",
      status: "COMPLETED",
      createdBy: TEST_USER_ID,
      creationSource: "AUTO_POLICY",
    });

    await db.insert(bookingDecisionsTable).values({
      id: generateId("bkd"),
      companyId: TEST_COMPANY_ID,
      shipmentId: TEST_SHIPMENT_1,
      status: "BLOCKED",
      confidence: 0.85,
      overallRiskScore: 0.7,
      readinessScore: 0.4,
      reasonCodes: ["HIGH_RISK"],
      requiredActions: ["Review risk factors"],
      inputScores: { laneStress: 0.6, portCongestion: 0.7, disruptionRisk: 0.3, weatherExposure: 0.2, carrierReliability: 0.3, entityCompliance: 0.4 },
    });

    await db.insert(releaseGateHoldsTable).values({
      id: generateId("rgh"),
      companyId: TEST_COMPANY_ID,
      shipmentId: TEST_SHIPMENT_1,
      gateType: "RISK_THRESHOLD",
      severity: "HIGH",
      reason: "Risk too high",
      policyRule: "risk_threshold_0.7",
      requiredAction: "Manager review required",
      status: "RELEASED",
      resolvedBy: TEST_USER_ID,
      resolvedAt: new Date(),
      resolvedNotes: "Risk mitigated",
    });

    await db.insert(predictiveAlertsTable).values({
      id: generateId("pal"),
      companyId: TEST_COMPANY_ID,
      alertType: "congestion_trend",
      severity: "high",
      title: "Port congestion rising",
      description: "Shanghai congestion worsening",
      confidenceScore: 0.8,
      status: "acknowledged",
      affectedPorts: ["CNSHA"],
      predictedImpactDays: 5,
    });
  });

  afterAll(async () => {
    await db.delete(interventionAttributionsTable).where(eq(interventionAttributionsTable.companyId, TEST_COMPANY_ID));
    await db.delete(portfolioSnapshotsTable).where(eq(portfolioSnapshotsTable.companyId, TEST_COMPANY_ID));
    await db.delete(networkRecommendationsTable).where(eq(networkRecommendationsTable.companyId, TEST_COMPANY_ID));
    await db.delete(carrierAllocationsTable).where(eq(carrierAllocationsTable.companyId, TEST_COMPANY_ID));
    await db.delete(laneStrategiesTable).where(eq(laneStrategiesTable.companyId, TEST_COMPANY_ID));
    await db.delete(predictiveAlertsTable).where(eq(predictiveAlertsTable.companyId, TEST_COMPANY_ID));
    await db.delete(releaseGateHoldsTable).where(eq(releaseGateHoldsTable.companyId, TEST_COMPANY_ID));
    await db.delete(bookingDecisionsTable).where(eq(bookingDecisionsTable.companyId, TEST_COMPANY_ID));
    await db.delete(workflowTasksTable).where(eq(workflowTasksTable.companyId, TEST_COMPANY_ID));
    await db.delete(recommendationsTable).where(eq(recommendationsTable.companyId, TEST_COMPANY_ID));
    await db.delete(preShipmentRiskReportsTable).where(eq(preShipmentRiskReportsTable.companyId, TEST_COMPANY_ID));
    await db.delete(tradeLaneStatsTable).where(eq(tradeLaneStatsTable.companyId, TEST_COMPANY_ID));
    await db.delete(portCongestionSnapshotsTable).where(eq(portCongestionSnapshotsTable.companyId, TEST_COMPANY_ID));
    await db.delete(entityScoresTable).where(eq(entityScoresTable.companyId, TEST_COMPANY_ID));
    await db.delete(carrierScoresTable).where(eq(carrierScoresTable.companyId, TEST_COMPANY_ID));
    await db.delete(laneScoresTable).where(eq(laneScoresTable.companyId, TEST_COMPANY_ID));
    await db.delete(shipmentsTable).where(eq(shipmentsTable.companyId, TEST_COMPANY_ID));
    await db.delete(entitiesTable).where(eq(entitiesTable.companyId, TEST_COMPANY_ID));
    await db.delete(usersTable).where(eq(usersTable.companyId, TEST_COMPANY_ID));
    await db.delete(companiesTable).where(eq(companiesTable.id, TEST_COMPANY_ID));
  });

  describe("Lane Strategy Intelligence", () => {
    it("should compute lane strategies", async () => {
      const results = await computeLaneStrategies(TEST_COMPANY_ID);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].originPort).toBeDefined();
      expect(results[0].destinationPort).toBeDefined();
      expect(results[0].strategy).toBeDefined();
      expect(results[0].factors.length).toBeGreaterThan(0);
    });

    it("should assign different strategies based on risk", async () => {
      const results = await computeLaneStrategies(TEST_COMPANY_ID);
      const highRiskLane = results.find((r) => r.originPort === "CNSHA" && r.destinationPort === "USLAX");
      const lowRiskLane = results.find((r) => r.originPort === "CNSHA" && r.destinationPort === "NLRTM");

      expect(highRiskLane).toBeDefined();
      expect(lowRiskLane).toBeDefined();
      expect(highRiskLane!.stressScore).toBeGreaterThan(lowRiskLane!.stressScore);
    });

    it("should include suggested actions", async () => {
      const results = await computeLaneStrategies(TEST_COMPANY_ID);
      for (const r of results) {
        expect(r.suggestedActions.length).toBeGreaterThan(0);
      }
    });

    it("should persist and retrieve lane strategies", async () => {
      const retrieved = await getLaneStrategies(TEST_COMPANY_ID);
      expect(retrieved.length).toBeGreaterThan(0);
      expect(retrieved[0].factors).toBeDefined();
    });

    it("should include shipment count", async () => {
      const results = await getLaneStrategies(TEST_COMPANY_ID);
      const maerskLane = results.find((r) => r.originPort === "CNSHA" && r.destinationPort === "USLAX");
      expect(maerskLane?.shipmentCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Carrier Allocation Intelligence", () => {
    it("should compute carrier allocations", async () => {
      const results = await computeCarrierAllocations(TEST_COMPANY_ID);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].carrierName).toBeDefined();
      expect(results[0].allocation).toBeDefined();
    });

    it("should differentiate carriers by performance", async () => {
      const results = await computeCarrierAllocations(TEST_COMPANY_ID);
      const maersk = results.find((r) => r.carrierName === "MAERSK");
      const msc = results.find((r) => r.carrierName === "MSC");

      expect(maersk).toBeDefined();
      expect(msc).toBeDefined();
      expect(maersk!.reliabilityScore).toBeGreaterThan(msc!.reliabilityScore);
    });

    it("should include risk-adjusted scores", async () => {
      const results = await computeCarrierAllocations(TEST_COMPANY_ID);
      for (const r of results) {
        expect(typeof r.riskAdjustedScore).toBe("number");
        expect(r.factors.length).toBeGreaterThan(0);
      }
    });

    it("should persist and retrieve allocations", async () => {
      const retrieved = await getCarrierAllocations(TEST_COMPANY_ID);
      expect(retrieved.length).toBeGreaterThan(0);
    });

    it("should include suggested actions per carrier", async () => {
      const results = await getCarrierAllocations(TEST_COMPANY_ID);
      for (const r of results) {
        expect(r.suggestedActions.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Network Optimization Recommendations", () => {
    it("should generate network recommendations", async () => {
      const results = await generateNetworkRecommendations(TEST_COMPANY_ID);
      expect(results.length).toBeGreaterThan(0);
    });

    it("should include port traffic recommendation for critical congestion", async () => {
      const results = await getNetworkRecommendations(TEST_COMPANY_ID);
      const portRec = results.find((r) => r.scope === "PORT" && r.type === "REDUCE_PORT_TRAFFIC");
      expect(portRec).toBeDefined();
      expect(portRec?.priority).toBe("CRITICAL");
    });

    it("should include carrier shift recommendation for low reliability", async () => {
      const results = await getNetworkRecommendations(TEST_COMPANY_ID);
      const carrierRec = results.find((r) => r.scope === "CARRIER" && r.type === "SHIFT_CARRIER_VOLUME");
      expect(carrierRec).toBeDefined();
    });

    it("should include entity compliance recommendation", async () => {
      const results = await getNetworkRecommendations(TEST_COMPANY_ID);
      const entityRec = results.find((r) => r.scope === "ENTITY" && r.type === "ESCALATE_COMPLIANCE");
      expect(entityRec).toBeDefined();
    });

    it("should have evidence for each recommendation", async () => {
      const results = await getNetworkRecommendations(TEST_COMPANY_ID);
      for (const r of results) {
        expect(r.evidence.length).toBeGreaterThan(0);
        expect(r.suggestedAction).toBeDefined();
      }
    });

    it("should not duplicate open recommendations on re-run", async () => {
      const first = await generateNetworkRecommendations(TEST_COMPANY_ID);
      const second = await generateNetworkRecommendations(TEST_COMPANY_ID);
      expect(second.length).toBe(0);
    });

    it("should acknowledge a recommendation", async () => {
      const recs = await getNetworkRecommendations(TEST_COMPANY_ID, { status: "OPEN" });
      if (recs.length > 0) {
        await acknowledgeNetworkRecommendation(recs[0].id, TEST_USER_ID);
        const updated = await getNetworkRecommendations(TEST_COMPANY_ID);
        const acked = updated.find((r) => r.id === recs[0].id);
        expect(acked?.status).toBe("ACKNOWLEDGED");
      }
    });

    it("should update recommendation status", async () => {
      const recs = await getNetworkRecommendations(TEST_COMPANY_ID);
      const rec = recs.find((r) => r.status === "ACKNOWLEDGED");
      if (rec) {
        await updateNetworkRecommendationStatus(rec.id, "IMPLEMENTED");
        const updated = await getNetworkRecommendations(TEST_COMPANY_ID);
        const impl = updated.find((r) => r.id === rec.id);
        expect(impl?.status).toBe("IMPLEMENTED");
      }
    });
  });

  describe("Portfolio Risk & Margin Views", () => {
    it("should compute portfolio snapshot", async () => {
      const result = await computePortfolioSnapshot(TEST_COMPANY_ID);
      expect(result.totalShipments).toBeGreaterThan(0);
      expect(result.activeShipments).toBeGreaterThan(0);
      expect(result.riskDistribution).toBeDefined();
    });

    it("should include risk distribution", async () => {
      const result = await computePortfolioSnapshot(TEST_COMPANY_ID);
      const total = result.riskDistribution.low + result.riskDistribution.medium +
        result.riskDistribution.high + result.riskDistribution.critical;
      expect(total).toBe(result.activeShipments);
    });

    it("should include exposure breakdowns", async () => {
      const result = await computePortfolioSnapshot(TEST_COMPANY_ID);
      expect(result.exposureByLane).toBeDefined();
      expect(result.exposureByCarrier).toBeDefined();
      expect(result.exposureByPort).toBeDefined();
    });

    it("should include margin at risk", async () => {
      const result = await computePortfolioSnapshot(TEST_COMPANY_ID);
      expect(typeof result.marginAtRisk).toBe("number");
    });

    it("should retrieve latest snapshot", async () => {
      const latest = await getLatestPortfolioSnapshot(TEST_COMPANY_ID);
      expect(latest).toBeDefined();
      expect(latest?.totalShipments).toBeGreaterThan(0);
    });

    it("should return portfolio history", async () => {
      const history = await getPortfolioHistory(TEST_COMPANY_ID);
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe("Savings / Intervention Attribution", () => {
    it("should compute attribution", async () => {
      const result = await computeAttribution(TEST_COMPANY_ID, "WEEKLY");
      expect(result.id).toBeDefined();
      expect(result.period).toBe("WEEKLY");
    });

    it("should track delays avoided from booking holds", async () => {
      const result = await computeAttribution(TEST_COMPANY_ID, "MONTHLY");
      expect(result.bookingHoldsPreventedIssues).toBeGreaterThanOrEqual(0);
      expect(typeof result.delaysAvoided).toBe("number");
    });

    it("should track recommendation acceptance", async () => {
      const result = await computeAttribution(TEST_COMPANY_ID, "WEEKLY");
      expect(result.recommendationsTotal).toBeGreaterThan(0);
      expect(result.recommendationsAccepted).toBeGreaterThanOrEqual(0);
    });

    it("should track auto-created tasks", async () => {
      const result = await computeAttribution(TEST_COMPANY_ID, "MONTHLY");
      expect(result.tasksAutoCreated).toBeGreaterThanOrEqual(0);
    });

    it("should include attribution methodology details", async () => {
      const result = await computeAttribution(TEST_COMPANY_ID, "WEEKLY");
      expect(result.attributionDetails.length).toBeGreaterThan(0);
      for (const d of result.attributionDetails) {
        expect(d.category).toBeDefined();
        expect(d.methodology).toBeDefined();
      }
    });

    it("should compare intelligence-enriched vs internal impact", async () => {
      const result = await computeAttribution(TEST_COMPANY_ID, "MONTHLY");
      expect(typeof result.intelligenceEnrichedImpact).toBe("number");
      expect(typeof result.internalOnlyImpact).toBe("number");
    });

    it("should retrieve latest attribution", async () => {
      const latest = await getLatestAttribution(TEST_COMPANY_ID);
      expect(latest).toBeDefined();
      expect(latest?.attributionDetails).toBeDefined();
    });

    it("should return attribution history", async () => {
      const history = await getAttributionHistory(TEST_COMPANY_ID);
      expect(history.length).toBeGreaterThan(0);
    });
  });
});
