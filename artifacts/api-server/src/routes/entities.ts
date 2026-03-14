import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { entitiesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/entities", async (_req, res) => {
  const entities = await db
    .select()
    .from(entitiesTable)
    .orderBy(entitiesTable.createdAt)
    .limit(100);
  res.json({ data: entities });
});

router.get("/entities/:id", async (req, res) => {
  const { id } = req.params;
  const [entity] = await db
    .select()
    .from(entitiesTable)
    .where(eq(entitiesTable.id, id))
    .limit(1);

  if (!entity) {
    res.status(404).json({ error: "Entity not found" });
    return;
  }
  res.json({ data: entity });
});

export default router;
