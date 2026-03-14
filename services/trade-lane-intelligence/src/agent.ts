import { anthropic } from "@workspace/integrations-anthropic-ai";

export interface TradeLaneAgentOutput {
  raw: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

const SYSTEM_PROMPT = `You are a trade lane intelligence analyst for a freight forwarding company. Given lane statistics and recent shipment data, provide advisory insights for operations planning.

IMPORTANT RULES:
1. Return ONLY valid JSON. No explanations, no markdown, no code fences.
2. Return a single object with these fields:
   - "costRangeEstimate": { "low": number, "high": number, "currency": "USD" }
   - "transitTimeEstimate": { "minDays": number, "maxDays": number, "avgDays": number }
   - "delayProbability": number (0-1)
   - "documentComplexitySummary": brief description of typical documentation requirements
   - "carrierAdvisory": recommendation on carrier selection or performance
   - "routeAdvisory": any route-specific considerations (weather, congestion, regulatory)
   - "seasonalFactors": current seasonal considerations
   - "riskLevel": one of "LOW", "MEDIUM", "HIGH"

Example output:
{
  "costRangeEstimate": { "low": 1500, "high": 3500, "currency": "USD" },
  "transitTimeEstimate": { "minDays": 14, "maxDays": 21, "avgDays": 17 },
  "delayProbability": 0.15,
  "documentComplexitySummary": "Standard documentation: BOL, commercial invoice, packing list. Certificate of origin may be required for preferential tariff.",
  "carrierAdvisory": "COSCO and Evergreen provide consistent service on this lane with 90%+ on-time delivery.",
  "routeAdvisory": "Monitor Suez Canal congestion; consider Cape route during peak disruption periods.",
  "seasonalFactors": "Q4 peak season typically adds 2-3 days transit and 10-15% cost premium.",
  "riskLevel": "LOW"
}`;

export async function runTradeLaneAgent(context: string): Promise<TradeLaneAgentOutput> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    messages: [{ role: "user", content: `Analyze this trade lane and provide your advisory:\n\n${context}\n\nReturn ONLY a JSON object.` }],
    system: SYSTEM_PROMPT,
  });

  const textBlock = response.content.find((b: any) => b.type === "text") as { type: "text"; text: string } | undefined;
  const raw = textBlock?.text || "{}";

  return {
    raw,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
