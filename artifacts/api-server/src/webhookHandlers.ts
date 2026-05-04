import Stripe from 'stripe';
import { getStripeSync, getUncachableStripeClient, getStripeSecretKey } from './stripeClient.js';
import { stripeService } from './services/stripe-service.js';
import { db } from "@workspace/db";
import { companiesTable, stripeWebhookEventsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import { recordWebhook } from "./routes/metrics.js";
import { createLogger } from "@workspace/config";

const logger = createLogger("webhook");

async function findCompanyByStripeCustomer(customerId: string): Promise<string | null> {
  const [company] = await db.select({ id: companiesTable.id })
    .from(companiesTable)
    .where(eq(companiesTable.stripeCustomerId, customerId))
    .limit(1);
  return company?.id || null;
}

async function checkAndRecordEvent(
  stripeEventId: string,
  eventType: string,
): Promise<{ shouldProcess: boolean; eventRecordId: string }> {
  const eventRecordId = generateId("swe");

  try {
    await db.insert(stripeWebhookEventsTable).values({
      id: eventRecordId,
      stripeEventId,
      eventType,
      status: "PROCESSING",
    });
    return { shouldProcess: true, eventRecordId };
  } catch (err: any) {
    if (err.code === "23505") {
      const [existing] = await db
        .select()
        .from(stripeWebhookEventsTable)
        .where(eq(stripeWebhookEventsTable.stripeEventId, stripeEventId))
        .limit(1);

      if (existing?.status === "FAILED") {
        await db
          .update(stripeWebhookEventsTable)
          .set({ status: "PROCESSING", error: null })
          .where(eq(stripeWebhookEventsTable.id, existing.id));
        return { shouldProcess: true, eventRecordId: existing.id };
      }

      return { shouldProcess: false, eventRecordId: existing?.id || eventRecordId };
    }
    throw err;
  }
}

async function markEventProcessed(eventRecordId: string): Promise<void> {
  await db
    .update(stripeWebhookEventsTable)
    .set({ status: "PROCESSED", processedAt: new Date() })
    .where(eq(stripeWebhookEventsTable.id, eventRecordId));
}

async function markEventFailed(eventRecordId: string, error: string): Promise<void> {
  await db
    .update(stripeWebhookEventsTable)
    .set({ status: "FAILED", error })
    .where(eq(stripeWebhookEventsTable.id, eventRecordId));
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

    const secretKey = await getStripeSecretKey();
    const stripe = new Stripe(secretKey, { apiVersion: '2025-08-27.basil' as any });

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event: Stripe.Event;

    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } else {
      if (process.env.NODE_ENV === "production") {
        throw new Error("STRIPE_WEBHOOK_SECRET is required in production");
      }
      logger.warn("STRIPE_WEBHOOK_SECRET not set — signature verification skipped (development only)");
      event = JSON.parse(payload.toString()) as Stripe.Event;
    }

    const { shouldProcess, eventRecordId } = await checkAndRecordEvent(event.id, event.type);
    if (!shouldProcess) {
      logger.info({ eventId: event.id, eventType: event.type }, "Duplicate event, skipping");
      return;
    }

    try {
      const sync = await getStripeSync();
      await sync.processWebhook(payload, signature);
      await WebhookHandlers.handleBusinessLogic(event as any);
      await markEventProcessed(eventRecordId);
      recordWebhook(true);
    } catch (err: any) {
      logger.error({ err: err.message }, "Processing error");
      await markEventFailed(eventRecordId, err.message).catch(() => {});
      recordWebhook(false);
    }
  }

  static async handleBusinessLogic(event: any): Promise<void> {
    const type = event.type;
    const data = event.data?.object;

    if (!data) return;

    logger.info({ eventType: type, eventId: event.id }, "Processing event");

    switch (type) {
      case 'checkout.session.completed': {
        const companyId = data.metadata?.dynastiesCompanyId;
        const isDeploymentFee = data.metadata?.type === 'deployment_fee';

        if (isDeploymentFee && companyId) {
          await stripeService.markDeploymentFeePaid(companyId);
          logger.info({ companyId }, "Deployment fee paid");
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
          logger.info({ companyId, subscriptionId, status: sub.status }, "checkout.session.completed synced");
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
        logger.info({ companyId, subscriptionId }, "invoice.paid synced");
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
        logger.info({ companyId, subscriptionId, status: "PAST_DUE" }, "invoice.payment_failed synced");
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
        logger.info({ companyId, subscriptionId: data.id, status: data.status }, `${type} synced`);
        break;
      }

      default:
        break;
    }
  }
}
