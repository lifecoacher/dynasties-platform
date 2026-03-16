import { Router, type IRouter } from "express";
import shipmentsRouter from "./shipments";
import entitiesRouter from "./entities";
import documentsRouter from "./documents";
import eventsRouter from "./events";
import customersRouter from "./customers";
import referenceRouter from "./reference";
import recommendationsRouter from "./recommendations";
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

export default router;
