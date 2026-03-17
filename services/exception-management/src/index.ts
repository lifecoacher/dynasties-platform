import { db } from "@workspace/db";
import {
  shipmentsTable,
  exceptionsTable,
  complianceScreeningsTable,
  riskScoresTable,
  shipmentDocumentsTable,
  ingestedDocumentsTable,
  shipmentChargesTable,
  invoicesTable,
  eventsTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import { runExceptionAgent } from "./agent.js";
import { validateExceptionOutput } from "./validator.js";

export interface ExceptionResult {
  exceptionsCreated: number;
  exceptionTypes: string[];
  success: boolean;
  error: string | null;
}

interface DetectedCondition {
  type: "EXTRACTION_FAILURE" | "DOCUMENT_CONFLICT" | "COMPLIANCE_ALERT" | "HIGH_RISK" | "MISSING_DOCUMENT" | "BILLING_DISCREPANCY";
  title: string;
  description: string;
  context: string;
}

const REQUIRED_DOC_TYPES = ["BOL", "COMMERCIAL_INVOICE", "PACKING_LIST"];

async function detectConditions(shipmentId: string, companyId: string): Promise<DetectedCondition[]> {
  const conditions: DetectedCondition[] = [];

  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(eq(shipmentsTable.id, shipmentId))
    .limit(1);

  if (!shipment || shipment.companyId !== companyId) return conditions;

  const docs = await db
    .select()
    .from(shipmentDocumentsTable)
    .where(eq(shipmentDocumentsTable.shipmentId, shipmentId));

  const ingestedDocs = await Promise.all(
    docs.filter((d: any) => d.documentId).map(async (d: any) => {
      const [doc] = await db
        .select()
        .from(ingestedDocumentsTable)
        .where(eq(ingestedDocumentsTable.id, d.documentId!))
        .limit(1);
      return doc;
    }),
  );

  const failedDocs = ingestedDocs.filter((d: any) => d && d.extractionStatus === "FAILED");
  if (failedDocs.length > 0) {
    conditions.push({
      type: "EXTRACTION_FAILURE",
      title: `${failedDocs.length} document(s) failed extraction`,
      description: `Documents could not be parsed: ${failedDocs.map((d: any) => d!.fileName).join(", ")}`,
      context: `Shipment ${shipment.reference}: ${failedDocs.length} documents failed OCR/extraction. File names: ${failedDocs.map((d: any) => d!.fileName).join(", ")}`,
    });
  }

  const docTypes = docs.map((d: any) => d.documentType) as string[];
  const generatedTypes = docs.filter((d: any) => d.isGenerated).map((d: any) => d.documentType) as string[];
  const missingRequired = REQUIRED_DOC_TYPES.filter(
    (req) => !docTypes.includes(req) && !generatedTypes.includes(req),
  );

  if (missingRequired.length > 0) {
    conditions.push({
      type: "MISSING_DOCUMENT",
      title: `Missing required document(s): ${missingRequired.join(", ")}`,
      description: `Shipment ${shipment.reference} is missing: ${missingRequired.join(", ")}`,
      context: `Shipment ${shipment.reference}, route: ${shipment.portOfLoading} → ${shipment.portOfDischarge}. Present docs: ${docTypes.join(", ")}. Missing: ${missingRequired.join(", ")}.`,
    });
  }

  const [compliance] = await db
    .select()
    .from(complianceScreeningsTable)
    .where(eq(complianceScreeningsTable.shipmentId, shipmentId))
    .limit(1);

  if (compliance && compliance.status !== "CLEAR") {
    const matchCount = Array.isArray(compliance.matches) ? compliance.matches.length : 0;
    conditions.push({
      type: "COMPLIANCE_ALERT",
      title: `Compliance screening: ${compliance.status}`,
      description: `${matchCount} match(es) found during sanctions screening`,
      context: `Shipment ${shipment.reference}: compliance status=${compliance.status}, matches=${matchCount}. Shipper: ${shipment.shipperId}, Consignee: ${shipment.consigneeId}.`,
    });
  }

  const [risk] = await db
    .select()
    .from(riskScoresTable)
    .where(eq(riskScoresTable.shipmentId, shipmentId))
    .limit(1);

  if (risk && risk.compositeScore >= 70) {
    conditions.push({
      type: "HIGH_RISK",
      title: `High risk score: ${risk.compositeScore}`,
      description: `Recommended action: ${risk.recommendedAction}. Primary factors: ${(risk.primaryRiskFactors as Array<{ factor: string; explanation: string }>)?.map((f) => f.factor).join(", ") || "N/A"}`,
      context: `Shipment ${shipment.reference}: risk score=${risk.compositeScore}/100, action=${risk.recommendedAction}. Commodity: ${shipment.commodity}, HS: ${shipment.hsCode}. Route: ${shipment.portOfLoading} → ${shipment.portOfDischarge}.`,
    });
  }

  const charges = await db
    .select()
    .from(shipmentChargesTable)
    .where(eq(shipmentChargesTable.shipmentId, shipmentId));

  const [invoice] = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.shipmentId, shipmentId))
    .limit(1);

  if (invoice && charges.length > 0) {
    const chargeTotal = charges.reduce((sum: number, c: any) => sum + Number(c.totalAmount), 0);
    const invoiceSubtotal = Number(invoice.subtotal);
    const diff = Math.abs(chargeTotal - invoiceSubtotal);
    if (diff > 0.01) {
      conditions.push({
        type: "BILLING_DISCREPANCY",
        title: `Billing discrepancy: charges=$${chargeTotal.toFixed(2)} vs invoice=$${invoiceSubtotal.toFixed(2)}`,
        description: `Difference of $${diff.toFixed(2)} between charge total and invoice subtotal`,
        context: `Shipment ${shipment.reference}: ${charges.length} charges totaling $${chargeTotal.toFixed(2)}, invoice ${invoice.invoiceNumber} subtotal $${invoiceSubtotal.toFixed(2)}. Difference: $${diff.toFixed(2)}.`,
      });
    }
  }

  const extractedDocs = ingestedDocs.filter((d: any) => d && d.extractionStatus === "EXTRACTED" && d.extractedData);
  if (extractedDocs.length >= 2) {
    const dataMap = extractedDocs.map((d: any) => d!.extractedData as Record<string, unknown>);
    const conflictFields: string[] = [];
    const checkFields = ["consignee", "shipper", "commodity", "portOfLoading", "portOfDischarge"];
    for (const field of checkFields) {
      const values = dataMap
        .map((d: any) => {
          const val = d[field];
          if (val && typeof val === "object" && "value" in (val as Record<string, unknown>)) {
            return (val as Record<string, unknown>).value;
          }
          return val;
        })
        .filter(Boolean);
      const uniqueVals = new Set(values.map((v: any) => String(v).toLowerCase().trim()));
      if (uniqueVals.size > 1) {
        conflictFields.push(field);
      }
    }
    if (conflictFields.length > 0) {
      conditions.push({
        type: "DOCUMENT_CONFLICT",
        title: `Document data conflicts in: ${conflictFields.join(", ")}`,
        description: `Multiple documents have conflicting values for: ${conflictFields.join(", ")}`,
        context: `Shipment ${shipment.reference}: ${extractedDocs.length} extracted documents have conflicting data in fields: ${conflictFields.join(", ")}.`,
      });
    }
  }

  return conditions;
}

export async function runExceptionDetection(
  shipmentId: string,
  companyId: string,
): Promise<ExceptionResult> {
  console.log(`[exceptions] starting exception detection for shipment=${shipmentId}`);

  const existingExceptions = await db
    .select({ id: exceptionsTable.id })
    .from(exceptionsTable)
    .where(eq(exceptionsTable.shipmentId, shipmentId))
    .limit(1);

  if (existingExceptions.length > 0) {
    console.log(`[exceptions] exceptions already scanned for shipment=${shipmentId}, skipping`);
    return { exceptionsCreated: 0, exceptionTypes: [], success: true, error: null };
  }

  const conditions = await detectConditions(shipmentId, companyId);

  if (conditions.length === 0) {
    console.log(`[exceptions] no exceptions detected for shipment=${shipmentId}`);
    await db.insert(eventsTable).values({
    actorType: "SERVICE",
      id: generateId(),
      companyId,
      eventType: "EXCEPTIONS_SCANNED" as string,
      entityType: "shipment",
      entityId: shipmentId,
      serviceId: "exception-management",
      metadata: { exceptionsFound: 0 },
    });
    return { exceptionsCreated: 0, exceptionTypes: [], success: true, error: null };
  }

  const createdTypes: string[] = [];
  const exceptionRows: Array<{
    id: string;
    exceptionType: string;
    severity: string;
    title: string;
    description: string;
    impactSummary: string;
    recommendedAction: string;
    requiresEscalation: boolean;
    agentClassification: Record<string, unknown> | null;
  }> = [];

  for (const condition of conditions) {
    let agentClassification: Record<string, unknown> | null = null;
    let severity = condition.type === "COMPLIANCE_ALERT" || condition.type === "HIGH_RISK" ? "HIGH" : "MEDIUM";
    let impactSummary = condition.description;
    let recommendedAction = "Review and resolve this exception";
    let requiresEscalation = false;

    try {
      const agentResult = await runExceptionAgent(condition.context);
      const validation = validateExceptionOutput(agentResult.raw);

      if (validation.valid) {
        agentClassification = validation.data as unknown as Record<string, unknown>;
        severity = validation.data.severity;
        impactSummary = validation.data.impactSummary;
        recommendedAction = validation.data.recommendedAction;
        requiresEscalation = validation.data.requiresEscalation;
      } else {
        console.log(`[exceptions] agent validation failed for ${condition.type}: ${validation.errors.join("; ")}`);
      }
    } catch (err) {
      console.error(`[exceptions] agent failed for ${condition.type}:`, err);
    }

    exceptionRows.push({
      id: generateId(),
      exceptionType: condition.type,
      severity,
      title: condition.title,
      description: condition.description,
      impactSummary,
      recommendedAction,
      requiresEscalation,
      agentClassification,
    });

    createdTypes.push(condition.type);
  }

  await db.transaction(async (tx) => {
    for (const row of exceptionRows) {
      await tx.insert(exceptionsTable).values({
        id: row.id,
        companyId,
        shipmentId,
        exceptionType: row.exceptionType as any,
        severity: row.severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
        status: "OPEN",
        title: row.title,
        description: row.description,
        detectedBy: "exception-management",
        impactSummary: row.impactSummary,
        recommendedAction: row.recommendedAction,
        requiresEscalation: row.requiresEscalation,
        agentClassification: row.agentClassification,
        metadata: null,
      });
    }

    await tx.insert(eventsTable).values({
      actorType: "SERVICE",
      id: generateId(),
      companyId,
      eventType: "EXCEPTION_DETECTED" as string,
      entityType: "shipment",
      entityId: shipmentId,
      serviceId: "exception-management",
      metadata: {
        exceptionsFound: createdTypes.length,
        types: createdTypes,
      },
    });
  });

  console.log(`[exceptions] complete: shipment=${shipmentId} exceptions=${createdTypes.length} types=${createdTypes.join(",")}`);

  return {
    exceptionsCreated: createdTypes.length,
    exceptionTypes: createdTypes,
    success: true,
    error: null,
  };
}
