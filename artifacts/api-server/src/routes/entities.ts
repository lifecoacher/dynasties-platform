import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { entitiesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { getCompanyId } from "../middlewares/tenant.js";

const router: IRouter = Router();

router.get("/entities", async (req, res) => {
  const companyId = getCompanyId(req);
  const entities = await db
    .select()
    .from(entitiesTable)
    .where(eq(entitiesTable.companyId, companyId))
    .orderBy(entitiesTable.createdAt)
    .limit(100);
  res.json({ data: entities });
});

router.get("/entities/:id", async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;
  const [entity] = await db
    .select()
    .from(entitiesTable)
    .where(and(eq(entitiesTable.id, id), eq(entitiesTable.companyId, companyId)))
    .limit(1);

  if (!entity) {
    res.status(404).json({ error: "Entity not found" });
    return;
  }
  res.json({ data: entity });
});

export default router;
