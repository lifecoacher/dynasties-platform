import { z } from "zod/v4";

function stripMarkdownFences(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

const AgentChargeSchema = z.object({
  chargeCode: z.string(),
  description: z.string(),
  chargeType: z.enum(["FREIGHT", "ORIGIN", "DESTINATION", "DOCUMENTATION", "INSURANCE", "CUSTOMS", "SURCHARGE", "OTHER"]),
  quantity: z.number().min(0),
  unitPrice: z.number().min(0),
  currency: z.string().default("USD"),
  rationale: z.string(),
});

const AgentOutputSchema = z.object({
  charges: z.array(AgentChargeSchema),
  marginNotes: z.string(),
});

export type ValidatedAgentCharge = z.infer<typeof AgentChargeSchema>;

export function validatePricingOutput(raw: string): {
  valid: boolean;
  data: { charges: ValidatedAgentCharge[]; marginNotes: string };
  errors: string[];
} {
  const cleaned = stripMarkdownFences(raw);
  try {
    const parsed = JSON.parse(cleaned);
    const result = AgentOutputSchema.parse(parsed);
    return { valid: true, data: result, errors: [] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      data: { charges: [], marginNotes: "" },
      errors: [message],
    };
  }
}
