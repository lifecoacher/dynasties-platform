import { z } from "zod/v4";

const KNOWN_BAD_SECRETS = ["dev", "change", "example", "secret", "password", "placeholder"];

const jwtSecretSchema = z.string().min(32, "JWT_SECRET must be at least 32 characters").refine(
  (val) => {
    if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging") {
      const lower = val.toLowerCase();
      return !KNOWN_BAD_SECRETS.some((bad) => lower.includes(bad));
    }
    return true;
  },
  { message: "JWT_SECRET contains a known-bad substring (dev, change, example, secret, password). Use a real secret in production." },
);

const corsOriginsSchema = z.string().optional().refine(
  (val) => {
    const env = process.env.NODE_ENV;
    if (env === "production" || env === "staging") {
      return val !== undefined && val.trim().length > 0;
    }
    return true;
  },
  { message: "CORS_ALLOWED_ORIGINS must be set in production/staging." },
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
  QUEUE_BACKEND: z.enum(["local", "sqs"]).optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  QB_CLIENT_ID: z.string().optional(),
  QB_CLIENT_SECRET: z.string().optional(),
  QB_MODE: z.enum(["demo", "live"]).optional(),
  CLERK_WEBHOOK_SECRET: z.string().optional(),
  FEATURE_DEV_ROLE_OVERRIDE: z.enum(["true", "false"]).optional(),
  LOCAL_DEV_ONLY: z.enum(["true", "false"]).optional(),
  TRUST_PROXY: z.coerce.number().int().optional(),
  VITE_DEMO_MODE: z.enum(["true", "false"]).optional(),
  DEMO_CLERK_EMAILS: z.string().optional(),
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
    console.error("Optional:");
    console.error("  PORT            - Server port (default: 8080)");
    console.error("  NODE_ENV        - development | production | test");
    console.error("  LOG_LEVEL       - fatal|error|warn|info|debug|trace");
    console.error("  ANTHROPIC_API_KEY - Anthropic API key for AI agents");
    console.error("  AWS_REGION      - AWS region (default: us-east-1)");
    console.error("  S3_ENDPOINT     - Custom S3 endpoint (LocalStack)");
    console.error("  SQS_ENDPOINT    - Custom SQS endpoint (LocalStack)");
    console.error("═══════════════════════════════════════════════════");
    throw new Error(`Environment validation failed:\n${formatted}`);
  }

  _env = result.data;
  return _env;
}
