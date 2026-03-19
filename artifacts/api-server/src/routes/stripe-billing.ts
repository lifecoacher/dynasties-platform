import { Router } from "express";
import { db } from "@workspace/db";
import { companiesTable, usersTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getCompanyId } from "../middlewares/tenant.js";
import { requireMinRole } from "../middlewares/auth.js";
import { stripeService, PLAN_LIMITS } from "../services/stripe-service.js";
import { getStripePublishableKey } from "../stripeClient.js";

const router = Router();

router.get("/stripe/plans", async (_req, res) => {
  try {
    const rows = await stripeService.getProductsWithPrices();
    const productsMap = new Map<string, any>();

    for (const row of rows as any[]) {
      if (!productsMap.has(row.product_id)) {
        const meta = typeof row.product_metadata === 'string'
          ? JSON.parse(row.product_metadata) : (row.product_metadata || {});
        productsMap.set(row.product_id, {
          id: row.product_id,
          name: row.product_name,
          description: row.product_description,
          metadata: meta,
          planType: meta.planType || null,
          features: meta.features ? JSON.parse(meta.features) : [],
          prices: [],
        });
      }
      if (row.price_id) {
        const recurring = typeof row.recurring === 'string'
          ? JSON.parse(row.recurring) : row.recurring;
        productsMap.get(row.product_id).prices.push({
          id: row.price_id,
          unitAmount: row.unit_amount,
          currency: row.currency,
          interval: recurring?.interval || 'month',
        });
      }
    }

    const plans = Array.from(productsMap.values()).sort((a, b) => {
      const order = ['STARTER', 'GROWTH', 'SCALE', 'ENTERPRISE'];
      return (order.indexOf(a.planType) || 0) - (order.indexOf(b.planType) || 0);
    });

    res.json({ data: plans });
  } catch (error: any) {
    console.error("Error fetching plans:", error);
    res.json({ data: [] });
  }
});

router.get("/stripe/subscription", async (req, res) => {
  const companyId = getCompanyId(req);
  const [company] = await db.select().from(companiesTable)
    .where(eq(companiesTable.id, companyId)).limit(1);

  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  const seatCount = await db.select({ count: sql<number>`count(*)` })
    .from(usersTable)
    .where(and(eq(usersTable.companyId, companyId), eq(usersTable.isActive, true)));

  let subscription = null;
  if (company.stripeSubscriptionId) {
    try {
      subscription = await stripeService.getSubscription(company.stripeSubscriptionId);
    } catch {}
  }

  const limits = company.planType ? PLAN_LIMITS[company.planType] || PLAN_LIMITS.STARTER : PLAN_LIMITS.STARTER;
  const shipmentUsagePercent = limits.shipments > 0
    ? Math.round((company.shipmentsUsedThisCycle / limits.shipments) * 100) : 0;

  res.json({
    data: {
      billingStatus: company.billingStatus,
      planType: company.planType,
      planPriceId: company.planPriceId,
      stripeCustomerId: company.stripeCustomerId,
      stripeSubscriptionId: company.stripeSubscriptionId,
      seatLimit: company.seatLimit,
      shipmentLimitMonthly: company.shipmentLimitMonthly,
      seatsUsed: Number(seatCount[0]?.count || 0),
      shipmentsUsedThisCycle: company.shipmentsUsedThisCycle,
      shipmentUsagePercent,
      currentPeriodStart: company.currentPeriodStart,
      currentPeriodEnd: company.currentPeriodEnd,
      subscription,
    },
  });
});

router.post("/stripe/checkout", requireMinRole("ADMIN"), async (req, res) => {
  const companyId = getCompanyId(req);
  const { priceId } = req.body;

  if (!priceId) {
    res.status(400).json({ error: "priceId is required" });
    return;
  }

  const [company] = await db.select().from(companiesTable)
    .where(eq(companiesTable.id, companyId)).limit(1);
  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  const customerId = await stripeService.ensureCustomer(
    companyId,
    company.contactEmail || req.user!.email,
    company.name
  );

  const baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0]}`;
  const session = await stripeService.createCheckoutSession(
    customerId,
    priceId,
    companyId,
    `${baseUrl}/settings/billing?checkout=success`,
    `${baseUrl}/settings/billing?checkout=canceled`
  );

  res.json({ data: { url: session.url } });
});

router.post("/stripe/portal", requireMinRole("ADMIN"), async (req, res) => {
  const companyId = getCompanyId(req);
  const [company] = await db.select().from(companiesTable)
    .where(eq(companiesTable.id, companyId)).limit(1);

  if (!company?.stripeCustomerId) {
    res.status(400).json({ error: "No Stripe customer linked" });
    return;
  }

  const baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0]}`;
  const session = await stripeService.createPortalSession(
    company.stripeCustomerId,
    `${baseUrl}/settings/billing`
  );

  res.json({ data: { url: session.url } });
});

router.get("/stripe/publishable-key", async (_req, res) => {
  try {
    const key = await getStripePublishableKey();
    res.json({ data: { publishableKey: key } });
  } catch {
    res.json({ data: { publishableKey: null } });
  }
});

const DEMO_MODE_SERVER = process.env.VITE_DEMO_MODE === "true";

router.post("/stripe/activate-demo", requireMinRole("ADMIN"), async (req, res) => {
  if (!DEMO_MODE_SERVER) {
    res.status(403).json({ error: "Demo activation is only available in demo mode" });
    return;
  }

  const companyId = getCompanyId(req);
  const { planType } = req.body;

  if (!planType || !PLAN_LIMITS[planType]) {
    res.status(400).json({ error: "Valid planType required (STARTER, GROWTH, SCALE, ENTERPRISE)" });
    return;
  }

  const limits = PLAN_LIMITS[planType];
  await db.update(companiesTable)
    .set({
      billingStatus: "ACTIVE" as any,
      planType: planType as any,
      seatLimit: limits.seats,
      shipmentLimitMonthly: limits.shipments,
      shipmentsUsedThisCycle: 0,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })
    .where(eq(companiesTable.id, companyId));

  res.json({ data: { activated: true, planType, limits } });
});

export default router;
