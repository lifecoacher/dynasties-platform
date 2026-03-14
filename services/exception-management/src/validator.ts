import { z } from "zod/v4";

const ExceptionAgentSchema = z.object({
  classification: z.string(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  impactSummary: z.string(),
  recommendedAction: z.string(),
  requiresEscalation: z.boolean(),
  urgencyHours: z.number().optional(),
  relatedRisks: z.array(z.string()).optional(),
});

export type ValidatedExceptionOutput = z.infer<typeof ExceptionAgentSchema>;

function stripMarkdownFences(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  return cleaned.trim();
}

export function validateExceptionOutput(raw: string): {
  valid: boolean;
  data: ValidatedExceptionOutput;
  errors: string[];
} {
  const cleaned = stripMarkdownFences(raw);
  try {
    const parsed = JSON.parse(cleaned);
    const result = ExceptionAgentSchema.safeParse(parsed);
    if (result.success) {
      return { valid: true, data: result.data, errors: [] };
    }
    const errors = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    return {
      valid: false,
      data: {
        classification: "Unclassified",
        severity: "MEDIUM",
        impactSummary: "Agent output could not be validated",
        recommendedAction: "Review exception manually",
        requiresEscalation: false,
      },
      errors,
    };
  } catch (err) {
    return {
      valid: false,
      data: {
        classification: "Unclassified",
        severity: "MEDIUM",
        impactSummary: "Agent output could not be parsed",
        recommendedAction: "Review exception manually",
        requiresEscalation: false,
      },
      errors: [`JSON parse error: ${err}`],
    };
  }
}
