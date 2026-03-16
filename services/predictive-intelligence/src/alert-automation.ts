import { db } from "@workspace/db";
import {
  predictiveAlertsTable,
  shipmentsTable,
  recommendationsTable,
  workflowTasksTable,
  releaseGateHoldsTable,
  usersTable,
} from "@workspace/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import { generatePlaybook } from "./mitigation-playbooks.js";

export interface AlertAutomationResult {
  alertId: string;
  recommendationsCreated: number;
  tasksCreated: number;
  holdsCreated: number;
  playbooksGenerated: number;
}

export async function automateAlertActions(
  alertId: string,
  companyId: string,
): Promise<AlertAutomationResult> {
  const [alert] = await db
    .select()
    .from(predictiveAlertsTable)
    .where(
      and(
        eq(predictiveAlertsTable.id, alertId),
        eq(predictiveAlertsTable.companyId, companyId),
      ),
    )
    .limit(1);

  if (!alert || alert.status !== "ACTIVE") {
    return { alertId, recommendationsCreated: 0, tasksCreated: 0, holdsCreated: 0, playbooksGenerated: 0 };
  }

  const affectedShipmentIds = (alert.affectedShipmentIds as string[]) ?? [];
  let recommendationsCreated = 0;
  let tasksCreated = 0;
  let holdsCreated = 0;
  let playbooksGenerated = 0;

  for (const shipmentId of affectedShipmentIds) {
    const [shipment] = await db
      .select()
      .from(shipmentsTable)
      .where(
        and(
          eq(shipmentsTable.id, shipmentId),
          eq(shipmentsTable.companyId, companyId),
          inArray(shipmentsTable.status, ["DRAFT", "PENDING_REVIEW", "APPROVED"]),
        ),
      )
      .limit(1);

    if (!shipment) continue;

    const recFingerprint = `ALERT-${alertId}-${shipmentId}`;
    const existingRec = await db
      .select({ id: recommendationsTable.id })
      .from(recommendationsTable)
      .where(eq(recommendationsTable.fingerprint, recFingerprint))
      .limit(1);

    if (existingRec.length === 0) {
      const recId = generateId("rec");
      const urgency = alertSeverityToUrgency(alert.severity);

      await db.insert(recommendationsTable).values({
        id: recId,
        companyId,
        shipmentId,
        fingerprint: recFingerprint,
        type: alertTypeToRecType(alert.alertType),
        title: `[Predictive Alert] ${alert.title}`,
        explanation: alert.description,
        urgency,
        recommendedAction: getRecommendedAction(alert.alertType),
        status: "PENDING",
        sourceAgent: "predictive-intelligence",
        confidence: alert.confidenceScore,
        expectedRiskReduction: alert.predictedImpactDays ? Math.min(alert.predictedImpactDays * 5, 30) : 10,
        reasonCodes: ["PREDICTIVE_ALERT", alert.alertType],
      });

      recommendationsCreated++;

      if (alert.severity === "CRITICAL") {
        const taskId = generateId("tsk");
        const [firstUser] = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(eq(usersTable.companyId, companyId))
          .limit(1);
        if (firstUser) {
          await db.insert(workflowTasksTable).values({
            id: taskId,
            companyId,
            shipmentId,
            recommendationId: recId,
            taskType: alertTypeToTaskType(alert.alertType),
            title: `[Urgent] ${alert.title}`,
            description: `Auto-created from critical predictive alert: ${alert.description}`,
            status: "OPEN",
            priority: "CRITICAL",
            createdBy: firstUser.id,
            creationSource: "AUTO_POLICY",
            dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          });
          tasksCreated++;
        }
      }
    }

    if (alert.severity === "CRITICAL" || alert.alertType === "DISRUPTION_CLUSTER") {
      const gateType = alertTypeToGateType(alert.alertType);
      if (gateType) {
        const existingHold = await db
          .select({ id: releaseGateHoldsTable.id })
          .from(releaseGateHoldsTable)
          .where(
            and(
              eq(releaseGateHoldsTable.shipmentId, shipmentId),
              eq(releaseGateHoldsTable.companyId, companyId),
              eq(releaseGateHoldsTable.gateType, gateType),
              eq(releaseGateHoldsTable.status, "ACTIVE"),
            ),
          )
          .limit(1);

        if (existingHold.length === 0) {
          await db.insert(releaseGateHoldsTable).values({
            id: generateId("rgh"),
            companyId,
            shipmentId,
            gateType,
            severity: alert.severity === "CRITICAL" ? "CRITICAL" : "HIGH",
            reason: `Triggered by predictive alert: ${alert.title}`,
            policyRule: `ALERT_${alert.alertType}`,
            requiredAction: getRecommendedAction(alert.alertType),
            triggerData: { alertId: alert.id, alertType: alert.alertType },
          });
          holdsCreated++;
        }
      }
    }

    const playbooks = await generatePlaybook(shipmentId, companyId, "ALERT");
    playbooksGenerated += playbooks.length;
  }

  return { alertId, recommendationsCreated, tasksCreated, holdsCreated, playbooksGenerated };
}

export async function batchAutomateAlerts(companyId: string): Promise<AlertAutomationResult[]> {
  const activeAlerts = await db
    .select()
    .from(predictiveAlertsTable)
    .where(
      and(
        eq(predictiveAlertsTable.companyId, companyId),
        eq(predictiveAlertsTable.status, "ACTIVE"),
      ),
    )
    .orderBy(desc(predictiveAlertsTable.createdAt))
    .limit(50);

  const results: AlertAutomationResult[] = [];
  for (const alert of activeAlerts) {
    const result = await automateAlertActions(alert.id, companyId);
    results.push(result);
  }
  return results;
}

function alertSeverityToUrgency(severity: string): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  switch (severity) {
    case "CRITICAL": return "CRITICAL";
    case "WARNING": return "HIGH";
    default: return "MEDIUM";
  }
}

function alertTypeToRecType(alertType: string): string {
  switch (alertType) {
    case "CONGESTION_TREND":
    case "PORT_RISK_ESCALATION":
      return "ROUTE_CHANGE";
    case "DISRUPTION_CLUSTER":
      return "RISK_MITIGATION";
    case "WEATHER_FORECAST":
      return "DEPARTURE_TIMING";
    case "CARRIER_DEGRADATION":
      return "CARRIER_CHANGE";
    case "LANE_STRESS_RISING":
      return "ROUTE_CHANGE";
    default:
      return "RISK_MITIGATION";
  }
}

function alertTypeToTaskType(alertType: string): string {
  switch (alertType) {
    case "CONGESTION_TREND":
    case "PORT_RISK_ESCALATION":
    case "LANE_STRESS_RISING":
      return "ROUTE_REVIEW";
    case "DISRUPTION_CLUSTER":
      return "EXCEPTION_RESOLUTION";
    case "WEATHER_FORECAST":
      return "SCHEDULE_REVIEW";
    case "CARRIER_DEGRADATION":
      return "CARRIER_REVIEW";
    default:
      return "GENERAL_REVIEW";
  }
}

function alertTypeToGateType(alertType: string): string | null {
  switch (alertType) {
    case "DISRUPTION_CLUSTER":
      return "DISRUPTION_APPROVAL";
    case "WEATHER_FORECAST":
      return "WEATHER_HOLD";
    case "LANE_STRESS_RISING":
      return "LANE_STRESS_HOLD";
    default:
      return null;
  }
}

function getRecommendedAction(alertType: string): string {
  switch (alertType) {
    case "CONGESTION_TREND":
      return "Monitor congestion trends and consider alternate ports";
    case "DISRUPTION_CLUSTER":
      return "Review disruption impact and plan contingency routing";
    case "WEATHER_FORECAST":
      return "Evaluate weather window and consider delayed departure";
    case "CARRIER_DEGRADATION":
      return "Evaluate alternate carriers with better reliability";
    case "LANE_STRESS_RISING":
      return "Consider alternate lane or departure timing";
    case "PORT_RISK_ESCALATION":
      return "Monitor port risk and evaluate diversion options";
    default:
      return "Review alert and take appropriate action";
  }
}
