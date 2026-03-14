import type { Request, Response, NextFunction } from "express";

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
