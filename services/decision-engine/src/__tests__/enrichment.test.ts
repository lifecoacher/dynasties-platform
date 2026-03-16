import { describe, it, expect } from "vitest";
import {
  analyzeShipment,
  type AnalysisInputs,
  type ShipmentContext,
} from "../analyzer.js";
import type { IntelligenceSummary, SignalDetail } from "../intelligence-summary.js";

function makeShipment(overrides: Partial<ShipmentContext> = {}): ShipmentContext {
  return {
    shipmentId: "test-shipment-001",
    companyId: "test-company-001",
    status: "DRAFT",
    commodity: "Electronics",
    hsCode: "8471",
    portOfLoading: "CNSHA",
    portOfDischarge: "USLAX",
    vessel: "EVER GIVEN",
    etd: new Date("2026-04-01"),
    eta: new Date("2026-04-25"),
    grossWeight: 5000,
    ...overrides,
  };
}

function makeIntelSummary(overrides: Partial<IntelligenceSummary> = {}): IntelligenceSummary {
  return {
    shipmentId: "test-shipment-001",
    laneId: "CNSHA-USLAX",
    originPort: "CNSHA",
    destinationPort: "USLAX",
    congestionScore: 0,
    disruptionScore: 0,
    weatherRiskScore: 0,
    sanctionsRiskScore: 0,
    vesselRiskScore: 0,
    marketPressureScore: 0,
    compositeIntelScore: 0,
    linkedSignalIds: [],
    signals: [],
    generatedAt: new Date(),
    ...overrides,
  };
}

function makeSignal(overrides: Partial<SignalDetail> = {}): SignalDetail {
  return {
    signalId: "sig-001",
    signalType: "disruption",
    severity: "HIGH",
    summary: "Port closure at CNSHA due to typhoon",
    sourceTable: "disruption_events",
    externalReasonCode: "LANE_DISRUPTION_ACTIVE",
    ...overrides,
  };
}

function makeInputs(overrides: Partial<AnalysisInputs> = {}): AnalysisInputs {
  return {
    shipment: makeShipment(),
    compliance: null,
    risk: null,
    insurance: null,
    exceptions: [],
    tradeLane: null,
    pricing: null,
    intelligence: null,
    ...overrides,
  };
}

describe("Intelligence-Enriched Recommendations", () => {
  describe("ROUTE_ADJUSTMENT with intelligence", () => {
    it("generates route adjustment when congestion and disruption signals are high (no ETD/ETA)", () => {
      const inputs = makeInputs({
        shipment: makeShipment({ etd: null, eta: null }),
        intelligence: makeIntelSummary({
          congestionScore: 70,
          disruptionScore: 60,
          weatherRiskScore: 50,
          signals: [
            makeSignal({ signalType: "port_congestion", externalReasonCode: "PORT_CONGESTION_HIGH" }),
            makeSignal({ signalId: "sig-002", signalType: "disruption", externalReasonCode: "LANE_DISRUPTION_ACTIVE" }),
            makeSignal({ signalId: "sig-003", signalType: "weather_risk", externalReasonCode: "WEATHER_RISK_ELEVATED" }),
          ],
        }),
      });

      const recs = analyzeShipment(inputs);
      const routeRec = recs.find((r) => r.type === "ROUTE_ADJUSTMENT");
      expect(routeRec).toBeDefined();
      expect(routeRec?.intelligenceEnriched).toBe(true);
      expect(routeRec?.externalReasonCodes?.length).toBeGreaterThan(0);
    });
  });

  describe("DELAY_WARNING enrichment", () => {
    it("lowers delay threshold when congestion intelligence is present", () => {
      const inputs = makeInputs({
        tradeLane: {
          origin: "CNSHA",
          destination: "USLAX",
          shipmentCount: 100,
          delayCount: 25,
          delayFrequency: 0.25,
          carrierPerformanceScore: 60,
          avgTransitDays: 20,
        },
        intelligence: makeIntelSummary({
          congestionScore: 60,
          signals: [
            makeSignal({ signalType: "port_congestion", externalReasonCode: "PORT_CONGESTION_HIGH" }),
          ],
        }),
      });

      const recs = analyzeShipment(inputs);
      const delayRec = recs.find((r) => r.type === "DELAY_WARNING");
      expect(delayRec).toBeDefined();
      expect(delayRec?.reasonCodes).toContain("CONGESTION_DELAY");
    });

    it("does not lower delay threshold without intelligence", () => {
      const inputs = makeInputs({
        tradeLane: {
          origin: "CNSHA",
          destination: "USLAX",
          shipmentCount: 100,
          delayCount: 25,
          delayFrequency: 0.25,
          carrierPerformanceScore: 60,
          avgTransitDays: 20,
        },
      });

      const recs = analyzeShipment(inputs);
      const delayRec = recs.find((r) => r.type === "DELAY_WARNING");
      expect(delayRec).toBeUndefined();
    });
  });

  describe("COMPLIANCE_ESCALATION with sanctions intelligence", () => {
    it("escalates compliance alert to CRITICAL when sanctions intel present", () => {
      const inputs = makeInputs({
        compliance: { status: "ALERT", matches: [] },
        intelligence: makeIntelSummary({
          sanctionsRiskScore: 70,
          signals: [
            makeSignal({
              signalType: "sanctions_match",
              severity: "HIGH",
              summary: "Sanctions match: OFAC SDN List",
              externalReasonCode: "SANCTIONS_MATCH_POSSIBLE",
            }),
          ],
        }),
      });

      const recs = analyzeShipment(inputs);
      const complianceRec = recs.find((r) => r.type === "COMPLIANCE_ESCALATION");
      expect(complianceRec).toBeDefined();
      expect(complianceRec?.urgency).toBe("CRITICAL");
      expect(complianceRec?.intelligenceEnriched).toBe(true);
      expect(complianceRec?.reasonCodes).toContain("EXTERNAL_SANCTIONS_SIGNAL");
    });

    it("keeps BLOCKED compliance at CRITICAL without intelligence", () => {
      const inputs = makeInputs({
        compliance: { status: "BLOCKED", matches: [] },
      });

      const recs = analyzeShipment(inputs);
      const complianceRec = recs.find((r) => r.type === "COMPLIANCE_ESCALATION");
      expect(complianceRec).toBeDefined();
      expect(complianceRec?.urgency).toBe("CRITICAL");
      expect(complianceRec?.intelligenceEnriched).toBeUndefined();
    });
  });

  describe("RISK_MITIGATION multi-signal escalation", () => {
    it("escalates moderate risk when 3+ external signals present", () => {
      const inputs = makeInputs({
        risk: {
          compositeScore: 55,
          subScores: {},
          recommendedAction: "Review risk",
          primaryRiskFactors: [{ factor: "country_risk", explanation: "Origin country risk" }],
        },
        intelligence: makeIntelSummary({
          congestionScore: 50,
          disruptionScore: 50,
          weatherRiskScore: 50,
          signals: [
            makeSignal({ signalType: "port_congestion" }),
            makeSignal({ signalId: "sig-002", signalType: "disruption" }),
            makeSignal({ signalId: "sig-003", signalType: "weather_risk" }),
          ],
        }),
      });

      const recs = analyzeShipment(inputs);
      const riskRec = recs.find((r) => r.type === "RISK_MITIGATION");
      expect(riskRec).toBeDefined();
      expect(riskRec?.reasonCodes).toContain("MULTI_SIGNAL_RISK");
      expect(riskRec?.confidence).toBeGreaterThan(0.85);
    });
  });

  describe("CARRIER_SWITCH with vessel intelligence", () => {
    it("raises carrier performance threshold when vessel anomaly detected", () => {
      const inputs = makeInputs({
        tradeLane: {
          origin: "CNSHA",
          destination: "USLAX",
          shipmentCount: 50,
          delayCount: 10,
          delayFrequency: 0.2,
          carrierPerformanceScore: 55,
          avgTransitDays: 20,
        },
        intelligence: makeIntelSummary({
          vesselRiskScore: 40,
          signals: [
            makeSignal({
              signalType: "vessel_anomaly",
              summary: "Vessel EVER GIVEN is anchored",
              externalReasonCode: "VESSEL_ANOMALY_DETECTED",
            }),
          ],
        }),
      });

      const recs = analyzeShipment(inputs);
      const carrierRec = recs.find((r) => r.type === "CARRIER_SWITCH");
      expect(carrierRec).toBeDefined();
      expect(carrierRec?.reasonCodes).toContain("VESSEL_ISSUE");
    });
  });

  describe("INSURANCE_ADJUSTMENT with weather/disruption", () => {
    it("lowers insurance mismatch threshold when weather risk present", () => {
      const inputs = makeInputs({
        risk: {
          compositeScore: 50,
          subScores: {},
          recommendedAction: "Review",
          primaryRiskFactors: [],
        },
        insurance: {
          coverageType: "TOTAL_LOSS",
          estimatedPremium: 1000,
          confidenceScore: 0.8,
        },
        intelligence: makeIntelSummary({
          weatherRiskScore: 60,
          disruptionScore: 50,
          signals: [
            makeSignal({ signalType: "weather_risk", externalReasonCode: "WEATHER_RISK_ELEVATED" }),
            makeSignal({ signalId: "sig-002", signalType: "disruption", externalReasonCode: "LANE_DISRUPTION_ACTIVE" }),
          ],
        }),
      });

      const recs = analyzeShipment(inputs);
      const insuranceRec = recs.find((r) => r.type === "INSURANCE_ADJUSTMENT");
      expect(insuranceRec).toBeDefined();
      expect(insuranceRec?.reasonCodes).toContain("EXTERNAL_RISK_ELEVATED");
      expect(insuranceRec?.expectedRiskReduction).toBe(40);
    });
  });

  describe("PRICING_ALERT", () => {
    it("generates pricing alert when market pressure is high", () => {
      const inputs = makeInputs({
        pricing: { totalAmount: 5000, chargeCount: 3 },
        intelligence: makeIntelSummary({
          marketPressureScore: 60,
          signals: [
            makeSignal({
              signalType: "market_signal",
              summary: "demand_surge: up (magnitude 4) on CNSHA→USLAX",
              externalReasonCode: "MARKET_RATE_PRESSURE",
            }),
          ],
        }),
      });

      const recs = analyzeShipment(inputs);
      const pricingRec = recs.find((r) => r.type === "PRICING_ALERT");
      expect(pricingRec).toBeDefined();
      expect(pricingRec?.intelligenceEnriched).toBe(true);
      expect(pricingRec?.reasonCodes).toContain("PRICING_INTELLIGENCE");
      expect(pricingRec?.reasonCodes).toContain("MARKET_RATE_PRESSURE");
      expect(pricingRec?.expectedMarginImpactPct).toBeLessThan(0);
    });

    it("generates pricing alert when congestion and disruption combined", () => {
      const inputs = makeInputs({
        pricing: { totalAmount: 10000, chargeCount: 5 },
        intelligence: makeIntelSummary({
          congestionScore: 70,
          disruptionScore: 50,
          signals: [
            makeSignal({ signalType: "port_congestion", externalReasonCode: "PORT_CONGESTION_HIGH" }),
            makeSignal({ signalId: "sig-002", signalType: "disruption", externalReasonCode: "LANE_DISRUPTION_ACTIVE" }),
          ],
        }),
      });

      const recs = analyzeShipment(inputs);
      const pricingRec = recs.find((r) => r.type === "PRICING_ALERT");
      expect(pricingRec).toBeDefined();
      expect(pricingRec?.reasonCodes).toContain("CONGESTION_SURCHARGE_RISK");
      expect(pricingRec?.reasonCodes).toContain("DISRUPTION_PREMIUM_RISK");
    });

    it("does not generate pricing alert without intelligence", () => {
      const inputs = makeInputs({
        pricing: { totalAmount: 5000, chargeCount: 3 },
      });

      const recs = analyzeShipment(inputs);
      const pricingRec = recs.find((r) => r.type === "PRICING_ALERT");
      expect(pricingRec).toBeUndefined();
    });

    it("does not generate pricing alert with low scores", () => {
      const inputs = makeInputs({
        intelligence: makeIntelSummary({
          marketPressureScore: 20,
          congestionScore: 30,
        }),
      });

      const recs = analyzeShipment(inputs);
      const pricingRec = recs.find((r) => r.type === "PRICING_ALERT");
      expect(pricingRec).toBeUndefined();
    });
  });

  describe("Graceful fallback without intelligence", () => {
    it("produces standard recommendations without intelligence data", () => {
      const inputs = makeInputs({
        risk: {
          compositeScore: 75,
          subScores: {},
          recommendedAction: "Review risk factors",
          primaryRiskFactors: [{ factor: "high_value", explanation: "Shipment value exceeds threshold" }],
        },
      });

      const recs = analyzeShipment(inputs);
      const riskRec = recs.find((r) => r.type === "RISK_MITIGATION");
      expect(riskRec).toBeDefined();
      expect(riskRec?.intelligenceEnriched).toBeUndefined();
      expect(riskRec?.externalReasonCodes).toBeUndefined();
    });
  });

  describe("Signal evidence structure", () => {
    it("populates signal evidence on enriched recommendations", () => {
      const inputs = makeInputs({
        compliance: { status: "BLOCKED", matches: [] },
        intelligence: makeIntelSummary({
          sanctionsRiskScore: 80,
          signals: [
            makeSignal({
              signalType: "sanctions_match",
              severity: "CRITICAL",
              summary: "OFAC SDN List match at 85% confidence",
              externalReasonCode: "SANCTIONS_MATCH_POSSIBLE",
            }),
          ],
        }),
      });

      const recs = analyzeShipment(inputs);
      const complianceRec = recs.find((r) => r.type === "COMPLIANCE_ESCALATION");
      expect(complianceRec?.signalEvidence).toBeDefined();
      expect(complianceRec?.signalEvidence?.length).toBeGreaterThan(0);
      expect(complianceRec?.signalEvidence?.[0].signalType).toBe("sanctions_match");
      expect(complianceRec?.signalEvidence?.[0].summary).toContain("OFAC");
    });
  });

  describe("Dedup behavior with enrichment", () => {
    it("same intelligence produces same fingerprint", () => {
      const inputs1 = makeInputs({
        risk: {
          compositeScore: 75,
          subScores: {},
          recommendedAction: "Review risk factors",
          primaryRiskFactors: [{ factor: "high_value", explanation: "High value" }],
        },
        intelligence: makeIntelSummary({
          disruptionScore: 60,
          signals: [makeSignal()],
        }),
      });

      const recs1 = analyzeShipment(inputs1);
      const recs2 = analyzeShipment(inputs1);

      expect(recs1[0].type).toBe(recs2[0].type);
      expect(recs1[0].reasonCodes).toEqual(recs2[0].reasonCodes);
      expect(recs1[0].recommendedAction).toBe(recs2[0].recommendedAction);
    });

    it("changed intelligence changes reasonCodes and thus fingerprint", () => {
      const baseInputs = {
        risk: {
          compositeScore: 55,
          subScores: {},
          recommendedAction: "Review",
          primaryRiskFactors: [{ factor: "moderate", explanation: "Moderate risk" }],
        },
      };

      const withoutMultiSignal = makeInputs({
        ...baseInputs,
        intelligence: makeIntelSummary({
          signals: [makeSignal()],
        }),
      });

      const withMultiSignal = makeInputs({
        ...baseInputs,
        intelligence: makeIntelSummary({
          signals: [
            makeSignal({ signalId: "s1" }),
            makeSignal({ signalId: "s2", signalType: "weather_risk" }),
            makeSignal({ signalId: "s3", signalType: "port_congestion" }),
          ],
        }),
      });

      const recs1 = analyzeShipment(withoutMultiSignal);
      const recs2 = analyzeShipment(withMultiSignal);

      const risk1 = recs1.find((r) => r.type === "RISK_MITIGATION");
      const risk2 = recs2.find((r) => r.type === "RISK_MITIGATION");

      if (risk1 && risk2) {
        expect(risk2.reasonCodes).toContain("MULTI_SIGNAL_RISK");
        expect(risk1.reasonCodes).not.toContain("MULTI_SIGNAL_RISK");
      }
    });
  });
});
