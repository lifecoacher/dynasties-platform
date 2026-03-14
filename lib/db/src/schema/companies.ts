import {
  pgTable,
  text,
  timestamp,
  jsonb,
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
