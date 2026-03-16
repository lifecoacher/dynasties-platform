import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@workspace/db";
import {
  workflowTasksTable,
  taskEventsTable,
  companiesTable,
  usersTable,
  shipmentsTable,
  recommendationsTable,
} from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";

const TEST_COMPANY_ID = generateId("cmp");
const TEST_USER_ID = generateId("usr");
const TEST_SHIPMENT_ID = generateId("shp");
const TEST_REC_ID = generateId("rec");
const TEST_TASK_IDS: string[] = [];

describe("Phase 4A: Workflow Task & Case Management", () => {
  beforeAll(async () => {
    await db.insert(companiesTable).values({
      id: TEST_COMPANY_ID,
      name: "Phase4A Test Co",
      slug: "phase4a-test-co",
    });
    await db.insert(usersTable).values({
      id: TEST_USER_ID,
      companyId: TEST_COMPANY_ID,
      email: "phase4a@test.io",
      passwordHash: "test",
      name: "Phase4A Tester",
      role: "ADMIN",
    });
    await db.insert(shipmentsTable).values({
      id: TEST_SHIPMENT_ID,
      companyId: TEST_COMPANY_ID,
      reference: "TEST-4A-001",
      status: "DRAFT",
    });
    await db.insert(recommendationsTable).values({
      id: TEST_REC_ID,
      companyId: TEST_COMPANY_ID,
      shipmentId: TEST_SHIPMENT_ID,
      type: "COMPLIANCE_ESCALATION",
      title: "Sanctions screening required",
      explanation: "Entity matches OFAC SDN list",
      reasonCodes: ["SANCTIONS_MATCH"],
      recommendedAction: "Escalate to compliance team for manual review",
      urgency: "CRITICAL",
      confidence: "0.92",
      status: "ACCEPTED",
      sourceAgent: "COMPLIANCE",
    });
  });

  afterAll(async () => {
    for (const tid of TEST_TASK_IDS) {
      await db.delete(taskEventsTable).where(eq(taskEventsTable.taskId, tid));
    }
    await db.delete(workflowTasksTable).where(eq(workflowTasksTable.companyId, TEST_COMPANY_ID));
    await db.delete(recommendationsTable).where(eq(recommendationsTable.companyId, TEST_COMPANY_ID));
    await db.delete(shipmentsTable).where(eq(shipmentsTable.companyId, TEST_COMPANY_ID));
    await db.delete(usersTable).where(eq(usersTable.companyId, TEST_COMPANY_ID));
    await db.delete(companiesTable).where(eq(companiesTable.id, TEST_COMPANY_ID));
  });

  describe("Task CRUD", () => {
    it("should create a task directly", async () => {
      const taskId = generateId("tsk");
      TEST_TASK_IDS.push(taskId);

      await db.insert(workflowTasksTable).values({
        id: taskId,
        companyId: TEST_COMPANY_ID,
        shipmentId: TEST_SHIPMENT_ID,
        taskType: "COMPLIANCE_CASE",
        title: "Test compliance case",
        description: "Testing task creation",
        status: "OPEN",
        priority: "HIGH",
        createdBy: TEST_USER_ID,
      });

      const [task] = await db
        .select()
        .from(workflowTasksTable)
        .where(eq(workflowTasksTable.id, taskId))
        .limit(1);

      expect(task).toBeDefined();
      expect(task!.taskType).toBe("COMPLIANCE_CASE");
      expect(task!.status).toBe("OPEN");
      expect(task!.priority).toBe("HIGH");
      expect(task!.companyId).toBe(TEST_COMPANY_ID);
    });

    it("should create task from recommendation", async () => {
      const taskId = generateId("tsk");
      TEST_TASK_IDS.push(taskId);
      const eventId = generateId("tev");

      const [rec] = await db
        .select()
        .from(recommendationsTable)
        .where(eq(recommendationsTable.id, TEST_REC_ID))
        .limit(1);

      expect(rec).toBeDefined();

      await db.insert(workflowTasksTable).values({
        id: taskId,
        companyId: TEST_COMPANY_ID,
        shipmentId: rec!.shipmentId,
        recommendationId: TEST_REC_ID,
        taskType: "COMPLIANCE_CASE",
        title: rec!.title,
        description: rec!.explanation,
        status: "OPEN",
        priority: "CRITICAL",
        createdBy: TEST_USER_ID,
        executionNotes: rec!.recommendedAction,
        metadata: {
          recommendationType: rec!.type,
          urgency: rec!.urgency,
          confidence: Number(rec!.confidence),
        },
      });

      await db.insert(taskEventsTable).values({
        id: eventId,
        companyId: TEST_COMPANY_ID,
        taskId,
        eventType: "CREATED",
        actorId: TEST_USER_ID,
        afterValue: "OPEN",
        notes: `Created from recommendation: ${rec!.title}`,
      });

      const [task] = await db
        .select()
        .from(workflowTasksTable)
        .where(eq(workflowTasksTable.id, taskId))
        .limit(1);

      expect(task!.recommendationId).toBe(TEST_REC_ID);
      expect(task!.metadata).toMatchObject({ recommendationType: "COMPLIANCE_ESCALATION" });

      const events = await db
        .select()
        .from(taskEventsTable)
        .where(eq(taskEventsTable.taskId, taskId));

      expect(events.length).toBe(1);
      expect(events[0]!.eventType).toBe("CREATED");
    });

    it("should query tasks by status", async () => {
      const tasks = await db
        .select()
        .from(workflowTasksTable)
        .where(
          and(
            eq(workflowTasksTable.companyId, TEST_COMPANY_ID),
            eq(workflowTasksTable.status, "OPEN"),
          ),
        );

      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks.every((t) => t.status === "OPEN")).toBe(true);
    });

    it("should query tasks by type", async () => {
      const tasks = await db
        .select()
        .from(workflowTasksTable)
        .where(
          and(
            eq(workflowTasksTable.companyId, TEST_COMPANY_ID),
            eq(workflowTasksTable.taskType, "COMPLIANCE_CASE"),
          ),
        );

      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks.every((t) => t.taskType === "COMPLIANCE_CASE")).toBe(true);
    });
  });

  describe("Task State Transitions", () => {
    let transitionTaskId: string;

    beforeAll(async () => {
      transitionTaskId = generateId("tsk");
      TEST_TASK_IDS.push(transitionTaskId);
      await db.insert(workflowTasksTable).values({
        id: transitionTaskId,
        companyId: TEST_COMPANY_ID,
        shipmentId: TEST_SHIPMENT_ID,
        taskType: "PRICING_REVIEW",
        title: "Review margin impact",
        status: "OPEN",
        priority: "MEDIUM",
        createdBy: TEST_USER_ID,
      });
    });

    it("should transition OPEN → IN_PROGRESS", async () => {
      await db
        .update(workflowTasksTable)
        .set({ status: "IN_PROGRESS" })
        .where(eq(workflowTasksTable.id, transitionTaskId));

      await db.insert(taskEventsTable).values({
        id: generateId("tev"),
        companyId: TEST_COMPANY_ID,
        taskId: transitionTaskId,
        eventType: "STATUS_CHANGED",
        actorId: TEST_USER_ID,
        beforeValue: "OPEN",
        afterValue: "IN_PROGRESS",
      });

      const [task] = await db
        .select()
        .from(workflowTasksTable)
        .where(eq(workflowTasksTable.id, transitionTaskId));

      expect(task!.status).toBe("IN_PROGRESS");
    });

    it("should transition IN_PROGRESS → BLOCKED", async () => {
      await db
        .update(workflowTasksTable)
        .set({ status: "BLOCKED" })
        .where(eq(workflowTasksTable.id, transitionTaskId));

      await db.insert(taskEventsTable).values({
        id: generateId("tev"),
        companyId: TEST_COMPANY_ID,
        taskId: transitionTaskId,
        eventType: "STATUS_CHANGED",
        actorId: TEST_USER_ID,
        beforeValue: "IN_PROGRESS",
        afterValue: "BLOCKED",
        notes: "Awaiting carrier response",
      });

      const [task] = await db
        .select()
        .from(workflowTasksTable)
        .where(eq(workflowTasksTable.id, transitionTaskId));

      expect(task!.status).toBe("BLOCKED");
    });

    it("should transition BLOCKED → IN_PROGRESS → COMPLETED", async () => {
      await db
        .update(workflowTasksTable)
        .set({ status: "IN_PROGRESS" })
        .where(eq(workflowTasksTable.id, transitionTaskId));

      await db
        .update(workflowTasksTable)
        .set({ status: "COMPLETED", completedAt: new Date(), completionNotes: "Margin reviewed and approved" })
        .where(eq(workflowTasksTable.id, transitionTaskId));

      await db.insert(taskEventsTable).values({
        id: generateId("tev"),
        companyId: TEST_COMPANY_ID,
        taskId: transitionTaskId,
        eventType: "COMPLETED",
        actorId: TEST_USER_ID,
        beforeValue: "IN_PROGRESS",
        afterValue: "COMPLETED",
        notes: "Margin reviewed and approved",
      });

      const [task] = await db
        .select()
        .from(workflowTasksTable)
        .where(eq(workflowTasksTable.id, transitionTaskId));

      expect(task!.status).toBe("COMPLETED");
      expect(task!.completedAt).toBeDefined();
      expect(task!.completionNotes).toBe("Margin reviewed and approved");
    });
  });

  describe("Audit Trail", () => {
    let auditTaskId: string;

    beforeAll(async () => {
      auditTaskId = generateId("tsk");
      TEST_TASK_IDS.push(auditTaskId);
      await db.insert(workflowTasksTable).values({
        id: auditTaskId,
        companyId: TEST_COMPANY_ID,
        taskType: "CARRIER_REVIEW",
        title: "Carrier performance review",
        status: "OPEN",
        priority: "LOW",
        createdBy: TEST_USER_ID,
      });

      await db.insert(taskEventsTable).values({
        id: generateId("tev"),
        companyId: TEST_COMPANY_ID,
        taskId: auditTaskId,
        eventType: "CREATED",
        actorId: TEST_USER_ID,
        afterValue: "OPEN",
      });
    });

    it("should record assignment event", async () => {
      await db
        .update(workflowTasksTable)
        .set({ assignedTo: TEST_USER_ID })
        .where(eq(workflowTasksTable.id, auditTaskId));

      await db.insert(taskEventsTable).values({
        id: generateId("tev"),
        companyId: TEST_COMPANY_ID,
        taskId: auditTaskId,
        eventType: "ASSIGNED",
        actorId: TEST_USER_ID,
        beforeValue: null,
        afterValue: TEST_USER_ID,
      });

      const events = await db
        .select()
        .from(taskEventsTable)
        .where(eq(taskEventsTable.taskId, auditTaskId))
        .orderBy(desc(taskEventsTable.createdAt));

      expect(events.length).toBeGreaterThanOrEqual(2);
      const assignEvent = events.find((e) => e.eventType === "ASSIGNED");
      expect(assignEvent).toBeDefined();
      expect(assignEvent!.afterValue).toBe(TEST_USER_ID);
    });

    it("should record priority change event", async () => {
      await db
        .update(workflowTasksTable)
        .set({ priority: "CRITICAL" })
        .where(eq(workflowTasksTable.id, auditTaskId));

      await db.insert(taskEventsTable).values({
        id: generateId("tev"),
        companyId: TEST_COMPANY_ID,
        taskId: auditTaskId,
        eventType: "PRIORITY_CHANGED",
        actorId: TEST_USER_ID,
        beforeValue: "LOW",
        afterValue: "CRITICAL",
      });

      const events = await db
        .select()
        .from(taskEventsTable)
        .where(
          and(
            eq(taskEventsTable.taskId, auditTaskId),
            eq(taskEventsTable.eventType, "PRIORITY_CHANGED"),
          ),
        );

      expect(events.length).toBe(1);
      expect(events[0]!.beforeValue).toBe("LOW");
      expect(events[0]!.afterValue).toBe("CRITICAL");
    });

    it("should record note added event", async () => {
      await db.insert(taskEventsTable).values({
        id: generateId("tev"),
        companyId: TEST_COMPANY_ID,
        taskId: auditTaskId,
        eventType: "NOTE_ADDED",
        actorId: TEST_USER_ID,
        notes: "Contacted carrier regarding late arrivals",
      });

      const events = await db
        .select()
        .from(taskEventsTable)
        .where(
          and(
            eq(taskEventsTable.taskId, auditTaskId),
            eq(taskEventsTable.eventType, "NOTE_ADDED"),
          ),
        );

      expect(events.length).toBe(1);
      expect(events[0]!.notes).toContain("Contacted carrier");
    });

    it("should record due date change event", async () => {
      const newDue = new Date(Date.now() + 48 * 60 * 60 * 1000);
      await db
        .update(workflowTasksTable)
        .set({ dueAt: newDue })
        .where(eq(workflowTasksTable.id, auditTaskId));

      await db.insert(taskEventsTable).values({
        id: generateId("tev"),
        companyId: TEST_COMPANY_ID,
        taskId: auditTaskId,
        eventType: "DUE_DATE_CHANGED",
        actorId: TEST_USER_ID,
        beforeValue: null,
        afterValue: newDue.toISOString(),
      });

      const events = await db
        .select()
        .from(taskEventsTable)
        .where(
          and(
            eq(taskEventsTable.taskId, auditTaskId),
            eq(taskEventsTable.eventType, "DUE_DATE_CHANGED"),
          ),
        );

      expect(events.length).toBe(1);
    });

    it("should have complete audit trail in chronological order", async () => {
      const events = await db
        .select()
        .from(taskEventsTable)
        .where(eq(taskEventsTable.taskId, auditTaskId))
        .orderBy(taskEventsTable.createdAt);

      expect(events.length).toBeGreaterThanOrEqual(5);
      const types = events.map((e) => e.eventType);
      expect(types).toContain("CREATED");
      expect(types).toContain("ASSIGNED");
      expect(types).toContain("PRIORITY_CHANGED");
      expect(types).toContain("NOTE_ADDED");
      expect(types).toContain("DUE_DATE_CHANGED");
    });
  });

  describe("Task Type Mapping", () => {
    const RECOMMENDATION_TO_TASK: Record<string, string> = {
      COMPLIANCE_ESCALATION: "COMPLIANCE_CASE",
      PRICING_ALERT: "PRICING_REVIEW",
      CARRIER_SWITCH: "CARRIER_REVIEW",
      ROUTE_ADJUSTMENT: "ROUTE_REVIEW",
      INSURANCE_ADJUSTMENT: "INSURANCE_REVIEW",
      DOCUMENT_CORRECTION: "DOCUMENT_CORRECTION_TASK",
      RISK_MITIGATION: "RISK_MITIGATION_TASK",
      DELAY_WARNING: "DELAY_RESPONSE_TASK",
      MARGIN_WARNING: "PRICING_REVIEW",
    };

    it("should map all recommendation types to task types", () => {
      for (const [recType, taskType] of Object.entries(RECOMMENDATION_TO_TASK)) {
        expect(taskType).toBeDefined();
        expect([
          "COMPLIANCE_CASE",
          "PRICING_REVIEW",
          "CARRIER_REVIEW",
          "ROUTE_REVIEW",
          "INSURANCE_REVIEW",
          "DOCUMENT_CORRECTION_TASK",
          "DISRUPTION_RESPONSE_TASK",
          "RISK_MITIGATION_TASK",
          "DELAY_RESPONSE_TASK",
        ]).toContain(taskType);
      }
    });

    it("should support all 9 task types", async () => {
      const allTypes = [
        "COMPLIANCE_CASE",
        "PRICING_REVIEW",
        "CARRIER_REVIEW",
        "ROUTE_REVIEW",
        "INSURANCE_REVIEW",
        "DOCUMENT_CORRECTION_TASK",
        "DISRUPTION_RESPONSE_TASK",
        "RISK_MITIGATION_TASK",
        "DELAY_RESPONSE_TASK",
      ];

      for (const taskType of allTypes) {
        const taskId = generateId("tsk");
        TEST_TASK_IDS.push(taskId);
        await db.insert(workflowTasksTable).values({
          id: taskId,
          companyId: TEST_COMPANY_ID,
          taskType: taskType as any,
          title: `Test ${taskType}`,
          status: "OPEN",
          priority: "MEDIUM",
          createdBy: TEST_USER_ID,
        });

        const [task] = await db
          .select()
          .from(workflowTasksTable)
          .where(eq(workflowTasksTable.id, taskId));

        expect(task!.taskType).toBe(taskType);
      }
    });
  });

  describe("Work Queue Filtering", () => {
    it("should filter by assignedTo", async () => {
      const tasks = await db
        .select()
        .from(workflowTasksTable)
        .where(
          and(
            eq(workflowTasksTable.companyId, TEST_COMPANY_ID),
            eq(workflowTasksTable.assignedTo, TEST_USER_ID),
          ),
        );

      expect(tasks.every((t) => t.assignedTo === TEST_USER_ID)).toBe(true);
    });

    it("should filter unassigned tasks", async () => {
      const tasks = await db
        .select()
        .from(workflowTasksTable)
        .where(eq(workflowTasksTable.companyId, TEST_COMPANY_ID));

      const unassigned = tasks.filter((t) => t.assignedTo === null);
      expect(unassigned.length).toBeGreaterThan(0);
    });

    it("should support queue-based filtering (compliance)", async () => {
      const complianceTasks = await db
        .select()
        .from(workflowTasksTable)
        .where(
          and(
            eq(workflowTasksTable.companyId, TEST_COMPANY_ID),
            eq(workflowTasksTable.taskType, "COMPLIANCE_CASE"),
          ),
        );

      expect(complianceTasks.length).toBeGreaterThan(0);
    });
  });

  describe("Cancellation and Reopen", () => {
    let cancelTaskId: string;

    beforeAll(async () => {
      cancelTaskId = generateId("tsk");
      TEST_TASK_IDS.push(cancelTaskId);
      await db.insert(workflowTasksTable).values({
        id: cancelTaskId,
        companyId: TEST_COMPANY_ID,
        taskType: "ROUTE_REVIEW",
        title: "Route review - to be cancelled",
        status: "OPEN",
        priority: "LOW",
        createdBy: TEST_USER_ID,
      });
    });

    it("should cancel a task", async () => {
      await db
        .update(workflowTasksTable)
        .set({ status: "CANCELLED" })
        .where(eq(workflowTasksTable.id, cancelTaskId));

      await db.insert(taskEventsTable).values({
        id: generateId("tev"),
        companyId: TEST_COMPANY_ID,
        taskId: cancelTaskId,
        eventType: "CANCELLED",
        actorId: TEST_USER_ID,
        beforeValue: "OPEN",
        afterValue: "CANCELLED",
        notes: "No longer relevant",
      });

      const [task] = await db
        .select()
        .from(workflowTasksTable)
        .where(eq(workflowTasksTable.id, cancelTaskId));

      expect(task!.status).toBe("CANCELLED");
    });

    it("should reopen a cancelled task", async () => {
      await db
        .update(workflowTasksTable)
        .set({ status: "OPEN" })
        .where(eq(workflowTasksTable.id, cancelTaskId));

      await db.insert(taskEventsTable).values({
        id: generateId("tev"),
        companyId: TEST_COMPANY_ID,
        taskId: cancelTaskId,
        eventType: "REOPENED",
        actorId: TEST_USER_ID,
        beforeValue: "CANCELLED",
        afterValue: "OPEN",
        notes: "Reopened per management request",
      });

      const [task] = await db
        .select()
        .from(workflowTasksTable)
        .where(eq(workflowTasksTable.id, cancelTaskId));

      expect(task!.status).toBe("OPEN");

      const events = await db
        .select()
        .from(taskEventsTable)
        .where(
          and(
            eq(taskEventsTable.taskId, cancelTaskId),
            eq(taskEventsTable.eventType, "REOPENED"),
          ),
        );

      expect(events.length).toBe(1);
      expect(events[0]!.notes).toContain("Reopened");
    });
  });

  describe("All 9 Event Types", () => {
    let eventTestTaskId: string;

    beforeAll(async () => {
      eventTestTaskId = generateId("tsk");
      TEST_TASK_IDS.push(eventTestTaskId);
      await db.insert(workflowTasksTable).values({
        id: eventTestTaskId,
        companyId: TEST_COMPANY_ID,
        taskType: "INSURANCE_REVIEW",
        title: "Event types test",
        status: "OPEN",
        priority: "MEDIUM",
        createdBy: TEST_USER_ID,
      });
    });

    it("should support all 9 event types", async () => {
      const eventTypes = [
        "CREATED",
        "ASSIGNED",
        "STATUS_CHANGED",
        "PRIORITY_CHANGED",
        "NOTE_ADDED",
        "DUE_DATE_CHANGED",
        "COMPLETED",
        "CANCELLED",
        "REOPENED",
      ];

      for (const eventType of eventTypes) {
        await db.insert(taskEventsTable).values({
          id: generateId("tev"),
          companyId: TEST_COMPANY_ID,
          taskId: eventTestTaskId,
          eventType: eventType as any,
          actorId: TEST_USER_ID,
          notes: `Test ${eventType}`,
        });
      }

      const events = await db
        .select()
        .from(taskEventsTable)
        .where(eq(taskEventsTable.taskId, eventTestTaskId));

      expect(events.length).toBe(9);
      const insertedTypes = events.map((e) => e.eventType);
      for (const et of eventTypes) {
        expect(insertedTypes).toContain(et);
      }
    });
  });
});
