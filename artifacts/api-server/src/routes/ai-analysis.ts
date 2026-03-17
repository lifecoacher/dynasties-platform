import { Router, type IRouter } from "express";
import { getCompanyId } from "../middlewares/tenant.js";
import { requireMinRole } from "../middlewares/auth.js";
import { runAIAnalysis } from "@workspace/svc-decision-engine";

const router: IRouter = Router();

router.post(
  "/shipments/:id/ai-analyze",
  requireMinRole("OPERATOR"),
  async (req, res) => {
    const companyId = getCompanyId(req);
    const shipmentId = String(req.params.id);

    try {
      const result = await runAIAnalysis(shipmentId, companyId);

      res.json({
        data: {
          shipmentId: result.shipmentId,
          deterministicRecommendations: result.deterministicRecommendations.map((r) => ({
            type: r.type,
            title: r.title,
            explanation: r.explanation,
            urgency: r.urgency,
            confidence: r.confidence,
            recommendedAction: r.recommendedAction,
          })),
          aiAnalysis: result.aiEnrichment.status === "success"
            ? {
                recommendations: result.aiEnrichment.aiRecommendations?.recommendations ?? [],
                overallAssessment: result.aiEnrichment.aiOverallAssessment,
                riskNarrative: result.aiEnrichment.aiRiskNarrative,
              }
            : null,
          analysisInputs: result.analysisInputs,
          aiMetadata: {
            model: result.aiEnrichment.model,
            inputTokens: result.aiEnrichment.inputTokens,
            outputTokens: result.aiEnrichment.outputTokens,
            latencyMs: result.aiEnrichment.latencyMs,
            estimatedCostUsd: result.aiEnrichment.estimatedCostUsd,
            status: result.aiEnrichment.status,
            errorMessage: result.aiEnrichment.errorMessage,
          },
        },
      });
    } catch (err: any) {
      console.error(`[ai-analysis] error for shipment=${shipmentId}:`, err);
      res.status(err.message?.includes("not found") ? 404 : 500).json({
        error: err.message || "AI analysis failed",
      });
    }
  },
);

export default router;
