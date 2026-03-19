import { db } from "@workspace/db";
import { companiesTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient.js";

export const PLAN_LIMITS: Record<string, { seats: number; shipments: number }> = {
  STARTER: { seats: 3, shipments: 50 },
  GROWTH: { seats: 10, shipments: 250 },
  SCALE: { seats: 25, shipments: 1000 },
  ENTERPRISE: { seats: 999, shipments: 99999 },
};

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

  async createCheckoutSession(
    customerId: string,
    priceId: string,
    companyId: string,
    successUrl: string,
    cancelUrl: string
  ) {
    const stripe = await getUncachableStripeClient();
    return await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { dynastiesCompanyId: companyId },
      subscription_data: {
        metadata: { dynastiesCompanyId: companyId },
      },
    });
  }

  async createPortalSession(customerId: string, returnUrl: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.billingPortal.sessions.create({
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
  ) {
    const limits = planType ? PLAN_LIMITS[planType] || PLAN_LIMITS.STARTER : PLAN_LIMITS.STARTER;

    const billingStatus = status === 'active' ? 'ACTIVE'
      : status === 'trialing' ? 'TRIALING'
      : status === 'past_due' ? 'PAST_DUE'
      : status === 'canceled' ? 'CANCELED'
      : 'INACTIVE';

    await db.update(companiesTable)
      .set({
        stripeSubscriptionId: subscriptionId,
        billingStatus: billingStatus as any,
        planType: planType as any,
        planPriceId: priceId,
        seatLimit: limits.seats,
        shipmentLimitMonthly: limits.shipments,
        currentPeriodStart: periodStart || null,
        currentPeriodEnd: periodEnd || null,
      })
      .where(eq(companiesTable.id, companyId));
  }
}

export const stripeService = new StripeService();
