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
import { runDocumentValidation } from "@workspace/svc-document-validation";
import { runShipmentDecision } from "@workspace/svc-shipment-decision";
import { getCompanyId } from "../middlewares/tenant.js";
import { requireMinRole } from "../middlewares/auth.js";
import { createLogger } from "@workspace/config";

const logger = createLogger("doc-engine");

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
    logger.error({ err: err.message, companyId, shipmentId }, "Readiness check failed");
    res.status(500).json({ error: "Failed to check document readiness", code: "DOC_READINESS_ERROR", message: "Unable to check document status. Please try again." });
  }
});

router.get("/shipments/:id/generated-documents/list", async (req, res) => {
  const companyId = getCompanyId(req);
  const shipmentId = paramId(req);

  try {
    const docs = await listGeneratedDocuments(companyId, shipmentId);
    res.json({ data: docs });
  } catch (err: any) {
    logger.error({ err: err.message, companyId, shipmentId }, "List documents failed");
    res.status(500).json({ error: "Failed to list documents", code: "DOC_LIST_ERROR", message: "Unable to retrieve generated documents. Please try again." });
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

    let validationResult = null;
    try {
      validationResult = await runDocumentValidation(shipmentId, companyId);
    } catch (err: any) {
      logger.warn({ err: err.message, shipmentId }, "Post-generation validation recheck failed");
    }

    let decisionResult = null;
    try {
      decisionResult = await runShipmentDecision(shipmentId, companyId);
    } catch (err: any) {
      logger.warn({ err: err.message, shipmentId }, "Post-generation decision recompute failed");
    }

    res.json({ data: { ...result, validation: validationResult, decision: decisionResult?.data || null } });
  } catch (err: any) {
    logger.error({ err: err.message, companyId, shipmentId, docType }, "Generation FAILED");
    res.status(500).json({ error: "Document generation failed", code: "DOC_GENERATION_ERROR", message: "Unable to generate document. Please verify shipment data is complete and try again." });
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
    logger.error({ err: err.message, companyId, documentId }, "Document fetch failed");
    res.status(500).json({ error: "Failed to load document", code: "DOC_FETCH_ERROR", message: "Unable to retrieve document. Please try again." });
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

    let validationResult = null;
    try {
      validationResult = await runDocumentValidation(shipmentId, companyId);
    } catch (err: any) {
      logger.warn({ err: err.message, shipmentId }, "Post-regeneration validation recheck failed");
    }

    let decisionResult = null;
    try {
      decisionResult = await runShipmentDecision(shipmentId, companyId);
    } catch (err: any) {
      logger.warn({ err: err.message, shipmentId }, "Post-regeneration decision recompute failed");
    }

    res.json({ data: { ...result, validation: validationResult, decision: decisionResult?.data || null } });
  } catch (err: any) {
    logger.error({ err: err.message, companyId, shipmentId, documentId }, "Regeneration FAILED");
    res.status(500).json({ error: "Document regeneration failed", code: "DOC_REGENERATION_ERROR", message: "Unable to regenerate document. Please try again." });
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
    res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; img-src data:;");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(doc.htmlContent);
  } catch (err: any) {
    logger.error({ err: err.message, companyId, documentId }, "Download failed");
    res.status(500).json({ error: "Failed to download document", code: "DOC_DOWNLOAD_ERROR", message: "Unable to download document. Please try again." });
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
    logger.error({ err: err.message, companyId, shipmentId, docType }, "Version fetch failed");
    res.status(500).json({ error: "Failed to load document versions", code: "DOC_VERSIONS_ERROR", message: "Unable to retrieve document version history. Please try again." });
  }
});

export default router;
