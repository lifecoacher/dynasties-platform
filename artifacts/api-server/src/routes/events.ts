import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { eventsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getCompanyId } from "../middlewares/tenant.js";

const router: IRouter = Router();

router.get("/events", async (req, res) => {
  const companyId = getCompanyId(req);
  const eventType = req.query["type"] as string | undefined;

  if (eventType) {
    const events = await db
      .select()
      .from(eventsTable)
      .where(
        and(
          eq(eventsTable.companyId, companyId),
          eq(eventsTable.eventType, eventType),
        ),
      )
      .orderBy(desc(eventsTable.createdAt))
      .limit(100);
    res.json({ data: events });
    return;
  }

  const events = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.companyId, companyId))
    .orderBy(desc(eventsTable.createdAt))
    .limit(100);
  res.json({ data: events });
});

export default router;
