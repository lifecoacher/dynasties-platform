import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const entitiesTable = pgTable(
  "entities",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    entityType: text("entity_type", {
      enum: [
        "SHIPPER",
        "CONSIGNEE",
        "CARRIER",
        "NOTIFY_PARTY",
        "FORWARDER",
        "AGENT",
        "VENDOR",
        "CUSTOMER",
      ],
    }).notNull(),
    status: text("status", {
      enum: ["VERIFIED", "UNVERIFIED"],
    }).notNull(),
    address: text("address"),
    city: text("city"),
    country: text("country"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    taxId: text("tax_id"),
    scacCode: text("scac_code"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("entities_company_id_idx").on(table.companyId),
    index("entities_normalized_name_idx").on(table.normalizedName),
    index("entities_type_idx").on(table.entityType),
    index("entities_status_idx").on(table.status),
  ],
);

export type Entity = typeof entitiesTable.$inferSelect;
export type InsertEntity = typeof entitiesTable.$inferInsert;
