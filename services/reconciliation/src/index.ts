import { db } from "@workspace/db";
import {
  carrierInvoicesTable,
  reconciliationResultsTable,
  eventsTable,
  shipmentChargesTable,
} from "@workspace/db/schema";
import type { CarrierLineItem } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import { matchCarrierInvoiceToShipment } from "./matcher.js";
import { reconcile, type ReconciliationOutput } from "./reconciler.js";

export type { CarrierLineItem };
export { matchCarrierInvoiceToShipment } from "./matcher.js";
export { reconcile } from "./reconciler.js";

export interface IngestCarrierInvoiceInput {
  companyId: string;
  shipmentId?: string;
  shipmentReference?: string;
  carrierName: string;
  invoiceNumber: string;
  invoiceDate: Date;
  totalAmount: number;
  currency?: string;
  lineItems: CarrierLineItem[];
  rawPayload?: unknown;
  userId?: string;
}

export interface IngestResult {
  carrierInvoiceId: string;
  shipmentId: string | null;
  matchConfidence: number;
  matchMethod: string;
  reconciliation: ReconciliationOutput | null;
}

export async function ingestCarrierInvoice(
  input: IngestCarrierInvoiceInput,
): Promise<IngestResult> {
  let shipmentId = input.shipmentId || null;
  let matchConfidence = shipmentId ? 1.0 : 0;
  let matchMethod: "EXACT" | "FUZZY" | "MANUAL" | "UNMATCHED" = shipmentId
    ? "MANUAL"
    : "UNMATCHED";

  if (!shipmentId && input.shipmentReference) {
    const match = await matchCarrierInvoiceToShipment(
      input.companyId,
      input.shipmentReference,
      input.carrierName,
    );
    if (match.shipmentId) {
      shipmentId = match.shipmentId;
      matchConfidence = match.confidence;
      matchMethod = match.method;
    }
  }

  const carrierInvoiceId = generateId("cinv");

  await db.insert(carrierInvoicesTable).values({
    id: carrierInvoiceId,
    companyId: input.companyId,
    shipmentId,
    carrierName: input.carrierName,
    invoiceNumber: input.invoiceNumber,
    invoiceDate: input.invoiceDate,
    totalAmount: input.totalAmount.toFixed(2),
    currency: input.currency || "USD",
    lineItems: input.lineItems,
    rawPayload: input.rawPayload || null,
    shipmentReference: input.shipmentReference || null,
    matchConfidence,
    matchMethod,
    requiresAttention: !shipmentId ? "true" : "false",
  });

  let reconciliation: ReconciliationOutput | null = null;

  if (shipmentId) {
    reconciliation = await performReconciliation(
      input.companyId,
      shipmentId,
      carrierInvoiceId,
      input.lineItems,
      input.totalAmount,
      input.userId,
    );
  }

  return {
    carrierInvoiceId,
    shipmentId,
    matchConfidence,
    matchMethod,
    reconciliation,
  };
}

export async function performReconciliation(
  companyId: string,
  shipmentId: string,
  carrierInvoiceId: string,
  carrierLineItems: CarrierLineItem[],
  carrierTotal: number,
  userId?: string,
): Promise<ReconciliationOutput> {
  const result = await reconcile({
    companyId,
    shipmentId,
    carrierLineItems,
    carrierTotal,
  });

  const reconId = generateId("recon");

  await db.insert(reconciliationResultsTable).values({
    id: reconId,
    companyId,
    shipmentId,
    carrierInvoiceId,
    expectedAmount: result.expectedAmount.toFixed(2),
    actualAmount: result.actualAmount.toFixed(2),
    varianceAmount: result.varianceAmount.toFixed(2),
    variancePercentage: result.variancePercentage,
    reconciliationStatus: result.reconciliationStatus,
    discrepancyDetails: result.discrepancyDetails,
    reconciledBy: userId || null,
  });

  await db.insert(eventsTable).values({
    id: generateId("evt"),
    companyId,
    entityType: "SHIPMENT",
    entityId: shipmentId,
    eventType: "RECONCILIATION_COMPLETED",
    actorType: "SERVICE",
    serviceId: "svc-reconciliation",
    metadata: {
      carrierInvoiceId,
      reconciliationId: reconId,
      status: result.reconciliationStatus,
      expectedAmount: result.expectedAmount,
      actualAmount: result.actualAmount,
      variancePercentage: result.variancePercentage,
    },
  });

  if (
    result.reconciliationStatus === "MINOR_VARIANCE" ||
    result.reconciliationStatus === "MAJOR_VARIANCE"
  ) {
    await db.insert(eventsTable).values({
      id: generateId("evt"),
      companyId,
      entityType: "SHIPMENT",
      entityId: shipmentId,
      eventType: "VARIANCE_DETECTED",
      actorType: "SERVICE",
      serviceId: "svc-reconciliation",
      metadata: {
        carrierInvoiceId,
        varianceAmount: result.varianceAmount,
        variancePercentage: result.variancePercentage,
        status: result.reconciliationStatus,
      },
    });
  }

  if (result.reconciliationStatus === "MAJOR_VARIANCE") {
    await db.insert(eventsTable).values({
      id: generateId("evt"),
      companyId,
      entityType: "SHIPMENT",
      entityId: shipmentId,
      eventType: "MAJOR_DISCREPANCY_FLAGGED",
      actorType: "SERVICE",
      serviceId: "svc-reconciliation",
      metadata: {
        carrierInvoiceId,
        varianceAmount: result.varianceAmount,
        variancePercentage: result.variancePercentage,
        summary: result.discrepancyDetails.summary,
      },
    });

    await db
      .update(carrierInvoicesTable)
      .set({ requiresAttention: "true" })
      .where(eq(carrierInvoicesTable.id, carrierInvoiceId));
  }

  return result;
}

export async function getReconciliationForShipment(
  companyId: string,
  shipmentId: string,
) {
  const results = await db
    .select()
    .from(reconciliationResultsTable)
    .where(
      and(
        eq(reconciliationResultsTable.companyId, companyId),
        eq(reconciliationResultsTable.shipmentId, shipmentId),
      ),
    )
    .orderBy(desc(reconciliationResultsTable.createdAt));

  return results;
}

export async function getCarrierInvoicesForShipment(
  companyId: string,
  shipmentId: string,
) {
  return db
    .select()
    .from(carrierInvoicesTable)
    .where(
      and(
        eq(carrierInvoicesTable.companyId, companyId),
        eq(carrierInvoicesTable.shipmentId, shipmentId),
      ),
    )
    .orderBy(desc(carrierInvoicesTable.createdAt));
}

export async function getShipmentFinancialSummary(
  companyId: string,
  shipmentId: string,
) {
  const charges = await db
    .select()
    .from(shipmentChargesTable)
    .where(
      and(
        eq(shipmentChargesTable.companyId, companyId),
        eq(shipmentChargesTable.shipmentId, shipmentId),
      ),
    );

  const carrierInvoices = await getCarrierInvoicesForShipment(
    companyId,
    shipmentId,
  );
  const reconciliations = await getReconciliationForShipment(
    companyId,
    shipmentId,
  );

  const expectedTotal = charges.reduce(
    (sum, ch) => sum + parseFloat(ch.totalAmount || "0"),
    0,
  );

  const actualTotal = carrierInvoices.reduce(
    (sum, inv) => sum + parseFloat(inv.totalAmount || "0"),
    0,
  );

  const latestReconciliation = reconciliations[0] || null;

  return {
    expectedTotal: Math.round(expectedTotal * 100) / 100,
    actualTotal: Math.round(actualTotal * 100) / 100,
    chargeBreakdown: charges.map((ch) => ({
      code: ch.chargeCode,
      description: ch.description,
      type: ch.chargeType,
      amount: parseFloat(ch.totalAmount || "0"),
      currency: ch.currency,
    })),
    carrierInvoiceCount: carrierInvoices.length,
    carrierInvoices: carrierInvoices.map((inv) => ({
      id: inv.id,
      carrierName: inv.carrierName,
      invoiceNumber: inv.invoiceNumber,
      totalAmount: parseFloat(inv.totalAmount || "0"),
      currency: inv.currency,
      invoiceDate: inv.invoiceDate,
      matchMethod: inv.matchMethod,
      matchConfidence: inv.matchConfidence,
    })),
    latestReconciliation: latestReconciliation
      ? {
          id: latestReconciliation.id,
          status: latestReconciliation.reconciliationStatus,
          expectedAmount: parseFloat(
            latestReconciliation.expectedAmount || "0",
          ),
          actualAmount: parseFloat(latestReconciliation.actualAmount || "0"),
          varianceAmount: parseFloat(
            latestReconciliation.varianceAmount || "0",
          ),
          variancePercentage: latestReconciliation.variancePercentage,
          discrepancyDetails: latestReconciliation.discrepancyDetails,
          createdAt: latestReconciliation.createdAt,
        }
      : null,
    reconciliationCount: reconciliations.length,
    hasUnreconciledInvoices:
      carrierInvoices.length > reconciliations.length,
  };
}
