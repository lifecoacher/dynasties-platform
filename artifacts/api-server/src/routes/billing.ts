import { Router } from "express";
import { db, type DbTransaction } from "@workspace/db";
import {
  billingAccountsTable,
  customerBillingProfilesTable,
  chargeRulesTable,
  invoicesTable,
  invoiceLineItemsTable,
  receivablesTable,
  paymentOptionConfigsTable,
  balanceFinancingRecordsTable,
  commercialEventsTable,
  shipmentsTable,
  shipmentChargesTable,
} from "@workspace/db/schema";
import { eq, and, desc, sql, inArray, gte, lte, or } from "drizzle-orm";
import { getCompanyId } from "../middlewares/tenant.js";
import { requireMinRole } from "../middlewares/auth.js";
import { generateId } from "@workspace/shared-utils";
import { getBalanceProvider } from "../providers/balance-provider.js";
import { computeFinancingTerms, validateFinanceTransition } from "../services/financing-engine.js";

const router = Router();

function logCommercialEvent(params: {
  companyId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actorType?: string;
  actorId?: string;
  amount?: number;
  currency?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  tx?: DbTransaction;
}) {
  const executor = params.tx || db;
  return executor.insert(commercialEventsTable).values({
    id: generateId("ce"),
    companyId: params.companyId,
    eventType: params.eventType as any,
    entityType: params.entityType as any,
    entityId: params.entityId,
    actorType: (params.actorType as any) || "SYSTEM",
    actorId: params.actorId,
    amount: params.amount?.toString(),
    currency: params.currency,
    description: params.description,
    metadata: params.metadata,
  });
}

router.get("/billing/account", async (req, res) => {
  const companyId = getCompanyId(req);
  const [account] = await db
    .select()
    .from(billingAccountsTable)
    .where(eq(billingAccountsTable.companyId, companyId))
    .limit(1);
  res.json({ data: account || null });
});

router.put("/billing/account", requireMinRole("MANAGER"), async (req, res) => {
  const companyId = getCompanyId(req);
  const body = req.body;
  const [existing] = await db
    .select()
    .from(billingAccountsTable)
    .where(eq(billingAccountsTable.companyId, companyId))
    .limit(1);
  if (existing) {
    const [updated] = await db
      .update(billingAccountsTable)
      .set({
        legalEntityName: body.legalEntityName ?? existing.legalEntityName,
        billingEmail: body.billingEmail ?? existing.billingEmail,
        currency: body.currency ?? existing.currency,
        invoicePrefix: body.invoicePrefix ?? existing.invoicePrefix,
        defaultPaymentTerms: body.defaultPaymentTerms ?? existing.defaultPaymentTerms,
        collectionsContactName: body.collectionsContactName ?? existing.collectionsContactName,
        collectionsContactEmail: body.collectionsContactEmail ?? existing.collectionsContactEmail,
        financeEnabled: body.financeEnabled ?? existing.financeEnabled,
        spreadModel: body.spreadModel ?? existing.spreadModel,
        spreadBps: body.spreadBps ?? existing.spreadBps,
        platformFeeAmount: body.platformFeeAmount?.toString() ?? existing.platformFeeAmount,
        status: body.status ?? existing.status,
      })
      .where(eq(billingAccountsTable.id, existing.id))
      .returning();
    res.json({ data: updated });
  } else {
    const [created] = await db
      .insert(billingAccountsTable)
      .values({
        id: generateId("ba"),
        companyId,
        legalEntityName: body.legalEntityName || "My Company",
        billingEmail: body.billingEmail || "",
        currency: body.currency || "USD",
        invoicePrefix: body.invoicePrefix || "INV",
        defaultPaymentTerms: body.defaultPaymentTerms || "NET_30",
        financeEnabled: body.financeEnabled ?? false,
        spreadModel: body.spreadModel || "PASS_THROUGH",
        spreadBps: body.spreadBps || 0,
      })
      .returning();
    res.json({ data: created });
  }
});

router.get("/billing/customers", async (req, res) => {
  const companyId = getCompanyId(req);
  const customers = await db
    .select()
    .from(customerBillingProfilesTable)
    .where(eq(customerBillingProfilesTable.companyId, companyId))
    .orderBy(desc(customerBillingProfilesTable.createdAt));
  res.json({ data: customers });
});

router.get("/billing/customers/:id", async (req, res) => {
  const companyId = getCompanyId(req);
  const [customer] = await db
    .select()
    .from(customerBillingProfilesTable)
    .where(
      and(
        eq(customerBillingProfilesTable.id, req.params.id),
        eq(customerBillingProfilesTable.companyId, companyId),
      ),
    )
    .limit(1);
  if (!customer) { res.status(404).json({ error: "Customer not found" }); return; }
  const invoices = await db
    .select()
    .from(invoicesTable)
    .where(
      and(
        eq(invoicesTable.customerBillingProfileId, customer.id),
        eq(invoicesTable.companyId, companyId),
      ),
    )
    .orderBy(desc(invoicesTable.createdAt));
  const receivables = await db
    .select()
    .from(receivablesTable)
    .where(
      and(
        eq(receivablesTable.customerBillingProfileId, customer.id),
        eq(receivablesTable.companyId, companyId),
      ),
    );
  res.json({ data: { ...customer, invoices, receivables } });
});

router.post("/billing/customers", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  const body = req.body;
  const [account] = await db
    .select()
    .from(billingAccountsTable)
    .where(eq(billingAccountsTable.companyId, companyId))
    .limit(1);
  if (!account) { res.status(400).json({ error: "Billing account not configured" }); return; }
  const [customer] = await db
    .insert(customerBillingProfilesTable)
    .values({
      id: generateId("cbp"),
      companyId,
      billingAccountId: account.id,
      customerName: body.customerName,
      billingEmail: body.billingEmail,
      billingAddress: body.billingAddress,
      billingCity: body.billingCity,
      billingCountry: body.billingCountry,
      paymentTerms: body.paymentTerms || "NET_30",
      creditLimit: body.creditLimit?.toString(),
      riskStatus: body.riskStatus || "LOW",
      preferredPaymentMethod: body.preferredPaymentMethod,
      defaultCurrency: body.defaultCurrency || "USD",
      notes: body.notes,
      entityId: body.entityId,
    })
    .returning();
  await logCommercialEvent({
    companyId,
    eventType: "CUSTOMER_CREATED",
    entityType: "CUSTOMER",
    entityId: customer.id,
    actorType: "USER",
    actorId: req.user?.userId,
    description: `Customer billing profile created: ${body.customerName}`,
  });
  res.json({ data: customer });
});

router.put("/billing/customers/:id", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  const body = req.body;
  const customerId = req.params.id as string;
  const [updated] = await db
    .update(customerBillingProfilesTable)
    .set({
      customerName: body.customerName,
      billingEmail: body.billingEmail,
      billingAddress: body.billingAddress,
      billingCity: body.billingCity,
      billingCountry: body.billingCountry,
      paymentTerms: body.paymentTerms,
      creditLimit: body.creditLimit?.toString(),
      riskStatus: body.riskStatus,
      notes: body.notes,
      status: body.status,
    })
    .where(
      and(
        eq(customerBillingProfilesTable.id, customerId),
        eq(customerBillingProfilesTable.companyId, companyId),
      ),
    )
    .returning();
  if (!updated) { res.status(404).json({ error: "Customer not found" }); return; }
  res.json({ data: updated });
});

router.get("/billing/charge-rules", async (req, res) => {
  const companyId = getCompanyId(req);
  const rules = await db
    .select()
    .from(chargeRulesTable)
    .where(eq(chargeRulesTable.companyId, companyId))
    .orderBy(chargeRulesTable.priority);
  res.json({ data: rules });
});

router.post("/billing/charge-rules", requireMinRole("MANAGER"), async (req, res) => {
  const companyId = getCompanyId(req);
  const body = req.body;
  const [account] = await db
    .select()
    .from(billingAccountsTable)
    .where(eq(billingAccountsTable.companyId, companyId))
    .limit(1);
  if (!account) { res.status(400).json({ error: "Billing account not configured" }); return; }
  const [rule] = await db
    .insert(chargeRulesTable)
    .values({
      id: generateId("cr"),
      companyId,
      billingAccountId: account.id,
      name: body.name,
      chargeType: body.chargeType,
      calculationMethod: body.calculationMethod || "FLAT",
      baseAmount: body.baseAmount?.toString(),
      ratePerUnit: body.ratePerUnit?.toString(),
      percentageBasis: body.percentageBasis,
      currency: body.currency || "USD",
      applicableCustomerId: body.applicableCustomerId,
      applicableLaneOrigin: body.applicableLaneOrigin,
      applicableLaneDestination: body.applicableLaneDestination,
      autoApply: body.autoApply ?? false,
      priority: body.priority ?? 100,
    })
    .returning();
  res.json({ data: rule });
});

router.get("/billing/invoices", async (req, res) => {
  const companyId = getCompanyId(req);
  const status = req.query.status as string | undefined;
  const conditions = [eq(invoicesTable.companyId, companyId)];
  if (status) conditions.push(eq(invoicesTable.status, status as any));
  const invoices = await db
    .select()
    .from(invoicesTable)
    .where(and(...conditions))
    .orderBy(desc(invoicesTable.createdAt))
    .limit(100);
  const customerIds = [...new Set(invoices.map((i) => i.customerBillingProfileId).filter(Boolean))];
  let customersMap: Record<string, any> = {};
  if (customerIds.length > 0) {
    const customers = await db
      .select()
      .from(customerBillingProfilesTable)
      .where(inArray(customerBillingProfilesTable.id, customerIds as string[]));
    customersMap = Object.fromEntries(customers.map((c) => [c.id, c]));
  }
  const enriched = invoices.map((inv) => ({
    ...inv,
    customer: inv.customerBillingProfileId ? customersMap[inv.customerBillingProfileId] : null,
  }));
  res.json({ data: enriched });
});

router.get("/billing/invoices/:id", async (req, res) => {
  const companyId = getCompanyId(req);
  const [invoice] = await db
    .select()
    .from(invoicesTable)
    .where(
      and(
        eq(invoicesTable.id, req.params.id as string),
        eq(invoicesTable.companyId, companyId),
      ),
    )
    .limit(1);
  if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
  const lineItems = await db
    .select()
    .from(invoiceLineItemsTable)
    .where(eq(invoiceLineItemsTable.invoiceId, invoice.id));
  let customer = null;
  if (invoice.customerBillingProfileId) {
    const [c] = await db
      .select()
      .from(customerBillingProfilesTable)
      .where(eq(customerBillingProfilesTable.id, invoice.customerBillingProfileId))
      .limit(1);
    customer = c;
  }
  const [receivable] = await db
    .select()
    .from(receivablesTable)
    .where(eq(receivablesTable.invoiceId, invoice.id))
    .limit(1);
  const [financing] = await db
    .select()
    .from(balanceFinancingRecordsTable)
    .where(eq(balanceFinancingRecordsTable.invoiceId, invoice.id))
    .limit(1);
  const events = await db
    .select()
    .from(commercialEventsTable)
    .where(
      and(
        eq(commercialEventsTable.entityId, invoice.id),
        eq(commercialEventsTable.companyId, companyId),
      ),
    )
    .orderBy(commercialEventsTable.createdAt);
  const financingTerms = computeFinancingTerms({
    invoiceStatus: invoice.status,
    outstandingAmount: receivable ? Number(receivable.outstandingAmount) : Number(invoice.grandTotal),
    financeEligible: invoice.financeEligible,
    financeStatus: invoice.financeStatus,
  });
  res.json({
    data: {
      ...invoice,
      lineItemsDetail: lineItems,
      customer,
      receivable,
      financing,
      financingTerms: financingTerms.eligible ? financingTerms : null,
      auditTrail: events,
    },
  });
});

router.post("/billing/invoices/from-shipment/:shipmentId", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  const shipmentId = req.params.shipmentId as string;
  const body = req.body;
  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(
      and(
        eq(shipmentsTable.id, shipmentId),
        eq(shipmentsTable.companyId, companyId),
      ),
    )
    .limit(1);
  if (!shipment) { res.status(404).json({ error: "Shipment not found" }); return; }
  const [account] = await db
    .select()
    .from(billingAccountsTable)
    .where(eq(billingAccountsTable.companyId, companyId))
    .limit(1);
  if (!account) { res.status(400).json({ error: "Billing account not configured" }); return; }

  const charges = await db
    .select()
    .from(shipmentChargesTable)
    .where(
      and(
        eq(shipmentChargesTable.shipmentId, shipmentId),
        eq(shipmentChargesTable.companyId, companyId),
      ),
    );

  const existingCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(invoicesTable)
    .where(eq(invoicesTable.companyId, companyId));
  const seqNum = Number(existingCount[0]?.count || 0) + 1;
  const invoiceNumber = `${account.invoicePrefix}-${String(seqNum).padStart(5, "0")}`;

  const lineItemsData = charges.map((c) => ({
    lineType: c.chargeType as any,
    description: c.description,
    quantity: c.quantity,
    unitPrice: c.unitPrice,
    amount: c.totalAmount,
    shipmentId: c.shipmentId,
    shipmentReference: shipment.reference,
  }));

  const subtotal = charges.reduce((s, c) => s + Number(c.totalAmount), 0);

  const invoiceId = generateId("inv");
  const [invoice] = await db
    .insert(invoicesTable)
    .values({
      id: invoiceId,
      companyId,
      shipmentId,
      customerBillingProfileId: body.customerBillingProfileId || null,
      invoiceNumber,
      status: "DRAFT",
      billToEntityId: shipment.consigneeId,
      billToName: body.billToName,
      billToEmail: body.billToEmail,
      subtotal: subtotal.toFixed(2),
      grandTotal: subtotal.toFixed(2),
      currency: account.currency,
      lineItems: lineItemsData,
      paymentTerms: body.paymentTerms || account.defaultPaymentTerms,
      financeEligible: account.financeEnabled && subtotal >= 1000,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      invoiceSource: "SHIPMENT",
    })
    .returning();

  for (const li of lineItemsData) {
    await db.insert(invoiceLineItemsTable).values({
      id: generateId("ili"),
      invoiceId,
      lineType: li.lineType,
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      amount: li.amount,
      shipmentId: li.shipmentId,
      shipmentReference: li.shipmentReference,
    });
  }

  await logCommercialEvent({
    companyId,
    eventType: "INVOICE_CREATED",
    entityType: "INVOICE",
    entityId: invoiceId,
    actorType: "USER",
    actorId: req.user?.userId,
    amount: subtotal,
    currency: account.currency,
    description: `Invoice ${invoiceNumber} created from shipment ${shipment.reference}`,
  });

  res.json({ data: invoice });
});

router.post("/billing/invoices/:id/send", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  const [invoice] = await db
    .select()
    .from(invoicesTable)
    .where(
      and(
        eq(invoicesTable.id, req.params.id as string),
        eq(invoicesTable.companyId, companyId),
      ),
    )
    .limit(1);
  if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
  if (!["DRAFT", "ISSUED"].includes(invoice.status)) {
    res.status(400).json({ error: `Cannot send invoice in ${invoice.status} status` });
    return;
  }
  const now = new Date();
  let dueDate = invoice.dueDate;
  if (!dueDate && invoice.paymentTerms) {
    const days = { DUE_ON_RECEIPT: 0, NET_15: 15, NET_30: 30, NET_60: 60, NET_90: 90 }[invoice.paymentTerms] ?? 30;
    dueDate = new Date(now.getTime() + days * 86400000);
  }
  const [updated] = await db
    .update(invoicesTable)
    .set({ status: "SENT", sentAt: now, issuedAt: invoice.issuedAt || now, dueDate })
    .where(eq(invoicesTable.id, invoice.id))
    .returning();
  if (updated.customerBillingProfileId) {
    await db.insert(receivablesTable).values({
      id: generateId("rcv"),
      companyId,
      invoiceId: invoice.id,
      customerBillingProfileId: updated.customerBillingProfileId,
      originalAmount: updated.grandTotal,
      outstandingAmount: updated.grandTotal,
      currency: updated.currency,
      dueDate: dueDate || now,
    }).onConflictDoNothing();
  }
  await logCommercialEvent({
    companyId,
    eventType: "INVOICE_SENT",
    entityType: "INVOICE",
    entityId: invoice.id,
    actorType: "USER",
    actorId: req.user?.userId,
    amount: Number(updated.grandTotal),
    currency: updated.currency,
    description: `Invoice ${invoice.invoiceNumber} sent`,
  });
  res.json({ data: updated });
});

router.post("/billing/invoices/:id/mark-paid", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  const body = req.body;
  const [invoice] = await db
    .select()
    .from(invoicesTable)
    .where(
      and(eq(invoicesTable.id, req.params.id as string), eq(invoicesTable.companyId, companyId)),
    )
    .limit(1);
  if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
  const paymentAmount = body.amount ? Number(body.amount) : Number(invoice.grandTotal);
  const isPartial = paymentAmount < Number(invoice.grandTotal);
  const [updated] = await db
    .update(invoicesTable)
    .set({
      status: isPartial ? "PARTIALLY_PAID" : "PAID",
      paidAt: isPartial ? undefined : new Date(),
      paymentMethod: body.paymentMethod || "PAY_NOW",
    })
    .where(eq(invoicesTable.id, invoice.id))
    .returning();
  const [receivable] = await db
    .select()
    .from(receivablesTable)
    .where(eq(receivablesTable.invoiceId, invoice.id))
    .limit(1);
  if (receivable) {
    const newOutstanding = Math.max(0, Number(receivable.outstandingAmount) - paymentAmount);
    await db
      .update(receivablesTable)
      .set({
        outstandingAmount: newOutstanding.toFixed(2),
        settlementStatus: newOutstanding <= 0 ? "SETTLED" : "PARTIALLY_SETTLED",
      })
      .where(eq(receivablesTable.id, receivable.id));
  }
  if (invoice.customerBillingProfileId) {
    await db
      .update(customerBillingProfilesTable)
      .set({
        currentExposure: sql`GREATEST(0, CAST(${customerBillingProfilesTable.currentExposure} AS NUMERIC) - ${paymentAmount})`,
      })
      .where(eq(customerBillingProfilesTable.id, invoice.customerBillingProfileId));
  }
  await logCommercialEvent({
    companyId,
    eventType: isPartial ? "INVOICE_PARTIALLY_PAID" : "INVOICE_PAID",
    entityType: "INVOICE",
    entityId: invoice.id,
    actorType: "USER",
    actorId: req.user?.userId,
    amount: paymentAmount,
    currency: invoice.currency,
    description: `Payment of ${invoice.currency} ${paymentAmount.toFixed(2)} received for ${invoice.invoiceNumber}`,
  });
  res.json({ data: updated });
});

router.post("/billing/invoices/:id/dispute", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  const body = req.body;
  const [updated] = await db
    .update(invoicesTable)
    .set({ status: "DISPUTED" })
    .where(
      and(eq(invoicesTable.id, req.params.id as string), eq(invoicesTable.companyId, companyId)),
    )
    .returning();
  if (!updated) { res.status(404).json({ error: "Invoice not found" }); return; }
  await db
    .update(receivablesTable)
    .set({ disputeStatus: "OPEN", disputeReason: body.reason })
    .where(eq(receivablesTable.invoiceId, updated.id));
  await logCommercialEvent({
    companyId,
    eventType: "INVOICE_DISPUTED",
    entityType: "INVOICE",
    entityId: updated.id,
    actorType: "USER",
    actorId: req.user?.userId,
    description: `Invoice ${updated.invoiceNumber} disputed: ${body.reason}`,
  });
  res.json({ data: updated });
});

router.post("/billing/invoices/:id/cancel", requireMinRole("MANAGER"), async (req, res) => {
  const companyId = getCompanyId(req);
  const [updated] = await db
    .update(invoicesTable)
    .set({ status: "CANCELLED" })
    .where(
      and(eq(invoicesTable.id, req.params.id as string), eq(invoicesTable.companyId, companyId)),
    )
    .returning();
  if (!updated) { res.status(404).json({ error: "Invoice not found" }); return; }
  await logCommercialEvent({
    companyId,
    eventType: "INVOICE_CANCELLED",
    entityType: "INVOICE",
    entityId: updated.id,
    actorType: "USER",
    actorId: req.user?.userId,
    description: `Invoice ${updated.invoiceNumber} cancelled`,
  });
  res.json({ data: updated });
});

router.post("/billing/invoices/:id/offer-financing", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  try {
    const result = await db.transaction(async (tx) => {
      const [invoice] = await tx
        .select()
        .from(invoicesTable)
        .where(and(eq(invoicesTable.id, req.params.id as string), eq(invoicesTable.companyId, companyId)))
        .limit(1);
      if (!invoice) throw Object.assign(new Error("Invoice not found"), { status: 404 });

      if (invoice.financeStatus === "OFFERED") {
        const [receivable] = await tx.select().from(receivablesTable).where(eq(receivablesTable.invoiceId, invoice.id)).limit(1);
        const outstanding = receivable ? Number(receivable.outstandingAmount) : Number(invoice.grandTotal);
        const terms = computeFinancingTerms({ invoiceStatus: invoice.status, outstandingAmount: outstanding, financeEligible: invoice.financeEligible, financeStatus: "NONE" });
        return { invoice, terms, idempotent: true };
      }

      const transition = validateFinanceTransition(invoice.financeStatus, "OFFERED");
      if (!transition.valid) throw Object.assign(new Error(transition.error!), { status: 400 });
      if (!["OVERDUE", "SENT", "PARTIALLY_PAID"].includes(invoice.status)) {
        throw Object.assign(new Error("Invoice status does not allow financing offers"), { status: 400 });
      }
      const [receivable] = await tx.select().from(receivablesTable).where(eq(receivablesTable.invoiceId, invoice.id)).limit(1);
      const outstanding = receivable ? Number(receivable.outstandingAmount) : Number(invoice.grandTotal);
      const terms = computeFinancingTerms({ invoiceStatus: invoice.status, outstandingAmount: outstanding, financeEligible: invoice.financeEligible, financeStatus: invoice.financeStatus });
      if (!terms.eligible) throw Object.assign(new Error("Invoice is not eligible for financing"), { status: 400 });

      const updateResult = await tx.update(invoicesTable).set({ financeStatus: "OFFERED" }).where(and(eq(invoicesTable.id, invoice.id), eq(invoicesTable.financeStatus, "NONE"))).returning({ id: invoicesTable.id });
      if (updateResult.length === 0) throw Object.assign(new Error("Concurrent modification detected — retry"), { status: 409 });
      await logCommercialEvent({
        tx,
        companyId,
        eventType: "BALANCE_REQUESTED",
        entityType: "INVOICE",
        entityId: invoice.id,
        actorType: "SYSTEM",
        amount: outstanding,
        currency: invoice.currency,
        description: `Financing offer generated: ${invoice.currency} ${terms.advanceAmount.toFixed(2)} advance at ${(terms.customerRate * 100).toFixed(1)}% fee`,
        metadata: { providerRate: terms.providerRate, platformSpread: terms.platformSpread, customerRate: terms.customerRate, financingFee: terms.financingFee, advanceAmount: terms.advanceAmount, platformRevenue: terms.platformRevenue },
      });
      const [updated] = await tx.select().from(invoicesTable).where(eq(invoicesTable.id, invoice.id)).limit(1);
      return { invoice: updated, terms, idempotent: false };
    });
    res.json({ data: { ...result.invoice, financingTerms: result.terms, idempotent: result.idempotent } });
  } catch (err: any) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || "Internal error" });
  }
});

router.post("/billing/invoices/:id/accept-financing", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  try {
    const result = await db.transaction(async (tx) => {
      const [invoice] = await tx
        .select()
        .from(invoicesTable)
        .where(and(eq(invoicesTable.id, req.params.id as string), eq(invoicesTable.companyId, companyId)))
        .limit(1);
      if (!invoice) throw Object.assign(new Error("Invoice not found"), { status: 404 });

      if (invoice.financeStatus === "ACCEPTED") {
        const [existingRecord] = await tx.select().from(balanceFinancingRecordsTable).where(eq(balanceFinancingRecordsTable.invoiceId, invoice.id)).limit(1);
        if (!existingRecord) throw Object.assign(new Error("Integrity error: invoice ACCEPTED but no financing record exists"), { status: 409 });
        const [existingReceivable] = await tx.select().from(receivablesTable).where(eq(receivablesTable.invoiceId, invoice.id)).limit(1);
        return { invoice, financing: existingRecord, receivable: existingReceivable, terms: null, idempotent: true };
      }

      if (["FUNDED", "REPAID"].includes(invoice.financeStatus)) {
        throw Object.assign(new Error(`Cannot accept financing: invoice already ${invoice.financeStatus}`), { status: 409 });
      }

      const transition = validateFinanceTransition(invoice.financeStatus, "ACCEPTED");
      if (!transition.valid) throw Object.assign(new Error(transition.error!), { status: 400 });
      if (!invoice.customerBillingProfileId) throw Object.assign(new Error("Invoice must have a customer billing profile"), { status: 400 });

      const now = new Date();
      const [receivable] = await tx.select().from(receivablesTable).where(eq(receivablesTable.invoiceId, invoice.id)).limit(1);
      const outstanding = receivable ? Number(receivable.outstandingAmount) : Number(invoice.grandTotal);
      if (outstanding <= 0) throw Object.assign(new Error("No outstanding amount to finance"), { status: 400 });
      const terms = computeFinancingTerms({ invoiceStatus: invoice.status, outstandingAmount: outstanding, financeEligible: invoice.financeEligible, financeStatus: invoice.financeStatus });
      if (!terms.eligible) throw Object.assign(new Error("Invoice is not eligible for financing"), { status: 400 });

      const invoiceUpdateResult = await tx.update(invoicesTable).set({ financeStatus: "ACCEPTED" }).where(and(eq(invoicesTable.id, invoice.id), eq(invoicesTable.financeStatus, "OFFERED"))).returning({ id: invoicesTable.id });
      if (invoiceUpdateResult.length === 0) throw Object.assign(new Error("Concurrent modification detected — retry"), { status: 409 });
      if (receivable) {
        await tx.update(receivablesTable).set({ financeStatus: "ACCEPTED" }).where(eq(receivablesTable.id, receivable.id));
      }
      const providerFeeAmount = Math.round(outstanding * terms.providerRate * 100) / 100;
      const [financingRecord] = await tx.insert(balanceFinancingRecordsTable).values({
        id: generateId("bfr"),
        companyId,
        invoiceId: invoice.id,
        customerBillingProfileId: invoice.customerBillingProfileId,
        applicationStatus: "ACCEPTED",
        termDays: 30,
        financedAmount: terms.advanceAmount.toFixed(2),
        providerFeeRate: terms.providerRate,
        providerFeeAmount: providerFeeAmount.toFixed(2),
        clientFacingFeeRate: terms.customerRate,
        clientFacingFeeAmount: terms.financingFee.toFixed(2),
        dynastiesSpreadAmount: terms.platformRevenue.toFixed(2),
        providerName: "balance",
        settlementStatus: "PENDING",
        requestedAt: now,
        acceptedAt: now,
      }).returning();
      await logCommercialEvent({
        tx, companyId, eventType: "BALANCE_ACCEPTED", entityType: "INVOICE", entityId: invoice.id,
        actorType: "USER", actorId: req.user?.userId, amount: terms.advanceAmount, currency: invoice.currency,
        description: `Financing accepted by operator for ${invoice.invoiceNumber}`,
      });
      const [updated] = await tx.select().from(invoicesTable).where(eq(invoicesTable.id, invoice.id)).limit(1);
      const [updatedReceivable] = await tx.select().from(receivablesTable).where(eq(receivablesTable.invoiceId, invoice.id)).limit(1);
      return { invoice: updated, financing: financingRecord, receivable: updatedReceivable, terms, idempotent: false };
    });
    res.json({ data: { ...result.invoice, financing: result.financing, receivable: result.receivable, financingTerms: result.terms, idempotent: result.idempotent } });
  } catch (err: any) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || "Internal error" });
  }
});

router.post("/billing/invoices/:id/fund-financing", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  try {
    const result = await db.transaction(async (tx) => {
      const [invoice] = await tx
        .select()
        .from(invoicesTable)
        .where(and(eq(invoicesTable.id, req.params.id as string), eq(invoicesTable.companyId, companyId)))
        .limit(1);
      if (!invoice) throw Object.assign(new Error("Invoice not found"), { status: 404 });

      if (invoice.financeStatus === "FUNDED") {
        const [existingFinancing] = await tx.select().from(balanceFinancingRecordsTable).where(eq(balanceFinancingRecordsTable.invoiceId, invoice.id)).limit(1);
        if (!existingFinancing) throw Object.assign(new Error("Integrity error: invoice FUNDED but no financing record exists"), { status: 409 });
        if (existingFinancing.applicationStatus !== "FUNDED") throw Object.assign(new Error(`Integrity error: invoice FUNDED but financing record is ${existingFinancing.applicationStatus}`), { status: 409 });
        const [existingReceivable] = await tx.select().from(receivablesTable).where(eq(receivablesTable.invoiceId, invoice.id)).limit(1);
        return { invoice, financing: existingFinancing, receivable: existingReceivable, idempotent: true };
      }

      const transition = validateFinanceTransition(invoice.financeStatus, "FUNDED");
      if (!transition.valid) throw Object.assign(new Error(transition.error!), { status: 400 });

      const [financingRecord] = await tx.select().from(balanceFinancingRecordsTable).where(eq(balanceFinancingRecordsTable.invoiceId, invoice.id)).limit(1);
      if (!financingRecord) throw Object.assign(new Error("No financing record found — must accept financing first"), { status: 400 });
      if (financingRecord.applicationStatus !== "ACCEPTED") {
        throw Object.assign(new Error(`Financing record in unexpected state: ${financingRecord.applicationStatus} (expected ACCEPTED)`), { status: 409 });
      }

      const [receivable] = await tx.select().from(receivablesTable).where(eq(receivablesTable.invoiceId, invoice.id)).limit(1);
      const now = new Date();
      const advanceAmount = Number(financingRecord.financedAmount || 0);
      const financingFee = Number(financingRecord.clientFacingFeeAmount || 0);
      const platformRevenue = Number(financingRecord.dynastiesSpreadAmount || 0);

      const bfrUpdateResult = await tx.update(balanceFinancingRecordsTable).set({
        applicationStatus: "FUNDED",
        settlementStatus: "SETTLED",
        decidedAt: now,
        fundedAt: now,
      }).where(and(eq(balanceFinancingRecordsTable.id, financingRecord.id), eq(balanceFinancingRecordsTable.applicationStatus, "ACCEPTED"))).returning({ id: balanceFinancingRecordsTable.id });
      if (bfrUpdateResult.length === 0) throw Object.assign(new Error("Concurrent modification detected — retry"), { status: 409 });
      const invoiceUpdateResult = await tx.update(invoicesTable).set({
        status: "FINANCED",
        financeStatus: "FUNDED",
        paymentMethod: "FINANCED",
        financeFee: financingFee.toFixed(2),
        dynastiesSpread: platformRevenue.toFixed(2),
        paidAt: now,
      }).where(and(eq(invoicesTable.id, invoice.id), eq(invoicesTable.financeStatus, "ACCEPTED"))).returning({ id: invoicesTable.id });
      if (invoiceUpdateResult.length === 0) throw Object.assign(new Error("Concurrent modification detected — retry"), { status: 409 });
      if (receivable) {
        await tx.update(receivablesTable).set({
          outstandingAmount: "0",
          settlementStatus: "SETTLED",
          financeStatus: "FUNDED",
          collectionsStatus: "FINANCED",
          receivableTransferred: true,
          daysOverdue: 0,
        }).where(eq(receivablesTable.id, receivable.id));
      }
      await logCommercialEvent({
        tx, companyId, eventType: "BALANCE_FUNDED", entityType: "INVOICE", entityId: invoice.id,
        actorType: "PROVIDER", amount: advanceAmount, currency: invoice.currency,
        description: `Receivable transferred to financing provider — ${invoice.currency} ${advanceAmount.toFixed(2)} disbursed`,
      });
      await logCommercialEvent({
        tx, companyId, eventType: "SPREAD_RECORDED", entityType: "INVOICE", entityId: invoice.id,
        actorType: "SYSTEM", amount: platformRevenue, currency: invoice.currency,
        description: `Platform revenue recorded: ${invoice.currency} ${platformRevenue.toFixed(2)}`,
      });
      const [updated] = await tx.select().from(invoicesTable).where(eq(invoicesTable.id, invoice.id)).limit(1);
      const [updatedReceivable] = await tx.select().from(receivablesTable).where(eq(receivablesTable.invoiceId, invoice.id)).limit(1);
      const [updatedFinancing] = await tx.select().from(balanceFinancingRecordsTable).where(eq(balanceFinancingRecordsTable.id, financingRecord.id)).limit(1);
      return { invoice: updated, financing: updatedFinancing, receivable: updatedReceivable, idempotent: false };
    });
    res.json({ data: { ...result.invoice, financing: result.financing, receivable: result.receivable, financingTerms: null, idempotent: result.idempotent } });
  } catch (err: any) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || "Internal error" });
  }
});

router.post("/billing/invoices/:id/mark-repaid", requireMinRole("OPERATOR"), async (req, res) => {
  const companyId = getCompanyId(req);
  try {
    const result = await db.transaction(async (tx) => {
      const [invoice] = await tx
        .select()
        .from(invoicesTable)
        .where(and(eq(invoicesTable.id, req.params.id as string), eq(invoicesTable.companyId, companyId)))
        .limit(1);
      if (!invoice) throw Object.assign(new Error("Invoice not found"), { status: 404 });

      if (invoice.financeStatus === "REPAID") {
        const [existingFinancing] = await tx.select().from(balanceFinancingRecordsTable).where(eq(balanceFinancingRecordsTable.invoiceId, invoice.id)).limit(1);
        if (!existingFinancing) throw Object.assign(new Error("Integrity error: invoice REPAID but no financing record exists"), { status: 409 });
        if (existingFinancing.applicationStatus !== "REPAID") throw Object.assign(new Error(`Integrity error: invoice REPAID but financing record is ${existingFinancing.applicationStatus}`), { status: 409 });
        return { invoice, idempotent: true };
      }

      const transition = validateFinanceTransition(invoice.financeStatus, "REPAID");
      if (!transition.valid) throw Object.assign(new Error(transition.error!), { status: 400 });

      const [financing] = await tx.select().from(balanceFinancingRecordsTable).where(eq(balanceFinancingRecordsTable.invoiceId, invoice.id)).limit(1);
      if (!financing) throw Object.assign(new Error("No financing record found — cannot mark repaid without a funding record"), { status: 400 });
      if (financing.applicationStatus !== "FUNDED") {
        throw Object.assign(new Error(`Financing record in unexpected state: ${financing.applicationStatus} (expected FUNDED)`), { status: 409 });
      }

      const now = new Date();
      const invoiceUpdateResult = await tx.update(invoicesTable).set({ financeStatus: "REPAID" }).where(and(eq(invoicesTable.id, invoice.id), eq(invoicesTable.financeStatus, "FUNDED"))).returning({ id: invoicesTable.id });
      if (invoiceUpdateResult.length === 0) throw Object.assign(new Error("Concurrent modification detected — retry"), { status: 409 });
      const bfrUpdateResult = await tx.update(balanceFinancingRecordsTable).set({ applicationStatus: "REPAID", repaidAt: now, settlementStatus: "SETTLED" }).where(and(eq(balanceFinancingRecordsTable.id, financing.id), eq(balanceFinancingRecordsTable.applicationStatus, "FUNDED"))).returning({ id: balanceFinancingRecordsTable.id });
      if (bfrUpdateResult.length === 0) throw Object.assign(new Error("Concurrent modification detected — retry"), { status: 409 });
      await tx.update(receivablesTable).set({ financeStatus: "REPAID" }).where(eq(receivablesTable.invoiceId, invoice.id));
      await logCommercialEvent({
        tx, companyId, eventType: "BALANCE_REPAID", entityType: "INVOICE", entityId: invoice.id,
        actorType: "SYSTEM", amount: Number(financing.financedAmount || 0), currency: invoice.currency,
        description: `Financing repaid for ${invoice.invoiceNumber}`,
      });
      const [updated] = await tx.select().from(invoicesTable).where(eq(invoicesTable.id, invoice.id)).limit(1);
      return { invoice: updated, idempotent: false };
    });
    res.json({ data: { ...result.invoice, idempotent: result.idempotent } });
  } catch (err: any) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message || "Internal error" });
  }
});

router.get("/billing/receivables/overview", async (req, res) => {
  const companyId = getCompanyId(req);

  const receivables = await db
    .select()
    .from(receivablesTable)
    .where(eq(receivablesTable.companyId, companyId));

  const allInvoices = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.companyId, companyId));

  const now = new Date();

  let totalOutstanding = 0;
  let totalOverdue = 0;
  let totalCurrent = 0;
  let totalDisputed = 0;
  let countOverdue = 0;
  for (const r of receivables) {
    const amt = Number(r.outstandingAmount);
    if (r.receivableTransferred) continue;
    totalOutstanding += amt;
    if (r.disputeStatus === "OPEN") totalDisputed += amt;
    if (r.dueDate < now && amt > 0 && r.financeStatus !== "FUNDED" && r.financeStatus !== "REPAID") {
      totalOverdue += amt;
      countOverdue++;
    } else if (amt > 0) {
      totalCurrent += amt;
    }
  }

  const overdueInvoices = allInvoices.filter(
    (i) => i.status === "OVERDUE" && i.financeStatus !== "FUNDED" && i.financeStatus !== "REPAID",
  );
  const disputedInvoices = allInvoices.filter((i) => i.status === "DISPUTED");
  const paidInvoices = allInvoices.filter((i) => i.status === "PAID");
  const paidThisMonth = paidInvoices
    .filter((i) => i.paidAt && i.paidAt.getMonth() === now.getMonth() && i.paidAt.getFullYear() === now.getFullYear())
    .reduce((s, i) => s + Number(i.grandTotal), 0);
  const totalInvoiced = allInvoices.reduce((s, i) => s + Number(i.grandTotal || 0), 0);

  const financedRecords = await db
    .select()
    .from(balanceFinancingRecordsTable)
    .where(
      and(
        eq(balanceFinancingRecordsTable.companyId, companyId),
        inArray(balanceFinancingRecordsTable.applicationStatus, ["ACCEPTED", "FUNDED", "REPAID"]),
      ),
    );
  const totalFinanced = financedRecords.reduce((s, r) => s + Number(r.financedAmount || 0), 0);
  const totalFinancingFees = financedRecords.reduce((s, r) => s + Number(r.clientFacingFeeAmount || 0), 0);
  const totalSpread = financedRecords.reduce((s, r) => s + Number(r.dynastiesSpreadAmount || 0), 0);

  const openReceivables = receivables.filter(
    (r) => Number(r.outstandingAmount) > 0 && !r.receivableTransferred,
  );
  const aging: Record<string, number> = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0 };
  for (const r of openReceivables) {
    const amt = Number(r.outstandingAmount);
    if (!r.dueDate || r.dueDate >= now) {
      aging.current += amt;
    } else {
      const overdueDays = Math.floor((now.getTime() - r.dueDate.getTime()) / 86400000);
      if (overdueDays <= 30) aging.days1to30 += amt;
      else if (overdueDays <= 60) aging.days31to60 += amt;
      else if (overdueDays <= 90) aging.days61to90 += amt;
      else aging.days90plus += amt;
    }
  }

  res.json({
    data: {
      totalOutstanding,
      totalOverdue,
      totalCurrent,
      totalDisputed,
      countOverdue,
      countDisputed: disputedInvoices.length,
      countPaid: paidInvoices.length,
      countOverdueInvoices: overdueInvoices.length,
      paidThisMonth,
      totalInvoiced,
      totalInvoiceCount: allInvoices.length,
      totalFinanced,
      totalFinancingFees,
      totalSpread,
      platformRevenue: totalSpread,
      financedCount: financedRecords.length,
      receivableCount: openReceivables.length,
      averageFinancingRate: financedRecords.length > 0
        ? financedRecords.reduce((s, r) => s + (r.clientFacingFeeRate || 0), 0) / financedRecords.length
        : 0,
      aging,
      currency: "USD",
    },
  });
});

router.get("/billing/receivables", async (req, res) => {
  const companyId = getCompanyId(req);
  const receivables = await db
    .select()
    .from(receivablesTable)
    .where(eq(receivablesTable.companyId, companyId))
    .orderBy(receivablesTable.dueDate);
  res.json({ data: receivables });
});

router.post("/billing/invoices/:id/request-financing", requireMinRole("OPERATOR"), async (_req, res) => {
  res.status(410).json({ error: "Deprecated — use /offer-financing, /accept-financing, /fund-financing lifecycle" });
});

router.get("/billing/finance-offers/:invoiceId", async (req, res) => {
  const companyId = getCompanyId(req);
  const [invoice] = await db
    .select()
    .from(invoicesTable)
    .where(
      and(eq(invoicesTable.id, req.params.invoiceId), eq(invoicesTable.companyId, companyId)),
    )
    .limit(1);
  if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }
  if (!invoice.financeEligible) {
    res.json({ data: { eligible: false, offers: [], reason: "Invoice not eligible" } });
    return;
  }
  const provider = getBalanceProvider();
  const offers = await provider.requestOffer({
    invoiceId: invoice.id,
    amount: Number(invoice.grandTotal),
    currency: invoice.currency,
    customerName: invoice.billToName || "Customer",
    customerEmail: invoice.billToEmail || "",
  });
  res.json({
    data: {
      eligible: true,
      offers,
      providerMode: provider.mode,
    },
  });
});

router.get("/billing/payment-config", async (req, res) => {
  const companyId = getCompanyId(req);
  const [config] = await db
    .select()
    .from(paymentOptionConfigsTable)
    .where(eq(paymentOptionConfigsTable.companyId, companyId))
    .limit(1);
  res.json({ data: config || null });
});

router.put("/billing/payment-config", requireMinRole("MANAGER"), async (req, res) => {
  const companyId = getCompanyId(req);
  const body = req.body;
  const [existing] = await db
    .select()
    .from(paymentOptionConfigsTable)
    .where(eq(paymentOptionConfigsTable.companyId, companyId))
    .limit(1);
  if (existing) {
    const [updated] = await db
      .update(paymentOptionConfigsTable)
      .set(body)
      .where(eq(paymentOptionConfigsTable.id, existing.id))
      .returning();
    res.json({ data: updated });
  } else {
    const [account] = await db
      .select()
      .from(billingAccountsTable)
      .where(eq(billingAccountsTable.companyId, companyId))
      .limit(1);
    if (!account) { res.status(400).json({ error: "Billing account not configured" }); return; }
    const [created] = await db
      .insert(paymentOptionConfigsTable)
      .values({
        id: generateId("poc"),
        companyId,
        billingAccountId: account.id,
        ...body,
      })
      .returning();
    res.json({ data: created });
  }
});

router.get("/billing/events", async (req, res) => {
  const companyId = getCompanyId(req);
  const events = await db
    .select()
    .from(commercialEventsTable)
    .where(eq(commercialEventsTable.companyId, companyId))
    .orderBy(desc(commercialEventsTable.createdAt))
    .limit(50);
  res.json({ data: events });
});

router.get("/billing/shipment-charges/:shipmentId", async (req, res) => {
  const companyId = getCompanyId(req);
  const charges = await db
    .select()
    .from(shipmentChargesTable)
    .where(
      and(
        eq(shipmentChargesTable.shipmentId, req.params.shipmentId),
        eq(shipmentChargesTable.companyId, companyId),
      ),
    );
  const [existingInvoice] = await db
    .select()
    .from(invoicesTable)
    .where(
      and(
        eq(invoicesTable.shipmentId, req.params.shipmentId),
        eq(invoicesTable.companyId, companyId),
      ),
    )
    .limit(1);
  res.json({
    data: {
      charges,
      existingInvoice: existingInvoice || null,
      totalCharges: charges.reduce((s, c) => s + Number(c.totalAmount), 0),
    },
  });
});

export default router;
