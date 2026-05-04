import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import router from "./routes";
import authRouter from "./routes/auth.js";
import clerkAuthRouter from "./routes/clerk-auth.js";
import adminRouter from "./routes/admin.js";
import healthRouter from "./routes/health.js";
import demoRouter from "./routes/demo.js";
import clerkWebhookRouter from "./routes/clerk-webhook.js";
import metricsRouter, { recordRequest } from "./routes/metrics.js";
import { loginLimiter, apiLimiter } from "./middlewares/rate-limit.js";
import { requestLogger } from "./middlewares/request-logger.js";
import { globalErrorHandler, notFoundHandler } from "./middlewares/error-handler.js";
import { WebhookHandlers } from "./webhookHandlers.js";
import { createLogger } from "@workspace/config";

const logger = createLogger("api-server");

const app: Express = express();
app.set("trust proxy", Number(process.env.TRUST_PROXY || "1"));

const ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [];

if (process.env.REPLIT_DEV_DOMAIN) {
  ALLOWED_ORIGINS.push(`https://${process.env.REPLIT_DEV_DOMAIN}`);
}

const isProduction = process.env.NODE_ENV === "production";

if (isProduction && ALLOWED_ORIGINS.length === 0) {
  logger.error("CORS_ALLOWED_ORIGINS is empty in production — CORS will reject all cross-origin requests");
}

if (!isProduction && ALLOWED_ORIGINS.length === 0) {
  ALLOWED_ORIGINS.push("http://localhost:3000", "http://localhost:5173", "http://localhost:8080");
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
  }),
);

app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-request-id", "x-dev-role-override"],
  }),
);

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      res.status(400).json({ error: 'Missing stripe-signature' });
      return;
    }
    const sig = Array.isArray(signature) ? signature[0] : signature;
    if (!Buffer.isBuffer(req.body)) {
      logger.error("Stripe webhook: req.body is not a Buffer");
      res.status(500).json({ error: 'Internal webhook processing error' });
      return;
    }
    try {
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      const isSignatureError = error.type === 'StripeSignatureVerificationError'
        || error.message?.includes('signature');
      if (isSignatureError) {
        logger.warn({ error: error.message }, "Stripe webhook signature verification failed");
        res.status(400).json({ error: 'Webhook signature verification failed' });
      } else {
        logger.error({ err: error, eventId: error.raw?.id }, "Stripe webhook processing error");
        res.status(500).json({ error: 'Internal webhook processing error' });
      }
    }
  }
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

app.use((_req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const route = _req.route?.path || _req.path;
    recordRequest(_req.method, route, res.statusCode, Date.now() - start);
  });
  next();
});

app.use(apiLimiter);

app.use("/api", healthRouter);
app.use("/api", metricsRouter);

import { qbOAuthCallbackHandler } from "./routes/accounting.js";
app.get("/api/accounting/oauth/quickbooks/callback", qbOAuthCallbackHandler);
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/register", loginLimiter);
app.use("/api", authRouter);
app.use("/api", clerkAuthRouter);
app.use("/api", adminRouter);

const isDemoMode = process.env.VITE_DEMO_MODE === "true";
if (isDemoMode || !isProduction) {
  app.use("/api", demoRouter);
} else {
  logger.info("Demo routes disabled (production mode, VITE_DEMO_MODE !== true)");
}

app.use("/api", clerkWebhookRouter);
app.use("/api", router);

app.use("/api", notFoundHandler);
app.use(globalErrorHandler);

export default app;
