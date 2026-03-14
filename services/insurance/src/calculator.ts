import type { Shipment } from "@workspace/db/schema";

export interface InsuranceCalculation {
  coverageType: "ALL_RISK" | "NAMED_PERILS" | "TOTAL_LOSS";
  estimatedInsuredValue: number;
  estimatedPremium: number;
  currency: string;
  confidenceScore: number;
}

const COMMODITY_VALUE_RATES: Record<string, number> = {
  ELECTRONICS: 50,
  SEMICONDUCTORS: 200,
  MACHINERY: 35,
  TEXTILES: 15,
  GARMENTS: 18,
  CHEMICALS: 25,
  PHARMACEUTICAL: 150,
  FOOD: 8,
  AGRICULTURAL: 6,
  AUTOMOTIVE: 40,
  STEEL: 12,
  METALS: 20,
  FURNITURE: 10,
  PLASTICS: 8,
  MARINE: 45,
  EQUIPMENT: 30,
};

const HIGH_VALUE_COMMODITIES = new Set([
  "ELECTRONICS", "SEMICONDUCTORS", "PHARMACEUTICAL", "PRECIOUS METALS",
  "GEMSTONES", "DIAMONDS", "ARTWORK", "LUXURY GOODS",
]);

const PERISHABLE_COMMODITIES = new Set([
  "FOOD", "PRODUCE", "SEAFOOD", "FLOWERS", "PHARMACEUTICAL",
  "VACCINES", "BIOLOGICAL", "DAIRY", "MEAT", "FRUIT",
]);

const ROUTE_RISK_MULTIPLIERS: Record<string, number> = {
  LOW: 1.0,
  MEDIUM: 1.3,
  HIGH: 1.7,
  VERY_HIGH: 2.2,
};

function estimateCargoValue(shipment: Shipment): number {
  const weight = shipment.grossWeight || 1000;
  const commodity = (shipment.commodity || "GENERAL CARGO").toUpperCase();

  let ratePerKg = 12;

  for (const [key, rate] of Object.entries(COMMODITY_VALUE_RATES)) {
    if (commodity.includes(key)) {
      ratePerKg = rate;
      break;
    }
  }

  return Math.round(weight * ratePerKg);
}

function assessRouteRisk(shipment: Shipment): string {
  const pol = (shipment.portOfLoading || "").toUpperCase();
  const pod = (shipment.portOfDischarge || "").toUpperCase();

  const highRiskPorts = [
    "BANDAR ABBAS", "LATAKIA", "NAMPO", "HODEIDAH",
    "MOGADISHU", "TRIPOLI", "ADEN",
  ];
  const mediumRiskPorts = [
    "SHANGHAI", "MUMBAI", "KARACHI", "LAGOS", "MOMBASA",
    "DAR ES SALAAM", "COLOMBO",
  ];

  for (const port of highRiskPorts) {
    if (pol.includes(port) || pod.includes(port)) return "VERY_HIGH";
  }

  const highRiskRegions = [
    "IRAN", "SYRIA", "NORTH KOREA", "SOMALIA", "YEMEN",
    "LIBYA", "MYANMAR",
  ];

  for (const region of highRiskRegions) {
    if (pol.includes(region) || pod.includes(region)) return "HIGH";
  }

  for (const port of mediumRiskPorts) {
    if (pol.includes(port) || pod.includes(port)) return "MEDIUM";
  }

  return "LOW";
}

function determineCoverageType(shipment: Shipment): "ALL_RISK" | "NAMED_PERILS" | "TOTAL_LOSS" {
  const commodity = (shipment.commodity || "").toUpperCase();

  if (HIGH_VALUE_COMMODITIES.has(commodity)) return "ALL_RISK";

  for (const item of HIGH_VALUE_COMMODITIES) {
    if (commodity.includes(item)) return "ALL_RISK";
  }

  if (PERISHABLE_COMMODITIES.has(commodity)) return "ALL_RISK";

  for (const item of PERISHABLE_COMMODITIES) {
    if (commodity.includes(item)) return "ALL_RISK";
  }

  const estimatedValue = estimateCargoValue(shipment);
  if (estimatedValue > 500000) return "ALL_RISK";
  if (estimatedValue > 100000) return "NAMED_PERILS";

  return "TOTAL_LOSS";
}

export function calculateInsuranceQuote(shipment: Shipment): InsuranceCalculation {
  const estimatedInsuredValue = estimateCargoValue(shipment);
  const routeRisk = assessRouteRisk(shipment);
  const coverageType = determineCoverageType(shipment);

  const coverageMultiplier = {
    ALL_RISK: 0.008,
    NAMED_PERILS: 0.005,
    TOTAL_LOSS: 0.003,
  }[coverageType];

  const routeMultiplier = ROUTE_RISK_MULTIPLIERS[routeRisk] || 1.0;

  const basePremium = estimatedInsuredValue * coverageMultiplier * routeMultiplier;
  const estimatedPremium = Math.round(Math.max(basePremium, 150) * 100) / 100;

  const hasWeight = shipment.grossWeight !== null;
  const hasCommodity = shipment.commodity !== null;
  const hasHsCode = shipment.hsCode !== null;
  const hasPorts = shipment.portOfLoading !== null && shipment.portOfDischarge !== null;

  let confidenceScore = 0.5;
  if (hasWeight) confidenceScore += 0.15;
  if (hasCommodity) confidenceScore += 0.15;
  if (hasHsCode) confidenceScore += 0.1;
  if (hasPorts) confidenceScore += 0.1;

  return {
    coverageType,
    estimatedInsuredValue,
    estimatedPremium,
    currency: "USD",
    confidenceScore: Math.round(confidenceScore * 100) / 100,
  };
}
