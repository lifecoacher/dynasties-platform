import { z } from "zod/v4";

export const OperatorCorrectionSchema = z.object({
  id: z.string().ulid(),
  companyId: z.string().ulid(),
  shipmentId: z.string().ulid(),
  fieldName: z.string().max(100),
  originalValue: z.unknown(),
  correctedValue: z.unknown(),
  originalConfidence: z.number().min(0).max(1).optional(),
  correctedBy: z.string().ulid(),
  createdAt: z.date(),
});
export type OperatorCorrection = z.infer<typeof OperatorCorrectionSchema>;

export const CreateOperatorCorrectionSchema = OperatorCorrectionSchema.omit({
  id: true,
  createdAt: true,
});
export type CreateOperatorCorrection = z.infer<
  typeof CreateOperatorCorrectionSchema
>;
