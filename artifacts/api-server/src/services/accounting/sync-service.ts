import { db } from "@workspace/db";
import {
  accountingConnectionsTable,
  accountingSyncMappingsTable,
  customerBillingProfilesTable,
  invoicesTable,
  receivablesTable,
  eventsTable,
} from "@workspace/db/schema";
import { generateId } from "@workspace/shared-utils";
import { eq, and, sql } from "drizzle-orm";
import { getQuickBooksAdapter, getDemoAdapter } from "./qb-adapter.js";

async function emitAuditEvent(params: {
  companyId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(eventsTable).values({
    id: generateId("evt"),
    companyId: params.companyId,
    eventType: params.eventType,
    entityType: params.entityType,
    entityId: params.entityId,
    actorType: params.userId ? "USER" : "SYSTEM",
    userId: params.userId,
    metadata: params.metadata ?? null,
  });
}

export async function getOrCreateConnection(companyId: string, provider: "QUICKBOOKS" = "QUICKBOOKS") {
  const [existing] = await db
    .select()
    .from(accountingConnectionsTable)
    .where(and(eq(accountingConnectionsTable.companyId, companyId), eq(accountingConnectionsTable.provider, provider)))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(accountingConnectionsTable)
    .values({
      id: generateId("acc"),
      companyId,
      provider,
      connectionStatus: "NOT_CONNECTED",
    })
    .returning();

  return created;
}

export async function connectQuickBooks(companyId: string, userId: string) {
  const connection = await getOrCreateConnection(companyId);
  const adapter = getQuickBooksAdapter(connection.id);
  const testResult = await adapter.testConnection();

  if (!testResult.success) {
    await db
      .update(accountingConnectionsTable)
      .set({ connectionStatus: "ERROR", lastSyncError: "Connection test failed" })
      .where(eq(accountingConnectionsTable.id, connection.id));
    throw new Error("QuickBooks connection test failed");
  }

  const [updated] = await db
    .update(accountingConnectionsTable)
    .set({
      connectionStatus: "CONNECTED",
      realmId: testResult.realmId,
      companyName: testResult.companyName,
      lastSyncError: null,
    })
    .where(eq(accountingConnectionsTable.id, connection.id))
    .returning();

  await emitAuditEvent({
    companyId,
    eventType: "ACCOUNTING_CONNECTED",
    entityType: "ACCOUNTING_CONNECTION",
    entityId: connection.id,
    userId,
    metadata: { provider: "QUICKBOOKS", realmId: testResult.realmId, companyName: testResult.companyName },
  });

  return updated;
}

export async function disconnectQuickBooks(companyId: string, userId: string) {
  const connection = await getOrCreateConnection(companyId);

  const [updated] = await db
    .update(accountingConnectionsTable)
    .set({ connectionStatus: "NOT_CONNECTED", realmId: null, companyName: null, tokenEncrypted: null, refreshTokenEncrypted: null })
    .where(eq(accountingConnectionsTable.id, connection.id))
    .returning();

  await emitAuditEvent({
    companyId,
    eventType: "ACCOUNTING_DISCONNECTED",
    entityType: "ACCOUNTING_CONNECTION",
    entityId: connection.id,
    userId,
  });

  return updated;
}

export async function syncCustomer(companyId: string, customerBillingProfileId: string, userId: string) {
  const connection = await getOrCreateConnection(companyId);
  if (connection.connectionStatus !== "CONNECTED") throw new Error("QuickBooks not connected");

  const [customer] = await db
    .select()
    .from(customerBillingProfilesTable)
    .where(and(eq(customerBillingProfilesTable.id, customerBillingProfileId), eq(customerBillingProfilesTable.companyId, companyId)))
    .limit(1);

  if (!customer) throw new Error("Customer billing profile not found");

  const [existingMapping] = await db
    .select()
    .from(accountingSyncMappingsTable)
    .where(
      and(
        eq(accountingSyncMappingsTable.connectionId, connection.id),
        eq(accountingSyncMappingsTable.entityType, "CUSTOMER"),
        eq(accountingSyncMappingsTable.dynastiesEntityId, customerBillingProfileId),
      ),
    )
    .limit(1);

  const adapter = getQuickBooksAdapter(connection.id);

  try {
    let externalId: string;
    let externalData: Record<string, unknown>;

    if (existingMapping?.externalEntityId) {
      const updated = await adapter.updateCustomer(existingMapping.externalEntityId, {
        displayName: customer.customerName,
        email: customer.billingEmail,
      });
      externalId = updated.Id;
      externalData = updated as unknown as Record<string, unknown>;
    } else {
      const existing = await adapter.findCustomerByName(customer.customerName);
      if (existing) {
        externalId = existing.Id;
        externalData = existing as unknown as Record<string, unknown>;
      } else {
        const created = await adapter.createCustomer({
          displayName: customer.customerName,
          email: customer.billingEmail,
          address: customer.billingAddress ?? undefined,
          city: customer.billingCity ?? undefined,
          country: customer.billingCountry ?? undefined,
        });
        externalId = created.Id;
        externalData = created as unknown as Record<string, unknown>;
      }
    }

    if (existingMapping) {
      await db
        .update(accountingSyncMappingsTable)
        .set({
          externalEntityId: externalId,
          syncStatus: "SYNCED",
          lastSyncAt: new Date(),
          lastSyncError: null,
          externalData,
        })
        .where(eq(accountingSyncMappingsTable.id, existingMapping.id));
    } else {
      await db.insert(accountingSyncMappingsTable).values({
        id: generateId("asm"),
        companyId,
        connectionId: connection.id,
        entityType: "CUSTOMER",
        dynastiesEntityId: customerBillingProfileId,
        externalEntityId: externalId,
        syncStatus: "SYNCED",
        syncDirection: "PUSH",
        lastSyncAt: new Date(),
        externalData,
      });
    }

    await db
      .update(accountingConnectionsTable)
      .set({ lastSyncAt: new Date(), lastSyncStatus: "SUCCESS", lastSyncError: null })
      .where(eq(accountingConnectionsTable.id, connection.id));

    await emitAuditEvent({
      companyId,
      eventType: "CUSTOMER_SYNCED",
      entityType: "CUSTOMER_BILLING_PROFILE",
      entityId: customerBillingProfileId,
      userId,
      metadata: { externalId, provider: "QUICKBOOKS", customerName: customer.customerName },
    });

    return { success: true, externalId, customerName: customer.customerName };
  } catch (err: any) {
    if (existingMapping) {
      await db
        .update(accountingSyncMappingsTable)
        .set({ syncStatus: "FAILED", lastSyncError: err.message })
        .where(eq(accountingSyncMappingsTable.id, existingMapping.id));
    } else {
      await db.insert(accountingSyncMappingsTable).values({
        id: generateId("asm"),
        companyId,
        connectionId: connection.id,
        entityType: "CUSTOMER",
        dynastiesEntityId: customerBillingProfileId,
        syncStatus: "FAILED",
        syncDirection: "PUSH",
        lastSyncError: err.message,
      });
    }

    await emitAuditEvent({
      companyId,
      eventType: "ACCOUNTING_SYNC_FAILED",
      entityType: "CUSTOMER_BILLING_PROFILE",
      entityId: customerBillingProfileId,
      userId,
      metadata: { error: err.message, provider: "QUICKBOOKS" },
    });

    throw err;
  }
}

export async function syncInvoice(companyId: string, invoiceId: string, userId: string) {
  const connection = await getOrCreateConnection(companyId);
  if (connection.connectionStatus !== "CONNECTED") throw new Error("QuickBooks not connected");

  const [invoice] = await db
    .select()
    .from(invoicesTable)
    .where(and(eq(invoicesTable.id, invoiceId), eq(invoicesTable.companyId, companyId)))
    .limit(1);

  if (!invoice) throw new Error("Invoice not found");

  if (invoice.customerBillingProfileId) {
    const [custMapping] = await db
      .select()
      .from(accountingSyncMappingsTable)
      .where(
        and(
          eq(accountingSyncMappingsTable.connectionId, connection.id),
          eq(accountingSyncMappingsTable.entityType, "CUSTOMER"),
          eq(accountingSyncMappingsTable.dynastiesEntityId, invoice.customerBillingProfileId),
          eq(accountingSyncMappingsTable.syncStatus, "SYNCED"),
        ),
      )
      .limit(1);

    if (!custMapping?.externalEntityId) {
      throw new Error("Customer must be synced to QuickBooks before syncing invoice. Sync the customer first.");
    }
  }

  const [existingMapping] = await db
    .select()
    .from(accountingSyncMappingsTable)
    .where(
      and(
        eq(accountingSyncMappingsTable.connectionId, connection.id),
        eq(accountingSyncMappingsTable.entityType, "INVOICE"),
        eq(accountingSyncMappingsTable.dynastiesEntityId, invoiceId),
      ),
    )
    .limit(1);

  const adapter = getQuickBooksAdapter(connection.id);

  const lineItems = (invoice.lineItems as any[]) || [];
  const qbLineItems = lineItems.map((li: any) => ({
    description: li.description || li.chargeType || "Service",
    amount: Number(li.amount || li.total || 0),
    quantity: Number(li.quantity || 1),
    unitPrice: Number(li.unitPrice || li.amount || 0),
  }));

  if (qbLineItems.length === 0) {
    qbLineItems.push({
      description: "Freight Services",
      amount: Number(invoice.grandTotal),
      quantity: 1,
      unitPrice: Number(invoice.grandTotal),
    });
  }

  let customerRefId = "1";
  if (invoice.customerBillingProfileId) {
    const [custMapping] = await db
      .select()
      .from(accountingSyncMappingsTable)
      .where(
        and(
          eq(accountingSyncMappingsTable.connectionId, connection.id),
          eq(accountingSyncMappingsTable.entityType, "CUSTOMER"),
          eq(accountingSyncMappingsTable.dynastiesEntityId, invoice.customerBillingProfileId),
        ),
      )
      .limit(1);
    if (custMapping?.externalEntityId) customerRefId = custMapping.externalEntityId;
  }

  try {
    let externalId: string;
    let externalData: Record<string, unknown>;

    if (existingMapping?.externalEntityId) {
      const updated = await adapter.updateInvoice(existingMapping.externalEntityId, {
        lineItems: qbLineItems,
        totalAmount: Number(invoice.grandTotal),
        dueDate: invoice.dueDate?.toISOString().slice(0, 10),
      });
      externalId = updated.Id;
      externalData = updated as unknown as Record<string, unknown>;
    } else {
      const created = await adapter.createInvoice({
        customerRefId,
        docNumber: invoice.invoiceNumber,
        lineItems: qbLineItems,
        totalAmount: Number(invoice.grandTotal),
        dueDate: invoice.dueDate?.toISOString().slice(0, 10),
        currency: invoice.currency,
      });
      externalId = created.Id;
      externalData = created as unknown as Record<string, unknown>;
    }

    if (existingMapping) {
      await db
        .update(accountingSyncMappingsTable)
        .set({
          externalEntityId: externalId,
          syncStatus: "SYNCED",
          lastSyncAt: new Date(),
          lastSyncError: null,
          externalData,
        })
        .where(eq(accountingSyncMappingsTable.id, existingMapping.id));
    } else {
      await db.insert(accountingSyncMappingsTable).values({
        id: generateId("asm"),
        companyId,
        connectionId: connection.id,
        entityType: "INVOICE",
        dynastiesEntityId: invoiceId,
        externalEntityId: externalId,
        syncStatus: "SYNCED",
        syncDirection: "PUSH",
        lastSyncAt: new Date(),
        externalData,
      });
    }

    await db
      .update(accountingConnectionsTable)
      .set({ lastSyncAt: new Date(), lastSyncStatus: "SUCCESS", lastSyncError: null })
      .where(eq(accountingConnectionsTable.id, connection.id));

    await emitAuditEvent({
      companyId,
      eventType: "INVOICE_SYNCED",
      entityType: "INVOICE",
      entityId: invoiceId,
      userId,
      metadata: { externalId, provider: "QUICKBOOKS", invoiceNumber: invoice.invoiceNumber },
    });

    return { success: true, externalId, invoiceNumber: invoice.invoiceNumber };
  } catch (err: any) {
    if (existingMapping) {
      await db
        .update(accountingSyncMappingsTable)
        .set({ syncStatus: "FAILED", lastSyncError: err.message })
        .where(eq(accountingSyncMappingsTable.id, existingMapping.id));
    } else {
      await db.insert(accountingSyncMappingsTable).values({
        id: generateId("asm"),
        companyId,
        connectionId: connection.id,
        entityType: "INVOICE",
        dynastiesEntityId: invoiceId,
        syncStatus: "FAILED",
        syncDirection: "PUSH",
        lastSyncError: err.message,
      });
    }

    await emitAuditEvent({
      companyId,
      eventType: "ACCOUNTING_SYNC_FAILED",
      entityType: "INVOICE",
      entityId: invoiceId,
      userId,
      metadata: { error: err.message, provider: "QUICKBOOKS" },
    });

    throw err;
  }
}

export async function refreshPaymentStatus(companyId: string, invoiceId: string, userId: string) {
  const connection = await getOrCreateConnection(companyId);
  if (connection.connectionStatus !== "CONNECTED") throw new Error("QuickBooks not connected");

  const [mapping] = await db
    .select()
    .from(accountingSyncMappingsTable)
    .where(
      and(
        eq(accountingSyncMappingsTable.connectionId, connection.id),
        eq(accountingSyncMappingsTable.entityType, "INVOICE"),
        eq(accountingSyncMappingsTable.dynastiesEntityId, invoiceId),
        eq(accountingSyncMappingsTable.syncStatus, "SYNCED"),
      ),
    )
    .limit(1);

  if (!mapping?.externalEntityId) throw new Error("Invoice not synced to QuickBooks yet");

  const adapter = getQuickBooksAdapter(connection.id);
  const qbInvoice = await adapter.getInvoice(mapping.externalEntityId);
  if (!qbInvoice) throw new Error("Invoice not found in QuickBooks");

  const payments = await adapter.getPaymentsForInvoice(mapping.externalEntityId);

  const totalPaid = qbInvoice.TotalAmt - qbInvoice.Balance;
  const outstandingBalance = qbInvoice.Balance;
  const isFullyPaid = outstandingBalance <= 0;
  const isPartiallyPaid = totalPaid > 0 && !isFullyPaid;

  const updateData: Record<string, unknown> = {};
  if (isFullyPaid) {
    updateData.status = "PAID";
    const lastPayment = payments.length > 0 ? payments[payments.length - 1] : null;
    updateData.paidAt = lastPayment?.TxnDate ? new Date(lastPayment.TxnDate) : new Date();
  } else if (isPartiallyPaid) {
    updateData.status = "PARTIALLY_PAID";
  }

  if (Object.keys(updateData).length > 0) {
    await db
      .update(invoicesTable)
      .set(updateData)
      .where(eq(invoicesTable.id, invoiceId));
  }

  const [receivable] = await db
    .select()
    .from(receivablesTable)
    .where(eq(receivablesTable.invoiceId, invoiceId))
    .limit(1);

  if (receivable) {
    const recUpdate: Record<string, unknown> = {
      outstandingAmount: String(outstandingBalance),
    };
    if (isFullyPaid) {
      recUpdate.collectionsStatus = "CURRENT";
      recUpdate.settlementStatus = "SETTLED";
    } else if (isPartiallyPaid) {
      recUpdate.settlementStatus = "PARTIALLY_SETTLED";
    }
    await db
      .update(receivablesTable)
      .set(recUpdate)
      .where(eq(receivablesTable.id, receivable.id));
  }

  await db
    .update(accountingSyncMappingsTable)
    .set({
      lastSyncAt: new Date(),
      externalData: qbInvoice as unknown as Record<string, unknown>,
    })
    .where(eq(accountingSyncMappingsTable.id, mapping.id));

  await db
    .update(accountingConnectionsTable)
    .set({ lastSyncAt: new Date(), lastSyncStatus: "SUCCESS" })
    .where(eq(accountingConnectionsTable.id, connection.id));

  await emitAuditEvent({
    companyId,
    eventType: "PAYMENT_STATUS_REFRESHED",
    entityType: "INVOICE",
    entityId: invoiceId,
    userId,
    metadata: {
      provider: "QUICKBOOKS",
      totalAmount: qbInvoice.TotalAmt,
      balance: qbInvoice.Balance,
      totalPaid,
      paymentsCount: payments.length,
      invoiceStatus: isFullyPaid ? "PAID" : isPartiallyPaid ? "PARTIALLY_PAID" : "OUTSTANDING",
    },
  });

  return {
    success: true,
    totalAmount: qbInvoice.TotalAmt,
    balance: outstandingBalance,
    totalPaid,
    paymentsCount: payments.length,
    status: isFullyPaid ? "PAID" : isPartiallyPaid ? "PARTIALLY_PAID" : "OUTSTANDING",
    payments: payments.map((p) => ({
      id: p.Id,
      amount: p.TotalAmt,
      date: p.TxnDate,
    })),
  };
}

export async function getConnectionStatus(companyId: string) {
  const connection = await getOrCreateConnection(companyId);

  const [customerStats] = await db
    .select({ cnt: sql<number>`count(*)` })
    .from(accountingSyncMappingsTable)
    .where(
      and(
        eq(accountingSyncMappingsTable.connectionId, connection.id),
        eq(accountingSyncMappingsTable.entityType, "CUSTOMER"),
      ),
    );

  const [syncedCustomers] = await db
    .select({ cnt: sql<number>`count(*)` })
    .from(accountingSyncMappingsTable)
    .where(
      and(
        eq(accountingSyncMappingsTable.connectionId, connection.id),
        eq(accountingSyncMappingsTable.entityType, "CUSTOMER"),
        eq(accountingSyncMappingsTable.syncStatus, "SYNCED"),
      ),
    );

  const [invoiceStats] = await db
    .select({ cnt: sql<number>`count(*)` })
    .from(accountingSyncMappingsTable)
    .where(
      and(
        eq(accountingSyncMappingsTable.connectionId, connection.id),
        eq(accountingSyncMappingsTable.entityType, "INVOICE"),
      ),
    );

  const [syncedInvoices] = await db
    .select({ cnt: sql<number>`count(*)` })
    .from(accountingSyncMappingsTable)
    .where(
      and(
        eq(accountingSyncMappingsTable.connectionId, connection.id),
        eq(accountingSyncMappingsTable.entityType, "INVOICE"),
        eq(accountingSyncMappingsTable.syncStatus, "SYNCED"),
      ),
    );

  const [totalCustomers] = await db
    .select({ cnt: sql<number>`count(*)` })
    .from(customerBillingProfilesTable)
    .where(eq(customerBillingProfilesTable.companyId, companyId));

  const [totalInvoices] = await db
    .select({ cnt: sql<number>`count(*)` })
    .from(invoicesTable)
    .where(eq(invoicesTable.companyId, companyId));

  return {
    connection: {
      id: connection.id,
      provider: connection.provider,
      status: connection.connectionStatus,
      realmId: connection.realmId,
      companyName: connection.companyName,
      lastSyncAt: connection.lastSyncAt,
      lastSyncStatus: connection.lastSyncStatus,
      lastSyncError: connection.lastSyncError,
    },
    stats: {
      totalCustomers: Number(totalCustomers?.cnt ?? 0),
      mappedCustomers: Number(customerStats?.cnt ?? 0),
      syncedCustomers: Number(syncedCustomers?.cnt ?? 0),
      totalInvoices: Number(totalInvoices?.cnt ?? 0),
      mappedInvoices: Number(invoiceStats?.cnt ?? 0),
      syncedInvoices: Number(syncedInvoices?.cnt ?? 0),
    },
  };
}

export async function getSyncMappings(companyId: string, entityType?: string) {
  const connection = await getOrCreateConnection(companyId);
  const conditions = [eq(accountingSyncMappingsTable.connectionId, connection.id)];
  if (entityType) conditions.push(eq(accountingSyncMappingsTable.entityType, entityType as any));

  return db
    .select()
    .from(accountingSyncMappingsTable)
    .where(and(...conditions))
    .orderBy(accountingSyncMappingsTable.createdAt);
}

export async function getInvoiceSyncStatus(companyId: string, invoiceId: string) {
  const connection = await getOrCreateConnection(companyId);
  const [mapping] = await db
    .select()
    .from(accountingSyncMappingsTable)
    .where(
      and(
        eq(accountingSyncMappingsTable.connectionId, connection.id),
        eq(accountingSyncMappingsTable.entityType, "INVOICE"),
        eq(accountingSyncMappingsTable.dynastiesEntityId, invoiceId),
      ),
    )
    .limit(1);

  return {
    connected: connection.connectionStatus === "CONNECTED",
    synced: mapping?.syncStatus === "SYNCED",
    syncStatus: mapping?.syncStatus ?? null,
    externalId: mapping?.externalEntityId ?? null,
    lastSyncAt: mapping?.lastSyncAt ?? null,
    lastSyncError: mapping?.lastSyncError ?? null,
    provider: connection.provider,
  };
}

export async function simulateDemoPayment(companyId: string, invoiceId: string) {
  const connection = await getOrCreateConnection(companyId);
  const [mapping] = await db
    .select()
    .from(accountingSyncMappingsTable)
    .where(
      and(
        eq(accountingSyncMappingsTable.connectionId, connection.id),
        eq(accountingSyncMappingsTable.entityType, "INVOICE"),
        eq(accountingSyncMappingsTable.dynastiesEntityId, invoiceId),
        eq(accountingSyncMappingsTable.syncStatus, "SYNCED"),
      ),
    )
    .limit(1);

  if (!mapping?.externalEntityId) throw new Error("Invoice not synced");

  const demoAdapter = getDemoAdapter(connection.id);
  const invoice = await demoAdapter.getInvoice(mapping.externalEntityId);
  if (!invoice) throw new Error("QB invoice not found");

  demoAdapter.simulatePayment(mapping.externalEntityId, invoice.TotalAmt);
  return { success: true, paymentAmount: invoice.TotalAmt };
}
