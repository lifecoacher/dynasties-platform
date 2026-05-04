import { Router } from "express";
import { db } from "@workspace/db";
import { companiesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getCompanyId } from "../middlewares/tenant.js";
import { requireMinRole } from "../middlewares/auth.js";
import { stripeConnectService } from "../services/stripe-connect-service.js";
import { getPublicBaseUrl, createLogger } from "@workspace/config";

const logger = createLogger("stripe-connect");

const router = Router();

router.get("/stripe/connect/status", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const status = await stripeConnectService.getLocalConnectStatus(companyId);
    res.json({ data: status });
  } catch (error: any) {
    logger.error({ err: error }, "Error fetching Connect status");
    res.status(500).json({ error: "Failed to fetch Connect status" });
  }
});

router.post("/stripe/connect/sync", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const status = await stripeConnectService.syncConnectStatus(companyId);
    res.json({ data: status });
  } catch (error: any) {
    logger.error({ err: error }, "Error syncing Connect status");
    res.status(500).json({ error: "Failed to sync Connect status" });
  }
});

router.post("/stripe/connect/create-account", requireMinRole("ADMIN"), async (req, res) => {
  try {
    const companyId = getCompanyId(req);

    const [company] = await db.select().from(companiesTable)
      .where(eq(companiesTable.id, companyId)).limit(1);
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }

    const email = company.contactEmail || req.user!.email;
    const accountId = await stripeConnectService.createConnectAccount(
      companyId,
      company.name,
      email,
    );

    res.json({ data: { connectAccountId: accountId } });
  } catch (error: any) {
    logger.error({ err: error }, "Error creating Connect account");
    if (error?.type === "StripeInvalidRequestError" && error?.message?.includes("signed up for Connect")) {
      res.status(400).json({
        error: "Stripe Connect is not enabled on this Stripe account. Enable it at https://dashboard.stripe.com/connect first.",
        code: "CONNECT_NOT_ENABLED",
      });
      return;
    }
    res.status(500).json({ error: "Failed to create Connect account" });
  }
});

router.post("/stripe/connect/onboarding-link", requireMinRole("ADMIN"), async (req, res) => {
  try {
    const companyId = getCompanyId(req);

    const [company] = await db.select().from(companiesTable)
      .where(eq(companiesTable.id, companyId)).limit(1);
    if (!company?.stripeConnectAccountId) {
      res.status(400).json({ error: "No Connect account found. Create one first." });
      return;
    }

    const baseUrl = getPublicBaseUrl();
    const returnUrl = `${baseUrl}/settings/billing?connect=return`;
    const refreshUrl = `${baseUrl}/settings/billing?connect=refresh`;

    const url = await stripeConnectService.createOnboardingLink(
      company.stripeConnectAccountId,
      returnUrl,
      refreshUrl,
    );

    res.json({ data: { url } });
  } catch (error: any) {
    logger.error({ err: error }, "Error creating onboarding link");
    res.status(500).json({ error: "Failed to create onboarding link" });
  }
});

export default router;
