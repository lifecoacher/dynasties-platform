import { z } from "zod/v4";

const ClaimsAgentSchema = z.object({
  claimNarrative: z.string(),
  requiredDocuments: z.array(
    z.object({
      documentType: z.string(),
      status: z.enum(["AVAILABLE", "MISSING", "PENDING"]),
    }),
  ),
  lossEstimate: z.object({
    amount: z.number(),
    currency: z.string().default("USD"),
    basis: z.string(),
  }),
  coverageAnalysis: z.object({
    policyApplicable: z.boolean(),
    coverageType: z.string(),
    exclusions: z.array(z.string()).default([]),
    deductible: z.number().nullable().default(null),
  }),
  submissionRecommendation: z.enum([
    "SUBMIT_IMMEDIATELY",
    "GATHER_MORE_EVIDENCE",
    "CLAIM_UNLIKELY_COVERED",
    "CONSULT_LEGAL",
  ]),
  strengthAssessment: z.enum(["STRONG", "MODERATE", "WEAK"]).optional(),
  keyRisks: z.array(z.string()).default([]),
});

export type ValidatedClaimsOutput = z.infer<typeof ClaimsAgentSchema>;

function stripMarkdownFences(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  return cleaned.trim();
}

export function validateClaimsOutput(raw: string): {
  valid: boolean;
  data: ValidatedClaimsOutput | null;
  errors: string[];
} {
  const cleaned = stripMarkdownFences(raw);
  try {
    const parsed = JSON.parse(cleaned);
    const result = ClaimsAgentSchema.safeParse(parsed);
    if (result.success) {
      return { valid: true, data: result.data, errors: [] };
    }
    const errors = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    return { valid: false, data: null, errors };
  } catch (err) {
    return { valid: false, data: null, errors: [`JSON parse error: ${err}`] };
  }
}
