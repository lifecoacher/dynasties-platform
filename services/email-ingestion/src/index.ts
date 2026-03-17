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

  const storedAttachments: Array<{
    docId: string;
    fileName: string;
    mimeType: string;
    s3Key: string;
    documentType: string;
    confidence: number;
  }> = [];

  for (const attachment of attachments) {
    const docId = generateId();
    const fileName = attachment.filename || `attachment_${docId}`;
    const mimeType = attachment.contentType || "application/octet-stream";
    const buffer = attachment.content;

    const storage = await storeFile(buffer, fileName, `documents/${companyId}`);
    const classification = classifyDocumentType(fileName);

    storedAttachments.push({
      docId,
      fileName,
      mimeType,
      s3Key: storage.key,
      documentType: classification.documentType,
      confidence: classification.confidence,
    });
  }

  await db.transaction(async (tx) => {
    await tx.insert(ingestedEmailsTable).values({
      id: emailId,
      companyId,
      messageId,
      fromAddress,
      toAddress,
      subject,
      bodyText,
      s3Key: emailStorage.key,
      attachmentCount: attachments.length,
      status: attachments.length > 0 ? "PROCESSING" : "PROCESSED",
      processedAt: attachments.length === 0 ? new Date() : undefined,
    });

    for (const att of storedAttachments) {
      await tx.insert(ingestedDocumentsTable).values({
        id: att.docId,
        companyId,
        emailId,
        fileName: att.fileName,
        mimeType: att.mimeType,
        documentType: att.documentType as any,
        documentTypeConfidence: att.confidence,
        s3Key: att.s3Key,
        extractionStatus: "PENDING",
      });
    }
  });

  const documentIds = storedAttachments.map((a) => a.docId);

  for (const att of storedAttachments) {
    publishExtractionJob({
      documentId: att.docId,
      companyId,
      s3Key: att.s3Key,
      fileName: att.fileName,
      mimeType: att.mimeType,
      documentType: att.documentType,
    });
  }

  return { emailId, documentIds, attachmentCount: attachments.length };
}
