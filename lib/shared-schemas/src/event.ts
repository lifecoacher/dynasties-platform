import { z } from "zod/v4";
import { EventType } from "./enums";

export const EventSchema = z.object({
  id: z.string().ulid(),
  companyId: z.string().ulid(),
  eventType: EventType,
  entityType: z.string().max(50),
  entityId: z.string().ulid(),
  userId: z.string().ulid().optional(),
  serviceId: z.string().max(100).optional(),
  beforeState: z.record(z.string(), z.unknown()).optional(),
  afterState: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.date(),
});
export type Event = z.infer<typeof EventSchema>;

export const CreateEventSchema = EventSchema.omit({
  id: true,
  createdAt: true,
});
export type CreateEvent = z.infer<typeof CreateEventSchema>;
