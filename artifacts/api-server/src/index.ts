import { loadEnv } from "@workspace/config";

const env = loadEnv();

import app from "./app";
import { startConsumers } from "./extraction-consumer.js";
import { logExternalSignalsConfig } from "./config/external-signals.js";

const port = env.PORT || Number(process.env["PORT"]) || 8080;

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn('DATABASE_URL not set, skipping Stripe init');
    return;
  }

  try {
    const { runMigrations } = await import('stripe-replit-sync');
    const { getStripeSync } = await import('./stripeClient.js');

    console.log('Initializing Stripe schema...');
    await runMigrations({ databaseUrl } as any);
    console.log('Stripe schema ready');

    const stripeSync = await getStripeSync();

    console.log('Setting up managed webhook...');
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`
    );
    console.log('Webhook configured');

    stripeSync.syncBackfill()
      .then(() => console.log('Stripe data synced'))
      .catch((err: any) => console.error('Error syncing Stripe data:', err));
  } catch (error) {
    console.error('Failed to initialize Stripe:', error);
  }
}

startConsumers();

initStripe().then(() => {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    logExternalSignalsConfig();
  });
});
