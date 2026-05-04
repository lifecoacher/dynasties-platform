import type { Request, Response, NextFunction } from "express";
import { runWithTenant } from "@workspace/db";
import { createLogger } from "@workspace/config";

const logger = createLogger("tenant");

export function requireTenant(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.companyId) {
    res.status(401).json({ error: "Tenant context required" });
    return;
  }
  next();
}

export function getCompanyId(req: Request): string {
  if (!req.user?.companyId) {
    throw new Error("No tenant context — requireAuth middleware missing");
  }
  return req.user.companyId;
}

export async function setTenantContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  const companyId = req.user?.companyId;
  if (!companyId) {
    next();
    return;
  }

  try {
    await runWithTenant(companyId, () => {
      return new Promise<void>((resolve, reject) => {
        res.on("finish", resolve);
        res.on("close", resolve);
        res.on("error", reject);
        next();
      });
    });
  } catch (err: any) {
    if (!res.headersSent) {
      logger.error({ err: err.message }, "RLS context error");
      res.status(503).json({ error: "Tenant context setup failed" });
    }
  }
}
