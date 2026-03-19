import { Router, type IRouter } from "express";
import multer from "multer";
import { getCompanyId } from "../middlewares/tenant.js";
import { requireMinRole } from "../middlewares/auth.js";
import {
  createMigrationJob,
  runClassification,
  runMapping,
  applyCorrections,
  runValidation,
  runImport,
  getMigrationJob,
  parseFile,
} from "@workspace/svc-migration";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

const router: IRouter = Router();

router.post("/migration/upload", requireMinRole("OPERATOR"), upload.array("files", 20), async (req, res) => {
  const companyId = getCompanyId(req);
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    res.status(400).json({ error: "No files uploaded" });
    return;
  }

  try {
    const fileInputs = files.map((f) => ({
      buffer: f.buffer,
      originalName: f.originalname,
      mimeType: f.mimetype,
      size: f.size,
    }));

    const result = await createMigrationJob(companyId, fileInputs);
    res.json({ data: result });
  } catch (err: any) {
    console.error("[migration] Upload failed:", err);
    res.status(400).json({ error: err.message });
  }
});

router.post("/migration/:jobId/classify", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  const jobId = req.params.jobId as string;

  try {
    const results = await runClassification(jobId, companyId);
    res.json({ data: results });
  } catch (err: any) {
    console.error("[migration] Classification failed:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/migration/:jobId/map", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  const jobId = req.params.jobId as string;

  try {
    const results = await runMapping(jobId, companyId);
    res.json({ data: results });
  } catch (err: any) {
    console.error("[migration] Mapping failed:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/migration/:jobId/resolve", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  const jobId = req.params.jobId as string;
  const corrections = req.body.corrections || {};

  try {
    const results = await applyCorrections(jobId, companyId, corrections);
    res.json({ data: results });
  } catch (err: any) {
    console.error("[migration] Corrections failed:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/migration/:jobId/validate", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  const jobId = req.params.jobId as string;

  try {
    const result = await runValidation(jobId, companyId);
    res.json({ data: result });
  } catch (err: any) {
    console.error("[migration] Validation failed:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/migration/:jobId/import", requireMinRole("ADMIN"), async (req, res) => {
  const companyId = getCompanyId(req);
  const jobId = req.params.jobId as string;

  try {
    const job = await getMigrationJob(jobId, companyId);
    if (!job) {
      res.status(404).json({ error: "Migration job not found" });
      return;
    }

    const fullData = job.uploadedFiles.map((f) => ({
      fileName: f.fileName,
      rows: f.allRows || f.sampleRows,
    }));

    const results = await runImport(jobId, companyId, fullData);
    res.json({ data: results });
  } catch (err: any) {
    console.error("[migration] Import failed:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/migration/:jobId", async (req, res) => {
  const companyId = getCompanyId(req);
  const jobId = req.params.jobId as string;

  const job = await getMigrationJob(jobId, companyId);
  if (!job) {
    res.status(404).json({ error: "Migration job not found" });
    return;
  }

  res.json({ data: job });
});

export default router;
