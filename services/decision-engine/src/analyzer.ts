import { z } from "zod";
import { createHash } from "node:crypto";
import { THRESHOLDS, INTEL_THRESHOLDS, EXTERNAL_REASON_CODES } from "./config.js";
import type { IntelligenceSummary, SignalDetail } from "./intelligence-summary.js";

export const RECOMMENDATION_TYPES = [
  "CARRIER_SWITCH",
  "ROUTE_ADJUSTMENT",
  "INSURANCE_ADJUSTMENT",
  "COMPLIANCE_ESCALATION",
  "DELAY_WARNING",
  "MARGIN_WARNING",
  "DOCUMENT_CORRECTION",
  "RISK_MITIGATION",
  "PRICING_ALERT",
] as const;

export const recommendationSchema = z.object({
  type: z.enum(RECOMMENDATION_TYPES),
  title: z.string().min(1),
  explanation: z.string().min(1),
  reasonCodes: z.array(z.string()).min(1),
  externalReasonCodes: z.array(z.string()).optional(),
  signalEvidence: z.array(z.object({
    signalId: z.string(),
    signalType: z.string(),
    severity: z.string(),
    summary: z.string(),
    externalReasonCode: z.string(),
  })).optional(),
  confidence: z.number().min(0).max(1),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  expectedDelayImpactDays: z.number().nullable().optional(),
  expectedMarginImpactPct: z.number().nullable().optional(),
  expectedRiskReduction: z.number().nullable().optional(),
  recommendedAction: z.string().min(1),
  sourceAgent: z.string(),
  intelligenceEnriched: z.boolean().optional(),
});

export type RecommendationInput = z.infer<typeof recommendationSchema>;

export interface ShipmentContext {
  shipmentId: string;
  companyId: string;
  status: string;
  commodity: string | null;
  hsCode: string | null;
  portOfLoading: string | null;
  portOfDischarge: string | null;
  vessel: string | null;
  etd: Date | null;
  eta: Date | null;
  grossWeight: number | null;
}

export interface ComplianceData {
  status: string;
  matches: unknown;
}

export interface RiskData {
  compositeScore: number;
  subScores: Record<string, number>;
  recommendedAction: string;
  primaryRiskFactors: Array<{ factor: string; explanation: string }>;
}

export interface InsuranceData {
  coverageType: string;
  estimatedPremium: number;
  confidenceScore: number;
}

export interface ExceptionData {
  id: string;
  exceptionType: string;
  severity: string;
  title: string;
  status: string;
}

export interface TradeLaneData {
  origin: string;
  destination: string;
  shipmentCount: number;
  delayCount: number;
  delayFrequency: number | null;
  carrierPerformanceScore: number | null;
  avgTransitDays: number | null;
}

export interface PricingData {
  totalAmount: number;
  chargeCount: number;
}

export interface AnalysisInputs {
  shipment: ShipmentContext;
  compliance: ComplianceData | null;
  risk: RiskData | null;
  insurance: InsuranceData | null;
  exceptions: ExceptionData[];
  tradeLane: TradeLaneData | null;
  pricing: PricingData | null;
  intelligence: IntelligenceSummary | null;
}

export function computeFingerprint(
  shipmentId: string,
  type: string,
  reasonCodes: string[],
  recommendedAction: string,
): string {
  const payload = [shipmentId, type, ...reasonCodes.sort(), recommendedAction].join("|");
  return createHash("sha256").update(payload).digest("hex").substring(0, 40);
}

export function analyzeShipment(inputs: AnalysisInputs): RecommendationInput[] {
  const recs: RecommendationInput[] = [];

  analyzeCompliance(inputs, recs);
  analyzeRisk(inputs, recs);
  analyzeInsurance(inputs, recs);
  analyzeExceptions(inputs, recs);
  analyzeTradeLane(inputs, recs);
  analyzePricing(inputs, recs);
  analyzeDelayRisk(inputs, recs);
  analyzePricingAlert(inputs, recs);

  return recs;
}

function getRelevantSignals(intel: IntelligenceSummary | null, ...types: string[]): SignalDetail[] {
  if (!intel) return [];
  return intel.signals.filter((s) => types.includes(s.signalType));
}

function buildExternalReasonCodes(intel: IntelligenceSummary | null): string[] {
  if (!intel) return [];
  const codes = new Set<string>();

  if (intel.congestionScore >= INTEL_THRESHOLDS.CONGESTION_CRITICAL)
    codes.add(EXTERNAL_REASON_CODES.PORT_CONGESTION_CRITICAL);
  else if (intel.congestionScore >= INTEL_THRESHOLDS.CONGESTION_TRIGGER)
    codes.add(EXTERNAL_REASON_CODES.PORT_CONGESTION_HIGH);

  if (intel.disruptionScore >= INTEL_THRESHOLDS.DISRUPTION_CRITICAL)
    codes.add(EXTERNAL_REASON_CODES.LANE_DISRUPTION_CRITICAL);
  else if (intel.disruptionScore >= INTEL_THRESHOLDS.DISRUPTION_TRIGGER)
    codes.add(EXTERNAL_REASON_CODES.LANE_DISRUPTION_ACTIVE);

  if (intel.weatherRiskScore >= INTEL_THRESHOLDS.WEATHER_CRITICAL)
    codes.add(EXTERNAL_REASON_CODES.WEATHER_RISK_CRITICAL);
  else if (intel.weatherRiskScore >= INTEL_THRESHOLDS.WEATHER_TRIGGER)
    codes.add(EXTERNAL_REASON_CODES.WEATHER_RISK_ELEVATED);

  if (intel.sanctionsRiskScore >= INTEL_THRESHOLDS.SANCTIONS_CRITICAL)
    codes.add(EXTERNAL_REASON_CODES.SANCTIONS_MATCH_HIGH_CONFIDENCE);
  else if (intel.sanctionsRiskScore >= INTEL_THRESHOLDS.SANCTIONS_TRIGGER)
    codes.add(EXTERNAL_REASON_CODES.SANCTIONS_MATCH_POSSIBLE);

  if (intel.marketPressureScore >= INTEL_THRESHOLDS.MARKET_PRESSURE_HIGH)
    codes.add(EXTERNAL_REASON_CODES.MARKET_RATE_SURGE);
  else if (intel.marketPressureScore >= INTEL_THRESHOLDS.MARKET_PRESSURE_TRIGGER)
    codes.add(EXTERNAL_REASON_CODES.MARKET_RATE_PRESSURE);

  if (intel.vesselRiskScore >= INTEL_THRESHOLDS.VESSEL_ANOMALY_TRIGGER)
    codes.add(EXTERNAL_REASON_CODES.VESSEL_ANOMALY_DETECTED);

  if (intel.signals.length >= INTEL_THRESHOLDS.MULTI_SIGNAL_ESCALATION_COUNT)
    codes.add(EXTERNAL_REASON_CODES.MULTI_SIGNAL_ESCALATION);

  return Array.from(codes);
}

function escalateUrgency(
  baseUrgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  intel: IntelligenceSummary | null,
  ...relevantScores: number[]
): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (!intel) return baseUrgency;

  const maxScore = Math.max(...relevantScores, 0);
  const urgencyOrder: ("LOW" | "MEDIUM" | "HIGH" | "CRITICAL")[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const baseIdx = urgencyOrder.indexOf(baseUrgency);

  let escalation = 0;
  if (maxScore >= INTEL_THRESHOLDS.COMPOSITE_INTEL_CRITICAL) escalation = 2;
  else if (maxScore >= INTEL_THRESHOLDS.COMPOSITE_INTEL_HIGH) escalation = 1;
  else if (maxScore >= INTEL_THRESHOLDS.COMPOSITE_INTEL_ELEVATED && intel.signals.length >= INTEL_THRESHOLDS.MULTI_SIGNAL_ESCALATION_COUNT) escalation = 1;

  return urgencyOrder[Math.min(baseIdx + escalation, 3)];
}

function enrichRec(
  rec: RecommendationInput,
  intel: IntelligenceSummary | null,
  relevantSignals: SignalDetail[],
): RecommendationInput {
  if (!intel || relevantSignals.length === 0) return rec;

  const extCodes = relevantSignals.map((s) => s.externalReasonCode);
  const uniqueExtCodes = [...new Set(extCodes)];

  return {
    ...rec,
    externalReasonCodes: uniqueExtCodes,
    signalEvidence: relevantSignals.map((s) => ({
      signalId: s.signalId,
      signalType: s.signalType,
      severity: s.severity,
      summary: s.summary,
      externalReasonCode: s.externalReasonCode,
    })),
    intelligenceEnriched: true,
  };
}

function analyzeCompliance(inputs: AnalysisInputs, recs: RecommendationInput[]): void {
  const { compliance, intelligence } = inputs;
  if (!compliance) return;

  if (compliance.status === "BLOCKED") {
    const sanctionsSignals = getRelevantSignals(intelligence, "sanctions_match");
    const hasSanctionsIntel = sanctionsSignals.length > 0;

    const rec: RecommendationInput = {
      type: "COMPLIANCE_ESCALATION",
      title: hasSanctionsIntel
        ? "Shipment blocked — external sanctions match confirmed"
        : "Shipment blocked by compliance screening",
      explanation: hasSanctionsIntel
        ? `This shipment has been flagged BLOCKED by compliance screening and has ${sanctionsSignals.length} external sanctions match(es) from intelligence feeds. ${sanctionsSignals.map((s) => s.summary).join("; ")}`
        : "This shipment has been flagged by the compliance screening system with a BLOCKED status. Immediate escalation is required before any further processing can occur.",
      reasonCodes: hasSanctionsIntel
        ? ["COMPLIANCE_BLOCKED", "SANCTIONS_MATCH", "EXTERNAL_SANCTIONS_CONFIRMED"]
        : ["COMPLIANCE_BLOCKED", "SANCTIONS_MATCH"],
      confidence: hasSanctionsIntel ? 0.98 : 0.95,
      urgency: "CRITICAL",
      expectedDelayImpactDays: 5,
      expectedMarginImpactPct: null,
      expectedRiskReduction: null,
      recommendedAction: hasSanctionsIntel
        ? "Escalate to compliance officer immediately. External intelligence confirms sanctions list match. Do not approve shipment."
        : "Escalate to compliance officer immediately. Do not approve shipment until sanctions match is resolved.",
      sourceAgent: "decision-engine",
    };
    recs.push(enrichRec(rec, intelligence, sanctionsSignals));
  } else if (compliance.status === "ALERT") {
    const sanctionsSignals = getRelevantSignals(intelligence, "sanctions_match");
    const baseUrgency = sanctionsSignals.length > 0 ? "CRITICAL" : "HIGH";

    const rec: RecommendationInput = {
      type: "COMPLIANCE_ESCALATION",
      title: sanctionsSignals.length > 0
        ? "Compliance alert with external sanctions intelligence"
        : "Compliance alert requires review",
      explanation: sanctionsSignals.length > 0
        ? `Compliance screening returned potential matches, and external intelligence has ${sanctionsSignals.length} related sanctions signal(s). ${sanctionsSignals.map((s) => s.summary).join("; ")}`
        : "The compliance screening returned potential matches that need manual review. The shipment can proceed only after a compliance officer verifies the screening results.",
      reasonCodes: sanctionsSignals.length > 0
        ? ["COMPLIANCE_ALERT", "POTENTIAL_MATCH", "EXTERNAL_SANCTIONS_SIGNAL"]
        : ["COMPLIANCE_ALERT", "POTENTIAL_MATCH"],
      confidence: sanctionsSignals.length > 0 ? 0.9 : 0.8,
      urgency: baseUrgency as "HIGH" | "CRITICAL",
      expectedDelayImpactDays: sanctionsSignals.length > 0 ? 5 : 2,
      expectedMarginImpactPct: null,
      expectedRiskReduction: null,
      recommendedAction:
        "Review compliance screening results and verify entity identities before approval.",
      sourceAgent: "decision-engine",
    };
    recs.push(enrichRec(rec, intelligence, sanctionsSignals));
  }
}

function analyzeRisk(inputs: AnalysisInputs, recs: RecommendationInput[]): void {
  const { risk, intelligence } = inputs;
  if (!risk) return;

  const multiSignals = intelligence?.signals || [];
  const signalCount = multiSignals.length;
  const hasMultiSignalEscalation = signalCount >= INTEL_THRESHOLDS.MULTI_SIGNAL_ESCALATION_COUNT;

  if (risk.compositeScore >= THRESHOLDS.RISK_HIGH || (risk.compositeScore >= THRESHOLDS.RISK_MODERATE && hasMultiSignalEscalation)) {
    const factors = risk.primaryRiskFactors.map((f) => f.explanation).join(" ");
    const intelExplanation = hasMultiSignalEscalation
      ? ` External intelligence shows ${signalCount} active signals reinforcing risk assessment.`
      : "";

    const baseUrgency = risk.compositeScore >= THRESHOLDS.RISK_HIGH ? "HIGH" : "MEDIUM";
    const urgency = escalateUrgency(baseUrgency as "HIGH" | "MEDIUM", intelligence,
      intelligence?.disruptionScore ?? 0, intelligence?.weatherRiskScore ?? 0, intelligence?.congestionScore ?? 0);

    const rec: RecommendationInput = {
      type: "RISK_MITIGATION",
      title: hasMultiSignalEscalation
        ? "High-risk shipment with multiple external risk signals"
        : "High-risk shipment requires mitigation",
      explanation: `Composite risk score: ${risk.compositeScore}/100. ${factors}${intelExplanation} Consider alternative routing or enhanced insurance coverage.`,
      reasonCodes: [
        "HIGH_RISK_SCORE",
        ...risk.primaryRiskFactors.map((f) => f.factor.toUpperCase().replace(/\s+/g, "_")),
        ...(hasMultiSignalEscalation ? ["MULTI_SIGNAL_RISK"] : []),
      ],
      confidence: hasMultiSignalEscalation ? 0.92 : 0.85,
      urgency,
      expectedDelayImpactDays: null,
      expectedMarginImpactPct: -5,
      expectedRiskReduction: 20,
      recommendedAction:
        risk.recommendedAction ||
        "Review risk factors and consider route adjustment or additional insurance.",
      sourceAgent: "decision-engine",
    };
    recs.push(enrichRec(rec, intelligence, multiSignals));
  } else if (risk.compositeScore >= THRESHOLDS.RISK_MODERATE) {
    const rec: RecommendationInput = {
      type: "RISK_MITIGATION",
      title: "Moderate risk detected — review recommended",
      explanation: `Composite risk score: ${risk.compositeScore}/100. Operator review is advised to ensure risk is acceptable for this shipment.`,
      reasonCodes: ["MODERATE_RISK_SCORE"],
      confidence: 0.7,
      urgency: "MEDIUM",
      expectedDelayImpactDays: null,
      expectedMarginImpactPct: -2,
      expectedRiskReduction: 10,
      recommendedAction:
        "Review risk factors. Consider whether additional mitigation is warranted.",
      sourceAgent: "decision-engine",
    };
    recs.push(rec);
  }
}

function analyzeInsurance(inputs: AnalysisInputs, recs: RecommendationInput[]): void {
  const { insurance, risk, intelligence } = inputs;
  if (!insurance || !risk) return;

  const weatherDisruptionSignals = getRelevantSignals(intelligence, "weather_risk", "disruption");
  const hasExternalRisk = weatherDisruptionSignals.length > 0;
  const lowerThreshold = hasExternalRisk
    ? THRESHOLDS.RISK_INSURANCE_MISMATCH - 15
    : THRESHOLDS.RISK_INSURANCE_MISMATCH;

  if (
    risk.compositeScore >= lowerThreshold &&
    insurance.coverageType === "TOTAL_LOSS"
  ) {
    const intelNote = hasExternalRisk
      ? ` External intelligence identifies ${weatherDisruptionSignals.length} active weather/disruption risk(s) that increase exposure.`
      : "";

    const rec: RecommendationInput = {
      type: "INSURANCE_ADJUSTMENT",
      title: hasExternalRisk
        ? "Upgrade insurance — weather/disruption risks increase exposure"
        : "Upgrade insurance coverage for high-risk shipment",
      explanation: `Current coverage is TOTAL_LOSS only, but the risk score is ${risk.compositeScore}/100.${intelNote} ALL_RISK coverage is recommended to protect against partial losses.`,
      reasonCodes: hasExternalRisk
        ? ["INSUFFICIENT_COVERAGE", "HIGH_RISK_MISMATCH", "EXTERNAL_RISK_ELEVATED"]
        : ["INSUFFICIENT_COVERAGE", "HIGH_RISK_MISMATCH"],
      confidence: hasExternalRisk ? 0.9 : 0.8,
      urgency: escalateUrgency("HIGH", intelligence, intelligence?.weatherRiskScore ?? 0, intelligence?.disruptionScore ?? 0),
      expectedDelayImpactDays: null,
      expectedMarginImpactPct: -3,
      expectedRiskReduction: hasExternalRisk ? 40 : 30,
      recommendedAction:
        "Upgrade insurance coverage from TOTAL_LOSS to ALL_RISK before shipment departure.",
      sourceAgent: "decision-engine",
    };
    recs.push(enrichRec(rec, intelligence, weatherDisruptionSignals));
  }

  if (insurance.confidenceScore < THRESHOLDS.INSURANCE_LOW_CONFIDENCE) {
    recs.push({
      type: "INSURANCE_ADJUSTMENT",
      title: "Low confidence in insurance quote",
      explanation: `Insurance quote confidence: ${(insurance.confidenceScore * 100).toFixed(0)}%. Insufficient data for accurate premium calculation. Manual review of coverage terms is recommended.`,
      reasonCodes: ["LOW_CONFIDENCE_QUOTE"],
      confidence: 0.6,
      urgency: "MEDIUM",
      expectedDelayImpactDays: null,
      expectedMarginImpactPct: null,
      expectedRiskReduction: null,
      recommendedAction:
        "Request manual insurance quote from underwriter for this shipment.",
      sourceAgent: "decision-engine",
    });
  }
}

function analyzeExceptions(inputs: AnalysisInputs, recs: RecommendationInput[]): void {
  const { exceptions } = inputs;
  if (!exceptions.length) return;

  const openCritical = exceptions.filter(
    (e) => e.severity === "CRITICAL" && e.status === "OPEN",
  );
  const openHigh = exceptions.filter(
    (e) => e.severity === "HIGH" && e.status === "OPEN",
  );

  if (openCritical.length > 0) {
    recs.push({
      type: "DOCUMENT_CORRECTION",
      title: `${openCritical.length} critical exception(s) require immediate attention`,
      explanation: `Critical exceptions: ${openCritical.map((e) => e.title).join("; ")}. These must be resolved before the shipment can proceed.`,
      reasonCodes: openCritical.map((e) => e.exceptionType),
      confidence: 0.95,
      urgency: "CRITICAL",
      expectedDelayImpactDays: 3,
      expectedMarginImpactPct: null,
      expectedRiskReduction: null,
      recommendedAction:
        "Resolve all critical exceptions. Check document accuracy and data consistency.",
      sourceAgent: "decision-engine",
    });
  }

  if (openHigh.length > 0 && openCritical.length === 0) {
    recs.push({
      type: "DOCUMENT_CORRECTION",
      title: `${openHigh.length} high-severity exception(s) detected`,
      explanation: `High-severity issues: ${openHigh.map((e) => e.title).join("; ")}. Review and resolve before approval.`,
      reasonCodes: openHigh.map((e) => e.exceptionType),
      confidence: 0.85,
      urgency: "HIGH",
      expectedDelayImpactDays: 1,
      expectedMarginImpactPct: null,
      expectedRiskReduction: null,
      recommendedAction:
        "Review and resolve high-severity exceptions before approving the shipment.",
      sourceAgent: "decision-engine",
    });
  }
}

function analyzeTradeLane(inputs: AnalysisInputs, recs: RecommendationInput[]): void {
  const { tradeLane, intelligence } = inputs;
  if (!tradeLane) return;

  const congestionSignals = getRelevantSignals(intelligence, "port_congestion");
  const disruptionWeatherSignals = getRelevantSignals(intelligence, "disruption", "weather_risk");

  const hasCongestionIntel = intelligence ? intelligence.congestionScore >= INTEL_THRESHOLDS.CONGESTION_TRIGGER : false;
  const hasDisruptionIntel = intelligence ? (intelligence.disruptionScore >= INTEL_THRESHOLDS.DISRUPTION_TRIGGER || intelligence.weatherRiskScore >= INTEL_THRESHOLDS.WEATHER_TRIGGER) : false;

  const effectiveDelayFrequency = tradeLane.delayFrequency ?? 0;
  const lowerDelayThreshold = (hasCongestionIntel || hasDisruptionIntel)
    ? THRESHOLDS.TRADE_LANE_DELAY_FREQUENCY * 0.7
    : THRESHOLDS.TRADE_LANE_DELAY_FREQUENCY;

  if (effectiveDelayFrequency > lowerDelayThreshold) {
    const delayPct = (effectiveDelayFrequency * 100).toFixed(0);
    const allDelaySignals = [...congestionSignals, ...disruptionWeatherSignals];
    const intelNote = allDelaySignals.length > 0
      ? ` External intelligence shows ${allDelaySignals.length} active signal(s) reinforcing delay risk.`
      : "";

    const baseUrgency = effectiveDelayFrequency > THRESHOLDS.TRADE_LANE_DELAY_HIGH ? "HIGH" : "MEDIUM";
    const urgency = escalateUrgency(baseUrgency as "HIGH" | "MEDIUM", intelligence,
      intelligence?.congestionScore ?? 0, intelligence?.disruptionScore ?? 0, intelligence?.weatherRiskScore ?? 0);

    const rec: RecommendationInput = {
      type: "DELAY_WARNING",
      title: allDelaySignals.length > 0
        ? `High delay risk on ${tradeLane.origin} → ${tradeLane.destination} — external signals confirm`
        : `High delay frequency on ${tradeLane.origin} → ${tradeLane.destination}`,
      explanation: `Trade lane delay rate: ${delayPct}% across ${tradeLane.shipmentCount} historical shipments.${intelNote} Buffer time or alternative routing recommended.`,
      reasonCodes: [
        "HIGH_DELAY_FREQUENCY",
        "TRADE_LANE_RISK",
        ...(hasCongestionIntel ? ["CONGESTION_DELAY"] : []),
        ...(hasDisruptionIntel ? ["DISRUPTION_DELAY"] : []),
      ],
      confidence: allDelaySignals.length > 0 ? 0.85 : 0.75,
      urgency,
      expectedDelayImpactDays: tradeLane.avgTransitDays
        ? Math.ceil(tradeLane.avgTransitDays * effectiveDelayFrequency)
        : 2,
      expectedMarginImpactPct: -2,
      expectedRiskReduction: null,
      recommendedAction:
        "Add buffer days to delivery estimate. Consider alternative carriers or routing if available.",
      sourceAgent: "decision-engine",
    };
    recs.push(enrichRec(rec, intelligence, allDelaySignals));
  }

  const vesselSignals = getRelevantSignals(intelligence, "vessel_anomaly");
  const hasVesselIntel = intelligence ? intelligence.vesselRiskScore >= INTEL_THRESHOLDS.VESSEL_ANOMALY_TRIGGER : false;
  const effectiveCarrierThreshold = hasVesselIntel
    ? THRESHOLDS.CARRIER_PERFORMANCE_LOW + 10
    : THRESHOLDS.CARRIER_PERFORMANCE_LOW;

  if (
    tradeLane.carrierPerformanceScore !== null &&
    tradeLane.carrierPerformanceScore < effectiveCarrierThreshold
  ) {
    const allCarrierSignals = [...vesselSignals, ...disruptionWeatherSignals];
    const intelNote = allCarrierSignals.length > 0
      ? ` External intelligence shows vessel/lane issues reinforcing carrier switch consideration.`
      : "";

    const rec: RecommendationInput = {
      type: "CARRIER_SWITCH",
      title: allCarrierSignals.length > 0
        ? "Poor carrier performance with external risk signals"
        : "Poor carrier performance on this trade lane",
      explanation: `Carrier performance score on ${tradeLane.origin} → ${tradeLane.destination}: ${tradeLane.carrierPerformanceScore}/100.${intelNote} Historical data suggests reliability issues on this route.`,
      reasonCodes: [
        "LOW_CARRIER_PERFORMANCE",
        "LANE_CARRIER_MISMATCH",
        ...(hasVesselIntel ? ["VESSEL_ISSUE"] : []),
      ],
      confidence: allCarrierSignals.length > 0 ? 0.8 : 0.7,
      urgency: escalateUrgency("MEDIUM", intelligence, intelligence?.vesselRiskScore ?? 0, intelligence?.disruptionScore ?? 0),
      expectedDelayImpactDays: 2,
      expectedMarginImpactPct: null,
      expectedRiskReduction: 15,
      recommendedAction:
        "Consider switching to a higher-performing carrier for this trade lane.",
      sourceAgent: "decision-engine",
    };
    recs.push(enrichRec(rec, intelligence, allCarrierSignals));
  }
}

function analyzePricing(inputs: AnalysisInputs, recs: RecommendationInput[]): void {
  const { pricing, insurance } = inputs;
  if (!pricing) return;

  if (insurance && pricing.totalAmount > 0) {
    const insurancePct =
      (insurance.estimatedPremium / pricing.totalAmount) * 100;
    if (insurancePct > THRESHOLDS.INSURANCE_MARGIN_RATIO_PCT) {
      recs.push({
        type: "MARGIN_WARNING",
        title: "Insurance premium exceeds 15% of freight charges",
        explanation: `Insurance premium ($${insurance.estimatedPremium.toFixed(2)}) represents ${insurancePct.toFixed(1)}% of total freight charges ($${pricing.totalAmount.toFixed(2)}). This may significantly impact profit margins.`,
        reasonCodes: ["HIGH_INSURANCE_RATIO", "MARGIN_PRESSURE"],
        confidence: 0.8,
        urgency: "MEDIUM",
        expectedDelayImpactDays: null,
        expectedMarginImpactPct: -insurancePct,
        expectedRiskReduction: null,
        recommendedAction:
          "Review insurance terms. Consider negotiating premium or adjusting coverage level.",
        sourceAgent: "decision-engine",
      });
    }
  }
}

function analyzeDelayRisk(inputs: AnalysisInputs, recs: RecommendationInput[]): void {
  const { shipment, intelligence } = inputs;

  const congestionDisruptionSignals = getRelevantSignals(intelligence, "port_congestion", "disruption", "weather_risk", "vessel_anomaly");

  if (shipment.etd && shipment.eta) {
    const now = new Date();
    const eta = new Date(shipment.eta);
    const etd = new Date(shipment.etd);

    if (etd < now && shipment.status === "DRAFT") {
      const daysOverdue = Math.ceil(
        (now.getTime() - etd.getTime()) / (1000 * 60 * 60 * 24),
      );
      recs.push({
        type: "DELAY_WARNING",
        title: "ETD has passed but shipment is still in draft",
        explanation: `Estimated departure was ${daysOverdue} day(s) ago but the shipment is still in DRAFT status. Immediate attention required.`,
        reasonCodes: ["ETD_PASSED", "DRAFT_OVERDUE"],
        confidence: 0.95,
        urgency: "CRITICAL",
        expectedDelayImpactDays: daysOverdue,
        expectedMarginImpactPct: null,
        expectedRiskReduction: null,
        recommendedAction:
          "Review and approve shipment immediately, or update ETD to reflect actual departure schedule.",
        sourceAgent: "decision-engine",
      });
    }

    const transitDays = Math.ceil(
      (eta.getTime() - etd.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (transitDays > THRESHOLDS.TRANSIT_DAYS_UNUSUALLY_LONG) {
      const allSignals = congestionDisruptionSignals;
      const intelNote = allSignals.length > 0
        ? ` External intelligence shows ${allSignals.length} active signal(s) on this route.`
        : "";

      const rec: RecommendationInput = {
        type: "ROUTE_ADJUSTMENT",
        title: allSignals.length > 0
          ? "Long transit time with active route disruptions"
          : "Unusually long transit time detected",
        explanation: `Planned transit time: ${transitDays} days (ETD to ETA).${intelNote} This is unusually long and may indicate routing inefficiency or data entry errors.`,
        reasonCodes: [
          "LONG_TRANSIT_TIME",
          ...(allSignals.length > 0 ? ["EXTERNAL_ROUTE_DISRUPTION"] : []),
        ],
        confidence: allSignals.length > 0 ? 0.75 : 0.6,
        urgency: escalateUrgency("LOW", intelligence, intelligence?.disruptionScore ?? 0, intelligence?.congestionScore ?? 0),
        expectedDelayImpactDays: null,
        expectedMarginImpactPct: null,
        expectedRiskReduction: null,
        recommendedAction:
          "Verify ETD/ETA dates. Consider whether a more direct route is available.",
        sourceAgent: "decision-engine",
      };
      recs.push(enrichRec(rec, intelligence, allSignals));
    }
  }

  if (!shipment.etd && !shipment.eta && congestionDisruptionSignals.length > 0) {
    const hasHighCongestion = intelligence && intelligence.congestionScore >= INTEL_THRESHOLDS.CONGESTION_TRIGGER;
    const hasDisruption = intelligence && intelligence.disruptionScore >= INTEL_THRESHOLDS.DISRUPTION_TRIGGER;
    const hasWeather = intelligence && intelligence.weatherRiskScore >= INTEL_THRESHOLDS.WEATHER_TRIGGER;

    if (hasHighCongestion || hasDisruption || hasWeather) {
      const rec: RecommendationInput = {
        type: "ROUTE_ADJUSTMENT",
        title: "External intelligence suggests route review",
        explanation: `Active intelligence signals on shipment ports/lane: ${congestionDisruptionSignals.map((s) => s.summary).join("; ")}. Consider route alternatives.`,
        reasonCodes: [
          ...(hasHighCongestion ? ["PORT_CONGESTION"] : []),
          ...(hasDisruption ? ["LANE_DISRUPTION"] : []),
          ...(hasWeather ? ["WEATHER_RISK"] : []),
        ],
        confidence: 0.7,
        urgency: escalateUrgency("MEDIUM", intelligence, intelligence?.disruptionScore ?? 0, intelligence?.congestionScore ?? 0, intelligence?.weatherRiskScore ?? 0),
        expectedDelayImpactDays: intelligence?.disruptionScore ? Math.ceil(intelligence.disruptionScore / 20) : 2,
        expectedMarginImpactPct: null,
        expectedRiskReduction: null,
        recommendedAction:
          "Review route options. Consider alternative ports or carriers to avoid known disruptions.",
        sourceAgent: "decision-engine",
      };
      recs.push(enrichRec(rec, intelligence, congestionDisruptionSignals));
    }
  }
}

function analyzePricingAlert(inputs: AnalysisInputs, recs: RecommendationInput[]): void {
  const { intelligence, pricing, shipment } = inputs;
  if (!intelligence) return;

  const marketSignals = getRelevantSignals(intelligence, "market_signal");
  const congestionSignals = getRelevantSignals(intelligence, "port_congestion");

  const hasMarketPressure = intelligence.marketPressureScore >= INTEL_THRESHOLDS.MARKET_PRESSURE_TRIGGER;
  const hasCongestionSurcharge = intelligence.congestionScore >= INTEL_THRESHOLDS.PRICING_CONGESTION_SURCHARGE_TRIGGER;
  const hasDisruptionPremium = intelligence.disruptionScore >= INTEL_THRESHOLDS.DISRUPTION_TRIGGER;

  if (!hasMarketPressure && !hasCongestionSurcharge && !hasDisruptionPremium) return;

  const factors: string[] = [];
  const reasonCodes: string[] = ["PRICING_INTELLIGENCE"];
  const allSignals: SignalDetail[] = [];

  if (hasMarketPressure) {
    factors.push(`Market rate pressure score: ${intelligence.marketPressureScore}/100`);
    reasonCodes.push("MARKET_RATE_PRESSURE");
    allSignals.push(...marketSignals);
  }

  if (hasCongestionSurcharge) {
    factors.push(`Port congestion (score ${intelligence.congestionScore}/100) may trigger surcharges`);
    reasonCodes.push("CONGESTION_SURCHARGE_RISK");
    allSignals.push(...congestionSignals);
  }

  if (hasDisruptionPremium) {
    const disruptionSignals = getRelevantSignals(intelligence, "disruption");
    factors.push(`Active disruptions (score ${intelligence.disruptionScore}/100) may increase costs`);
    reasonCodes.push("DISRUPTION_PREMIUM_RISK");
    allSignals.push(...disruptionSignals);
  }

  const lane = shipment.portOfLoading && shipment.portOfDischarge
    ? `${shipment.portOfLoading} → ${shipment.portOfDischarge}`
    : "this trade lane";

  const estimatedImpactPct = -(
    (hasMarketPressure ? intelligence.marketPressureScore * 0.1 : 0) +
    (hasCongestionSurcharge ? (intelligence.congestionScore - 50) * 0.08 : 0) +
    (hasDisruptionPremium ? intelligence.disruptionScore * 0.06 : 0)
  );

  const urgency = intelligence.marketPressureScore >= INTEL_THRESHOLDS.MARKET_PRESSURE_HIGH
    ? "HIGH"
    : "MEDIUM";

  const rec: RecommendationInput = {
    type: "PRICING_ALERT",
    title: `Pricing pressure detected on ${lane}`,
    explanation: `External intelligence indicates pricing risk: ${factors.join(". ")}. ${pricing ? `Current total charges: $${pricing.totalAmount.toFixed(2)}.` : ""} Review pricing before commitment.`,
    reasonCodes,
    confidence: Math.min(0.9, 0.6 + allSignals.length * 0.05),
    urgency: urgency as "MEDIUM" | "HIGH",
    expectedDelayImpactDays: null,
    expectedMarginImpactPct: Math.round(estimatedImpactPct * 10) / 10,
    expectedRiskReduction: null,
    recommendedAction:
      "Review and adjust pricing. Consider rate locks, surcharge buffers, or alternative routing to mitigate cost increases.",
    sourceAgent: "decision-engine",
    intelligenceEnriched: true,
  };
  recs.push(enrichRec(rec, intelligence, allSignals));
}
