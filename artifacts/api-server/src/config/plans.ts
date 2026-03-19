export type PlanType = "STARTER" | "GROWTH" | "SCALE" | "ENTERPRISE";

export type DeploymentFeeRequirement = "NOT_REQUIRED" | "RECOMMENDED" | "REQUIRED" | "CONFIGURABLE";

export interface PlanConfig {
  planType: PlanType;
  name: string;
  description: string;
  monthlyPriceCents: number;
  annualPriceCents: number;
  seatLimit: number;
  shipmentLimit: number;
  deploymentFeeCents: number;
  deploymentFeeRequirement: DeploymentFeeRequirement;
  trialDays: number;
  features: string[];
}

export const PLAN_CONFIGS: Record<PlanType, PlanConfig> = {
  STARTER: {
    planType: "STARTER",
    name: "Starter",
    description: "For small forwarders getting started with digital operations",
    monthlyPriceCents: 24900,
    annualPriceCents: 249000,
    seatLimit: 3,
    shipmentLimit: 40,
    deploymentFeeCents: 0,
    deploymentFeeRequirement: "NOT_REQUIRED",
    trialDays: 14,
    features: [
      "3 team members",
      "40 shipments/month",
      "Basic document generation",
      "Email support",
    ],
  },
  GROWTH: {
    planType: "GROWTH",
    name: "Growth",
    description: "For growing operations needing more capacity and intelligence",
    monthlyPriceCents: 89500,
    annualPriceCents: 895000,
    seatLimit: 10,
    shipmentLimit: 250,
    deploymentFeeCents: 150000,
    deploymentFeeRequirement: "RECOMMENDED",
    trialDays: 14,
    features: [
      "10 team members",
      "250 shipments/month",
      "AI routing & pricing",
      "Compliance screening",
      "Priority support",
    ],
  },
  SCALE: {
    planType: "SCALE",
    name: "Scale",
    description: "For established forwarders with high-volume operations",
    monthlyPriceCents: 240000,
    annualPriceCents: 2400000,
    seatLimit: 25,
    shipmentLimit: 1000,
    deploymentFeeCents: 350000,
    deploymentFeeRequirement: "REQUIRED",
    trialDays: 14,
    features: [
      "25 team members",
      "1,000 shipments/month",
      "Full decision engine",
      "Reconciliation engine",
      "Dedicated support",
    ],
  },
  ENTERPRISE: {
    planType: "ENTERPRISE",
    name: "Enterprise",
    description: "Unlimited capacity with white-glove onboarding and custom integrations",
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    seatLimit: 9999,
    shipmentLimit: 99999,
    deploymentFeeCents: 0,
    deploymentFeeRequirement: "CONFIGURABLE",
    trialDays: 30,
    features: [
      "Unlimited team members",
      "Unlimited shipments",
      "Custom integrations",
      "Dedicated success manager",
      "SLA guarantee",
    ],
  },
};

export const PLAN_ORDER: PlanType[] = ["STARTER", "GROWTH", "SCALE", "ENTERPRISE"];

export function getPlanConfig(planType: string | null): PlanConfig {
  if (planType && planType in PLAN_CONFIGS) {
    return PLAN_CONFIGS[planType as PlanType];
  }
  return PLAN_CONFIGS.STARTER;
}

export function getPlanLimits(planType: string | null): { seats: number; shipments: number } {
  const config = getPlanConfig(planType);
  return { seats: config.seatLimit, shipments: config.shipmentLimit };
}
