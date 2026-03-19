import { db } from "@workspace/db";
import {
  documentValidationResultsTable,
  eventsTable,
  shipmentsTable,
  shipmentDocumentsTable,
  ingestedDocumentsTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import {
  runDeterministicChecks,
  deriveStatus,
  type DocumentInfo,
} from "./checker.js";
import { runDocValidationAgent } from "./agent.js";
import { validateDocValidationOutput } from "./validator.js";

export interface DocValidationServiceResult {
  validationId: string | null;
  status: "READY" | "REVIEW" | "BLOCKED";
  readinessLevel: "COMPLETE" | "PARTIAL" | "INSUFFICIENT";
  success: boolean;
  error: string | null;
}

export async function runDocumentValidation(
  shipmentId: string,
  companyId: string,
): Promise<DocValidationServiceResult> {
  console.log(`[doc-validation] starting validation for shipment=${shipmentId}`);

  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(and(eq(shipmentsTable.id, shipmentId), eq(shipmentsTable.companyId, companyId)))
    .limit(1);

  if (!shipment) {
    return {
      validationId: null,
      status: "READY",
      readinessLevel: "COMPLETE",
      success: false,
      error: "Shipment not found or company mismatch",
    };
  }

  const shipmentDocs = await db
    .select({
      sdId: shipmentDocumentsTable.id,
      sdDocType: shipmentDocumentsTable.documentType,
      sdDocId: shipmentDocumentsTable.documentId,
      sdIsGenerated: shipmentDocumentsTable.isGenerated,
    })
    .from(shipmentDocumentsTable)
    .where(
      and(
        eq(shipmentDocumentsTable.shipmentId, shipmentId),
        eq(shipmentDocumentsTable.companyId, companyId),
      ),
    );

  const ingestedDocIds = shipmentDocs
    .filter((sd) => sd.sdDocId)
    .map((sd) => sd.sdDocId as string);

  let ingestedDocs: Array<{
    id: string;
    documentType: string | null;
    fileName: string | null;
    extractedData: any;
    extractionStatus: string | null;
    documentTypeConfidence: number | null;
  }> = [];

  if (ingestedDocIds.length > 0) {
    for (const docId of ingestedDocIds) {
      const [doc] = await db
        .select({
          id: ingestedDocumentsTable.id,
          documentType: ingestedDocumentsTable.documentType,
          fileName: ingestedDocumentsTable.fileName,
          extractedData: ingestedDocumentsTable.extractedData,
          extractionStatus: ingestedDocumentsTable.extractionStatus,
          documentTypeConfidence: ingestedDocumentsTable.documentTypeConfidence,
        })
        .from(ingestedDocumentsTable)
        .where(and(eq(ingestedDocumentsTable.id, docId), eq(ingestedDocumentsTable.companyId, companyId)))
        .limit(1);
      if (doc) ingestedDocs.push(doc);
    }
  }

  const documents: DocumentInfo[] = [];

  for (const sd of shipmentDocs) {
    const ingested = sd.sdDocId
      ? ingestedDocs.find((d) => d.id === sd.sdDocId)
      : null;

    documents.push({
      documentId: sd.sdId,
      documentType: sd.sdDocType || ingested?.documentType || null,
      filename: ingested?.fileName || null,
      extractedData: ingested?.extractedData || null,
      extractionStatus: ingested?.extractionStatus || null,
      documentTypeConfidence: ingested?.documentTypeConfidence || null,
    });
  }

  if (documents.length === 0 && ingestedDocs.length > 0) {
    for (const doc of ingestedDocs) {
      documents.push({
        documentId: doc.id,
        documentType: doc.documentType,
        filename: doc.fileName,
        extractedData: doc.extractedData,
        extractionStatus: doc.extractionStatus,
        documentTypeConfidence: doc.documentTypeConfidence,
      });
    }
  }

  const checkerResult = runDeterministicChecks(
    documents,
    shipment.status || "DRAFT",
    null,
  );

  const { status, readinessLevel } = deriveStatus(checkerResult);

  let reasoningSummary = "";
  let recommendedActions: string[] = [];

  try {
    const agentOutput = await runDocValidationAgent({
      shipmentRef: (shipment as any).reference || (shipment as any).referenceNumber || shipmentId,
      status: shipment.status || "DRAFT",
      missingDocuments: checkerResult.missingDocuments,
      missingFields: checkerResult.missingFields,
      inconsistencies: checkerResult.inconsistencies,
      suspiciousFindings: checkerResult.suspiciousFindings,
      documentCount: documents.length,
    });

    if (agentOutput) {
      const validation = validateDocValidationOutput(agentOutput.raw);
      if (validation.valid) {
        reasoningSummary = validation.data.reasoningSummary;
        recommendedActions = validation.data.recommendedActions;
      } else {
        console.log(`[doc-validation] AI validation failed: ${validation.errors.join("; ")}`);
        reasoningSummary = buildDeterministicSummary(checkerResult, status, documents.length);
        recommendedActions = buildDeterministicActions(checkerResult);
      }
    } else {
      reasoningSummary = buildDeterministicSummary(checkerResult, status, documents.length);
      recommendedActions = buildDeterministicActions(checkerResult);
    }
  } catch (err) {
    console.error("[doc-validation] agent error, using deterministic summary:", err);
    reasoningSummary = buildDeterministicSummary(checkerResult, status, documents.length);
    recommendedActions = buildDeterministicActions(checkerResult);
  }

  const validationId = generateId();
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(documentValidationResultsTable).values({
      id: validationId,
      companyId,
      shipmentId,
      status,
      readinessLevel,
      missingDocuments: checkerResult.missingDocuments,
      missingFields: checkerResult.missingFields,
      inconsistencies: checkerResult.inconsistencies,
      suspiciousFindings: checkerResult.suspiciousFindings,
      recommendedActions,
      reasoningSummary,
      sourceDocuments: checkerResult.sourceDocuments,
      validatedAt: now,
    });

    await tx.insert(eventsTable).values({
      id: generateId(),
      companyId,
      actorType: "SERVICE",
      eventType: "DOC_VALIDATION_COMPLETED",
      entityType: "shipment",
      entityId: shipmentId,
      serviceId: "document-validation",
      metadata: {
        validationId,
        status,
        readinessLevel,
        missingDocCount: checkerResult.missingDocuments.length,
        missingFieldCount: checkerResult.missingFields.length,
        inconsistencyCount: checkerResult.inconsistencies.length,
        suspiciousCount: checkerResult.suspiciousFindings.length,
        documentCount: documents.length,
      },
    });
  });

  console.log(
    `[doc-validation] complete: shipment=${shipmentId} status=${status} readiness=${readinessLevel} docs=${documents.length} missing=${checkerResult.missingDocuments.length} fields=${checkerResult.missingFields.length} inconsistencies=${checkerResult.inconsistencies.length}`,
  );

  return {
    validationId,
    status,
    readinessLevel,
    success: true,
    error: null,
  };
}

function buildDeterministicSummary(
  result: ReturnType<typeof runDeterministicChecks>,
  status: string,
  docCount: number,
): string {
  const parts: string[] = [];
  parts.push(`Reviewed ${docCount} document(s).`);

  if (result.missingDocuments.length > 0) {
    parts.push(`${result.missingDocuments.length} required document(s) missing.`);
  }
  if (result.missingFields.length > 0) {
    parts.push(`${result.missingFields.length} required field(s) missing.`);
  }
  if (result.inconsistencies.length > 0) {
    parts.push(`${result.inconsistencies.length} cross-document inconsistency(ies) detected.`);
  }
  if (result.suspiciousFindings.length > 0) {
    parts.push(`${result.suspiciousFindings.length} suspicious finding(s).`);
  }
  if (status === "READY") {
    parts.push("Documentation appears complete and consistent.");
  }

  return parts.join(" ");
}

function buildDeterministicActions(
  result: ReturnType<typeof runDeterministicChecks>,
): string[] {
  const actions: string[] = [];

  for (const d of result.missingDocuments.filter((m) => m.severity === "CRITICAL")) {
    actions.push(`Obtain ${d.label} before proceeding.`);
  }
  for (const f of result.missingFields.filter((m) => m.severity === "CRITICAL")) {
    actions.push(`Provide ${f.field} in ${f.documentType || "document"}.`);
  }
  for (const i of result.inconsistencies.filter((m) => m.severity === "CRITICAL")) {
    actions.push(`Resolve ${i.field} mismatch across documents.`);
  }

  if (actions.length === 0 && result.missingDocuments.length === 0 && result.missingFields.length === 0) {
    actions.push("Documentation is ready. Proceed with workflow.");
  }

  return actions;
}
