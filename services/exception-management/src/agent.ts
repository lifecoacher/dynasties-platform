import { anthropic } from "@workspace/integrations-anthropic-ai";

export interface ExceptionAgentOutput {
  raw: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

const SYSTEM_PROMPT = `You are an operations exception analyst for a freight forwarding company. Your job is to classify detected exceptions, assess their severity and impact, and recommend resolution actions.

IMPORTANT RULES:
1. Return ONLY valid JSON. No explanations, no markdown, no code fences.
2. Return a single object with these fields:
   - "classification": more specific sub-classification of the exception type
   - "severity": one of "LOW", "MEDIUM", "HIGH", "CRITICAL"
   - "impactSummary": 1-2 sentence description of operational impact
   - "recommendedAction": specific actionable step the operator should take
   - "requiresEscalation": boolean - true if management or external party involvement needed
   - "urgencyHours": estimated hours before this becomes a larger problem (number)
   - "relatedRisks": array of strings listing downstream risks if unresolved

Example output:
{
  "classification": "Missing Certificate of Origin for EU-bound cargo",
  "severity": "HIGH",
  "impactSummary": "Customs clearance will be delayed at destination port, potentially incurring demurrage charges.",
  "recommendedAction": "Contact shipper immediately to provide Certificate of Origin. If unavailable, prepare a letter of indemnity.",
  "requiresEscalation": false,
  "urgencyHours": 24,
  "relatedRisks": ["Demurrage charges", "Delivery delay to consignee", "Potential customs penalties"]
}`;

export async function runExceptionAgent(context: string): Promise<ExceptionAgentOutput> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    messages: [{ role: "user", content: `Analyze this operational exception and provide your assessment:\n\n${context}\n\nReturn ONLY a JSON object.` }],
    system: SYSTEM_PROMPT,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const raw = textBlock?.text || "{}";

  return {
    raw,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
