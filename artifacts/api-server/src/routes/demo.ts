import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  ingestedEmailsTable,
  ingestedDocumentsTable,
  shipmentDocumentsTable,
  shipmentsTable,
  complianceScreeningsTable,
  riskScoresTable,
  insuranceQuotesTable,
  operatorCorrectionsTable,
  eventsTable,
  entitiesTable,
  shipmentChargesTable,
  invoicesTable,
  exceptionsTable,
  claimsTable,
  claimCommunicationsTable,
} from "@workspace/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { requireAuth, requireRole, refreshRole } from "../middlewares/auth.js";
import { getCompanyId } from "../middlewares/tenant.js";
import * as fs from "node:fs";
import * as path from "node:path";

const router: IRouter = Router();

const DEMO_MESSAGE_ID = "<demo-bol-2026-03-12@megatech-sz.cn>";

const demoGuard = [requireAuth, refreshRole, requireRole("ADMIN")] as any[];

router.post("/demo/ingest", ...demoGuard, async (req, res) => {
  try {
    const companyId = getCompanyId(req);

    const existing = await db
      .select({ id: ingestedEmailsTable.id })
      .from(ingestedEmailsTable)
      .where(
        and(
          eq(ingestedEmailsTable.companyId, companyId),
          eq(ingestedEmailsTable.messageId, DEMO_MESSAGE_ID),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({
        error: "Demo email already ingested. Use the Reset button first to clear previous demo data.",
        emailId: existing[0].id,
      });
      return;
    }

    const emlPath = path.resolve(process.cwd(), "../../.demo", "demo-email.eml");
    if (!fs.existsSync(emlPath)) {
      res.status(500).json({ error: "Demo email file not found at .demo/demo-email.eml" });
      return;
    }

    const emlBuffer = fs.readFileSync(emlPath);

    const { ingestEmail } = await import("@workspace/svc-email-ingestion");
    const result = await ingestEmail(emlBuffer, companyId);

    res.status(201).json({
      data: {
        ...result,
        message: "Demo email ingested successfully. The pipeline is now processing.",
      },
    });
  } catch (err) {
    console.error("[demo-ingest] error:", err);
    res.status(500).json({ error: "Demo ingestion failed" });
  }
});

router.post("/demo/reset", ...demoGuard, async (req, res) => {
  try {
    const companyId = getCompanyId(req);

    const demoEmails = await db
      .select({ id: ingestedEmailsTable.id })
      .from(ingestedEmailsTable)
      .where(
        and(
          eq(ingestedEmailsTable.companyId, companyId),
          eq(ingestedEmailsTable.messageId, DEMO_MESSAGE_ID),
        ),
      );

    if (demoEmails.length === 0) {
      res.json({ data: { message: "No demo data found to reset.", cleaned: {} } });
      return;
    }

    const emailIds = demoEmails.map((e) => e.id);

    const demoDocs = await db
      .select({ id: ingestedDocumentsTable.id })
      .from(ingestedDocumentsTable)
      .where(and(inArray(ingestedDocumentsTable.emailId, emailIds), eq(ingestedDocumentsTable.companyId, companyId)));

    const docIds = demoDocs.map((d) => d.id);

    const demoShipmentDocs = docIds.length > 0
      ? await db
          .select({ shipmentId: shipmentDocumentsTable.shipmentId })
          .from(shipmentDocumentsTable)
          .where(and(inArray(shipmentDocumentsTable.documentId, docIds), eq(shipmentDocumentsTable.companyId, companyId)))
      : [];

    const shipmentIds = [...new Set(demoShipmentDocs.map((sd) => sd.shipmentId))];

    const cleaned: Record<string, number> = {};

    if (shipmentIds.length > 0) {
      const claimRows = await db
        .select({ id: claimsTable.id })
        .from(claimsTable)
        .where(and(inArray(claimsTable.shipmentId, shipmentIds), eq(claimsTable.companyId, companyId)));

      if (claimRows.length > 0) {
        await db
          .delete(claimCommunicationsTable)
          .where(and(inArray(claimCommunicationsTable.claimId, claimRows.map((c) => c.id)), eq(claimCommunicationsTable.companyId, companyId)));
        await db
          .delete(claimsTable)
          .where(and(inArray(claimsTable.id, claimRows.map((c) => c.id)), eq(claimsTable.companyId, companyId)));
      }

      await db.delete(exceptionsTable).where(and(inArray(exceptionsTable.shipmentId, shipmentIds), eq(exceptionsTable.companyId, companyId)));
      await db.delete(shipmentChargesTable).where(and(inArray(shipmentChargesTable.shipmentId, shipmentIds), eq(shipmentChargesTable.companyId, companyId)));
      await db.delete(invoicesTable).where(and(inArray(invoicesTable.shipmentId, shipmentIds), eq(invoicesTable.companyId, companyId)));
      await db.delete(operatorCorrectionsTable).where(and(inArray(operatorCorrectionsTable.shipmentId, shipmentIds), eq(operatorCorrectionsTable.companyId, companyId)));
      await db.delete(insuranceQuotesTable).where(and(inArray(insuranceQuotesTable.shipmentId, shipmentIds), eq(insuranceQuotesTable.companyId, companyId)));
      await db.delete(riskScoresTable).where(and(inArray(riskScoresTable.shipmentId, shipmentIds), eq(riskScoresTable.companyId, companyId)));
      await db.delete(complianceScreeningsTable).where(and(inArray(complianceScreeningsTable.shipmentId, shipmentIds), eq(complianceScreeningsTable.companyId, companyId)));
      await db.delete(shipmentDocumentsTable).where(and(inArray(shipmentDocumentsTable.shipmentId, shipmentIds), eq(shipmentDocumentsTable.companyId, companyId)));
      await db.delete(eventsTable).where(
        and(inArray(eventsTable.entityId, shipmentIds), eq(eventsTable.companyId, companyId)),
      );
      await db.delete(shipmentsTable).where(
        and(inArray(shipmentsTable.id, shipmentIds), eq(shipmentsTable.companyId, companyId)),
      );

      cleaned.shipments = shipmentIds.length;
    }

    if (docIds.length > 0) {
      await db.delete(eventsTable).where(
        and(inArray(eventsTable.entityId, docIds), eq(eventsTable.companyId, companyId)),
      );
      await db
        .delete(ingestedDocumentsTable)
        .where(and(inArray(ingestedDocumentsTable.id, docIds), eq(ingestedDocumentsTable.companyId, companyId)));
      cleaned.documents = docIds.length;
    }

    await db
      .delete(ingestedEmailsTable)
      .where(and(inArray(ingestedEmailsTable.id, emailIds), eq(ingestedEmailsTable.companyId, companyId)));
    cleaned.emails = emailIds.length;

    const orphanEntities = await db.execute(
      sql`DELETE FROM entities
          WHERE company_id = ${companyId}
            AND id NOT IN (SELECT DISTINCT shipper_id FROM shipments WHERE shipper_id IS NOT NULL AND company_id = ${companyId})
            AND id NOT IN (SELECT DISTINCT consignee_id FROM shipments WHERE consignee_id IS NOT NULL AND company_id = ${companyId})
            AND id NOT IN (SELECT DISTINCT notify_party_id FROM shipments WHERE notify_party_id IS NOT NULL AND company_id = ${companyId})
            AND id NOT IN (SELECT DISTINCT carrier_id FROM shipments WHERE carrier_id IS NOT NULL AND company_id = ${companyId})
            AND status = 'UNVERIFIED'
          RETURNING id`,
    );
    cleaned.orphanedEntities = Array.isArray(orphanEntities) ? orphanEntities.length : 0;

    res.json({
      data: {
        message: "Demo data reset complete. The Workbench is ready for a fresh demo.",
        cleaned,
      },
    });
  } catch (err) {
    console.error("[demo-reset] error:", err);
    res.status(500).json({ error: "Demo reset failed" });
  }
});

router.get("/demo/status", ...demoGuard, async (req, res) => {
  const companyId = getCompanyId(req);

  const demoEmails = await db
    .select({
      id: ingestedEmailsTable.id,
      status: ingestedEmailsTable.status,
      createdAt: ingestedEmailsTable.createdAt,
    })
    .from(ingestedEmailsTable)
    .where(
      and(
        eq(ingestedEmailsTable.companyId, companyId),
        eq(ingestedEmailsTable.messageId, DEMO_MESSAGE_ID),
      ),
    );

  if (demoEmails.length === 0) {
    res.json({ data: { ingested: false, message: "No demo email has been ingested yet." } });
    return;
  }

  const emailId = demoEmails[0].id;

  const docs = await db
    .select({
      id: ingestedDocumentsTable.id,
      extractionStatus: ingestedDocumentsTable.extractionStatus,
    })
    .from(ingestedDocumentsTable)
    .where(eq(ingestedDocumentsTable.emailId, emailId));

  const shipmentLinks = docs.length > 0
    ? await db
        .select({ shipmentId: shipmentDocumentsTable.shipmentId })
        .from(shipmentDocumentsTable)
        .where(inArray(shipmentDocumentsTable.documentId, docs.map((d) => d.id)))
    : [];

  const shipmentIds = [...new Set(shipmentLinks.map((sl) => sl.shipmentId))];
  let shipments: any[] = [];
  if (shipmentIds.length > 0) {
    shipments = await db
      .select({
        id: shipmentsTable.id,
        reference: shipmentsTable.reference,
        status: shipmentsTable.status,
      })
      .from(shipmentsTable)
      .where(and(inArray(shipmentsTable.id, shipmentIds), eq(shipmentsTable.companyId, companyId)));
  }

  res.json({
    data: {
      ingested: true,
      email: demoEmails[0],
      documents: docs,
      shipments,
    },
  });
});

router.get("/demo/shipment-intelligence", ...demoGuard, async (req, res) => {
  try {
    const companyId = getCompanyId(req);

    const allShipments = await db
      .select()
      .from(shipmentsTable)
      .where(eq(shipmentsTable.companyId, companyId));

    if (allShipments.length === 0) {
      res.json({ data: { shipments: [], summary: { total: 0 } } });
      return;
    }

    const shipmentIds = allShipments.map((s) => s.id);

    const [allCompliance, allRisk, allInsurance, allEntities] = await Promise.all([
      db.select().from(complianceScreeningsTable).where(and(inArray(complianceScreeningsTable.shipmentId, shipmentIds), eq(complianceScreeningsTable.companyId, companyId))),
      db.select().from(riskScoresTable).where(and(inArray(riskScoresTable.shipmentId, shipmentIds), eq(riskScoresTable.companyId, companyId))),
      db.select().from(insuranceQuotesTable).where(and(inArray(insuranceQuotesTable.shipmentId, shipmentIds), eq(insuranceQuotesTable.companyId, companyId))),
      db.select().from(entitiesTable).where(eq(entitiesTable.companyId, companyId)),
    ]);

    const complianceMap = Object.fromEntries(allCompliance.map((c) => [c.shipmentId, c]));
    const riskMap = Object.fromEntries(allRisk.map((r) => [r.shipmentId, r]));
    const insuranceMap = Object.fromEntries(allInsurance.map((i) => [i.shipmentId, i]));
    const entityMap = Object.fromEntries(allEntities.map((e) => [e.id, e]));

    const enriched = allShipments.map((s) => {
      const compliance = complianceMap[s.id];
      const risk = riskMap[s.id];
      const insurance = insuranceMap[s.id];
      return {
        id: s.id,
        reference: s.reference,
        status: s.status,
        commodity: s.commodity,
        hsCode: s.hsCode,
        portOfLoading: s.portOfLoading,
        portOfDischarge: s.portOfDischarge,
        vessel: s.vessel,
        voyage: s.voyage,
        grossWeight: s.grossWeight ? Number(s.grossWeight) : null,
        weightUnit: s.weightUnit,
        volume: s.volume ? Number(s.volume) : null,
        volumeUnit: s.volumeUnit,
        packageCount: s.packageCount,
        incoterms: s.incoterms,
        blNumber: s.blNumber,
        bookingNumber: s.bookingNumber,
        extractionConfidence: s.extractionConfidence,
        createdAt: s.createdAt,
        shipper: s.shipperId ? entityMap[s.shipperId] || null : null,
        consignee: s.consigneeId ? entityMap[s.consigneeId] || null : null,
        notifyParty: s.notifyPartyId ? entityMap[s.notifyPartyId] || null : null,
        carrier: s.carrierId ? entityMap[s.carrierId] || null : null,
        compliance: compliance ? {
          status: compliance.status,
          matchCount: compliance.matchCount,
          screenedParties: compliance.screenedParties,
          matches: compliance.matches,
          listsChecked: compliance.listsChecked,
          createdAt: compliance.createdAt,
        } : null,
        risk: risk ? {
          compositeScore: Number(risk.compositeScore),
          recommendedAction: risk.recommendedAction,
          subScores: risk.subScores,
          primaryRiskFactors: risk.primaryRiskFactors,
        } : null,
        insurance: insurance ? {
          coverageType: insurance.coverageType,
          estimatedInsuredValue: Number(insurance.estimatedInsuredValue),
          estimatedPremium: Number(insurance.estimatedPremium),
          currency: insurance.currency,
          coverageRationale: insurance.coverageRationale,
          exclusions: insurance.exclusions,
          confidenceScore: insurance.confidenceScore,
        } : null,
      };
    });

    const summary = {
      total: enriched.length,
      complianceClear: enriched.filter((s) => s.compliance?.status === "CLEAR").length,
      lowRisk: enriched.filter((s) => (s.risk?.compositeScore ?? 100) < 30).length,
      insured: enriched.filter((s) => s.insurance != null).length,
      avgRiskScore: enriched.filter((s) => s.risk).length > 0
        ? enriched.reduce((sum, s) => sum + (s.risk?.compositeScore || 0), 0) / enriched.filter((s) => s.risk).length
        : null,
    };

    res.json({ data: { shipments: enriched, summary } });
  } catch (err) {
    console.error("[demo-intelligence] error:", err);
    res.status(500).json({ error: "Failed to load intelligence data" });
  }
});

export default router;
