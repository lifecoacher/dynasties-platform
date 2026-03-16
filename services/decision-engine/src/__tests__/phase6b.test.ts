import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@workspace/db";
import {
  companiesTable,
  usersTable,
  shipmentsTable,
  tenantPoliciesTable,
  policyVersionsTable,
  operatingModesTable,
  reportSnapshotsTable,
  policySimulationsTable,
  preShipmentRiskReportsTable,
  laneScoresTable,
  carrierScoresTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import {
  getTenantPolicies,
  getEffectivePolicy,
  getAllEffectivePolicies,
  upsertPolicy,
  togglePolicy,
  getPolicyHistory,
  resetPolicyToDefault,
  getGlobalDefaults,
  getDefaultValue,
  runPolicySimulation,
  getSimulationHistory,
  getActiveMode,
  getAvailableModes,
  activateMode,
  deactivateMode,
  getModePresets,
  generateReport,
  getReportHistory,
  convertToCSV,
  formatReportForExport,
} from "@workspace/svc-predictive-intelligence";

const TEST_COMPANY_ID = generateId("cmp");
const TEST_USER_ID = generateId("usr");
const TEST_SHIPMENT_1 = generateId("shp");
const TEST_SHIPMENT_2 = generateId("shp");

describe("Phase 6B: Policy Optimization & Productization", () => {
  beforeAll(async () => {
    await db.insert(companiesTable).values({
      id: TEST_COMPANY_ID,
      name: "Test 6B Co",
      slug: `test-6b-${Date.now()}`,
    });

    await db.insert(usersTable).values({
      id: TEST_USER_ID,
      companyId: TEST_COMPANY_ID,
      email: `test6b-${Date.now()}@test.com`,
      passwordHash: "hash",
      name: "Test User 6B",
      role: "ADMIN",
    });

    await db.insert(shipmentsTable).values([
      {
        id: TEST_SHIPMENT_1,
        companyId: TEST_COMPANY_ID,
        reference: `REF-6B-${Date.now()}-1`,
        status: "IN_TRANSIT",
        portOfLoading: "CNSHA",
        portOfDischarge: "USLAX",
        carrier: "MAERSK",
        cargoValue: 50000,
      },
      {
        id: TEST_SHIPMENT_2,
        companyId: TEST_COMPANY_ID,
        reference: `REF-6B-${Date.now()}-2`,
        status: "BOOKED",
        portOfLoading: "DEHAM",
        portOfDischarge: "NLRTM",
        carrier: "MSC",
        cargoValue: 80000,
      },
    ]);

    await db.insert(preShipmentRiskReportsTable).values([
      {
        id: generateId("rsk"),
        shipmentId: TEST_SHIPMENT_1,
        companyId: TEST_COMPANY_ID,
        overallRiskScore: 0.72,
        riskLevel: "HIGH",
        laneStressScore: 0.6,
        portCongestionScore: 0.5,
        weatherExposureScore: 0.3,
        carrierReliabilityScore: 0.8,
        disruptionRiskScore: 0.4,
        entityComplianceScore: 0.2,
        mitigations: [],
        componentDetails: {},
      },
      {
        id: generateId("rsk"),
        shipmentId: TEST_SHIPMENT_2,
        companyId: TEST_COMPANY_ID,
        overallRiskScore: 0.35,
        riskLevel: "MODERATE",
        laneStressScore: 0.2,
        portCongestionScore: 0.3,
        weatherExposureScore: 0.1,
        carrierReliabilityScore: 0.4,
        disruptionRiskScore: 0.2,
        entityComplianceScore: 0.1,
        mitigations: [],
        componentDetails: {},
      },
    ]);

    await db.insert(laneScoresTable).values({
      id: generateId("ls"),
      companyId: TEST_COMPANY_ID,
      originPort: "CNSHA",
      destinationPort: "USLAX",
      compositeStressScore: 0.65,
      volumeScore: 0.5,
      delayScore: 0.6,
      costVolatilityScore: 0.4,
      congestionImpact: 0.5,
      sampleSize: 10,
      periodStart: new Date(Date.now() - 30 * 86400000),
      periodEnd: new Date(),
    });

    await db.insert(carrierScoresTable).values({
      id: generateId("cs"),
      companyId: TEST_COMPANY_ID,
      carrierName: "MAERSK",
      compositeScore: 0.7,
      onTimeRate: 0.85,
      avgDelayDays: 2,
      bookingAccuracy: 0.9,
      documentAccuracy: 0.95,
      disputeRate: 0.05,
      claimRate: 0.02,
      sampleSize: 20,
      periodStart: new Date(Date.now() - 30 * 86400000),
      periodEnd: new Date(),
    });
  });

  afterAll(async () => {
    await db.delete(policySimulationsTable).where(eq(policySimulationsTable.companyId, TEST_COMPANY_ID));
    await db.delete(reportSnapshotsTable).where(eq(reportSnapshotsTable.companyId, TEST_COMPANY_ID));
    await db.delete(operatingModesTable).where(eq(operatingModesTable.companyId, TEST_COMPANY_ID));
    await db.delete(policyVersionsTable);
    await db.delete(tenantPoliciesTable).where(eq(tenantPoliciesTable.companyId, TEST_COMPANY_ID));
    await db.delete(preShipmentRiskReportsTable).where(eq(preShipmentRiskReportsTable.companyId, TEST_COMPANY_ID));
    await db.delete(laneScoresTable).where(eq(laneScoresTable.companyId, TEST_COMPANY_ID));
    await db.delete(carrierScoresTable).where(eq(carrierScoresTable.companyId, TEST_COMPANY_ID));
    await db.delete(shipmentsTable).where(eq(shipmentsTable.companyId, TEST_COMPANY_ID));
    await db.delete(usersTable).where(eq(usersTable.companyId, TEST_COMPANY_ID));
    await db.delete(companiesTable).where(eq(companiesTable.id, TEST_COMPANY_ID));
  });

  describe("Policy Engine", () => {
    it("should return global defaults", () => {
      const defaults = getGlobalDefaults();
      expect(Object.keys(defaults).length).toBeGreaterThanOrEqual(10);
      expect(defaults).toHaveProperty("recommendation.confidence_threshold");
      expect(defaults).toHaveProperty("booking.gate_thresholds");
      expect(defaults).toHaveProperty("risk.tolerances");
      expect(defaults).toHaveProperty("intelligence.weighting");
    });

    it("should return default value for known key", () => {
      const val = getDefaultValue("booking.gate_thresholds");
      expect(val).toBeDefined();
      expect(val).toHaveProperty("blockThreshold");
    });

    it("should return null for unknown default key", () => {
      const val = getDefaultValue("nonexistent.key");
      expect(val).toBeNull();
    });

    it("should get effective policy falling back to default", async () => {
      const val = await getEffectivePolicy(TEST_COMPANY_ID, "booking.gate_thresholds");
      expect(val).toHaveProperty("blockThreshold");
    });

    it("should get all effective policies merging defaults and overrides", async () => {
      const all = await getAllEffectivePolicies(TEST_COMPANY_ID);
      expect(Object.keys(all).length).toBeGreaterThanOrEqual(10);
      const booking = all["booking.gate_thresholds"];
      expect(booking).toBeDefined();
      expect(booking.source).toBe("default");
    });

    it("should upsert a tenant policy override", async () => {
      const result = await upsertPolicy(
        TEST_COMPANY_ID,
        "booking.gate_thresholds",
        { blockThreshold: 0.9, requireReviewThreshold: 0.6 },
        TEST_USER_ID,
        "Lowering block threshold",
      );
      expect(result.policyKey).toBe("booking.gate_thresholds");
      expect(result.version).toBe(1);
    });

    it("should increment version on re-upsert", async () => {
      const result = await upsertPolicy(
        TEST_COMPANY_ID,
        "booking.gate_thresholds",
        { blockThreshold: 0.95 },
        TEST_USER_ID,
        "Adjusting again",
      );
      expect(result.version).toBe(2);
    });

    it("should return tenant override as effective", async () => {
      const all = await getAllEffectivePolicies(TEST_COMPANY_ID);
      const booking = all["booking.gate_thresholds"];
      expect(booking.source).toBe("tenant");
      expect((booking.value as any).blockThreshold).toBe(0.95);
    });

    it("should list tenant policies", async () => {
      const policies = await getTenantPolicies(TEST_COMPANY_ID);
      expect(policies.length).toBeGreaterThanOrEqual(1);
      const booking = policies.find((p) => p.policyKey === "booking.gate_thresholds");
      expect(booking).toBeDefined();
    });

    it("should toggle policy active state", async () => {
      const policies = await getTenantPolicies(TEST_COMPANY_ID);
      const policy = policies[0];
      await togglePolicy(TEST_COMPANY_ID, policy.id, false, TEST_USER_ID);
      const updated = await getTenantPolicies(TEST_COMPANY_ID);
      const toggled = updated.find((p) => p.id === policy.id);
      expect(toggled?.isActive).toBe(false);
      await togglePolicy(TEST_COMPANY_ID, policy.id, true, TEST_USER_ID);
    });

    it("should get policy history", async () => {
      const history = await getPolicyHistory(TEST_COMPANY_ID, "booking.gate_thresholds");
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[0].version).toBeGreaterThanOrEqual(1);
    });

    it("should reset policy to default", async () => {
      await upsertPolicy(TEST_COMPANY_ID, "risk.tolerances", { maxAcceptableRiskScore: 0.5 }, TEST_USER_ID, "custom");
      const result = await resetPolicyToDefault(TEST_COMPANY_ID, "risk.tolerances", TEST_USER_ID);
      expect(result).toBeDefined();
      const effective = await getEffectivePolicy(TEST_COMPANY_ID, "risk.tolerances");
      const def = getDefaultValue("risk.tolerances") as any;
      expect((effective as any).maxAcceptableRiskScore).toBe(def.maxAcceptableRiskScore);
    });
  });

  describe("Policy Simulation", () => {
    it("should run a what-if simulation", async () => {
      const result = await runPolicySimulation(TEST_COMPANY_ID, TEST_USER_ID, {
        simulationName: "Test Stricter Gates",
        policyChanges: {
          "booking.gate_thresholds": { blockThreshold: 0.6, requireReviewThreshold: 0.4 },
        },
      });
      expect(result.id).toBeTruthy();
      expect(result.simulationName).toBe("Test Stricter Gates");
      expect(result.baseline).toBeDefined();
      expect(result.simulated).toBeDefined();
      expect(result.impactAnalysis).toBeDefined();
      expect(result.impactAnalysis.summary.length).toBeGreaterThanOrEqual(1);
    });

    it("should persist simulation to DB", async () => {
      const [row] = await db
        .select()
        .from(policySimulationsTable)
        .where(eq(policySimulationsTable.companyId, TEST_COMPANY_ID))
        .limit(1);
      expect(row).toBeDefined();
      expect(row.simulationName).toBe("Test Stricter Gates");
    });

    it("should retrieve simulation history", async () => {
      const history = await getSimulationHistory(TEST_COMPANY_ID);
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0].impactAnalysis).toBeDefined();
    });

    it("should produce different metrics for different thresholds", async () => {
      const strict = await runPolicySimulation(TEST_COMPANY_ID, TEST_USER_ID, {
        simulationName: "Very Strict",
        policyChanges: {
          "booking.gate_thresholds": { blockThreshold: 0.3 },
        },
      });
      const lenient = await runPolicySimulation(TEST_COMPANY_ID, TEST_USER_ID, {
        simulationName: "Very Lenient",
        policyChanges: {
          "booking.gate_thresholds": { blockThreshold: 0.99 },
        },
      });
      expect(strict.simulated.bookingDecisionsChanged.blocked).toBeGreaterThanOrEqual(
        lenient.simulated.bookingDecisionsChanged.blocked,
      );
    });
  });

  describe("Operating Modes", () => {
    it("should return 6 mode presets", () => {
      const presets = getModePresets();
      expect(Object.keys(presets).length).toBe(6);
      expect(presets).toHaveProperty("ADVISORY");
      expect(presets).toHaveProperty("APPROVAL_HEAVY");
      expect(presets).toHaveProperty("SEMI_AUTONOMOUS");
      expect(presets).toHaveProperty("HIGH_COMPLIANCE");
      expect(presets).toHaveProperty("MARGIN_PROTECTION");
      expect(presets).toHaveProperty("DISRUPTION_SENSITIVE");
    });

    it("should have no active mode initially", async () => {
      const mode = await getActiveMode(TEST_COMPANY_ID);
      expect(mode).toBeNull();
    });

    it("should activate ADVISORY mode", async () => {
      const result = await activateMode(TEST_COMPANY_ID, "ADVISORY", TEST_USER_ID);
      expect(result.modeName).toBe("ADVISORY");
      expect(result.isActive).toBe(true);
      expect(result.policyOverrides).toHaveProperty("booking.gate_thresholds");
    });

    it("should apply policy overrides on activation", async () => {
      const effective = await getEffectivePolicy(TEST_COMPANY_ID, "auto_task.creation_rules");
      expect((effective as any).enabled).toBe(false);
    });

    it("should return active mode", async () => {
      const mode = await getActiveMode(TEST_COMPANY_ID);
      expect(mode).toBeDefined();
      expect(mode?.modeName).toBe("ADVISORY");
    });

    it("should switch to a different mode", async () => {
      const result = await activateMode(TEST_COMPANY_ID, "SEMI_AUTONOMOUS", TEST_USER_ID);
      expect(result.modeName).toBe("SEMI_AUTONOMOUS");
      expect(result.isActive).toBe(true);

      const prev = await getAvailableModes(TEST_COMPANY_ID);
      const advisory = prev.find((m) => m.modeName === "ADVISORY");
      expect(advisory?.isActive).toBe(false);
    });

    it("should deactivate all modes", async () => {
      await deactivateMode(TEST_COMPANY_ID, TEST_USER_ID);
      const mode = await getActiveMode(TEST_COMPANY_ID);
      expect(mode).toBeNull();
    });

    it("should list available modes for tenant", async () => {
      const modes = await getAvailableModes(TEST_COMPANY_ID);
      expect(modes.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Reporting & Export", () => {
    it("should generate an executive summary report", async () => {
      const report = await generateReport(TEST_COMPANY_ID, "EXECUTIVE_SUMMARY", TEST_USER_ID);
      expect(report.id).toBeTruthy();
      expect(report.reportType).toBe("EXECUTIVE_SUMMARY");
      expect(report.title).toBe("Executive Summary Report");
      expect(report.data).toHaveProperty("generatedAt");
      expect(report.data).toHaveProperty("networkHealth");
    });

    it("should generate a portfolio risk report", async () => {
      const report = await generateReport(TEST_COMPANY_ID, "PORTFOLIO_RISK", TEST_USER_ID);
      expect(report.reportType).toBe("PORTFOLIO_RISK");
    });

    it("should generate a lane strategy report", async () => {
      const report = await generateReport(TEST_COMPANY_ID, "LANE_STRATEGY", TEST_USER_ID);
      expect(report.reportType).toBe("LANE_STRATEGY");
      expect(report.data).toHaveProperty("totalLanes");
    });

    it("should generate a carrier allocation report", async () => {
      const report = await generateReport(TEST_COMPANY_ID, "CARRIER_ALLOCATION", TEST_USER_ID);
      expect(report.reportType).toBe("CARRIER_ALLOCATION");
      expect(report.data).toHaveProperty("totalCarriers");
    });

    it("should generate a value attribution report", async () => {
      const report = await generateReport(TEST_COMPANY_ID, "VALUE_ATTRIBUTION", TEST_USER_ID);
      expect(report.reportType).toBe("VALUE_ATTRIBUTION");
    });

    it("should generate a recommendation performance report", async () => {
      const report = await generateReport(TEST_COMPANY_ID, "RECOMMENDATION_PERFORMANCE", TEST_USER_ID);
      expect(report.reportType).toBe("RECOMMENDATION_PERFORMANCE");
      expect(report.data).toHaveProperty("totalRecommendations");
    });

    it("should persist reports to DB", async () => {
      const rows = await db
        .select()
        .from(reportSnapshotsTable)
        .where(eq(reportSnapshotsTable.companyId, TEST_COMPANY_ID));
      expect(rows.length).toBeGreaterThanOrEqual(6);
    });

    it("should retrieve report history", async () => {
      const history = await getReportHistory(TEST_COMPANY_ID);
      expect(history.length).toBeGreaterThanOrEqual(6);
    });

    it("should filter report history by type", async () => {
      const history = await getReportHistory(TEST_COMPANY_ID, "EXECUTIVE_SUMMARY");
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history.every((r) => r.reportType === "EXECUTIVE_SUMMARY")).toBe(true);
    });

    it("should convert data to CSV", () => {
      const csv = convertToCSV([
        { name: "Lane A", score: 0.5 },
        { name: "Lane B", score: 0.8 },
      ]);
      expect(csv).toContain("name,score");
      expect(csv).toContain("Lane A,0.5");
      expect(csv).toContain("Lane B,0.8");
    });

    it("should handle CSV special characters", () => {
      const csv = convertToCSV([
        { name: 'Has "quotes"', value: "has,comma" },
      ]);
      expect(csv).toContain('"Has ""quotes"""');
      expect(csv).toContain('"has,comma"');
    });

    it("should format report for JSON export", async () => {
      const report = await generateReport(TEST_COMPANY_ID, "EXECUTIVE_SUMMARY", TEST_USER_ID);
      const exported = formatReportForExport(report, "JSON");
      expect(exported.contentType).toBe("application/json");
      expect(exported.filename).toContain("executive_summary");
      expect(exported.filename).toMatch(/\.json$/);
      const parsed = JSON.parse(exported.content);
      expect(parsed).toHaveProperty("networkHealth");
    });

    it("should format report for CSV export", async () => {
      const report = await generateReport(TEST_COMPANY_ID, "LANE_STRATEGY", TEST_USER_ID);
      const exported = formatReportForExport(report, "CSV");
      expect(exported.contentType).toBe("text/csv");
      expect(exported.filename).toContain("lane_strategy");
      expect(exported.filename).toMatch(/\.csv$/);
    });
  });

  describe("Integration: Mode → Policy → Simulation", () => {
    it("should activate HIGH_COMPLIANCE mode and verify policies change", async () => {
      await activateMode(TEST_COMPANY_ID, "HIGH_COMPLIANCE", TEST_USER_ID);

      const gatePolicy = await getEffectivePolicy(TEST_COMPANY_ID, "booking.gate_thresholds");
      expect((gatePolicy as any).blockThreshold).toBe(0.65);

      const riskPolicy = await getEffectivePolicy(TEST_COMPANY_ID, "risk.tolerances");
      expect((riskPolicy as any).maxAcceptableRiskScore).toBe(0.55);
    });

    it("should run simulation under current HIGH_COMPLIANCE mode", async () => {
      const result = await runPolicySimulation(TEST_COMPANY_ID, TEST_USER_ID, {
        simulationName: "Relax from HIGH_COMPLIANCE",
        policyChanges: {
          "booking.gate_thresholds": { blockThreshold: 0.9 },
          "risk.tolerances": { maxAcceptableRiskScore: 0.9 },
        },
      });
      expect(result.impactAnalysis).toBeDefined();
      expect(result.baseline).toBeDefined();
      expect(result.simulated).toBeDefined();
    });

    it("should generate report reflecting current mode state", async () => {
      const report = await generateReport(TEST_COMPANY_ID, "EXECUTIVE_SUMMARY", TEST_USER_ID);
      expect(report.data).toHaveProperty("networkHealth");
    });

    it("should clean up mode at end", async () => {
      await deactivateMode(TEST_COMPANY_ID, TEST_USER_ID);
      const mode = await getActiveMode(TEST_COMPANY_ID);
      expect(mode).toBeNull();
    });
  });
});
