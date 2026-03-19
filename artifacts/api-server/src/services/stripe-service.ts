import { db } from "@workspace/db";
import { companiesTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient.js";
import { getPlanConfig, getPlanLimits, PLAN_CONFIGS, type PlanType } from "../config/plans.js";

export { PLAN_CONFIGS, getPlanConfig, getPlanLimits };

export class StripeService {
  async ensureCustomer(companyId: string, email: string, companyName: string): Promise<string> {
    const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);
    if (company?.stripeCustomerId) return company.stripeCustomerId;

    const stripe = await getUncachableStripeClient();
    const customer = await stripe.customers.create({
      email,
      name: companyName,
      metadata: { dynastiesCompanyId: companyId },
    });

    await db.update(companiesTable)
      .set({ stripeCustomerId: customer.id })
      .where(eq(companiesTable.id, companyId));

    return customer.id;
  }

  async createCheckoutSession(opts: {
    customerId: string;
    subscriptionPriceId: string;
    companyId: string;
    successUrl: string;
    cancelUrl: string;
    deploymentFeePriceId?: string;
    trialDays?: number;
  }) {
    const stripe = await getUncachableStripeClient();

    const lineItems: any[] = [{ price: opts.subscriptionPriceId, quantity: 1 }];

    const sessionParams: any = {
      customer: opts.customerId,
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'subscription',
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
      metadata: { dynastiesCompanyId: opts.companyId },
      subscription_data: {
        metadata: { dynastiesCompanyId: opts.companyId },
      },
    };

    if (opts.trialDays && opts.trialDays > 0) {
      sessionParams.subscription_data.trial_period_days = opts.trialDays;
    }

    return stripe.checkout.sessions.create(sessionParams);
  }

  async createDeploymentFeeCheckout(opts: {
    customerId: string;
    deploymentFeePriceId: string;
    companyId: string;
    successUrl: string;
    cancelUrl: string;
  }) {
    const stripe = await getUncachableStripeClient();
    return stripe.checkout.sessions.create({
      customer: opts.customerId,
      payment_method_types: ['card'],
      line_items: [{ price: opts.deploymentFeePriceId, quantity: 1 }],
      mode: 'payment',
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
      metadata: {
        dynastiesCompanyId: opts.companyId,
        type: 'deployment_fee',
      },
    });
  }

  async createPortalSession(customerId: string, returnUrl: string) {
    const stripe = await getUncachableStripeClient();
    return stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  async getProductsWithPrices() {
    const result = await db.execute(sql`
      SELECT
        p.id as product_id,
        p.name as product_name,
        p.description as product_description,
        p.metadata as product_metadata,
        pr.id as price_id,
        pr.unit_amount,
        pr.currency,
        pr.recurring,
        pr.type as price_type,
        pr.metadata as price_metadata
      FROM stripe.products p
      LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
      WHERE p.active = true
      ORDER BY pr.unit_amount ASC NULLS LAST
    `);
    return result.rows;
  }

  async getSubscription(subscriptionId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.subscriptions WHERE id = ${subscriptionId}`
    );
    return result.rows[0] || null;
  }

  async syncSubscriptionToCompany(
    companyId: string,
    subscriptionId: string | null,
    status: string,
    planType: string | null,
    priceId: string | null,
    periodStart?: Date,
    periodEnd?: Date,
    trialEnd?: Date | null,
  ) {
    const limits = getPlanLimits(planType);

    const billingStatus = status === 'active' ? 'ACTIVE'
      : status === 'trialing' ? 'TRIAL'
      : status === 'past_due' ? 'PAST_DUE'
      : status === 'canceled' ? 'CANCELED'
      : status === 'incomplete' ? 'INCOMPLETE'
      : 'INACTIVE';

    const updateFields: any = {
      stripeSubscriptionId: subscriptionId,
      billingStatus,
      planType: planType as any,
      stripePriceId: priceId,
      seatLimit: limits.seats,
      shipmentLimitMonthly: limits.shipments,
      currentPeriodStart: periodStart || null,
      currentPeriodEnd: periodEnd || null,
    };

    if (trialEnd !== undefined) {
      updateFields.trialEndsAt = trialEnd;
    }

    if (billingStatus === 'ACTIVE' || billingStatus === 'TRIAL') {
      const [current] = await db.select({ start: companiesTable.currentPeriodStart })
        .from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);

      if (current && periodStart && current.start &&
          periodStart.getTime() !== current.start.getTime()) {
        updateFields.shipmentsUsedThisCycle = 0;
      }
    }

    await db.update(companiesTable)
      .set(updateFields)
      .where(eq(companiesTable.id, companyId));

    console.log(`[billing-audit] Company ${companyId}: status=${billingStatus}, plan=${planType}, sub=${subscriptionId}`);
  }

  async markDeploymentFeePaid(companyId: string) {
    await db.update(companiesTable)
      .set({
        deploymentFeeStatus: "PAID" as any,
        onboardingPaid: true,
        onboardingCompletedAt: new Date(),
      })
      .where(eq(companiesTable.id, companyId));

    console.log(`[billing-audit] Company ${companyId}: deployment fee marked PAID`);
  }

  async startTrial(companyId: string, planType: PlanType) {
    const config = getPlanConfig(planType);
    const trialEnd = new Date(Date.now() + config.trialDays * 24 * 60 * 60 * 1000);

    const deployFeeStatus = config.deploymentFeeRequirement === "NOT_REQUIRED"
      ? "NOT_REQUIRED" : "PENDING";

    await db.update(companiesTable)
      .set({
        billingStatus: "TRIAL" as any,
        planType: planType as any,
        seatLimit: config.seatLimit,
        shipmentLimitMonthly: config.shipmentLimit,
        shipmentsUsedThisCycle: 0,
        trialEndsAt: trialEnd,
        currentPeriodStart: new Date(),
        currentPeriodEnd: trialEnd,
        deploymentFeeStatus: deployFeeStatus as any,
      })
      .where(eq(companiesTable.id, companyId));

    console.log(`[billing-audit] Company ${companyId}: trial started, plan=${planType}, expires=${trialEnd.toISOString()}`);
    return { trialEndsAt: trialEnd, planType };
  }
}

export const stripeService = new StripeService();
