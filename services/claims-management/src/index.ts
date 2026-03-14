import { db } from "@workspace/db";
import {
  shipmentsTable,
  claimsTable,
  claimCommunicationsTable,
  insuranceQuotesTable,
  shipmentDocumentsTable,
  ingestedDocumentsTable,
  entitiesTable,
  eventsTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import { runClaimsAgent } from "./agent.js";
import { validateClaimsOutput } from "./validator.js";

export interface ClaimsResult {
  claimId: string | null;
  claimNumber: string | null;
  success: boolean;
  error: string | null;
}

function generateClaimNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const seq = Math.floor(Math.random() * 9000) + 1000;
  return `CLM-${y}${m}${d}-${seq}`;
}

export async function runClaimPreparation(
  shipmentId: string,
  companyId: string,
  claimType: string,
  incidentDescription: string,
): Promise<ClaimsResult> {
  console.log(`[claims] starting claim preparation for shipment=${shipmentId}`);

  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(eq(shipmentsTable.id, shipmentId))
    .limit(1);

  if (!shipment || shipment.companyId !== companyId) {
    return { claimId: null, claimNumber: null, success: false, error: "Shipment not found" };
  }

  const [insuranceQuote] = await db
    .select()
    .from(insuranceQuotesTable)
    .where(eq(insuranceQuotesTable.shipmentId, shipmentId))
    .limit(1);

  const shipper = shipment.shipperId
    ? (await db.select().from(entitiesTable).where(eq(entitiesTable.id, shipment.shipperId)).limit(1))[0]
    : null;
  const consignee = shipment.consigneeId
    ? (await db.select().from(entitiesTable).where(eq(entitiesTable.id, shipment.consigneeId)).limit(1))[0]
    : null;

  const docs = await db
    .select()
    .from(shipmentDocumentsTable)
    .where(eq(shipmentDocumentsTable.shipmentId, shipmentId));

  const docDetails = await Promise.all(
    docs.filter((d) => d.documentId).map(async (d) => {
      const [doc] = await db
        .select()
        .from(ingestedDocumentsTable)
        .where(eq(ingestedDocumentsTable.id, d.documentId!))
        .limit(1);
      return { type: d.documentType, fileName: doc?.fileName || "unknown", status: doc?.extractionStatus || "UNKNOWN" };
    }),
  );

  const context = [
    `Shipment Reference: ${shipment.reference}`,
    `Route: ${shipment.portOfLoading} → ${shipment.portOfDischarge}`,
    `Vessel: ${shipment.vessel || "Unknown"} / ${shipment.voyage || "Unknown"}`,
    `Commodity: ${shipment.commodity || "Unknown"}`,
    `HS Code: ${shipment.hsCode || "Unknown"}`,
    `Weight: ${shipment.grossWeight || "Unknown"} ${shipment.weightUnit || "KG"}`,
    `Incoterms: ${shipment.incoterms || "Unknown"}`,
    `Shipper: ${shipper?.name || "Unknown"}`,
    `Consignee: ${consignee?.name || "Unknown"}`,
    ``,
    `Insurance Coverage: ${insuranceQuote ? `${insuranceQuote.coverageType}, Premium: $${insuranceQuote.estimatedPremium}` : "No insurance quote on file"}`,
    `Cargo Value Estimate: $${insuranceQuote?.cargoValue || "Unknown"}`,
    ``,
    `Claim Type: ${claimType}`,
    `Incident Description: ${incidentDescription}`,
    ``,
    `Available Documents: ${docDetails.map((d) => `${d.type} (${d.fileName})`).join(", ") || "None"}`,
  ].join("\n");

  let claimNarrative: string | null = null;
  let requiredDocuments: unknown = null;
  let coverageAnalysis: unknown = null;
  let submissionRecommendation: string | null = null;
  let estimatedLoss: number | null = null;

  try {
    const agentResult = await runClaimsAgent(context);
    const validation = validateClaimsOutput(agentResult.raw);

    if (validation.valid && validation.data) {
      claimNarrative = validation.data.claimNarrative;
      requiredDocuments = validation.data.requiredDocuments;
      coverageAnalysis = validation.data.coverageAnalysis;
      submissionRecommendation = validation.data.submissionRecommendation;
      estimatedLoss = validation.data.lossEstimate.amount;
    } else {
      console.log(`[claims] agent validation failed: ${validation.errors.join("; ")}`);
      submissionRecommendation = "GATHER_MORE_EVIDENCE";
    }
  } catch (err) {
    console.error("[claims] agent failed:", err);
    submissionRecommendation = "GATHER_MORE_EVIDENCE";
  }

  const claimNumber = generateClaimNumber();
  const claimId = generateId();

  await db.insert(claimsTable).values({
    id: claimId,
    companyId,
    shipmentId,
    claimNumber,
    status: "DRAFT",
    claimType: claimType as "CARGO_DAMAGE" | "CARGO_LOSS" | "DELAY" | "SHORTAGE" | "CONTAMINATION" | "OTHER",
    incidentDate: new Date(),
    incidentDescription,
    estimatedLoss,
    currency: "USD",
    claimNarrative,
    requiredDocuments,
    coverageAnalysis,
    submissionRecommendation,
    evidenceKeys: docDetails.map((d) => d.fileName),
    filedBy: "system",
    filedAt: new Date(),
    metadata: null,
  });

  await db.insert(claimCommunicationsTable).values({
    id: generateId(),
    companyId,
    claimId,
    direction: "INTERNAL",
    communicationType: "NOTE",
    subject: "Claim package prepared",
    body: `Draft claim ${claimNumber} prepared for shipment ${shipment.reference}. Type: ${claimType}. Recommendation: ${submissionRecommendation || "Pending review"}.`,
    author: "claims-management",
    metadata: null,
  });

  await db.insert(eventsTable).values({
    id: generateId(),
    companyId,
    eventType: "CLAIM_CREATED" as string,
    entityType: "shipment",
    entityId: shipmentId,
    serviceId: "claims-management",
    metadata: {
      claimId,
      claimNumber,
      claimType,
      estimatedLoss,
      submissionRecommendation,
    },
  });

  console.log(
    `[claims] complete: shipment=${shipmentId} claim=${claimNumber} type=${claimType} loss=$${estimatedLoss || "TBD"} recommendation=${submissionRecommendation}`,
  );

  return {
    claimId,
    claimNumber,
    success: true,
    error: null,
  };
}
