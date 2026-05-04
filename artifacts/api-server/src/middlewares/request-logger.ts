import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { createLogger } from "@workspace/config";

const logger = createLogger("api-server");

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      log?: typeof logger;
    }
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers["x-request-id"] as string) || randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  req.log = logger.child({ requestId });

  const start = Date.now();
  const { method, originalUrl } = req;

  res.on("finish", () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    const userId = req.user?.userId || "anonymous";
    const companyId = req.user?.companyId || "-";

    const logData = {
      method,
      url: originalUrl,
      statusCode,
      durationMs: duration,
      userId,
      companyId,
      requestId,
    };

    if (statusCode >= 500) {
      logger.error(logData, `${method} ${originalUrl} ${statusCode}`);
    } else if (statusCode >= 400) {
      logger.warn(logData, `${method} ${originalUrl} ${statusCode}`);
    } else {
      logger.info(logData, `${method} ${originalUrl} ${statusCode}`);
    }
  });

  next();
}
