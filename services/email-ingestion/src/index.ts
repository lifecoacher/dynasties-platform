import { simpleParser, type ParsedMail, type Attachment } from "mailparser";
import { db } from "@workspace/db";
import { ingestedEmailsTable, ingestedDocumentsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { storeFile } from "@workspace/storage";
import { publishExtractionJob } from "@workspace/queue";
import { generateId, classifyDocumentType } from "@workspace/shared-utils";

export interface EmailIngestionResult {
  emailId: string;
  documentIds: string[];
  attachmentCount: number;
}

export async function ingestEmail(
  rawEmail: Buffer,
  companyId: string,
): Promise<EmailIngestionResult> {
  const parsed: ParsedMail = await simpleParser(rawEmail);

  const messageId = parsed.messageId || generateId();
  const fromAddress = typeof parsed.from?.value?.[0]?.address === "string"
    ? parsed.from.value[0].address
    : "unknown@unknown.com";
  const toAddress = typeof parsed.to === "object" && !Array.isArray(parsed.to)
    ? parsed.to.value?.[0]?.address || "unknown@unknown.com"
    : Array.isArray(parsed.to)
      ? parsed.to[0]?.value?.[0]?.address || "unknown@unknown.com"
      : "unknown@unknown.com";
  const subject = parsed.subject || null;
  const bodyText = parsed.text || null;

  const emailStorage = await storeFile(rawEmail, `email_${messageId}.eml`, `emails/${companyId}`);

  const emailId = generateId();
  const attachments: Attachment[] = parsed.attachments || [];

  await db.insert(ingestedEmailsTable).values({
    id: emailId,
    companyId,
    messageId,
    fromAddress,
    toAddress,
    subject,
    bodyText,
    s3Key: emailStorage.key,
    attachmentCount: attachments.length,
    status: "PROCESSING",
  });

  const documentIds: string[] = [];

  for (const attachment of attachments) {
    const docId = generateId();
    const fileName = attachment.filename || `attachment_${docId}`;
    const mimeType = attachment.contentType || "application/octet-stream";
    const buffer = attachment.content;

    const storage = await storeFile(buffer, fileName, `documents/${companyId}`);
    const classification = classifyDocumentType(fileName);

    await db.insert(ingestedDocumentsTable).values({
      id: docId,
      companyId,
      emailId,
      fileName,
      mimeType,
      documentType: classification.documentType,
      documentTypeConfidence: classification.confidence,
      s3Key: storage.key,
      extractionStatus: "PENDING",
    });

    publishExtractionJob({
      documentId: docId,
      companyId,
      s3Key: storage.key,
      fileName,
      mimeType,
      documentType: classification.documentType,
    });

    documentIds.push(docId);
  }

  await db
    .update(ingestedEmailsTable)
    .set({
      status: attachments.length > 0 ? "PROCESSING" : "PROCESSED",
      processedAt: attachments.length === 0 ? new Date() : undefined,
    })
    .where(eq(ingestedEmailsTable.id, emailId));

  return { emailId, documentIds, attachmentCount: attachments.length };
}
