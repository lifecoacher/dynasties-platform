import { db, type DbTransaction } from "@workspace/db";
import {
  entitiesTable,
  shipmentsTable,
  invoicesTable,
  invoiceLineItemsTable,
  customerBillingProfilesTable,
  billingAccountsTable,
  eventsTable,
} from "@workspace/db/schema";
import { generateId } from "@workspace/shared-utils";
import { eq, and } from "drizzle-orm";
import type { NormalizedEntity, NormalizationOutput } from "./normalizer.js";
import type { ImportResults } from "@workspace/db/schema";

export async function importData(
  companyId: string,
  normOutput: NormalizationOutput,
): Promise<ImportResults> {
  const errors: string[] = [];
  let customersCreated = 0;
  let shipmentsCreated = 0;
  let invoicesCreated = 0;
  let lineItemsCreated = 0;
  let totalRevenue = 0;

  const customerIdMap = new Map<string, string>();
  const shipmentIdMap = new Map<string, string>();
  const invoiceIdMap = new Map<string, string>();
  let billingAccountId: string | null = null;

  try {
    const [existingAccount] = await db
      .select({ id: billingAccountsTable.id })
      .from(billingAccountsTable)
      .where(eq(billingAccountsTable.companyId, companyId))
      .limit(1);

    if (existingAccount) {
      billingAccountId = existingAccount.id;
    } else {
      billingAccountId = generateId("ba");
      await db.insert(billingAccountsTable).values({
        id: billingAccountId,
        companyId,
        legalEntityName: "Imported Account",
        billingEmail: "billing@imported.local",
        currency: "USD",
      });
    }
  } catch (err: any) {
    console.error("[importer] Failed to setup billing account:", err.message);
    errors.push(`Billing account setup failed: ${err.message}`);
  }

  const customers = normOutput.entities.filter((e) => e.type === "customer");
  for (const entity of customers) {
    try {
      const id = generateId("ent");
      const normalizedName = (entity.data.name as string).toLowerCase().trim().replace(/[^a-z0-9\s]/g, "");

      const [existing] = await db
        .select({ id: entitiesTable.id })
        .from(entitiesTable)
        .where(
          and(
            eq(entitiesTable.companyId, companyId),
            eq(entitiesTable.normalizedName, normalizedName),
          ),
        )
        .limit(1);

      if (existing) {
        customerIdMap.set(entity.data.name.toLowerCase().trim(), existing.id);
        continue;
      }

      await db.insert(entitiesTable).values({
        id,
        companyId,
        name: entity.data.name,
        normalizedName,
        entityType: "CUSTOMER",
        status: "VERIFIED",
        contactEmail: entity.data.email || null,
        contactPhone: entity.data.phone || null,
        address: entity.data.address || null,
        metadata: {
          importedFrom: entity.sourceFile,
          contactName: entity.data.contactName,
          taxId: entity.data.taxId,
          accountNumber: entity.data.accountNumber,
        },
      });

      if (billingAccountId) {
        const profileId = generateId("cbp");
        await db.insert(customerBillingProfilesTable).values({
          id: profileId,
          companyId,
          billingAccountId,
          entityId: id,
          customerName: entity.data.name,
          billingEmail: entity.data.email || `${normalizedName.replace(/\s/g, ".")}@imported.local`,
          paymentTerms: "NET_30",
          status: "ACTIVE",
        });
      }

      customerIdMap.set(entity.data.name.toLowerCase().trim(), id);
      customersCreated++;
    } catch (err: any) {
      errors.push(`Customer "${entity.data.name}" import failed: ${err.message}`);
    }
  }

  const shipments = normOutput.entities.filter((e) => e.type === "shipment");
  for (const entity of shipments) {
    try {
      const id = generateId("shp");
      const reference = entity.data.reference as string;

      const [existing] = await db
        .select({ id: shipmentsTable.id })
        .from(shipmentsTable)
        .where(
          and(
            eq(shipmentsTable.companyId, companyId),
            eq(shipmentsTable.reference, reference),
          ),
        )
        .limit(1);

      if (existing) {
        shipmentIdMap.set(reference, existing.id);
        continue;
      }

      const customerName = entity.data._customerName as string | null;
      let shipperId: string | null = null;
      if (customerName) {
        shipperId = customerIdMap.get(customerName.toLowerCase().trim()) || null;
      }

      await db.insert(shipmentsTable).values({
        id,
        companyId,
        reference,
        status: "DRAFT",
        shipperId,
        portOfLoading: entity.data.portOfLoading || null,
        portOfDischarge: entity.data.portOfDischarge || null,
        vessel: entity.data.vessel || null,
        voyage: entity.data.voyage || null,
        bookingNumber: entity.data.bookingNumber || null,
        blNumber: entity.data.blNumber || null,
        commodity: entity.data.commodity || null,
        hsCode: entity.data.hsCode || null,
        incoterms: entity.data.incoterms || null,
        packageCount: entity.data.packageCount || null,
        grossWeight: entity.data.grossWeight || null,
        weightUnit: entity.data.weightUnit || null,
        volume: entity.data.volume || null,
        volumeUnit: entity.data.volumeUnit || null,
      });

      shipmentIdMap.set(reference, id);
      shipmentsCreated++;
    } catch (err: any) {
      errors.push(`Shipment "${entity.data.reference}" import failed: ${err.message}`);
    }
  }

  const invoices = normOutput.entities.filter((e) => e.type === "invoice");
  for (const entity of invoices) {
    try {
      const id = generateId("inv");
      const invoiceNumber = entity.data.invoiceNumber as string;

      const [existing] = await db
        .select({ id: invoicesTable.id })
        .from(invoicesTable)
        .where(
          and(
            eq(invoicesTable.companyId, companyId),
            eq(invoicesTable.invoiceNumber, invoiceNumber),
          ),
        )
        .limit(1);

      if (existing) {
        invoiceIdMap.set(invoiceNumber, existing.id);
        continue;
      }

      let shipmentId: string | null = null;
      const shipRef = entity.data._shipmentReference as string | null;
      if (shipRef) {
        shipmentId = shipmentIdMap.get(shipRef) || null;
      }

      let customerProfileId: string | null = null;
      const custName = entity.data._customerName as string | null;
      if (custName) {
        const entityId = customerIdMap.get(custName.toLowerCase().trim());
        if (entityId) {
          const [profile] = await db
            .select({ id: customerBillingProfilesTable.id })
            .from(customerBillingProfilesTable)
            .where(
              and(
                eq(customerBillingProfilesTable.companyId, companyId),
                eq(customerBillingProfilesTable.entityId, entityId),
              ),
            )
            .limit(1);
          if (profile) customerProfileId = profile.id;
        }
      }

      await db.insert(invoicesTable).values({
        id,
        companyId,
        invoiceNumber,
        shipmentId,
        customerBillingProfileId: customerProfileId,
        status: "DRAFT",
        issuedAt: entity.data.issueDate ? new Date(entity.data.issueDate) : new Date(),
        dueDate: entity.data.dueDate ? new Date(entity.data.dueDate) : null,
        subtotal: String(entity.data.subtotal || 0),
        taxTotal: String(entity.data.tax || 0),
        grandTotal: String(entity.data.grandTotal || 0),
        currency: entity.data.currency || "USD",
        lineItems: [],
      });

      invoiceIdMap.set(invoiceNumber, id);
      totalRevenue += entity.data.grandTotal || 0;
      invoicesCreated++;
    } catch (err: any) {
      errors.push(`Invoice "${entity.data.invoiceNumber}" import failed: ${err.message}`);
    }
  }

  const lineItems = normOutput.entities.filter((e) => e.type === "line_item");
  for (const entity of lineItems) {
    try {
      const invNum = entity.data._invoiceNumber as string | null;
      const invoiceId = invNum ? invoiceIdMap.get(invNum) : null;
      if (!invoiceId) {
        errors.push(`Line item skipped: no matching invoice for "${invNum}"`);
        continue;
      }

      await db.insert(invoiceLineItemsTable).values({
        id: generateId("ili"),
        invoiceId,
        lineType: entity.data.lineType || "FEE",
        description: entity.data.description || "Imported line item",
        quantity: entity.data.quantity || 1,
        unitPrice: String(entity.data.unitPrice || 0),
        amount: String(entity.data.amount || 0),
      });

      lineItemsCreated++;
    } catch (err: any) {
      errors.push(`Line item import failed: ${err.message}`);
    }
  }

  await db.insert(eventsTable).values({
    id: generateId("evt"),
    companyId,
    entityType: "COMPANY",
    entityId: companyId,
    eventType: "DATA_MIGRATION_COMPLETED",
    actorType: "SYSTEM",
    serviceId: "migration-engine",
    metadata: {
      customersCreated,
      shipmentsCreated,
      invoicesCreated,
      lineItemsCreated,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      errorCount: errors.length,
    },
  });

  return {
    customersCreated,
    shipmentsCreated,
    invoicesCreated,
    lineItemsCreated,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    errors,
    completedAt: new Date().toISOString(),
  };
}
