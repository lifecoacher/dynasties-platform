import type { Request, Response, NextFunction } from "express";

export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = (err as any).statusCode || 500;
  const isProduction = process.env.NODE_ENV === "production";

  const logPayload = {
    level: "ERROR",
    method: req.method,
    url: req.originalUrl,
    statusCode,
    message: err.message,
    stack: err.stack,
    userId: req.user?.userId || "anonymous",
    companyId: req.user?.companyId || "-",
    timestamp: new Date().toISOString(),
  };

  console.error(JSON.stringify(logPayload));

  res.status(statusCode).json({
    error: isProduction && statusCode === 500
      ? "Internal server error"
      : err.message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
}
