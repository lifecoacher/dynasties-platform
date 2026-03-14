import { z } from "zod/v4";

const InsuranceAgentOutputSchema = z.object({
  coverageRationale: z.string(),
  exclusions: z.array(z.string()),
});

export type InsuranceAgentData = z.infer<typeof InsuranceAgentOutputSchema>;

export interface InsuranceValidationResult {
  valid: boolean;
  data: InsuranceAgentData | null;
  errors: string[];
}

function stripMarkdownFences(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  return cleaned.trim();
}

export function validateInsuranceOutput(rawJson: string): InsuranceValidationResult {
  const cleaned = stripMarkdownFences(rawJson);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return {
      valid: false,
      data: null,
      errors: [`JSON parse error: ${e instanceof Error ? e.message : "unknown"}`],
    };
  }

  const result = InsuranceAgentOutputSchema.safeParse(parsed);

  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    );
    return { valid: false, data: null, errors };
  }

  return { valid: true, data: result.data, errors: [] };
}
