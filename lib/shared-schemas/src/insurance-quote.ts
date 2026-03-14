import { z } from "zod/v4";
import { InsuranceCoverageType } from "./enums";

export const InsuranceQuoteSchema = z.object({
  id: z.string().ulid(),
  companyId: z.string().ulid(),
  shipmentId: z.string().ulid(),
  coverageType: InsuranceCoverageType,
  estimatedInsuredValue: z.number().min(0),
  estimatedPremium: z.number().min(0),
  currency: z.string().length(3),
  coverageRationale: z.string(),
  exclusions: z.array(z.string()),
  confidenceScore: z.number().min(0).max(1),
  quotedAt: z.date(),
  createdAt: z.date(),
});
export type InsuranceQuote = z.infer<typeof InsuranceQuoteSchema>;

export const CreateInsuranceQuoteSchema = InsuranceQuoteSchema.omit({
  id: true,
  createdAt: true,
});
export type CreateInsuranceQuote = z.infer<typeof CreateInsuranceQuoteSchema>;
