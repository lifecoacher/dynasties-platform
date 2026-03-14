import { anthropic } from "@workspace/integrations-anthropic-ai";
import type { AmbiguousMatch } from "./screener.js";

export interface ComplianceAgentOutput {
  raw: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

const SYSTEM_PROMPT = `You are a compliance analysis agent for a freight forwarding company. Your job is to evaluate ambiguous matches found during sanctions screening and determine whether each match is a genuine concern or a false positive.

IMPORTANT RULES:
1. Return ONLY valid JSON. No explanations, no markdown, no code fences.
2. Return an array of resolution objects, one per match.
3. Each object must have:
   - "entityName": the name of the entity being screened
   - "matchedEntry": the sanctions list entry it was matched against
   - "listName": which sanctions list
   - "determination": one of "FALSE_POSITIVE", "POSSIBLE_MATCH", "LIKELY_MATCH"
   - "confidence": number 0-1
   - "reasoning": brief explanation (1-2 sentences)
   - "recommendation": one of "CLEAR", "FLAG_FOR_REVIEW", "BLOCK"
4. Be conservative — when in doubt, recommend FLAG_FOR_REVIEW.
5. Consider context: entity type, industry norms, common business names.

Example output:
[
  {
    "entityName": "Eastern Trading Co.",
    "matchedEntry": "EAST TRADING CORPORATION",
    "listName": "OFAC SDN",
    "determination": "FALSE_POSITIVE",
    "confidence": 0.85,
    "reasoning": "Common business naming pattern, low similarity in full context.",
    "recommendation": "CLEAR"
  }
]`;

export async function runComplianceAgent(
  ambiguousMatches: AmbiguousMatch[],
): Promise<ComplianceAgentOutput> {
  const matchDescriptions = ambiguousMatches
    .map(
      (m) =>
        `Entity: "${m.entityName}" matched against "${m.matchedEntry}" on list "${m.listName}" (similarity: ${m.similarity.toFixed(3)})`,
    )
    .join("\n");

  const userPrompt = `Evaluate the following ambiguous sanctions screening matches and determine if they are genuine concerns or false positives:

${matchDescriptions}

Return ONLY a JSON array of resolution objects.`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 4096,
    messages: [{ role: "user", content: userPrompt }],
    system: SYSTEM_PROMPT,
  });

  const textBlock = response.content.find((b: any) => b.type === "text");
  const raw = textBlock?.text || "[]";

  return {
    raw,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
