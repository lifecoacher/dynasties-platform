import { Router, type IRouter } from "express";
import { getCompanyId } from "../middlewares/tenant.js";
import { requireRole, requireMinRole } from "../middlewares/auth.js";
import {
  getTenantPolicies,
  getEffectivePolicy,
  getAllEffectivePolicies,
  upsertPolicy,
  togglePolicy,
  getPolicyHistory,
  resetPolicyToDefault,
  getGlobalDefaults,
  runPolicySimulation,
  getSimulationHistory,
  getActiveMode,
  getAvailableModes,
  activateMode,
  deactivateMode,
  getModePresets,
  generateReport,
  getReportHistory,
  formatReportForExport,
} from "@workspace/svc-predictive-intelligence";

const router: IRouter = Router();

router.get("/policy/defaults", async (_req, res) => {
  try {
    const defaults = getGlobalDefaults();
    res.json({ data: defaults });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/policy/effective", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const result = await getAllEffectivePolicies(companyId);
    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/policy/effective/:key", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const value = await getEffectivePolicy(companyId, req.params.key);
    res.json({ data: { policyKey: req.params.key, value } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/policy/tenant", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const category = req.query.category as string | undefined;
    const result = await getTenantPolicies(companyId, category as any);
    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/policy/tenant/:key", requireMinRole("MANAGER"), async (req, res): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const userId = (req as any).user?.userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const { value, reason } = req.body;
    if (!value || typeof value !== "object") { res.status(400).json({ error: "Policy value required as object" }); return; }
    const result = await upsertPolicy(companyId, String(req.params.key), value, userId, reason);
    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/policy/tenant/:id/toggle", requireMinRole("MANAGER"), async (req, res): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const userId = (req as any).user?.userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const { isActive } = req.body;
    if (typeof isActive !== "boolean") { res.status(400).json({ error: "isActive required" }); return; }
    await togglePolicy(companyId, String(req.params.id), isActive, userId);
    res.json({ data: { toggled: true } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/policy/tenant/:key/reset", requireRole("ADMIN"), async (req, res): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const userId = (req as any).user?.userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const result = await resetPolicyToDefault(companyId, String(req.params.key), userId);
    if (!result) { res.status(404).json({ error: "Unknown policy key" }); return; }
    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/policy/history", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const policyKey = req.query.policyKey as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const result = await getPolicyHistory(companyId, policyKey, limit);
    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/policy/simulate", requireMinRole("MANAGER"), async (req, res): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const userId = (req as any).user?.userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const { simulationName, policyChanges } = req.body;
    if (!simulationName || !policyChanges) { res.status(400).json({ error: "simulationName and policyChanges required" }); return; }
    const result = await runPolicySimulation(companyId, userId, { simulationName, policyChanges });
    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/policy/simulations", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await getSimulationHistory(companyId, limit);
    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/policy/modes/presets", async (_req, res) => {
  try {
    const presets = getModePresets();
    res.json({ data: presets });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/policy/modes/active", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const mode = await getActiveMode(companyId);
    res.json({ data: mode });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/policy/modes", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const modes = await getAvailableModes(companyId);
    res.json({ data: modes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/policy/modes/activate", requireRole("ADMIN"), async (req, res): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const userId = (req as any).user?.userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const { modeName, customOverrides } = req.body;
    if (!modeName) { res.status(400).json({ error: "modeName required" }); return; }
    const result = await activateMode(companyId, modeName, userId, customOverrides);
    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/policy/modes/deactivate", requireRole("ADMIN"), async (req, res): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const userId = (req as any).user?.userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    await deactivateMode(companyId, userId);
    res.json({ data: { deactivated: true } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/reports/generate", requireMinRole("OPERATOR"), async (req, res): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const userId = (req as any).user?.userId;
    const { reportType, periodStart, periodEnd } = req.body;
    if (!reportType) { res.status(400).json({ error: "reportType required" }); return; }
    const result = await generateReport(
      companyId, reportType, userId,
      periodStart ? new Date(periodStart) : undefined,
      periodEnd ? new Date(periodEnd) : undefined,
    );
    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/reports/history", requireMinRole("OPERATOR"), async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const reportType = req.query.reportType as string | undefined;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await getReportHistory(companyId, reportType as any, limit);
    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/reports/:id/export", requireMinRole("OPERATOR"), async (req, res): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const format = (req.body.format as "JSON" | "CSV") ?? "JSON";
    const reports = await getReportHistory(companyId);
    const report = reports.find((r) => r.id === String(req.params.id));
    if (!report) { res.status(404).json({ error: "Report not found" }); return; }

    const exported = formatReportForExport(report, format);
    res.setHeader("Content-Type", exported.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${exported.filename}"`);
    res.send(exported.content);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
