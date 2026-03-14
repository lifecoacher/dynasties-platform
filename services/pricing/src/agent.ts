import { anthropic } from "@workspace/integrations-anthropic-ai";

const SYSTEM_PROMPT = `You are a freight forwarding pricing specialist. When standard rate tables cannot fully price a shipment, you analyze the shipment details and recommend charge lines.

You MUST return ONLY a JSON object (no markdown fences, no explanation outside JSON):
{
  "charges": [
    {
      "chargeCode": "string (e.g. FRT, THC, DOC, BAF, CAF, ISP, CFS)",
      "description": "string",
      "chargeType": "FREIGHT|ORIGIN|DESTINATION|DOCUMENTATION|INSURANCE|CUSTOMS|SURCHARGE|OTHER",
      "quantity": number,
      "unitPrice": number,
      "currency": "USD",
      "rationale": "string explaining why this charge applies"
    }
  ],
  "marginNotes": "string explaining overall pricing logic"
}`;

export interface AgentChargeRecommendation {
  charges: Array<{
    chargeCode: string;
    description: string;
    chargeType: string;
    quantity: number;
    unitPrice: number;
    currency: string;
    rationale: string;
  }>;
  marginNotes: string;
}

export async function runPricingAgent(shipmentContext: string): Promise<{ raw: string }> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Analyze this shipment and recommend additional charges that the standard rate table did not cover:\n\n${shipmentContext}`,
      },
    ],
  });

  const textBlock = response.content.find((b: any) => b.type === "text");
  return { raw: textBlock?.text || "{}" };
}
