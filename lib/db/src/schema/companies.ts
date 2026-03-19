import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  index,
} from "drizzle-orm/pg-core";

export const companiesTable = pgTable(
  "companies",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    industry: text("industry"),
    country: text("country"),
    tradeLanes: jsonb("trade_lanes").$type<string[]>(),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    sesEmailAddress: text("ses_email_address"),
    settings: jsonb("settings").$type<Record<string, unknown>>(),

    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    billingStatus: text("billing_status", {
      enum: ["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED", "INACTIVE"],
    }).notNull().default("INACTIVE"),
    planType: text("plan_type", {
      enum: ["STARTER", "GROWTH", "SCALE", "ENTERPRISE"],
    }),
    planPriceId: text("plan_price_id"),
    seatLimit: integer("seat_limit").notNull().default(3),
    shipmentLimitMonthly: integer("shipment_limit_monthly").notNull().default(50),
    shipmentsUsedThisCycle: integer("shipments_used_this_cycle").notNull().default(0),
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("companies_slug_idx").on(table.slug)],
);

export type Company = typeof companiesTable.$inferSelect;
export type InsertCompany = typeof companiesTable.$inferInsert;
