import {
  pgTable,
  text,
  timestamp,
  integer,
  index,
  boolean,
} from "drizzle-orm/pg-core";

export const hsCodesTable = pgTable(
  "hs_codes",
  {
    code: text("code").primaryKey(),
    description: text("description").notNull(),
    chapter: text("chapter").notNull(),
    section: text("section"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("hs_codes_chapter_idx").on(table.chapter)],
);

export const portsTable = pgTable(
  "ports",
  {
    locode: text("locode").primaryKey(),
    name: text("name").notNull(),
    country: text("country").notNull(),
    countryCode: text("country_code").notNull(),
    portType: text("port_type", {
      enum: ["SEA", "AIR", "RAIL", "ROAD", "INLAND"],
    }).notNull(),
    latitude: text("latitude"),
    longitude: text("longitude"),
    timezone: text("timezone"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("ports_country_code_idx").on(table.countryCode),
    index("ports_type_idx").on(table.portType),
  ],
);

export const containerTypesTable = pgTable("container_types", {
  code: text("code").primaryKey(),
  description: text("description").notNull(),
  lengthFt: integer("length_ft").notNull(),
  category: text("category", {
    enum: ["DRY", "REEFER", "OPEN_TOP", "FLAT_RACK", "TANK", "SPECIAL"],
  }).notNull(),
  maxPayloadKg: integer("max_payload_kg"),
  teu: integer("teu").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const currenciesTable = pgTable("currencies", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const countriesTable = pgTable(
  "countries",
  {
    code: text("code").primaryKey(),
    name: text("name").notNull(),
    region: text("region"),
    subRegion: text("sub_region"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("countries_region_idx").on(table.region)],
);

export const incotermsTable = pgTable("incoterms", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category", {
    enum: ["ANY_MODE", "SEA_INLAND_WATERWAY"],
  }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type HsCode = typeof hsCodesTable.$inferSelect;
export type Port = typeof portsTable.$inferSelect;
export type ContainerType = typeof containerTypesTable.$inferSelect;
export type Currency = typeof currenciesTable.$inferSelect;
export type Country = typeof countriesTable.$inferSelect;
export type Incoterm = typeof incotermsTable.$inferSelect;
