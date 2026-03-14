import { db } from "@workspace/db";
import { ingestedDocumentsTable, ingestedEmailsTable, eventsTable } from "@workspace/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { readFile } from "@workspace/storage";
import { generateId } from "@workspace/shared-utils";
import type { ExtractionJob } from "@workspace/queue";
import { publishPipelineJob } from "@workspace/queue";
import { extractText } from "./ocr.js";
import { runExtractionAgent } from "./agent.js";
import { validateExtractionOutput } from "./validator.js";

export { validateExtractionOutput } from "./validator.js";
export { runExtractionAgent } from "./agent.js";
export { extractText } from "./ocr.js";

export async function processExtractionJob(job: ExtractionJob): Promise<void> {
  const { documentId, companyId, s3Key, fileName, mimeType, documentType } = job;

  console.log(`[extraction] starting doc=${documentId} file=${fileName}`);

  await db
    .update(ingestedDocumentsTable)
    .set({ extractionStatus: "PROCESSING" })
    .where(eq(ingestedDocumentsTable.id, documentId));

  try {
    const buffer = await readFile(s3Key);
    const textResult = await extractText(buffer, mimeType);

    if (!textResult.text || textResult.text.trim().length === 0) {
      await db
        .update(ingestedDocumentsTable)
        .set({
          extractionStatus: "FAILED",
          extractionError: "No text could be extracted from document",
        })
        .where(eq(ingestedDocumentsTable.id, documentId));

      await db.insert(eventsTable).values({
    actorType: "SERVICE",
        id: generateId(),
        companyId,
        eventType: "EXTRACTION_FAILED",
        entityType: "ingested_document",
        entityId: documentId,
        metadata: { reason: "no_text_extracted", fileName },
      });
      return;
    }

    const agentOutput = await runExtractionAgent({
      documentText: textResult.text,
      fileName,
      documentType,
      pageCount: textResult.pageCount,
    });

    const validation = validateExtractionOutput(agentOutput.raw);

    if (!validation.valid) {
      await db
        .update(ingestedDocumentsTable)
        .set({
          extractionStatus: "FAILED",
          extractionError: `Validation failed: ${validation.errors.join("; ")}`,
        })
        .where(eq(ingestedDocumentsTable.id, documentId));

      await db.insert(eventsTable).values({
    actorType: "SERVICE",
        id: generateId(),
        companyId,
        eventType: "AGENT_VALIDATION_FAILURE",
        entityType: "ingested_document",
        entityId: documentId,
        metadata: {
          errors: validation.errors,
          model: agentOutput.model,
          inputTokens: agentOutput.inputTokens,
          outputTokens: agentOutput.outputTokens,
        },
      });

      console.log(`[extraction] validation failed doc=${documentId}: ${validation.errors.join("; ")}`);
      return;
    }

    await db
      .update(ingestedDocumentsTable)
      .set({
        extractionStatus: "EXTRACTED",
        extractedData: validation.data,
      })
      .where(eq(ingestedDocumentsTable.id, documentId));

    await db.insert(eventsTable).values({
    actorType: "SERVICE",
      id: generateId(),
      companyId,
      eventType: "EXTRACTION_COMPLETED",
      entityType: "ingested_document",
      entityId: documentId,
      metadata: {
        fieldCount: validation.fieldCount,
        reviewCount: validation.reviewCount,
        model: agentOutput.model,
        inputTokens: agentOutput.inputTokens,
        outputTokens: agentOutput.outputTokens,
        pageCount: textResult.pageCount,
        textTruncated: textResult.truncated,
      },
    });

    console.log(
      `[extraction] success doc=${documentId} fields=${validation.fieldCount} review=${validation.reviewCount}`,
    );

    await tryMarkEmailProcessed(documentId);
    await tryTriggerPipeline(documentId, companyId);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    await db
      .update(ingestedDocumentsTable)
      .set({
        extractionStatus: "FAILED",
        extractionError: errorMessage,
      })
      .where(eq(ingestedDocumentsTable.id, documentId));

    await db.insert(eventsTable).values({
    actorType: "SERVICE",
      id: generateId(),
      companyId,
      eventType: "EXTRACTION_FAILED",
      entityType: "ingested_document",
      entityId: documentId,
      metadata: { error: errorMessage, fileName },
    });

    console.error(`[extraction] error doc=${documentId}:`, err);
  }
}

async function tryTriggerPipeline(documentId: string, companyId: string): Promise<void> {
  const [doc] = await db
    .select({ emailId: ingestedDocumentsTable.emailId })
    .from(ingestedDocumentsTable)
    .where(eq(ingestedDocumentsTable.id, documentId))
    .limit(1);

  if (!doc) return;

  if (doc.emailId) {
    const pending = await db
      .select({ id: ingestedDocumentsTable.id })
      .from(ingestedDocumentsTable)
      .where(
        and(
          eq(ingestedDocumentsTable.emailId, doc.emailId),
          ne(ingestedDocumentsTable.extractionStatus, "EXTRACTED"),
          ne(ingestedDocumentsTable.extractionStatus, "FAILED"),
        ),
      )
      .limit(1);

    if (pending.length > 0) {
      console.log(`[extraction] email=${doc.emailId} still has pending docs, deferring pipeline`);
      return;
    }

    const allDocs = await db
      .select({ id: ingestedDocumentsTable.id })
      .from(ingestedDocumentsTable)
      .where(
        and(
          eq(ingestedDocumentsTable.emailId, doc.emailId),
          eq(ingestedDocumentsTable.extractionStatus, "EXTRACTED"),
        ),
      );

    publishPipelineJob({
      companyId,
      documentIds: allDocs.map((d) => d.id),
      emailId: doc.emailId,
      trigger: "extraction_complete",
    });

    console.log(`[extraction] pipeline triggered for email=${doc.emailId} with ${allDocs.length} docs`);
  } else {
    publishPipelineJob({
      companyId,
      documentIds: [documentId],
      emailId: null,
      trigger: "extraction_complete",
    });

    console.log(`[extraction] pipeline triggered for standalone doc=${documentId}`);
  }
}

async function tryMarkEmailProcessed(documentId: string): Promise<void> {
  const [doc] = await db
    .select({ emailId: ingestedDocumentsTable.emailId })
    .from(ingestedDocumentsTable)
    .where(eq(ingestedDocumentsTable.id, documentId))
    .limit(1);

  if (!doc?.emailId) return;

  const pending = await db
    .select({ id: ingestedDocumentsTable.id })
    .from(ingestedDocumentsTable)
    .where(
      and(
        eq(ingestedDocumentsTable.emailId, doc.emailId),
        ne(ingestedDocumentsTable.extractionStatus, "EXTRACTED"),
        ne(ingestedDocumentsTable.extractionStatus, "FAILED"),
      ),
    )
    .limit(1);

  if (pending.length === 0) {
    await db
      .update(ingestedEmailsTable)
      .set({ status: "PROCESSED", processedAt: new Date() })
      .where(eq(ingestedEmailsTable.id, doc.emailId));

    console.log(`[extraction] email=${doc.emailId} marked as PROCESSED`);
  }
}
