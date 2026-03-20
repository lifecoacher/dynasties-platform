import { Router } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { exceptionsTable } from "@workspace/db/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { getCompanyId } from "../middlewares/tenant.js";
import { requireMinRole } from "../middlewares/auth.js";
import { validateBody } from "../middlewares/validate.js";
import { parsePagination, paginatedResponse } from "../middlewares/pagination.js";
import {
  detectExceptionsForShipment,
  createManualException,
  assignException,
  escalateException,
  resolveException,
  getAlertsSummary,
  getShipmentAlerts,
} from "../services/exception-engine.js";

const router = Router();

const createExceptionSchema = z.object({
  shipmentId: z.string().optional(),
  invoiceId: z.string().optional(),
  exceptionType: z.enum([
    "EXTRACTION_FAILURE", "DOCUMENT_CONFLICT", "COMPLIANCE_ALERT", "HIGH_RISK",
    "MISSING_DOCUMENT", "BILLING_DISCREPANCY", "CUSTOMS_HOLD", "DELAYED_SHIPMENT",
    "MISSING_DOCUMENTS", "DOCUMENT_BLOCKED", "REWEIGH_RECLASS", "MISSED_PICKUP",
    "DELIVERY_EXCEPTION", "OSD_DAMAGE_SHORTAGE", "MAJOR_INVOICE_VARIANCE",
    "UNMATCHED_CARRIER_INVOICE", "RELEASE_BLOCKED", "HIGH_RISK_REVIEW",
  ]),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  title: z.string().min(1),
  description: z.string().min(1),
  assignedToUserId: z.string().optional(),
  dueAt: z.string().optional(),
});

const updateExceptionSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "ACKNOWLEDGED", "RESOLVED", "ESCALATED"]).optional(),
  assignedToUserId: z.string().optional(),
  resolutionNotes: z.string().optional(),
  dueAt: z.string().nullable().optional(),
});

const assignSchema = z.object({ assignedToUserId: z.string().min(1) });
const resolveSchema = z.object({ resolutionNotes: z.string().min(1) });
const escalateSchema = z.object({ reason: z.string().optional() });

router.get("/exceptions/alerts/summary", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const summary = await getAlertsSummary(companyId);
    res.json({ data: summary });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/exceptions/alerts/shipment/:shipmentId", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const shipmentId = String(req.params.shipmentId);
    const alerts = await getShipmentAlerts(companyId, shipmentId);
    res.json({ data: alerts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/exceptions/detect/:shipmentId", requireMinRole("OPERATOR"), async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const shipmentId = String(req.params.shipmentId);
    const created = await detectExceptionsForShipment(companyId, shipmentId);
    res.json({ data: { detected: created.length, exceptions: created } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/exceptions", requireMinRole("OPERATOR"), validateBody(createExceptionSchema), async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const userId = (req as any).user?.userId;
    const exception = await createManualException({
      ...req.body,
      companyId,
      userId,
    });
    res.status(201).json({ data: exception });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/exceptions", async (req, res) => {
  try {
    const companyId = getCompanyId(req);
    const pg = parsePagination(req);
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const severity = typeof req.query.severity === "string" ? req.query.severity : undefined;
    const shipmentId = typeof req.query.shipmentId === "string" ? req.query.shipmentId : undefined;

    const conditions = [eq(exceptionsTable.companyId, companyId)];
    if (status) {
      if (status === "ACTIVE") {
        conditions.push(inArray(exceptionsTable.status, ["OPEN", "IN_PROGRESS", "ESCALATED"]));
      } else {
        conditions.push(eq(exceptionsTable.status, status as any));
      }
    }
    if (severity) conditions.push(eq(exceptionsTable.severity, severity as any));
    if (shipmentId) conditions.push(eq(exceptionsTable.shipmentId, shipmentId));

    const exceptions = await db
      .select()
      .from(exceptionsTable)
      .where(and(...conditions))
      .orderBy(desc(exceptionsTable.createdAt))
      .limit(pg.limit)
      .offset(pg.offset);

    const [countResult] = await db
      .select({ cnt: sql<number>`count(*)` })
      .from(exceptionsTable)
      .where(and(...conditions));

    res.json({ data: exceptions, total: Number(countResult?.cnt ?? 0) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/exceptions/:id", async (req, res): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const id = String(req.params.id);
    const [exception] = await db
      .select()
      .from(exceptionsTable)
      .where(and(eq(exceptionsTable.id, id), eq(exceptionsTable.companyId, companyId)))
      .limit(1);
    if (!exception) { res.status(404).json({ error: "Exception not found" }); return; }
    res.json({ data: exception });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/exceptions/:id", requireMinRole("OPERATOR"), validateBody(updateExceptionSchema), async (req, res): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const id = String(req.params.id);
    const userId = (req as any).user?.userId;
    const { status, assignedToUserId, resolutionNotes, dueAt } = req.body;

    if (status === "RESOLVED") {
      if (!resolutionNotes?.trim()) {
        res.status(400).json({ error: "Resolution notes are required when resolving an exception" });
        return;
      }
      const result = await resolveException(id, companyId, userId, resolutionNotes);
      if (!result) { res.status(404).json({ error: "Exception not found" }); return; }
      res.json({ data: result });
      return;
    }

    if (status === "ESCALATED") {
      const result = await escalateException(id, companyId, userId);
      if (!result) { res.status(404).json({ error: "Exception not found" }); return; }
      res.json({ data: result });
      return;
    }

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (assignedToUserId !== undefined) updateData.assignedToUserId = assignedToUserId;
    if (resolutionNotes) updateData.resolutionNotes = resolutionNotes;
    if (dueAt !== undefined) updateData.dueAt = dueAt ? new Date(dueAt) : null;

    const [updated] = await db
      .update(exceptionsTable)
      .set(updateData)
      .where(and(eq(exceptionsTable.id, id), eq(exceptionsTable.companyId, companyId)))
      .returning();

    if (!updated) { res.status(404).json({ error: "Exception not found" }); return; }
    res.json({ data: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/exceptions/:id/assign", requireMinRole("OPERATOR"), validateBody(assignSchema), async (req, res): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const id = String(req.params.id);
    const userId = (req as any).user?.userId;
    const result = await assignException(id, companyId, req.body.assignedToUserId, userId);
    if (!result) { res.status(404).json({ error: "Exception not found" }); return; }
    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/exceptions/:id/escalate", requireMinRole("OPERATOR"), validateBody(escalateSchema), async (req, res): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const id = String(req.params.id);
    const userId = (req as any).user?.userId;
    const result = await escalateException(id, companyId, userId, req.body.reason);
    if (!result) { res.status(404).json({ error: "Exception not found" }); return; }
    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/exceptions/:id/resolve", requireMinRole("OPERATOR"), validateBody(resolveSchema), async (req, res): Promise<void> => {
  try {
    const companyId = getCompanyId(req);
    const id = String(req.params.id);
    const userId = (req as any).user?.userId;
    const result = await resolveException(id, companyId, userId, req.body.resolutionNotes);
    if (!result) { res.status(404).json({ error: "Exception not found" }); return; }
    res.json({ data: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
