import { z } from "zod/v4";
import { EmailStatus } from "./enums";

export const IngestedEmailSchema = z.object({
  id: z.string().ulid(),
  companyId: z.string().ulid(),
  messageId: z.string().max(500),
  fromAddress: z.string().email(),
  toAddress: z.string().email(),
  subject: z.string().max(1000).optional(),
  bodyText: z.string().optional(),
  s3Key: z.string().max(1000),
  attachmentCount: z.number().int().min(0),
  status: EmailStatus,
  processedAt: z.date().optional(),
  createdAt: z.date(),
});
export type IngestedEmail = z.infer<typeof IngestedEmailSchema>;

export const CreateIngestedEmailSchema = IngestedEmailSchema.omit({
  id: true,
  createdAt: true,
  processedAt: true,
});
export type CreateIngestedEmail = z.infer<typeof CreateIngestedEmailSchema>;
