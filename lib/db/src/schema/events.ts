import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const eventsTable = pgTable(
  "events",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    eventType: text("event_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    actorType: text("actor_type", {
      enum: ["USER", "SERVICE", "AGENT", "SYSTEM"],
    }),
    userId: text("user_id"),
    serviceId: text("service_id"),
    beforeState: jsonb("before_state"),
    afterState: jsonb("after_state"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("events_company_id_idx").on(table.companyId),
    index("events_event_type_idx").on(table.eventType),
    index("events_entity_id_idx").on(table.entityId),
    index("events_created_at_idx").on(table.createdAt),
    index("events_actor_type_idx").on(table.actorType),
  ],
);

export type Event = typeof eventsTable.$inferSelect;
export type InsertEvent = typeof eventsTable.$inferInsert;
