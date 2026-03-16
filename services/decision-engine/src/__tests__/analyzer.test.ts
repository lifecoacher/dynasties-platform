import { describe, it, expect } from "vitest";
import {
  analyzeShipment,
  computeFingerprint,
  type AnalysisInputs,
} from "../analyzer.js";

function makeInputs(overrides: Partial<AnalysisInputs> = {}): AnalysisInputs {
  return {
    shipment: {
      shipmentId: "shp_test_001",
      companyId: "comp_test",
      status: "DRAFT",
      commodity: "Electronics",
      hsCode: "8542.31",
      portOfLoading: "CNSHA",
      portOfDischarge: "USLAX",
      vessel: "EVER GIVEN",
      etd: new Date("2026-06-01"),
      eta: new Date("2026-06-20"),
      grossWeight: 5000,
    },
    compliance: null,
    risk: null,
    insurance: null,
    exceptions: [],
    tradeLane: null,
    pricing: null,
    ...overrides,
  };
}

describe("analyzeShipment", () => {
  it("returns empty array when no issues detected", () => {
    const recs = analyzeShipment(makeInputs());
    expect(recs).toEqual([]);
  });

  it("generates COMPLIANCE_ESCALATION for BLOCKED status", () => {
    const recs = analyzeShipment(makeInputs({ compliance: { status: "BLOCKED", matches: [] } }));
    const comp = recs.filter((r) => r.type === "COMPLIANCE_ESCALATION");
    expect(comp.length).toBe(1);
    expect(comp[0].urgency).toBe("CRITICAL");
    expect(comp[0].confidence).toBe(0.95);
  });

  it("generates COMPLIANCE_ESCALATION for ALERT status", () => {
    const recs = analyzeShipment(makeInputs({ compliance: { status: "ALERT", matches: [] } }));
    const comp = recs.filter((r) => r.type === "COMPLIANCE_ESCALATION");
    expect(comp.length).toBe(1);
    expect(comp[0].urgency).toBe("HIGH");
  });

  it("does not generate compliance rec for CLEAR status", () => {
    const recs = analyzeShipment(makeInputs({ compliance: { status: "CLEAR", matches: [] } }));
    const comp = recs.filter((r) => r.type === "COMPLIANCE_ESCALATION");
    expect(comp.length).toBe(0);
  });

  it("generates HIGH RISK_MITIGATION for score >= 70", () => {
    const recs = analyzeShipment(makeInputs({
      risk: { compositeScore: 75, subScores: {}, recommendedAction: "Review", primaryRiskFactors: [{ factor: "geo", explanation: "unstable region" }] },
    }));
    const risk = recs.filter((r) => r.type === "RISK_MITIGATION");
    expect(risk.length).toBe(1);
    expect(risk[0].urgency).toBe("HIGH");
    expect(risk[0].reasonCodes).toContain("HIGH_RISK_SCORE");
  });

  it("generates MEDIUM RISK_MITIGATION for score 50-69", () => {
    const recs = analyzeShipment(makeInputs({
      risk: { compositeScore: 55, subScores: {}, recommendedAction: "", primaryRiskFactors: [] },
    }));
    const risk = recs.filter((r) => r.type === "RISK_MITIGATION");
    expect(risk.length).toBe(1);
    expect(risk[0].urgency).toBe("MEDIUM");
  });

  it("does not generate risk rec for score < 50", () => {
    const recs = analyzeShipment(makeInputs({
      risk: { compositeScore: 30, subScores: {}, recommendedAction: "", primaryRiskFactors: [] },
    }));
    const risk = recs.filter((r) => r.type === "RISK_MITIGATION");
    expect(risk.length).toBe(0);
  });

  it("generates INSURANCE_ADJUSTMENT when risk high + TOTAL_LOSS", () => {
    const recs = analyzeShipment(makeInputs({
      risk: { compositeScore: 65, subScores: {}, recommendedAction: "", primaryRiskFactors: [] },
      insurance: { coverageType: "TOTAL_LOSS", estimatedPremium: 500, confidenceScore: 0.8 },
    }));
    const ins = recs.filter((r) => r.type === "INSURANCE_ADJUSTMENT");
    expect(ins.length).toBe(1);
    expect(ins[0].reasonCodes).toContain("INSUFFICIENT_COVERAGE");
  });

  it("generates INSURANCE_ADJUSTMENT for low confidence", () => {
    const recs = analyzeShipment(makeInputs({
      risk: { compositeScore: 30, subScores: {}, recommendedAction: "", primaryRiskFactors: [] },
      insurance: { coverageType: "ALL_RISK", estimatedPremium: 500, confidenceScore: 0.3 },
    }));
    const ins = recs.filter((r) => r.type === "INSURANCE_ADJUSTMENT");
    expect(ins.length).toBe(1);
    expect(ins[0].reasonCodes).toContain("LOW_CONFIDENCE_QUOTE");
  });

  it("generates DOCUMENT_CORRECTION for open CRITICAL exceptions", () => {
    const recs = analyzeShipment(makeInputs({
      exceptions: [
        { id: "e1", exceptionType: "MISSING_DOC", severity: "CRITICAL", title: "Missing BL", status: "OPEN" },
      ],
    }));
    const doc = recs.filter((r) => r.type === "DOCUMENT_CORRECTION");
    expect(doc.length).toBe(1);
    expect(doc[0].urgency).toBe("CRITICAL");
  });

  it("generates DELAY_WARNING for high delay frequency trade lane", () => {
    const recs = analyzeShipment(makeInputs({
      tradeLane: {
        origin: "CNSHA",
        destination: "USLAX",
        shipmentCount: 100,
        delayCount: 40,
        delayFrequency: 0.4,
        carrierPerformanceScore: 80,
        avgTransitDays: 20,
      },
    }));
    const delay = recs.filter((r) => r.type === "DELAY_WARNING");
    expect(delay.length).toBe(1);
    expect(delay[0].reasonCodes).toContain("HIGH_DELAY_FREQUENCY");
  });

  it("generates CARRIER_SWITCH for low carrier performance", () => {
    const recs = analyzeShipment(makeInputs({
      tradeLane: {
        origin: "CNSHA",
        destination: "USLAX",
        shipmentCount: 100,
        delayCount: 10,
        delayFrequency: 0.1,
        carrierPerformanceScore: 30,
        avgTransitDays: 20,
      },
    }));
    const carrier = recs.filter((r) => r.type === "CARRIER_SWITCH");
    expect(carrier.length).toBe(1);
  });

  it("generates MARGIN_WARNING for high insurance ratio", () => {
    const recs = analyzeShipment(makeInputs({
      risk: { compositeScore: 30, subScores: {}, recommendedAction: "", primaryRiskFactors: [] },
      insurance: { coverageType: "ALL_RISK", estimatedPremium: 2000, confidenceScore: 0.9 },
      pricing: { totalAmount: 10000, chargeCount: 3 },
    }));
    const margin = recs.filter((r) => r.type === "MARGIN_WARNING");
    expect(margin.length).toBe(1);
    expect(margin[0].reasonCodes).toContain("HIGH_INSURANCE_RATIO");
  });

  it("generates DELAY_WARNING for overdue DRAFT shipment", () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    const recs = analyzeShipment(makeInputs({
      shipment: {
        shipmentId: "shp_test_001",
        companyId: "comp_test",
        status: "DRAFT",
        commodity: "Electronics",
        hsCode: null,
        portOfLoading: null,
        portOfDischarge: null,
        vessel: null,
        etd: pastDate,
        eta: futureDate,
        grossWeight: null,
      },
    }));
    const delay = recs.filter((r) => r.type === "DELAY_WARNING");
    expect(delay.length).toBe(1);
    expect(delay[0].urgency).toBe("CRITICAL");
    expect(delay[0].reasonCodes).toContain("ETD_PASSED");
  });

  it("generates ROUTE_ADJUSTMENT for very long transit time", () => {
    const recs = analyzeShipment(makeInputs({
      shipment: {
        shipmentId: "shp_test_001",
        companyId: "comp_test",
        status: "APPROVED",
        commodity: null,
        hsCode: null,
        portOfLoading: null,
        portOfDischarge: null,
        vessel: null,
        etd: new Date("2026-01-01"),
        eta: new Date("2026-06-01"),
        grossWeight: null,
      },
    }));
    const route = recs.filter((r) => r.type === "ROUTE_ADJUSTMENT");
    expect(route.length).toBe(1);
    expect(route[0].reasonCodes).toContain("LONG_TRANSIT_TIME");
  });

  it("does not generate removed PRICING_ALERT type", () => {
    const recs = analyzeShipment(makeInputs({
      risk: { compositeScore: 80, subScores: {}, recommendedAction: "Review", primaryRiskFactors: [] },
      insurance: { coverageType: "ALL_RISK", estimatedPremium: 5000, confidenceScore: 0.9 },
      pricing: { totalAmount: 100000, chargeCount: 5 },
      compliance: { status: "ALERT", matches: [] },
    }));
    const pricing = recs.filter((r) => r.type === "PRICING_ALERT" as any);
    expect(pricing.length).toBe(0);
  });

  it("generates multiple recommendation types simultaneously", () => {
    const recs = analyzeShipment(makeInputs({
      compliance: { status: "ALERT", matches: [] },
      risk: { compositeScore: 75, subScores: {}, recommendedAction: "Review", primaryRiskFactors: [{ factor: "geo", explanation: "unstable" }] },
      insurance: { coverageType: "TOTAL_LOSS", estimatedPremium: 1000, confidenceScore: 0.8 },
    }));
    const types = new Set(recs.map((r) => r.type));
    expect(types.has("COMPLIANCE_ESCALATION")).toBe(true);
    expect(types.has("RISK_MITIGATION")).toBe(true);
    expect(types.has("INSURANCE_ADJUSTMENT")).toBe(true);
  });
});

describe("computeFingerprint", () => {
  it("returns consistent hash for same inputs", () => {
    const fp1 = computeFingerprint("shp_001", "RISK_MITIGATION", ["HIGH_RISK_SCORE", "GEO"], "Review risk");
    const fp2 = computeFingerprint("shp_001", "RISK_MITIGATION", ["HIGH_RISK_SCORE", "GEO"], "Review risk");
    expect(fp1).toBe(fp2);
  });

  it("returns same hash regardless of reasonCode order", () => {
    const fp1 = computeFingerprint("shp_001", "RISK_MITIGATION", ["GEO", "HIGH_RISK_SCORE"], "Review risk");
    const fp2 = computeFingerprint("shp_001", "RISK_MITIGATION", ["HIGH_RISK_SCORE", "GEO"], "Review risk");
    expect(fp1).toBe(fp2);
  });

  it("returns different hash for different shipments", () => {
    const fp1 = computeFingerprint("shp_001", "RISK_MITIGATION", ["HIGH_RISK_SCORE"], "Review risk");
    const fp2 = computeFingerprint("shp_002", "RISK_MITIGATION", ["HIGH_RISK_SCORE"], "Review risk");
    expect(fp1).not.toBe(fp2);
  });

  it("returns different hash for different types", () => {
    const fp1 = computeFingerprint("shp_001", "RISK_MITIGATION", ["HIGH_RISK_SCORE"], "Review risk");
    const fp2 = computeFingerprint("shp_001", "DELAY_WARNING", ["HIGH_RISK_SCORE"], "Review risk");
    expect(fp1).not.toBe(fp2);
  });

  it("returns different hash for different reason codes", () => {
    const fp1 = computeFingerprint("shp_001", "RISK_MITIGATION", ["HIGH_RISK_SCORE"], "Review risk");
    const fp2 = computeFingerprint("shp_001", "RISK_MITIGATION", ["MODERATE_RISK_SCORE"], "Review risk");
    expect(fp1).not.toBe(fp2);
  });

  it("returns 40-character hex string", () => {
    const fp = computeFingerprint("shp_001", "RISK_MITIGATION", ["A"], "B");
    expect(fp).toMatch(/^[a-f0-9]{40}$/);
  });
});

describe("config integration", () => {
  it("all recommendations pass Zod validation", async () => {
    const inputs = makeInputs({
      compliance: { status: "BLOCKED", matches: [] },
      risk: { compositeScore: 80, subScores: {}, recommendedAction: "Review", primaryRiskFactors: [{ factor: "geo", explanation: "issue" }] },
      insurance: { coverageType: "TOTAL_LOSS", estimatedPremium: 3000, confidenceScore: 0.3 },
      exceptions: [{ id: "e1", exceptionType: "MISSING_DOC", severity: "CRITICAL", title: "Missing BL", status: "OPEN" }],
      tradeLane: { origin: "CNSHA", destination: "USLAX", shipmentCount: 100, delayCount: 60, delayFrequency: 0.6, carrierPerformanceScore: 30, avgTransitDays: 20 },
      pricing: { totalAmount: 10000, chargeCount: 3 },
    });

    const recs = analyzeShipment(inputs);
    expect(recs.length).toBeGreaterThan(0);

    const { recommendationSchema: schema } = await import("../analyzer.js");
    for (const rec of recs) {
      const result = schema.safeParse(rec);
      expect(result.success).toBe(true);
    }
  });
});
