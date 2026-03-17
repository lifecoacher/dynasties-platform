import { Router, type IRouter } from "express";
import { getCompanyId } from "../middlewares/tenant.js";
import {
  computeLaneStrategies,
  getLaneStrategies,
  computeCarrierAllocations,
  getCarrierAllocations,
  generateNetworkRecommendations,
  getNetworkRecommendations,
  acknowledgeNetworkRecommendation,
  updateNetworkRecommendationStatus,
  computePortfolioSnapshot,
  getLatestPortfolioSnapshot,
  getPortfolioHistory,
  computeAttribution,
  getLatestAttribution,
  getAttributionHistory,
} from "@workspace/svc-predictive-intelligence";

const router: IRouter = Router();

router.post("/strategic/lane-strategies/compute", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const results = await computeLaneStrategies(companyId);
    res.json({ data: results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/strategic/lane-strategies", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const limit = parseInt(req.query.limit as string) || 50;
    const results = await getLaneStrategies(companyId, limit);
    res.json({ data: results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/strategic/carrier-allocations/compute", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const lane = req.body?.lane;
    const results = await computeCarrierAllocations(companyId, lane);
    res.json({ data: results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/strategic/carrier-allocations", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const limit = parseInt(req.query.limit as string) || 50;
    const results = await getCarrierAllocations(companyId, limit);
    res.json({ data: results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/strategic/network-recommendations/generate", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const results = await generateNetworkRecommendations(companyId);
    res.json({ data: results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/strategic/network-recommendations", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const scope = req.query.scope as string | undefined;
    const status = req.query.status as string | undefined;
    const results = await getNetworkRecommendations(companyId, { scope, status });
    res.json({ data: results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/strategic/network-recommendations/:id/acknowledge", async (req, res): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const userId = (req as any).user?.userId;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    await acknowledgeNetworkRecommendation(String(req.params.id), userId, companyId);
    res.json({ data: { acknowledged: true } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/strategic/network-recommendations/:id/status", async (req, res): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const { status } = req.body;
    if (!["IN_PROGRESS", "IMPLEMENTED", "DISMISSED"].includes(status)) {
      res.status(400).json({ error: "Invalid status" }); return;
    }
    await updateNetworkRecommendationStatus(String(req.params.id), status, companyId);
    res.json({ data: { updated: true } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/strategic/portfolio/compute", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const period = req.body?.period ?? "DAILY";
    const result = await computePortfolioSnapshot(companyId, period);
    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/strategic/portfolio", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const result = await getLatestPortfolioSnapshot(companyId);
    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/strategic/portfolio/history", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const limit = parseInt(req.query.limit as string) || 30;
    const results = await getPortfolioHistory(companyId, limit);
    res.json({ data: results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/strategic/attribution/compute", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const period = req.body?.period ?? "WEEKLY";
    const result = await computeAttribution(companyId, period);
    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/strategic/attribution", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const period = req.query.period as string | undefined;
    const result = await getLatestAttribution(
      companyId,
      period as "DAILY" | "WEEKLY" | "MONTHLY" | undefined,
    );
    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/strategic/attribution/history", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const limit = parseInt(req.query.limit as string) || 12;
    const results = await getAttributionHistory(companyId, limit);
    res.json({ data: results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/strategic/executive-summary", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const [laneStrats, carrierAllocs, netRecs, portfolio, attribution] = await Promise.all([
      getLaneStrategies(companyId, 10),
      getCarrierAllocations(companyId, 10),
      getNetworkRecommendations(companyId, { status: "OPEN" }),
      getLatestPortfolioSnapshot(companyId),
      getLatestAttribution(companyId),
    ]);

    const stressedLanes = laneStrats.filter((l) =>
      l.strategy !== "STABLE" && l.strategy !== "MONITOR_CLOSELY",
    );
    const problemCarriers = carrierAllocs.filter((c) =>
      c.allocation === "AVOID_CURRENT_CONDITIONS" || c.allocation === "REDUCE_ALLOCATION",
    );
    const criticalRecs = netRecs.filter((r) => r.priority === "CRITICAL" || r.priority === "HIGH");

    res.json({
      data: {
        networkHealth: {
          stressedLanes: stressedLanes.length,
          totalLanes: laneStrats.length,
          problemCarriers: problemCarriers.length,
          totalCarriers: carrierAllocs.length,
          openRecommendations: netRecs.length,
          criticalRecommendations: criticalRecs.length,
        },
        portfolio: portfolio ? {
          activeShipments: portfolio.activeShipments,
          riskDistribution: portfolio.riskDistribution,
          marginAtRisk: portfolio.marginAtRisk,
          mitigatedExposure: portfolio.mitigatedExposure,
          trends: portfolio.trends,
        } : null,
        attribution: attribution ? {
          delaysAvoided: attribution.delaysAvoided,
          marginProtected: attribution.marginProtected,
          interventionsCompleted: attribution.interventionsCompleted,
          recommendationsAccepted: attribution.recommendationsAccepted,
          recommendationsTotal: attribution.recommendationsTotal,
        } : null,
        topStressedLanes: stressedLanes.slice(0, 5),
        topProblemCarriers: problemCarriers.slice(0, 5),
        topRecommendations: criticalRecs.slice(0, 5),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
