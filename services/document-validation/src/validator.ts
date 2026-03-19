import { z } from "zod/v4";

const DocValidationAIOutputSchema = z.object({
  reasoningSummary: z.string(),
  recommendedActions: z.array(z.string()),
});

export type DocValidationAIOutput = z.infer<typeof DocValidationAIOutputSchema>;

export interface DocValidationValidationResult {
  valid: boolean;
  data: DocValidationAIOutput;
  errors: string[];
}

function stripMarkdownFences(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  return cleaned.trim();
}

export function validateDocValidationOutput(rawJson: string): DocValidationValidationResult {
  const cleaned = stripMarkdownFences(rawJson);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return {
      valid: false,
      data: { reasoningSummary: "", recommendedActions: [] },
      errors: [`JSON parse error: ${e instanceof Error ? e.message : "unknown"}`],
    };
  }

  const result = DocValidationAIOutputSchema.safeParse(parsed);

  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    );
    return {
      valid: false,
      data: { reasoningSummary: "", recommendedActions: [] },
      errors,
    };
  }

  return { valid: true, data: result.data, errors: [] };
}
