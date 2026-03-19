import { Router, type IRouter } from "express";
import {
  getDocumentReadiness,
  generateDocument,
  getGeneratedDocument,
  listGeneratedDocuments,
  getDocumentVersions,
  type GeneratedDocType,
} from "@workspace/svc-doc-engine";
import { GENERATED_DOC_TYPES } from "@workspace/db/schema";
import { getCompanyId } from "../middlewares/tenant.js";
import { requireMinRole } from "../middlewares/auth.js";

const router: IRouter = Router();

function paramId(req: { params: Record<string, unknown> }): string {
  return req.params.id as string;
}

router.get("/shipments/:id/generated-documents", async (req, res) => {
  const companyId = getCompanyId(req);
  const shipmentId = paramId(req);

  try {
    const readiness = await getDocumentReadiness(companyId, shipmentId);
    res.json({ data: readiness });
  } catch (err: any) {
    console.error("[doc-engine] Readiness check failed:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/shipments/:id/generated-documents/list", async (req, res) => {
  const companyId = getCompanyId(req);
  const shipmentId = paramId(req);

  try {
    const docs = await listGeneratedDocuments(companyId, shipmentId);
    res.json({ data: docs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/shipments/:id/generated-documents/:type/generate", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  const shipmentId = paramId(req);
  const docType = (req.params as Record<string, string>).type as string;

  if (!GENERATED_DOC_TYPES.includes(docType as GeneratedDocType)) {
    res.status(400).json({ error: `Invalid document type: ${docType}` });
    return;
  }

  try {
    const result = await generateDocument(
      companyId,
      shipmentId,
      docType as GeneratedDocType,
      (req as any).user?.id,
    );

    if (!result.success) {
      res.status(422).json({ error: result.error, data: result });
      return;
    }

    res.json({ data: result });
  } catch (err: any) {
    console.error("[doc-engine] Generation failed:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/shipments/:id/generated-documents/:documentId", async (req, res) => {
  const companyId = getCompanyId(req);
  const shipmentId = paramId(req);
  const documentId = (req.params as Record<string, string>).documentId;

  try {
    const doc = await getGeneratedDocument(companyId, documentId, shipmentId);
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    res.json({ data: doc });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/shipments/:id/generated-documents/:documentId/regenerate", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  const shipmentId = paramId(req);
  const documentId = (req.params as Record<string, string>).documentId;

  try {
    const existing = await getGeneratedDocument(companyId, documentId, shipmentId);
    if (!existing) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    const result = await generateDocument(
      companyId,
      shipmentId,
      existing.documentType as GeneratedDocType,
      (req as any).user?.id,
    );

    if (!result.success) {
      res.status(422).json({ error: result.error, data: result });
      return;
    }

    res.json({ data: result });
  } catch (err: any) {
    console.error("[doc-engine] Regeneration failed:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/shipments/:id/generated-documents/:documentId/download", async (req, res) => {
  const companyId = getCompanyId(req);
  const shipmentId = paramId(req);
  const documentId = (req.params as Record<string, string>).documentId;

  try {
    const doc = await getGeneratedDocument(companyId, documentId, shipmentId);
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    if (!doc.htmlContent) {
      res.status(404).json({ error: "Document content not available" });
      return;
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${doc.documentType.toLowerCase()}_v${doc.versionNumber}.html"`,
    );
    res.send(doc.htmlContent);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/shipments/:id/generated-documents/:type/versions", async (req, res) => {
  const companyId = getCompanyId(req);
  const shipmentId = paramId(req);
  const docType = (req.params as Record<string, string>).type as string;

  if (!GENERATED_DOC_TYPES.includes(docType as GeneratedDocType)) {
    res.status(400).json({ error: `Invalid document type: ${docType}` });
    return;
  }

  try {
    const versions = await getDocumentVersions(companyId, shipmentId, docType as GeneratedDocType);
    res.json({ data: versions });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
