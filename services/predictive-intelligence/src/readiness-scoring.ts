import { db } from "@workspace/db";
import {
  shipmentsTable,
  complianceScreeningsTable,
  shipmentDocumentsTable,
  preShipmentRiskReportsTable,
} from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";

export interface ReadinessComponent {
  score: number;
  status: "READY" | "NEEDS_ATTENTION" | "NOT_READY" | "UNKNOWN";
  details: string;
}

export interface ShipmentReadinessResult {
  shipmentId: string;
  overallScore: number;
  readinessLevel: "READY" | "NEEDS_ATTENTION" | "NOT_READY";
  components: {
    documentation: ReadinessComponent;
    compliance: ReadinessComponent;
    riskExposure: ReadinessComponent;
    operationalInfo: ReadinessComponent;
  };
}

export async function computeReadinessScore(
  shipmentId: string,
  companyId: string,
): Promise<ShipmentReadinessResult> {
  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(and(eq(shipmentsTable.id, shipmentId), eq(shipmentsTable.companyId, companyId)))
    .limit(1);

  if (!shipment) {
    return {
      shipmentId,
      overallScore: 0,
      readinessLevel: "NOT_READY",
      components: {
        documentation: { score: 0, status: "UNKNOWN", details: "Shipment not found" },
        compliance: { score: 0, status: "UNKNOWN", details: "Shipment not found" },
        riskExposure: { score: 0, status: "UNKNOWN", details: "Shipment not found" },
        operationalInfo: { score: 0, status: "UNKNOWN", details: "Shipment not found" },
      },
    };
  }

  const [docs, screenings, riskReport] = await Promise.all([
    db
      .select()
      .from(shipmentDocumentsTable)
      .where(eq(shipmentDocumentsTable.shipmentId, shipmentId)),
    db
      .select()
      .from(complianceScreeningsTable)
      .where(eq(complianceScreeningsTable.shipmentId, shipmentId))
      .orderBy(desc(complianceScreeningsTable.createdAt))
      .limit(5),
    db
      .select()
      .from(preShipmentRiskReportsTable)
      .where(
        and(
          eq(preShipmentRiskReportsTable.shipmentId, shipmentId),
          eq(preShipmentRiskReportsTable.companyId, companyId),
        ),
      )
      .orderBy(desc(preShipmentRiskReportsTable.evaluatedAt))
      .limit(1),
  ]);

  const documentation = scoreDocumentation(shipment, docs);
  const compliance = scoreCompliance(screenings);
  const riskExposure = scoreRiskExposure(riskReport[0] ?? null);
  const operationalInfo = scoreOperationalInfo(shipment);

  const overallScore =
    documentation.score * 0.3 +
    compliance.score * 0.25 +
    riskExposure.score * 0.25 +
    operationalInfo.score * 0.2;

  const readinessLevel: "READY" | "NEEDS_ATTENTION" | "NOT_READY" =
    overallScore >= 0.8 ? "READY" : overallScore >= 0.5 ? "NEEDS_ATTENTION" : "NOT_READY";

  return {
    shipmentId,
    overallScore,
    readinessLevel,
    components: {
      documentation,
      compliance,
      riskExposure,
      operationalInfo,
    },
  };
}

function scoreDocumentation(shipment: any, docs: any[]): ReadinessComponent {
  let score = 0;
  const issues: string[] = [];

  if (docs.length > 0) {
    score += 0.5;
  } else {
    issues.push("No documents attached");
  }

  const hasRequired = docs.some(
    (d) =>
      d.documentType === "BILL_OF_LADING" ||
      d.documentType === "COMMERCIAL_INVOICE" ||
      d.documentType === "PACKING_LIST",
  );
  if (hasRequired) {
    score += 0.3;
  } else {
    issues.push("Missing key document types (BL, invoice, or packing list)");
  }

  if (shipment.blNumber) score += 0.1;
  if (shipment.bookingNumber) score += 0.1;

  score = Math.min(score, 1);

  const status: ReadinessComponent["status"] =
    score >= 0.8 ? "READY" : score >= 0.5 ? "NEEDS_ATTENTION" : "NOT_READY";

  return {
    score,
    status,
    details: issues.length > 0 ? issues.join("; ") : "Documentation complete",
  };
}

function scoreCompliance(screenings: any[]): ReadinessComponent {
  if (screenings.length === 0) {
    return { score: 0.3, status: "NEEDS_ATTENTION", details: "No compliance screening run" };
  }

  const latest = screenings[0];
  if (latest.status === "CLEAR") {
    return { score: 1, status: "READY", details: "Compliance screening clear" };
  }
  if (latest.status === "ALERT") {
    return { score: 0.3, status: "NEEDS_ATTENTION", details: "Compliance alert flagged" };
  }
  if (latest.status === "BLOCKED") {
    return { score: 0.1, status: "NOT_READY", details: "Compliance blocked" };
  }

  return { score: 0.5, status: "NEEDS_ATTENTION", details: "Compliance status unclear" };
}

function scoreRiskExposure(report: any | null): ReadinessComponent {
  if (!report) {
    return { score: 0.5, status: "NEEDS_ATTENTION", details: "No pre-shipment risk assessment" };
  }

  const riskScore = 1 - (report.overallRiskScore ?? 0);
  const status: ReadinessComponent["status"] =
    riskScore >= 0.7 ? "READY" : riskScore >= 0.4 ? "NEEDS_ATTENTION" : "NOT_READY";

  return {
    score: riskScore,
    status,
    details: `Risk level: ${report.riskLevel}. Overall risk: ${((report.overallRiskScore ?? 0) * 100).toFixed(0)}%`,
  };
}

function scoreOperationalInfo(shipment: any): ReadinessComponent {
  let score = 0;
  const issues: string[] = [];

  if (shipment.portOfLoading) score += 0.15;
  else issues.push("Missing port of loading");

  if (shipment.portOfDischarge) score += 0.15;
  else issues.push("Missing port of discharge");

  if (shipment.carrierId) score += 0.15;
  else issues.push("No carrier assigned");

  if (shipment.etd) score += 0.15;
  else issues.push("No ETD set");

  if (shipment.shipperId) score += 0.1;
  if (shipment.consigneeId) score += 0.1;
  if (shipment.commodity) score += 0.1;
  if (shipment.grossWeight) score += 0.1;

  score = Math.min(score, 1);

  const status: ReadinessComponent["status"] =
    score >= 0.8 ? "READY" : score >= 0.5 ? "NEEDS_ATTENTION" : "NOT_READY";

  return {
    score,
    status,
    details: issues.length > 0 ? issues.join("; ") : "Operational info complete",
  };
}
