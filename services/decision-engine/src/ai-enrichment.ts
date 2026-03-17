import { z } from "zod";
import { callAI, persistUsageLog } from "@workspace/integrations-anthropic-ai";
import type { AnalysisInputs, RecommendationInput } from "./analyzer.js";
import type { IntelligenceSummary } from "./intelligence-summary.js";

const aiRecommendationSchema = z.object({
  recommendations: z.array(
    z.object({
      type: z.string(),
      title: z.string().min(1),
      explanation: z.string().min(10),
      urgency: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
      confidence: z.number().min(0).max(1),
      recommendedAction: z.string().min(1),
      riskFactors: z.array(z.string()).optional(),
      expectedImpact: z.string().optional(),
    }),
  ),
  overallAssessment: z.string().min(10),
  riskNarrative: z.string().optional(),
});

export type AIRecommendationOutput = z.infer<typeof aiRecommendationSchema>;

function buildShipmentPrompt(inputs: AnalysisInputs): string {
  const { shipment, compliance, risk, insurance, exceptions, tradeLane, pricing, intelligence } = inputs;

  let prompt = `SHIPMENT CONTEXT:
- ID: ${shipment.shipmentId}
- Status: ${shipment.status}
- Commodity: ${shipment.commodity || "Unknown"}
- HS Code: ${shipment.hsCode || "N/A"}
- Route: ${shipment.portOfLoading || "?"} → ${shipment.portOfDischarge || "?"}
- Vessel: ${shipment.vessel || "Not assigned"}
- ETD: ${shipment.etd ? new Date(shipment.etd).toISOString().split("T")[0] : "N/A"}
- ETA: ${shipment.eta ? new Date(shipment.eta).toISOString().split("T")[0] : "N/A"}
- Weight: ${shipment.grossWeight ? `${shipment.grossWeight} kg` : "N/A"}`;

  if (compliance) {
    prompt += `\n\nCOMPLIANCE:
- Status: ${compliance.status}
- Matches: ${compliance.matches ? JSON.stringify(compliance.matches) : "None"}`;
  }

  if (risk) {
    prompt += `\n\nRISK ASSESSMENT:
- Composite Score: ${risk.compositeScore}/100
- Sub-Scores: ${JSON.stringify(risk.subScores)}
- Primary Factors: ${risk.primaryRiskFactors.map((f) => `${f.factor}: ${f.explanation}`).join("; ")}
- Recommended Action: ${risk.recommendedAction}`;
  }

  if (insurance) {
    prompt += `\n\nINSURANCE:
- Coverage: ${insurance.coverageType}
- Premium: $${insurance.estimatedPremium.toFixed(2)}
- Confidence: ${(insurance.confidenceScore * 100).toFixed(0)}%`;
  }

  if (exceptions.length > 0) {
    prompt += `\n\nEXCEPTIONS (${exceptions.length}):
${exceptions.map((e) => `- [${e.severity}] ${e.title} (${e.status})`).join("\n")}`;
  }

  if (tradeLane) {
    prompt += `\n\nTRADE LANE:
- Route: ${tradeLane.origin} → ${tradeLane.destination}
- Historical Shipments: ${tradeLane.shipmentCount}
- Delay Rate: ${tradeLane.delayFrequency ? `${(tradeLane.delayFrequency * 100).toFixed(0)}%` : "N/A"}
- Carrier Performance: ${tradeLane.carrierPerformanceScore ?? "N/A"}/100
- Avg Transit: ${tradeLane.avgTransitDays ?? "N/A"} days`;
  }

  if (pricing) {
    prompt += `\n\nPRICING:
- Total Freight: $${pricing.totalAmount.toFixed(2)}
- Charge Count: ${pricing.chargeCount}`;
  }

  if (intelligence) {
    prompt += `\n\nEXTERNAL INTELLIGENCE:
- Composite Score: ${intelligence.compositeIntelScore}/100
- Congestion: ${intelligence.congestionScore}/100
- Disruption: ${intelligence.disruptionScore}/100
- Weather Risk: ${intelligence.weatherRiskScore}/100
- Sanctions Risk: ${intelligence.sanctionsRiskScore}/100
- Vessel Risk: ${intelligence.vesselRiskScore}/100
- Active Signals: ${intelligence.signals.length}`;

    if (intelligence.signals.length > 0) {
      prompt += `\n- Signal Details:\n${intelligence.signals
        .slice(0, 10)
        .map((s) => `  [${s.severity}] ${s.signalType}: ${s.summary}`)
        .join("\n")}`;
    }
  }

  return prompt;
}

const SYSTEM_PROMPT = `You are Dynasties AI, an expert freight forwarding and logistics analyst. You analyze shipment data, compliance status, risk scores, insurance coverage, trade lane performance, pricing, and external intelligence signals.

Your role:
1. Analyze the provided shipment data holistically
2. Generate actionable recommendations for logistics operators
3. Provide clear, specific explanations grounded in the data
4. Assess risk factors and suggest concrete mitigation strategies

Rules:
- Base all analysis on the provided data — never fabricate information
- Be specific about numbers, percentages, and thresholds
- Prioritize safety and compliance over cost optimization
- Consider the interplay between different risk factors
- Reference specific intelligence signals when relevant

Respond ONLY with a JSON object matching this schema:
{
  "recommendations": [
    {
      "type": one of CARRIER_SWITCH, ROUTE_ADJUSTMENT, INSURANCE_ADJUSTMENT, COMPLIANCE_ESCALATION, DELAY_WARNING, MARGIN_WARNING, DOCUMENT_CORRECTION, RISK_MITIGATION, PRICING_ALERT,
      "title": "short descriptive title",
      "explanation": "detailed explanation grounded in the data",
      "urgency": one of LOW, MEDIUM, HIGH, CRITICAL,
      "confidence": 0.0 to 1.0,
      "recommendedAction": "specific action steps",
      "riskFactors": ["list of contributing factors"],
      "expectedImpact": "description of expected outcome"
    }
  ],
  "overallAssessment": "2-3 sentence summary of the shipment's overall risk posture",
  "riskNarrative": "narrative explanation of how different risk factors interact"
}`;

export interface AIEnrichmentResult {
  aiRecommendations: AIRecommendationOutput | null;
  aiOverallAssessment: string | null;
  aiRiskNarrative: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
  status: "success" | "error" | "fallback";
  errorMessage?: string;
}

export async function enrichWithAI(
  inputs: AnalysisInputs,
  deterministicRecs: RecommendationInput[],
): Promise<AIEnrichmentResult> {
  const userMessage = buildShipmentPrompt(inputs);

  const recSummary = deterministicRecs.length > 0
    ? `\n\nDETERMINISTIC ANALYSIS RESULTS (${deterministicRecs.length} recommendations):\n${deterministicRecs.map((r) => `- [${r.urgency}] ${r.type}: ${r.title}`).join("\n")}\n\nPlease provide your independent analysis. You may confirm, expand on, or add to these findings.`
    : "\n\nNo deterministic recommendations were triggered. Analyze whether any risks or actions may have been missed.";

  const response = await callAI({
    taskType: "recommendation-enrichment",
    systemPrompt: SYSTEM_PROMPT,
    userMessage: userMessage + recSummary,
    structuredSchema: aiRecommendationSchema,
    maxTokens: 4096,
    temperature: 0.1,
    companyId: inputs.shipment.companyId,
  });

  await persistUsageLog(
    "recommendation-enrichment",
    response,
    inputs.shipment.companyId,
    {
      shipmentId: inputs.shipment.shipmentId,
      deterministicRecCount: deterministicRecs.length,
      validationPassed: response.validationPassed,
    },
  );

  if (response.status === "success" && response.parsedOutput) {
    const parsed = response.parsedOutput as AIRecommendationOutput;
    return {
      aiRecommendations: parsed,
      aiOverallAssessment: parsed.overallAssessment,
      aiRiskNarrative: parsed.riskNarrative ?? null,
      model: response.model,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      latencyMs: response.latencyMs,
      estimatedCostUsd: response.estimatedCostUsd ?? 0,
      status: "success",
    };
  }

  return {
    aiRecommendations: null,
    aiOverallAssessment: null,
    aiRiskNarrative: null,
    model: response.model,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
    latencyMs: response.latencyMs,
    estimatedCostUsd: response.estimatedCostUsd ?? 0,
    status: response.status === "error" ? "error" : "fallback",
    errorMessage: response.errorMessage,
  };
}

export { buildShipmentPrompt, SYSTEM_PROMPT, aiRecommendationSchema };
