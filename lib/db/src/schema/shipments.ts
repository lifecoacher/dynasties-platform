import {
  pgTable,
  text,
  timestamp,
  integer,
  real,
  index,
} from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { entitiesTable } from "./entities";

export const shipmentsTable = pgTable(
  "shipments",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    reference: text("reference").notNull(),
    status: text("status", {
      enum: [
        "DRAFT",
        "PENDING_REVIEW",
        "APPROVED",
        "REJECTED",
        "IN_TRANSIT",
        "DELIVERED",
        "CLOSED",
        "CANCELLED",
      ],
    }).notNull(),
    shipperId: text("shipper_id").references(() => entitiesTable.id),
    consigneeId: text("consignee_id").references(() => entitiesTable.id),
    notifyPartyId: text("notify_party_id").references(() => entitiesTable.id),
    carrierId: text("carrier_id").references(() => entitiesTable.id),
    portOfLoading: text("port_of_loading"),
    portOfDischarge: text("port_of_discharge"),
    placeOfReceipt: text("place_of_receipt"),
    placeOfDelivery: text("place_of_delivery"),
    vessel: text("vessel"),
    voyage: text("voyage"),
    commodity: text("commodity"),
    hsCode: text("hs_code"),
    packageCount: integer("package_count"),
    grossWeight: real("gross_weight"),
    weightUnit: text("weight_unit", { enum: ["KG", "LB"] }),
    volume: real("volume"),
    volumeUnit: text("volume_unit", { enum: ["CBM", "CFT"] }),
    freightTerms: text("freight_terms", {
      enum: ["PREPAID", "COLLECT", "THIRD_PARTY"],
    }),
    incoterms: text("incoterms"),
    etd: timestamp("etd"),
    eta: timestamp("eta"),
    bookingNumber: text("booking_number"),
    blNumber: text("bl_number"),
    operatorNotes: text("operator_notes"),
    approvedAt: timestamp("approved_at"),
    approvedBy: text("approved_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("shipments_company_id_idx").on(table.companyId),
    index("shipments_status_idx").on(table.status),
    index("shipments_reference_idx").on(table.reference),
    index("shipments_created_at_idx").on(table.createdAt),
    index("shipments_shipper_id_idx").on(table.shipperId),
    index("shipments_consignee_id_idx").on(table.consigneeId),
  ],
);

export type Shipment = typeof shipmentsTable.$inferSelect;
export type InsertShipment = typeof shipmentsTable.$inferInsert;
