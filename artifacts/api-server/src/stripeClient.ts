import Stripe from 'stripe';
import { createLogger } from "@workspace/config";

const logger = createLogger("stripe");

interface StripeCredentials {
  publishableKey: string;
  secretKey: string;
}

let cachedCredentials: StripeCredentials | null = null;
let credentialSource: string = 'unknown';

async function getCredentialsFromReplit(): Promise<StripeCredentials | null> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  if (!hostname) return null;

  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) return null;

  const connectorName = 'stripe';
  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
  const targetEnvironment = isProduction ? 'production' : 'development';

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set('include_secrets', 'true');
  url.searchParams.set('connector_names', connectorName);
  url.searchParams.set('environment', targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X-Replit-Token': xReplitToken
    }
  });

  const data: any = await response.json();
  const connectionSettings = data.items?.[0];

  if (!connectionSettings?.settings?.publishable || !connectionSettings?.settings?.secret) {
    return null;
  }

  return {
    publishableKey: connectionSettings.settings.publishable,
    secretKey: connectionSettings.settings.secret,
  };
}

async function getCredentials(): Promise<StripeCredentials> {
  if (cachedCredentials) return cachedCredentials;

  const envKey = process.env.STRIPE_SECRET_KEY;
  const envPubKey = process.env.STRIPE_PUBLISHABLE_KEY;

  if (envKey && envPubKey) {
    credentialSource = 'environment-variables';
    logger.info("Credentials loaded from environment variables");
    cachedCredentials = { secretKey: envKey, publishableKey: envPubKey };
    return cachedCredentials;
  }

  if (envKey) {
    credentialSource = 'environment-variables-partial';
    logger.info("Secret key from env var, publishable key will use fallback");
    const replitCreds = await getCredentialsFromReplit().catch(() => null);
    cachedCredentials = {
      secretKey: envKey,
      publishableKey: replitCreds?.publishableKey || '',
    };
    return cachedCredentials;
  }

  const replitCreds = await getCredentialsFromReplit();
  if (replitCreds) {
    credentialSource = 'replit-connector';
    logger.info("Credentials loaded from Replit connector");
    cachedCredentials = replitCreds;
    return cachedCredentials;
  }

  throw new Error(
    'Stripe credentials not found. Provide STRIPE_SECRET_KEY + STRIPE_PUBLISHABLE_KEY env vars, ' +
    'or configure the Replit Stripe connector.'
  );
}

export function getCredentialSource(): string {
  return credentialSource;
}

export async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, {
    apiVersion: '2025-08-27.basil' as any,
  });
}

export async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSecretKey() {
  const { secretKey } = await getCredentials();
  return secretKey;
}

let stripeSync: any = null;

export async function getStripeSync() {
  if (!stripeSync) {
    const { StripeSync } = await import('stripe-replit-sync');
    const secretKey = await getStripeSecretKey();

    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey: secretKey,
    });
  }
  return stripeSync;
}
