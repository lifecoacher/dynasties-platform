import { z } from "zod/v4";

const KNOWN_BAD_SECRETS = ["dev", "change", "example", "secret", "password", "placeholder"];

const isProdOrStaging = () => {
  const env = process.env.NODE_ENV;
  return env === "production" || env === "staging";
};

const jwtSecretSchema = z.string().min(32, "JWT_SECRET must be at least 32 characters").refine(
  (val) => {
    if (isProdOrStaging()) {
      const lower = val.toLowerCase();
      return !KNOWN_BAD_SECRETS.some((bad) => lower.includes(bad));
    }
    return true;
  },
  { message: "JWT_SECRET contains a known-bad substring (dev, change, example, secret, password). Use a real secret in production." },
);

const corsOriginsSchema = z.string().optional().refine(
  (val) => {
    if (isProdOrStaging()) {
      return val !== undefined && val.trim().length > 0;
    }
    return true;
  },
  { message: "CORS_ALLOWED_ORIGINS must be set in production/staging." },
);

function requiredInProd(fieldName: string) {
  return z.string().optional().refine(
    (val) => {
      if (isProdOrStaging()) {
        return val !== undefined && val.trim().length > 0;
      }
      return true;
    },
    { message: `${fieldName} is required in production/staging.` },
  );
}

const publicBaseUrlSchema = z.string().optional().refine(
  (val) => {
    if (isProdOrStaging()) {
      if (!val || val.trim().length === 0) return false;
      try {
        const url = new URL(val);
        return url.protocol === "https:";
      } catch {
        return false;
      }
    }
    return true;
  },
  { message: "PUBLIC_BASE_URL is required in production/staging and must be a valid HTTPS URL." },
);

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NODE_ENV: z
    .enum(["development", "production", "test", "staging"])
    .default("development"),
  PORT: z.coerce.number().int().positive().optional(),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  JWT_SECRET: jwtSecretSchema,
  AWS_REGION: z.string().default("us-east-1"),
  S3_BUCKET_RAW_DOCUMENTS: z.string().default("dynasties-raw-documents"),
  S3_BUCKET_GENERATED_DOCUMENTS: z
    .string()
    .default("dynasties-generated-documents"),
  S3_ENDPOINT: z.string().url().optional(),
  SQS_ENDPOINT: z.string().url().optional(),
  ANTHROPIC_API_KEY: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),
  AI_INTEGRATIONS_ANTHROPIC_API_KEY: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),
  CORS_ALLOWED_ORIGINS: corsOriginsSchema,
  STORAGE_BACKEND: z.enum(["local", "s3"]).optional(),
  QUEUE_BACKEND: z.enum(["local", "sqs"]).optional().refine(
    (val) => {
      if (isProdOrStaging() && val !== "sqs") {
        return false;
      }
      return true;
    },
    { message: "QUEUE_BACKEND must be 'sqs' in production/staging. In-memory EventEmitter is not safe for multi-instance deployments." },
  ),
  STRIPE_SECRET_KEY: requiredInProd("STRIPE_SECRET_KEY"),
  STRIPE_PUBLISHABLE_KEY: requiredInProd("STRIPE_PUBLISHABLE_KEY"),
  STRIPE_WEBHOOK_SECRET: requiredInProd("STRIPE_WEBHOOK_SECRET"),
  QB_CLIENT_ID: z.string().optional(),
  QB_CLIENT_SECRET: z.string().optional(),
  QB_MODE: z.enum(["demo", "live"]).optional(),
  CLERK_WEBHOOK_SECRET: requiredInProd("CLERK_WEBHOOK_SECRET"),
  FEATURE_DEV_ROLE_OVERRIDE: z.enum(["true", "false"]).optional(),
  LOCAL_DEV_ONLY: z.enum(["true", "false"]).optional(),
  TRUST_PROXY: z.coerce.number().int().optional(),
  VITE_DEMO_MODE: z.enum(["true", "false"]).optional(),
  DEMO_CLERK_EMAILS: z.string().optional(),
  PUBLIC_BASE_URL: publicBaseUrlSchema,
});

export type EnvConfig = z.infer<typeof envSchema>;

let _env: EnvConfig | null = null;

export function loadEnv(): EnvConfig {
  if (_env) return _env;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = z.prettifyError(result.error);
    console.error("═══════════════════════════════════════════════════");
    console.error("  ENVIRONMENT VALIDATION FAILED");
    console.error("═══════════════════════════════════════════════════");
    console.error(formatted);
    console.error("═══════════════════════════════════════════════════");
    console.error("Required environment variables:");
    console.error("  DATABASE_URL    - PostgreSQL connection string");
    console.error("  JWT_SECRET      - JWT signing key (min 32 chars)");
    console.error("Production/staging additionally require:");
    console.error("  PUBLIC_BASE_URL          - Public HTTPS URL (e.g. https://app.dynasties.io)");
    console.error("  STRIPE_SECRET_KEY        - Stripe secret key");
    console.error("  STRIPE_PUBLISHABLE_KEY   - Stripe publishable key");
    console.error("  STRIPE_WEBHOOK_SECRET    - Stripe webhook signing secret");
    console.error("  CLERK_WEBHOOK_SECRET     - Clerk webhook signing secret");
    console.error("  QUEUE_BACKEND=sqs        - Queue backend");
    console.error("  CORS_ALLOWED_ORIGINS     - Comma-separated allowed origins");
    console.error("═══════════════════════════════════════════════════");
    throw new Error(`Environment validation failed:\n${formatted}`);
  }

  _env = result.data;
  return _env;
}

export function getPublicBaseUrl(): string {
  const env = loadEnv();
  if (env.PUBLIC_BASE_URL) {
    return env.PUBLIC_BASE_URL.replace(/\/+$/, "");
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  const port = env.PORT || 8080;
  return `http://localhost:${port}`;
}
