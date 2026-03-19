import { getStripeSync, getUncachableStripeClient } from './stripeClient.js';
import { stripeService, PLAN_LIMITS } from './services/stripe-service.js';

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
      console.error('Webhook business logic error:', err.message);
    }
  }

  static async handleBusinessLogic(event: any): Promise<void> {
    const type = event.type;
    const data = event.data?.object;

    if (!data) return;

    switch (type) {
      case 'checkout.session.completed': {
        const companyId = data.metadata?.dynastiesCompanyId;
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
          );
          console.log(`[webhook] Subscription ${subscriptionId} synced to company ${companyId}`);
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const companyId = data.metadata?.dynastiesCompanyId;
        if (companyId) {
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
          );
          console.log(`[webhook] Subscription ${data.id} ${type} synced to company ${companyId}`);
        }
        break;
      }

      default:
        break;
    }
  }
}
