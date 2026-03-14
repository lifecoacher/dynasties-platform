import { z } from "zod/v4";

const TradeLaneAgentSchema = z.object({
  costRangeEstimate: z.object({
    low: z.number(),
    high: z.number(),
    currency: z.string().default("USD"),
  }).optional(),
  transitTimeEstimate: z.object({
    minDays: z.number(),
    maxDays: z.number(),
    avgDays: z.number(),
  }).optional(),
  delayProbability: z.number().min(0).max(1).optional(),
  documentComplexitySummary: z.string().optional(),
  carrierAdvisory: z.string().optional(),
  routeAdvisory: z.string().optional(),
  seasonalFactors: z.string().optional(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
});

export type ValidatedTradeLaneOutput = z.infer<typeof TradeLaneAgentSchema>;

function stripMarkdownFences(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  return cleaned.trim();
}

export function validateTradeLaneOutput(raw: string): {
  valid: boolean;
  data: ValidatedTradeLaneOutput;
  errors: string[];
} {
  const cleaned = stripMarkdownFences(raw);
  try {
    const parsed = JSON.parse(cleaned);
    const result = TradeLaneAgentSchema.safeParse(parsed);
    if (result.success) {
      return { valid: true, data: result.data, errors: [] };
    }
    const errors = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    return { valid: false, data: {}, errors };
  } catch (err) {
    return { valid: false, data: {}, errors: [`JSON parse error: ${err}`] };
  }
}
