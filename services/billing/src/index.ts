import { db } from "@workspace/db";
import {
  shipmentsTable,
  shipmentChargesTable,
  invoicesTable,
  entitiesTable,
  eventsTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import { storeFile } from "@workspace/storage";
import { publishExceptionJob, publishTradeLaneJob } from "@workspace/queue";

export interface BillingResult {
  invoiceId: string | null;
  invoiceNumber: string | null;
  grandTotal: number;
  success: boolean;
  error: string | null;
}

function generateInvoiceNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const seq = Math.floor(Math.random() * 9000) + 1000;
  return `INV-${y}${m}${d}-${seq}`;
}

function formatCurrency(amount: number, currency = "USD"): string {
  return `${currency} ${amount.toFixed(2)}`;
}

function generateInvoiceContent(
  invoiceNumber: string,
  shipment: Record<string, unknown>,
  billTo: Record<string, unknown> | null,
  lineItems: Array<Record<string, unknown>>,
  subtotal: number,
  taxTotal: number,
  grandTotal: number,
): string {
  const lines = [
    "═══════════════════════════════════════════════════",
    "                    INVOICE",
    "═══════════════════════════════════════════════════",
    "",
    `Invoice Number: ${invoiceNumber}`,
    `Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    `Shipment Reference: ${shipment.reference}`,
    `B/L Number: ${shipment.blNumber || "N/A"}`,
    "",
    "── BILL TO ─────────────────────────────────────────",
    `  ${billTo?.name || "N/A"}`,
    `  ${billTo?.address || ""}`,
    `  ${[billTo?.city, billTo?.country].filter(Boolean).join(", ") || ""}`,
    "",
    "── SHIPMENT DETAILS ────────────────────────────────",
    `  ${shipment.portOfLoading || "?"} → ${shipment.portOfDischarge || "?"}`,
    `  Vessel: ${shipment.vessel || "TBD"} / ${shipment.voyage || "TBD"}`,
    `  Commodity: ${shipment.commodity || "N/A"}`,
    `  Weight: ${shipment.grossWeight || "?"} ${shipment.weightUnit || "KG"}`,
    "",
    "── CHARGES ─────────────────────────────────────────",
    "",
    `  ${"Code".padEnd(10)} ${"Description".padEnd(30)} ${"Qty".padEnd(6)} ${"Unit Price".padEnd(14)} ${"Total".padEnd(14)}`,
    `  ${"─".repeat(10)} ${"─".repeat(30)} ${"─".repeat(6)} ${"─".repeat(14)} ${"─".repeat(14)}`,
  ];

  for (const item of lineItems) {
    lines.push(
      `  ${String(item.chargeCode).padEnd(10)} ${String(item.description).padEnd(30)} ${String(item.quantity).padEnd(6)} ${formatCurrency(item.unitPrice as number).padEnd(14)} ${formatCurrency(item.totalAmount as number)}`,
    );
  }

  lines.push("");
  lines.push(`  ${"".padEnd(56)} ${"Subtotal:".padEnd(14)} ${formatCurrency(subtotal)}`);
  if (taxTotal > 0) {
    lines.push(`  ${"".padEnd(56)} ${"Tax:".padEnd(14)} ${formatCurrency(taxTotal)}`);
  }
  lines.push(`  ${"".padEnd(56)} ${"TOTAL:".padEnd(14)} ${formatCurrency(grandTotal)}`);
  lines.push("");
  lines.push("── PAYMENT TERMS ───────────────────────────────────");
  lines.push("  Net 30 days from invoice date");
  lines.push("");
  lines.push("═══════════════════════════════════════════════════");

  return lines.join("\n");
}

export async function runBilling(
  shipmentId: string,
  companyId: string,
): Promise<BillingResult> {
  console.log(`[billing] starting invoicing for shipment=${shipmentId}`);

  const existingInvoice = await db
    .select({ id: invoicesTable.id, invoiceNumber: invoicesTable.invoiceNumber })
    .from(invoicesTable)
    .where(eq(invoicesTable.shipmentId, shipmentId))
    .limit(1);

  if (existingInvoice.length > 0) {
    console.log(`[billing] invoice already exists for shipment=${shipmentId}, dispatching M7 jobs`);
    publishExceptionJob({ companyId, shipmentId, trigger: "invoice_created" });
    publishTradeLaneJob({ companyId, shipmentId, trigger: "invoice_created" });
    return {
      invoiceId: existingInvoice[0]!.id,
      invoiceNumber: existingInvoice[0]!.invoiceNumber,
      grandTotal: 0,
      success: true,
      error: null,
    };
  }

  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(eq(shipmentsTable.id, shipmentId))
    .limit(1);

  if (!shipment || shipment.companyId !== companyId) {
    return { invoiceId: null, invoiceNumber: null, grandTotal: 0, success: false, error: "Shipment not found" };
  }

  const charges = await db
    .select()
    .from(shipmentChargesTable)
    .where(eq(shipmentChargesTable.shipmentId, shipmentId));

  if (charges.length === 0) {
    return { invoiceId: null, invoiceNumber: null, grandTotal: 0, success: false, error: "No charges found" };
  }

  const billTo = shipment.consigneeId
    ? (await db.select().from(entitiesTable).where(eq(entitiesTable.id, shipment.consigneeId)).limit(1))[0]
    : null;

  const lineItems = charges.map((c) => ({
    chargeCode: c.chargeCode,
    description: c.description,
    chargeType: c.chargeType,
    quantity: c.quantity,
    unitPrice: c.unitPrice,
    currency: c.currency,
    totalAmount: c.totalAmount,
  }));

  const subtotal = charges.reduce((sum, c) => sum + c.totalAmount, 0);
  const taxTotal = charges.reduce((sum, c) => sum + (c.taxAmount || 0), 0);
  const grandTotal = subtotal + taxTotal;

  const invoiceNumber = generateInvoiceNumber();

  const invoiceContent = generateInvoiceContent(
    invoiceNumber,
    shipment as unknown as Record<string, unknown>,
    billTo as Record<string, unknown> | null,
    lineItems as Array<Record<string, unknown>>,
    subtotal,
    taxTotal,
    grandTotal,
  );

  const buffer = Buffer.from(invoiceContent, "utf-8");
  const { key: pdfKey } = await storeFile(
    buffer,
    `INVOICE_${invoiceNumber}.txt`,
    "invoices",
  );

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  const invoiceId = generateId();
  await db.insert(invoicesTable).values({
    id: invoiceId,
    companyId,
    shipmentId,
    invoiceNumber,
    status: "ISSUED",
    billToEntityId: billTo?.id || null,
    subtotal,
    taxTotal,
    grandTotal,
    currency: "USD",
    lineItems,
    dueDate,
    issuedAt: new Date(),
    pdfStorageKey: pdfKey,
    metadata: null,
  });

  await db.insert(eventsTable).values({
    actorType: "SERVICE",
    id: generateId(),
    companyId,
    eventType: "INVOICE_CREATED" as string,
    entityType: "shipment",
    entityId: shipmentId,
    serviceId: "billing",
    metadata: {
      invoiceId,
      invoiceNumber,
      grandTotal,
      currency: "USD",
      lineItemCount: lineItems.length,
    },
  });

  publishExceptionJob({ companyId, shipmentId, trigger: "invoice_created" });
  publishTradeLaneJob({ companyId, shipmentId, trigger: "invoice_created" });

  console.log(
    `[billing] complete: shipment=${shipmentId} invoice=${invoiceNumber} total=$${grandTotal.toFixed(2)} → dispatched exception+trade-lane jobs`,
  );

  return {
    invoiceId,
    invoiceNumber,
    grandTotal,
    success: true,
    error: null,
  };
}
