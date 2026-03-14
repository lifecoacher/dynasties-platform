import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createCompanySchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  contactEmail: z.string().email().optional(),
  sesEmailAddress: z.string().email().optional(),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "MANAGER", "OPERATOR", "VIEWER"]),
  companyId: z.string().optional(),
});

export const approveShipmentSchema = z
  .object({
    corrections: z.record(z.string(), z.unknown()).optional(),
  })
  .optional()
  .default({});

export const rejectShipmentSchema = z.object({
  reason: z.string().min(1).max(2000),
});

export const patchShipmentFieldsSchema = z.object({
  fields: z.record(z.string(), z.unknown()),
});

export const createRateTableSchema = z.object({
  chargeCode: z.string().min(1).max(50),
  description: z.string().min(1).max(500),
  carrier: z.string().min(1).max(100),
  origin: z.string().min(1).max(100),
  destination: z.string().min(1).max(100),
  modality: z.string().max(50).optional(),
  currency: z.string().length(3).default("USD"),
  unitPrice: z.union([z.string(), z.number()]),
  unitType: z.string().max(50).optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
});

export const patchExceptionSchema = z.object({
  status: z.enum(["OPEN", "INVESTIGATING", "RESOLVED", "ESCALATED", "DISMISSED"]),
  resolution: z.string().max(2000).optional(),
});

export const createClaimSchema = z.object({
  claimType: z.enum(["DAMAGE", "LOSS", "DELAY", "SHORTAGE", "OTHER"]),
  claimantName: z.string().min(1).max(255),
  claimantEmail: z.string().email().optional(),
  estimatedAmount: z.union([z.string(), z.number()]).optional(),
  currency: z.string().length(3).default("USD"),
  incidentDate: z.string().optional(),
  incidentDescription: z.string().min(1).max(5000),
});

export const patchClaimSchema = z.object({
  status: z.enum(["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "DENIED", "CLOSED"]),
  resolution: z.string().max(5000).optional(),
  settledAmount: z.union([z.string(), z.number()]).optional(),
});
