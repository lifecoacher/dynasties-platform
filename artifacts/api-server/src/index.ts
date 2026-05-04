import { loadEnv, createLogger } from "@workspace/config";

const env = loadEnv();
const logger = createLogger("api-server");

import app from "./app";
import { startConsumers } from "./extraction-consumer.js";
import { logExternalSignalsConfig } from "./config/external-signals.js";

const port = env.PORT || Number(process.env["PORT"]) || 8080;

let server: ReturnType<typeof app.listen> | null = null;
let shuttingDown = false;

function gracefulShutdown(reason: string, error: unknown): void {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.fatal({ err: error, reason }, `Fatal: ${reason} — initiating graceful shutdown`);

  const forceExitTimeout = setTimeout(() => {
    logger.error("Graceful shutdown timed out after 15s — forcing exit");
    process.exit(1);
  }, 15_000);
  forceExitTimeout.unref();

  if (server) {
    server.close(() => {
      logger.info("HTTP server closed");
      import("@workspace/db").then(({ pool }) => {
        pool.end().then(() => {
          logger.info("DB pool closed");
          process.exit(1);
        }).catch(() => process.exit(1));
      }).catch(() => process.exit(1));
    });
  } else {
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason) => {
  gracefulShutdown("Unhandled promise rejection", reason);
});

process.on("uncaughtException", (error) => {
  gracefulShutdown("Uncaught exception", error);
});

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("DATABASE_URL not set, skipping Stripe init");
    return;
  }

  try {
    const { runMigrations } = await import('stripe-replit-sync');
    const { getStripeSync } = await import('./stripeClient.js');

    logger.info("Initializing Stripe schema...");
    await runMigrations({ databaseUrl } as any);
    logger.info("Stripe schema ready");

    const { pool } = await import('@workspace/db');
    await pool.query(`
      GRANT USAGE ON SCHEMA stripe TO app_user;
      GRANT SELECT ON ALL TABLES IN SCHEMA stripe TO app_user;
      ALTER DEFAULT PRIVILEGES IN SCHEMA stripe GRANT SELECT ON TABLES TO app_user;
    `).catch(() => {});

    const stripeSync = await getStripeSync();

    logger.info("Setting up managed webhook...");
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`
    );
    logger.info("Webhook configured");

    stripeSync.syncBackfill()
      .then(() => logger.info("Stripe data synced"))
      .catch((err: any) => logger.error({ err }, "Error syncing Stripe data"));
  } catch (error) {
    logger.error({ err: error }, "Failed to initialize Stripe");
  }
}

startConsumers();

initStripe().then(() => {
  server = app.listen(port, () => {
    logger.info({ port }, `Server listening on port ${port}`);
    logExternalSignalsConfig();
  });
});
