import { z } from "zod";
import { createHash } from "node:crypto";
import { THRESHOLDS } from "./config.js";

export const RECOMMENDATION_TYPES = [
  "CARRIER_SWITCH",
  "ROUTE_ADJUSTMENT",
  "INSURANCE_ADJUSTMENT",
  "COMPLIANCE_ESCALATION",
  "DELAY_WARNING",
  "MARGIN_WARNING",
  "DOCUMENT_CORRECTION",
  "RISK_MITIGATION",
] as const;

export const recommendationSchema = z.object({
  type: z.enum(RECOMMENDATION_TYPES),
  title: z.string().min(1),
  explanation: z.string().min(1),
  reasonCodes: z.array(z.string()).min(1),
  confidence: z.number().min(0).max(1),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  expectedDelayImpactDays: z.number().nullable().optional(),
  expectedMarginImpactPct: z.number().nullable().optional(),
  expectedRiskReduction: z.number().nullable().optional(),
  recommendedAction: z.string().min(1),
  sourceAgent: z.string(),
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

  return recs;
}

function analyzeCompliance(inputs: AnalysisInputs, recs: RecommendationInput[]): void {
  const { compliance } = inputs;
  if (!compliance) return;

  if (compliance.status === "BLOCKED") {
    recs.push({
      type: "COMPLIANCE_ESCALATION",
      title: "Shipment blocked by compliance screening",
      explanation:
        "This shipment has been flagged by the compliance screening system with a BLOCKED status. Immediate escalation is required before any further processing can occur.",
      reasonCodes: ["COMPLIANCE_BLOCKED", "SANCTIONS_MATCH"],
      confidence: 0.95,
      urgency: "CRITICAL",
      expectedDelayImpactDays: 5,
      expectedMarginImpactPct: null,
      expectedRiskReduction: null,
      recommendedAction:
        "Escalate to compliance officer immediately. Do not approve shipment until sanctions match is resolved.",
      sourceAgent: "decision-engine",
    });
  } else if (compliance.status === "ALERT") {
    recs.push({
      type: "COMPLIANCE_ESCALATION",
      title: "Compliance alert requires review",
      explanation:
        "The compliance screening returned potential matches that need manual review. The shipment can proceed only after a compliance officer verifies the screening results.",
      reasonCodes: ["COMPLIANCE_ALERT", "POTENTIAL_MATCH"],
      confidence: 0.8,
      urgency: "HIGH",
      expectedDelayImpactDays: 2,
      expectedMarginImpactPct: null,
      expectedRiskReduction: null,
      recommendedAction:
        "Review compliance screening results and verify entity identities before approval.",
      sourceAgent: "decision-engine",
    });
  }
}

function analyzeRisk(inputs: AnalysisInputs, recs: RecommendationInput[]): void {
  const { risk } = inputs;
  if (!risk) return;

  if (risk.compositeScore >= THRESHOLDS.RISK_HIGH) {
    const factors = risk.primaryRiskFactors.map((f) => f.explanation).join(" ");
    recs.push({
      type: "RISK_MITIGATION",
      title: "High-risk shipment requires mitigation",
      explanation: `Composite risk score: ${risk.compositeScore}/100. ${factors} Consider alternative routing or enhanced insurance coverage.`,
      reasonCodes: [
        "HIGH_RISK_SCORE",
        ...risk.primaryRiskFactors.map((f) => f.factor.toUpperCase().replace(/\s+/g, "_")),
      ],
      confidence: 0.85,
      urgency: "HIGH",
      expectedDelayImpactDays: null,
      expectedMarginImpactPct: -5,
      expectedRiskReduction: 20,
      recommendedAction:
        risk.recommendedAction ||
        "Review risk factors and consider route adjustment or additional insurance.",
      sourceAgent: "decision-engine",
    });
  } else if (risk.compositeScore >= THRESHOLDS.RISK_MODERATE) {
    recs.push({
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
    });
  }
}

function analyzeInsurance(inputs: AnalysisInputs, recs: RecommendationInput[]): void {
  const { insurance, risk } = inputs;
  if (!insurance || !risk) return;

  if (
    risk.compositeScore >= THRESHOLDS.RISK_INSURANCE_MISMATCH &&
    insurance.coverageType === "TOTAL_LOSS"
  ) {
    recs.push({
      type: "INSURANCE_ADJUSTMENT",
      title: "Upgrade insurance coverage for high-risk shipment",
      explanation: `Current coverage is TOTAL_LOSS only, but the risk score is ${risk.compositeScore}/100. ALL_RISK coverage is recommended to protect against partial losses.`,
      reasonCodes: ["INSUFFICIENT_COVERAGE", "HIGH_RISK_MISMATCH"],
      confidence: 0.8,
      urgency: "HIGH",
      expectedDelayImpactDays: null,
      expectedMarginImpactPct: -3,
      expectedRiskReduction: 30,
      recommendedAction:
        "Upgrade insurance coverage from TOTAL_LOSS to ALL_RISK before shipment departure.",
      sourceAgent: "decision-engine",
    });
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
  const { tradeLane } = inputs;
  if (!tradeLane) return;

  if (
    tradeLane.delayFrequency !== null &&
    tradeLane.delayFrequency > THRESHOLDS.TRADE_LANE_DELAY_FREQUENCY
  ) {
    const delayPct = (tradeLane.delayFrequency * 100).toFixed(0);
    recs.push({
      type: "DELAY_WARNING",
      title: `High delay frequency on ${tradeLane.origin} → ${tradeLane.destination}`,
      explanation: `Trade lane delay rate: ${delayPct}% across ${tradeLane.shipmentCount} historical shipments. Buffer time or alternative routing recommended.`,
      reasonCodes: ["HIGH_DELAY_FREQUENCY", "TRADE_LANE_RISK"],
      confidence: 0.75,
      urgency:
        tradeLane.delayFrequency > THRESHOLDS.TRADE_LANE_DELAY_HIGH ? "HIGH" : "MEDIUM",
      expectedDelayImpactDays: tradeLane.avgTransitDays
        ? Math.ceil(tradeLane.avgTransitDays * tradeLane.delayFrequency)
        : 2,
      expectedMarginImpactPct: -2,
      expectedRiskReduction: null,
      recommendedAction:
        "Add buffer days to delivery estimate. Consider alternative carriers or routing if available.",
      sourceAgent: "decision-engine",
    });
  }

  if (
    tradeLane.carrierPerformanceScore !== null &&
    tradeLane.carrierPerformanceScore < THRESHOLDS.CARRIER_PERFORMANCE_LOW
  ) {
    recs.push({
      type: "CARRIER_SWITCH",
      title: "Poor carrier performance on this trade lane",
      explanation: `Carrier performance score on ${tradeLane.origin} → ${tradeLane.destination}: ${tradeLane.carrierPerformanceScore}/100. Historical data suggests reliability issues on this route.`,
      reasonCodes: ["LOW_CARRIER_PERFORMANCE", "LANE_CARRIER_MISMATCH"],
      confidence: 0.7,
      urgency: "MEDIUM",
      expectedDelayImpactDays: 2,
      expectedMarginImpactPct: null,
      expectedRiskReduction: 15,
      recommendedAction:
        "Consider switching to a higher-performing carrier for this trade lane.",
      sourceAgent: "decision-engine",
    });
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
  const { shipment } = inputs;
  if (!shipment.eta || !shipment.etd) return;

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
    recs.push({
      type: "ROUTE_ADJUSTMENT",
      title: "Unusually long transit time detected",
      explanation: `Planned transit time: ${transitDays} days (ETD to ETA). This is unusually long and may indicate routing inefficiency or data entry errors.`,
      reasonCodes: ["LONG_TRANSIT_TIME"],
      confidence: 0.6,
      urgency: "LOW",
      expectedDelayImpactDays: null,
      expectedMarginImpactPct: null,
      expectedRiskReduction: null,
      recommendedAction:
        "Verify ETD/ETA dates. Consider whether a more direct route is available.",
      sourceAgent: "decision-engine",
    });
  }
}
