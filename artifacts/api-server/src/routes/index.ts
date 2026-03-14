import { Router, type IRouter } from "express";
import shipmentsRouter from "./shipments";
import entitiesRouter from "./entities";
import documentsRouter from "./documents";
import eventsRouter from "./events";
import { requireAuth, refreshRole } from "../middlewares/auth.js";
import { requireTenant } from "../middlewares/tenant.js";

const router: IRouter = Router();

router.use(requireAuth);
router.use(refreshRole);
router.use(requireTenant);

router.use(shipmentsRouter);
router.use(entitiesRouter);
router.use(documentsRouter);
router.use(eventsRouter);

export default router;
