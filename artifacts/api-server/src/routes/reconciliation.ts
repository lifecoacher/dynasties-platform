import { Router, type IRouter } from "express";
import {
  ingestCarrierInvoice,
  getReconciliationForShipment,
  getCarrierInvoicesForShipment,
  getShipmentFinancialSummary,
  performReconciliation,
} from "@workspace/svc-reconciliation";
import type { CarrierLineItem } from "@workspace/db/schema";
import { reconciliationResultsTable, carrierInvoicesTable, eventsTable } from "@workspace/db/schema";
import { db } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import { getCompanyId } from "../middlewares/tenant.js";
import { requireMinRole } from "../middlewares/auth.js";

const router: IRouter = Router();

function paramId(req: { params: Record<string, unknown> }): string {
  return req.params.id as string;
}

router.get("/shipments/:id/financial-summary", async (req, res) => {
  const companyId = getCompanyId(req);
  const shipmentId = paramId(req);

  try {
    const summary = await getShipmentFinancialSummary(companyId, shipmentId);
    res.json({ data: summary });
  } catch (err: any) {
    console.error("[reconciliation] Financial summary failed:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/shipments/:id/carrier-invoices", async (req, res) => {
  const companyId = getCompanyId(req);
  const shipmentId = paramId(req);

  try {
    const invoices = await getCarrierInvoicesForShipment(companyId, shipmentId);
    res.json({ data: invoices });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/shipments/:id/carrier-invoices", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  const shipmentId = paramId(req);
  const body = req.body;

  if (!body.carrierName || !body.invoiceNumber || !body.totalAmount) {
    res.status(400).json({
      error: "carrierName, invoiceNumber, and totalAmount are required",
    });
    return;
  }

  const parsedTotal = parseFloat(body.totalAmount);
  if (!Number.isFinite(parsedTotal) || parsedTotal < 0) {
    res.status(400).json({ error: "totalAmount must be a valid positive number" });
    return;
  }

  try {
    const result = await ingestCarrierInvoice({
      companyId,
      shipmentId,
      carrierName: body.carrierName,
      invoiceNumber: body.invoiceNumber,
      invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : new Date(),
      totalAmount: parsedTotal,
      currency: body.currency || "USD",
      lineItems: (body.lineItems || []) as CarrierLineItem[],
      rawPayload: body,
      userId: (req as any).user?.id,
    });

    res.json({ data: result });
  } catch (err: any) {
    if (err?.cause?.code === "23505") {
      res.status(409).json({ error: "Carrier invoice with this number already exists" });
      return;
    }
    console.error("[reconciliation] Carrier invoice ingestion failed:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/carrier-invoices/upload", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  const body = req.body;

  if (!Array.isArray(body.invoices) || body.invoices.length === 0) {
    res.status(400).json({ error: "invoices array is required" });
    return;
  }

  const results = [];
  const errors = [];

  for (const inv of body.invoices) {
    try {
      const result = await ingestCarrierInvoice({
        companyId,
        shipmentReference: inv.shipmentReference,
        carrierName: inv.carrierName,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate) : new Date(),
        totalAmount: parseFloat(inv.totalAmount),
        currency: inv.currency || "USD",
        lineItems: (inv.lineItems || []) as CarrierLineItem[],
        rawPayload: inv,
        userId: (req as any).user?.id,
      });
      results.push(result);
    } catch (err: any) {
      errors.push({
        invoiceNumber: inv.invoiceNumber,
        error: err.message,
      });
    }
  }

  res.json({
    data: {
      processed: results.length,
      failed: errors.length,
      results,
      errors,
    },
  });
});

router.get("/shipments/:id/reconciliation", async (req, res) => {
  const companyId = getCompanyId(req);
  const shipmentId = paramId(req);

  try {
    const results = await getReconciliationForShipment(companyId, shipmentId);
    res.json({ data: results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/shipments/:id/reconcile", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  const shipmentId = paramId(req);

  try {
    const carrierInvoices = await getCarrierInvoicesForShipment(
      companyId,
      shipmentId,
    );

    if (carrierInvoices.length === 0) {
      res.status(422).json({
        error: "No carrier invoices found for this shipment. Ingest a carrier invoice first.",
      });
      return;
    }

    const latestInvoice = carrierInvoices[0];
    const result = await performReconciliation(
      companyId,
      shipmentId,
      latestInvoice.id,
      (latestInvoice.lineItems || []) as CarrierLineItem[],
      parseFloat(latestInvoice.totalAmount || "0"),
      (req as any).user?.id,
    );

    res.json({ data: result });
  } catch (err: any) {
    console.error("[reconciliation] Reconciliation failed:", err);
    res.status(500).json({ error: err.message });
  }
});

const VALID_RESOLUTION_STATUSES = ["ACCEPTED", "DISPUTED", "ADJUSTED", "ESCALATED"] as const;

router.patch("/reconciliation/:reconId/resolve", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  const reconId = req.params.reconId as string;
  const { resolutionStatus, resolutionNote } = req.body;

  if (!resolutionStatus || !VALID_RESOLUTION_STATUSES.includes(resolutionStatus)) {
    res.status(400).json({
      error: `resolutionStatus is required and must be one of: ${VALID_RESOLUTION_STATUSES.join(", ")}`,
    });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(reconciliationResultsTable)
      .where(and(
        eq(reconciliationResultsTable.id, reconId),
        eq(reconciliationResultsTable.companyId, companyId),
      ))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Reconciliation result not found" });
      return;
    }

    const userId = (req as any).user?.id || null;

    const [updated] = await db
      .update(reconciliationResultsTable)
      .set({
        resolutionStatus: resolutionStatus as any,
        resolutionNote: resolutionNote || null,
        resolvedBy: userId,
        resolvedAt: new Date(),
      })
      .where(and(
        eq(reconciliationResultsTable.id, reconId),
        eq(reconciliationResultsTable.companyId, companyId),
      ))
      .returning();

    if (resolutionStatus === "ACCEPTED" || resolutionStatus === "ADJUSTED") {
      await db
        .update(carrierInvoicesTable)
        .set({ requiresAttention: "false" })
        .where(and(
          eq(carrierInvoicesTable.id, existing.carrierInvoiceId),
          eq(carrierInvoicesTable.companyId, companyId),
        ));
    }

    await db.insert(eventsTable).values({
      id: generateId("evt"),
      companyId,
      entityType: "SHIPMENT",
      entityId: existing.shipmentId,
      eventType: "VARIANCE_RESOLVED",
      actorType: "USER",
      serviceId: "reconciliation",
      metadata: {
        reconciliationId: reconId,
        resolutionStatus,
        resolutionNote: resolutionNote || null,
        resolvedBy: userId,
        previousStatus: existing.reconciliationStatus,
        varianceAmount: existing.varianceAmount,
      },
    });

    res.json({ data: updated });
  } catch (err: any) {
    console.error("[reconciliation] Resolution failed:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
