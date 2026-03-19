import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { companiesTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

const EXEMPT_PATHS = [
  "/stripe/",
  "/auth/",
  "/health",
  "/reference/",
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
      seatLimit: companiesTable.seatLimit,
      trialEndsAt: companiesTable.trialEndsAt,
    })
      .from(companiesTable)
      .where(eq(companiesTable.id, req.user!.companyId))
      .limit(1);

    if (!company) {
      next();
      return;
    }

    const isTrialValid = company.billingStatus === "TRIAL"
      && company.trialEndsAt
      && new Date(company.trialEndsAt) > new Date();

    const isActive = company.billingStatus === "ACTIVE" || isTrialValid;

    if (!isActive) {
      const reason = company.billingStatus === "TRIAL" ? "Your trial has expired." : "An active subscription is required.";
      res.status(403).json({
        error: "Subscription required",
        code: "BILLING_INACTIVE",
        billingStatus: company.billingStatus,
        message: `${reason} Please visit Settings > Billing to activate your plan.`,
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

export async function checkSeatLimit(companyId: string): Promise<{ allowed: boolean; used: number; limit: number }> {
  const [company] = await db.select({
    seatLimit: companiesTable.seatLimit,
  }).from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);

  if (!company) return { allowed: true, used: 0, limit: 0 };

  const countResult = await db.execute(
    sql`SELECT count(*)::int as cnt FROM users WHERE company_id = ${companyId} AND is_active = true`
  );
  const used = (countResult.rows[0] as any)?.cnt || 0;

  return {
    allowed: used < company.seatLimit,
    used,
    limit: company.seatLimit,
  };
}

export async function incrementShipmentUsage(companyId: string): Promise<{ used: number; limit: number; warning: string | null }> {
  const [result] = await db.update(companiesTable)
    .set({
      shipmentsUsedThisCycle: sql`${companiesTable.shipmentsUsedThisCycle} + 1`,
    })
    .where(eq(companiesTable.id, companyId))
    .returning({
      used: companiesTable.shipmentsUsedThisCycle,
      limit: companiesTable.shipmentLimitMonthly,
    });

  const percent = result.limit > 0 ? Math.round((result.used / result.limit) * 100) : 0;

  let warning: string | null = null;
  if (percent >= 100) {
    warning = "LIMIT_REACHED";
  } else if (percent >= 90) {
    warning = "CRITICAL_USAGE";
  } else if (percent >= 80) {
    warning = "HIGH_USAGE";
  }

  return { used: result.used, limit: result.limit, warning };
}
