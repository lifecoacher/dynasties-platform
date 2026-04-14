import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers["x-request-id"] as string) || randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  const start = Date.now();
  const { method, originalUrl } = req;

  res.on("finish", () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    const userId = req.user?.userId || "anonymous";
    const companyId = req.user?.companyId || "-";

    const logEntry = {
      level: statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info",
      msg: `${method} ${originalUrl} ${statusCode}`,
      method,
      url: originalUrl,
      statusCode,
      durationMs: duration,
      userId,
      companyId,
      requestId,
      timestamp: new Date().toISOString(),
    };

    if (statusCode >= 500) {
      console.error(JSON.stringify(logEntry));
    } else if (statusCode >= 400) {
      console.warn(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  });

  next();
}
