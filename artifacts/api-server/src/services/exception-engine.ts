import { db } from "@workspace/db";
import {
  exceptionsTable,
  shipmentsTable,
  shipmentChargesTable,
  carrierInvoicesTable,
  reconciliationResultsTable,
  eventsTable,
  shipmentEventsTable,
  documentValidationResultsTable,
  shipmentDecisionsTable,
  type Exception,
  type ExceptionType,
  type ExceptionSeverity,
  type ExceptionSource,
} from "@workspace/db/schema";
import { generateId } from "@workspace/shared-utils";
import { eq, and, desc, inArray, sql } from "drizzle-orm";

interface RecommendedAction {
  action: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  category: string;
}

const RECOMMENDED_ACTIONS: Record<string, RecommendedAction[]> = {
  CUSTOMS_HOLD: [
    { action: "Contact customs broker for status update", priority: "HIGH", category: "COMMUNICATION" },
    { action: "Verify all customs documentation is complete", priority: "HIGH", category: "DOCUMENTATION" },
    { action: "Notify consignee of potential delay", priority: "MEDIUM", category: "COMMUNICATION" },
  ],
  DELAYED_SHIPMENT: [
    { action: "Contact carrier for updated ETA", priority: "HIGH", category: "COMMUNICATION" },
    { action: "Evaluate alternative routing options", priority: "MEDIUM", category: "OPERATIONS" },
    { action: "Notify customer of delay and revised timeline", priority: "HIGH", category: "COMMUNICATION" },
  ],
  MISSING_DOCUMENTS: [
    { action: "Request missing documents from shipper", priority: "HIGH", category: "DOCUMENTATION" },
    { action: "Generate available documents from system data", priority: "MEDIUM", category: "DOCUMENTATION" },
    { action: "Verify document readiness before release", priority: "HIGH", category: "COMPLIANCE" },
  ],
  DOCUMENT_BLOCKED: [
    { action: "Review document validation errors", priority: "HIGH", category: "DOCUMENTATION" },
    { action: "Update shipment data to meet document requirements", priority: "HIGH", category: "OPERATIONS" },
    { action: "Retry document generation after corrections", priority: "MEDIUM", category: "DOCUMENTATION" },
  ],
  REWEIGH_RECLASS: [
    { action: "Submit re-weigh documentation to carrier", priority: "HIGH", category: "DOCUMENTATION" },
    { action: "Review charge adjustments", priority: "MEDIUM", category: "FINANCIAL" },
    { action: "Update shipment weight/classification records", priority: "MEDIUM", category: "OPERATIONS" },
  ],
  MISSED_PICKUP: [
    { action: "Reschedule pickup with carrier immediately", priority: "HIGH", category: "OPERATIONS" },
    { action: "Notify shipper of rescheduled pickup", priority: "HIGH", category: "COMMUNICATION" },
    { action: "Assess impact on delivery timeline", priority: "MEDIUM", category: "OPERATIONS" },
  ],
  DELIVERY_EXCEPTION: [
    { action: "Contact delivery driver/agent for details", priority: "HIGH", category: "OPERATIONS" },
    { action: "Coordinate re-delivery attempt", priority: "HIGH", category: "OPERATIONS" },
    { action: "Notify consignee with updated delivery window", priority: "MEDIUM", category: "COMMUNICATION" },
  ],
  OSD_DAMAGE_SHORTAGE: [
    { action: "Document damage/shortage with photos", priority: "HIGH", category: "DOCUMENTATION" },
    { action: "File claim with carrier", priority: "HIGH", category: "FINANCIAL" },
    { action: "Notify insurance provider if coverage applies", priority: "MEDIUM", category: "FINANCIAL" },
  ],
  MAJOR_INVOICE_VARIANCE: [
    { action: "Review carrier invoice line items against expected charges", priority: "HIGH", category: "FINANCIAL" },
    { action: "Verify surcharge legitimacy with carrier", priority: "HIGH", category: "COMMUNICATION" },
    { action: "Dispute unauthorized charges", priority: "MEDIUM", category: "FINANCIAL" },
  ],
  UNMATCHED_CARRIER_INVOICE: [
    { action: "Attempt manual matching to shipment reference", priority: "HIGH", category: "OPERATIONS" },
    { action: "Contact carrier for reference clarification", priority: "MEDIUM", category: "COMMUNICATION" },
    { action: "Flag for billing team review", priority: "MEDIUM", category: "FINANCIAL" },
  ],
  RELEASE_BLOCKED: [
    { action: "Review blocking conditions in decision trace", priority: "HIGH", category: "COMPLIANCE" },
    { action: "Address compliance or documentation gaps", priority: "HIGH", category: "COMPLIANCE" },
    { action: "Escalate to manager if override required", priority: "MEDIUM", category: "OPERATIONS" },
  ],
  HIGH_RISK_REVIEW: [
    { action: "Review risk factors in decision trace", priority: "HIGH", category: "COMPLIANCE" },
    { action: "Verify entity sanctions screening results", priority: "HIGH", category: "COMPLIANCE" },
    { action: "Determine if additional due diligence needed", priority: "MEDIUM", category: "COMPLIANCE" },
  ],
};

function getSeverityForType(type: string, context?: Record<string, any>): ExceptionSeverity {
  const criticalTypes = ["CUSTOMS_HOLD", "RELEASE_BLOCKED", "OSD_DAMAGE_SHORTAGE"];
  const highTypes = ["DELAYED_SHIPMENT", "MAJOR_INVOICE_VARIANCE", "HIGH_RISK_REVIEW", "MISSED_PICKUP"];
  const mediumTypes = ["MISSING_DOCUMENTS", "DOCUMENT_BLOCKED", "UNMATCHED_CARRIER_INVOICE", "DELIVERY_EXCEPTION", "REWEIGH_RECLASS"];

  if (criticalTypes.includes(type)) return "CRITICAL";
  if (highTypes.includes(type)) return "HIGH";
  if (mediumTypes.includes(type)) return "MEDIUM";
  return "LOW";
}

async function hasOpenException(
  companyId: string,
  shipmentId: string | null,
  exceptionType: string,
  invoiceId?: string | null,
): Promise<boolean> {
  const conditions = [
    eq(exceptionsTable.companyId, companyId),
    eq(exceptionsTable.exceptionType, exceptionType as any),
    inArray(exceptionsTable.status, ["OPEN", "IN_PROGRESS", "ACKNOWLEDGED"]),
  ];
  if (shipmentId) {
    conditions.push(eq(exceptionsTable.shipmentId, shipmentId));
  }
  if (invoiceId) {
    conditions.push(eq(exceptionsTable.invoiceId, invoiceId));
  }
  const [result] = await db
    .select({ cnt: sql<number>`count(*)` })
    .from(exceptionsTable)
    .where(and(...conditions));
  return Number(result?.cnt ?? 0) > 0;
}

async function createException(params: {
  companyId: string;
  shipmentId?: string;
  invoiceId?: string;
  documentId?: string;
  exceptionType: ExceptionType;
  severity: ExceptionSeverity;
  detectedFrom: ExceptionSource;
  title: string;
  description: string;
  detectedBy: string;
  metadata?: Record<string, unknown>;
  requiresEscalation?: boolean;
  assignedToUserId?: string;
  dueAt?: Date;
}): Promise<Exception> {
  const id = generateId("exc");
  const actions = RECOMMENDED_ACTIONS[params.exceptionType] || [];

  const [exception] = await db
    .insert(exceptionsTable)
    .values({
      id,
      companyId: params.companyId,
      shipmentId: params.shipmentId ?? null,
      invoiceId: params.invoiceId ?? null,
      documentId: params.documentId ?? null,
      exceptionType: params.exceptionType,
      severity: params.severity,
      status: params.assignedToUserId ? "IN_PROGRESS" : "OPEN",
      detectedFrom: params.detectedFrom,
      title: params.title,
      description: params.description,
      detectedBy: params.detectedBy,
      recommendedAction: actions[0]?.action ?? null,
      recommendedActions: actions,
      requiresEscalation: params.requiresEscalation ?? params.severity === "CRITICAL",
      assignedToUserId: params.assignedToUserId ?? null,
      metadata: params.metadata ?? null,
      dueAt: params.dueAt ?? null,
    })
    .returning();

  await db.insert(eventsTable).values({
    id: generateId("evt"),
    companyId: params.companyId,
    eventType: "EXCEPTION_CREATED",
    entityType: "EXCEPTION",
    entityId: id,
    actorType: "SYSTEM",
    metadata: {
      exceptionType: params.exceptionType,
      severity: params.severity,
      detectedFrom: params.detectedFrom,
      shipmentId: params.shipmentId,
      invoiceId: params.invoiceId,
    },
  });

  return exception;
}

export async function detectExceptionsForShipment(
  companyId: string,
  shipmentId: string,
): Promise<Exception[]> {
  const created: Exception[] = [];

  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(and(eq(shipmentsTable.id, shipmentId), eq(shipmentsTable.companyId, companyId)))
    .limit(1);

  if (!shipment) return [];

  const shipmentEvents = await db
    .select()
    .from(shipmentEventsTable)
    .where(eq(shipmentEventsTable.shipmentId, shipmentId))
    .orderBy(desc(shipmentEventsTable.createdAt));

  for (const evt of shipmentEvents) {
    if (evt.eventType === "CUSTOMS_HOLD") {
      if (!(await hasOpenException(companyId, shipmentId, "CUSTOMS_HOLD"))) {
        created.push(
          await createException({
            companyId,
            shipmentId,
            exceptionType: "CUSTOMS_HOLD",
            severity: "CRITICAL",
            detectedFrom: "EVENT",
            title: `Customs Hold — ${shipment.reference}`,
            description: `Shipment ${shipment.reference} is on customs hold at ${evt.location || "port"}. Immediate action required to clear shipment.`,
            detectedBy: "exception-engine",
            metadata: { eventId: evt.id, location: evt.location },
          }),
        );
      }
    }

    if (evt.eventType === "DELAYED") {
      if (!(await hasOpenException(companyId, shipmentId, "DELAYED_SHIPMENT"))) {
        created.push(
          await createException({
            companyId,
            shipmentId,
            exceptionType: "DELAYED_SHIPMENT",
            severity: "HIGH",
            detectedFrom: "EVENT",
            title: `Delayed — ${shipment.reference}`,
            description: `Shipment ${shipment.reference} has been flagged as delayed. Review and update customer.`,
            detectedBy: "exception-engine",
            metadata: { eventId: evt.id },
          }),
        );
      }
    }
  }

  if (shipment.eta && new Date(shipment.eta) < new Date() && shipment.status !== "DELIVERED" && shipment.status !== "CLOSED") {
    if (!(await hasOpenException(companyId, shipmentId, "DELAYED_SHIPMENT"))) {
      created.push(
        await createException({
          companyId,
          shipmentId,
          exceptionType: "DELAYED_SHIPMENT",
          severity: "HIGH",
          detectedFrom: "SYSTEM",
          title: `Overdue — ${shipment.reference}`,
          description: `Shipment ${shipment.reference} has passed its ETA (${new Date(shipment.eta).toISOString().slice(0, 10)}) and is not yet delivered.`,
          detectedBy: "exception-engine",
        }),
      );
    }
  }

  const [docValidation] = await db
    .select()
    .from(documentValidationResultsTable)
    .where(and(eq(documentValidationResultsTable.shipmentId, shipmentId), eq(documentValidationResultsTable.companyId, companyId)))
    .limit(1);

  if (docValidation) {
    if (docValidation.status === "BLOCKED") {
      if (!(await hasOpenException(companyId, shipmentId, "DOCUMENT_BLOCKED"))) {
        created.push(
          await createException({
            companyId,
            shipmentId,
            exceptionType: "DOCUMENT_BLOCKED",
            severity: "MEDIUM",
            detectedFrom: "DOCUMENT",
            title: `Document Blocked — ${shipment.reference}`,
            description: `Document validation blocked for shipment ${shipment.reference}. ${docValidation.reasoningSummary || "Critical validation issues detected."}`,
            detectedBy: "exception-engine",
            metadata: { validationId: docValidation.id, status: docValidation.status },
          }),
        );
      }
    }

    const missingDocs = docValidation.missingDocuments || [];
    if (missingDocs.length > 0) {
      if (!(await hasOpenException(companyId, shipmentId, "MISSING_DOCUMENTS"))) {
        const docList = missingDocs.map((d: any) => d.label || d.code).join(", ");
        created.push(
          await createException({
            companyId,
            shipmentId,
            exceptionType: "MISSING_DOCUMENTS",
            severity: missingDocs.some((d: any) => d.severity === "CRITICAL") ? "HIGH" : "MEDIUM",
            detectedFrom: "DOCUMENT",
            title: `Missing Documents — ${shipment.reference}`,
            description: `${missingDocs.length} document(s) missing: ${docList}`,
            detectedBy: "exception-engine",
            metadata: { validationId: docValidation.id, missingDocuments: missingDocs },
          }),
        );
      }
    }
  }

  const [decision] = await db
    .select()
    .from(shipmentDecisionsTable)
    .where(and(eq(shipmentDecisionsTable.shipmentId, shipmentId), eq(shipmentDecisionsTable.companyId, companyId)))
    .limit(1);

  if (decision) {
    if (decision.finalStatus === "BLOCKED" || !decision.releaseAllowed) {
      if (!(await hasOpenException(companyId, shipmentId, "RELEASE_BLOCKED"))) {
        created.push(
          await createException({
            companyId,
            shipmentId,
            exceptionType: "RELEASE_BLOCKED",
            severity: "CRITICAL",
            detectedFrom: "DECISION",
            title: `Release Blocked — ${shipment.reference}`,
            description: `Decision engine blocked release: ${decision.decisionReason}`,
            detectedBy: "exception-engine",
            metadata: { decisionId: decision.id, finalStatus: decision.finalStatus },
          }),
        );
      }
    }

    if (decision.finalStatus === "REVIEW" && decision.finalRiskScore && decision.finalRiskScore >= 70) {
      if (!(await hasOpenException(companyId, shipmentId, "HIGH_RISK_REVIEW"))) {
        created.push(
          await createException({
            companyId,
            shipmentId,
            exceptionType: "HIGH_RISK_REVIEW",
            severity: "HIGH",
            detectedFrom: "DECISION",
            title: `High Risk Review — ${shipment.reference}`,
            description: `Decision engine flagged for review with risk score ${decision.finalRiskScore.toFixed(0)}. ${decision.decisionReason}`,
            detectedBy: "exception-engine",
            metadata: { decisionId: decision.id, riskScore: decision.finalRiskScore },
          }),
        );
      }
    }
  }

  const reconciliationResults = await db
    .select()
    .from(reconciliationResultsTable)
    .where(and(eq(reconciliationResultsTable.shipmentId, shipmentId), eq(reconciliationResultsTable.companyId, companyId)));

  for (const recon of reconciliationResults) {
    if (recon.reconciliationStatus === "MAJOR_VARIANCE") {
      if (!(await hasOpenException(companyId, shipmentId, "MAJOR_INVOICE_VARIANCE"))) {
        created.push(
          await createException({
            companyId,
            shipmentId,
            invoiceId: recon.carrierInvoiceId,
            exceptionType: "MAJOR_INVOICE_VARIANCE",
            severity: "HIGH",
            detectedFrom: "RECONCILIATION",
            title: `Major Invoice Variance — ${shipment.reference}`,
            description: `Reconciliation found ${recon.variancePercentage?.toFixed(1)}% variance ($${recon.varianceAmount}) between expected and actual charges.`,
            detectedBy: "exception-engine",
            metadata: { reconciliationId: recon.id, variancePercentage: recon.variancePercentage },
          }),
        );
      }
    }
  }

  const unmatchedInvoices = await db
    .select()
    .from(carrierInvoicesTable)
    .where(
      and(
        eq(carrierInvoicesTable.companyId, companyId),
        eq(carrierInvoicesTable.matchMethod, "UNMATCHED"),
      ),
    );

  for (const inv of unmatchedInvoices) {
    if (!(await hasOpenException(companyId, null, "UNMATCHED_CARRIER_INVOICE", inv.id))) {
      created.push(
        await createException({
          companyId,
          invoiceId: inv.id,
          exceptionType: "UNMATCHED_CARRIER_INVOICE",
          severity: "MEDIUM",
          detectedFrom: "RECONCILIATION",
          title: `Unmatched Carrier Invoice — ${inv.invoiceNumber}`,
          description: `Carrier invoice ${inv.invoiceNumber} from ${inv.carrierName} ($${inv.totalAmount}) could not be matched to any shipment.`,
          detectedBy: "exception-engine",
          metadata: { carrierInvoiceId: inv.id, carrierName: inv.carrierName },
        }),
      );
    }
  }

  return created;
}

export async function createManualException(params: {
  companyId: string;
  shipmentId?: string;
  invoiceId?: string;
  exceptionType: ExceptionType;
  severity: ExceptionSeverity;
  title: string;
  description: string;
  assignedToUserId?: string;
  dueAt?: string;
  userId?: string;
}): Promise<Exception> {
  return createException({
    companyId: params.companyId,
    shipmentId: params.shipmentId,
    invoiceId: params.invoiceId,
    exceptionType: params.exceptionType,
    severity: params.severity,
    detectedFrom: "MANUAL",
    title: params.title,
    description: params.description,
    detectedBy: params.userId ?? "manual",
    assignedToUserId: params.assignedToUserId,
    dueAt: params.dueAt ? new Date(params.dueAt) : undefined,
  });
}

export async function assignException(
  exceptionId: string,
  companyId: string,
  assignedToUserId: string,
  actorUserId: string,
): Promise<Exception | null> {
  const [exc] = await db
    .select()
    .from(exceptionsTable)
    .where(and(eq(exceptionsTable.id, exceptionId), eq(exceptionsTable.companyId, companyId)))
    .limit(1);
  if (!exc) return null;

  const newStatus = exc.status === "OPEN" ? "IN_PROGRESS" : exc.status;

  const [updated] = await db
    .update(exceptionsTable)
    .set({ assignedToUserId, status: newStatus })
    .where(eq(exceptionsTable.id, exceptionId))
    .returning();

  await db.insert(eventsTable).values({
    id: generateId("evt"),
    companyId,
    eventType: "EXCEPTION_ASSIGNED",
    entityType: "EXCEPTION",
    entityId: exceptionId,
    actorType: "USER",
    userId: actorUserId,
    metadata: { assignedTo: assignedToUserId, shipmentId: exc.shipmentId },
  });

  return updated;
}

export async function escalateException(
  exceptionId: string,
  companyId: string,
  actorUserId: string,
  reason?: string,
): Promise<Exception | null> {
  const [exc] = await db
    .select()
    .from(exceptionsTable)
    .where(and(eq(exceptionsTable.id, exceptionId), eq(exceptionsTable.companyId, companyId)))
    .limit(1);
  if (!exc) return null;

  const [updated] = await db
    .update(exceptionsTable)
    .set({ status: "ESCALATED", requiresEscalation: true })
    .where(eq(exceptionsTable.id, exceptionId))
    .returning();

  await db.insert(eventsTable).values({
    id: generateId("evt"),
    companyId,
    eventType: "EXCEPTION_ESCALATED",
    entityType: "EXCEPTION",
    entityId: exceptionId,
    actorType: "USER",
    userId: actorUserId,
    metadata: { reason, shipmentId: exc.shipmentId },
  });

  return updated;
}

export async function resolveException(
  exceptionId: string,
  companyId: string,
  actorUserId: string,
  resolutionNotes: string,
): Promise<Exception | null> {
  const [exc] = await db
    .select()
    .from(exceptionsTable)
    .where(and(eq(exceptionsTable.id, exceptionId), eq(exceptionsTable.companyId, companyId)))
    .limit(1);
  if (!exc) return null;

  const [updated] = await db
    .update(exceptionsTable)
    .set({
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedBy: actorUserId,
      resolutionNotes,
    })
    .where(eq(exceptionsTable.id, exceptionId))
    .returning();

  await db.insert(eventsTable).values({
    id: generateId("evt"),
    companyId,
    eventType: "EXCEPTION_RESOLVED",
    entityType: "EXCEPTION",
    entityId: exceptionId,
    actorType: "USER",
    userId: actorUserId,
    metadata: { resolutionNotes, shipmentId: exc.shipmentId },
  });

  return updated;
}

export async function getAlertsSummary(companyId: string) {
  const openExceptions = await db
    .select()
    .from(exceptionsTable)
    .where(
      and(
        eq(exceptionsTable.companyId, companyId),
        inArray(exceptionsTable.status, ["OPEN", "IN_PROGRESS", "ESCALATED"]),
      ),
    );

  const bySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  const byType: Record<string, number> = {};
  const byStatus = { OPEN: 0, IN_PROGRESS: 0, ESCALATED: 0 };

  for (const exc of openExceptions) {
    bySeverity[exc.severity as keyof typeof bySeverity]++;
    byType[exc.exceptionType] = (byType[exc.exceptionType] || 0) + 1;
    byStatus[exc.status as keyof typeof byStatus]++;
  }

  const critical = openExceptions
    .filter((e) => e.severity === "CRITICAL" || e.status === "ESCALATED")
    .slice(0, 5);

  return {
    total: openExceptions.length,
    bySeverity,
    byType,
    byStatus,
    criticalAlerts: critical.map((e) => ({
      id: e.id,
      type: e.exceptionType,
      severity: e.severity,
      status: e.status,
      title: e.title,
      shipmentId: e.shipmentId,
      createdAt: e.createdAt,
    })),
    needsAttention: openExceptions.filter(
      (e) => e.severity === "CRITICAL" || e.severity === "HIGH" || e.status === "ESCALATED",
    ).length,
  };
}

export async function getShipmentAlerts(companyId: string, shipmentId: string) {
  const exceptions = await db
    .select()
    .from(exceptionsTable)
    .where(
      and(
        eq(exceptionsTable.companyId, companyId),
        eq(exceptionsTable.shipmentId, shipmentId),
        inArray(exceptionsTable.status, ["OPEN", "IN_PROGRESS", "ESCALATED"]),
      ),
    )
    .orderBy(desc(exceptionsTable.createdAt));

  const bySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const e of exceptions) {
    bySeverity[e.severity as keyof typeof bySeverity]++;
  }

  return {
    total: exceptions.length,
    bySeverity,
    exceptions: exceptions.map((e) => ({
      id: e.id,
      type: e.exceptionType,
      severity: e.severity,
      status: e.status,
      title: e.title,
      description: e.description,
      recommendedActions: e.recommendedActions,
      assignedToUserId: e.assignedToUserId,
      dueAt: e.dueAt,
      createdAt: e.createdAt,
    })),
  };
}
