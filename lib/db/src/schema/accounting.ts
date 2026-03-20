import { pgTable, text, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const ACCOUNTING_PROVIDERS = ["QUICKBOOKS", "XERO", "SAGE"] as const;
export type AccountingProvider = (typeof ACCOUNTING_PROVIDERS)[number];

export const CONNECTION_STATUSES = ["NOT_CONNECTED", "CONNECTED", "ERROR", "EXPIRED"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const accountingConnectionsTable = pgTable(
  "accounting_connections",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    provider: text("provider", { enum: [...ACCOUNTING_PROVIDERS] }).notNull(),
    connectionStatus: text("connection_status", { enum: [...CONNECTION_STATUSES] })
      .notNull()
      .default("NOT_CONNECTED"),
    realmId: text("realm_id"),
    companyName: text("company_name"),
    tokenEncrypted: text("token_encrypted"),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    tokenExpiresAt: timestamp("token_expires_at"),
    lastSyncAt: timestamp("last_sync_at"),
    lastSyncStatus: text("last_sync_status"),
    lastSyncError: text("last_sync_error"),
    settings: jsonb("settings"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("acc_conn_company_provider_uniq").on(table.companyId, table.provider),
    index("acc_conn_company_id_idx").on(table.companyId),
    index("acc_conn_status_idx").on(table.connectionStatus),
  ],
);

export type AccountingConnection = typeof accountingConnectionsTable.$inferSelect;
export type InsertAccountingConnection = typeof accountingConnectionsTable.$inferInsert;

export const SYNC_ENTITY_TYPES = ["CUSTOMER", "INVOICE", "PAYMENT"] as const;
export type SyncEntityType = (typeof SYNC_ENTITY_TYPES)[number];

export const SYNC_STATUSES = ["PENDING", "SYNCED", "FAILED", "CONFLICT", "STALE"] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export const SYNC_DIRECTIONS = ["PUSH", "PULL", "BIDIRECTIONAL"] as const;
export type SyncDirection = (typeof SYNC_DIRECTIONS)[number];

export const accountingSyncMappingsTable = pgTable(
  "accounting_sync_mappings",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    connectionId: text("connection_id")
      .notNull()
      .references(() => accountingConnectionsTable.id),
    entityType: text("entity_type", { enum: [...SYNC_ENTITY_TYPES] }).notNull(),
    dynastiesEntityId: text("dynasties_entity_id").notNull(),
    externalEntityId: text("external_entity_id"),
    syncStatus: text("sync_status", { enum: [...SYNC_STATUSES] })
      .notNull()
      .default("PENDING"),
    syncDirection: text("sync_direction", { enum: [...SYNC_DIRECTIONS] })
      .notNull()
      .default("PUSH"),
    lastSyncAt: timestamp("last_sync_at"),
    lastSyncError: text("last_sync_error"),
    externalData: jsonb("external_data"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("acc_sync_entity_uniq").on(table.connectionId, table.entityType, table.dynastiesEntityId),
    index("acc_sync_company_id_idx").on(table.companyId),
    index("acc_sync_connection_id_idx").on(table.connectionId),
    index("acc_sync_entity_type_idx").on(table.entityType),
    index("acc_sync_status_idx").on(table.syncStatus),
    index("acc_sync_external_id_idx").on(table.externalEntityId),
  ],
);

export type AccountingSyncMapping = typeof accountingSyncMappingsTable.$inferSelect;
export type InsertAccountingSyncMapping = typeof accountingSyncMappingsTable.$inferInsert;
