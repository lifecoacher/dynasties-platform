import type { Request, Response, NextFunction } from "express";
import { createLogger } from "@workspace/config";

const logger = createLogger("api-server");

export function notFoundHandler(
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  res.status(404).json({
    error: "Not found",
    code: "NOT_FOUND",
    message: `${req.method} ${req.path} does not exist.`,
  });
}

export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = (err as any).statusCode || 500;

  const logPayload = {
    method: req.method,
    url: req.originalUrl,
    statusCode,
    error: err.message,
    stack: statusCode >= 500 ? err.stack?.split("\n").slice(0, 5).join(" ") : undefined,
    userId: req.user?.userId || "anonymous",
    companyId: req.user?.companyId || "-",
    requestId: req.requestId || "-",
  };

  if (statusCode >= 500) {
    logger.error(logPayload, `${req.method} ${req.originalUrl} error`);
  } else {
    logger.warn(logPayload, `${req.method} ${req.originalUrl} error`);
  }

  const clientMessage = statusCode >= 500
    ? "An unexpected error occurred. Please try again or contact support."
    : err.message;

  res.status(statusCode).json({
    error: statusCode >= 500 ? "Internal server error" : err.message,
    code: (err as any).code || "INTERNAL_ERROR",
    message: clientMessage,
  });
}
