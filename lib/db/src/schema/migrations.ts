import { pgTable, text, timestamp, jsonb, pgEnum, integer } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const migrationJobStatusEnum = pgEnum("migration_job_status", [
  "UPLOADED",
  "CLASSIFYING",
  "CLASSIFIED",
  "MAPPING",
  "MAPPED",
  "VALIDATING",
  "VALIDATED",
  "IMPORTING",
  "COMPLETED",
  "FAILED",
]);

export const migrationJobsTable = pgTable("migration_jobs", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companiesTable.id),
  status: migrationJobStatusEnum("status").notNull().default("UPLOADED"),
  uploadedFiles: jsonb("uploaded_files").$type<UploadedFile[]>().notNull().default([]),
  classificationResults: jsonb("classification_results").$type<ClassificationResult[]>().default([]),
  mappingResults: jsonb("mapping_results").$type<MappingResult[]>().default([]),
  userCorrections: jsonb("user_corrections").$type<Record<string, any>>().default({}),
  validationSummary: jsonb("validation_summary").$type<ValidationSummary | null>().default(null),
  importResults: jsonb("import_results").$type<ImportResults | null>().default(null),
  errorMessage: text("error_message"),
  totalRows: integer("total_rows").default(0),
  mappedRows: integer("mapped_rows").default(0),
  importedRows: integer("imported_rows").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export interface UploadedFile {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  rowCount: number;
  headers: string[];
  sampleRows: Record<string, any>[];
  allRows: Record<string, any>[];
}

export interface ClassificationResult {
  fileName: string;
  fileType: "shipments" | "invoices" | "customers" | "line_items" | "payments" | "unknown";
  confidence: number;
  reasoning: string;
}

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  confidence: number;
  transformation: string | null;
  userConfirmed: boolean;
}

export interface MappingResult {
  fileName: string;
  fileType: string;
  fieldMappings: FieldMapping[];
  unmappedFields: string[];
  autoMappedPercent: number;
}

export interface ValidationSummary {
  totalCustomers: number;
  totalShipments: number;
  totalInvoices: number;
  totalInvoiceValue: number;
  totalLineItems: number;
  missingRequiredFields: { entity: string; field: string; count: number }[];
  duplicateWarnings: { entity: string; field: string; count: number }[];
  relationshipLinks: { from: string; to: string; linked: number; unlinked: number }[];
}

export interface ImportResults {
  customersCreated: number;
  shipmentsCreated: number;
  invoicesCreated: number;
  lineItemsCreated: number;
  totalRevenue: number;
  errors: string[];
  completedAt: string;
}
