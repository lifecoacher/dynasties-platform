import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ingestedDocumentsTable, ingestedEmailsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { storeFile } from "@workspace/storage";
import { publishExtractionJob } from "@workspace/queue";
import { generateId, classifyDocumentType } from "@workspace/shared-utils";
import multer from "multer";
import { getCompanyId } from "../middlewares/tenant.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const router: IRouter = Router();

router.get("/documents", async (req, res) => {
  const companyId = getCompanyId(req);
  const documents = await db
    .select()
    .from(ingestedDocumentsTable)
    .where(eq(ingestedDocumentsTable.companyId, companyId))
    .orderBy(ingestedDocumentsTable.createdAt)
    .limit(50);
  res.json({ data: documents });
});

router.get("/documents/:id", async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;
  const [doc] = await db
    .select()
    .from(ingestedDocumentsTable)
    .where(and(eq(ingestedDocumentsTable.id, id), eq(ingestedDocumentsTable.companyId, companyId)))
    .limit(1);

  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.json({ data: doc });
});

router.post("/documents/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file provided. Use multipart/form-data with field name 'file'." });
      return;
    }

    const companyId = getCompanyId(req);
    const docId = generateId();
    const fileName = file.originalname || `upload_${docId}`;
    const mimeType = file.mimetype || "application/octet-stream";

    const storage = await storeFile(file.buffer, fileName, `documents_${companyId}`);
    const classification = classifyDocumentType(fileName, file.buffer.toString("utf-8").slice(0, 500));

    await db.insert(ingestedDocumentsTable).values({
      id: docId,
      companyId,
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

    res.status(201).json({
      data: {
        id: docId,
        fileName,
        documentType: classification.documentType,
        s3Key: storage.key,
        extractionStatus: "PENDING",
      },
    });
  } catch (err) {
    console.error("[upload] error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

router.get("/emails", async (req, res) => {
  const companyId = getCompanyId(req);
  const emails = await db
    .select()
    .from(ingestedEmailsTable)
    .where(eq(ingestedEmailsTable.companyId, companyId))
    .orderBy(ingestedEmailsTable.createdAt)
    .limit(50);
  res.json({ data: emails });
});

router.post("/emails/ingest", upload.single("email"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No email file provided. Use multipart/form-data with field name 'email'." });
      return;
    }

    const companyId = getCompanyId(req);
    const { ingestEmail } = await import("@workspace/svc-email-ingestion");
    const result = await ingestEmail(file.buffer, companyId);

    res.status(201).json({ data: result });
  } catch (err) {
    console.error("[email-ingest] error:", err);
    res.status(500).json({ error: "Email ingestion failed" });
  }
});

export default router;
