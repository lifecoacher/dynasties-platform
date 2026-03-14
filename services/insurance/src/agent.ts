import { anthropic } from "@workspace/integrations-anthropic-ai";
import type { InsuranceCalculation } from "./calculator.js";

export interface InsuranceAgentInput {
  calculation: InsuranceCalculation;
  commodity: string | null;
  hsCode: string | null;
  portOfLoading: string | null;
  portOfDischarge: string | null;
  grossWeight: number | null;
  volume: number | null;
  incoterms: string | null;
}

export interface InsuranceAgentOutput {
  raw: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

const SYSTEM_PROMPT = `You are a cargo insurance agent for a freight forwarding company. Your job is to provide a coverage rationale and recommend appropriate exclusions for a marine cargo insurance quote.

IMPORTANT RULES:
1. Return ONLY valid JSON. No explanations, no markdown, no code fences, no backticks. Your entire response must be parseable by JSON.parse().
2. Return an object with:
   - "coverageRationale": string explaining why the recommended coverage type is appropriate (2-3 sentences)
   - "exclusions": array of strings listing standard exclusions that should apply
   - Keep exclusions practical and relevant to the specific shipment
   - Reference the actual commodity, route, and coverage type in your rationale

Example output:
{
  "coverageRationale": "ALL_RISK coverage is recommended for this electronics shipment due to the high unit value and sensitivity to moisture and impact damage. The Shanghai-Newark trade lane has moderate piracy risk and the cargo's HS code (8542) indicates semiconductor components requiring temperature-controlled handling.",
  "exclusions": [
    "War and strikes (unless separately covered)",
    "Inherent vice or nature of goods",
    "Delay-related losses",
    "Nuclear, chemical, biological terrorism",
    "Sanctions-related losses"
  ]
}`;

export async function runInsuranceAgent(input: InsuranceAgentInput): Promise<InsuranceAgentOutput> {
  const userPrompt = `Provide a coverage rationale and exclusions for this cargo insurance quote:

Coverage Type: ${input.calculation.coverageType}
Estimated Insured Value: ${input.calculation.currency} ${input.calculation.estimatedInsuredValue.toLocaleString()}
Estimated Premium: ${input.calculation.currency} ${input.calculation.estimatedPremium.toLocaleString()}
Confidence Score: ${input.calculation.confidenceScore}

Shipment Details:
- Commodity: ${input.commodity || "Not specified"}
- HS Code: ${input.hsCode || "Not specified"}
- Port of Loading: ${input.portOfLoading || "Not specified"}
- Port of Discharge: ${input.portOfDischarge || "Not specified"}
- Gross Weight: ${input.grossWeight ? `${input.grossWeight} KG` : "Not specified"}
- Volume: ${input.volume ? `${input.volume} CBM` : "Not specified"}
- Incoterms: ${input.incoterms || "Not specified"}

Explain why this coverage type is appropriate and list applicable exclusions. Return ONLY JSON.`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    messages: [{ role: "user", content: userPrompt }],
    system: SYSTEM_PROMPT,
  });

  const textBlock = response.content.find((b: any) => b.type === "text") as { type: "text"; text: string } | undefined;
  const raw = textBlock?.text || '{"coverageRationale":"","exclusions":[]}';

  return {
    raw,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
