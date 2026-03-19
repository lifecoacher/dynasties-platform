import { Router } from "express";
import { db } from "@workspace/db";
import { companiesTable, usersTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getCompanyId } from "../middlewares/tenant.js";
import { requireMinRole } from "../middlewares/auth.js";
import { stripeService } from "../services/stripe-service.js";
import { PLAN_CONFIGS, getPlanConfig, getPlanLimits, PLAN_ORDER, type PlanType } from "../config/plans.js";
import { getStripePublishableKey } from "../stripeClient.js";
import { checkSeatLimit } from "../middlewares/billing-enforcement.js";

const router = Router();

const DEMO_MODE_SERVER = process.env.VITE_DEMO_MODE === "true";

async function resolveStripePriceId(planType: string): Promise<string | null> {
  const result = await db.execute(sql`
    SELECT pr.id
    FROM stripe.prices pr
    JOIN stripe.products p ON pr.product = p.id
    WHERE p.active = true AND pr.active = true
    AND p.metadata->>'planType' = ${planType}
    AND (p.metadata->>'priceType' IS NULL OR p.metadata->>'priceType' = '')
    AND (pr.metadata->>'priceType' IS NULL OR pr.metadata->>'priceType' = 'subscription')
    AND pr.recurring IS NOT NULL
    LIMIT 1
  `);
  return (result.rows[0] as any)?.id || null;
}

async function resolveDeploymentFeePriceId(planType: string): Promise<string | null> {
  const result = await db.execute(sql`
    SELECT pr.id
    FROM stripe.prices pr
    JOIN stripe.products p ON pr.product = p.id
    WHERE p.active = true AND pr.active = true
    AND p.metadata->>'planType' = ${planType}
    AND p.metadata->>'priceType' = 'deployment_fee'
    LIMIT 1
  `);
  return (result.rows[0] as any)?.id || null;
}

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
        const priceMeta = typeof row.price_metadata === 'string'
          ? JSON.parse(row.price_metadata) : (row.price_metadata || {});
        productsMap.get(row.product_id).prices.push({
          id: row.price_id,
          unitAmount: row.unit_amount,
          currency: row.currency,
          interval: recurring?.interval || null,
          type: row.price_type || (recurring ? 'recurring' : 'one_time'),
          priceType: priceMeta.priceType || 'subscription',
        });
      }
    }

    const plans = Array.from(productsMap.values())
      .filter(p => p.planType && !p.metadata?.priceType)
      .sort((a, b) => {
        return (PLAN_ORDER.indexOf(a.planType) ?? 99) - (PLAN_ORDER.indexOf(b.planType) ?? 99);
      });

    res.json({ data: plans });
  } catch (error: any) {
    console.error("Error fetching plans:", error);
    res.json({ data: [] });
  }
});

router.get("/stripe/plan-config", async (_req, res) => {
  const configs = PLAN_ORDER.map(pt => {
    const c = PLAN_CONFIGS[pt];
    return {
      planType: c.planType,
      name: c.name,
      description: c.description,
      monthlyPrice: c.monthlyPriceCents,
      annualPrice: c.annualPriceCents,
      seatLimit: c.seatLimit,
      shipmentLimit: c.shipmentLimit,
      deploymentFeeCents: c.deploymentFeeCents,
      deploymentFeeRequirement: c.deploymentFeeRequirement,
      trialDays: c.trialDays,
      features: c.features,
    };
  });
  res.json({ data: configs });
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

  const limits = getPlanLimits(company.planType);
  const shipmentUsagePercent = limits.shipments > 0
    ? Math.round((company.shipmentsUsedThisCycle / limits.shipments) * 100) : 0;

  const planConfig = company.planType ? getPlanConfig(company.planType) : null;

  let shipmentWarning: string | null = null;
  if (shipmentUsagePercent >= 100) shipmentWarning = "LIMIT_REACHED";
  else if (shipmentUsagePercent >= 90) shipmentWarning = "CRITICAL_USAGE";
  else if (shipmentUsagePercent >= 80) shipmentWarning = "HIGH_USAGE";

  const isTrialExpired = company.billingStatus === "TRIAL"
    && company.trialEndsAt
    && new Date(company.trialEndsAt) <= new Date();

  res.json({
    data: {
      billingStatus: isTrialExpired ? "TRIAL_EXPIRED" : company.billingStatus,
      planType: company.planType,
      stripePriceId: company.stripePriceId,
      stripeCustomerId: company.stripeCustomerId,
      stripeSubscriptionId: company.stripeSubscriptionId,
      seatLimit: company.seatLimit,
      shipmentLimitMonthly: company.shipmentLimitMonthly,
      seatsUsed: Number(seatCount[0]?.count || 0),
      shipmentsUsedThisCycle: company.shipmentsUsedThisCycle,
      shipmentUsagePercent,
      shipmentWarning,
      currentPeriodStart: company.currentPeriodStart,
      currentPeriodEnd: company.currentPeriodEnd,
      trialEndsAt: company.trialEndsAt,
      deploymentFeeStatus: company.deploymentFeeStatus,
      onboardingPaid: company.onboardingPaid,
      onboardingCompletedAt: company.onboardingCompletedAt,
      monthlyPrice: planConfig ? planConfig.monthlyPriceCents : null,
      deploymentFeeCents: planConfig ? planConfig.deploymentFeeCents : null,
      deploymentFeeRequirement: planConfig ? planConfig.deploymentFeeRequirement : null,
      subscription,
    },
  });
});

router.post("/stripe/checkout", requireMinRole("ADMIN"), async (req, res) => {
  const companyId = getCompanyId(req);
  const { planType } = req.body;

  if (!planType || !(planType in PLAN_CONFIGS)) {
    res.status(400).json({ error: "Valid planType required (STARTER, GROWTH, SCALE, ENTERPRISE)" });
    return;
  }

  const config = getPlanConfig(planType);
  if (config.monthlyPriceCents === 0) {
    res.status(400).json({ error: "Enterprise plans require custom setup. Contact sales." });
    return;
  }

  const stripePriceId = await resolveStripePriceId(planType);
  if (!stripePriceId) {
    res.status(500).json({ error: "Stripe price not found for this plan" });
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
  const session = await stripeService.createCheckoutSession({
    customerId,
    subscriptionPriceId: stripePriceId,
    companyId,
    successUrl: `${baseUrl}/settings/billing?checkout=success`,
    cancelUrl: `${baseUrl}/settings/billing?checkout=canceled`,
  });

  res.json({ data: { url: session.url } });
});

router.post("/stripe/deployment-fee-checkout", requireMinRole("ADMIN"), async (req, res) => {
  const companyId = getCompanyId(req);

  const [company] = await db.select().from(companiesTable)
    .where(eq(companiesTable.id, companyId)).limit(1);
  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  if (!company.stripeCustomerId) {
    res.status(400).json({ error: "No Stripe customer linked" });
    return;
  }

  if (!company.planType) {
    res.status(400).json({ error: "No active plan" });
    return;
  }

  if (company.deploymentFeeStatus === "PAID") {
    res.status(400).json({ error: "Deployment fee already paid" });
    return;
  }

  const deploymentPriceId = await resolveDeploymentFeePriceId(company.planType);
  if (!deploymentPriceId) {
    res.status(400).json({ error: "No deployment fee configured for this plan" });
    return;
  }

  const baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0]}`;
  const session = await stripeService.createDeploymentFeeCheckout({
    customerId: company.stripeCustomerId,
    deploymentFeePriceId: deploymentPriceId,
    companyId,
    successUrl: `${baseUrl}/settings/billing?deployment=success`,
    cancelUrl: `${baseUrl}/settings/billing?deployment=canceled`,
  });

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

router.post("/stripe/activate-demo", requireMinRole("ADMIN"), async (req, res) => {
  if (!DEMO_MODE_SERVER) {
    res.status(403).json({ error: "Demo activation is only available in demo mode" });
    return;
  }

  const companyId = getCompanyId(req);
  const { planType } = req.body;

  if (!planType || !(planType in PLAN_CONFIGS)) {
    res.status(400).json({ error: "Valid planType required (STARTER, GROWTH, SCALE, ENTERPRISE)" });
    return;
  }

  const config = getPlanConfig(planType);
  const deployFeeStatus = config.deploymentFeeRequirement === "NOT_REQUIRED"
    ? "NOT_REQUIRED" : "PENDING";

  await db.update(companiesTable)
    .set({
      billingStatus: "ACTIVE" as any,
      planType: planType as any,
      seatLimit: config.seatLimit,
      shipmentLimitMonthly: config.shipmentLimit,
      shipmentsUsedThisCycle: 0,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      deploymentFeeStatus: deployFeeStatus as any,
    })
    .where(eq(companiesTable.id, companyId));

  res.json({
    data: {
      activated: true,
      planType,
      seatLimit: config.seatLimit,
      shipmentLimit: config.shipmentLimit,
      deploymentFeeStatus: deployFeeStatus,
    },
  });
});

router.post("/stripe/start-trial", requireMinRole("ADMIN"), async (req, res) => {
  const companyId = getCompanyId(req);
  const { planType } = req.body;

  if (!planType || !(planType in PLAN_CONFIGS)) {
    res.status(400).json({ error: "Valid planType required" });
    return;
  }

  const [company] = await db.select().from(companiesTable)
    .where(eq(companiesTable.id, companyId)).limit(1);
  if (!company) {
    res.status(404).json({ error: "Company not found" });
    return;
  }

  if (company.billingStatus === "ACTIVE") {
    res.status(400).json({ error: "Already on an active subscription" });
    return;
  }

  if (company.trialEndsAt) {
    res.status(400).json({ error: "Trial already used for this workspace. Please subscribe to continue." });
    return;
  }

  const result = await stripeService.startTrial(companyId, planType as PlanType);
  res.json({ data: result });
});

router.get("/stripe/seat-check", async (req, res) => {
  const companyId = getCompanyId(req);
  const seatInfo = await checkSeatLimit(companyId);
  res.json({ data: seatInfo });
});

export default router;
