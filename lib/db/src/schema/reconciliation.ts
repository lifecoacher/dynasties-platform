import {
  pgTable,
  text,
  timestamp,
  jsonb,
  numeric,
  real,
  index,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { shipmentsTable } from "./shipments";

export const reconciliationStatusEnum = pgEnum("reconciliation_status", [
  "MATCHED",
  "MINOR_VARIANCE",
  "MAJOR_VARIANCE",
  "UNMATCHED",
]);

export const RECONCILIATION_STATUSES = [
  "MATCHED",
  "MINOR_VARIANCE",
  "MAJOR_VARIANCE",
  "UNMATCHED",
] as const;

export type ReconciliationStatus = (typeof RECONCILIATION_STATUSES)[number];

export const carrierInvoicesTable = pgTable(
  "carrier_invoices",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    shipmentId: text("shipment_id").references(() => shipmentsTable.id),
    carrierName: text("carrier_name").notNull(),
    invoiceNumber: text("invoice_number").notNull(),
    invoiceDate: timestamp("invoice_date").notNull(),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("USD"),
    lineItems: jsonb("line_items").$type<CarrierLineItem[]>().default([]),
    rawPayload: jsonb("raw_payload"),
    shipmentReference: text("shipment_reference"),
    matchConfidence: real("match_confidence"),
    matchMethod: text("match_method", {
      enum: ["EXACT", "FUZZY", "MANUAL", "UNMATCHED"],
    }),
    requiresAttention: text("requires_attention", {
      enum: ["true", "false"],
    })
      .notNull()
      .default("false"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("carrier_invoices_company_idx").on(table.companyId),
    index("carrier_invoices_shipment_idx").on(table.shipmentId),
    uniqueIndex("carrier_invoices_company_invoice_number_idx").on(
      table.companyId,
      table.invoiceNumber,
    ),
  ],
);

export const reconciliationResultsTable = pgTable(
  "reconciliation_results",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipmentsTable.id),
    carrierInvoiceId: text("carrier_invoice_id")
      .notNull()
      .references(() => carrierInvoicesTable.id),
    expectedAmount: numeric("expected_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    actualAmount: numeric("actual_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    varianceAmount: numeric("variance_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    variancePercentage: real("variance_percentage").notNull(),
    reconciliationStatus: reconciliationStatusEnum("reconciliation_status").notNull(),
    discrepancyDetails: jsonb("discrepancy_details").$type<DiscrepancyDetails>(),
    reconciledBy: text("reconciled_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("reconciliation_results_company_idx").on(table.companyId),
    index("reconciliation_results_shipment_idx").on(table.shipmentId),
    index("reconciliation_results_carrier_invoice_idx").on(
      table.carrierInvoiceId,
    ),
  ],
);

export interface CarrierLineItem {
  code: string;
  description: string;
  amount: number;
  currency?: string;
  chargeType?: string;
}

export interface DiscrepancyDetails {
  lineItemVariances: LineItemVariance[];
  missingCharges: MissingCharge[];
  unexpectedCharges: UnexpectedCharge[];
  summary: string;
}

export interface LineItemVariance {
  chargeCode: string;
  description: string;
  expectedAmount: number;
  actualAmount: number;
  variance: number;
  variancePercent: number;
}

export interface MissingCharge {
  chargeCode: string;
  description: string;
  expectedAmount: number;
}

export interface UnexpectedCharge {
  code: string;
  description: string;
  amount: number;
}
