import { z } from "zod/v4";
import { EntityStatus, EntityType } from "./enums";

export const EntitySchema = z.object({
  id: z.string().ulid(),
  companyId: z.string().ulid(),
  name: z.string().min(1).max(500),
  normalizedName: z.string().max(500),
  entityType: EntityType,
  status: EntityStatus,
  address: z.string().max(1000).optional(),
  city: z.string().max(255).optional(),
  country: z.string().max(100).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(50).optional(),
  taxId: z.string().max(100).optional(),
  scacCode: z.string().max(10).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Entity = z.infer<typeof EntitySchema>;

export const CreateEntitySchema = EntitySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateEntity = z.infer<typeof CreateEntitySchema>;
