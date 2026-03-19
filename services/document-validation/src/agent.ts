import type {
  MissingDocument,
  MissingField,
  Inconsistency,
  SuspiciousFinding,
} from "./checker.js";

let anthropicClient: any = null;

async function getAnthropicClient() {
  if (anthropicClient) return anthropicClient;
  try {
    const mod = await import("@workspace/integrations-anthropic-ai");
    anthropicClient = mod.anthropic;
    return anthropicClient;
  } catch {
    return null;
  }
}

export interface DocValidationAgentOutput {
  raw: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

const SYSTEM_PROMPT = `You are a documentation validation agent for a freight forwarding company. You analyze the results of a deterministic document validation check and provide:
1. A concise reasoning summary explaining the overall documentation state
2. Specific recommended actions for the operator

IMPORTANT RULES:
1. Return ONLY valid JSON. No explanations, no markdown, no code fences.
2. The JSON must have exactly two fields:
   - "reasoningSummary": string (2-4 sentences summarizing the documentation state)
   - "recommendedActions": array of strings (each a clear, actionable instruction)
3. Be specific and operational. Reference actual document types and field names.
4. Keep recommendations actionable and prioritized by severity.
5. If everything is clear, say so briefly and recommend proceeding.

Example output:
{
  "reasoningSummary": "The shipment documentation is largely complete with all core documents present. However, the consignee name differs between the Bill of Lading and Commercial Invoice, which may cause customs delays at the port of discharge.",
  "recommendedActions": [
    "Verify and align the consignee name across Bill of Lading and Commercial Invoice before customs submission",
    "Confirm the correct cargo value with the shipper as extraction confidence was low"
  ]
}`;

export async function runDocValidationAgent(input: {
  shipmentRef: string;
  status: string;
  missingDocuments: MissingDocument[];
  missingFields: MissingField[];
  inconsistencies: Inconsistency[];
  suspiciousFindings: SuspiciousFinding[];
  documentCount: number;
}): Promise<DocValidationAgentOutput | null> {
  const client = await getAnthropicClient();
  if (!client) {
    console.log("[doc-validation] AI client unavailable, skipping agent reasoning");
    return null;
  }

  const sections: string[] = [];
  sections.push(`Shipment: ${input.shipmentRef} (Status: ${input.status})`);
  sections.push(`Documents available: ${input.documentCount}`);

  if (input.missingDocuments.length > 0) {
    sections.push(`\nMissing documents (${input.missingDocuments.length}):`);
    for (const d of input.missingDocuments) {
      sections.push(`  - [${d.severity}] ${d.label}: ${d.reason}`);
    }
  }

  if (input.missingFields.length > 0) {
    sections.push(`\nMissing fields (${input.missingFields.length}):`);
    for (const f of input.missingFields) {
      sections.push(`  - [${f.severity}] ${f.field} in ${f.documentType || "unknown"}: ${f.detail}`);
    }
  }

  if (input.inconsistencies.length > 0) {
    sections.push(`\nInconsistencies (${input.inconsistencies.length}):`);
    for (const i of input.inconsistencies) {
      sections.push(`  - [${i.severity}] ${i.field}: ${i.values.join(" vs ")}`);
    }
  }

  if (input.suspiciousFindings.length > 0) {
    sections.push(`\nSuspicious findings (${input.suspiciousFindings.length}):`);
    for (const s of input.suspiciousFindings) {
      sections.push(`  - [${s.severity}] ${s.title}: ${s.detail}`);
    }
  }

  if (
    input.missingDocuments.length === 0 &&
    input.missingFields.length === 0 &&
    input.inconsistencies.length === 0 &&
    input.suspiciousFindings.length === 0
  ) {
    sections.push("\nNo issues found. All documents appear complete and consistent.");
  }

  const userPrompt = `Analyze the following documentation validation results and provide a reasoning summary and recommended actions:\n\n${sections.join("\n")}\n\nReturn ONLY a JSON object with "reasoningSummary" and "recommendedActions" fields.`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2048,
      temperature: 0.1,
      messages: [{ role: "user", content: userPrompt }],
      system: SYSTEM_PROMPT,
    });

    const textBlock = response.content.find((b: any) => b.type === "text") as
      | { type: "text"; text: string }
      | undefined;
    const raw = textBlock?.text || "{}";

    return {
      raw,
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  } catch (err) {
    console.error("[doc-validation] AI agent error:", err);
    return null;
  }
}
