import type { Request, Response, NextFunction } from "express";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, originalUrl } = req;

  res.on("finish", () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    const userId = req.user?.userId || "anonymous";
    const companyId = req.user?.companyId || "-";

    const level = statusCode >= 500 ? "ERROR" : statusCode >= 400 ? "WARN" : "INFO";
    console.log(
      `[${level}] ${method} ${originalUrl} ${statusCode} ${duration}ms user=${userId} company=${companyId}`,
    );
  });

  next();
}
