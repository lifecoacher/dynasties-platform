import { db } from "@workspace/db";
import {
  tenantPoliciesTable,
  policyVersionsTable,
} from "@workspace/db/schema";
import { generateId } from "@workspace/shared-utils";
import { eq, and, desc } from "drizzle-orm";

export type PolicyCategory =
  | "RECOMMENDATION_THRESHOLDS"
  | "BOOKING_GATE_THRESHOLDS"
  | "SLA_RULES"
  | "AUTO_TASK_RULES"
  | "ESCALATION_TIMINGS"
  | "INTELLIGENCE_WEIGHTING"
  | "RISK_TOLERANCES"
  | "STRATEGIC_SENSITIVITY"
  | "OPERATING_MODE";

export interface PolicyEntry {
  id: string;
  policyKey: string;
  policyValue: Record<string, unknown>;
  category: PolicyCategory;
  description: string | null;
  isActive: boolean;
  version: number;
  updatedBy: string | null;
  updatedAt: Date;
}

const GLOBAL_DEFAULTS: Record<string, { category: PolicyCategory; value: Record<string, unknown>; description: string }> = {
  "recommendation.confidence_threshold": {
    category: "RECOMMENDATION_THRESHOLDS",
    value: { minConfidence: 0.5, urgencyWeights: { CRITICAL: 1.0, HIGH: 0.8, MEDIUM: 0.6, LOW: 0.4 } },
    description: "Minimum confidence and urgency weights for recommendation generation",
  },
  "recommendation.auto_expire_hours": {
    category: "RECOMMENDATION_THRESHOLDS",
    value: { CRITICAL: 24, HIGH: 72, MEDIUM: 168, LOW: 336 },
    description: "Hours before recommendations auto-expire by urgency",
  },
  "booking.gate_thresholds": {
    category: "BOOKING_GATE_THRESHOLDS",
    value: {
      blockThreshold: 0.85,
      requireReviewThreshold: 0.7,
      cautionThreshold: 0.5,
      alternativeThreshold: 0.75,
      readinessMinimum: 0.3,
    },
    description: "Risk score thresholds for booking decision statuses",
  },
  "booking.gate_types_enabled": {
    category: "BOOKING_GATE_THRESHOLDS",
    value: {
      COMPLIANCE: true,
      RISK_THRESHOLD: true,
      DOCUMENT_VERIFICATION: true,
      INSURANCE: true,
      CARRIER_APPROVAL: true,
      SANCTIONS_CHECK: true,
    },
    description: "Which release gate types are enabled",
  },
  "sla.response_times": {
    category: "SLA_RULES",
    value: { CRITICAL: 2, HIGH: 8, MEDIUM: 24, LOW: 72 },
    description: "Target response time in hours by priority",
  },
  "sla.escalation_thresholds": {
    category: "SLA_RULES",
    value: { warningPct: 0.75, breachPct: 1.0, autoEscalateOnBreach: true },
    description: "SLA warning and breach thresholds",
  },
  "auto_task.creation_rules": {
    category: "AUTO_TASK_RULES",
    value: {
      enabled: true,
      minRiskScore: 0.6,
      minConfidence: 0.5,
      autoCreateForUrgency: ["CRITICAL", "HIGH"],
      maxAutoTasksPerDay: 50,
    },
    description: "Rules for automatic task creation from recommendations",
  },
  "escalation.timings": {
    category: "ESCALATION_TIMINGS",
    value: {
      firstEscalationHours: 4,
      secondEscalationHours: 12,
      managerEscalationHours: 24,
      executiveEscalationHours: 48,
    },
    description: "Escalation timing ladder",
  },
  "intelligence.weighting": {
    category: "INTELLIGENCE_WEIGHTING",
    value: {
      laneStress: 0.20,
      portCongestion: 0.20,
      disruption: 0.15,
      weather: 0.10,
      carrierReliability: 0.20,
      entityCompliance: 0.15,
    },
    description: "Risk component weights for pre-shipment risk evaluation",
  },
  "risk.tolerances": {
    category: "RISK_TOLERANCES",
    value: {
      maxAcceptableRiskScore: 0.8,
      laneStressMax: 0.75,
      carrierReliabilityMin: 0.4,
      entityComplianceMax: 0.7,
      autoBlockAbove: 0.9,
    },
    description: "Risk tolerance levels per dimension",
  },
  "strategic.sensitivity": {
    category: "STRATEGIC_SENSITIVITY",
    value: {
      laneStrategyThresholds: { tightenGates: 0.6, reduceExposure: 0.75, reroute: 0.75 },
      carrierAllocationThresholds: { avoid: 0.35, reduce: 0.5, preferred: 0.65, increase: 0.75 },
      networkRecMinConfidence: 0.5,
      portfolioRefreshInterval: "DAILY",
    },
    description: "Sensitivity thresholds for strategic intelligence",
  },
};

export function getGlobalDefaults(): Record<string, { category: PolicyCategory; value: Record<string, unknown>; description: string }> {
  return { ...GLOBAL_DEFAULTS };
}

export function getDefaultValue(policyKey: string): Record<string, unknown> | null {
  return GLOBAL_DEFAULTS[policyKey]?.value ?? null;
}

export async function getTenantPolicies(
  companyId: string,
  category?: PolicyCategory,
): Promise<PolicyEntry[]> {
  const conditions = category
    ? and(eq(tenantPoliciesTable.companyId, companyId), eq(tenantPoliciesTable.category, category))
    : eq(tenantPoliciesTable.companyId, companyId);

  const rows = await db
    .select()
    .from(tenantPoliciesTable)
    .where(conditions)
    .orderBy(tenantPoliciesTable.policyKey);

  return rows.map((r) => ({
    id: r.id,
    policyKey: r.policyKey,
    policyValue: r.policyValue,
    category: r.category as PolicyCategory,
    description: r.description,
    isActive: r.isActive,
    version: r.version,
    updatedBy: r.updatedBy,
    updatedAt: r.updatedAt,
  }));
}

export async function getEffectivePolicy(
  companyId: string,
  policyKey: string,
): Promise<Record<string, unknown>> {
  const [row] = await db
    .select()
    .from(tenantPoliciesTable)
    .where(
      and(
        eq(tenantPoliciesTable.companyId, companyId),
        eq(tenantPoliciesTable.policyKey, policyKey),
        eq(tenantPoliciesTable.isActive, true),
      ),
    )
    .limit(1);

  if (row) return row.policyValue;
  return GLOBAL_DEFAULTS[policyKey]?.value ?? {};
}

export async function getAllEffectivePolicies(
  companyId: string,
): Promise<Record<string, { value: Record<string, unknown>; source: "tenant" | "default"; category: PolicyCategory }>> {
  const tenantPolicies = await getTenantPolicies(companyId);
  const tenantMap = new Map(tenantPolicies.filter((p) => p.isActive).map((p) => [p.policyKey, p]));

  const result: Record<string, { value: Record<string, unknown>; source: "tenant" | "default"; category: PolicyCategory }> = {};

  for (const [key, def] of Object.entries(GLOBAL_DEFAULTS)) {
    const tenant = tenantMap.get(key);
    result[key] = tenant
      ? { value: tenant.policyValue, source: "tenant", category: tenant.category }
      : { value: def.value, source: "default", category: def.category };
  }

  for (const tp of tenantPolicies) {
    if (!result[tp.policyKey]) {
      result[tp.policyKey] = { value: tp.policyValue, source: "tenant", category: tp.category };
    }
  }

  return result;
}

export async function upsertPolicy(
  companyId: string,
  policyKey: string,
  policyValue: Record<string, unknown>,
  userId: string,
  changeReason?: string,
): Promise<PolicyEntry> {
  const defaultDef = GLOBAL_DEFAULTS[policyKey];
  const category = defaultDef?.category ?? "RISK_TOLERANCES";

  const [existing] = await db
    .select()
    .from(tenantPoliciesTable)
    .where(
      and(
        eq(tenantPoliciesTable.companyId, companyId),
        eq(tenantPoliciesTable.policyKey, policyKey),
      ),
    )
    .limit(1);

  if (existing) {
    const newVersion = existing.version + 1;

    await db.insert(policyVersionsTable).values({
      id: generateId("pv"),
      companyId,
      policyId: existing.id,
      policyKey,
      previousValue: existing.policyValue,
      newValue: policyValue,
      version: newVersion,
      changedBy: userId,
      changeReason: changeReason ?? null,
    });

    await db
      .update(tenantPoliciesTable)
      .set({
        policyValue,
        version: newVersion,
        updatedBy: userId,
      })
      .where(eq(tenantPoliciesTable.id, existing.id));

    return {
      id: existing.id,
      policyKey,
      policyValue,
      category: existing.category as PolicyCategory,
      description: existing.description,
      isActive: existing.isActive,
      version: newVersion,
      updatedBy: userId,
      updatedAt: new Date(),
    };
  }

  const id = generateId("tp");
  await db.insert(tenantPoliciesTable).values({
    id,
    companyId,
    policyKey,
    policyValue,
    category,
    description: defaultDef?.description ?? null,
    isActive: true,
    version: 1,
    updatedBy: userId,
  });

  await db.insert(policyVersionsTable).values({
    id: generateId("pv"),
    companyId,
    policyId: id,
    policyKey,
    previousValue: null,
    newValue: policyValue,
    version: 1,
    changedBy: userId,
    changeReason: changeReason ?? "Initial policy creation",
  });

  return {
    id,
    policyKey,
    policyValue,
    category,
    description: defaultDef?.description ?? null,
    isActive: true,
    version: 1,
    updatedBy: userId,
    updatedAt: new Date(),
  };
}

export async function togglePolicy(
  companyId: string,
  policyId: string,
  isActive: boolean,
  userId: string,
): Promise<boolean> {
  await db
    .update(tenantPoliciesTable)
    .set({ isActive, updatedBy: userId })
    .where(
      and(
        eq(tenantPoliciesTable.id, policyId),
        eq(tenantPoliciesTable.companyId, companyId),
      ),
    );
  return true;
}

export async function getPolicyHistory(
  companyId: string,
  policyKey?: string,
  limit = 50,
): Promise<Array<{
  id: string;
  policyKey: string;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown>;
  version: number;
  changedBy: string;
  changeReason: string | null;
  createdAt: Date;
}>> {
  const conditions = policyKey
    ? and(eq(policyVersionsTable.companyId, companyId), eq(policyVersionsTable.policyKey, policyKey))
    : eq(policyVersionsTable.companyId, companyId);

  const rows = await db
    .select()
    .from(policyVersionsTable)
    .where(conditions)
    .orderBy(desc(policyVersionsTable.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    policyKey: r.policyKey,
    previousValue: r.previousValue,
    newValue: r.newValue,
    version: r.version,
    changedBy: r.changedBy,
    changeReason: r.changeReason,
    createdAt: r.createdAt,
  }));
}

export async function resetPolicyToDefault(
  companyId: string,
  policyKey: string,
  userId: string,
): Promise<PolicyEntry | null> {
  const defaultDef = GLOBAL_DEFAULTS[policyKey];
  if (!defaultDef) return null;

  return upsertPolicy(companyId, policyKey, defaultDef.value, userId, "Reset to default");
}
