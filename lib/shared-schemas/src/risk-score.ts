import { z } from "zod/v4";
import { RiskAction } from "./enums";

export const RiskSubScoresSchema = z.object({
  cargoType: z.number().min(0).max(100),
  tradeLane: z.number().min(0).max(100),
  counterparty: z.number().min(0).max(100),
  routeGeopolitical: z.number().min(0).max(100),
  seasonal: z.number().min(0).max(100),
  documentCompleteness: z.number().min(0).max(100),
});
export type RiskSubScores = z.infer<typeof RiskSubScoresSchema>;

export const RiskScoreSchema = z.object({
  id: z.string().ulid(),
  companyId: z.string().ulid(),
  shipmentId: z.string().ulid(),
  compositeScore: z.number().min(0).max(100),
  subScores: RiskSubScoresSchema,
  primaryRiskFactors: z.array(
    z.object({
      factor: z.string(),
      explanation: z.string(),
    }),
  ),
  recommendedAction: RiskAction,
  scoredAt: z.date(),
  createdAt: z.date(),
});
export type RiskScore = z.infer<typeof RiskScoreSchema>;

export const CreateRiskScoreSchema = RiskScoreSchema.omit({
  id: true,
  createdAt: true,
});
export type CreateRiskScore = z.infer<typeof CreateRiskScoreSchema>;
