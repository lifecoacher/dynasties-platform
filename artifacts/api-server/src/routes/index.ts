import { Router, type IRouter } from "express";
import shipmentsRouter from "./shipments";
import entitiesRouter from "./entities";
import documentsRouter from "./documents";
import eventsRouter from "./events";
import customersRouter from "./customers";
import referenceRouter from "./reference";
import recommendationsRouter from "./recommendations";
import intelligenceRouter from "./intelligence";
import analyticsRouter from "./analytics";
import dossiersRouter from "./dossiers";
import tasksRouter from "./tasks";
import notificationsRouter from "./notifications";
import orchestrationRouter from "./orchestration";
import predictiveRouter from "./predictive";
import strategicRouter from "./strategic";
import policyRouter from "./policy";
import aiUsageRouter from "./ai-usage.js";
import aiAnalysisRouter from "./ai-analysis.js";
import externalSignalsRouter from "./external-signals.js";
import { requireAuth, refreshRole } from "../middlewares/auth.js";
import { requireTenant } from "../middlewares/tenant.js";

const router: IRouter = Router();

router.use(referenceRouter);

router.use(requireAuth);
router.use(refreshRole);
router.use(requireTenant);

router.use(shipmentsRouter);
router.use(entitiesRouter);
router.use(documentsRouter);
router.use(eventsRouter);
router.use(customersRouter);
router.use(recommendationsRouter);
router.use(intelligenceRouter);
router.use(analyticsRouter);
router.use(dossiersRouter);
router.use(tasksRouter);
router.use(notificationsRouter);
router.use(orchestrationRouter);
router.use(predictiveRouter);
router.use(strategicRouter);
router.use(policyRouter);
router.use(aiUsageRouter);
router.use(aiAnalysisRouter);
router.use(externalSignalsRouter);

export default router;
