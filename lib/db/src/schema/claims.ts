import { pgTable, text, timestamp, jsonb, index, numeric } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { shipmentsTable } from "./shipments";

export const claimsTable = pgTable(
  "claims",
  {
    id: text("id").primaryKey(),
    companyId: text("company_id")
      .notNull()
      .references(() => companiesTable.id),
    shipmentId: text("shipment_id")
      .notNull()
      .references(() => shipmentsTable.id),
    claimNumber: text("claim_number").notNull().unique(),
    status: text("status", {
      enum: ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "DENIED", "CLOSED"],
    })
      .notNull()
      .default("DRAFT"),
    claimType: text("claim_type", {
      enum: ["CARGO_DAMAGE", "CARGO_LOSS", "DELAY", "SHORTAGE", "CONTAMINATION", "OTHER"],
    }).notNull(),
    incidentDate: timestamp("incident_date"),
    incidentDescription: text("incident_description").notNull(),
    estimatedLoss: numeric("estimated_loss", { precision: 12, scale: 2 }),
    currency: text("currency").notNull().default("USD"),
    claimNarrative: text("claim_narrative"),
    requiredDocuments: jsonb("required_documents"),
    coverageAnalysis: jsonb("coverage_analysis"),
    submissionRecommendation: text("submission_recommendation"),
    evidenceKeys: jsonb("evidence_keys"),
    filedBy: text("filed_by"),
    filedAt: timestamp("filed_at"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("claims_company_id_idx").on(table.companyId),
    index("claims_shipment_id_idx").on(table.shipmentId),
    index("claims_status_idx").on(table.status),
    index("claims_type_idx").on(table.claimType),
  ],
);

export type Claim = typeof claimsTable.$inferSelect;
export type InsertClaim = typeof claimsTable.$inferInsert;
