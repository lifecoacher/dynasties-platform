import { anthropic } from "@workspace/integrations-anthropic-ai";

export interface AgentExtractionInput {
  documentText: string;
  fileName: string;
  documentType: string;
  pageCount: number;
}

export interface AgentRawOutput {
  raw: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

const SYSTEM_PROMPT = `You are a document extraction agent for a freight forwarding company. Your job is to extract structured fields from logistics documents (bills of lading, commercial invoices, packing lists, arrival notices, etc.).

IMPORTANT RULES:
1. Return ONLY valid JSON. No explanations, no markdown, no code fences.
2. For each field you extract, provide:
   - "value": the extracted value (string, number, or array)
   - "confidence": a number between 0 and 1 indicating your confidence
   - "source": a brief quote from the document text where you found this
   - "needsReview": true if the value is uncertain or the source is ambiguous
3. Only include fields you actually find in the document. Do NOT fabricate values.
4. If the document is empty or unreadable, return an empty object: {}

The output schema must match this structure (all fields optional):
{
  "shipper": { "value": "...", "confidence": 0.95, "source": "...", "needsReview": false },
  "consignee": { "value": "...", "confidence": 0.95, "source": "...", "needsReview": false },
  "notifyParty": { "value": "...", "confidence": 0.9, "source": "...", "needsReview": false },
  "vessel": { "value": "...", "confidence": 0.95, "source": "...", "needsReview": false },
  "voyage": { "value": "...", "confidence": 0.9, "source": "...", "needsReview": false },
  "portOfLoading": { "value": "...", "confidence": 0.95, "source": "...", "needsReview": false },
  "portOfDischarge": { "value": "...", "confidence": 0.95, "source": "...", "needsReview": false },
  "commodity": { "value": "...", "confidence": 0.9, "source": "...", "needsReview": false },
  "hsCode": { "value": "...", "confidence": 0.85, "source": "...", "needsReview": true },
  "packageCount": { "value": 100, "confidence": 0.9, "source": "...", "needsReview": false },
  "weight": { "value": "5000 KG", "confidence": 0.9, "source": "...", "needsReview": false },
  "volume": { "value": "25 CBM", "confidence": 0.85, "source": "...", "needsReview": false },
  "freightTerms": { "value": "CIF", "confidence": 0.95, "source": "...", "needsReview": false },
  "releaseType": { "value": "ORIGINAL", "confidence": 0.9, "source": "...", "needsReview": false },
  "shipmentDate": { "value": "2024-03-15", "confidence": 0.9, "source": "...", "needsReview": false },
  "containerNumbers": { "value": ["MSKU1234567"], "confidence": 0.95, "source": "...", "needsReview": false },
  "bookingNumber": { "value": "BK12345", "confidence": 0.95, "source": "...", "needsReview": false },
  "blNumber": { "value": "MAEU123456", "confidence": 0.95, "source": "...", "needsReview": false }
}`;

export async function runExtractionAgent(input: AgentExtractionInput): Promise<AgentRawOutput> {
  const userPrompt = `Document type: ${input.documentType}
File name: ${input.fileName}
Pages: ${input.pageCount}

--- DOCUMENT TEXT ---
${input.documentText}
--- END DOCUMENT TEXT ---

Extract all available structured fields from this document. Return ONLY JSON.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: userPrompt }],
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
