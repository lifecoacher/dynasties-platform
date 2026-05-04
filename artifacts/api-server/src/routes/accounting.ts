import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { accountingConnectionsTable } from "@workspace/db/schema";
import { getCompanyId } from "../middlewares/tenant.js";
import { requireMinRole } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import {
  getConnectionStatus,
  connectQuickBooks,
  disconnectQuickBooks,
  syncCustomer,
  syncInvoice,
  refreshPaymentStatus,
  getSyncMappings,
  getInvoiceSyncStatus,
  simulateDemoPayment,
  getOrCreateConnection,
} from "../services/accounting/sync-service.js";
import { getPublicBaseUrl, createLogger } from "@workspace/config";

const logger = createLogger("accounting");

const router = Router();

router.get("/accounting/status", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const status = await getConnectionStatus(companyId);
    res.json({ data: status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/accounting/connect", requireMinRole("ADMIN"), async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const userId = (req as any).user?.userId;
    const connection = await connectQuickBooks(companyId, userId);
    res.json({ data: connection });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/accounting/disconnect", requireMinRole("ADMIN"), async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const userId = (req as any).user?.userId;
    const connection = await disconnectQuickBooks(companyId, userId);
    res.json({ data: connection });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const syncCustomerSchema = z.object({ customerBillingProfileId: z.string().min(1) });

router.post("/accounting/sync/customer", requireMinRole("MANAGER"), validateBody(syncCustomerSchema), async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const userId = (req as any).user?.userId;
    const result = await syncCustomer(companyId, req.body.customerBillingProfileId, userId);
    res.json({ data: result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

const syncInvoiceSchema = z.object({ invoiceId: z.string().min(1) });

router.post("/accounting/sync/invoice", requireMinRole("MANAGER"), validateBody(syncInvoiceSchema), async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const userId = (req as any).user?.userId;
    const result = await syncInvoice(companyId, req.body.invoiceId, userId);
    res.json({ data: result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

const refreshPaymentSchema = z.object({ invoiceId: z.string().min(1) });

router.post("/accounting/sync/payment-status", requireMinRole("MANAGER"), validateBody(refreshPaymentSchema), async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const userId = (req as any).user?.userId;
    const result = await refreshPaymentStatus(companyId, req.body.invoiceId, userId);
    res.json({ data: result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/accounting/mappings", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const entityType = typeof req.query.entityType === "string" ? req.query.entityType : undefined;
    const mappings = await getSyncMappings(companyId, entityType);
    res.json({ data: mappings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/accounting/invoice-sync/:invoiceId", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const invoiceId = String(req.params.invoiceId);
    const status = await getInvoiceSyncStatus(companyId, invoiceId);
    res.json({ data: status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const DEMO_MODE = process.env.VITE_DEMO_MODE === "true";

if (DEMO_MODE) {
  router.post("/accounting/demo/simulate-payment", requireMinRole("ADMIN"), validateBody(z.object({ invoiceId: z.string().min(1) })), async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const result = await simulateDemoPayment(companyId, req.body.invoiceId);
      res.json({ data: result });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });
}

router.get("/accounting/oauth/quickbooks/auth-url", requireMinRole("ADMIN"), async (req, res) => {
  const clientId = process.env.QB_CLIENT_ID;
  if (!clientId) {
    res.status(400).json({ error: "QuickBooks OAuth not configured (QB_CLIENT_ID missing)" });
    return;
  }

  const redirectUri = `${getPublicBaseUrl()}/api/accounting/oauth/quickbooks/callback`;
  const companyId = getCompanyId(req);

  const authUrl = new URL("https://appcenter.intuit.com/connect/oauth2");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "com.intuit.quickbooks.accounting");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", companyId);

  res.json({ data: { authUrl: authUrl.toString() } });
});

export const qbOAuthCallbackHandler: import("express").RequestHandler = async (req, res) => {
  const code = req.query.code as string;
  const realmId = req.query.realmId as string;
  const companyId = req.query.state as string;

  if (!code || !realmId || !companyId) {
    res.status(400).json({ error: "Missing OAuth callback parameters" });
    return;
  }

  const clientId = process.env.QB_CLIENT_ID;
  const clientSecret = process.env.QB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    res.status(500).json({ error: "QuickBooks OAuth not configured" });
    return;
  }

  try {
    const redirectUri = `${getPublicBaseUrl()}/api/accounting/oauth/quickbooks/callback`;

    const tokenResp = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResp.ok) {
      const body = await tokenResp.text();
      throw new Error(`Token exchange failed (${tokenResp.status}): ${body}`);
    }

    const tokens = await tokenResp.json() as any;
    const expiresAt = new Date(Date.now() + (tokens.expires_in - 60) * 1000);

    const connection = await getOrCreateConnection(companyId);

    await db
      .update(accountingConnectionsTable)
      .set({
        connectionStatus: "CONNECTED",
        realmId,
        tokenEncrypted: tokens.access_token,
        refreshTokenEncrypted: tokens.refresh_token,
        tokenExpiresAt: expiresAt,
        lastSyncError: null,
      })
      .where(eq(accountingConnectionsTable.id, connection.id));

    res.json({ data: { success: true, realmId, companyId } });
  } catch (err: any) {
    logger.error({ err: err.message }, "OAuth callback error");
    res.status(500).json({ error: err.message });
  }
};

export default router;
