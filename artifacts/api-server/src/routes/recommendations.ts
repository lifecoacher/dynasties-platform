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
  const shipmentId = String(req.params.id);
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
  const shipmentId = String(req.params.id);

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
  const recId = String(req.params.id);
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
  const recId = String(req.params.id);

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
  const recId = String(req.params.id);

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

function computeImpactScore(rec: typeof recommendationsTable.$inferSelect): number {
  const marginWeight = 0.25;
  const delayWeight = 0.25;
  const riskWeight = 0.2;
  const confidenceWeight = 0.15;
  const recencyWeight = 0.15;

  const marginImpact = Math.min(100, Math.abs(Number(rec.expectedMarginImpactPct ?? 0)) * 10);
  const delayImpact = Math.min(100, Math.abs(Number(rec.expectedDelayImpactDays ?? 0)) * 15);
  const riskImpact = Math.min(100, Number(rec.expectedRiskReduction ?? 0));
  const confidence = Number(rec.confidence ?? 0) * 100;

  const ageMs = Date.now() - new Date(rec.createdAt).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  const recency = Math.max(0, 100 - ageHours * 2);

  return Math.round(
    marginImpact * marginWeight +
    delayImpact * delayWeight +
    riskImpact * riskWeight +
    confidence * confidenceWeight +
    recency * recencyWeight,
  );
}

router.get("/recommendations/prioritized", async (req, res) => {
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
    .limit(100);

  const scored = recs.map((r) => ({
    ...serializeRec(r),
    impactScore: computeImpactScore(r),
    isIntelligenceTriggered: r.intelligenceEnriched === "true",
    isRecentlyChanged: Date.now() - new Date(r.createdAt).getTime() < 6 * 60 * 60 * 1000,
  }));

  scored.sort((a, b) => b.impactScore - a.impactScore);

  const sortBy = req.query.sortBy as string | undefined;
  if (sortBy === "margin") {
    scored.sort((a, b) => Math.abs(b.expectedMarginImpactPct ?? 0) - Math.abs(a.expectedMarginImpactPct ?? 0));
  } else if (sortBy === "delay") {
    scored.sort((a, b) => Math.abs(b.expectedDelayImpactDays ?? 0) - Math.abs(a.expectedDelayImpactDays ?? 0));
  } else if (sortBy === "risk") {
    scored.sort((a, b) => (b.expectedRiskReduction ?? 0) - (a.expectedRiskReduction ?? 0));
  } else if (sortBy === "recency") {
    scored.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const filterType = req.query.type as string | undefined;
  const filterUrgency = req.query.urgency as string | undefined;
  let filtered = scored;
  if (filterType) filtered = filtered.filter((r) => r.type === filterType);
  if (filterUrgency) filtered = filtered.filter((r) => r.urgency === filterUrgency);

  res.json({ data: filtered });
});

router.get("/shipments/:id/recommendations/diff", async (req, res) => {
  const companyId = getCompanyId(req);
  const shipmentId = String(req.params.id);

  const allRecs = await db
    .select()
    .from(recommendationsTable)
    .where(
      and(
        eq(recommendationsTable.companyId, companyId),
        eq(recommendationsTable.shipmentId, shipmentId),
      ),
    )
    .orderBy(desc(recommendationsTable.createdAt));

  const byType = new Map<string, typeof allRecs>();
  for (const r of allRecs) {
    const existing = byType.get(r.type) || [];
    existing.push(r);
    byType.set(r.type, existing);
  }

  const diffs: Array<{
    type: string;
    current: ReturnType<typeof serializeRec>;
    prior: ReturnType<typeof serializeRec> | null;
    changes: {
      urgencyChanged: boolean;
      confidenceChanged: boolean;
      delayImpactChanged: boolean;
      marginImpactChanged: boolean;
      riskReductionChanged: boolean;
      reasonCodesChanged: boolean;
      externalReasonCodesChanged: boolean;
      signalEvidenceChanged: boolean;
      intelEnrichmentChanged: boolean;
    };
    scoreDelta: {
      confidence: number | null;
      delayImpact: number | null;
      marginImpact: number | null;
      riskReduction: number | null;
    };
    triggerSummary: string;
  }> = [];

  for (const [type, recs] of byType) {
    if (recs.length < 2) continue;

    const current = recs[0]!;
    const prior = recs[1]!;

    const priorReasons = JSON.stringify(prior.reasonCodes || []);
    const currentReasons = JSON.stringify(current.reasonCodes || []);
    const priorExtReasons = JSON.stringify(prior.externalReasonCodes || []);
    const currentExtReasons = JSON.stringify(current.externalReasonCodes || []);
    const priorEvidence = JSON.stringify(prior.signalEvidence || []);
    const currentEvidence = JSON.stringify(current.signalEvidence || []);

    const changes = {
      urgencyChanged: prior.urgency !== current.urgency,
      confidenceChanged: Number(prior.confidence) !== Number(current.confidence),
      delayImpactChanged: Number(prior.expectedDelayImpactDays ?? 0) !== Number(current.expectedDelayImpactDays ?? 0),
      marginImpactChanged: Number(prior.expectedMarginImpactPct ?? 0) !== Number(current.expectedMarginImpactPct ?? 0),
      riskReductionChanged: Number(prior.expectedRiskReduction ?? 0) !== Number(current.expectedRiskReduction ?? 0),
      reasonCodesChanged: priorReasons !== currentReasons,
      externalReasonCodesChanged: priorExtReasons !== currentExtReasons,
      signalEvidenceChanged: priorEvidence !== currentEvidence,
      intelEnrichmentChanged: prior.intelligenceEnriched !== current.intelligenceEnriched,
    };

    const scoreDelta = {
      confidence: Math.round((Number(current.confidence) - Number(prior.confidence)) * 100) / 100,
      delayImpact: Math.round((Number(current.expectedDelayImpactDays ?? 0) - Number(prior.expectedDelayImpactDays ?? 0)) * 100) / 100,
      marginImpact: Math.round((Number(current.expectedMarginImpactPct ?? 0) - Number(prior.expectedMarginImpactPct ?? 0)) * 100) / 100,
      riskReduction: Math.round((Number(current.expectedRiskReduction ?? 0) - Number(prior.expectedRiskReduction ?? 0)) * 100) / 100,
    };

    const triggers: string[] = [];
    if (changes.urgencyChanged) triggers.push(`urgency ${prior.urgency} → ${current.urgency}`);
    if (changes.confidenceChanged) triggers.push(`confidence delta ${scoreDelta.confidence > 0 ? "+" : ""}${scoreDelta.confidence}`);
    if (changes.externalReasonCodesChanged) triggers.push("external intelligence signals changed");
    if (changes.signalEvidenceChanged) triggers.push("signal evidence updated");
    if (changes.intelEnrichmentChanged) triggers.push(current.intelligenceEnriched === "true" ? "intelligence enrichment added" : "intelligence enrichment removed");
    if (changes.reasonCodesChanged) triggers.push("internal reason codes changed");
    if (triggers.length === 0) triggers.push("recommendation regenerated with same parameters");

    diffs.push({
      type,
      current: serializeRec(current),
      prior: serializeRec(prior),
      changes,
      scoreDelta,
      triggerSummary: triggers.join("; "),
    });
  }

  res.json({ data: { shipmentId, diffs } });
});

router.post("/shipments/:id/analyze", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  const shipmentId = String(req.params.id);

  publishDecisionJob({
    companyId,
    shipmentId,
    trigger: "manual",
  });

  res.json({ data: { message: "Decision analysis queued", shipmentId } });
});

export default router;
