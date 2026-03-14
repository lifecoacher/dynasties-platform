import type { Shipment } from "@workspace/db/schema";

export interface SubScores {
  cargoType: number;
  tradeLane: number;
  counterparty: number;
  routeGeopolitical: number;
  seasonal: number;
  documentCompleteness: number;
}

export interface RiskScoreResult {
  compositeScore: number;
  subScores: SubScores;
  recommendedAction: "AUTO_APPROVE" | "OPERATOR_REVIEW" | "ESCALATE";
}

const HIGH_RISK_COMMODITIES = new Set([
  "WEAPONS", "AMMUNITION", "FIREARMS", "EXPLOSIVES", "DUAL-USE",
  "CHEMICALS", "HAZARDOUS MATERIALS", "NUCLEAR", "BIOLOGICAL",
  "PHARMACEUTICAL", "NARCOTICS", "TOBACCO", "ALCOHOL",
  "PRECIOUS METALS", "GEMSTONES", "DIAMONDS", "IVORY",
  "ENDANGERED SPECIES", "WILDLIFE",
]);

const MEDIUM_RISK_COMMODITIES = new Set([
  "ELECTRONICS", "TECHNOLOGY", "SEMICONDUCTORS", "BATTERIES",
  "LITHIUM", "AUTOMOTIVE PARTS", "MACHINERY", "TEXTILES",
  "AGRICULTURAL PRODUCTS", "FOOD PRODUCTS",
]);

const HIGH_RISK_HS_PREFIXES = ["93", "36", "28", "29", "30", "84", "85"];

const HIGH_RISK_PORTS = new Set([
  "BANDAR ABBAS", "LATAKIA", "TARTUS", "NAMPO", "CHONGJIN",
  "HODEIDAH", "ADEN", "MOGADISHU", "TRIPOLI", "BENGHAZI",
]);

const HIGH_RISK_REGIONS = new Set([
  "IRAN", "SYRIA", "NORTH KOREA", "DPRK", "CRIMEA", "RUSSIA",
  "YEMEN", "SOMALIA", "LIBYA", "MYANMAR", "AFGHANISTAN",
  "CUBA", "VENEZUELA", "NICARAGUA", "BELARUS",
]);

function scoreCargoType(shipment: Shipment): number {
  const commodity = (shipment.commodity || "").toUpperCase();
  const hsCode = shipment.hsCode || "";

  if (HIGH_RISK_COMMODITIES.has(commodity)) return 0.9;

  for (const word of HIGH_RISK_COMMODITIES) {
    if (commodity.includes(word)) return 0.8;
  }

  if (HIGH_RISK_HS_PREFIXES.some((p) => hsCode.startsWith(p))) return 0.6;

  if (MEDIUM_RISK_COMMODITIES.has(commodity)) return 0.4;

  for (const word of MEDIUM_RISK_COMMODITIES) {
    if (commodity.includes(word)) return 0.35;
  }

  return 0.15;
}

function scoreTradeLane(shipment: Shipment): number {
  const pol = (shipment.portOfLoading || "").toUpperCase();
  const pod = (shipment.portOfDischarge || "").toUpperCase();

  let score = 0.1;

  if (HIGH_RISK_PORTS.has(pol) || HIGH_RISK_PORTS.has(pod)) score = 0.85;

  for (const region of HIGH_RISK_REGIONS) {
    if (pol.includes(region) || pod.includes(region)) {
      score = Math.max(score, 0.75);
    }
  }

  return score;
}

function scoreCounterparty(shipment: Shipment): number {
  let score = 0.2;

  if (!shipment.shipperId) score += 0.15;
  if (!shipment.consigneeId) score += 0.15;
  if (!shipment.carrierId) score += 0.1;

  return Math.min(score, 1.0);
}

function scoreRouteGeopolitical(shipment: Shipment): number {
  const pol = (shipment.portOfLoading || "").toUpperCase();
  const pod = (shipment.portOfDischarge || "").toUpperCase();

  const conflictZones = [
    "RED SEA", "SUEZ", "STRAIT OF HORMUZ", "GULF OF ADEN",
    "SOUTH CHINA SEA", "TAIWAN STRAIT", "BLACK SEA",
  ];

  for (const zone of conflictZones) {
    if (pol.includes(zone) || pod.includes(zone)) return 0.7;
  }

  for (const region of HIGH_RISK_REGIONS) {
    if (pol.includes(region) || pod.includes(region)) return 0.6;
  }

  return 0.1;
}

function scoreSeasonal(): number {
  const month = new Date().getMonth();
  if (month >= 5 && month <= 9) return 0.3;
  if (month === 11 || month === 0) return 0.25;
  return 0.15;
}

function scoreDocumentCompleteness(shipment: Shipment): number {
  const fields = [
    shipment.commodity,
    shipment.hsCode,
    shipment.portOfLoading,
    shipment.portOfDischarge,
    shipment.vessel,
    shipment.blNumber,
    shipment.bookingNumber,
    shipment.grossWeight,
    shipment.packageCount,
    shipment.incoterms,
  ];

  const filled = fields.filter((f) => f !== null && f !== undefined).length;
  const completeness = filled / fields.length;

  return 1.0 - completeness * 0.85;
}

export function computeRiskScore(shipment: Shipment): RiskScoreResult {
  const subScores: SubScores = {
    cargoType: scoreCargoType(shipment),
    tradeLane: scoreTradeLane(shipment),
    counterparty: scoreCounterparty(shipment),
    routeGeopolitical: scoreRouteGeopolitical(shipment),
    seasonal: scoreSeasonal(),
    documentCompleteness: scoreDocumentCompleteness(shipment),
  };

  const weights = {
    cargoType: 0.25,
    tradeLane: 0.2,
    counterparty: 0.15,
    routeGeopolitical: 0.15,
    seasonal: 0.1,
    documentCompleteness: 0.15,
  };

  const compositeScore =
    subScores.cargoType * weights.cargoType +
    subScores.tradeLane * weights.tradeLane +
    subScores.counterparty * weights.counterparty +
    subScores.routeGeopolitical * weights.routeGeopolitical +
    subScores.seasonal * weights.seasonal +
    subScores.documentCompleteness * weights.documentCompleteness;

  let recommendedAction: "AUTO_APPROVE" | "OPERATOR_REVIEW" | "ESCALATE";
  if (compositeScore >= 0.7) {
    recommendedAction = "ESCALATE";
  } else if (compositeScore >= 0.4) {
    recommendedAction = "OPERATOR_REVIEW";
  } else {
    recommendedAction = "AUTO_APPROVE";
  }

  return {
    compositeScore: Math.round(compositeScore * 1000) / 1000,
    subScores: {
      cargoType: Math.round(subScores.cargoType * 1000) / 1000,
      tradeLane: Math.round(subScores.tradeLane * 1000) / 1000,
      counterparty: Math.round(subScores.counterparty * 1000) / 1000,
      routeGeopolitical: Math.round(subScores.routeGeopolitical * 1000) / 1000,
      seasonal: Math.round(subScores.seasonal * 1000) / 1000,
      documentCompleteness: Math.round(subScores.documentCompleteness * 1000) / 1000,
    },
    recommendedAction,
  };
}
