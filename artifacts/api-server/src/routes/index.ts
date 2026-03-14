import { Router, type IRouter } from "express";
import healthRouter from "./health";
import shipmentsRouter from "./shipments";
import entitiesRouter from "./entities";
import documentsRouter from "./documents";
import eventsRouter from "./events";

const router: IRouter = Router();

router.use(healthRouter);
router.use(shipmentsRouter);
router.use(entitiesRouter);
router.use(documentsRouter);
router.use(eventsRouter);

export default router;
