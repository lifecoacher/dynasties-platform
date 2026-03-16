import { pgTable, text, timestamp, real, index, integer } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const portCongestionSnapshotsTable = pgTable(
  "port_congestion_snapshots",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id").references(() => companiesTable.id),
    sourceId: text("source_id").notNull(),
    portCode: text("port_code").notNull(),
    portName: text("port_name").notNull(),
    congestionLevel: text("congestion_level", {
      enum: ["low", "moderate", "high", "critical"],
    }).notNull(),
    waitingVessels: integer("waiting_vessels"),
    avgWaitDays: real("avg_wait_days"),
    avgBerthDays: real("avg_berth_days"),
    capacityUtilization: real("capacity_utilization"),
    trendDirection: text("trend_direction", {
      enum: ["improving", "stable", "worsening"],
    }),
    fingerprint: text("fingerprint").notNull(),
    snapshotTimestamp: timestamp("snapshot_timestamp").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("pcs_company_id_idx").on(table.companyId),
    index("pcs_port_code_idx").on(table.portCode),
    index("pcs_congestion_level_idx").on(table.congestionLevel),
    index("pcs_fingerprint_idx").on(table.fingerprint),
    index("pcs_snapshot_ts_idx").on(table.snapshotTimestamp),
  ],
);

export type PortCongestionSnapshot = typeof portCongestionSnapshotsTable.$inferSelect;
export type InsertPortCongestionSnapshot = typeof portCongestionSnapshotsTable.$inferInsert;
