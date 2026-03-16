import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@workspace/db";
import {
  workflowTasksTable,
  taskEventsTable,
  policyDecisionsTable,
  operationalNotificationsTable,
  companiesTable,
  usersTable,
  shipmentsTable,
  recommendationsTable,
} from "@workspace/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import {
  evaluatePolicy,
  applyPolicy,
  computePriorityScore,
} from "@workspace/svc-workflow-orchestrator";
import type { RecommendationInput } from "@workspace/svc-workflow-orchestrator";
import {
  getSlaHours,
  computeDueDate,
  checkEscalation,
} from "@workspace/svc-workflow-orchestrator";
import {
  computeRoutingScore,
  needsAttentionNow,
} from "@workspace/svc-workflow-orchestrator";

const TEST_COMPANY_ID = generateId("cmp");
const TEST_USER_ID = generateId("usr");
const TEST_SHIPMENT_ID = generateId("shp");
const CLEANUP_TASK_IDS: string[] = [];
const CLEANUP_REC_IDS: string[] = [];

function makeRecInput(overrides: Partial<RecommendationInput> = {}): RecommendationInput {
  return {
    id: generateId("rec"),
    companyId: TEST_COMPANY_ID,
    shipmentId: TEST_SHIPMENT_ID,
    type: "COMPLIANCE_ESCALATION",
    urgency: "CRITICAL",
    confidence: 0.92,
    title: "Test recommendation",
    explanation: "Test explanation",
    recommendedAction: "Test action",
    intelligenceEnriched: false,
    expectedDelayImpactDays: null,
    expectedMarginImpactPct: null,
    expectedRiskReduction: null,
    reasonCodes: ["TEST"],
    externalReasonCodes: null,
    ...overrides,
  };
}

describe("Phase 4B: Semi-Autonomous Workflow Orchestration", () => {
  beforeAll(async () => {
    await db.insert(companiesTable).values({
      id: TEST_COMPANY_ID,
      name: "Phase4B Test Co",
      slug: "phase4b-test-co",
    });
    await db.insert(usersTable).values({
      id: TEST_USER_ID,
      companyId: TEST_COMPANY_ID,
      email: "phase4b@test.io",
      passwordHash: "test",
      name: "Phase4B Tester",
      role: "ADMIN",
    });
    await db.insert(shipmentsTable).values({
      id: TEST_SHIPMENT_ID,
      companyId: TEST_COMPANY_ID,
      reference: "TEST-4B-001",
      status: "DRAFT",
    });
  });

  afterAll(async () => {
    for (const tid of CLEANUP_TASK_IDS) {
      await db.delete(taskEventsTable).where(eq(taskEventsTable.taskId, tid));
    }
    await db.delete(workflowTasksTable).where(eq(workflowTasksTable.companyId, TEST_COMPANY_ID));
    await db.delete(policyDecisionsTable).where(eq(policyDecisionsTable.companyId, TEST_COMPANY_ID));
    await db.delete(operationalNotificationsTable).where(eq(operationalNotificationsTable.companyId, TEST_COMPANY_ID));
    await db.delete(recommendationsTable).where(eq(recommendationsTable.companyId, TEST_COMPANY_ID));
    await db.delete(shipmentsTable).where(eq(shipmentsTable.companyId, TEST_COMPANY_ID));
    await db.delete(usersTable).where(eq(usersTable.companyId, TEST_COMPANY_ID));
    await db.delete(companiesTable).where(eq(companiesTable.id, TEST_COMPANY_ID));
  });

  describe("Policy Engine", () => {
    it("should auto-create task for CRITICAL COMPLIANCE_ESCALATION", () => {
      const rec = makeRecInput({ type: "COMPLIANCE_ESCALATION", urgency: "CRITICAL", confidence: 0.9 });
      const result = evaluatePolicy(rec);
      expect(result.outcome).toBe("AUTO_CREATE_TASK");
      expect(result.taskType).toBe("COMPLIANCE_CASE");
      expect(result.priority).toBe("CRITICAL");
    });

    it("should auto-create task for HIGH COMPLIANCE_ESCALATION", () => {
      const rec = makeRecInput({ type: "COMPLIANCE_ESCALATION", urgency: "HIGH", confidence: 0.8 });
      const result = evaluatePolicy(rec);
      expect(result.outcome).toBe("AUTO_CREATE_TASK");
    });

    it("should require manual approval for MEDIUM COMPLIANCE_ESCALATION", () => {
      const rec = makeRecInput({ type: "COMPLIANCE_ESCALATION", urgency: "MEDIUM", confidence: 0.7 });
      const result = evaluatePolicy(rec);
      expect(result.outcome).toBe("REQUIRES_MANUAL_APPROVAL");
    });

    it("should be advisory-only for LOW DOCUMENT_CORRECTION", () => {
      const rec = makeRecInput({ type: "DOCUMENT_CORRECTION", urgency: "LOW", confidence: 0.8 });
      const result = evaluatePolicy(rec);
      expect(result.outcome).toBe("ADVISORY_ONLY");
    });

    it("should auto-create for CRITICAL DOCUMENT_CORRECTION", () => {
      const rec = makeRecInput({ type: "DOCUMENT_CORRECTION", urgency: "CRITICAL", confidence: 0.9 });
      const result = evaluatePolicy(rec);
      expect(result.outcome).toBe("AUTO_CREATE_TASK");
      expect(result.taskType).toBe("DOCUMENT_CORRECTION_TASK");
    });

    it("should reject low-confidence recommendations below threshold", () => {
      const rec = makeRecInput({ type: "DOCUMENT_CORRECTION", urgency: "HIGH", confidence: 0.5 });
      const result = evaluatePolicy(rec);
      expect(result.outcome).toBe("ADVISORY_ONLY");
      expect(result.reason).toContain("Confidence");
    });

    it("should boost intel-enriched recommendations from manual to auto", () => {
      const rec = makeRecInput({ type: "DELAY_WARNING", urgency: "MEDIUM", confidence: 0.7, intelligenceEnriched: true });
      const result = evaluatePolicy(rec);
      expect(result.outcome).toBe("AUTO_CREATE_TASK");
    });

    it("should not boost without intel enrichment", () => {
      const rec = makeRecInput({ type: "DELAY_WARNING", urgency: "MEDIUM", confidence: 0.7, intelligenceEnriched: false });
      const result = evaluatePolicy(rec);
      expect(result.outcome).toBe("REQUIRES_MANUAL_APPROVAL");
    });

    it("should cover all 8 recommendation types", () => {
      const types = [
        "COMPLIANCE_ESCALATION", "DOCUMENT_CORRECTION", "DELAY_WARNING",
        "PRICING_ALERT", "ROUTE_ADJUSTMENT", "CARRIER_SWITCH",
        "RISK_MITIGATION", "INSURANCE_ADJUSTMENT",
      ];
      for (const type of types) {
        const rec = makeRecInput({ type, urgency: "CRITICAL", confidence: 0.95 });
        const result = evaluatePolicy(rec);
        expect(result.outcome).toBeDefined();
        expect(result.taskType).toBeDefined();
        expect(result.dueHours).toBeGreaterThan(0);
      }
    });

    it("should return advisory for unknown recommendation types", () => {
      const rec = makeRecInput({ type: "UNKNOWN_TYPE" as any, urgency: "HIGH" });
      const result = evaluatePolicy(rec);
      expect(result.outcome).toBe("ADVISORY_ONLY");
    });
  });

  describe("Auto Task Creation", () => {
    it("should auto-create task and persist policy decision", async () => {
      const recId = generateId("rec");
      CLEANUP_REC_IDS.push(recId);
      await db.insert(recommendationsTable).values({
        id: recId,
        companyId: TEST_COMPANY_ID,
        shipmentId: TEST_SHIPMENT_ID,
        type: "COMPLIANCE_ESCALATION",
        title: "Auto-create test",
        explanation: "Testing auto creation",
        reasonCodes: ["SANCTIONS_MATCH"],
        recommendedAction: "Escalate immediately",
        urgency: "CRITICAL",
        confidence: "0.95",
        status: "PENDING",
        sourceAgent: "COMPLIANCE",
      });

      const rec = makeRecInput({
        id: recId,
        type: "COMPLIANCE_ESCALATION",
        urgency: "CRITICAL",
        confidence: 0.95,
        title: "Auto-create test",
      });

      const result = await applyPolicy(rec, TEST_USER_ID);
      expect(result.outcome).toBe("AUTO_CREATE_TASK");
      expect(result.taskId).toBeTruthy();
      expect(result.decisionId).toBeTruthy();

      if (result.taskId) CLEANUP_TASK_IDS.push(result.taskId);

      const [task] = await db
        .select()
        .from(workflowTasksTable)
        .where(eq(workflowTasksTable.id, result.taskId!))
        .limit(1);

      expect(task).toBeDefined();
      expect(task!.creationSource).toBe("AUTO_POLICY");
      expect(task!.policyDecisionId).toBe(result.decisionId);
      expect(task!.taskType).toBe("COMPLIANCE_CASE");
      expect(task!.priority).toBe("CRITICAL");
      expect(task!.dueAt).toBeDefined();

      const events = await db
        .select()
        .from(taskEventsTable)
        .where(eq(taskEventsTable.taskId, result.taskId!));
      expect(events.some((e) => e.eventType === "AUTO_CREATED")).toBe(true);

      const [decision] = await db
        .select()
        .from(policyDecisionsTable)
        .where(eq(policyDecisionsTable.id, result.decisionId))
        .limit(1);
      expect(decision).toBeDefined();
      expect(decision!.applied).toBe(true);
      expect(decision!.outcome).toBe("AUTO_CREATE_TASK");
    });

    it("should not duplicate task for same recommendation", async () => {
      const recId = generateId("rec");
      CLEANUP_REC_IDS.push(recId);
      await db.insert(recommendationsTable).values({
        id: recId,
        companyId: TEST_COMPANY_ID,
        shipmentId: TEST_SHIPMENT_ID,
        type: "RISK_MITIGATION",
        title: "Dedup test",
        explanation: "Testing dedup",
        reasonCodes: ["HIGH_RISK"],
        recommendedAction: "Mitigate",
        urgency: "CRITICAL",
        confidence: "0.9",
        status: "PENDING",
        sourceAgent: "RISK",
      });

      const rec = makeRecInput({
        id: recId,
        type: "RISK_MITIGATION",
        urgency: "CRITICAL",
        confidence: 0.9,
        title: "Dedup test",
      });

      const result1 = await applyPolicy(rec, TEST_USER_ID);
      if (result1.taskId) CLEANUP_TASK_IDS.push(result1.taskId);
      expect(result1.outcome).toBe("AUTO_CREATE_TASK");

      const result2 = await applyPolicy(rec, TEST_USER_ID);
      expect(result2.outcome).toBe("REFRESH_EXISTING_TASK_PRIORITY");
      expect(result2.taskId).toBe(result1.taskId);
    });

    it("should create notification for auto-created task", async () => {
      const notifications = await db
        .select()
        .from(operationalNotificationsTable)
        .where(
          and(
            eq(operationalNotificationsTable.companyId, TEST_COMPANY_ID),
            eq(operationalNotificationsTable.eventType, "TASK_AUTO_CREATED"),
          ),
        );
      expect(notifications.length).toBeGreaterThan(0);
    });
  });

  describe("SLA Rules", () => {
    it("should return correct SLA hours by type and priority", () => {
      expect(getSlaHours("COMPLIANCE_CASE", "CRITICAL")).toBe(2);
      expect(getSlaHours("COMPLIANCE_CASE", "HIGH")).toBe(8);
      expect(getSlaHours("COMPLIANCE_CASE", "MEDIUM")).toBe(48);
      expect(getSlaHours("COMPLIANCE_CASE", "LOW")).toBe(168);
      expect(getSlaHours("DISRUPTION_RESPONSE_TASK", "CRITICAL")).toBe(2);
      expect(getSlaHours("DELAY_RESPONSE_TASK", "HIGH")).toBe(8);
    });

    it("should compute due date from SLA", () => {
      const now = new Date();
      const due = computeDueDate("COMPLIANCE_CASE", "CRITICAL", now);
      const diffHours = (due.getTime() - now.getTime()) / (60 * 60 * 1000);
      expect(Math.round(diffHours)).toBe(2);
    });

    it("should detect escalation when SLA threshold passed", () => {
      const created = new Date(Date.now() - 6 * 60 * 60 * 1000);
      const due = new Date(Date.now() + 2 * 60 * 60 * 1000);

      const result = checkEscalation({
        id: "test-task",
        taskType: "COMPLIANCE_CASE",
        priority: "CRITICAL",
        dueAt: due,
        escalationLevel: 0,
        status: "OPEN",
        createdAt: created,
      });

      expect(result.shouldEscalate).toBe(true);
      expect(result.newLevel).toBeGreaterThan(0);
      expect(result.slaPercentUsed).toBeGreaterThan(0.5);
    });

    it("should not escalate when SLA is fresh", () => {
      const created = new Date(Date.now() - 10 * 60 * 1000);
      const due = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const result = checkEscalation({
        id: "test-task",
        taskType: "PRICING_REVIEW",
        priority: "MEDIUM",
        dueAt: due,
        escalationLevel: 0,
        status: "OPEN",
        createdAt: created,
      });

      expect(result.shouldEscalate).toBe(false);
    });

    it("should detect overdue tasks", () => {
      const created = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const due = new Date(Date.now() - 1 * 60 * 60 * 1000);

      const result = checkEscalation({
        id: "test-task",
        taskType: "COMPLIANCE_CASE",
        priority: "HIGH",
        dueAt: due,
        escalationLevel: 0,
        status: "OPEN",
        createdAt: created,
      });

      expect(result.isOverdue).toBe(true);
      expect(result.shouldEscalate).toBe(true);
    });

    it("should respect max escalation level", () => {
      const created = new Date(Date.now() - 100 * 60 * 60 * 1000);
      const due = new Date(Date.now() - 50 * 60 * 60 * 1000);

      const result = checkEscalation({
        id: "test-task",
        taskType: "PRICING_REVIEW",
        priority: "HIGH",
        dueAt: due,
        escalationLevel: 2,
        status: "OPEN",
        createdAt: created,
      });

      expect(result.shouldEscalate).toBe(false);
      expect(result.newLevel).toBe(2);
    });
  });

  describe("Priority Scoring and Routing", () => {
    it("should compute higher score for CRITICAL priority", () => {
      const criticalScore = computeRoutingScore({
        priority: "CRITICAL",
        priorityScore: null,
        dueAt: null,
        escalationLevel: 0,
        status: "OPEN",
        createdAt: new Date(),
      });

      const lowScore = computeRoutingScore({
        priority: "LOW",
        priorityScore: null,
        dueAt: null,
        escalationLevel: 0,
        status: "OPEN",
        createdAt: new Date(),
      });

      expect(criticalScore).toBeGreaterThan(lowScore);
    });

    it("should boost score for overdue tasks", () => {
      const overdueScore = computeRoutingScore({
        priority: "MEDIUM",
        priorityScore: null,
        dueAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        escalationLevel: 0,
        status: "OPEN",
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      const freshScore = computeRoutingScore({
        priority: "MEDIUM",
        priorityScore: null,
        dueAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        escalationLevel: 0,
        status: "OPEN",
        createdAt: new Date(),
      });

      expect(overdueScore).toBeGreaterThan(freshScore);
    });

    it("should boost score for escalated tasks", () => {
      const escalatedScore = computeRoutingScore({
        priority: "MEDIUM",
        priorityScore: null,
        dueAt: null,
        escalationLevel: 2,
        status: "OPEN",
        createdAt: new Date(),
      });

      const normalScore = computeRoutingScore({
        priority: "MEDIUM",
        priorityScore: null,
        dueAt: null,
        escalationLevel: 0,
        status: "OPEN",
        createdAt: new Date(),
      });

      expect(escalatedScore).toBeGreaterThan(normalScore);
    });

    it("should mark CRITICAL tasks as needing attention", () => {
      expect(
        needsAttentionNow({
          priority: "CRITICAL",
          dueAt: null,
          escalationLevel: 0,
          status: "OPEN",
        }),
      ).toBe(true);
    });

    it("should mark overdue tasks as needing attention", () => {
      expect(
        needsAttentionNow({
          priority: "MEDIUM",
          dueAt: new Date(Date.now() - 60000),
          escalationLevel: 0,
          status: "OPEN",
        }),
      ).toBe(true);
    });

    it("should mark highly-escalated tasks as needing attention", () => {
      expect(
        needsAttentionNow({
          priority: "MEDIUM",
          dueAt: null,
          escalationLevel: 2,
          status: "OPEN",
        }),
      ).toBe(true);
    });

    it("should NOT mark fresh LOW tasks as needing attention", () => {
      expect(
        needsAttentionNow({
          priority: "LOW",
          dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          escalationLevel: 0,
          status: "OPEN",
        }),
      ).toBe(false);
    });
  });

  describe("Policy Priority Score", () => {
    it("should compute score from recommendation attributes", () => {
      const rec = makeRecInput({
        confidence: 0.9,
        expectedDelayImpactDays: 7,
        expectedMarginImpactPct: -10,
        expectedRiskReduction: 20,
        intelligenceEnriched: true,
      });
      const result = evaluatePolicy(rec);
      const score = computePriorityScore(rec, result);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(2);
    });

    it("should give higher score to higher-impact recommendations", () => {
      const highImpact = makeRecInput({
        confidence: 0.95,
        expectedDelayImpactDays: 14,
        expectedMarginImpactPct: -20,
        expectedRiskReduction: 30,
        intelligenceEnriched: true,
        urgency: "CRITICAL",
      });
      const lowImpact = makeRecInput({
        confidence: 0.6,
        expectedDelayImpactDays: 1,
        expectedMarginImpactPct: -2,
        expectedRiskReduction: 5,
        intelligenceEnriched: false,
        urgency: "LOW",
      });

      const highResult = evaluatePolicy(highImpact);
      const lowResult = evaluatePolicy(lowImpact);
      const highScore = computePriorityScore(highImpact, highResult);
      const lowScore = computePriorityScore(lowImpact, lowResult);
      expect(highScore).toBeGreaterThan(lowScore);
    });
  });

  describe("Notification Generation", () => {
    it("should create notifications during auto-task creation", async () => {
      const recId = generateId("rec");
      CLEANUP_REC_IDS.push(recId);
      await db.insert(recommendationsTable).values({
        id: recId,
        companyId: TEST_COMPANY_ID,
        shipmentId: TEST_SHIPMENT_ID,
        type: "DELAY_WARNING",
        title: "Notification test",
        explanation: "Testing notifications",
        reasonCodes: ["DELAY"],
        recommendedAction: "Respond",
        urgency: "CRITICAL",
        confidence: "0.9",
        status: "PENDING",
        sourceAgent: "RISK",
      });

      const rec = makeRecInput({
        id: recId,
        type: "DELAY_WARNING",
        urgency: "CRITICAL",
        confidence: 0.9,
        title: "Notification test",
      });

      const result = await applyPolicy(rec, TEST_USER_ID);
      if (result.taskId) CLEANUP_TASK_IDS.push(result.taskId);

      const notifications = await db
        .select()
        .from(operationalNotificationsTable)
        .where(
          and(
            eq(operationalNotificationsTable.companyId, TEST_COMPANY_ID),
            eq(operationalNotificationsTable.relatedRecommendationId, recId),
          ),
        );

      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0]!.eventType).toBe("TASK_AUTO_CREATED");
      expect(notifications[0]!.read).toBe(false);
    });
  });

  describe("All Policy Outcomes Coverage", () => {
    it("ADVISORY_ONLY for low-confidence CARRIER_SWITCH", () => {
      const rec = makeRecInput({ type: "CARRIER_SWITCH", urgency: "HIGH", confidence: 0.5 });
      const result = evaluatePolicy(rec);
      expect(result.outcome).toBe("ADVISORY_ONLY");
    });

    it("REQUIRES_MANUAL_APPROVAL for MEDIUM ROUTE_ADJUSTMENT", () => {
      const rec = makeRecInput({ type: "ROUTE_ADJUSTMENT", urgency: "MEDIUM", confidence: 0.8 });
      const result = evaluatePolicy(rec);
      expect(result.outcome).toBe("REQUIRES_MANUAL_APPROVAL");
    });

    it("AUTO_CREATE_TASK for CRITICAL RISK_MITIGATION", () => {
      const rec = makeRecInput({ type: "RISK_MITIGATION", urgency: "CRITICAL", confidence: 0.85 });
      const result = evaluatePolicy(rec);
      expect(result.outcome).toBe("AUTO_CREATE_TASK");
    });

    it("ADVISORY_ONLY for LOW INSURANCE_ADJUSTMENT", () => {
      const rec = makeRecInput({ type: "INSURANCE_ADJUSTMENT", urgency: "LOW", confidence: 0.7 });
      const result = evaluatePolicy(rec);
      expect(result.outcome).toBe("ADVISORY_ONLY");
    });

    it("Intel boost upgrades ADVISORY to MANUAL for high-confidence", () => {
      const rec = makeRecInput({
        type: "INSURANCE_ADJUSTMENT",
        urgency: "MEDIUM",
        confidence: 0.8,
        intelligenceEnriched: true,
      });
      const result = evaluatePolicy(rec);
      expect(result.outcome).toBe("REQUIRES_MANUAL_APPROVAL");
    });

    it("AUTO_ESCALATE_EXISTING_TASK for critical+intel+high-delay recommendations", () => {
      const rec = makeRecInput({
        type: "COMPLIANCE_ESCALATION",
        urgency: "CRITICAL",
        confidence: 0.92,
        intelligenceEnriched: true,
        expectedDelayImpactDays: 10,
      });
      const result = evaluatePolicy(rec);
      expect(result.outcome).toBe("AUTO_ESCALATE_EXISTING_TASK");
    });

    it("AUTO_ESCALATE falls back to AUTO_CREATE when no existing task in applyPolicy", async () => {
      const recId = generateId("rec");
      CLEANUP_REC_IDS.push(recId);
      await db.insert(recommendationsTable).values({
        id: recId,
        companyId: TEST_COMPANY_ID,
        shipmentId: TEST_SHIPMENT_ID,
        type: "COMPLIANCE_ESCALATION",
        urgency: "CRITICAL",
        confidence: 0.92,
        title: "Escalation test rec",
        explanation: "Test escalation explanation",
        recommendedAction: "Test action",
        reasonCodes: ["TEST"],
        sourceAgent: "test-agent",
        status: "PENDING",
      });

      const rec = makeRecInput({
        id: recId,
        type: "COMPLIANCE_ESCALATION",
        urgency: "CRITICAL",
        confidence: 0.92,
        intelligenceEnriched: true,
        expectedDelayImpactDays: 10,
      });

      const applied = await applyPolicy(rec, TEST_USER_ID);
      if (applied.taskId) CLEANUP_TASK_IDS.push(applied.taskId);
      expect(applied.outcome).toBe("AUTO_CREATE_TASK");
      expect(applied.taskId).toBeTruthy();
    });

    it("AUTO_ESCALATE escalates existing task when one exists", async () => {
      const recId = generateId("rec");
      CLEANUP_REC_IDS.push(recId);
      await db.insert(recommendationsTable).values({
        id: recId,
        companyId: TEST_COMPANY_ID,
        shipmentId: TEST_SHIPMENT_ID,
        type: "COMPLIANCE_ESCALATION",
        urgency: "CRITICAL",
        confidence: 0.92,
        title: "Escalation existing test",
        explanation: "Test escalation explanation",
        recommendedAction: "Test action",
        reasonCodes: ["TEST"],
        sourceAgent: "test-agent",
        status: "PENDING",
      });

      const existingTaskId = generateId("tsk");
      CLEANUP_TASK_IDS.push(existingTaskId);
      await db.insert(workflowTasksTable).values({
        id: existingTaskId,
        companyId: TEST_COMPANY_ID,
        shipmentId: TEST_SHIPMENT_ID,
        recommendationId: recId,
        taskType: "COMPLIANCE_CASE",
        title: "Existing compliance task",
        status: "OPEN",
        priority: "HIGH",
        createdBy: TEST_USER_ID,
      });

      const rec = makeRecInput({
        id: recId,
        type: "COMPLIANCE_ESCALATION",
        urgency: "CRITICAL",
        confidence: 0.92,
        intelligenceEnriched: true,
        expectedDelayImpactDays: 10,
      });

      const applied = await applyPolicy(rec, TEST_USER_ID);
      expect(applied.outcome).toBe("AUTO_ESCALATE_EXISTING_TASK");
      expect(applied.taskId).toBe(existingTaskId);

      const [updated] = await db
        .select()
        .from(workflowTasksTable)
        .where(eq(workflowTasksTable.id, existingTaskId))
        .limit(1);
      expect(updated!.escalationLevel).toBe(1);
      expect(updated!.priority).toBe("CRITICAL");
    });
  });
});
