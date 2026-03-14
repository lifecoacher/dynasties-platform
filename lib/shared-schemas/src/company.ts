import { z } from "zod/v4";

export const CompanySchema = z.object({
  id: z.string().ulid(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100),
  contactEmail: z.string().email().optional(),
  sesEmailAddress: z.string().email().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Company = z.infer<typeof CompanySchema>;

export const CreateCompanySchema = CompanySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateCompany = z.infer<typeof CreateCompanySchema>;
