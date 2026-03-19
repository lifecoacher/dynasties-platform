import express, { type Express } from "express";
import cors from "cors";
import router from "./routes";
import authRouter from "./routes/auth.js";
import clerkAuthRouter from "./routes/clerk-auth.js";
import adminRouter from "./routes/admin.js";
import healthRouter from "./routes/health.js";
import demoRouter from "./routes/demo.js";
import { loginLimiter, apiLimiter } from "./middlewares/rate-limit.js";
import { requestLogger } from "./middlewares/request-logger.js";
import { globalErrorHandler } from "./middlewares/error-handler.js";
import { WebhookHandlers } from "./webhookHandlers.js";

const app: Express = express();
app.set("trust proxy", 1);

const ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [];

if (process.env.REPLIT_DEV_DOMAIN) {
  ALLOWED_ORIGINS.push(`https://${process.env.REPLIT_DEV_DOMAIN}`);
}

const isProduction = process.env.NODE_ENV === "production";

app.use(
  cors({
    origin: isProduction
      ? ALLOWED_ORIGINS
      : true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
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
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      if (!Buffer.isBuffer(req.body)) {
        console.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer');
        res.status(500).json({ error: 'Webhook processing error' });
        return;
      }
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(apiLimiter);

app.use("/api", healthRouter);
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/register", loginLimiter);
app.use("/api", authRouter);
app.use("/api", clerkAuthRouter);
app.use("/api", adminRouter);
app.use("/api", demoRouter);
app.use("/api", router);

app.use(globalErrorHandler);

export default app;
