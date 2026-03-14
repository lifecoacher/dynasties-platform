import { z } from "zod/v4";
import { ComplianceStatus } from "./enums";

export const ComplianceMatchSchema = z.object({
  listName: z.string(),
  matchedEntry: z.string(),
  similarity: z.number().min(0).max(1),
  matchType: z.enum(["NAME", "ADDRESS", "ENTITY"]),
  recommendation: z.enum(["CLEAR", "REVIEW", "BLOCK"]),
});
export type ComplianceMatch = z.infer<typeof ComplianceMatchSchema>;

export const ComplianceScreeningSchema = z.object({
  id: z.string().ulid(),
  companyId: z.string().ulid(),
  shipmentId: z.string().ulid(),
  status: ComplianceStatus,
  screenedParties: z.number().int(),
  matchCount: z.number().int(),
  matches: z.array(ComplianceMatchSchema),
  listsChecked: z.array(z.string()),
  screenedAt: z.date(),
  createdAt: z.date(),
});
export type ComplianceScreening = z.infer<typeof ComplianceScreeningSchema>;

export const CreateComplianceScreeningSchema = ComplianceScreeningSchema.omit({
  id: true,
  createdAt: true,
});
export type CreateComplianceScreening = z.infer<
  typeof CreateComplianceScreeningSchema
>;
