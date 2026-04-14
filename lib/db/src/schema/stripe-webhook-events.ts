import { pgTable, text, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";

export const WEBHOOK_EVENT_STATUSES = ["PROCESSING", "PROCESSED", "FAILED"] as const;
export type WebhookEventStatus = (typeof WEBHOOK_EVENT_STATUSES)[number];

export const stripeWebhookEventsTable = pgTable(
  "stripe_webhook_events",
  {
    id: text("id").primaryKey(),
    stripeEventId: text("stripe_event_id").notNull(),
    eventType: text("event_type").notNull(),
    receivedAt: timestamp("received_at").notNull().defaultNow(),
    processedAt: timestamp("processed_at"),
    status: text("status", { enum: [...WEBHOOK_EVENT_STATUSES] })
      .notNull()
      .default("PROCESSING"),
    error: text("error"),
    metadata: jsonb("metadata"),
  },
  (table) => [
    uniqueIndex("stripe_webhook_event_id_uniq").on(table.stripeEventId),
    index("stripe_webhook_status_idx").on(table.status),
    index("stripe_webhook_received_idx").on(table.receivedAt),
  ],
);

export type StripeWebhookEvent = typeof stripeWebhookEventsTable.$inferSelect;
export type InsertStripeWebhookEvent = typeof stripeWebhookEventsTable.$inferInsert;
