import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { companiesTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

const EXEMPT_PATHS = [
  "/stripe/",
  "/billing/",
  "/auth/",
  "/health",
  "/reference/",
  "/migration/",
];

const READ_METHODS = ["GET", "HEAD", "OPTIONS"];

const DEMO_MODE = process.env.VITE_DEMO_MODE === "true";

export function requireActiveBilling(req: Request, res: Response, next: NextFunction): void {
  if (DEMO_MODE) {
    next();
    return;
  }

  const path = req.path;
  if (EXEMPT_PATHS.some(p => path.includes(p))) {
    next();
    return;
  }

  if (READ_METHODS.includes(req.method)) {
    next();
    return;
  }

  if (!req.user?.companyId) {
    next();
    return;
  }

  checkBillingStatus(req, res, next);
}

async function checkBillingStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const [company] = await db.select({
      billingStatus: companiesTable.billingStatus,
      planType: companiesTable.planType,
      shipmentLimitMonthly: companiesTable.shipmentLimitMonthly,
      shipmentsUsedThisCycle: companiesTable.shipmentsUsedThisCycle,
    })
      .from(companiesTable)
      .where(eq(companiesTable.id, req.user!.companyId))
      .limit(1);

    if (!company) {
      next();
      return;
    }

    const activeStatuses = ["ACTIVE", "TRIALING"];
    if (!activeStatuses.includes(company.billingStatus)) {
      res.status(403).json({
        error: "Subscription required",
        code: "BILLING_INACTIVE",
        message: "An active subscription is required to perform this action. Please visit Settings > Billing to activate your plan.",
      });
      return;
    }

    const isShipmentCreate = req.method === "POST"
      && /^\/shipments\/?$/.test(req.path);

    if (isShipmentCreate && company.shipmentsUsedThisCycle >= company.shipmentLimitMonthly) {
      res.status(403).json({
        error: "Shipment limit reached",
        code: "SHIPMENT_LIMIT_EXCEEDED",
        message: `You have used all ${company.shipmentLimitMonthly} shipments for this billing cycle. Upgrade your plan for more capacity.`,
      });
      return;
    }

    next();
  } catch {
    next();
  }
}

export async function incrementShipmentUsage(companyId: string): Promise<{ used: number; limit: number; warning: boolean }> {
  const [result] = await db.update(companiesTable)
    .set({
      shipmentsUsedThisCycle: sql`${companiesTable.shipmentsUsedThisCycle} + 1`,
    })
    .where(eq(companiesTable.id, companyId))
    .returning({
      used: companiesTable.shipmentsUsedThisCycle,
      limit: companiesTable.shipmentLimitMonthly,
    });

  const warning = result.used >= Math.floor(result.limit * 0.8);
  return { used: result.used, limit: result.limit, warning };
}
