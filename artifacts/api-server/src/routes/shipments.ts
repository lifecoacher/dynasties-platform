import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  shipmentsTable,
  complianceScreeningsTable,
  riskScoresTable,
  insuranceQuotesTable,
  shipmentDocumentsTable,
  ingestedDocumentsTable,
  operatorCorrectionsTable,
  eventsTable,
  entitiesTable,
  shipmentChargesTable,
  invoicesTable,
  rateTablesTable,
  exceptionsTable,
  tradeLaneStatsTable,
  claimsTable,
  claimCommunicationsTable,
} from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import { publishPricingJob, publishClaimsJob } from "@workspace/queue";
import { getCompanyId } from "../middlewares/tenant.js";
import { requireMinRole } from "../middlewares/auth.js";

const router: IRouter = Router();

router.get("/shipments", async (req, res) => {
  const companyId = getCompanyId(req);
  const shipments = await db
    .select()
    .from(shipmentsTable)
    .where(eq(shipmentsTable.companyId, companyId))
    .orderBy(desc(shipmentsTable.createdAt))
    .limit(50);

  const enriched = await Promise.all(
    shipments.map(async (shipment) => {
      const [compliance] = await db
        .select()
        .from(complianceScreeningsTable)
        .where(and(eq(complianceScreeningsTable.shipmentId, shipment.id), eq(complianceScreeningsTable.companyId, companyId)))
        .limit(1);

      const [risk] = await db
        .select()
        .from(riskScoresTable)
        .where(and(eq(riskScoresTable.shipmentId, shipment.id), eq(riskScoresTable.companyId, companyId)))
        .limit(1);

      const [insurance] = await db
        .select()
        .from(insuranceQuotesTable)
        .where(and(eq(insuranceQuotesTable.shipmentId, shipment.id), eq(insuranceQuotesTable.companyId, companyId)))
        .limit(1);

      const shipper = shipment.shipperId
        ? (await db.select().from(entitiesTable).where(and(eq(entitiesTable.id, shipment.shipperId), eq(entitiesTable.companyId, companyId))).limit(1))[0]
        : null;

      const consignee = shipment.consigneeId
        ? (await db.select().from(entitiesTable).where(and(eq(entitiesTable.id, shipment.consigneeId), eq(entitiesTable.companyId, companyId))).limit(1))[0]
        : null;

      return {
        ...shipment,
        shipper: shipper ? { id: shipper.id, name: shipper.name } : null,
        consignee: consignee ? { id: consignee.id, name: consignee.name } : null,
        compliance: compliance
          ? { status: compliance.status, matchCount: compliance.matchCount, screenedParties: compliance.screenedParties }
          : null,
        risk: risk
          ? { compositeScore: risk.compositeScore, recommendedAction: risk.recommendedAction }
          : null,
        insurance: insurance
          ? { coverageType: insurance.coverageType, estimatedPremium: insurance.estimatedPremium, currency: insurance.currency }
          : null,
      };
    }),
  );

  res.json({ data: enriched });
});

router.get("/shipments/:id", async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;
  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(and(eq(shipmentsTable.id, id), eq(shipmentsTable.companyId, companyId)))
    .limit(1);

  if (!shipment) {
    res.status(404).json({ error: "Shipment not found" });
    return;
  }

  const shipper = shipment.shipperId
    ? (await db.select().from(entitiesTable).where(and(eq(entitiesTable.id, shipment.shipperId), eq(entitiesTable.companyId, companyId))).limit(1))[0]
    : null;
  const consignee = shipment.consigneeId
    ? (await db.select().from(entitiesTable).where(and(eq(entitiesTable.id, shipment.consigneeId), eq(entitiesTable.companyId, companyId))).limit(1))[0]
    : null;
  const notifyParty = shipment.notifyPartyId
    ? (await db.select().from(entitiesTable).where(and(eq(entitiesTable.id, shipment.notifyPartyId), eq(entitiesTable.companyId, companyId))).limit(1))[0]
    : null;
  const carrier = shipment.carrierId
    ? (await db.select().from(entitiesTable).where(and(eq(entitiesTable.id, shipment.carrierId), eq(entitiesTable.companyId, companyId))).limit(1))[0]
    : null;

  res.json({
    data: {
      ...shipment,
      shipper: shipper || null,
      consignee: consignee || null,
      notifyParty: notifyParty || null,
      carrier: carrier || null,
    },
  });
});

router.get("/shipments/:id/compliance", async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;
  const screenings = await db
    .select()
    .from(complianceScreeningsTable)
    .where(and(eq(complianceScreeningsTable.shipmentId, id), eq(complianceScreeningsTable.companyId, companyId)));
  res.json({ data: screenings });
});

router.get("/shipments/:id/risk", async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;
  const [riskScore] = await db
    .select()
    .from(riskScoresTable)
    .where(and(eq(riskScoresTable.shipmentId, id), eq(riskScoresTable.companyId, companyId)))
    .limit(1);
  res.json({ data: riskScore ?? null });
});

router.get("/shipments/:id/insurance", async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;
  const [quote] = await db
    .select()
    .from(insuranceQuotesTable)
    .where(and(eq(insuranceQuotesTable.shipmentId, id), eq(insuranceQuotesTable.companyId, companyId)))
    .limit(1);
  res.json({ data: quote ?? null });
});

router.get("/shipments/:id/documents", async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;
  const links = await db
    .select()
    .from(shipmentDocumentsTable)
    .where(and(eq(shipmentDocumentsTable.shipmentId, id), eq(shipmentDocumentsTable.companyId, companyId)));

  const docIds = links.map((l) => l.documentId).filter(Boolean) as string[];
  if (docIds.length === 0) {
    res.json({ data: [] });
    return;
  }

  const docs = await db
    .select()
    .from(ingestedDocumentsTable)
    .where(eq(ingestedDocumentsTable.companyId, companyId));

  const linkedDocs = docs
    .filter((d) => docIds.includes(d.id))
    .map((doc) => {
      const link = links.find((l) => l.documentId === doc.id);
      return {
        ...doc,
        shipmentDocumentId: link?.id,
        linkedDocumentType: link?.documentType,
      };
    });

  res.json({ data: linkedDocs });
});

router.get("/shipments/:id/corrections", async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;
  const corrections = await db
    .select()
    .from(operatorCorrectionsTable)
    .where(and(eq(operatorCorrectionsTable.shipmentId, id), eq(operatorCorrectionsTable.companyId, companyId)))
    .orderBy(desc(operatorCorrectionsTable.createdAt));
  res.json({ data: corrections });
});

router.get("/shipments/:id/events", async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;
  const events = await db
    .select()
    .from(eventsTable)
    .where(and(eq(eventsTable.entityId, id), eq(eventsTable.companyId, companyId)))
    .orderBy(desc(eventsTable.createdAt))
    .limit(100);
  res.json({ data: events });
});

router.post("/shipments/:id/approve", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;

  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(and(eq(shipmentsTable.id, id), eq(shipmentsTable.companyId, companyId)))
    .limit(1);

  if (!shipment) {
    res.status(404).json({ error: "Shipment not found" });
    return;
  }

  if (shipment.status !== "DRAFT" && shipment.status !== "PENDING_REVIEW") {
    res.status(400).json({ error: `Cannot approve shipment in ${shipment.status} status` });
    return;
  }

  const now = new Date();
  const actorId = req.user!.userId;

  await db
    .update(shipmentsTable)
    .set({
      status: "APPROVED",
      approvedAt: now,
      approvedBy: actorId,
    })
    .where(eq(shipmentsTable.id, id));

  await db.insert(eventsTable).values({
    id: generateId(),
    companyId,
    eventType: "SHIPMENT_APPROVED",
    entityType: "shipment",
    entityId: id,
    actorType: "USER",
    userId: actorId,
    beforeState: { status: shipment.status },
    afterState: { status: "APPROVED" },
    metadata: { approvedAt: now.toISOString() },
  });

  publishPricingJob({ companyId, shipmentId: id, trigger: "shipment_approved" });

  res.json({ data: { id, status: "APPROVED", approvedAt: now } });
});

router.post("/shipments/:id/reject", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;
  const { reason } = req.body as { reason?: string };

  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(and(eq(shipmentsTable.id, id), eq(shipmentsTable.companyId, companyId)))
    .limit(1);

  if (!shipment) {
    res.status(404).json({ error: "Shipment not found" });
    return;
  }

  if (shipment.status !== "DRAFT" && shipment.status !== "PENDING_REVIEW") {
    res.status(400).json({ error: `Cannot reject shipment in ${shipment.status} status` });
    return;
  }

  const actorId = req.user!.userId;

  await db
    .update(shipmentsTable)
    .set({ status: "REJECTED" })
    .where(eq(shipmentsTable.id, id));

  await db.insert(eventsTable).values({
    id: generateId(),
    companyId,
    eventType: "SHIPMENT_REJECTED",
    entityType: "shipment",
    entityId: id,
    actorType: "USER",
    userId: actorId,
    beforeState: { status: shipment.status },
    afterState: { status: "REJECTED" },
    metadata: { reason: reason || "No reason provided" },
  });

  res.json({ data: { id, status: "REJECTED", reason } });
});

const EDITABLE_FIELDS = new Set([
  "commodity", "hsCode", "portOfLoading", "portOfDischarge",
  "vessel", "voyage", "bookingNumber", "blNumber",
  "packageCount", "grossWeight", "weightUnit", "volume", "volumeUnit",
  "incoterms", "operatorNotes",
]);

router.patch("/shipments/:id/fields", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;
  const { fields } = req.body as { fields: Record<string, unknown> };

  if (!fields || typeof fields !== "object") {
    res.status(400).json({ error: "fields object is required" });
    return;
  }

  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(and(eq(shipmentsTable.id, id), eq(shipmentsTable.companyId, companyId)))
    .limit(1);

  if (!shipment) {
    res.status(404).json({ error: "Shipment not found" });
    return;
  }

  const invalidFields = Object.keys(fields).filter((f) => !EDITABLE_FIELDS.has(f));
  if (invalidFields.length > 0) {
    res.status(400).json({ error: `Non-editable fields: ${invalidFields.join(", ")}` });
    return;
  }

  const actorId = req.user!.userId;
  const corrections: Array<{ fieldName: string; original: unknown; corrected: unknown }> = [];
  const updateData: Record<string, unknown> = {};

  for (const [fieldName, newValue] of Object.entries(fields)) {
    const originalValue = (shipment as Record<string, unknown>)[fieldName];
    if (originalValue !== newValue) {
      corrections.push({ fieldName, original: originalValue, corrected: newValue });
      updateData[fieldName] = newValue;
    }
  }

  if (Object.keys(updateData).length === 0) {
    res.json({ data: { id, corrections: 0, message: "No changes detected" } });
    return;
  }

  await db
    .update(shipmentsTable)
    .set(updateData as Record<string, unknown>)
    .where(eq(shipmentsTable.id, id));

  for (const correction of corrections) {
    await db.insert(operatorCorrectionsTable).values({
      id: generateId(),
      companyId,
      shipmentId: id,
      fieldName: correction.fieldName,
      originalValue: correction.original as Record<string, unknown> | null,
      correctedValue: correction.corrected as Record<string, unknown> | null,
      correctedBy: actorId,
    });
  }

  await db.insert(eventsTable).values({
    id: generateId(),
    companyId,
    eventType: "OPERATOR_CORRECTION",
    entityType: "shipment",
    entityId: id,
    actorType: "USER",
    userId: actorId,
    metadata: {
      correctionCount: corrections.length,
      fields: corrections.map((c) => c.fieldName),
    },
  });

  res.json({
    data: {
      id,
      corrections: corrections.length,
      correctedFields: corrections.map((c) => c.fieldName),
    },
  });
});

router.get("/shipments/:id/charges", async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;
  const charges = await db
    .select()
    .from(shipmentChargesTable)
    .where(and(eq(shipmentChargesTable.shipmentId, id), eq(shipmentChargesTable.companyId, companyId)));
  res.json({ data: charges });
});

router.get("/shipments/:id/invoice", async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;
  const [invoice] = await db
    .select()
    .from(invoicesTable)
    .where(and(eq(invoicesTable.shipmentId, id), eq(invoicesTable.companyId, companyId)))
    .limit(1);
  if (!invoice) {
    res.status(404).json({ error: "No invoice found for this shipment" });
    return;
  }
  res.json({ data: invoice });
});

router.get("/invoices", async (req, res) => {
  const companyId = getCompanyId(req);
  const invoices = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.companyId, companyId))
    .orderBy(desc(invoicesTable.issuedAt))
    .limit(100);
  res.json({ data: invoices });
});

router.get("/rate-tables", async (req, res) => {
  const companyId = getCompanyId(req);
  const rates = await db
    .select()
    .from(rateTablesTable)
    .where(eq(rateTablesTable.companyId, companyId))
    .orderBy(desc(rateTablesTable.createdAt))
    .limit(200);
  res.json({ data: rates });
});

router.post("/rate-tables", requireMinRole("MANAGER"), async (req, res) => {
  const companyId = getCompanyId(req);
  const {
    chargeCode,
    description,
    carrier,
    origin,
    destination,
    unitPrice,
    currency,
    validFrom,
    validTo,
  } = req.body as {
    chargeCode: string;
    description: string;
    carrier: string;
    origin: string;
    destination: string;
    unitPrice: number;
    currency?: string;
    validFrom?: string;
    validTo?: string;
  };

  if (!chargeCode || !description || !unitPrice || !carrier || !origin || !destination) {
    res.status(400).json({ error: "chargeCode, description, carrier, origin, destination, and unitPrice are required" });
    return;
  }

  const id = generateId();
  await db.insert(rateTablesTable).values({
    id,
    companyId,
    carrier,
    chargeCode,
    description,
    origin,
    destination,
    unitPrice,
    currency: currency || "USD",
    validFrom: validFrom ? new Date(validFrom) : null,
    validTo: validTo ? new Date(validTo) : null,
    metadata: null,
  });

  await db.insert(eventsTable).values({
    id: generateId(),
    companyId,
    eventType: "RATE_TABLE_CREATED",
    entityType: "rate_table",
    entityId: id,
    actorType: "USER",
    userId: req.user!.userId,
    metadata: { chargeCode, carrier, origin, destination, unitPrice },
  });

  const [created] = await db.select().from(rateTablesTable).where(eq(rateTablesTable.id, id)).limit(1);
  res.status(201).json({ data: created });
});

router.get("/shipments/:id/exceptions", async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;
  const exceptions = await db
    .select()
    .from(exceptionsTable)
    .where(and(eq(exceptionsTable.shipmentId, id), eq(exceptionsTable.companyId, companyId)))
    .orderBy(desc(exceptionsTable.createdAt));
  res.json({ data: exceptions });
});

router.patch("/exceptions/:id", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;
  const { status, resolutionNotes } = req.body as {
    status?: string;
    resolutionNotes?: string;
  };

  const [exception] = await db
    .select()
    .from(exceptionsTable)
    .where(and(eq(exceptionsTable.id, id), eq(exceptionsTable.companyId, companyId)))
    .limit(1);

  if (!exception) {
    res.status(404).json({ error: "Exception not found" });
    return;
  }

  const actorId = req.user!.userId;
  const updateData: Record<string, unknown> = {};
  if (status) updateData.status = status;
  if (resolutionNotes) updateData.resolutionNotes = resolutionNotes;
  if (status === "RESOLVED") {
    updateData.resolvedAt = new Date();
    updateData.resolvedBy = actorId;
  }

  await db
    .update(exceptionsTable)
    .set(updateData)
    .where(eq(exceptionsTable.id, id));

  await db.insert(eventsTable).values({
    id: generateId(),
    companyId,
    eventType: "EXCEPTION_UPDATED",
    entityType: "exception",
    entityId: id,
    actorType: "USER",
    userId: actorId,
    beforeState: { status: exception.status },
    afterState: { status: status || exception.status },
    metadata: { resolutionNotes },
  });

  const [updated] = await db
    .select()
    .from(exceptionsTable)
    .where(eq(exceptionsTable.id, id))
    .limit(1);

  res.json({ data: updated });
});

router.get("/exceptions/:id", async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;
  const [exception] = await db
    .select()
    .from(exceptionsTable)
    .where(and(eq(exceptionsTable.id, id), eq(exceptionsTable.companyId, companyId)))
    .limit(1);

  if (!exception) {
    res.status(404).json({ error: "Exception not found" });
    return;
  }
  res.json({ data: exception });
});

router.get("/exceptions", async (req, res) => {
  const companyId = getCompanyId(req);
  const exceptions = await db
    .select()
    .from(exceptionsTable)
    .where(eq(exceptionsTable.companyId, companyId))
    .orderBy(desc(exceptionsTable.createdAt))
    .limit(100);
  res.json({ data: exceptions });
});

router.get("/trade-lanes", async (req, res) => {
  const companyId = getCompanyId(req);
  const lanes = await db
    .select()
    .from(tradeLaneStatsTable)
    .where(eq(tradeLaneStatsTable.companyId, companyId))
    .orderBy(desc(tradeLaneStatsTable.lastUpdated))
    .limit(100);
  res.json({ data: lanes });
});

router.get("/trade-lanes/:id", async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;
  const [lane] = await db
    .select()
    .from(tradeLaneStatsTable)
    .where(and(eq(tradeLaneStatsTable.id, id), eq(tradeLaneStatsTable.companyId, companyId)))
    .limit(1);

  if (!lane) {
    res.status(404).json({ error: "Trade lane not found" });
    return;
  }
  res.json({ data: lane });
});

router.get("/shipments/:id/claims", async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;
  const claims = await db
    .select()
    .from(claimsTable)
    .where(and(eq(claimsTable.shipmentId, id), eq(claimsTable.companyId, companyId)))
    .orderBy(desc(claimsTable.createdAt));
  res.json({ data: claims });
});

router.post("/shipments/:id/claims", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;
  const { claimType, incidentDescription } = req.body as {
    claimType: string;
    incidentDescription: string;
  };

  if (!claimType || !incidentDescription) {
    res.status(400).json({ error: "claimType and incidentDescription are required" });
    return;
  }

  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(and(eq(shipmentsTable.id, id), eq(shipmentsTable.companyId, companyId)))
    .limit(1);

  if (!shipment) {
    res.status(404).json({ error: "Shipment not found" });
    return;
  }

  publishClaimsJob({
    companyId,
    shipmentId: id,
    claimType,
    incidentDescription,
    trigger: "manual",
  });

  res.status(202).json({ data: { shipmentId: id, claimType, status: "PROCESSING" } });
});

router.get("/claims", async (req, res) => {
  const companyId = getCompanyId(req);
  const claims = await db
    .select()
    .from(claimsTable)
    .where(eq(claimsTable.companyId, companyId))
    .orderBy(desc(claimsTable.createdAt))
    .limit(100);
  res.json({ data: claims });
});

router.get("/claims/:id", async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;
  const [claim] = await db
    .select()
    .from(claimsTable)
    .where(and(eq(claimsTable.id, id), eq(claimsTable.companyId, companyId)))
    .limit(1);

  if (!claim) {
    res.status(404).json({ error: "Claim not found" });
    return;
  }
  res.json({ data: claim });
});

router.get("/claims/:id/communications", async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;
  const comms = await db
    .select()
    .from(claimCommunicationsTable)
    .where(and(eq(claimCommunicationsTable.claimId, id), eq(claimCommunicationsTable.companyId, companyId)))
    .orderBy(desc(claimCommunicationsTable.createdAt));
  res.json({ data: comms });
});

router.patch("/claims/:id", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  const { id } = req.params;
  const { status } = req.body as { status?: string };

  const [claim] = await db
    .select()
    .from(claimsTable)
    .where(and(eq(claimsTable.id, id), eq(claimsTable.companyId, companyId)))
    .limit(1);

  if (!claim) {
    res.status(404).json({ error: "Claim not found" });
    return;
  }

  const actorId = req.user!.userId;
  const updateData: Record<string, unknown> = {};
  if (status) updateData.status = status;

  await db
    .update(claimsTable)
    .set(updateData)
    .where(eq(claimsTable.id, id));

  await db.insert(eventsTable).values({
    id: generateId(),
    companyId,
    eventType: "CLAIM_UPDATED",
    entityType: "claim",
    entityId: id,
    actorType: "USER",
    userId: actorId,
    beforeState: { status: claim.status },
    afterState: { status: status || claim.status },
  });

  const [updated] = await db
    .select()
    .from(claimsTable)
    .where(eq(claimsTable.id, id))
    .limit(1);

  res.json({ data: updated });
});

export default router;
