import { db } from "@workspace/db";
import {
  releaseGateHoldsTable,
  shipmentsTable,
  preShipmentRiskReportsTable,
  complianceScreeningsTable,
  shipmentDocumentsTable,
} from "@workspace/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import { computeReadinessScore } from "./readiness-scoring.js";

export type GateType =
  | "COMPLIANCE_BLOCK"
  | "READINESS_REVIEW"
  | "DISRUPTION_APPROVAL"
  | "DOCUMENT_HOLD"
  | "LANE_STRESS_HOLD"
  | "WEATHER_HOLD"
  | "MANAGER_APPROVAL";

export interface GateEvaluationResult {
  shipmentId: string;
  holds: Array<{
    id: string;
    gateType: GateType;
    severity: string;
    reason: string;
    policyRule: string;
    requiredAction: string;
  }>;
  canProceed: boolean;
}

interface GatePolicy {
  gateType: GateType;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  policyRule: string;
  check: (ctx: GateContext) => { triggered: boolean; reason: string; requiredAction: string } | null;
}

interface GateContext {
  shipment: any;
  riskReport: any | null;
  readiness: any;
  compliance: any | null;
  docs: any[];
}

const GATE_POLICIES: GatePolicy[] = [
  {
    gateType: "COMPLIANCE_BLOCK",
    severity: "CRITICAL",
    policyRule: "COMPLIANCE_SCREENING_BLOCKED",
    check: (ctx) => {
      if (ctx.compliance?.status === "BLOCKED") {
        return {
          triggered: true,
          reason: "Compliance screening returned BLOCKED status",
          requiredAction: "Resolve compliance issues before release",
        };
      }
      if (ctx.compliance?.status === "ALERT" && (ctx.compliance?.matchCount ?? 0) > 2) {
        return {
          triggered: true,
          reason: `Compliance screening has ${ctx.compliance.matchCount} matches requiring review`,
          requiredAction: "Review compliance matches with compliance team",
        };
      }
      return null;
    },
  },
  {
    gateType: "READINESS_REVIEW",
    severity: "HIGH",
    policyRule: "LOW_READINESS_SCORE",
    check: (ctx) => {
      if (ctx.readiness.overallScore < 0.4) {
        return {
          triggered: true,
          reason: `Readiness score is ${(ctx.readiness.overallScore * 100).toFixed(0)}% — below minimum threshold of 40%`,
          requiredAction: "Complete missing documentation and operational details",
        };
      }
      return null;
    },
  },
  {
    gateType: "DISRUPTION_APPROVAL",
    severity: "HIGH",
    policyRule: "HIGH_DISRUPTION_RISK",
    check: (ctx) => {
      if (ctx.riskReport && ctx.riskReport.disruptionRiskScore >= 0.7) {
        return {
          triggered: true,
          reason: `Disruption risk score is ${(ctx.riskReport.disruptionRiskScore * 100).toFixed(0)}% — requires manager approval`,
          requiredAction: "Obtain manager approval before proceeding",
        };
      }
      return null;
    },
  },
  {
    gateType: "WEATHER_HOLD",
    severity: "HIGH",
    policyRule: "HIGH_WEATHER_EXPOSURE",
    check: (ctx) => {
      if (ctx.riskReport && ctx.riskReport.weatherExposureScore >= 0.7) {
        return {
          triggered: true,
          reason: `Weather exposure score is ${(ctx.riskReport.weatherExposureScore * 100).toFixed(0)}% — consider delayed departure`,
          requiredAction: "Review weather forecasts and consider alternate departure window",
        };
      }
      return null;
    },
  },
  {
    gateType: "DOCUMENT_HOLD",
    severity: "HIGH",
    policyRule: "MISSING_DOCS_HIGH_VALUE",
    check: (ctx) => {
      const cargoValue = ctx.shipment.cargoValue ?? 0;
      const hasRequiredDocs = ctx.docs.some(
        (d: any) =>
          d.documentType === "BOL" ||
          d.documentType === "COMMERCIAL_INVOICE",
      );
      if (!hasRequiredDocs && cargoValue > 50000) {
        return {
          triggered: true,
          reason: `Missing required documents for high-value cargo (${cargoValue})`,
          requiredAction: "Upload Bill of Lading and/or Commercial Invoice before release",
        };
      }
      return null;
    },
  },
  {
    gateType: "LANE_STRESS_HOLD",
    severity: "MEDIUM",
    policyRule: "EXTREME_LANE_STRESS",
    check: (ctx) => {
      if (ctx.riskReport && ctx.riskReport.laneStressScore >= 0.8) {
        return {
          triggered: true,
          reason: `Lane stress is at ${(ctx.riskReport.laneStressScore * 100).toFixed(0)}% — recommend alternate departure window`,
          requiredAction: "Consider delaying departure or using alternate lane",
        };
      }
      return null;
    },
  },
  {
    gateType: "MANAGER_APPROVAL",
    severity: "CRITICAL",
    policyRule: "CRITICAL_RISK_MANAGER_APPROVAL",
    check: (ctx) => {
      if (ctx.riskReport && ctx.riskReport.overallRiskScore >= 0.8) {
        return {
          triggered: true,
          reason: `Overall risk score is ${(ctx.riskReport.overallRiskScore * 100).toFixed(0)}% — requires senior manager sign-off`,
          requiredAction: "Escalate to senior manager for approval",
        };
      }
      return null;
    },
  },
];

export async function evaluateReleaseGates(
  shipmentId: string,
  companyId: string,
): Promise<GateEvaluationResult> {
  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(and(eq(shipmentsTable.id, shipmentId), eq(shipmentsTable.companyId, companyId)))
    .limit(1);

  if (!shipment) {
    return { shipmentId, holds: [], canProceed: true };
  }

  const [[riskReport], [complianceRow], docs, readiness] = await Promise.all([
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
    db
      .select()
      .from(complianceScreeningsTable)
      .where(eq(complianceScreeningsTable.shipmentId, shipmentId))
      .orderBy(desc(complianceScreeningsTable.createdAt))
      .limit(1),
    db
      .select()
      .from(shipmentDocumentsTable)
      .where(eq(shipmentDocumentsTable.shipmentId, shipmentId)),
    computeReadinessScore(shipmentId, companyId),
  ]);

  const ctx: GateContext = {
    shipment,
    riskReport: riskReport ?? null,
    readiness,
    compliance: complianceRow ?? null,
    docs,
  };

  const holds: GateEvaluationResult["holds"] = [];

  for (const policy of GATE_POLICIES) {
    const result = policy.check(ctx);
    if (result?.triggered) {
      const existingHold = await db
        .select({ id: releaseGateHoldsTable.id })
        .from(releaseGateHoldsTable)
        .where(
          and(
            eq(releaseGateHoldsTable.shipmentId, shipmentId),
            eq(releaseGateHoldsTable.companyId, companyId),
            eq(releaseGateHoldsTable.gateType, policy.gateType),
            eq(releaseGateHoldsTable.status, "ACTIVE"),
          ),
        )
        .limit(1);

      if (existingHold.length > 0) {
        holds.push({
          id: existingHold[0].id,
          gateType: policy.gateType,
          severity: policy.severity,
          reason: result.reason,
          policyRule: policy.policyRule,
          requiredAction: result.requiredAction,
        });
        continue;
      }

      const holdId = generateId("rgh");
      await db.insert(releaseGateHoldsTable).values({
        id: holdId,
        companyId,
        shipmentId,
        gateType: policy.gateType,
        severity: policy.severity,
        reason: result.reason,
        policyRule: policy.policyRule,
        requiredAction: result.requiredAction,
        triggerData: {
          riskScore: riskReport?.overallRiskScore,
          readinessScore: readiness.overallScore,
        },
      });

      holds.push({
        id: holdId,
        gateType: policy.gateType,
        severity: policy.severity,
        reason: result.reason,
        policyRule: policy.policyRule,
        requiredAction: result.requiredAction,
      });
    }
  }

  return {
    shipmentId,
    holds,
    canProceed: holds.length === 0,
  };
}

export async function releaseHold(
  holdId: string,
  companyId: string,
  resolvedBy: string,
  notes: string,
) {
  await db
    .update(releaseGateHoldsTable)
    .set({
      status: "RELEASED",
      resolvedBy,
      resolvedAt: new Date(),
      resolutionNotes: notes,
    })
    .where(
      and(
        eq(releaseGateHoldsTable.id, holdId),
        eq(releaseGateHoldsTable.companyId, companyId),
      ),
    );
}

export async function overrideHold(
  holdId: string,
  companyId: string,
  resolvedBy: string,
  notes: string,
) {
  await db
    .update(releaseGateHoldsTable)
    .set({
      status: "OVERRIDDEN",
      resolvedBy,
      resolvedAt: new Date(),
      resolutionNotes: notes,
    })
    .where(
      and(
        eq(releaseGateHoldsTable.id, holdId),
        eq(releaseGateHoldsTable.companyId, companyId),
      ),
    );
}

export async function getActiveHolds(shipmentId: string, companyId: string) {
  return db
    .select()
    .from(releaseGateHoldsTable)
    .where(
      and(
        eq(releaseGateHoldsTable.shipmentId, shipmentId),
        eq(releaseGateHoldsTable.companyId, companyId),
        eq(releaseGateHoldsTable.status, "ACTIVE"),
      ),
    )
    .orderBy(desc(releaseGateHoldsTable.createdAt));
}

export async function getHoldHistory(shipmentId: string, companyId: string) {
  return db
    .select()
    .from(releaseGateHoldsTable)
    .where(
      and(
        eq(releaseGateHoldsTable.shipmentId, shipmentId),
        eq(releaseGateHoldsTable.companyId, companyId),
      ),
    )
    .orderBy(desc(releaseGateHoldsTable.createdAt));
}
