import { db } from "@workspace/db";
import {
  mitigationPlaybooksTable,
  preShipmentRiskReportsTable,
  shipmentsTable,
} from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";

export interface PlaybookStep {
  stepId: string;
  type: string;
  title: string;
  description: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
  linkedRecommendationId?: string;
  linkedTaskId?: string;
  completedAt?: string;
}

export interface PlaybookResult {
  id: string;
  shipmentId: string;
  triggerCondition: string;
  triggerSource: string;
  priority: string;
  steps: PlaybookStep[];
  totalSteps: number;
}

type StepTemplate = Omit<PlaybookStep, "stepId" | "status">;

interface PlaybookRule {
  triggerCondition: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  check: (riskReport: any, shipment: any) => boolean;
  steps: StepTemplate[];
}

const PLAYBOOK_RULES: PlaybookRule[] = [
  {
    triggerCondition: "HIGH_LANE_STRESS",
    priority: "HIGH",
    check: (r) => r.laneStressScore >= 0.7,
    steps: [
      { type: "ROUTE_REVIEW", title: "Review alternate routes", description: "Evaluate alternate lanes with lower stress scores" },
      { type: "DELAY_ETD", title: "Consider delayed departure", description: "Assess whether a 3-7 day departure delay reduces lane stress" },
      { type: "MONITORING", title: "Set up lane monitoring", description: "Configure daily lane stress monitoring until departure" },
    ],
  },
  {
    triggerCondition: "HIGH_PORT_CONGESTION",
    priority: "HIGH",
    check: (r) => r.portCongestionScore >= 0.7,
    steps: [
      { type: "ROUTE_REVIEW", title: "Evaluate alternate ports", description: "Check nearby ports with lower congestion" },
      { type: "CARRIER_REVIEW", title: "Verify carrier schedule accuracy", description: "Confirm carrier ETD/ETA given congestion levels" },
      { type: "INSURANCE_REVIEW", title: "Review delay insurance", description: "Assess whether delay coverage is adequate" },
    ],
  },
  {
    triggerCondition: "HIGH_DISRUPTION_RISK",
    priority: "CRITICAL",
    check: (r) => r.disruptionRiskScore >= 0.6,
    steps: [
      { type: "CARRIER_REVIEW", title: "Verify carrier disruption exposure", description: "Confirm carrier is not directly impacted by active disruptions" },
      { type: "ROUTE_REVIEW", title: "Plan contingency routing", description: "Identify backup routes avoiding disrupted areas" },
      { type: "INSURANCE_REVIEW", title: "Upgrade insurance coverage", description: "Consider enhanced coverage for disruption-exposed shipment" },
      { type: "MONITORING", title: "Enable real-time disruption tracking", description: "Set up alerts for disruption developments" },
    ],
  },
  {
    triggerCondition: "HIGH_WEATHER_EXPOSURE",
    priority: "HIGH",
    check: (r) => r.weatherExposureScore >= 0.6,
    steps: [
      { type: "DELAY_ETD", title: "Evaluate weather window", description: "Check if delaying departure avoids severe weather" },
      { type: "INSURANCE_REVIEW", title: "Review weather-related coverage", description: "Ensure insurance covers weather-related delays and damage" },
      { type: "MONITORING", title: "Set up weather monitoring", description: "Track weather forecasts for the planned route" },
    ],
  },
  {
    triggerCondition: "LOW_CARRIER_RELIABILITY",
    priority: "MEDIUM",
    check: (r) => r.carrierReliabilityScore >= 0.6,
    steps: [
      { type: "CARRIER_REVIEW", title: "Evaluate alternate carriers", description: "Compare carrier reliability scores for this lane" },
      { type: "MONITORING", title: "Set up carrier performance tracking", description: "Track carrier performance leading up to departure" },
    ],
  },
  {
    triggerCondition: "COMPLIANCE_RISK",
    priority: "CRITICAL",
    check: (r) => r.entityComplianceScore >= 0.5,
    steps: [
      { type: "COMPLIANCE_CASE", title: "Open compliance review case", description: "Review entity compliance status with compliance team" },
      { type: "DOCUMENT_CORRECTION", title: "Verify entity documentation", description: "Ensure all entity documents are current and valid" },
    ],
  },
  {
    triggerCondition: "CRITICAL_OVERALL_RISK",
    priority: "CRITICAL",
    check: (r) => r.overallRiskScore >= 0.75,
    steps: [
      { type: "CARRIER_REVIEW", title: "Full carrier assessment", description: "Complete carrier due diligence review" },
      { type: "ROUTE_REVIEW", title: "Full route assessment", description: "Comprehensive route risk analysis" },
      { type: "INSURANCE_REVIEW", title: "Insurance adequacy check", description: "Verify insurance covers elevated risk profile" },
      { type: "DELAY_ETD", title: "Departure timing review", description: "Evaluate whether departure should be delayed" },
      { type: "MONITORING", title: "Enhanced monitoring cadence", description: "Daily risk reassessment until departure" },
    ],
  },
];

export async function generatePlaybook(
  shipmentId: string,
  companyId: string,
  triggerSource: "RISK_EVALUATION" | "ALERT" | "GATE_HOLD" | "BOOKING_DECISION" | "MANUAL" = "RISK_EVALUATION",
): Promise<PlaybookResult[]> {
  const [riskReport] = await db
    .select()
    .from(preShipmentRiskReportsTable)
    .where(
      and(
        eq(preShipmentRiskReportsTable.shipmentId, shipmentId),
        eq(preShipmentRiskReportsTable.companyId, companyId),
      ),
    )
    .orderBy(desc(preShipmentRiskReportsTable.evaluatedAt))
    .limit(1);

  if (!riskReport) return [];

  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(and(eq(shipmentsTable.id, shipmentId), eq(shipmentsTable.companyId, companyId)))
    .limit(1);

  if (!shipment) return [];

  const results: PlaybookResult[] = [];

  for (const rule of PLAYBOOK_RULES) {
    if (!rule.check(riskReport, shipment)) continue;

    const existing = await db
      .select({ id: mitigationPlaybooksTable.id })
      .from(mitigationPlaybooksTable)
      .where(
        and(
          eq(mitigationPlaybooksTable.shipmentId, shipmentId),
          eq(mitigationPlaybooksTable.companyId, companyId),
          eq(mitigationPlaybooksTable.triggerCondition, rule.triggerCondition),
          eq(mitigationPlaybooksTable.status, "PENDING"),
        ),
      )
      .limit(1);

    if (existing.length > 0) continue;

    const steps: PlaybookStep[] = rule.steps.map((s, i) => ({
      ...s,
      stepId: `step-${i + 1}`,
      status: "PENDING" as const,
    }));

    const playbookId = generateId("mpb");
    await db.insert(mitigationPlaybooksTable).values({
      id: playbookId,
      companyId,
      shipmentId,
      triggerCondition: rule.triggerCondition,
      triggerSource,
      priority: rule.priority,
      steps,
      totalSteps: steps.length,
    });

    results.push({
      id: playbookId,
      shipmentId,
      triggerCondition: rule.triggerCondition,
      triggerSource,
      priority: rule.priority,
      steps,
      totalSteps: steps.length,
    });
  }

  return results;
}

export async function updatePlaybookStep(
  playbookId: string,
  companyId: string,
  stepId: string,
  status: "IN_PROGRESS" | "COMPLETED" | "SKIPPED",
  linkedRecommendationId?: string,
  linkedTaskId?: string,
) {
  const [playbook] = await db
    .select()
    .from(mitigationPlaybooksTable)
    .where(
      and(
        eq(mitigationPlaybooksTable.id, playbookId),
        eq(mitigationPlaybooksTable.companyId, companyId),
      ),
    )
    .limit(1);

  if (!playbook) return;

  const steps = (playbook.steps as PlaybookStep[]).map((s) => {
    if (s.stepId !== stepId) return s;
    return {
      ...s,
      status,
      linkedRecommendationId: linkedRecommendationId ?? s.linkedRecommendationId,
      linkedTaskId: linkedTaskId ?? s.linkedTaskId,
      completedAt: status === "COMPLETED" ? new Date().toISOString() : s.completedAt,
    };
  });

  const completedCount = steps.filter((s) => s.status === "COMPLETED" || s.status === "SKIPPED").length;
  const allDone = completedCount === steps.length;

  await db
    .update(mitigationPlaybooksTable)
    .set({
      steps,
      completedSteps: completedCount,
      status: allDone ? "COMPLETED" : "IN_PROGRESS",
    })
    .where(eq(mitigationPlaybooksTable.id, playbookId));
}

export async function getPlaybooks(shipmentId: string, companyId: string) {
  return db
    .select()
    .from(mitigationPlaybooksTable)
    .where(
      and(
        eq(mitigationPlaybooksTable.shipmentId, shipmentId),
        eq(mitigationPlaybooksTable.companyId, companyId),
      ),
    )
    .orderBy(desc(mitigationPlaybooksTable.createdAt));
}
