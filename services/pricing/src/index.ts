import { db } from "@workspace/db";
import {
  shipmentsTable,
  shipmentChargesTable,
  rateTablesTable,
  eventsTable,
  entitiesTable,
  insuranceQuotesTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import { publishDocGenJob } from "@workspace/queue";
import { runPricingAgent } from "./agent.js";
import { validatePricingOutput, type ValidatedAgentCharge } from "./validator.js";

export interface PricingResult {
  chargeCount: number;
  totalAmount: number;
  currency: string;
  success: boolean;
  error: string | null;
}

interface ChargeToInsert {
  chargeCode: string;
  description: string;
  chargeType: "FREIGHT" | "ORIGIN" | "DESTINATION" | "DOCUMENTATION" | "INSURANCE" | "CUSTOMS" | "SURCHARGE" | "OTHER";
  quantity: number;
  unitPrice: number;
  currency: string;
  totalAmount: number;
  source: "RATE_TABLE" | "RULE_ENGINE" | "AGENT" | "MANUAL";
  rateTableId?: string;
}

const STANDARD_CHARGES: Array<{
  chargeCode: string;
  description: string;
  chargeType: ChargeToInsert["chargeType"];
  getAmount: (shipment: Record<string, unknown>) => { quantity: number; unitPrice: number } | null;
}> = [
  {
    chargeCode: "DOC",
    description: "Documentation Fee",
    chargeType: "DOCUMENTATION",
    getAmount: () => ({ quantity: 1, unitPrice: 75 }),
  },
  {
    chargeCode: "AMS",
    description: "AMS Filing Fee",
    chargeType: "CUSTOMS",
    getAmount: () => ({ quantity: 1, unitPrice: 35 }),
  },
  {
    chargeCode: "ISF",
    description: "ISF Filing Fee",
    chargeType: "CUSTOMS",
    getAmount: () => ({ quantity: 1, unitPrice: 50 }),
  },
  {
    chargeCode: "THC-O",
    description: "Terminal Handling - Origin",
    chargeType: "ORIGIN",
    getAmount: (s) => {
      const weight = (s.grossWeight as number) || 0;
      if (weight <= 0) return null;
      return { quantity: 1, unitPrice: Math.max(150, weight * 0.012) };
    },
  },
  {
    chargeCode: "THC-D",
    description: "Terminal Handling - Destination",
    chargeType: "DESTINATION",
    getAmount: (s) => {
      const weight = (s.grossWeight as number) || 0;
      if (weight <= 0) return null;
      return { quantity: 1, unitPrice: Math.max(150, weight * 0.015) };
    },
  },
];

export async function runPricing(
  shipmentId: string,
  companyId: string,
): Promise<PricingResult> {
  console.log(`[pricing] starting charge calculation for shipment=${shipmentId}`);

  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(eq(shipmentsTable.id, shipmentId))
    .limit(1);

  if (!shipment || shipment.companyId !== companyId) {
    return { chargeCount: 0, totalAmount: 0, currency: "USD", success: false, error: "Shipment not found or company mismatch" };
  }

  const existingCharges = await db
    .select({ id: shipmentChargesTable.id })
    .from(shipmentChargesTable)
    .where(eq(shipmentChargesTable.shipmentId, shipmentId))
    .limit(1);

  if (existingCharges.length > 0) {
    console.log(`[pricing] charges already exist for shipment=${shipmentId}, skipping but dispatching docgen`);
    publishDocGenJob({ companyId, shipmentId, trigger: "charges_calculated" });
    return { chargeCount: existingCharges.length, totalAmount: 0, currency: "USD", success: true, error: null };
  }

  const charges: ChargeToInsert[] = [];

  const rateTableEntries = await db
    .select()
    .from(rateTablesTable)
    .where(eq(rateTablesTable.companyId, companyId));

  const matchingRates = rateTableEntries.filter((rate) => {
    const originMatch = (shipment.portOfLoading || "").toLowerCase().includes(rate.origin.toLowerCase());
    const destMatch = (shipment.portOfDischarge || "").toLowerCase().includes(rate.destination.toLowerCase());
    const now = new Date();
    const validFrom = rate.validFrom ? new Date(rate.validFrom) <= now : true;
    const validTo = rate.validTo ? new Date(rate.validTo) >= now : true;
    return originMatch && destMatch && validFrom && validTo;
  });

  for (const rate of matchingRates) {
    charges.push({
      chargeCode: rate.chargeCode,
      description: rate.description,
      chargeType: "FREIGHT",
      quantity: 1,
      unitPrice: rate.unitPrice,
      currency: rate.currency,
      totalAmount: rate.unitPrice,
      source: "RATE_TABLE",
      rateTableId: rate.id,
    });
  }

  if (!matchingRates.some((r) => r.chargeCode === "FRT")) {
    const volume = (shipment.volume as number) || 0;
    const weight = (shipment.grossWeight as number) || 0;
    const cbm = volume > 0 ? volume : weight / 1000;
    const freightRate = Math.max(cbm * 45, 250);

    charges.push({
      chargeCode: "FRT",
      description: "Ocean Freight",
      chargeType: "FREIGHT",
      quantity: 1,
      unitPrice: freightRate,
      currency: "USD",
      totalAmount: freightRate,
      source: "RULE_ENGINE",
    });
  }

  for (const stdCharge of STANDARD_CHARGES) {
    if (charges.some((c) => c.chargeCode === stdCharge.chargeCode)) continue;
    const amount = stdCharge.getAmount(shipment as unknown as Record<string, unknown>);
    if (amount) {
      charges.push({
        chargeCode: stdCharge.chargeCode,
        description: stdCharge.description,
        chargeType: stdCharge.chargeType,
        quantity: amount.quantity,
        unitPrice: amount.unitPrice,
        currency: "USD",
        totalAmount: amount.quantity * amount.unitPrice,
        source: "RULE_ENGINE",
      });
    }
  }

  const [insuranceQuote] = await db
    .select()
    .from(insuranceQuotesTable)
    .where(eq(insuranceQuotesTable.shipmentId, shipmentId))
    .limit(1);

  if (insuranceQuote && insuranceQuote.estimatedPremium > 0) {
    charges.push({
      chargeCode: "INS",
      description: `Cargo Insurance - ${insuranceQuote.coverageType}`,
      chargeType: "INSURANCE",
      quantity: 1,
      unitPrice: insuranceQuote.estimatedPremium,
      currency: insuranceQuote.currency || "USD",
      totalAmount: insuranceQuote.estimatedPremium,
      source: "RULE_ENGINE",
    });
  }

  let agentUsed = false;
  try {
    const shipper = shipment.shipperId
      ? (await db.select().from(entitiesTable).where(eq(entitiesTable.id, shipment.shipperId)).limit(1))[0]
      : null;
    const consignee = shipment.consigneeId
      ? (await db.select().from(entitiesTable).where(eq(entitiesTable.id, shipment.consigneeId)).limit(1))[0]
      : null;

    const context = [
      `Commodity: ${shipment.commodity || "Unknown"}`,
      `HS Code: ${shipment.hsCode || "Unknown"}`,
      `Origin: ${shipment.portOfLoading || "Unknown"}`,
      `Destination: ${shipment.portOfDischarge || "Unknown"}`,
      `Weight: ${shipment.grossWeight || 0} ${shipment.weightUnit || "KG"}`,
      `Volume: ${shipment.volume || 0} ${shipment.volumeUnit || "CBM"}`,
      `Packages: ${shipment.packageCount || 0}`,
      `Incoterms: ${shipment.incoterms || "Unknown"}`,
      `Shipper: ${shipper?.name || "Unknown"}`,
      `Consignee: ${consignee?.name || "Unknown"}`,
      `Existing charges: ${charges.map((c) => `${c.chargeCode}: $${c.totalAmount}`).join(", ")}`,
    ].join("\n");

    const agentResult = await runPricingAgent(context);
    const validation = validatePricingOutput(agentResult.raw);

    if (validation.valid && validation.data.charges.length > 0) {
      for (const ac of validation.data.charges) {
        if (charges.some((c) => c.chargeCode === ac.chargeCode)) continue;
        charges.push({
          chargeCode: ac.chargeCode,
          description: ac.description,
          chargeType: ac.chargeType as ChargeToInsert["chargeType"],
          quantity: ac.quantity,
          unitPrice: ac.unitPrice,
          currency: ac.currency,
          totalAmount: ac.quantity * ac.unitPrice,
          source: "AGENT",
        });
      }
      agentUsed = true;
    } else if (!validation.valid) {
      console.log(`[pricing] agent output validation failed: ${validation.errors.join("; ")}`);
    }
  } catch (err) {
    console.error("[pricing] agent failed, using deterministic charges only:", err);
  }

  let totalAmount = 0;
  for (const charge of charges) {
    const id = generateId();
    await db.insert(shipmentChargesTable).values({
      id,
      companyId,
      shipmentId,
      chargeCode: charge.chargeCode,
      description: charge.description,
      chargeType: charge.chargeType,
      quantity: charge.quantity,
      unitPrice: charge.unitPrice,
      currency: charge.currency,
      totalAmount: charge.totalAmount,
      taxRate: 0,
      taxAmount: 0,
      source: charge.source,
      rateTableId: charge.rateTableId || null,
      metadata: null,
    });
    totalAmount += charge.totalAmount;
  }

  await db.insert(eventsTable).values({
    actorType: "SERVICE",
    id: generateId(),
    companyId,
    eventType: "CHARGES_CALCULATED" as string,
    entityType: "shipment",
    entityId: shipmentId,
    serviceId: "pricing",
    metadata: {
      chargeCount: charges.length,
      totalAmount,
      currency: "USD",
      agentUsed,
      chargeCodes: charges.map((c) => c.chargeCode),
    },
  });

  publishDocGenJob({ companyId, shipmentId, trigger: "charges_calculated" });

  console.log(
    `[pricing] complete: shipment=${shipmentId} charges=${charges.length} total=$${totalAmount.toFixed(2)} agent=${agentUsed}`,
  );

  return {
    chargeCount: charges.length,
    totalAmount,
    currency: "USD",
    success: true,
    error: null,
  };
}
