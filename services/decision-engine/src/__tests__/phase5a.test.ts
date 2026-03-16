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
  historicalPatternsTable,
  tradeLaneStatsTable,
  complianceScreeningsTable,
  recommendationsTable,
} from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import {
  evaluatePreShipmentRisk,
  getLatestRiskReport,
  runPredictiveAnalysis,
  getActiveAlerts,
  acknowledgeAlert,
  computeReadinessScore,
  computeHistoricalPatterns,
  getPatterns,
  generateEarlyRecommendations,
} from "@workspace/svc-predictive-intelligence";

const TEST_COMPANY_ID = generateId("cmp");
const TEST_USER_ID = generateId("usr");
const TEST_SHIPMENT_ID = generateId("shp");
const TEST_CARRIER_ENTITY_ID = generateId("ent");
const TEST_SHIPPER_ENTITY_ID = generateId("ent");
const CLEANUP_IDS: string[] = [];

describe("Phase 5A: Predictive Intelligence & Pre-Shipment Risk", () => {
  beforeAll(async () => {
    await db.insert(companiesTable).values({
      id: TEST_COMPANY_ID,
      name: "Test Predictive Co",
      slug: `test-pred-${Date.now()}`,
    });
    await db.insert(usersTable).values({
      id: TEST_USER_ID,
      companyId: TEST_COMPANY_ID,
      name: "Predictive Test User",
      email: `pred-test-${Date.now()}@test.com`,
      passwordHash: "hash",
      role: "ADMIN",
    });

    await db.insert(entitiesTable).values([
      {
        id: TEST_CARRIER_ENTITY_ID,
        companyId: TEST_COMPANY_ID,
        name: "TestCarrier Inc",
        normalizedName: "testcarrier inc",
        entityType: "CARRIER",
        status: "VERIFIED",
      },
      {
        id: TEST_SHIPPER_ENTITY_ID,
        companyId: TEST_COMPANY_ID,
        name: "TestShipper Co",
        normalizedName: "testshipper co",
        entityType: "SHIPPER",
        status: "VERIFIED",
      },
    ]);

    await db.insert(shipmentsTable).values({
      id: TEST_SHIPMENT_ID,
      companyId: TEST_COMPANY_ID,
      reference: "PRED-TEST-001",
      status: "PENDING_REVIEW",
      portOfLoading: "CNSHA",
      portOfDischarge: "USLAX",
      carrierId: TEST_CARRIER_ENTITY_ID,
      shipperId: TEST_SHIPPER_ENTITY_ID,
      etd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      eta: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  });

  afterAll(async () => {
    for (const id of CLEANUP_IDS) {
      await db.delete(recommendationsTable).where(eq(recommendationsTable.id, id)).catch(() => {});
    }
    await db.delete(preShipmentRiskReportsTable).where(eq(preShipmentRiskReportsTable.companyId, TEST_COMPANY_ID)).catch(() => {});
    await db.delete(predictiveAlertsTable).where(eq(predictiveAlertsTable.companyId, TEST_COMPANY_ID)).catch(() => {});
    await db.delete(historicalPatternsTable).where(eq(historicalPatternsTable.companyId, TEST_COMPANY_ID)).catch(() => {});
    await db.delete(laneScoresTable).where(eq(laneScoresTable.companyId, TEST_COMPANY_ID)).catch(() => {});
    await db.delete(portScoresTable).where(eq(portScoresTable.companyId, TEST_COMPANY_ID)).catch(() => {});
    await db.delete(carrierScoresTable).where(eq(carrierScoresTable.companyId, TEST_COMPANY_ID)).catch(() => {});
    await db.delete(entityScoresTable).where(eq(entityScoresTable.companyId, TEST_COMPANY_ID)).catch(() => {});
    await db.delete(portCongestionSnapshotsTable).where(eq(portCongestionSnapshotsTable.companyId, TEST_COMPANY_ID)).catch(() => {});
    await db.delete(disruptionEventsTable).where(eq(disruptionEventsTable.companyId, TEST_COMPANY_ID)).catch(() => {});
    await db.delete(weatherRiskEventsTable).where(eq(weatherRiskEventsTable.companyId, TEST_COMPANY_ID)).catch(() => {});
    await db.delete(tradeLaneStatsTable).where(eq(tradeLaneStatsTable.companyId, TEST_COMPANY_ID)).catch(() => {});
    await db.delete(complianceScreeningsTable).where(eq(complianceScreeningsTable.shipmentId, TEST_SHIPMENT_ID)).catch(() => {});
    await db.delete(recommendationsTable).where(eq(recommendationsTable.shipmentId, TEST_SHIPMENT_ID)).catch(() => {});
    await db.delete(shipmentsTable).where(eq(shipmentsTable.id, TEST_SHIPMENT_ID)).catch(() => {});
    await db.delete(entitiesTable).where(inArray(entitiesTable.id, [TEST_CARRIER_ENTITY_ID, TEST_SHIPPER_ENTITY_ID])).catch(() => {});
    await db.delete(usersTable).where(eq(usersTable.id, TEST_USER_ID)).catch(() => {});
    await db.delete(companiesTable).where(eq(companiesTable.id, TEST_COMPANY_ID)).catch(() => {});
  });

  describe("Pre-Shipment Risk Evaluation", () => {
    it("evaluates risk for a shipment with no intelligence data", async () => {
      const result = await evaluatePreShipmentRisk({
        shipmentId: TEST_SHIPMENT_ID,
        companyId: TEST_COMPANY_ID,
        portOfLoading: "CNSHA",
        portOfDischarge: "USLAX",
        carrierId: TEST_CARRIER_ENTITY_ID,
        shipperId: TEST_SHIPPER_ENTITY_ID,
        etd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      expect(result).toBeDefined();
      expect(result.shipmentId).toBe(TEST_SHIPMENT_ID);
      expect(result.overallRiskScore).toBeGreaterThanOrEqual(0);
      expect(result.overallRiskScore).toBeLessThanOrEqual(1);
      expect(result.riskLevel).toMatch(/^(LOW|MODERATE|HIGH|CRITICAL)$/);
      expect(result.components).toBeDefined();
      expect(result.components.laneStress).toBeDefined();
      expect(result.components.portCongestion).toBeDefined();
      expect(result.components.disruptionRisk).toBeDefined();
      expect(result.components.weatherExposure).toBeDefined();
      expect(result.components.carrierReliability).toBeDefined();
      expect(result.components.entityCompliance).toBeDefined();
      expect(result.mitigations).toBeInstanceOf(Array);
      expect(result.daysUntilDeparture).toBeGreaterThanOrEqual(0);
    });

    it("persists risk report to database", async () => {
      const report = await getLatestRiskReport(TEST_SHIPMENT_ID, TEST_COMPANY_ID);
      expect(report).toBeDefined();
      expect(report!.shipmentId).toBe(TEST_SHIPMENT_ID);
      expect(report!.overallRiskScore).toBeGreaterThanOrEqual(0);
      expect(report!.riskLevel).toMatch(/^(LOW|MODERATE|HIGH|CRITICAL)$/);
      expect(report!.mitigations).toBeInstanceOf(Array);
    });

    it("scores higher risk with elevated lane scores", async () => {
      await db.insert(laneScoresTable).values({
        id: generateId("lsc"),
        companyId: TEST_COMPANY_ID,
        originPort: "CNSHA",
        destinationPort: "USLAX",
        congestionScore: 0.8,
        disruptionScore: 0.7,
        delayStressScore: 0.6,
        marketPressureScore: 0.5,
        compositeStressScore: 0.7,
      });

      const result = await evaluatePreShipmentRisk({
        shipmentId: TEST_SHIPMENT_ID,
        companyId: TEST_COMPANY_ID,
        portOfLoading: "CNSHA",
        portOfDischarge: "USLAX",
        etd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      expect(result.components.laneStress.score).toBe(0.7);
      expect(result.components.laneStress.level).toMatch(/^(HIGH|CRITICAL)$/);
      expect(result.components.laneStress.factors.length).toBeGreaterThan(0);
    });

    it("includes mitigations for high-risk components", async () => {
      await db.insert(portScoresTable).values({
        id: generateId("psc"),
        companyId: TEST_COMPANY_ID,
        portCode: "CNSHA",
        portName: "Shanghai",
        congestionSeverity: 0.8,
        weatherExposure: 0.3,
        disruptionExposure: 0.5,
        operationalVolatility: 0.4,
        compositeScore: 0.6,
      });

      const result = await evaluatePreShipmentRisk({
        shipmentId: TEST_SHIPMENT_ID,
        companyId: TEST_COMPANY_ID,
        portOfLoading: "CNSHA",
        portOfDischarge: "USLAX",
        etd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      expect(result.mitigations.length).toBeGreaterThan(0);
      expect(result.overallRiskScore).toBeGreaterThan(0.1);
    });

    it("scores 6 distinct risk components", async () => {
      const result = await evaluatePreShipmentRisk({
        shipmentId: TEST_SHIPMENT_ID,
        companyId: TEST_COMPANY_ID,
        portOfLoading: "CNSHA",
        portOfDischarge: "USLAX",
        etd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const keys = Object.keys(result.components);
      expect(keys).toHaveLength(6);
      expect(keys).toContain("laneStress");
      expect(keys).toContain("portCongestion");
      expect(keys).toContain("disruptionRisk");
      expect(keys).toContain("weatherExposure");
      expect(keys).toContain("carrierReliability");
      expect(keys).toContain("entityCompliance");
    });

    it("calculates days until departure", async () => {
      const futureEtd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      const result = await evaluatePreShipmentRisk({
        shipmentId: TEST_SHIPMENT_ID,
        companyId: TEST_COMPANY_ID,
        portOfLoading: "CNSHA",
        portOfDischarge: "USLAX",
        etd: futureEtd,
      });

      expect(result.daysUntilDeparture).toBeGreaterThanOrEqual(9);
      expect(result.daysUntilDeparture).toBeLessThanOrEqual(11);
    });
  });

  describe("Predictive Disruption Warnings", () => {
    beforeAll(async () => {
      await db.insert(portCongestionSnapshotsTable).values([
        {
          id: generateId("pcg"),
          companyId: TEST_COMPANY_ID,
          sourceId: "test-source",
          portCode: "CNSHA",
          portName: "Shanghai",
          congestionLevel: "moderate",
          waitingVessels: 10,
          avgWaitDays: 2,
          fingerprint: `fp-test-${Date.now()}-1`,
          snapshotTimestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        },
        {
          id: generateId("pcg"),
          companyId: TEST_COMPANY_ID,
          sourceId: "test-source",
          portCode: "CNSHA",
          portName: "Shanghai",
          congestionLevel: "severe",
          waitingVessels: 30,
          avgWaitDays: 5,
          fingerprint: `fp-test-${Date.now()}-2`,
          snapshotTimestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
        {
          id: generateId("pcg"),
          companyId: TEST_COMPANY_ID,
          sourceId: "test-source",
          portCode: "CNSHA",
          portName: "Shanghai",
          congestionLevel: "critical",
          waitingVessels: 45,
          avgWaitDays: 8,
          fingerprint: `fp-test-${Date.now()}-3`,
          snapshotTimestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
      ]);
    });

    it("detects congestion trend alerts", async () => {
      const alerts = await runPredictiveAnalysis(TEST_COMPANY_ID);
      expect(alerts).toBeInstanceOf(Array);
      const congestionAlerts = alerts.filter((a) => a.alertType === "CONGESTION_TREND");
      expect(congestionAlerts.length).toBeGreaterThanOrEqual(1);
      const shanghaiAlert = congestionAlerts.find((a) => a.affectedPorts?.includes("CNSHA"));
      if (shanghaiAlert) {
        expect(shanghaiAlert.severity).toMatch(/^(WARNING|CRITICAL)$/);
        expect(shanghaiAlert.confidenceScore).toBeGreaterThan(0);
        expect(shanghaiAlert.title).toContain("CNSHA");
      }
    });

    it("persists alerts to database", async () => {
      const dbAlerts = await getActiveAlerts(TEST_COMPANY_ID);
      expect(dbAlerts.length).toBeGreaterThan(0);
    });

    it("detects lane stress alerts from high lane scores", async () => {
      const alerts = await runPredictiveAnalysis(TEST_COMPANY_ID);
      const laneAlerts = alerts.filter((a) => a.alertType === "LANE_STRESS_RISING");
      expect(laneAlerts.length).toBeGreaterThanOrEqual(1);
    });

    it("detects port risk escalation alerts", async () => {
      const alerts = await runPredictiveAnalysis(TEST_COMPANY_ID);
      const portAlerts = alerts.filter((a) => a.alertType === "PORT_RISK_ESCALATION");
      expect(portAlerts.length).toBeGreaterThanOrEqual(1);
    });

    it("acknowledges an alert", async () => {
      const dbAlerts = await getActiveAlerts(TEST_COMPANY_ID);
      if (dbAlerts.length > 0) {
        await acknowledgeAlert(dbAlerts[0].id, TEST_COMPANY_ID);
        const [updated] = await db
          .select()
          .from(predictiveAlertsTable)
          .where(eq(predictiveAlertsTable.id, dbAlerts[0].id))
          .limit(1);
        expect(updated!.status).toBe("ACKNOWLEDGED");
      }
    });
  });

  describe("Shipment Readiness Scoring", () => {
    it("computes readiness score for a shipment", async () => {
      const result = await computeReadinessScore(TEST_SHIPMENT_ID, TEST_COMPANY_ID);
      expect(result).toBeDefined();
      expect(result.shipmentId).toBe(TEST_SHIPMENT_ID);
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(1);
      expect(result.readinessLevel).toMatch(/^(READY|NEEDS_ATTENTION|NOT_READY)$/);
      expect(result.components.documentation).toBeDefined();
      expect(result.components.compliance).toBeDefined();
      expect(result.components.riskExposure).toBeDefined();
      expect(result.components.operationalInfo).toBeDefined();
    });

    it("operational info scores higher when more fields are populated", async () => {
      const result = await computeReadinessScore(TEST_SHIPMENT_ID, TEST_COMPANY_ID);
      expect(result.components.operationalInfo.score).toBeGreaterThan(0);
      expect(result.components.operationalInfo.status).not.toBe("UNKNOWN");
    });

    it("returns NOT_READY for non-existent shipment", async () => {
      const result = await computeReadinessScore("nonexistent", TEST_COMPANY_ID);
      expect(result.readinessLevel).toBe("NOT_READY");
      expect(result.overallScore).toBe(0);
    });

    it("compliance scores NEEDS_ATTENTION when no screening exists", async () => {
      const result = await computeReadinessScore(TEST_SHIPMENT_ID, TEST_COMPANY_ID);
      expect(result.components.compliance.status).toBe("NEEDS_ATTENTION");
      expect(result.components.compliance.details).toContain("No compliance screening");
    });
  });

  describe("Early Recommendation Generation", () => {
    it("generates early recommendations for pre-departure shipment", async () => {
      const result = await generateEarlyRecommendations(TEST_SHIPMENT_ID, TEST_COMPANY_ID);
      expect(result).toBeDefined();
      expect(result.shipmentId).toBe(TEST_SHIPMENT_ID);
      expect(result.recommendations).toBeInstanceOf(Array);
    });

    it("generates recommendations based on elevated risk components", async () => {
      const result = await generateEarlyRecommendations(TEST_SHIPMENT_ID, TEST_COMPANY_ID);
      if (result.recommendations.length > 0) {
        const rec = result.recommendations[0];
        expect(rec.type).toBeDefined();
        expect(rec.urgency).toMatch(/^(LOW|MEDIUM|HIGH|CRITICAL)$/);
        expect(rec.confidence).toBeGreaterThan(0);
        expect(rec.title).toBeDefined();
        expect(rec.explanation).toBeDefined();
        expect(rec.recommendedAction).toBeDefined();
        expect(rec.reasonCodes).toContain("PREDICTIVE_ALERT");
      }
    });

    it("deduplicates recommendations with same fingerprint", async () => {
      const result1 = await generateEarlyRecommendations(TEST_SHIPMENT_ID, TEST_COMPANY_ID);
      const result2 = await generateEarlyRecommendations(TEST_SHIPMENT_ID, TEST_COMPANY_ID);
      expect(result2.persisted).toBeLessThanOrEqual(result1.persisted);
    });

    it("does not generate for post-departure shipments", async () => {
      const postDepartureId = generateId("shp");
      await db.insert(shipmentsTable).values({
        id: postDepartureId,
        companyId: TEST_COMPANY_ID,
        reference: "PRED-POST-001",
        status: "IN_TRANSIT",
        portOfLoading: "CNSHA",
        portOfDischarge: "USLAX",
        etd: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      });

      const result = await generateEarlyRecommendations(postDepartureId, TEST_COMPANY_ID);
      expect(result.recommendations).toHaveLength(0);

      await db.delete(shipmentsTable).where(eq(shipmentsTable.id, postDepartureId));
    });
  });

  describe("Historical Pattern Analysis", () => {
    beforeAll(async () => {
      await db.insert(tradeLaneStatsTable).values({
        id: generateId("tls"),
        companyId: TEST_COMPANY_ID,
        origin: "CNSHA",
        destination: "USLAX",
        shipmentCount: 50,
        avgTransitDays: 18,
        delayFrequency: 0.35,
      });
    });

    it("computes historical patterns", async () => {
      const result = await computeHistoricalPatterns(TEST_COMPANY_ID);
      expect(result).toBeDefined();
      expect(result.laneDelays).toBeGreaterThanOrEqual(0);
      expect(result.portDisruptions).toBeGreaterThanOrEqual(0);
      expect(result.carrierPerformance).toBeGreaterThanOrEqual(0);
      expect(result.entityCompliance).toBeGreaterThanOrEqual(0);
    });

    it("persists lane delay patterns", async () => {
      await computeHistoricalPatterns(TEST_COMPANY_ID);
      const patterns = await getPatterns(TEST_COMPANY_ID, "LANE_DELAY_AVG");
      expect(patterns.length).toBeGreaterThan(0);
      const shLa = patterns.find((p) => p.subjectKey === "CNSHA-USLAX");
      expect(shLa).toBeDefined();
      expect(shLa!.avgValue).toBeGreaterThan(0);
      expect(shLa!.trendDirection).toMatch(/^(RISING|STABLE|FALLING)$/);
    });

    it("upserts patterns on recomputation", async () => {
      await computeHistoricalPatterns(TEST_COMPANY_ID);
      const patterns1 = await getPatterns(TEST_COMPANY_ID);
      await computeHistoricalPatterns(TEST_COMPANY_ID);
      const patterns2 = await getPatterns(TEST_COMPANY_ID);
      expect(patterns2.length).toBe(patterns1.length);
    });
  });

  describe("Predictive Analytics Aggregations", () => {
    it("risk reports have required fields", async () => {
      const [report] = await db
        .select()
        .from(preShipmentRiskReportsTable)
        .where(eq(preShipmentRiskReportsTable.companyId, TEST_COMPANY_ID))
        .limit(1);

      if (report) {
        expect(report.overallRiskScore).toBeGreaterThanOrEqual(0);
        expect(report.riskLevel).toMatch(/^(LOW|MODERATE|HIGH|CRITICAL)$/);
        expect(report.laneStressScore).toBeGreaterThanOrEqual(0);
        expect(report.portCongestionScore).toBeGreaterThanOrEqual(0);
        expect(report.disruptionRiskScore).toBeGreaterThanOrEqual(0);
        expect(report.weatherExposureScore).toBeGreaterThanOrEqual(0);
        expect(report.carrierReliabilityScore).toBeGreaterThanOrEqual(0);
        expect(report.entityComplianceScore).toBeGreaterThanOrEqual(0);
        expect(report.mitigations).toBeInstanceOf(Array);
      }
    });

    it("predictive alerts have required fields", async () => {
      const alerts = await db
        .select()
        .from(predictiveAlertsTable)
        .where(eq(predictiveAlertsTable.companyId, TEST_COMPANY_ID))
        .limit(5);

      for (const alert of alerts) {
        expect(alert.alertType).toBeDefined();
        expect(alert.severity).toMatch(/^(INFO|WARNING|CRITICAL)$/);
        expect(alert.title).toBeDefined();
        expect(alert.description).toBeDefined();
        expect(alert.confidenceScore).toBeGreaterThanOrEqual(0);
        expect(alert.status).toMatch(/^(ACTIVE|ACKNOWLEDGED|RESOLVED|EXPIRED)$/);
      }
    });

    it("historical patterns have required fields", async () => {
      const patterns = await db
        .select()
        .from(historicalPatternsTable)
        .where(eq(historicalPatternsTable.companyId, TEST_COMPANY_ID))
        .limit(5);

      for (const p of patterns) {
        expect(p.patternType).toBeDefined();
        expect(p.subjectKey).toBeDefined();
        expect(p.sampleCount).toBeGreaterThanOrEqual(0);
        expect(p.avgValue).toBeGreaterThanOrEqual(0);
        expect(p.periodStart).toBeInstanceOf(Date);
        expect(p.periodEnd).toBeInstanceOf(Date);
      }
    });
  });
});
