import { getStripeSync, getUncachableStripeClient } from './stripeClient.js';
import { stripeService } from './services/stripe-service.js';
import { db } from "@workspace/db";
import { companiesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

async function findCompanyByStripeCustomer(customerId: string): Promise<string | null> {
  const [company] = await db.select({ id: companiesTable.id })
    .from(companiesTable)
    .where(eq(companiesTable.stripeCustomerId, customerId))
    .limit(1);
  return company?.id || null;
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    try {
      const event = JSON.parse(payload.toString());
      await WebhookHandlers.handleBusinessLogic(event);
    } catch (err: any) {
      console.error('[webhook] Business logic error:', err.message);
    }
  }

  static async handleBusinessLogic(event: any): Promise<void> {
    const type = event.type;
    const data = event.data?.object;

    if (!data) return;

    console.log(`[webhook] Processing event: ${type} (${event.id})`);

    switch (type) {
      case 'checkout.session.completed': {
        const companyId = data.metadata?.dynastiesCompanyId;
        const isDeploymentFee = data.metadata?.type === 'deployment_fee';

        if (isDeploymentFee && companyId) {
          await stripeService.markDeploymentFeePaid(companyId);
          console.log(`[webhook] Deployment fee paid for company ${companyId}`);
          break;
        }

        const subscriptionId = data.subscription;
        if (companyId && subscriptionId) {
          const stripe = await getUncachableStripeClient();
          const sub: any = await stripe.subscriptions.retrieve(subscriptionId as string);
          const priceId = sub.items?.data?.[0]?.price?.id;
          const planType = sub.items?.data?.[0]?.price?.metadata?.planType || null;

          await stripeService.syncSubscriptionToCompany(
            companyId,
            subscriptionId as string,
            sub.status,
            planType,
            priceId || null,
            sub.current_period_start ? new Date(sub.current_period_start * 1000) : undefined,
            sub.current_period_end ? new Date(sub.current_period_end * 1000) : undefined,
            sub.trial_end ? new Date(sub.trial_end * 1000) : null,
          );
          console.log(`[webhook] checkout.session.completed: company=${companyId}, sub=${subscriptionId}, status=${sub.status}`);
        }
        break;
      }

      case 'invoice.paid': {
        const subscriptionId = data.subscription;
        const customerId = data.customer;
        if (!subscriptionId || !customerId) break;

        const companyId = data.subscription_details?.metadata?.dynastiesCompanyId
          || await findCompanyByStripeCustomer(customerId);
        if (!companyId) break;

        const stripe = await getUncachableStripeClient();
        const sub: any = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = sub.items?.data?.[0]?.price?.id;
        const planType = sub.items?.data?.[0]?.price?.metadata?.planType || null;

        await stripeService.syncSubscriptionToCompany(
          companyId,
          subscriptionId,
          sub.status,
          planType,
          priceId || null,
          sub.current_period_start ? new Date(sub.current_period_start * 1000) : undefined,
          sub.current_period_end ? new Date(sub.current_period_end * 1000) : undefined,
          sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        );
        console.log(`[webhook] invoice.paid: company=${companyId}, sub=${subscriptionId}`);
        break;
      }

      case 'invoice.payment_failed': {
        const subscriptionId = data.subscription;
        const customerId = data.customer;
        if (!subscriptionId || !customerId) break;

        const companyId = data.subscription_details?.metadata?.dynastiesCompanyId
          || await findCompanyByStripeCustomer(customerId);
        if (!companyId) break;

        await stripeService.syncSubscriptionToCompany(
          companyId,
          subscriptionId,
          'past_due',
          null,
          null,
        );
        console.log(`[webhook] invoice.payment_failed: company=${companyId}, sub=${subscriptionId}, status=PAST_DUE`);
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const companyId = data.metadata?.dynastiesCompanyId
          || await findCompanyByStripeCustomer(data.customer);
        if (!companyId) break;

        const priceId = data.items?.data?.[0]?.price?.id;
        const planType = data.items?.data?.[0]?.price?.metadata?.planType || null;

        await stripeService.syncSubscriptionToCompany(
          companyId,
          data.id,
          data.status,
          planType,
          priceId || null,
          data.current_period_start ? new Date(data.current_period_start * 1000) : undefined,
          data.current_period_end ? new Date(data.current_period_end * 1000) : undefined,
          data.trial_end ? new Date(data.trial_end * 1000) : null,
        );
        console.log(`[webhook] ${type}: company=${companyId}, sub=${data.id}, status=${data.status}`);
        break;
      }

      default:
        break;
    }
  }
}
