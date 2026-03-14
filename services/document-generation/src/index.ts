import { db } from "@workspace/db";
import {
  shipmentsTable,
  shipmentDocumentsTable,
  ingestedDocumentsTable,
  shipmentChargesTable,
  entitiesTable,
  eventsTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import { publishBillingJob } from "@workspace/queue";
import { storeFile } from "@workspace/storage";

export interface DocGenResult {
  documentsGenerated: number;
  documentTypes: string[];
  success: boolean;
  error: string | null;
}

interface ShipmentContext {
  shipment: Record<string, unknown>;
  shipper: Record<string, unknown> | null;
  consignee: Record<string, unknown> | null;
  notifyParty: Record<string, unknown> | null;
  carrier: Record<string, unknown> | null;
  charges: Array<Record<string, unknown>>;
}

async function buildContext(shipmentId: string, companyId: string): Promise<ShipmentContext | null> {
  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(eq(shipmentsTable.id, shipmentId))
    .limit(1);

  if (!shipment || shipment.companyId !== companyId) return null;

  const resolveEntity = async (id: string | null) => {
    if (!id) return null;
    const [entity] = await db.select().from(entitiesTable).where(eq(entitiesTable.id, id)).limit(1);
    return entity ? (entity as Record<string, unknown>) : null;
  };

  const charges = await db
    .select()
    .from(shipmentChargesTable)
    .where(eq(shipmentChargesTable.shipmentId, shipmentId));

  return {
    shipment: shipment as Record<string, unknown>,
    shipper: await resolveEntity(shipment.shipperId),
    consignee: await resolveEntity(shipment.consigneeId),
    notifyParty: await resolveEntity(shipment.notifyPartyId),
    carrier: await resolveEntity(shipment.carrierId),
    charges: charges as Array<Record<string, unknown>>,
  };
}

function formatDate(d: Date | string | null): string {
  if (!d) return "N/A";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatCurrency(amount: number, currency = "USD"): string {
  return `${currency} ${amount.toFixed(2)}`;
}

function generateHBLContent(ctx: ShipmentContext): string {
  const s = ctx.shipment;
  const lines = [
    "═══════════════════════════════════════════════════",
    "              HOUSE BILL OF LADING",
    "═══════════════════════════════════════════════════",
    "",
    `B/L Number: ${s.blNumber || "TBD"}`,
    `Booking Number: ${s.bookingNumber || "TBD"}`,
    `Reference: ${s.reference}`,
    `Date: ${formatDate(new Date())}`,
    "",
    "── SHIPPER ─────────────────────────────────────────",
    `  ${ctx.shipper?.name || "N/A"}`,
    `  ${ctx.shipper?.address || ""}`,
    `  ${[ctx.shipper?.city, ctx.shipper?.country].filter(Boolean).join(", ") || ""}`,
    "",
    "── CONSIGNEE ───────────────────────────────────────",
    `  ${ctx.consignee?.name || "N/A"}`,
    `  ${ctx.consignee?.address || ""}`,
    `  ${[ctx.consignee?.city, ctx.consignee?.country].filter(Boolean).join(", ") || ""}`,
    "",
    "── NOTIFY PARTY ────────────────────────────────────",
    `  ${ctx.notifyParty?.name || "Same as Consignee"}`,
    "",
    "── VESSEL / VOYAGE ─────────────────────────────────",
    `  Vessel: ${s.vessel || "TBD"}`,
    `  Voyage: ${s.voyage || "TBD"}`,
    `  Port of Loading: ${s.portOfLoading || "TBD"}`,
    `  Port of Discharge: ${s.portOfDischarge || "TBD"}`,
    "",
    "── CARGO DETAILS ───────────────────────────────────",
    `  Commodity: ${s.commodity || "N/A"}`,
    `  HS Code: ${s.hsCode || "N/A"}`,
    `  Packages: ${s.packageCount || "N/A"}`,
    `  Gross Weight: ${s.grossWeight || "N/A"} ${s.weightUnit || "KG"}`,
    `  Volume: ${s.volume || "N/A"} ${s.volumeUnit || "CBM"}`,
    `  Incoterms: ${s.incoterms || "N/A"}`,
    "",
    "── FREIGHT TERMS ───────────────────────────────────",
    `  ${s.freightTerms || "PREPAID"}`,
    "",
    "═══════════════════════════════════════════════════",
    "  This is a non-negotiable House Bill of Lading",
    "  issued by the freight forwarder.",
    "═══════════════════════════════════════════════════",
  ];

  return lines.join("\n");
}

function generateArrivalNoticeContent(ctx: ShipmentContext): string {
  const s = ctx.shipment;
  const lines = [
    "═══════════════════════════════════════════════════",
    "              ARRIVAL NOTICE",
    "═══════════════════════════════════════════════════",
    "",
    `Reference: ${s.reference}`,
    `B/L Number: ${s.blNumber || "TBD"}`,
    `Date: ${formatDate(new Date())}`,
    "",
    "── NOTIFY ──────────────────────────────────────────",
    `  ${ctx.consignee?.name || "N/A"}`,
    `  ${ctx.consignee?.address || ""}`,
    "",
    "── SHIPMENT INFORMATION ────────────────────────────",
    `  Vessel: ${s.vessel || "TBD"}`,
    `  Voyage: ${s.voyage || "TBD"}`,
    `  Port of Loading: ${s.portOfLoading || "TBD"}`,
    `  Port of Discharge: ${s.portOfDischarge || "TBD"}`,
    `  ETA: ${formatDate(s.eta as string | null)}`,
    "",
    "── CARGO ───────────────────────────────────────────",
    `  Commodity: ${s.commodity || "N/A"}`,
    `  Packages: ${s.packageCount || "N/A"}`,
    `  Gross Weight: ${s.grossWeight || "N/A"} ${s.weightUnit || "KG"}`,
    `  Volume: ${s.volume || "N/A"} ${s.volumeUnit || "CBM"}`,
    "",
    "── CHARGES ─────────────────────────────────────────",
  ];

  let totalCharges = 0;
  for (const charge of ctx.charges) {
    const amount = charge.totalAmount as number;
    totalCharges += amount;
    lines.push(
      `  ${charge.chargeCode}: ${charge.description} — ${formatCurrency(amount, charge.currency as string)}`,
    );
  }
  lines.push("");
  lines.push(`  TOTAL: ${formatCurrency(totalCharges, "USD")}`);
  lines.push("");
  lines.push("═══════════════════════════════════════════════════");
  lines.push("  Please arrange customs clearance and pickup.");
  lines.push("═══════════════════════════════════════════════════");

  return lines.join("\n");
}

function generateShipmentSummaryContent(ctx: ShipmentContext): string {
  const s = ctx.shipment;
  const lines = [
    "═══════════════════════════════════════════════════",
    "              SHIPMENT SUMMARY",
    "═══════════════════════════════════════════════════",
    "",
    `Reference: ${s.reference}`,
    `Status: ${s.status}`,
    `B/L Number: ${s.blNumber || "N/A"}`,
    `Booking Number: ${s.bookingNumber || "N/A"}`,
    `Approved: ${formatDate(s.approvedAt as string | null)}`,
    `Approved By: ${s.approvedBy || "N/A"}`,
    "",
    "── PARTIES ─────────────────────────────────────────",
    `  Shipper: ${ctx.shipper?.name || "N/A"}`,
    `  Consignee: ${ctx.consignee?.name || "N/A"}`,
    `  Notify: ${ctx.notifyParty?.name || "N/A"}`,
    `  Carrier: ${ctx.carrier?.name || "N/A"}`,
    "",
    "── ROUTING ─────────────────────────────────────────",
    `  ${s.portOfLoading || "?"} → ${s.portOfDischarge || "?"}`,
    `  Vessel: ${s.vessel || "TBD"} / ${s.voyage || "TBD"}`,
    "",
    "── CARGO ───────────────────────────────────────────",
    `  ${s.commodity || "N/A"}`,
    `  HS Code: ${s.hsCode || "N/A"}`,
    `  ${s.packageCount || "?"} packages, ${s.grossWeight || "?"} ${s.weightUnit || "KG"}, ${s.volume || "?"} ${s.volumeUnit || "CBM"}`,
    "",
    "── CHARGES BREAKDOWN ───────────────────────────────",
  ];

  let totalCharges = 0;
  for (const charge of ctx.charges) {
    const amount = charge.totalAmount as number;
    totalCharges += amount;
    lines.push(
      `  ${String(charge.chargeCode).padEnd(8)} ${String(charge.description).padEnd(35)} ${formatCurrency(amount, charge.currency as string)}`,
    );
  }
  lines.push(`  ${"".padEnd(8)} ${"TOTAL".padEnd(35)} ${formatCurrency(totalCharges, "USD")}`);
  lines.push("");
  lines.push("═══════════════════════════════════════════════════");

  return lines.join("\n");
}

async function storeAndLink(
  companyId: string,
  shipmentId: string,
  docType: string,
  fileName: string,
  content: string,
): Promise<string> {
  const buffer = Buffer.from(content, "utf-8");
  const { key } = await storeFile(buffer, fileName, "generated-docs");

  const docId = generateId();
  await db.insert(ingestedDocumentsTable).values({
    id: docId,
    companyId,
    fileName,
    mimeType: "text/plain",
    s3Key: key,
    documentType: docType,
    extractionStatus: "EXTRACTED",
    extractedData: { generatedDocument: true, type: docType },
    createdAt: new Date(),
  });

  const linkId = generateId();
  await db.insert(shipmentDocumentsTable).values({
    id: linkId,
    companyId,
    shipmentId,
    documentId: docId,
    documentType: docType as "HBL" | "ARRIVAL_NOTICE" | "SHIPMENT_SUMMARY" | "INVOICE",
    isGenerated: true,
    generatedAt: new Date(),
  });

  return docId;
}

export async function runDocumentGeneration(
  shipmentId: string,
  companyId: string,
): Promise<DocGenResult> {
  console.log(`[docgen] starting document generation for shipment=${shipmentId}`);

  const existingLinks = await db
    .select()
    .from(shipmentDocumentsTable)
    .where(eq(shipmentDocumentsTable.shipmentId, shipmentId));

  const existingDocs = await Promise.all(
    existingLinks.map(async (link) => {
      const [doc] = await db
        .select()
        .from(ingestedDocumentsTable)
        .where(eq(ingestedDocumentsTable.id, link.documentId))
        .limit(1);
      return doc;
    }),
  );

  const hasGenerated = existingDocs.some(
    (d) => d && (d.extractedData as Record<string, unknown>)?.generatedDocument === true,
  );

  if (hasGenerated) {
    console.log(`[docgen] generated documents already exist for shipment=${shipmentId}, skipping but dispatching billing`);
    publishBillingJob({ companyId, shipmentId, trigger: "documents_generated" });
    return { documentsGenerated: 0, documentTypes: [], success: true, error: null };
  }

  const ctx = await buildContext(shipmentId, companyId);
  if (!ctx) {
    return { documentsGenerated: 0, documentTypes: [], success: false, error: "Shipment not found" };
  }

  const ref = (ctx.shipment.reference as string) || shipmentId;
  const docTypes: string[] = [];

  const hblContent = generateHBLContent(ctx);
  await storeAndLink(companyId, shipmentId, "HBL", `HBL_${ref}.txt`, hblContent);
  docTypes.push("HBL");

  const arrivalContent = generateArrivalNoticeContent(ctx);
  await storeAndLink(companyId, shipmentId, "ARRIVAL_NOTICE", `AN_${ref}.txt`, arrivalContent);
  docTypes.push("ARRIVAL_NOTICE");

  const summaryContent = generateShipmentSummaryContent(ctx);
  await storeAndLink(companyId, shipmentId, "SHIPMENT_SUMMARY", `SUMMARY_${ref}.txt`, summaryContent);
  docTypes.push("SHIPMENT_SUMMARY");

  await db.insert(eventsTable).values({
    actorType: "SERVICE",
    id: generateId(),
    companyId,
    eventType: "DOCUMENT_GENERATED" as string,
    entityType: "shipment",
    entityId: shipmentId,
    serviceId: "document-generation",
    metadata: {
      documentsGenerated: docTypes.length,
      documentTypes: docTypes,
    },
  });

  publishBillingJob({ companyId, shipmentId, trigger: "documents_generated" });

  console.log(`[docgen] complete: shipment=${shipmentId} docs=${docTypes.length} types=${docTypes.join(",")}`);

  return {
    documentsGenerated: docTypes.length,
    documentTypes: docTypes,
    success: true,
    error: null,
  };
}
