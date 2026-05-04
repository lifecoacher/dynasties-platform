import { Router, type IRouter } from "express";
import { getCompanyId } from "../middlewares/tenant.js";
import { requireMinRole } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { z } from "zod";
import { publishAiRuntimeJob } from "@workspace/queue";
import {
  getShipmentAiState,
  getAnalysisHistory,
  getAiEventLog,
  ensureAiState,
  runShipmentAnalysis,
} from "@workspace/svc-ai-runtime";
import { createLogger } from "@workspace/config";

const logger = createLogger("ai-runtime");

const router: IRouter = Router();

function toPercent(v: number | null | undefined): number {
  if (v == null) return 0;
  return v <= 1 ? Math.round(v * 100) : Math.round(v);
}

function mapStateToDto(state: any) {
  return {
    lastAnalysisAt: state.lastAnalyzedAt,
    overallConfidence: toPercent(state.confidenceScore),
    analysisCount: state.analysisVersion ?? 0,
    currentSummary: state.explanationSnapshot ?? null,
    activeRecommendationCount: state.activeRecommendationCount ?? 0,
    analysisStatus: state.analysisStatus,
    aggregatedScores: {
      complianceScore: toPercent(state.complianceRisk != null ? 1 - state.complianceRisk : null),
      riskScore: toPercent(state.riskScore),
      documentReadiness: toPercent(state.operationalReadiness),
      financialHealth: toPercent(state.marginRisk != null ? 1 - state.marginRisk : null),
    },
  };
}

function mapRunToDto(run: any) {
  const output = run.outputSummary || {};
  return {
    id: run.id,
    triggerType: run.triggerType,
    triggerSourceEntityId: run.triggerSourceEntityId,
    triggerSourceEntityType: run.triggerSourceEntityType,
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    durationMs: run.latencyMs ?? null,
    overallConfidence: toPercent(output.confidenceScore),
    recommendationsGenerated: output.recommendationsCreated ?? 0,
    resultSummary: run.errorMessage
      ? `Failed: ${run.errorMessage}`
      : output.recommendationsCreated != null
        ? `Generated ${output.recommendationsCreated} recommendations, superseded ${output.recommendationsSuperseded ?? 0}`
        : null,
    usedFallback: run.usedFallback,
  };
}

router.get("/shipments/:id/ai-state", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const shipmentId = String(req.params.id);

    let state = await getShipmentAiState(shipmentId, companyId);
    if (!state) {
      state = await ensureAiState(shipmentId, companyId);
    }

    res.json(mapStateToDto(state));
  } catch (err: any) {
    logger.error({ err: err.message }, "AI state error");
    res.status(500).json({ error: "Failed to fetch AI state" });
  }
});

router.get("/shipments/:id/ai-analysis-history", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const shipmentId = String(req.params.id);

    const runs = await getAnalysisHistory(shipmentId, companyId);
    res.json(runs.map(mapRunToDto));
  } catch (err: any) {
    logger.error({ err: err.message }, "Analysis history error");
    res.status(500).json({ error: "Failed to fetch analysis history" });
  }
});

router.get("/shipments/:id/ai-event-log", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const shipmentId = String(req.params.id);

    const events = await getAiEventLog(shipmentId, companyId);
    res.json(events);
  } catch (err: any) {
    logger.error({ err: err.message }, "Event log error");
    res.status(500).json({ error: "Failed to fetch event log" });
  }
});

const reanalyzeSchema = z.object({
  force: z.boolean().optional(),
});

router.post(
  "/shipments/:id/ai-reanalyze",
  requireMinRole("OPERATOR"),
  validateBody(reanalyzeSchema),
  async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const shipmentId = String(req.params.id);

      if (req.body.force) {
        const result = await runShipmentAnalysis({
          shipmentId,
          companyId,
          triggerType: "MANUAL",
          triggerSourceEntityId: req.user!.userId,
          triggerSourceEntityType: "user",
        });

        res.json({
          message: result.success ? "Analysis completed" : "Analysis failed",
          runId: result.runId,
          success: result.success,
          error: result.error,
        });
      } else {
        publishAiRuntimeJob({
          companyId,
          shipmentId,
          triggerType: "MANUAL",
          triggerSourceEntityId: req.user!.userId,
          triggerSourceEntityType: "user",
        });

        res.json({
          message: "Analysis queued",
          shipmentId,
        });
      }
    } catch (err: any) {
      logger.error({ err: err.message }, "Reanalyze error");
      res.status(500).json({ error: "Failed to trigger reanalysis" });
    }
  },
);

export default router;
