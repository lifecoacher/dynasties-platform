import { z } from "zod/v4";

const ComplianceResolutionSchema = z.object({
  entityName: z.string(),
  matchedEntry: z.string(),
  listName: z.string(),
  determination: z.enum(["FALSE_POSITIVE", "POSSIBLE_MATCH", "LIKELY_MATCH"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  recommendation: z.enum(["CLEAR", "FLAG_FOR_REVIEW", "BLOCK"]),
});

const ComplianceResolutionsSchema = z.array(ComplianceResolutionSchema);

export type ComplianceResolution = z.infer<typeof ComplianceResolutionSchema>;

export interface ComplianceValidationResult {
  valid: boolean;
  data: ComplianceResolution[];
  errors: string[];
}

function stripMarkdownFences(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  return cleaned.trim();
}

export function validateComplianceOutput(rawJson: string): ComplianceValidationResult {
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

  const result = ComplianceResolutionsSchema.safeParse(parsed);

  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    );
    return { valid: false, data: [], errors };
  }

  return { valid: true, data: result.data, errors: [] };
}
