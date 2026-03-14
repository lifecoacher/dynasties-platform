import { db } from "@workspace/db";
import {
  insuranceQuotesTable,
  eventsTable,
  shipmentsTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import { calculateInsuranceQuote } from "./calculator.js";
import { runInsuranceAgent } from "./agent.js";
import { validateInsuranceOutput } from "./validator.js";

export interface InsuranceResult {
  quoteId: string | null;
  coverageType: string;
  estimatedPremium: number;
  estimatedInsuredValue: number;
  success: boolean;
  error: string | null;
}

export async function runInsuranceQuoteGeneration(
  shipmentId: string,
  companyId: string,
): Promise<InsuranceResult> {
  console.log(`[insurance] starting quote for shipment=${shipmentId}`);

  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(eq(shipmentsTable.id, shipmentId))
    .limit(1);

  if (!shipment || shipment.companyId !== companyId) {
    return {
      quoteId: null,
      coverageType: "",
      estimatedPremium: 0,
      estimatedInsuredValue: 0,
      success: false,
      error: "Shipment not found or company mismatch",
    };
  }

  const existing = await db
    .select({ id: insuranceQuotesTable.id })
    .from(insuranceQuotesTable)
    .where(eq(insuranceQuotesTable.shipmentId, shipmentId))
    .limit(1);

  if (existing.length > 0) {
    console.log(`[insurance] quote already exists for shipment=${shipmentId}, skipping`);
    return {
      quoteId: existing[0]!.id,
      coverageType: "",
      estimatedPremium: 0,
      estimatedInsuredValue: 0,
      success: true,
      error: null,
    };
  }

  const calculation = calculateInsuranceQuote(shipment);

  let coverageRationale = `${calculation.coverageType} coverage recommended based on cargo value of ${calculation.currency} ${calculation.estimatedInsuredValue.toLocaleString()}.`;
  let exclusions: string[] = [
    "War and strikes (unless separately covered)",
    "Inherent vice or nature of goods",
    "Delay-related losses",
  ];

  try {
    const agentOutput = await runInsuranceAgent({
      calculation,
      commodity: shipment.commodity,
      hsCode: shipment.hsCode,
      portOfLoading: shipment.portOfLoading,
      portOfDischarge: shipment.portOfDischarge,
      grossWeight: shipment.grossWeight,
      volume: shipment.volume,
      incoterms: shipment.incoterms,
    });

    const validation = validateInsuranceOutput(agentOutput.raw);

    if (validation.valid && validation.data) {
      coverageRationale = validation.data.coverageRationale;
      exclusions = validation.data.exclusions;
    } else {
      console.log(`[insurance] agent validation failed: ${validation.errors.join("; ")}`);
    }
  } catch (err) {
    console.error("[insurance] agent error, using deterministic rationale:", err);
  }

  const quoteId = generateId();

  await db.insert(insuranceQuotesTable).values({
    id: quoteId,
    companyId,
    shipmentId,
    coverageType: calculation.coverageType,
    estimatedInsuredValue: calculation.estimatedInsuredValue,
    estimatedPremium: calculation.estimatedPremium,
    currency: calculation.currency,
    coverageRationale,
    exclusions,
    confidenceScore: calculation.confidenceScore,
    quotedAt: new Date(),
  });

  await db.insert(eventsTable).values({
    id: generateId(),
    companyId,
    eventType: "INSURANCE_QUOTED",
    entityType: "shipment",
    entityId: shipmentId,
    serviceId: "insurance",
    metadata: {
      quoteId,
      coverageType: calculation.coverageType,
      estimatedInsuredValue: calculation.estimatedInsuredValue,
      estimatedPremium: calculation.estimatedPremium,
      currency: calculation.currency,
      confidenceScore: calculation.confidenceScore,
    },
  });

  console.log(
    `[insurance] quote complete: shipment=${shipmentId} coverage=${calculation.coverageType} premium=${calculation.currency} ${calculation.estimatedPremium} value=${calculation.estimatedInsuredValue}`,
  );

  return {
    quoteId,
    coverageType: calculation.coverageType,
    estimatedPremium: calculation.estimatedPremium,
    estimatedInsuredValue: calculation.estimatedInsuredValue,
    success: true,
    error: null,
  };
}
