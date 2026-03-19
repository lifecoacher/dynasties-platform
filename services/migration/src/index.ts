import { db } from "@workspace/db";
import { migrationJobsTable } from "@workspace/db/schema";
import { generateId } from "@workspace/shared-utils";
import { eq, and } from "drizzle-orm";
import { parseFile, type ParsedFile } from "./ingestion.js";
import { classifyFile } from "./classifier.js";
import { mapFields } from "./mapper.js";
import { normalizeData, deduplicateCustomers, type NormalizationOutput } from "./normalizer.js";
import { importData } from "./importer.js";
import type {
  UploadedFile,
  ClassificationResult,
  MappingResult,
  ValidationSummary,
  ImportResults,
} from "@workspace/db/schema";

export { parseFile } from "./ingestion.js";
export { classifyFile } from "./classifier.js";
export { mapFields } from "./mapper.js";
export { normalizeData, deduplicateCustomers } from "./normalizer.js";
export { importData } from "./importer.js";

export async function createMigrationJob(
  companyId: string,
  files: { buffer: Buffer; originalName: string; mimeType: string; size: number }[],
): Promise<{ jobId: string; uploadedFiles: UploadedFile[] }> {
  const jobId = generateId("mig");
  const uploadedFiles: UploadedFile[] = [];
  let totalRows = 0;

  for (const file of files) {
    const parsed = parseFile(file.buffer, file.originalName, file.mimeType);
    for (const p of parsed) {
      uploadedFiles.push({
        fileName: p.fileName,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        rowCount: p.rowCount,
        headers: p.headers,
        sampleRows: p.sampleRows,
        allRows: p.rows,
      });
      totalRows += p.rowCount;
    }
  }

  await db.insert(migrationJobsTable).values({
    id: jobId,
    companyId,
    status: "UPLOADED",
    uploadedFiles,
    totalRows,
  });

  return { jobId, uploadedFiles };
}

export async function runClassification(
  jobId: string,
  companyId: string,
): Promise<ClassificationResult[]> {
  const [job] = await db
    .select()
    .from(migrationJobsTable)
    .where(and(eq(migrationJobsTable.id, jobId), eq(migrationJobsTable.companyId, companyId)))
    .limit(1);

  if (!job) throw new Error("Migration job not found");
  if (!["UPLOADED", "CLASSIFIED"].includes(job.status)) {
    throw new Error(`Cannot classify: job is in ${job.status} state`);
  }

  await db
    .update(migrationJobsTable)
    .set({ status: "CLASSIFYING", updatedAt: new Date() })
    .where(eq(migrationJobsTable.id, jobId));

  const results: ClassificationResult[] = [];
  for (const file of job.uploadedFiles) {
    const result = await classifyFile({
      fileName: file.fileName,
      headers: file.headers,
      sampleRows: file.sampleRows,
      rowCount: file.rowCount,
    });
    results.push(result);
  }

  await db
    .update(migrationJobsTable)
    .set({
      status: "CLASSIFIED",
      classificationResults: results,
      updatedAt: new Date(),
    })
    .where(eq(migrationJobsTable.id, jobId));

  return results;
}

export async function runMapping(
  jobId: string,
  companyId: string,
): Promise<MappingResult[]> {
  const [job] = await db
    .select()
    .from(migrationJobsTable)
    .where(and(eq(migrationJobsTable.id, jobId), eq(migrationJobsTable.companyId, companyId)))
    .limit(1);

  if (!job) throw new Error("Migration job not found");
  if (!["CLASSIFIED", "MAPPED"].includes(job.status)) {
    throw new Error(`Cannot map: job is in ${job.status} state`);
  }

  await db
    .update(migrationJobsTable)
    .set({ status: "MAPPING", updatedAt: new Date() })
    .where(eq(migrationJobsTable.id, jobId));

  const results: MappingResult[] = [];
  const classifications = job.classificationResults || [];

  for (const file of job.uploadedFiles) {
    const classification = classifications.find((c) => c.fileName === file.fileName);
    const fileType = classification?.fileType || "unknown";

    if (fileType === "unknown") continue;

    const result = await mapFields({
      fileName: file.fileName,
      fileType,
      headers: file.headers,
      sampleRows: file.sampleRows,
    });
    results.push(result);
  }

  const totalMapped = results.reduce((s, r) => s + r.fieldMappings.filter((m) => m.targetField).length, 0);
  const totalFields = results.reduce((s, r) => s + r.fieldMappings.length, 0);

  await db
    .update(migrationJobsTable)
    .set({
      status: "MAPPED",
      mappingResults: results,
      mappedRows: totalMapped,
      updatedAt: new Date(),
    })
    .where(eq(migrationJobsTable.id, jobId));

  return results;
}

export async function applyCorrections(
  jobId: string,
  companyId: string,
  corrections: Record<string, any>,
): Promise<MappingResult[]> {
  const [job] = await db
    .select()
    .from(migrationJobsTable)
    .where(and(eq(migrationJobsTable.id, jobId), eq(migrationJobsTable.companyId, companyId)))
    .limit(1);

  if (!job) throw new Error("Migration job not found");

  const mappingResults = [...(job.mappingResults || [])];

  for (const [key, value] of Object.entries(corrections)) {
    const [fileName, sourceField] = key.split("::");
    const mapping = mappingResults.find((m) => m.fileName === fileName);
    if (!mapping) continue;

    const field = mapping.fieldMappings.find((f) => f.sourceField === sourceField);
    if (field) {
      field.targetField = value.targetField || field.targetField;
      field.userConfirmed = true;
      field.confidence = 1.0;
    }
  }

  await db
    .update(migrationJobsTable)
    .set({
      mappingResults,
      userCorrections: corrections,
      updatedAt: new Date(),
    })
    .where(eq(migrationJobsTable.id, jobId));

  return mappingResults;
}

export async function runValidation(
  jobId: string,
  companyId: string,
): Promise<ValidationSummary> {
  const [job] = await db
    .select()
    .from(migrationJobsTable)
    .where(and(eq(migrationJobsTable.id, jobId), eq(migrationJobsTable.companyId, companyId)))
    .limit(1);

  if (!job) throw new Error("Migration job not found");
  if (!["MAPPED", "VALIDATED"].includes(job.status)) {
    throw new Error(`Cannot validate: job is in ${job.status} state`);
  }

  await db
    .update(migrationJobsTable)
    .set({ status: "VALIDATING", updatedAt: new Date() })
    .where(eq(migrationJobsTable.id, jobId));

  const parsedFiles = job.uploadedFiles.map((f) => ({
    fileName: f.fileName,
    rows: f.allRows || f.sampleRows,
  }));

  const normOutput = normalizeData(parsedFiles, job.mappingResults || []);

  await db
    .update(migrationJobsTable)
    .set({
      status: "VALIDATED",
      validationSummary: normOutput.validation,
      updatedAt: new Date(),
    })
    .where(eq(migrationJobsTable.id, jobId));

  return normOutput.validation;
}

export async function runImport(
  jobId: string,
  companyId: string,
  fullData: { fileName: string; rows: Record<string, any>[] }[],
): Promise<ImportResults> {
  const [job] = await db
    .select()
    .from(migrationJobsTable)
    .where(and(eq(migrationJobsTable.id, jobId), eq(migrationJobsTable.companyId, companyId)))
    .limit(1);

  if (!job) throw new Error("Migration job not found");
  if (job.status === "COMPLETED") {
    throw new Error("Migration already completed — cannot re-import");
  }
  if (!["VALIDATED", "MAPPED"].includes(job.status)) {
    throw new Error(`Cannot import: job is in ${job.status} state`);
  }

  await db
    .update(migrationJobsTable)
    .set({ status: "IMPORTING", updatedAt: new Date() })
    .where(eq(migrationJobsTable.id, jobId));

  try {
    const normOutput = normalizeData(fullData, job.mappingResults || []);
    const dedupedEntities = deduplicateCustomers(normOutput.entities);
    const dedupedOutput = { ...normOutput, entities: dedupedEntities };

    const results = await importData(companyId, dedupedOutput);

    await db
      .update(migrationJobsTable)
      .set({
        status: results.errors.length > 0 ? "COMPLETED" : "COMPLETED",
        importResults: results,
        importedRows: results.customersCreated + results.shipmentsCreated + results.invoicesCreated + results.lineItemsCreated,
        updatedAt: new Date(),
      })
      .where(eq(migrationJobsTable.id, jobId));

    return results;
  } catch (err: any) {
    await db
      .update(migrationJobsTable)
      .set({
        status: "FAILED",
        errorMessage: err.message,
        updatedAt: new Date(),
      })
      .where(eq(migrationJobsTable.id, jobId));

    throw err;
  }
}

export async function getMigrationJob(jobId: string, companyId: string) {
  const [job] = await db
    .select()
    .from(migrationJobsTable)
    .where(and(eq(migrationJobsTable.id, jobId), eq(migrationJobsTable.companyId, companyId)))
    .limit(1);

  return job || null;
}
