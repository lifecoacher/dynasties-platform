import { anthropic } from "@workspace/integrations-anthropic-ai";

export interface ClaimsAgentOutput {
  raw: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

const SYSTEM_PROMPT = `You are a cargo insurance claims preparation specialist for a freight forwarding company. Given shipment data, insurance coverage, and incident details, prepare a structured claims package.

IMPORTANT RULES:
1. Return ONLY valid JSON. No explanations, no markdown, no code fences.
2. Return a single object with these fields:
   - "claimNarrative": detailed narrative suitable for insurer submission (3-5 paragraphs)
   - "requiredDocuments": array of objects, each with "documentType" (string) and "status" ("AVAILABLE", "MISSING", "PENDING")
   - "lossEstimate": { "amount": number, "currency": "USD", "basis": string explaining calculation }
   - "coverageAnalysis": { "policyApplicable": boolean, "coverageType": string, "exclusions": array of strings, "deductible": number or null }
   - "submissionRecommendation": one of "SUBMIT_IMMEDIATELY", "GATHER_MORE_EVIDENCE", "CLAIM_UNLIKELY_COVERED", "CONSULT_LEGAL"
   - "strengthAssessment": one of "STRONG", "MODERATE", "WEAK"
   - "keyRisks": array of strings listing risks to claim success

Example output:
{
  "claimNarrative": "On [date], a shipment of [commodity] ... was damaged during transit...",
  "requiredDocuments": [
    { "documentType": "Bill of Lading", "status": "AVAILABLE" },
    { "documentType": "Survey Report", "status": "MISSING" }
  ],
  "lossEstimate": { "amount": 25000, "currency": "USD", "basis": "Based on declared cargo value and damage extent" },
  "coverageAnalysis": { "policyApplicable": true, "coverageType": "ALL_RISK", "exclusions": ["Inherent vice"], "deductible": 500 },
  "submissionRecommendation": "SUBMIT_IMMEDIATELY",
  "strengthAssessment": "STRONG",
  "keyRisks": ["Late notification may weaken claim"]
}`;

export async function runClaimsAgent(context: string): Promise<ClaimsAgentOutput> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 4096,
    messages: [{ role: "user", content: `Prepare a claims package assessment for this incident:\n\n${context}\n\nReturn ONLY a JSON object.` }],
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
