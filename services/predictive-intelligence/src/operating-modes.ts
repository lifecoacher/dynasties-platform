import { db } from "@workspace/db";
import { operatingModesTable } from "@workspace/db/schema";
import { generateId } from "@workspace/shared-utils";
import { eq, and } from "drizzle-orm";
import { upsertPolicy, type PolicyCategory } from "./policy-engine.js";

export type ModeName =
  | "ADVISORY"
  | "APPROVAL_HEAVY"
  | "SEMI_AUTONOMOUS"
  | "HIGH_COMPLIANCE"
  | "MARGIN_PROTECTION"
  | "DISRUPTION_SENSITIVE"
  | "CUSTOM";

export interface OperatingModeResult {
  id: string;
  modeName: ModeName;
  isActive: boolean;
  policyOverrides: Record<string, Record<string, unknown>>;
  description: string | null;
  activatedBy: string | null;
  activatedAt: Date | null;
}

const MODE_PRESETS: Record<Exclude<ModeName, "CUSTOM">, { description: string; overrides: Record<string, Record<string, unknown>> }> = {
  ADVISORY: {
    description: "Recommendations only — no automatic blocking or task creation. Human-in-the-loop for all decisions.",
    overrides: {
      "booking.gate_thresholds": { blockThreshold: 1.0, requireReviewThreshold: 0.9, cautionThreshold: 0.7, alternativeThreshold: 1.0, readinessMinimum: 0.1 },
      "auto_task.creation_rules": { enabled: false, minRiskScore: 0.9, maxAutoTasksPerDay: 0 },
      "risk.tolerances": { maxAcceptableRiskScore: 0.95, autoBlockAbove: 1.0 },
    },
  },
  APPROVAL_HEAVY: {
    description: "Stricter gates — most shipments require review or approval before proceeding.",
    overrides: {
      "booking.gate_thresholds": { blockThreshold: 0.7, requireReviewThreshold: 0.5, cautionThreshold: 0.3, alternativeThreshold: 0.6, readinessMinimum: 0.5 },
      "auto_task.creation_rules": { enabled: true, minRiskScore: 0.4, autoCreateForUrgency: ["CRITICAL", "HIGH", "MEDIUM"], maxAutoTasksPerDay: 100 },
      "risk.tolerances": { maxAcceptableRiskScore: 0.6, autoBlockAbove: 0.7 },
    },
  },
  SEMI_AUTONOMOUS: {
    description: "Balanced mode — auto-approves low-risk shipments, reviews medium, blocks high.",
    overrides: {
      "booking.gate_thresholds": { blockThreshold: 0.85, requireReviewThreshold: 0.7, cautionThreshold: 0.5, alternativeThreshold: 0.75, readinessMinimum: 0.3 },
      "auto_task.creation_rules": { enabled: true, minRiskScore: 0.6, autoCreateForUrgency: ["CRITICAL", "HIGH"], maxAutoTasksPerDay: 50 },
      "risk.tolerances": { maxAcceptableRiskScore: 0.8, autoBlockAbove: 0.9 },
    },
  },
  HIGH_COMPLIANCE: {
    description: "Maximum compliance scrutiny — aggressive sanctions, entity checks, and document gates.",
    overrides: {
      "booking.gate_thresholds": { blockThreshold: 0.65, requireReviewThreshold: 0.45, cautionThreshold: 0.25, alternativeThreshold: 0.55, readinessMinimum: 0.6 },
      "booking.gate_types_enabled": { COMPLIANCE: true, RISK_THRESHOLD: true, DOCUMENT_VERIFICATION: true, INSURANCE: true, CARRIER_APPROVAL: true, SANCTIONS_CHECK: true },
      "auto_task.creation_rules": { enabled: true, minRiskScore: 0.35, autoCreateForUrgency: ["CRITICAL", "HIGH", "MEDIUM"], maxAutoTasksPerDay: 100 },
      "intelligence.weighting": { laneStress: 0.10, portCongestion: 0.10, disruption: 0.10, weather: 0.05, carrierReliability: 0.25, entityCompliance: 0.40 },
      "risk.tolerances": { maxAcceptableRiskScore: 0.55, entityComplianceMax: 0.4, autoBlockAbove: 0.65 },
    },
  },
  MARGIN_PROTECTION: {
    description: "Prioritize margin and cost — tighter carrier and pricing controls, relaxed operational gates.",
    overrides: {
      "booking.gate_thresholds": { blockThreshold: 0.9, requireReviewThreshold: 0.75, cautionThreshold: 0.55 },
      "intelligence.weighting": { laneStress: 0.25, portCongestion: 0.15, disruption: 0.10, weather: 0.05, carrierReliability: 0.30, entityCompliance: 0.15 },
      "strategic.sensitivity": { carrierAllocationThresholds: { avoid: 0.3, reduce: 0.45, preferred: 0.6, increase: 0.7 } },
      "risk.tolerances": { maxAcceptableRiskScore: 0.85, carrierReliabilityMin: 0.5 },
    },
  },
  DISRUPTION_SENSITIVE: {
    description: "Heightened disruption awareness — aggressive rerouting, congestion monitoring, weather alerts.",
    overrides: {
      "booking.gate_thresholds": { blockThreshold: 0.75, requireReviewThreshold: 0.55, cautionThreshold: 0.35, alternativeThreshold: 0.6 },
      "intelligence.weighting": { laneStress: 0.25, portCongestion: 0.25, disruption: 0.25, weather: 0.15, carrierReliability: 0.05, entityCompliance: 0.05 },
      "strategic.sensitivity": { laneStrategyThresholds: { tightenGates: 0.5, reduceExposure: 0.65, reroute: 0.65 } },
      "risk.tolerances": { maxAcceptableRiskScore: 0.7, laneStressMax: 0.6, autoBlockAbove: 0.75 },
    },
  },
};

export function getModePresets(): Record<string, { description: string; overrides: Record<string, Record<string, unknown>> }> {
  return { ...MODE_PRESETS };
}

export async function getActiveMode(companyId: string): Promise<OperatingModeResult | null> {
  const [row] = await db
    .select()
    .from(operatingModesTable)
    .where(
      and(
        eq(operatingModesTable.companyId, companyId),
        eq(operatingModesTable.isActive, true),
      ),
    )
    .limit(1);

  if (!row) return null;
  return {
    id: row.id,
    modeName: row.modeName as ModeName,
    isActive: row.isActive,
    policyOverrides: row.policyOverrides,
    description: row.description,
    activatedBy: row.activatedBy,
    activatedAt: row.activatedAt,
  };
}

export async function getAvailableModes(companyId: string): Promise<OperatingModeResult[]> {
  const rows = await db
    .select()
    .from(operatingModesTable)
    .where(eq(operatingModesTable.companyId, companyId));

  return rows.map((r) => ({
    id: r.id,
    modeName: r.modeName as ModeName,
    isActive: r.isActive,
    policyOverrides: r.policyOverrides,
    description: r.description,
    activatedBy: r.activatedBy,
    activatedAt: r.activatedAt,
  }));
}

export async function activateMode(
  companyId: string,
  modeName: ModeName,
  userId: string,
  customOverrides?: Record<string, Record<string, unknown>>,
): Promise<OperatingModeResult> {
  await db
    .update(operatingModesTable)
    .set({ isActive: false })
    .where(
      and(
        eq(operatingModesTable.companyId, companyId),
        eq(operatingModesTable.isActive, true),
      ),
    );

  const preset = modeName !== "CUSTOM" ? MODE_PRESETS[modeName] : null;
  const overrides = customOverrides ?? preset?.overrides ?? {};
  const description = preset?.description ?? "Custom operating mode";

  const [existing] = await db
    .select()
    .from(operatingModesTable)
    .where(
      and(
        eq(operatingModesTable.companyId, companyId),
        eq(operatingModesTable.modeName, modeName),
      ),
    )
    .limit(1);

  let id: string;
  if (existing) {
    id = existing.id;
    await db
      .update(operatingModesTable)
      .set({
        isActive: true,
        policyOverrides: overrides,
        activatedBy: userId,
        activatedAt: new Date(),
      })
      .where(eq(operatingModesTable.id, existing.id));
  } else {
    id = generateId("om");
    await db.insert(operatingModesTable).values({
      id,
      companyId,
      modeName,
      isActive: true,
      policyOverrides: overrides,
      description,
      activatedBy: userId,
      activatedAt: new Date(),
    });
  }

  for (const [policyKey, policyValue] of Object.entries(overrides)) {
    await upsertPolicy(companyId, policyKey, policyValue, userId, `Mode activation: ${modeName}`);
  }

  return {
    id,
    modeName,
    isActive: true,
    policyOverrides: overrides,
    description,
    activatedBy: userId,
    activatedAt: new Date(),
  };
}

export async function deactivateMode(companyId: string, userId: string): Promise<boolean> {
  await db
    .update(operatingModesTable)
    .set({ isActive: false })
    .where(
      and(
        eq(operatingModesTable.companyId, companyId),
        eq(operatingModesTable.isActive, true),
      ),
    );
  return true;
}
