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
} from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";

const router: IRouter = Router();

router.get("/shipments", async (_req, res) => {
  const shipments = await db
    .select()
    .from(shipmentsTable)
    .orderBy(desc(shipmentsTable.createdAt))
    .limit(50);

  const enriched = await Promise.all(
    shipments.map(async (shipment) => {
      const [compliance] = await db
        .select()
        .from(complianceScreeningsTable)
        .where(eq(complianceScreeningsTable.shipmentId, shipment.id))
        .limit(1);

      const [risk] = await db
        .select()
        .from(riskScoresTable)
        .where(eq(riskScoresTable.shipmentId, shipment.id))
        .limit(1);

      const [insurance] = await db
        .select()
        .from(insuranceQuotesTable)
        .where(eq(insuranceQuotesTable.shipmentId, shipment.id))
        .limit(1);

      const shipper = shipment.shipperId
        ? (await db.select().from(entitiesTable).where(eq(entitiesTable.id, shipment.shipperId)).limit(1))[0]
        : null;

      const consignee = shipment.consigneeId
        ? (await db.select().from(entitiesTable).where(eq(entitiesTable.id, shipment.consigneeId)).limit(1))[0]
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
  const { id } = req.params;
  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(eq(shipmentsTable.id, id))
    .limit(1);

  if (!shipment) {
    res.status(404).json({ error: "Shipment not found" });
    return;
  }

  const shipper = shipment.shipperId
    ? (await db.select().from(entitiesTable).where(eq(entitiesTable.id, shipment.shipperId)).limit(1))[0]
    : null;
  const consignee = shipment.consigneeId
    ? (await db.select().from(entitiesTable).where(eq(entitiesTable.id, shipment.consigneeId)).limit(1))[0]
    : null;
  const notifyParty = shipment.notifyPartyId
    ? (await db.select().from(entitiesTable).where(eq(entitiesTable.id, shipment.notifyPartyId)).limit(1))[0]
    : null;
  const carrier = shipment.carrierId
    ? (await db.select().from(entitiesTable).where(eq(entitiesTable.id, shipment.carrierId)).limit(1))[0]
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
  const { id } = req.params;
  const screenings = await db
    .select()
    .from(complianceScreeningsTable)
    .where(eq(complianceScreeningsTable.shipmentId, id));
  res.json({ data: screenings });
});

router.get("/shipments/:id/risk", async (req, res) => {
  const { id } = req.params;
  const [riskScore] = await db
    .select()
    .from(riskScoresTable)
    .where(eq(riskScoresTable.shipmentId, id))
    .limit(1);
  res.json({ data: riskScore ?? null });
});

router.get("/shipments/:id/insurance", async (req, res) => {
  const { id } = req.params;
  const [quote] = await db
    .select()
    .from(insuranceQuotesTable)
    .where(eq(insuranceQuotesTable.shipmentId, id))
    .limit(1);
  res.json({ data: quote ?? null });
});

router.get("/shipments/:id/documents", async (req, res) => {
  const { id } = req.params;
  const links = await db
    .select()
    .from(shipmentDocumentsTable)
    .where(eq(shipmentDocumentsTable.shipmentId, id));

  const docIds = links.map((l) => l.documentId);
  if (docIds.length === 0) {
    res.json({ data: [] });
    return;
  }

  const docs = await db
    .select()
    .from(ingestedDocumentsTable);

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
  const { id } = req.params;
  const corrections = await db
    .select()
    .from(operatorCorrectionsTable)
    .where(eq(operatorCorrectionsTable.shipmentId, id))
    .orderBy(desc(operatorCorrectionsTable.createdAt));
  res.json({ data: corrections });
});

router.get("/shipments/:id/events", async (req, res) => {
  const { id } = req.params;
  const events = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.entityId, id))
    .orderBy(desc(eventsTable.createdAt))
    .limit(100);
  res.json({ data: events });
});

router.post("/shipments/:id/approve", async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body as { userId?: string };

  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(eq(shipmentsTable.id, id))
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
  await db
    .update(shipmentsTable)
    .set({
      status: "APPROVED",
      approvedAt: now,
      approvedBy: userId || "operator",
    })
    .where(eq(shipmentsTable.id, id));

  await db.insert(eventsTable).values({
    id: generateId(),
    companyId: shipment.companyId,
    eventType: "SHIPMENT_APPROVED",
    entityType: "shipment",
    entityId: id,
    userId: userId || "operator",
    beforeState: { status: shipment.status },
    afterState: { status: "APPROVED" },
    metadata: { approvedAt: now.toISOString() },
  });

  res.json({ data: { id, status: "APPROVED", approvedAt: now } });
});

router.post("/shipments/:id/reject", async (req, res) => {
  const { id } = req.params;
  const { userId, reason } = req.body as { userId?: string; reason?: string };

  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(eq(shipmentsTable.id, id))
    .limit(1);

  if (!shipment) {
    res.status(404).json({ error: "Shipment not found" });
    return;
  }

  if (shipment.status !== "DRAFT" && shipment.status !== "PENDING_REVIEW") {
    res.status(400).json({ error: `Cannot reject shipment in ${shipment.status} status` });
    return;
  }

  await db
    .update(shipmentsTable)
    .set({ status: "REJECTED" })
    .where(eq(shipmentsTable.id, id));

  await db.insert(eventsTable).values({
    id: generateId(),
    companyId: shipment.companyId,
    eventType: "SHIPMENT_REJECTED",
    entityType: "shipment",
    entityId: id,
    userId: userId || "operator",
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

router.patch("/shipments/:id/fields", async (req, res) => {
  const { id } = req.params;
  const { fields, userId } = req.body as {
    fields: Record<string, unknown>;
    userId?: string;
  };

  if (!fields || typeof fields !== "object") {
    res.status(400).json({ error: "fields object is required" });
    return;
  }

  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(eq(shipmentsTable.id, id))
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
      companyId: shipment.companyId,
      shipmentId: id,
      fieldName: correction.fieldName,
      originalValue: correction.original as Record<string, unknown> | null,
      correctedValue: correction.corrected as Record<string, unknown> | null,
      correctedBy: userId || "operator",
    });
  }

  await db.insert(eventsTable).values({
    id: generateId(),
    companyId: shipment.companyId,
    eventType: "OPERATOR_CORRECTION",
    entityType: "shipment",
    entityId: id,
    userId: userId || "operator",
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

export default router;
