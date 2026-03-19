export type DecisionStatus = "APPROVED" | "BLOCKED" | "REJECTED" | "REVIEW";

export interface DecisionInput {
  shipmentStatus: string;
  complianceStatus: string | null;
  complianceMatchCount: number;
  docValidationStatus: string | null;
  docReadinessLevel: string | null;
  baseRiskScore: number | null;
  baseRiskLevel: string | null;
  dynamicRiskScore: number | null;
  dynamicRiskLevel: string | null;
  readinessScore: number | null;
  gateHoldsCount: number;
  activeHolds: string[];
}

export interface DecisionOutput {
  finalStatus: DecisionStatus;
  releaseAllowed: boolean;
  decisionReason: string;
  unifiedRisk: {
    baseScore: number;
    dynamicScore: number;
    finalScore: number;
    level: string;
  };
  blockReasons: string[];
  reviewReasons: string[];
}

const RISK_THRESHOLD_BLOCK = 80;
const RISK_THRESHOLD_REVIEW = 50;
const READINESS_THRESHOLD = 40;

function riskLevel(score: number): string {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MODERATE";
  return "LOW";
}

function normalizeRiskTo100(score: number | null): number {
  if (score == null) return 0;
  const normalized = score <= 1 ? score * 100 : score;
  return Math.round(Math.min(Math.max(normalized, 0), 100));
}

export function computeDecision(input: DecisionInput): DecisionOutput {
  const blockReasons: string[] = [];
  const reviewReasons: string[] = [];

  const baseScore = normalizeRiskTo100(input.baseRiskScore);
  const dynamicScore = normalizeRiskTo100(input.dynamicRiskScore);
  const finalRiskScore = Math.max(baseScore, dynamicScore);
  const finalRiskLevel = riskLevel(finalRiskScore);

  const unifiedRisk = {
    baseScore,
    dynamicScore,
    finalScore: finalRiskScore,
    level: finalRiskLevel,
  };

  if (input.complianceStatus === "BLOCKED") {
    blockReasons.push("Compliance screening returned BLOCKED status — sanctions or restricted party match detected.");
  }
  if (input.complianceStatus === "UNAVAILABLE") {
    reviewReasons.push("Compliance data unavailable — cannot confirm screening status.");
  }

  if (input.docValidationStatus === "BLOCKED") {
    blockReasons.push("Document validation is BLOCKED — critical documents are missing or invalid.");
  }
  if (input.docValidationStatus === "UNAVAILABLE") {
    reviewReasons.push("Document validation data unavailable — cannot confirm documentation status.");
  }

  if (input.docReadinessLevel === "INSUFFICIENT" && input.docValidationStatus !== "READY") {
    blockReasons.push("Document readiness is INSUFFICIENT — shipment cannot proceed without required documentation.");
  }

  if (finalRiskScore >= RISK_THRESHOLD_BLOCK) {
    blockReasons.push(`Final risk score (${finalRiskScore}) exceeds blocking threshold (${RISK_THRESHOLD_BLOCK}).`);
  }

  if (input.activeHolds.length > 0) {
    const criticalHolds = input.activeHolds.filter(
      (h) => h === "COMPLIANCE_BLOCK" || h === "MANAGER_APPROVAL",
    );
    if (criticalHolds.length > 0) {
      blockReasons.push(`Critical gate holds active: ${criticalHolds.join(", ")}.`);
    } else {
      reviewReasons.push(`Active gate holds require review: ${input.activeHolds.join(", ")}.`);
    }
  }

  const terminalStatuses = ["CANCELLED", "CLOSED", "DELIVERED"];
  if (terminalStatuses.includes(input.shipmentStatus)) {
    return {
      finalStatus: input.shipmentStatus === "CANCELLED" ? "REJECTED" : "APPROVED",
      releaseAllowed: false,
      decisionReason: `Shipment is in terminal status: ${input.shipmentStatus}. No further decisions applicable.`,
      unifiedRisk,
      blockReasons: [],
      reviewReasons: [],
    };
  }

  if (blockReasons.length > 0) {
    return {
      finalStatus: "BLOCKED",
      releaseAllowed: false,
      decisionReason: blockReasons[0],
      unifiedRisk,
      blockReasons,
      reviewReasons,
    };
  }

  if (input.complianceStatus === "ALERT") {
    reviewReasons.push("Compliance screening returned ALERT — potential matches require manual review.");
  }

  if (input.docValidationStatus === "REVIEW") {
    reviewReasons.push("Document validation requires review — some documents need corrections.");
  }

  if (finalRiskScore >= RISK_THRESHOLD_REVIEW) {
    reviewReasons.push(`Final risk score (${finalRiskScore}) exceeds review threshold (${RISK_THRESHOLD_REVIEW}).`);
  }

  const readinessPercent = normalizeRiskTo100(input.readinessScore);
  if (readinessPercent > 0 && readinessPercent < READINESS_THRESHOLD) {
    reviewReasons.push(`Readiness score (${readinessPercent}%) is below minimum threshold (${READINESS_THRESHOLD}%).`);
  }

  if (reviewReasons.length > 0) {
    return {
      finalStatus: "REVIEW",
      releaseAllowed: false,
      decisionReason: reviewReasons[0],
      unifiedRisk,
      blockReasons,
      reviewReasons,
    };
  }

  return {
    finalStatus: "APPROVED",
    releaseAllowed: true,
    decisionReason: "All checks passed — shipment is clear for release.",
    unifiedRisk,
    blockReasons: [],
    reviewReasons: [],
  };
}
