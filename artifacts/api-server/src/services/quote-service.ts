import { db } from "@workspace/db";
import {
  quotesTable,
  quoteLineItemsTable,
  shipmentsTable,
  shipmentChargesTable,
  eventsTable,
  type Quote,
  type QuoteLineItem,
} from "@workspace/db/schema";
import { generateId } from "@workspace/shared-utils";
import { eq, and, desc, sql, count } from "drizzle-orm";

export interface CreateQuoteInput {
  companyId: string;
  customerId?: string;
  origin?: string;
  destination?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  incoterms?: string;
  cargoSummary?: string;
  commodity?: string;
  hsCode?: string;
  quantity?: number;
  packageCount?: number;
  grossWeight?: number;
  weightUnit?: "KG" | "LB";
  volume?: number;
  volumeUnit?: "CBM" | "CFT";
  currency?: string;
  validUntil?: string;
  notes?: string;
  createdBy?: string;
}

export interface CreateLineItemInput {
  chargeType: string;
  description: string;
  quantity?: number;
  unitPrice: string;
  amount: string;
  currency?: string;
  metadata?: Record<string, unknown>;
}

async function generateQuoteNumber(companyId: string): Promise<string> {
  const [result] = await db
    .select({ cnt: count() })
    .from(quotesTable)
    .where(eq(quotesTable.companyId, companyId));
  const seq = (result?.cnt ?? 0) + 1;
  return `QT-${String(seq).padStart(4, "0")}`;
}

export async function createQuote(input: CreateQuoteInput): Promise<Quote> {
  const id = generateId("qt");
  const quoteNumber = await generateQuoteNumber(input.companyId);

  const [quote] = await db
    .insert(quotesTable)
    .values({
      id,
      companyId: input.companyId,
      customerId: input.customerId,
      quoteNumber,
      status: "DRAFT",
      version: 1,
      origin: input.origin,
      destination: input.destination,
      portOfLoading: input.portOfLoading,
      portOfDischarge: input.portOfDischarge,
      incoterms: input.incoterms,
      cargoSummary: input.cargoSummary,
      commodity: input.commodity,
      hsCode: input.hsCode,
      quantity: input.quantity,
      packageCount: input.packageCount,
      grossWeight: input.grossWeight,
      weightUnit: input.weightUnit,
      volume: input.volume,
      volumeUnit: input.volumeUnit,
      currency: input.currency ?? "USD",
      validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
      notes: input.notes,
      createdBy: input.createdBy,
    })
    .returning();

  await emitEvent(input.companyId, "QUOTE_CREATED", "QUOTE", id, input.createdBy, {
    quoteNumber,
  });

  return quote;
}

export async function updateQuote(
  quoteId: string,
  companyId: string,
  updates: Partial<CreateQuoteInput>,
): Promise<Quote | null> {
  const existing = await getQuote(quoteId, companyId);
  if (!existing) return null;
  if (existing.status !== "DRAFT") {
    throw new Error("Only DRAFT quotes can be edited");
  }

  const updateData: Record<string, unknown> = {};
  const allowedFields = [
    "customerId", "origin", "destination", "portOfLoading", "portOfDischarge",
    "incoterms", "cargoSummary", "commodity", "hsCode", "quantity", "packageCount",
    "grossWeight", "weightUnit", "volume", "volumeUnit", "currency", "notes",
  ] as const;

  for (const field of allowedFields) {
    if (field in updates) {
      updateData[field] = (updates as Record<string, unknown>)[field];
    }
  }

  if ("validUntil" in updates) {
    updateData.validUntil = updates.validUntil ? new Date(updates.validUntil) : null;
  }

  const [updated] = await db
    .update(quotesTable)
    .set(updateData)
    .where(and(eq(quotesTable.id, quoteId), eq(quotesTable.companyId, companyId)))
    .returning();

  return updated ?? null;
}

export async function getQuote(quoteId: string, companyId: string): Promise<Quote | null> {
  const [quote] = await db
    .select()
    .from(quotesTable)
    .where(and(eq(quotesTable.id, quoteId), eq(quotesTable.companyId, companyId)));
  return quote ?? null;
}

export async function listQuotes(
  companyId: string,
  options?: { status?: string; limit?: number; offset?: number },
): Promise<{ quotes: Quote[]; total: number }> {
  const conditions = [eq(quotesTable.companyId, companyId)];
  if (options?.status) {
    conditions.push(eq(quotesTable.status, options.status as Quote["status"]));
  }

  const [countResult] = await db
    .select({ cnt: count() })
    .from(quotesTable)
    .where(and(...conditions));

  const quotes = await db
    .select()
    .from(quotesTable)
    .where(and(...conditions))
    .orderBy(desc(quotesTable.createdAt))
    .limit(options?.limit ?? 50)
    .offset(options?.offset ?? 0);

  return { quotes, total: countResult?.cnt ?? 0 };
}

export async function addLineItem(
  quoteId: string,
  companyId: string,
  input: CreateLineItemInput,
): Promise<QuoteLineItem> {
  const quote = await getQuote(quoteId, companyId);
  if (!quote) throw new Error("Quote not found");
  if (quote.status !== "DRAFT") throw new Error("Cannot add line items to non-DRAFT quote");

  const id = generateId("qli");
  const [item] = await db
    .insert(quoteLineItemsTable)
    .values({
      id,
      quoteId,
      chargeType: input.chargeType as QuoteLineItem["chargeType"],
      description: input.description,
      quantity: input.quantity ?? 1,
      unitPrice: input.unitPrice,
      amount: input.amount,
      currency: input.currency ?? "USD",
      metadata: input.metadata,
    })
    .returning();

  await recalculateQuotedAmount(quoteId);
  return item;
}

export async function updateLineItem(
  lineItemId: string,
  quoteId: string,
  companyId: string,
  input: Partial<CreateLineItemInput>,
): Promise<QuoteLineItem | null> {
  const quote = await getQuote(quoteId, companyId);
  if (!quote) throw new Error("Quote not found");
  if (quote.status !== "DRAFT") throw new Error("Cannot edit line items on non-DRAFT quote");

  const updateData: Record<string, unknown> = {};
  for (const field of ["chargeType", "description", "quantity", "unitPrice", "amount", "currency", "metadata"]) {
    if (field in input) {
      updateData[field] = (input as Record<string, unknown>)[field];
    }
  }

  const [updated] = await db
    .update(quoteLineItemsTable)
    .set(updateData)
    .where(and(eq(quoteLineItemsTable.id, lineItemId), eq(quoteLineItemsTable.quoteId, quoteId)))
    .returning();

  if (updated) await recalculateQuotedAmount(quoteId);
  return updated ?? null;
}

export async function deleteLineItem(
  lineItemId: string,
  quoteId: string,
  companyId: string,
): Promise<boolean> {
  const quote = await getQuote(quoteId, companyId);
  if (!quote) throw new Error("Quote not found");
  if (quote.status !== "DRAFT") throw new Error("Cannot delete line items on non-DRAFT quote");

  const result = await db
    .delete(quoteLineItemsTable)
    .where(and(eq(quoteLineItemsTable.id, lineItemId), eq(quoteLineItemsTable.quoteId, quoteId)));

  await recalculateQuotedAmount(quoteId);
  return true;
}

export async function getLineItems(quoteId: string): Promise<QuoteLineItem[]> {
  return db
    .select()
    .from(quoteLineItemsTable)
    .where(eq(quoteLineItemsTable.quoteId, quoteId));
}

async function recalculateQuotedAmount(quoteId: string): Promise<void> {
  const items = await getLineItems(quoteId);
  const total = items.reduce((sum, item) => sum + parseFloat(item.amount), 0);
  await db
    .update(quotesTable)
    .set({ quotedAmount: total.toFixed(2) })
    .where(eq(quotesTable.id, quoteId));
}

export async function sendQuote(
  quoteId: string,
  companyId: string,
  userId?: string,
): Promise<Quote> {
  const quote = await getQuote(quoteId, companyId);
  if (!quote) throw new Error("Quote not found");
  if (quote.status !== "DRAFT") throw new Error("Only DRAFT quotes can be sent");

  const [updated] = await db
    .update(quotesTable)
    .set({ status: "SENT" })
    .where(and(eq(quotesTable.id, quoteId), eq(quotesTable.companyId, companyId)))
    .returning();

  await emitEvent(companyId, "QUOTE_SENT", "QUOTE", quoteId, userId, {
    quoteNumber: quote.quoteNumber,
  });

  return updated;
}

export async function acceptQuote(
  quoteId: string,
  companyId: string,
  userId?: string,
): Promise<Quote> {
  const quote = await getQuote(quoteId, companyId);
  if (!quote) throw new Error("Quote not found");
  if (quote.status !== "SENT" && quote.status !== "DRAFT") {
    throw new Error("Only DRAFT or SENT quotes can be accepted");
  }

  const lineItems = await getLineItems(quoteId);
  const pricingSnapshot = {
    quotedAmount: quote.quotedAmount,
    currency: quote.currency,
    lineItems: lineItems.map((li) => ({
      chargeType: li.chargeType,
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      amount: li.amount,
    })),
    acceptedAt: new Date().toISOString(),
  };

  const [updated] = await db
    .update(quotesTable)
    .set({ status: "ACCEPTED", pricingSnapshot })
    .where(and(eq(quotesTable.id, quoteId), eq(quotesTable.companyId, companyId)))
    .returning();

  await emitEvent(companyId, "QUOTE_ACCEPTED", "QUOTE", quoteId, userId, {
    quoteNumber: quote.quoteNumber,
    quotedAmount: quote.quotedAmount,
  });

  return updated;
}

export async function rejectQuote(
  quoteId: string,
  companyId: string,
  userId?: string,
): Promise<Quote> {
  const quote = await getQuote(quoteId, companyId);
  if (!quote) throw new Error("Quote not found");
  if (quote.status === "CONVERTED") throw new Error("Cannot reject a converted quote");

  const [updated] = await db
    .update(quotesTable)
    .set({ status: "REJECTED" })
    .where(and(eq(quotesTable.id, quoteId), eq(quotesTable.companyId, companyId)))
    .returning();

  await emitEvent(companyId, "QUOTE_REJECTED", "QUOTE", quoteId, userId, {
    quoteNumber: quote.quoteNumber,
  });

  return updated;
}

export async function expireQuote(
  quoteId: string,
  companyId: string,
): Promise<Quote> {
  const [updated] = await db
    .update(quotesTable)
    .set({ status: "EXPIRED" })
    .where(and(eq(quotesTable.id, quoteId), eq(quotesTable.companyId, companyId)))
    .returning();
  return updated;
}

export async function convertQuoteToShipment(
  quoteId: string,
  companyId: string,
  userId?: string,
): Promise<{ shipment: { id: string; reference: string }; chargesCreated: number }> {
  const quote = await getQuote(quoteId, companyId);
  if (!quote) throw new Error("Quote not found");
  if (quote.status !== "ACCEPTED") {
    throw new Error("Only ACCEPTED quotes can be converted to shipments");
  }

  const lineItems = await getLineItems(quoteId);

  const shipmentId = generateId("shp");
  const shipmentRef = `SHP-${Date.now().toString(36).toUpperCase()}`;

  const [shipment] = await db
    .insert(shipmentsTable)
    .values({
      id: shipmentId,
      companyId,
      reference: shipmentRef,
      status: "DRAFT",
      shipperId: null,
      consigneeId: quote.customerId,
      portOfLoading: quote.portOfLoading,
      portOfDischarge: quote.portOfDischarge,
      commodity: quote.commodity,
      hsCode: quote.hsCode,
      packageCount: quote.packageCount,
      grossWeight: quote.grossWeight,
      weightUnit: quote.weightUnit,
      volume: quote.volume,
      volumeUnit: quote.volumeUnit,
      incoterms: quote.incoterms,
      cargoValue: quote.quotedAmount ? parseFloat(quote.quotedAmount) : undefined,
      sourceQuoteId: quoteId,
      operatorNotes: quote.notes
        ? `Converted from ${quote.quoteNumber}. ${quote.notes}`
        : `Converted from ${quote.quoteNumber}`,
    })
    .returning();

  let chargesCreated = 0;
  for (const li of lineItems) {
    const chargeTypeMap: Record<string, string> = {
      FREIGHT: "FREIGHT",
      FUEL_SURCHARGE: "SURCHARGE",
      CUSTOMS: "CUSTOMS",
      DOCUMENTATION: "DOCUMENTATION",
      STORAGE: "OTHER",
      INSURANCE: "INSURANCE",
      HANDLING: "ORIGIN",
      PORT_CHARGES: "DESTINATION",
      INSPECTION: "OTHER",
      OTHER: "OTHER",
    };
    await db.insert(shipmentChargesTable).values({
      id: generateId("chrg"),
      companyId,
      shipmentId: shipmentId,
      chargeCode: li.chargeType,
      description: li.description,
      chargeType: (chargeTypeMap[li.chargeType] ?? "OTHER") as "FREIGHT" | "ORIGIN" | "DESTINATION" | "DOCUMENTATION" | "INSURANCE" | "CUSTOMS" | "SURCHARGE" | "OTHER",
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      currency: li.currency,
      totalAmount: li.amount,
      source: "MANUAL",
      metadata: { sourceQuoteId: quoteId, sourceLineItemId: li.id },
    });
    chargesCreated++;
  }

  await db
    .update(quotesTable)
    .set({ status: "CONVERTED", convertedShipmentId: shipmentId })
    .where(eq(quotesTable.id, quoteId));

  await emitEvent(companyId, "QUOTE_CONVERTED", "QUOTE", quoteId, userId, {
    quoteNumber: quote.quoteNumber,
    shipmentId,
    shipmentReference: shipmentRef,
    chargesCreated,
  });

  await emitEvent(companyId, "SHIPMENT_CREATED_FROM_QUOTE", "SHIPMENT", shipmentId, userId, {
    sourceQuoteId: quoteId,
    quoteNumber: quote.quoteNumber,
    quotedAmount: quote.quotedAmount,
  });

  return {
    shipment: { id: shipmentId, reference: shipmentRef },
    chargesCreated,
  };
}

async function emitEvent(
  companyId: string,
  eventType: string,
  entityType: string,
  entityId: string,
  userId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await db.insert(eventsTable).values({
    id: generateId("evt"),
    companyId,
    eventType,
    entityType,
    entityId,
    actorType: userId ? "USER" : "SYSTEM",
    userId: userId ?? null,
    metadata,
  });
}
