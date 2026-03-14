import { z } from "zod/v4";

const RiskFactorSchema = z.object({
  factor: z.string(),
  explanation: z.string(),
});

const RiskAgentOutputSchema = z.object({
  primaryRiskFactors: z.array(RiskFactorSchema),
});

export type RiskFactor = z.infer<typeof RiskFactorSchema>;

export interface RiskValidationResult {
  valid: boolean;
  data: RiskFactor[];
  errors: string[];
}

function stripMarkdownFences(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  return cleaned.trim();
}

export function validateRiskOutput(rawJson: string): RiskValidationResult {
  const cleaned = stripMarkdownFences(rawJson);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return {
      valid: false,
      data: [],
      errors: [`JSON parse error: ${e instanceof Error ? e.message : "unknown"}`],
    };
  }

  const result = RiskAgentOutputSchema.safeParse(parsed);

  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    );
    return { valid: false, data: [], errors };
  }

  return { valid: true, data: result.data.primaryRiskFactors, errors: [] };
}
