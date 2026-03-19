import { db } from "@workspace/db";
import {
  generatedDocumentsTable,
  shipmentsTable,
  entitiesTable,
  invoicesTable,
  invoiceLineItemsTable,
  eventsTable,
  type GeneratedDocType,
  DOC_TYPE_LABELS,
} from "@workspace/db/schema";
import { generateId } from "@workspace/shared-utils";
import { storeFile } from "@workspace/storage";
import { eq, and, desc, asc } from "drizzle-orm";
import { validateDocumentReadiness, validateAllDocuments, type DocContext, type ValidationResult } from "./validator.js";
import { generateCommercialInvoice } from "./generators/commercial-invoice.js";
import { generatePackingList } from "./generators/packing-list.js";
import { generateBillOfLading } from "./generators/bill-of-lading.js";
import { generateCustomsDeclaration } from "./generators/customs-declaration.js";
import { generateShipmentSummary } from "./generators/shipment-summary.js";

export { validateDocumentReadiness, validateAllDocuments, type DocContext, type ValidationResult } from "./validator.js";
export { DOC_TYPE_LABELS, type GeneratedDocType } from "@workspace/db/schema";

const GENERATORS: Record<GeneratedDocType, (ctx: DocContext) => string> = {
  COMMERCIAL_INVOICE: generateCommercialInvoice,
  PACKING_LIST: generatePackingList,
  BILL_OF_LADING: generateBillOfLading,
  CUSTOMS_DECLARATION: generateCustomsDeclaration,
  SHIPMENT_SUMMARY: generateShipmentSummary,
};

export async function buildDocContext(
  companyId: string,
  shipmentId: string,
): Promise<DocContext | null> {
  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(and(eq(shipmentsTable.id, shipmentId), eq(shipmentsTable.companyId, companyId)))
    .limit(1);

  if (!shipment) return null;

  const resolveEntity = async (id: string | null) => {
    if (!id) return null;
    const [entity] = await db.select().from(entitiesTable).where(eq(entitiesTable.id, id)).limit(1);
    return entity ? (entity as Record<string, any>) : null;
  };

  const shipper = await resolveEntity(shipment.shipperId);
  const consignee = await resolveEntity(shipment.consigneeId);
  const notifyParty = await resolveEntity(shipment.notifyPartyId);
  const carrier = await resolveEntity(shipment.carrierId);

  const invoices = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.shipmentId, shipmentId))
    .orderBy(desc(invoicesTable.createdAt))
    .limit(1);
  const invoice = invoices.length > 0 ? (invoices[0] as Record<string, any>) : null;

  let lineItems: Array<Record<string, any>> = [];
  if (invoice) {
    lineItems = await db
      .select()
      .from(invoiceLineItemsTable)
      .where(eq(invoiceLineItemsTable.invoiceId, invoice.id));
  }

  return {
    shipment: shipment as Record<string, any>,
    shipper,
    consignee,
    notifyParty,
    carrier,
    invoice,
    lineItems,
  };
}

export interface DocumentReadiness {
  documentType: GeneratedDocType;
  label: string;
  validation: ValidationResult;
  latestVersion: {
    id: string;
    versionNumber: number;
    generationStatus: string;
    createdAt: Date;
    createdBy: string | null;
  } | null;
  totalVersions: number;
}

export async function getDocumentReadiness(
  companyId: string,
  shipmentId: string,
): Promise<DocumentReadiness[]> {
  const ctx = await buildDocContext(companyId, shipmentId);
  if (!ctx) return [];

  const validations = validateAllDocuments(ctx);

  const existingDocs = await db
    .select()
    .from(generatedDocumentsTable)
    .where(
      and(
        eq(generatedDocumentsTable.shipmentId, shipmentId),
        eq(generatedDocumentsTable.companyId, companyId),
      ),
    )
    .orderBy(desc(generatedDocumentsTable.versionNumber));

  return validations.map((v) => {
    const docsForType = existingDocs.filter((d) => d.documentType === v.documentType);
    const latestActive = docsForType.find((d) => d.generationStatus !== "SUPERSEDED");

    return {
      documentType: v.documentType,
      label: DOC_TYPE_LABELS[v.documentType] || v.documentType,
      validation: v,
      latestVersion: latestActive
        ? {
            id: latestActive.id,
            versionNumber: latestActive.versionNumber,
            generationStatus: latestActive.generationStatus,
            createdAt: latestActive.createdAt,
            createdBy: latestActive.createdBy,
          }
        : null,
      totalVersions: docsForType.length,
    };
  });
}

export interface GenerateResult {
  success: boolean;
  documentId: string | null;
  versionNumber: number;
  error: string | null;
  validation: ValidationResult;
}

export async function generateDocument(
  companyId: string,
  shipmentId: string,
  docType: GeneratedDocType,
  userId?: string,
): Promise<GenerateResult> {
  const ctx = await buildDocContext(companyId, shipmentId);
  if (!ctx) {
    return {
      success: false,
      documentId: null,
      versionNumber: 0,
      error: "Shipment not found",
      validation: { ready: false, documentType: docType, requiredFields: [], missingFields: ["Shipment not found"], suggestions: [] },
    };
  }

  const validation = validateDocumentReadiness(docType, ctx);
  if (!validation.ready) {
    const eventId = generateId("evt");
    await db.insert(eventsTable).values({
      id: eventId,
      companyId,
      eventType: "DOCUMENT_GENERATION_BLOCKED",
      entityType: "SHIPMENT",
      entityId: shipmentId,
      actorType: "SYSTEM",
      serviceId: "doc-engine",
      metadata: { documentType: docType, missingFields: validation.missingFields },
    });

    return {
      success: false,
      documentId: null,
      versionNumber: 0,
      error: `Cannot generate ${DOC_TYPE_LABELS[docType]}: missing ${validation.missingFields.join(", ")}`,
      validation,
    };
  }

  const generator = GENERATORS[docType];
  const html = generator(ctx);

  const sourceSnapshot = {
    shipment: ctx.shipment,
    shipper: ctx.shipper ? { id: ctx.shipper.id, name: ctx.shipper.name } : null,
    consignee: ctx.consignee ? { id: ctx.consignee.id, name: ctx.consignee.name } : null,
    invoice: ctx.invoice ? { id: ctx.invoice.id, invoiceNumber: ctx.invoice.invoiceNumber } : null,
    generatedAt: new Date().toISOString(),
  };

  const existingVersions = await db
    .select({ versionNumber: generatedDocumentsTable.versionNumber, id: generatedDocumentsTable.id, generationStatus: generatedDocumentsTable.generationStatus })
    .from(generatedDocumentsTable)
    .where(
      and(
        eq(generatedDocumentsTable.shipmentId, shipmentId),
        eq(generatedDocumentsTable.companyId, companyId),
        eq(generatedDocumentsTable.documentType, docType),
      ),
    )
    .orderBy(desc(generatedDocumentsTable.versionNumber));

  const nextVersion = existingVersions.length > 0 ? existingVersions[0].versionNumber + 1 : 1;

  for (const prev of existingVersions) {
    if (prev.generationStatus !== "SUPERSEDED") {
      await db
        .update(generatedDocumentsTable)
        .set({ generationStatus: "SUPERSEDED" as any })
        .where(eq(generatedDocumentsTable.id, prev.id));
    }
  }

  let storageKey: string | null = null;
  try {
    const buf = Buffer.from(html, "utf-8");
    const fileName = `${docType.toLowerCase()}_v${nextVersion}_${shipmentId}.html`;
    const result = await storeFile(buf, fileName, "generated");
    storageKey = result.key;
  } catch (err: any) {
    console.warn("[doc-engine] Storage failed, keeping HTML in DB only:", err.message);
  }

  const docId = generateId("gdoc");

  await db.insert(generatedDocumentsTable).values({
    id: docId,
    companyId,
    shipmentId,
    invoiceId: ctx.invoice?.id || null,
    documentType: docType,
    versionNumber: nextVersion,
    generationStatus: "GENERATED",
    sourceSnapshot,
    validationSnapshot: validation,
    htmlContent: html,
    storageKey,
    createdBy: userId || null,
  });

  if (existingVersions.length > 0) {
    await db
      .update(generatedDocumentsTable)
      .set({ supersededBy: docId })
      .where(
        and(
          eq(generatedDocumentsTable.id, existingVersions[0].id),
        ),
      );
  }

  const eventId = generateId("evt");
  await db.insert(eventsTable).values({
    id: eventId,
    companyId,
    eventType: nextVersion > 1 ? "DOCUMENT_REGENERATED" : "DOCUMENT_GENERATED",
    entityType: "SHIPMENT",
    entityId: shipmentId,
    actorType: userId ? "USER" : "SYSTEM",
    userId: userId || undefined,
    serviceId: "doc-engine",
    metadata: {
      documentType: docType,
      documentId: docId,
      versionNumber: nextVersion,
      label: DOC_TYPE_LABELS[docType],
    },
  });

  return {
    success: true,
    documentId: docId,
    versionNumber: nextVersion,
    error: null,
    validation,
  };
}

export async function getGeneratedDocument(
  companyId: string,
  documentId: string,
  shipmentId?: string,
) {
  const conditions = [
    eq(generatedDocumentsTable.id, documentId),
    eq(generatedDocumentsTable.companyId, companyId),
  ];
  if (shipmentId) {
    conditions.push(eq(generatedDocumentsTable.shipmentId, shipmentId));
  }
  const [doc] = await db
    .select()
    .from(generatedDocumentsTable)
    .where(and(...conditions))
    .limit(1);

  return doc || null;
}

export async function getDocumentVersions(
  companyId: string,
  shipmentId: string,
  docType: GeneratedDocType,
) {
  return db
    .select()
    .from(generatedDocumentsTable)
    .where(
      and(
        eq(generatedDocumentsTable.shipmentId, shipmentId),
        eq(generatedDocumentsTable.companyId, companyId),
        eq(generatedDocumentsTable.documentType, docType),
      ),
    )
    .orderBy(desc(generatedDocumentsTable.versionNumber));
}

export async function listGeneratedDocuments(
  companyId: string,
  shipmentId: string,
) {
  return db
    .select()
    .from(generatedDocumentsTable)
    .where(
      and(
        eq(generatedDocumentsTable.shipmentId, shipmentId),
        eq(generatedDocumentsTable.companyId, companyId),
      ),
    )
    .orderBy(asc(generatedDocumentsTable.documentType), desc(generatedDocumentsTable.versionNumber));
}
