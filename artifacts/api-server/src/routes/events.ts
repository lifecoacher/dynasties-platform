import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { eventsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/events", async (req, res) => {
  const eventType = req.query["type"] as string | undefined;

  if (eventType) {
    const events = await db
      .select()
      .from(eventsTable)
      .where(
        eq(
          eventsTable.eventType,
          eventType as (typeof eventsTable.eventType.enumValues)[number],
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
    .orderBy(desc(eventsTable.createdAt))
    .limit(100);
  res.json({ data: events });
});

export default router;
