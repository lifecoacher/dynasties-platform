import { anthropic } from "@workspace/integrations-anthropic-ai";
import type { SubScores } from "./scorer.js";

export interface RiskAgentInput {
  compositeScore: number;
  subScores: SubScores;
  commodity: string | null;
  hsCode: string | null;
  portOfLoading: string | null;
  portOfDischarge: string | null;
  vessel: string | null;
  incoterms: string | null;
}

export interface RiskAgentOutput {
  raw: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

const SYSTEM_PROMPT = `You are a risk intelligence agent for a freight forwarding company. Your job is to analyze a shipment's risk score and explain the primary risk drivers in plain language.

IMPORTANT RULES:
1. Return ONLY valid JSON. No explanations, no markdown, no code fences, no backticks. Your entire response must be parseable by JSON.parse().
2. Return an object with:
   - "primaryRiskFactors": array of objects with "factor" (string) and "explanation" (string)
   - Keep it to 2-4 factors maximum, focusing on the highest-impact drivers
   - Be specific and actionable in explanations
   - Reference actual shipment details (commodity, route, etc.)

Example output:
{
  "primaryRiskFactors": [
    {
      "factor": "High-risk commodity classification",
      "explanation": "Electronics and semiconductors (HS 8542) are subject to dual-use export controls and require additional documentation."
    },
    {
      "factor": "Trade lane sensitivity",
      "explanation": "Shipments transiting the South China Sea face elevated piracy and geopolitical risks."
    }
  ]
}`;

export async function runRiskAgent(input: RiskAgentInput): Promise<RiskAgentOutput> {
  const userPrompt = `Analyze this shipment's risk profile and explain the primary risk drivers:

Composite Risk Score: ${input.compositeScore}
Sub-Scores:
- Cargo Type Risk: ${input.subScores.cargoType}
- Trade Lane Risk: ${input.subScores.tradeLane}
- Counterparty Risk: ${input.subScores.counterparty}
- Route Geopolitical Risk: ${input.subScores.routeGeopolitical}
- Seasonal Risk: ${input.subScores.seasonal}
- Document Completeness Risk: ${input.subScores.documentCompleteness}

Shipment Details:
- Commodity: ${input.commodity || "Not specified"}
- HS Code: ${input.hsCode || "Not specified"}
- Port of Loading: ${input.portOfLoading || "Not specified"}
- Port of Discharge: ${input.portOfDischarge || "Not specified"}
- Vessel: ${input.vessel || "Not specified"}
- Incoterms: ${input.incoterms || "Not specified"}

Identify the 2-4 highest-impact risk factors and explain each. Return ONLY JSON.`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    messages: [{ role: "user", content: userPrompt }],
    system: SYSTEM_PROMPT,
  });

  const textBlock = response.content.find((b: any) => b.type === "text") as { type: "text"; text: string } | undefined;
  const raw = textBlock?.text || '{"primaryRiskFactors":[]}';

  return {
    raw,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
