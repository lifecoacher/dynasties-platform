import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import router from "./routes";
import authRouter from "./routes/auth.js";
import adminRouter from "./routes/admin.js";
import healthRouter from "./routes/health.js";
import { loginLimiter, apiLimiter } from "./middlewares/rate-limit.js";
import { requestLogger } from "./middlewares/request-logger.js";

const app: Express = express();

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

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(apiLimiter);

app.use("/api", healthRouter);
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/register", loginLimiter);
app.use("/api", authRouter);
app.use("/api", adminRouter);
app.use("/api", router);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(`[error-handler] ${err.message}`, err.stack);

  const status = "status" in err && typeof (err as Record<string, unknown>).status === "number"
    ? (err as Record<string, unknown>).status as number
    : 500;

  res.status(status).json({
    error: isProduction ? "Internal server error" : err.message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
});

export default app;
