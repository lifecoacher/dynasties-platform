import { pgTable, text, timestamp, jsonb, index, real } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const sanctionsEntitiesTable = pgTable(
  "sanctions_entities",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").references(() => companiesTable.id),
    sourceId: text("source_id").notNull(),
    listName: text("list_name").notNull(),
    entityName: text("entity_name").notNull(),
    entityType: text("entity_type", {
      enum: ["individual", "organization", "vessel", "aircraft"],
    }).notNull(),
    aliases: jsonb("aliases").$type<string[]>(),
    country: text("country"),
    sanctionProgram: text("sanction_program"),
    listingDate: timestamp("listing_date"),
    expirationDate: timestamp("expiration_date"),
    identifiers: jsonb("identifiers").$type<Record<string, string>>(),
    status: text("status", {
      enum: ["active", "removed", "amended"],
    }).notNull().default("active"),
    fingerprint: text("fingerprint").notNull(),
    sourceQuality: real("source_quality"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("se_company_id_idx").on(table.companyId),
    index("se_entity_name_idx").on(table.entityName),
    index("se_list_name_idx").on(table.listName),
    index("se_entity_type_idx").on(table.entityType),
    index("se_fingerprint_idx").on(table.fingerprint),
    index("se_status_idx").on(table.status),
  ],
);

export const deniedPartiesTable = pgTable(
  "denied_parties",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").references(() => companiesTable.id),
    sourceId: text("source_id").notNull(),
    listName: text("list_name").notNull(),
    partyName: text("party_name").notNull(),
    partyType: text("party_type", {
      enum: ["individual", "organization"],
    }).notNull(),
    country: text("country"),
    address: text("address"),
    reason: text("reason"),
    aliases: jsonb("aliases").$type<string[]>(),
    status: text("status", {
      enum: ["active", "removed"],
    }).notNull().default("active"),
    fingerprint: text("fingerprint").notNull(),
    sourceQuality: real("source_quality"),
    listingDate: timestamp("listing_date"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("dp_company_id_idx").on(table.companyId),
    index("dp_party_name_idx").on(table.partyName),
    index("dp_list_name_idx").on(table.listName),
    index("dp_fingerprint_idx").on(table.fingerprint),
    index("dp_status_idx").on(table.status),
  ],
);

export type SanctionsEntity = typeof sanctionsEntitiesTable.$inferSelect;
export type InsertSanctionsEntity = typeof sanctionsEntitiesTable.$inferInsert;
export type DeniedParty = typeof deniedPartiesTable.$inferSelect;
export type InsertDeniedParty = typeof deniedPartiesTable.$inferInsert;
