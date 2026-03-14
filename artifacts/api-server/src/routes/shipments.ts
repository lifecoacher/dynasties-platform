import { Router, type IRouter } from "express";
import { db, type DbTransaction } from "@workspace/db";
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
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import { publishPricingJob, publishClaimsJob } from "@workspace/queue";
import { getCompanyId } from "../middlewares/tenant.js";
import { requireMinRole } from "../middlewares/auth.js";
import { parsePagination, paginatedResponse } from "../middlewares/pagination.js";
import { validateBody } from "../middlewares/validate.js";
import {
  approveShipmentSchema,
  rejectShipmentSchema,
  patchShipmentFieldsSchema,
  createRateTableSchema,
  patchExceptionSchema,
  createClaimSchema,
  patchClaimSchema,
} from "../schemas/index.js";

const router: IRouter = Router();

function paramId(req: { params: Record<string, unknown> }): string {
  return req.params.id as string;
}

router.get("/shipments", async (req, res) => {
  const companyId = getCompanyId(req);
  const pg = parsePagination(req);
  const shipments = await db
    .select()
    .from(shipmentsTable)
    .where(eq(shipmentsTable.companyId, companyId))
    .orderBy(desc(shipmentsTable.createdAt))
    .limit(pg.limit)
    .offset(pg.offset);

  const shipmentIds = shipments.map((s: any) => s.id);
  if (shipmentIds.length === 0) {
    res.json(paginatedResponse([], pg));
    return;
  }

  const entityIds = [
    ...new Set(
      shipments
        .flatMap((s: any) => [s.shipperId, s.consigneeId])
        .filter(Boolean) as string[],
    ),
  ];

  const [complianceRows, riskRows, insuranceRows, entityRows] =
    await Promise.all([
      db
        .select()
        .from(complianceScreeningsTable)
        .where(
          and(
            inArray(complianceScreeningsTable.shipmentId, shipmentIds),
            eq(complianceScreeningsTable.companyId, companyId),
          ),
        ),
      db
        .select()
        .from(riskScoresTable)
        .where(
          and(
            inArray(riskScoresTable.shipmentId, shipmentIds),
            eq(riskScoresTable.companyId, companyId),
          ),
        ),
      db
        .select()
        .from(insuranceQuotesTable)
        .where(
          and(
            inArray(insuranceQuotesTable.shipmentId, shipmentIds),
            eq(insuranceQuotesTable.companyId, companyId),
          ),
        ),
      entityIds.length > 0
        ? db
            .select()
            .from(entitiesTable)
            .where(
              and(
                inArray(entitiesTable.id, entityIds),
                eq(entitiesTable.companyId, companyId),
              ),
            )
        : Promise.resolve([]),
    ]);

  const complianceMap = new Map(
    complianceRows.map((c: any) => [c.shipmentId, c]),
  );
  const riskMap = new Map(riskRows.map((r: any) => [r.shipmentId, r]));
  const insuranceMap = new Map(
    insuranceRows.map((i: any) => [i.shipmentId, i]),
  );
  const entityMap = new Map(entityRows.map((e: any) => [e.id, e]));

  const enriched = shipments.map((shipment: any) => {
    const compliance = complianceMap.get(shipment.id);
    const risk = riskMap.get(shipment.id);
    const insurance = insuranceMap.get(shipment.id);
    const shipper = shipment.shipperId
      ? entityMap.get(shipment.shipperId)
      : null;
    const consignee = shipment.consigneeId
      ? entityMap.get(shipment.consigneeId)
      : null;

    return {
      ...shipment,
      shipper: shipper ? { id: shipper.id, name: shipper.name } : null,
      consignee: consignee
        ? { id: consignee.id, name: consignee.name }
        : null,
      compliance: compliance
        ? {
            status: compliance.status,
            matchCount: compliance.matchCount,
            screenedParties: compliance.screenedParties,
          }
        : null,
      risk: risk
        ? {
            compositeScore: risk.compositeScore,
            recommendedAction: risk.recommendedAction,
          }
        : null,
      insurance: insurance
        ? {
            coverageType: insurance.coverageType,
            estimatedPremium: insurance.estimatedPremium,
            currency: insurance.currency,
          }
        : null,
    };
  });

  res.json(paginatedResponse(enriched, pg));
});

router.get("/shipments/:id", async (req, res) => {
  const companyId = getCompanyId(req);
  const id = paramId(req);
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
  const id = paramId(req);
  const screenings = await db
    .select()
    .from(complianceScreeningsTable)
    .where(and(eq(complianceScreeningsTable.shipmentId, id), eq(complianceScreeningsTable.companyId, companyId)));
  res.json({ data: screenings });
});

router.get("/shipments/:id/risk", async (req, res) => {
  const companyId = getCompanyId(req);
  const id = paramId(req);
  const [riskScore] = await db
    .select()
    .from(riskScoresTable)
    .where(and(eq(riskScoresTable.shipmentId, id), eq(riskScoresTable.companyId, companyId)))
    .limit(1);
  res.json({ data: riskScore ?? null });
});

router.get("/shipments/:id/insurance", async (req, res) => {
  const companyId = getCompanyId(req);
  const id = paramId(req);
  const [quote] = await db
    .select()
    .from(insuranceQuotesTable)
    .where(and(eq(insuranceQuotesTable.shipmentId, id), eq(insuranceQuotesTable.companyId, companyId)))
    .limit(1);
  res.json({ data: quote ?? null });
});

router.get("/shipments/:id/documents", async (req, res) => {
  const companyId = getCompanyId(req);
  const id = paramId(req);
  const links = await db
    .select()
    .from(shipmentDocumentsTable)
    .where(and(eq(shipmentDocumentsTable.shipmentId, id), eq(shipmentDocumentsTable.companyId, companyId)));

  const docIds = links.map((l: any) => l.documentId).filter(Boolean) as string[];
  if (docIds.length === 0) {
    res.json({ data: [] });
    return;
  }

  const docs = await db
    .select()
    .from(ingestedDocumentsTable)
    .where(eq(ingestedDocumentsTable.companyId, companyId));

  const linkedDocs = docs
    .filter((d: any) => docIds.includes(d.id))
    .map((doc: any) => {
      const link = links.find((l: any) => l.documentId === doc.id);
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
  const id = paramId(req);
  const corrections = await db
    .select()
    .from(operatorCorrectionsTable)
    .where(and(eq(operatorCorrectionsTable.shipmentId, id), eq(operatorCorrectionsTable.companyId, companyId)))
    .orderBy(desc(operatorCorrectionsTable.createdAt));
  res.json({ data: corrections });
});

router.get("/shipments/:id/events", async (req, res) => {
  const companyId = getCompanyId(req);
  const id = paramId(req);
  const pg = parsePagination(req);
  const events = await db
    .select()
    .from(eventsTable)
    .where(and(eq(eventsTable.entityId, id), eq(eventsTable.companyId, companyId)))
    .orderBy(desc(eventsTable.createdAt))
    .limit(pg.limit)
    .offset(pg.offset);
  res.json(paginatedResponse(events, pg));
});

router.post("/shipments/:id/approve", requireMinRole("OPERATOR"), validateBody(approveShipmentSchema), async (req, res) => {
  const companyId = getCompanyId(req);
  const id = paramId(req);

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

  await db.transaction(async (tx: DbTransaction) => {
    await tx
      .update(shipmentsTable)
      .set({
        status: "APPROVED",
        approvedAt: now,
        approvedBy: actorId,
      })
      .where(eq(shipmentsTable.id, id));

    await tx.insert(eventsTable).values({
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
  });

  publishPricingJob({ companyId, shipmentId: id, trigger: "shipment_approved" });

  res.json({ data: { id, status: "APPROVED", approvedAt: now } });
});

router.post("/shipments/:id/reject", requireMinRole("OPERATOR"), validateBody(rejectShipmentSchema), async (req, res) => {
  const companyId = getCompanyId(req);
  const id = paramId(req);
  const { reason } = req.body;

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

  await db.transaction(async (tx: DbTransaction) => {
    await tx
      .update(shipmentsTable)
      .set({ status: "REJECTED" })
      .where(eq(shipmentsTable.id, id));

    await tx.insert(eventsTable).values({
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
  });

  res.json({ data: { id, status: "REJECTED", reason } });
});

const EDITABLE_FIELDS = new Set([
  "commodity", "hsCode", "portOfLoading", "portOfDischarge",
  "vessel", "voyage", "bookingNumber", "blNumber",
  "packageCount", "grossWeight", "weightUnit", "volume", "volumeUnit",
  "incoterms", "operatorNotes",
]);

router.patch("/shipments/:id/fields", requireMinRole("OPERATOR"), validateBody(patchShipmentFieldsSchema), async (req, res) => {
  const companyId = getCompanyId(req);
  const id = paramId(req);
  const { fields } = req.body;

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

  await db.transaction(async (tx: DbTransaction) => {
    await tx
      .update(shipmentsTable)
      .set(updateData as Record<string, unknown>)
      .where(eq(shipmentsTable.id, id));

    for (const correction of corrections) {
      await tx.insert(operatorCorrectionsTable).values({
        id: generateId(),
        companyId,
        shipmentId: id,
        fieldName: correction.fieldName,
        originalValue: correction.original as Record<string, unknown> | null,
        correctedValue: correction.corrected as Record<string, unknown> | null,
        correctedBy: actorId,
      });
    }

    await tx.insert(eventsTable).values({
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
  const id = paramId(req);
  const charges = await db
    .select()
    .from(shipmentChargesTable)
    .where(and(eq(shipmentChargesTable.shipmentId, id), eq(shipmentChargesTable.companyId, companyId)));
  res.json({ data: charges });
});

router.get("/shipments/:id/invoice", async (req, res) => {
  const companyId = getCompanyId(req);
  const id = paramId(req);
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
  const pg = parsePagination(req);
  const invoices = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.companyId, companyId))
    .orderBy(desc(invoicesTable.issuedAt))
    .limit(pg.limit)
    .offset(pg.offset);
  res.json(paginatedResponse(invoices, pg));
});

router.get("/rate-tables", async (req, res) => {
  const companyId = getCompanyId(req);
  const pg = parsePagination(req, 100, 500);
  const rates = await db
    .select()
    .from(rateTablesTable)
    .where(eq(rateTablesTable.companyId, companyId))
    .orderBy(desc(rateTablesTable.createdAt))
    .limit(pg.limit)
    .offset(pg.offset);
  res.json(paginatedResponse(rates, pg));
});

router.post("/rate-tables", requireMinRole("MANAGER"), validateBody(createRateTableSchema), async (req, res) => {
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
    unitPrice: number | string;
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
    unitPrice: String(unitPrice),
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
  const id = paramId(req);
  const exceptions = await db
    .select()
    .from(exceptionsTable)
    .where(and(eq(exceptionsTable.shipmentId, id), eq(exceptionsTable.companyId, companyId)))
    .orderBy(desc(exceptionsTable.createdAt));
  res.json({ data: exceptions });
});

router.patch("/exceptions/:id", requireMinRole("OPERATOR"), validateBody(patchExceptionSchema), async (req, res) => {
  const companyId = getCompanyId(req);
  const id = paramId(req);
  const { status, resolution: resolutionNotes } = req.body as {
    status: string;
    resolution?: string;
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

  const VALID_EXCEPTION_STATUSES = ["OPEN", "INVESTIGATING", "RESOLVED", "ESCALATED", "DISMISSED"];

  const actorId = req.user!.userId;
  const updateData: Record<string, unknown> = {};
  if (status) {
    if (!VALID_EXCEPTION_STATUSES.includes(status)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_EXCEPTION_STATUSES.join(", ")}` });
      return;
    }
    updateData.status = status;
  }
  if (resolutionNotes) updateData.resolutionNotes = resolutionNotes;
  if (status === "RESOLVED") {
    updateData.resolvedAt = new Date();
    updateData.resolvedBy = actorId;
  }

  await db.transaction(async (tx: DbTransaction) => {
    await tx
      .update(exceptionsTable)
      .set(updateData)
      .where(eq(exceptionsTable.id, id));

    await tx.insert(eventsTable).values({
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
  const id = paramId(req);
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
  const pg = parsePagination(req);
  const exceptions = await db
    .select()
    .from(exceptionsTable)
    .where(eq(exceptionsTable.companyId, companyId))
    .orderBy(desc(exceptionsTable.createdAt))
    .limit(pg.limit)
    .offset(pg.offset);
  res.json(paginatedResponse(exceptions, pg));
});

router.get("/trade-lanes", async (req, res) => {
  const companyId = getCompanyId(req);
  const pg = parsePagination(req);
  const lanes = await db
    .select()
    .from(tradeLaneStatsTable)
    .where(eq(tradeLaneStatsTable.companyId, companyId))
    .orderBy(desc(tradeLaneStatsTable.lastUpdated))
    .limit(pg.limit)
    .offset(pg.offset);
  res.json(paginatedResponse(lanes, pg));
});

router.get("/trade-lanes/:id", async (req, res) => {
  const companyId = getCompanyId(req);
  const id = paramId(req);
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
  const id = paramId(req);
  const claims = await db
    .select()
    .from(claimsTable)
    .where(and(eq(claimsTable.shipmentId, id), eq(claimsTable.companyId, companyId)))
    .orderBy(desc(claimsTable.createdAt));
  res.json({ data: claims });
});

router.post("/shipments/:id/claims", requireMinRole("OPERATOR"), validateBody(createClaimSchema), async (req, res) => {
  const companyId = getCompanyId(req);
  const id = paramId(req);
  const { claimType, incidentDescription } = req.body;

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
  const pg = parsePagination(req);
  const claims = await db
    .select()
    .from(claimsTable)
    .where(eq(claimsTable.companyId, companyId))
    .orderBy(desc(claimsTable.createdAt))
    .limit(pg.limit)
    .offset(pg.offset);
  res.json(paginatedResponse(claims, pg));
});

router.get("/claims/:id", async (req, res) => {
  const companyId = getCompanyId(req);
  const id = paramId(req);
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
  const id = paramId(req);
  const comms = await db
    .select()
    .from(claimCommunicationsTable)
    .where(and(eq(claimCommunicationsTable.claimId, id), eq(claimCommunicationsTable.companyId, companyId)))
    .orderBy(desc(claimCommunicationsTable.createdAt));
  res.json({ data: comms });
});

router.patch("/claims/:id", requireMinRole("OPERATOR"), validateBody(patchClaimSchema), async (req, res) => {
  const companyId = getCompanyId(req);
  const id = paramId(req);
  const { status } = req.body;

  const [claim] = await db
    .select()
    .from(claimsTable)
    .where(and(eq(claimsTable.id, id), eq(claimsTable.companyId, companyId)))
    .limit(1);

  if (!claim) {
    res.status(404).json({ error: "Claim not found" });
    return;
  }

  const VALID_CLAIM_STATUSES = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "DENIED", "CLOSED"];

  const actorId = req.user!.userId;
  const updateData: Record<string, unknown> = {};
  if (status) {
    if (!VALID_CLAIM_STATUSES.includes(status)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_CLAIM_STATUSES.join(", ")}` });
      return;
    }
    updateData.status = status;
  }

  await db.transaction(async (tx: DbTransaction) => {
    await tx
      .update(claimsTable)
      .set(updateData)
      .where(eq(claimsTable.id, id));

    await tx.insert(eventsTable).values({
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
  });

  const [updated] = await db
    .select()
    .from(claimsTable)
    .where(eq(claimsTable.id, id))
    .limit(1);

  res.json({ data: updated });
});

export default router;
