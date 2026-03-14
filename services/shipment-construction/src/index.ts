import { db } from "@workspace/db";
import {
  shipmentsTable,
  shipmentDocumentsTable,
  ingestedDocumentsTable,
  eventsTable,
} from "@workspace/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import type { ExtractionOutput } from "@workspace/shared-schemas";
import { resolveParties, type PartyInput } from "@workspace/svc-entity-resolution";
import { publishM4Jobs } from "@workspace/queue";
import { buildShipmentDraft, type ShipmentDraft } from "./builder.js";
import { validateShipmentDraft } from "./validator.js";

export { buildShipmentDraft } from "./builder.js";
export { validateShipmentDraft } from "./validator.js";

export interface PipelineResult {
  shipmentId: string | null;
  reference: string | null;
  entitiesCreated: number;
  entitiesMatched: number;
  conflictCount: number;
  warnings: string[];
  success: boolean;
  error: string | null;
}

export async function runShipmentPipeline(
  documentIds: string[],
  companyId: string,
): Promise<PipelineResult> {
  console.log(`[pipeline] starting for ${documentIds.length} documents`);

  const documents = await db
    .select()
    .from(ingestedDocumentsTable)
    .where(
      and(
        inArray(ingestedDocumentsTable.id, documentIds),
        eq(ingestedDocumentsTable.companyId, companyId),
      ),
    );

  if (documents.length !== documentIds.length) {
    const found = new Set(documents.map((d) => d.id));
    const missing = documentIds.filter((id) => !found.has(id));
    console.log(`[pipeline] company scope mismatch: ${missing.length} docs filtered out`);
  }

  const extractedDocs = documents.filter(
    (d) => d.extractionStatus === "EXTRACTED" && d.extractedData,
  );

  if (extractedDocs.length === 0) {
    console.log("[pipeline] no extracted documents to process");
    return {
      shipmentId: null,
      reference: null,
      entitiesCreated: 0,
      entitiesMatched: 0,
      conflictCount: 0,
      warnings: ["No extracted documents available"],
      success: false,
      error: "No extracted documents to build shipment from",
    };
  }

  const alreadyLinked = await db
    .select({ documentId: shipmentDocumentsTable.documentId })
    .from(shipmentDocumentsTable)
    .where(inArray(shipmentDocumentsTable.documentId, extractedDocs.map((d) => d.id)));

  if (alreadyLinked.length > 0) {
    const linked = new Set(alreadyLinked.map((r) => r.documentId));
    const dedupDocs = extractedDocs.filter((d) => !linked.has(d.id));
    if (dedupDocs.length === 0) {
      console.log("[pipeline] all documents already linked to shipments, skipping (idempotency)");
      return {
        shipmentId: null,
        reference: null,
        entitiesCreated: 0,
        entitiesMatched: 0,
        conflictCount: 0,
        warnings: ["Documents already processed"],
        success: true,
        error: null,
      };
    }
    console.log(`[pipeline] ${alreadyLinked.length} docs already linked, continuing with ${dedupDocs.length} new`);
  }

  const extractedDataList = extractedDocs.map(
    (d) => d.extractedData as ExtractionOutput,
  );

  const partyInputs: PartyInput[] = [];
  const seenTypes = new Set<string>();

  for (const data of extractedDataList) {
    if (data.shipper?.value && !seenTypes.has("SHIPPER")) {
      partyInputs.push({ rawName: String(data.shipper.value), entityType: "SHIPPER" });
      seenTypes.add("SHIPPER");
    }
    if (data.consignee?.value && !seenTypes.has("CONSIGNEE")) {
      partyInputs.push({ rawName: String(data.consignee.value), entityType: "CONSIGNEE" });
      seenTypes.add("CONSIGNEE");
    }
    if (data.notifyParty?.value && !seenTypes.has("NOTIFY_PARTY")) {
      partyInputs.push({ rawName: String(data.notifyParty.value), entityType: "NOTIFY_PARTY" });
      seenTypes.add("NOTIFY_PARTY");
    }
  }

  const entityResult = await resolveParties(partyInputs, companyId);

  console.log(
    `[pipeline] entities resolved: ${entityResult.matchedEntities} matched, ${entityResult.newEntitiesCreated} created`,
  );

  const draft: ShipmentDraft = buildShipmentDraft({
    documentIds,
    extractedDataList,
    resolvedParties: entityResult.parties,
    companyId,
  });

  const validation = validateShipmentDraft(draft);

  if (!validation.valid) {
    console.log(`[pipeline] draft validation failed: ${validation.errors.join("; ")}`);
    return {
      shipmentId: null,
      reference: draft.reference,
      entitiesCreated: entityResult.newEntitiesCreated,
      entitiesMatched: entityResult.matchedEntities,
      conflictCount: draft.conflicts.length,
      warnings: validation.warnings,
      success: false,
      error: `Validation failed: ${validation.errors.join("; ")}`,
    };
  }

  const shipmentId = generateId();

  await db.insert(shipmentsTable).values({
    id: shipmentId,
    companyId: draft.companyId,
    reference: draft.reference,
    status: "DRAFT",
    shipperId: draft.shipperId,
    consigneeId: draft.consigneeId,
    notifyPartyId: draft.notifyPartyId,
    carrierId: draft.carrierId,
    portOfLoading: draft.portOfLoading,
    portOfDischarge: draft.portOfDischarge,
    vessel: draft.vessel,
    voyage: draft.voyage,
    commodity: draft.commodity,
    hsCode: draft.hsCode,
    packageCount: draft.packageCount,
    grossWeight: draft.grossWeight,
    weightUnit: draft.weightUnit as "KG" | "LB" | null,
    volume: draft.volume,
    volumeUnit: draft.volumeUnit as "CBM" | "CFT" | null,
    incoterms: draft.incoterms,
    bookingNumber: draft.bookingNumber,
    blNumber: draft.blNumber,
  });

  for (const doc of extractedDocs) {
    await db.insert(shipmentDocumentsTable).values({
      id: generateId(),
      companyId,
      shipmentId,
      documentId: doc.id,
      documentType: doc.documentType as typeof shipmentDocumentsTable.$inferInsert.documentType,
      s3Key: doc.s3Key,
    });
  }

  await db.insert(eventsTable).values({
    id: generateId(),
    companyId,
    eventType: "SHIPMENT_CREATED",
    entityType: "shipment",
    entityId: shipmentId,
    metadata: {
      reference: draft.reference,
      documentCount: extractedDocs.length,
      entitiesCreated: entityResult.newEntitiesCreated,
      entitiesMatched: entityResult.matchedEntities,
      conflictCount: draft.conflicts.length,
      conflicts: draft.conflicts,
      warnings: validation.warnings,
      shipperId: draft.shipperId,
      consigneeId: draft.consigneeId,
    },
  });

  if (draft.conflicts.length > 0) {
    await db.insert(eventsTable).values({
      id: generateId(),
      companyId,
      eventType: "DOCUMENT_CONFLICT",
      entityType: "shipment",
      entityId: shipmentId,
      metadata: { conflicts: draft.conflicts },
    });
  }

  console.log(
    `[pipeline] shipment created id=${shipmentId} ref=${draft.reference} conflicts=${draft.conflicts.length}`,
  );

  publishM4Jobs(companyId, shipmentId);
  console.log(`[pipeline] M4 jobs dispatched (compliance, risk, insurance) for shipment=${shipmentId}`);

  return {
    shipmentId,
    reference: draft.reference,
    entitiesCreated: entityResult.newEntitiesCreated,
    entitiesMatched: entityResult.matchedEntities,
    conflictCount: draft.conflicts.length,
    warnings: validation.warnings,
    success: true,
    error: null,
  };
}
