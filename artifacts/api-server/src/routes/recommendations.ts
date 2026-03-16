import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  recommendationsTable,
  recommendationOutcomesTable,
  eventsTable,
} from "@workspace/db/schema";
import { eq, and, desc, inArray, notInArray, sql, lt } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import { getCompanyId } from "../middlewares/tenant.js";
import { validateBody } from "../middlewares/validate.js";
import { requireMinRole } from "../middlewares/auth.js";
import { publishDecisionJob } from "@workspace/queue";
import { z } from "zod";

const router: IRouter = Router();

const TERMINAL_STATUSES = ["EXPIRED", "SUPERSEDED"] as const;
const ACTIVE_STATUSES = ["PENDING", "SHOWN"] as const;

async function expireStaleRecommendations(companyId: string): Promise<number> {
  const now = new Date();
  const result = await db
    .update(recommendationsTable)
    .set({ status: "EXPIRED", updatedAt: now })
    .where(
      and(
        eq(recommendationsTable.companyId, companyId),
        inArray(recommendationsTable.status, [...ACTIVE_STATUSES]),
        lt(recommendationsTable.expiresAt, now),
      ),
    )
    .returning({ id: recommendationsTable.id });
  return result.length;
}

function serializeRec(r: typeof recommendationsTable.$inferSelect) {
  return {
    ...r,
    confidence: Number(r.confidence),
    expectedDelayImpactDays: r.expectedDelayImpactDays != null ? Number(r.expectedDelayImpactDays) : null,
    expectedMarginImpactPct: r.expectedMarginImpactPct != null ? Number(r.expectedMarginImpactPct) : null,
    expectedRiskReduction: r.expectedRiskReduction != null ? Number(r.expectedRiskReduction) : null,
  };
}

const respondSchema = z.object({
  action: z.enum(["ACCEPTED", "MODIFIED", "REJECTED"]),
  modificationNotes: z.string().optional(),
});

const outcomeSchema = z.object({
  actualDelayDays: z.number().optional(),
  actualClaimOccurred: z.enum(["YES", "NO", "PENDING"]).optional(),
  actualCostDelta: z.number().optional(),
  actualMarginDelta: z.number().optional(),
  postDecisionNotes: z.string().optional(),
  outcomeEvaluation: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE"]).optional(),
});

router.get("/shipments/:id/recommendations", async (req, res) => {
  const companyId = getCompanyId(req);
  const shipmentId = req.params.id;
  const includeHistory = req.query.history === "true";

  await expireStaleRecommendations(companyId);

  let query = db
    .select()
    .from(recommendationsTable)
    .where(
      and(
        eq(recommendationsTable.shipmentId, shipmentId),
        eq(recommendationsTable.companyId, companyId),
        ...(includeHistory ? [] : [notInArray(recommendationsTable.status, [...TERMINAL_STATUSES])]),
      ),
    )
    .orderBy(desc(recommendationsTable.createdAt));

  const recs = await query;
  res.json({ data: recs.map(serializeRec) });
});

router.get("/shipments/:id/recommendations/history", async (req, res) => {
  const companyId = getCompanyId(req);
  const shipmentId = req.params.id;

  const recs = await db
    .select()
    .from(recommendationsTable)
    .where(
      and(
        eq(recommendationsTable.shipmentId, shipmentId),
        eq(recommendationsTable.companyId, companyId),
      ),
    )
    .orderBy(desc(recommendationsTable.createdAt));

  res.json({ data: recs.map(serializeRec) });
});

router.get("/recommendations/pending", async (req, res) => {
  const companyId = getCompanyId(req);

  await expireStaleRecommendations(companyId);

  const recs = await db
    .select()
    .from(recommendationsTable)
    .where(
      and(
        eq(recommendationsTable.companyId, companyId),
        inArray(recommendationsTable.status, [...ACTIVE_STATUSES]),
      ),
    )
    .orderBy(desc(recommendationsTable.createdAt))
    .limit(50);

  res.json({ data: recs.map(serializeRec) });
});

router.post("/recommendations/:id/respond", requireMinRole("OPERATOR"), validateBody(respondSchema), async (req, res) => {
  const companyId = getCompanyId(req);
  const recId = req.params.id;
  const { action, modificationNotes } = req.body;

  const [rec] = await db
    .select()
    .from(recommendationsTable)
    .where(
      and(
        eq(recommendationsTable.id, recId),
        eq(recommendationsTable.companyId, companyId),
      ),
    )
    .limit(1);

  if (!rec) {
    res.status(404).json({ error: "Recommendation not found" });
    return;
  }

  if ([...TERMINAL_STATUSES].includes(rec.status as any)) {
    res.status(400).json({ error: `Cannot respond to a ${rec.status} recommendation` });
    return;
  }

  const newStatus = action === "ACCEPTED" ? "ACCEPTED" : action === "MODIFIED" ? "MODIFIED" : "REJECTED";

  await db.transaction(async (tx) => {
    await tx
      .update(recommendationsTable)
      .set({
        status: newStatus,
        respondedAt: new Date(),
        respondedBy: req.user!.userId,
      })
      .where(eq(recommendationsTable.id, recId));

    await tx.insert(recommendationOutcomesTable).values({
      id: generateId(),
      companyId,
      recommendationId: recId,
      shipmentId: rec.shipmentId,
      action,
      modificationNotes: modificationNotes || null,
      actorId: req.user!.userId,
      actorType: "USER",
      outcomeEvaluation: "PENDING",
    });

    await tx.insert(eventsTable).values({
      id: generateId(),
      companyId,
      eventType: "RECOMMENDATION_RESPONDED",
      entityType: "recommendation",
      entityId: recId,
      actorType: "USER",
      userId: req.user!.userId,
      metadata: {
        action,
        shipmentId: rec.shipmentId,
        recommendationType: rec.type,
        modificationNotes,
      },
    });
  });

  res.json({ data: { id: recId, status: newStatus, action } });
});

router.post("/recommendations/:id/outcome", requireMinRole("OPERATOR"), validateBody(outcomeSchema), async (req, res) => {
  const companyId = getCompanyId(req);
  const recId = req.params.id;

  const [rec] = await db
    .select()
    .from(recommendationsTable)
    .where(
      and(
        eq(recommendationsTable.id, recId),
        eq(recommendationsTable.companyId, companyId),
      ),
    )
    .limit(1);

  if (!rec) {
    res.status(404).json({ error: "Recommendation not found" });
    return;
  }

  const outcomes = await db
    .select()
    .from(recommendationOutcomesTable)
    .where(eq(recommendationOutcomesTable.recommendationId, recId))
    .orderBy(desc(recommendationOutcomesTable.createdAt))
    .limit(1);

  if (outcomes.length === 0) {
    res.status(400).json({ error: "No response recorded for this recommendation yet" });
    return;
  }

  const outcomeId = outcomes[0]!.id;

  await db.transaction(async (tx) => {
    await tx
      .update(recommendationOutcomesTable)
      .set({
        actualDelayDays: req.body.actualDelayDays ?? null,
        actualClaimOccurred: req.body.actualClaimOccurred ?? null,
        actualCostDelta: req.body.actualCostDelta?.toString() ?? null,
        actualMarginDelta: req.body.actualMarginDelta?.toString() ?? null,
        postDecisionNotes: req.body.postDecisionNotes ?? null,
        outcomeEvaluation: req.body.outcomeEvaluation ?? "PENDING",
        evaluatedAt: new Date(),
      })
      .where(eq(recommendationOutcomesTable.id, outcomeId));

    if (rec.status === "ACCEPTED" || rec.status === "MODIFIED") {
      await tx
        .update(recommendationsTable)
        .set({ status: "IMPLEMENTED" })
        .where(eq(recommendationsTable.id, recId));
    }

    await tx.insert(eventsTable).values({
      id: generateId(),
      companyId,
      eventType: "RECOMMENDATION_OUTCOME_RECORDED",
      entityType: "recommendation",
      entityId: recId,
      actorType: "USER",
      userId: req.user!.userId,
      metadata: {
        outcomeId,
        shipmentId: rec.shipmentId,
        outcomeEvaluation: req.body.outcomeEvaluation,
      },
    });
  });

  res.json({ data: { id: outcomeId, status: "recorded" } });
});

router.get("/recommendations/:id/outcomes", async (req, res) => {
  const companyId = getCompanyId(req);
  const recId = req.params.id;

  const [rec] = await db
    .select({ id: recommendationsTable.id })
    .from(recommendationsTable)
    .where(
      and(
        eq(recommendationsTable.id, recId),
        eq(recommendationsTable.companyId, companyId),
      ),
    )
    .limit(1);

  if (!rec) {
    res.status(404).json({ error: "Recommendation not found" });
    return;
  }

  const outcomes = await db
    .select()
    .from(recommendationOutcomesTable)
    .where(eq(recommendationOutcomesTable.recommendationId, recId))
    .orderBy(desc(recommendationOutcomesTable.createdAt));

  const data = outcomes.map((o) => ({
    ...o,
    actualDelayDays: o.actualDelayDays != null ? Number(o.actualDelayDays) : null,
    actualCostDelta: o.actualCostDelta != null ? Number(o.actualCostDelta) : null,
    actualMarginDelta: o.actualMarginDelta != null ? Number(o.actualMarginDelta) : null,
  }));

  res.json({ data });
});

router.post("/shipments/:id/analyze", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  const shipmentId = req.params.id;

  publishDecisionJob({
    companyId,
    shipmentId,
    trigger: "manual",
  });

  res.json({ data: { message: "Decision analysis queued", shipmentId } });
});

export default router;
