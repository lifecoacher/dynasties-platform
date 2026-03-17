import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { aiUsageLogsTable } from "@workspace/db/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { getCompanyId } from "../middlewares/tenant.js";
import { requireMinRole } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/ai/usage", requireMinRole("ADMIN"), async (req, res) => {
  const companyId = getCompanyId(req);
  const since = req.query.since ? new Date(req.query.since as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const logs = await db
    .select()
    .from(aiUsageLogsTable)
    .where(and(eq(aiUsageLogsTable.companyId, companyId), gte(aiUsageLogsTable.createdAt, since)))
    .orderBy(desc(aiUsageLogsTable.createdAt))
    .limit(100);

  const totalTokens = logs.reduce((acc, l) => acc + l.inputTokens + l.outputTokens, 0);
  const totalCalls = logs.length;
  const successCalls = logs.filter((l) => l.status === "success").length;

  res.json({
    data: {
      logs,
      summary: {
        totalCalls,
        successCalls,
        errorCalls: totalCalls - successCalls,
        totalTokens,
      },
    },
  });
});

export default router;
