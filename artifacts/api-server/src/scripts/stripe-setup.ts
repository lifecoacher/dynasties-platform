import { loadEnv, createLogger, getPublicBaseUrl } from "@workspace/config";

loadEnv();
const logger = createLogger("stripe-setup");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.error("DATABASE_URL not set");
    process.exit(1);
  }

  const { runMigrations } = await import("stripe-replit-sync");
  const { getStripeSync } = await import("../stripeClient.js");

  logger.info("Running Stripe schema migrations...");
  await runMigrations({ databaseUrl } as any);
  logger.info("Stripe schema ready");

  const { pool } = await import("@workspace/db");
  const isProd = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging";
  try {
    await pool.query(`
      GRANT USAGE ON SCHEMA stripe TO app_user;
      GRANT SELECT ON ALL TABLES IN SCHEMA stripe TO app_user;
      ALTER DEFAULT PRIVILEGES IN SCHEMA stripe GRANT SELECT ON TABLES TO app_user;
    `);
    logger.info("Granted stripe schema permissions to app_user");
  } catch (err: any) {
    if (err.message?.includes("does not exist")) {
      if (isProd) {
        logger.error("app_user role does not exist in production — create it before running stripe-setup. See RUNBOOK.md 'Database Users' section.");
        throw new Error("FATAL: app_user role must exist in production/staging. Run the CREATE ROLE SQL from RUNBOOK.md first.");
      }
      logger.warn("app_user role does not exist — skipping GRANT (dev/test single-role deployment)");
    } else {
      logger.error({ err }, "Failed to grant stripe schema permissions");
      throw err;
    }
  }

  const baseUrl = getPublicBaseUrl();
  const stripeSync = await getStripeSync();

  logger.info({ baseUrl }, "Registering Stripe webhook...");
  await stripeSync.findOrCreateManagedWebhook(`${baseUrl}/api/stripe/webhook`);
  logger.info("Webhook configured");

  logger.info("Starting Stripe data backfill...");
  await stripeSync.syncBackfill();
  logger.info("Stripe data synced");

  await pool.end();
  logger.info("Stripe setup complete");
  process.exit(0);
}

main().catch((err) => {
  logger.fatal({ err }, "Stripe setup failed");
  process.exit(1);
});
