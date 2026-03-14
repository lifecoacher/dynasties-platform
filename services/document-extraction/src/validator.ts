import { ExtractionOutputSchema, type ExtractionOutput } from "@workspace/shared-schemas";

export interface ValidationResult {
  valid: boolean;
  data: ExtractionOutput | null;
  errors: string[];
  fieldCount: number;
  reviewCount: number;
}

export function validateExtractionOutput(rawJson: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (e) {
    return {
      valid: false,
      data: null,
      errors: [`JSON parse error: ${e instanceof Error ? e.message : "unknown"}`],
      fieldCount: 0,
      reviewCount: 0,
    };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      valid: false,
      data: null,
      errors: ["Agent output must be a JSON object"],
      fieldCount: 0,
      reviewCount: 0,
    };
  }

  const result = ExtractionOutputSchema.safeParse(parsed);

  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    );
    return {
      valid: false,
      data: null,
      errors,
      fieldCount: 0,
      reviewCount: 0,
    };
  }

  const data = result.data;
  const fields = Object.entries(data).filter(([, v]) => v !== undefined);
  const fieldCount = fields.length;
  const reviewCount = fields.filter(([, v]) => v?.needsReview === true).length;

  for (const [key, field] of fields) {
    if (field && (field.confidence < 0 || field.confidence > 1)) {
      return {
        valid: false,
        data: null,
        errors: [`Field "${key}" has invalid confidence: ${field.confidence}`],
        fieldCount: 0,
        reviewCount: 0,
      };
    }
  }

  return { valid: true, data, errors: [], fieldCount, reviewCount };
}
