import { callAI } from "@workspace/integrations-anthropic-ai";
import type { ClassificationResult } from "@workspace/db/schema";

export interface ClassificationInput {
  fileName: string;
  headers: string[];
  sampleRows: Record<string, any>[];
  rowCount: number;
}

export async function classifyFile(input: ClassificationInput): Promise<ClassificationResult> {
  const prompt = `You are a data classification expert for a freight forwarding / logistics platform called Dynasties.

Analyze this uploaded file and determine what type of business data it contains.

File: "${input.fileName}"
Total rows: ${input.rowCount}
Column headers: ${JSON.stringify(input.headers)}
Sample data (first ${input.sampleRows.length} rows):
${JSON.stringify(input.sampleRows, null, 2)}

Classify this file as ONE of these types:
- "shipments" — contains shipment/cargo/booking data (origins, destinations, containers, vessels, tracking numbers, incoterms, weights, etc.)
- "invoices" — contains invoice/billing data (invoice numbers, amounts, due dates, payment terms, etc.)
- "customers" — contains customer/company/entity data (names, addresses, emails, phone numbers, account numbers, etc.)
- "line_items" — contains invoice line items or charge breakdowns (descriptions, quantities, unit prices, amounts, line types)
- "payments" — contains payment records (payment dates, amounts, payment methods, references)
- "unknown" — cannot confidently determine the type

Respond ONLY with a JSON object (no markdown, no explanation outside the JSON):
{
  "fileType": "shipments" | "invoices" | "customers" | "line_items" | "payments" | "unknown",
  "confidence": 0.0 to 1.0,
  "reasoning": "brief explanation of why this classification was chosen"
}`;

  try {
    const response = await callAI({
      taskType: "data-classification",
      systemPrompt: "You are a data classification expert. Respond only with valid JSON.",
      userMessage: prompt,
      maxTokens: 500,
      temperature: 0.1,
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        fileName: input.fileName,
        fileType: "unknown",
        confidence: 0,
        reasoning: "Failed to parse AI response",
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      fileName: input.fileName,
      fileType: parsed.fileType || "unknown",
      confidence: Math.min(Math.max(parsed.confidence || 0, 0), 1),
      reasoning: parsed.reasoning || "",
    };
  } catch (err: any) {
    console.error("[classifier] AI classification failed:", err.message);
    return classifyByHeuristics(input);
  }
}

function classifyByHeuristics(input: ClassificationInput): ClassificationResult {
  const headers = input.headers.map((h) => h.toLowerCase());
  const headerStr = headers.join(" ");

  const shipmentSignals = ["origin", "destination", "container", "vessel", "port", "incoterm", "bol", "b/l", "tracking", "cargo", "weight", "shipment", "booking", "voyage", "eta", "etd", "hs code", "commodity"];
  const invoiceSignals = ["invoice", "amount", "total", "due date", "payment", "currency", "tax", "subtotal", "grand total", "billing"];
  const customerSignals = ["customer", "company", "email", "phone", "address", "contact", "account", "client"];
  const lineItemSignals = ["line", "item", "quantity", "unit price", "description", "charge", "fee", "freight"];
  const paymentSignals = ["payment date", "paid", "receipt", "method", "bank", "reference", "remittance"];

  const scores = {
    shipments: shipmentSignals.filter((s) => headerStr.includes(s)).length,
    invoices: invoiceSignals.filter((s) => headerStr.includes(s)).length,
    customers: customerSignals.filter((s) => headerStr.includes(s)).length,
    line_items: lineItemSignals.filter((s) => headerStr.includes(s)).length,
    payments: paymentSignals.filter((s) => headerStr.includes(s)).length,
  };

  const best = Object.entries(scores).sort(([, a], [, b]) => b - a)[0];
  const [fileType, matchCount] = best;
  const totalSignals = shipmentSignals.length;
  const confidence = matchCount > 0 ? Math.min(matchCount / 4, 0.95) : 0;

  if (matchCount === 0) {
    return {
      fileName: input.fileName,
      fileType: "unknown",
      confidence: 0,
      reasoning: "No recognizable column patterns found (heuristic fallback)",
    };
  }

  return {
    fileName: input.fileName,
    fileType: fileType as ClassificationResult["fileType"],
    confidence,
    reasoning: `Heuristic fallback: matched ${matchCount} ${fileType} signals in column headers`,
  };
}
