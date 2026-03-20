import { Router } from "express";
import { z } from "zod";
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
} from "../services/accounting/sync-service.js";

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

export default router;
