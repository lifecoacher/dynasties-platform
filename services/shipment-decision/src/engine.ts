import { z } from "zod";

export type DecisionStatus = "APPROVED" | "BLOCKED" | "REJECTED" | "REVIEW" | "INCOMPLETE";

export const DecisionInputSchema = z.object({
  shipmentStatus: z.string(),
  complianceStatus: z.string().nullable(),
  complianceMatchCount: z.number().int().min(0),
  docValidationStatus: z.string().nullable(),
  docReadinessLevel: z.string().nullable(),
  baseRiskScore: z.number().nullable(),
  baseRiskLevel: z.string().nullable(),
  dynamicRiskScore: z.number().nullable(),
  dynamicRiskLevel: z.string().nullable(),
  readinessScore: z.number().nullable(),
  gateHoldsCount: z.number().int().min(0),
  activeHolds: z.array(z.string()),
});

export type DecisionInput = z.infer<typeof DecisionInputSchema>;

export const DecisionOutputSchema = z.object({
  finalStatus: z.enum(["APPROVED", "BLOCKED", "REJECTED", "REVIEW", "INCOMPLETE"]),
  releaseAllowed: z.boolean(),
  decisionReason: z.string(),
  unifiedRisk: z.object({
    baseScore: z.number(),
    dynamicScore: z.number(),
    finalScore: z.number(),
    level: z.string(),
  }),
  blockReasons: z.array(z.string()),
  reviewReasons: z.array(z.string()),
});

export type DecisionOutput = z.infer<typeof DecisionOutputSchema>;

const RISK_THRESHOLD_BLOCK = 70;
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

export function computeDecision(rawInput: DecisionInput): DecisionOutput {
  const input = DecisionInputSchema.parse(rawInput);
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

  const terminalStatuses = ["CANCELLED", "CLOSED", "DELIVERED"];
  if (terminalStatuses.includes(input.shipmentStatus)) {
    const terminalStatus: DecisionStatus = input.shipmentStatus === "CANCELLED" ? "REJECTED" : "APPROVED";
    return enforceInvariants({
      finalStatus: terminalStatus,
      releaseAllowed: terminalStatus === "APPROVED",
      decisionReason: `Shipment is in terminal status: ${input.shipmentStatus}. No further decisions applicable.`,
      unifiedRisk,
      blockReasons: [],
      reviewReasons: [],
    });
  }

  const missingChecks: string[] = [];
  if (input.complianceStatus === null || input.complianceStatus === "NOT_RUN") {
    missingChecks.push("Compliance screening has not been executed. Run compliance screening before a decision can be made.");
  }
  if (input.docValidationStatus === null || input.docValidationStatus === "NOT_RUN") {
    missingChecks.push("Document validation has not been completed. Run document validation before a decision can be made.");
  }
  if (input.baseRiskScore === null && input.dynamicRiskScore === null) {
    missingChecks.push("Risk assessment has not been computed. Run risk scoring before a decision can be made.");
  }

  if (missingChecks.length > 0) {
    return enforceInvariants({
      finalStatus: "INCOMPLETE",
      releaseAllowed: false,
      decisionReason: "Required checks not completed. " + missingChecks[0],
      unifiedRisk,
      blockReasons: [],
      reviewReasons: missingChecks,
    });
  }

  if (input.complianceStatus === "BLOCKED") {
    blockReasons.push("A sanctions or restricted-party match was detected during compliance screening. Resolve or escalate the compliance finding before this shipment can proceed.");
  }

  if (input.complianceStatus === "UNAVAILABLE") {
    reviewReasons.push("Compliance screening encountered an error and could not complete. Re-run compliance screening or escalate to resolve.");
  }

  if (input.complianceStatus === "INCOMPLETE") {
    reviewReasons.push("Compliance screening is incomplete — not all parties were screened. Ensure all shipment parties are available and re-run screening.");
  }

  if (input.docValidationStatus === "BLOCKED") {
    blockReasons.push("Critical documents are missing or invalid. Upload or correct the required documents before this shipment can proceed.");
  }

  if (input.docValidationStatus === "UNAVAILABLE") {
    reviewReasons.push("Document validation encountered an error and could not complete. Re-run document validation or escalate to resolve.");
  }

  if (input.docReadinessLevel === "INSUFFICIENT" && input.docValidationStatus !== "READY") {
    blockReasons.push("Document readiness is insufficient — the shipment cannot proceed without the required documentation. Upload missing documents.");
  }

  if (finalRiskScore >= RISK_THRESHOLD_BLOCK) {
    blockReasons.push(`Risk score is ${finalRiskScore} (threshold: ${RISK_THRESHOLD_BLOCK}). This shipment has been flagged as high-risk. Review risk factors and escalate if needed.`);
  }

  if (input.activeHolds.length > 0) {
    const criticalHolds = input.activeHolds.filter(
      (h) => h === "COMPLIANCE_BLOCK" || h === "MANAGER_APPROVAL",
    );
    if (criticalHolds.length > 0) {
      const holdDescriptions = criticalHolds.map(h =>
        h === "COMPLIANCE_BLOCK" ? "compliance block" : "manager approval required"
      );
      blockReasons.push(`This shipment has active holds that must be resolved: ${holdDescriptions.join(", ")}. Clear these holds before proceeding.`);
    } else {
      const holdDescriptions = input.activeHolds.map(h =>
        h.toLowerCase().replace(/_/g, " ")
      );
      reviewReasons.push(`This shipment has active holds requiring review: ${holdDescriptions.join(", ")}. Review and resolve before approving.`);
    }
  }

  if (blockReasons.length > 0) {
    return enforceInvariants({
      finalStatus: "BLOCKED",
      releaseAllowed: false,
      decisionReason: blockReasons[0],
      unifiedRisk,
      blockReasons,
      reviewReasons,
    });
  }

  if (input.complianceStatus === "ALERT") {
    reviewReasons.push("Compliance screening found potential matches that require manual review. Investigate the flagged parties before approving.");
  }

  if (input.docValidationStatus === "REVIEW") {
    reviewReasons.push("Some documents need corrections or additional review. Address the flagged issues before approving.");
  }

  if (finalRiskScore >= RISK_THRESHOLD_REVIEW) {
    reviewReasons.push(`Risk score is ${finalRiskScore} (review threshold: ${RISK_THRESHOLD_REVIEW}). Review the risk factors before approving this shipment.`);
  }

  const readinessPercent = normalizeRiskTo100(input.readinessScore);
  if (readinessPercent > 0 && readinessPercent < READINESS_THRESHOLD) {
    reviewReasons.push(`Shipment readiness is ${readinessPercent}% (minimum: ${READINESS_THRESHOLD}%). Address outstanding items before approving.`);
  }

  if (reviewReasons.length > 0) {
    return enforceInvariants({
      finalStatus: "REVIEW",
      releaseAllowed: false,
      decisionReason: reviewReasons[0],
      unifiedRisk,
      blockReasons,
      reviewReasons,
    });
  }

  if (input.complianceStatus !== "CLEAR") {
    return enforceInvariants({
      finalStatus: "REVIEW",
      releaseAllowed: false,
      decisionReason: `Compliance status is "${input.complianceStatus}" — only fully clear compliance allows automatic approval. Review compliance results.`,
      unifiedRisk,
      blockReasons,
      reviewReasons: [`Compliance status "${input.complianceStatus}" does not meet the requirement for automatic approval.`],
    });
  }

  if (input.docValidationStatus !== "READY") {
    return enforceInvariants({
      finalStatus: "REVIEW",
      releaseAllowed: false,
      decisionReason: `Document validation status is "${input.docValidationStatus}" — only fully ready documents allow automatic approval. Review document status.`,
      unifiedRisk,
      blockReasons,
      reviewReasons: [`Document validation status "${input.docValidationStatus}" does not meet the requirement for automatic approval.`],
    });
  }

  return enforceInvariants({
    finalStatus: "APPROVED",
    releaseAllowed: true,
    decisionReason: "All checks passed — compliance is clear, documents are ready, and risk is within acceptable limits. Shipment is clear for release.",
    unifiedRisk,
    blockReasons: [],
    reviewReasons: [],
  });
}

function enforceInvariants(output: DecisionOutput): DecisionOutput {
  if (output.finalStatus === "APPROVED" && !output.releaseAllowed) {
    console.error(`[decision-engine] INVARIANT VIOLATION: APPROVED with releaseAllowed=false. Downgrading to REVIEW.`);
    output.finalStatus = "REVIEW";
    output.reviewReasons.push("Safety check: approval state was inconsistent. Defaulting to manual review for safety.");
  }

  if (output.finalStatus === "BLOCKED" && output.releaseAllowed) {
    console.error(`[decision-engine] INVARIANT VIOLATION: BLOCKED with releaseAllowed=true. Blocking release.`);
    output.releaseAllowed = false;
  }

  if (output.finalStatus === "INCOMPLETE" && output.releaseAllowed) {
    console.error(`[decision-engine] INVARIANT VIOLATION: INCOMPLETE with releaseAllowed=true. Blocking release.`);
    output.releaseAllowed = false;
  }

  if (output.finalStatus !== "APPROVED" && output.releaseAllowed) {
    console.error(`[decision-engine] INVARIANT VIOLATION: ${output.finalStatus} with releaseAllowed=true. Blocking release.`);
    output.releaseAllowed = false;
  }

  return output;
}
