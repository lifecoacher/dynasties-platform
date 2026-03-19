import type { RouteOption } from "./routes";

export interface CostBreakdown {
  code: string;
  label: string;
  amount: number;
}

export interface PricedRoute extends RouteOption {
  estimatedCost: number;
  costRange: { low: number; high: number };
  currency: string;
  costBreakdown: CostBreakdown[];
  costConfidence: "HIGH" | "MEDIUM" | "LOW";
}

interface ShipmentPricingContext {
  grossWeight: number | null;
  volume: number | null;
  cargoValue: number | null;
  commodity: string | null;
  hsCode: string | null;
  packageCount: number | null;
  freightTerms: string | null;
  weightUnit: string | null;
}

const REGION_MULTIPLIERS: Record<string, number> = {
  "EAST_ASIA→NORTH_AMERICA": 1.0,
  "EAST_ASIA→EUROPE": 1.05,
  "SE_ASIA→EUROPE": 0.95,
  "SE_ASIA→NORTH_AMERICA": 1.1,
  "EAST_ASIA→MIDDLE_EAST": 0.85,
  "EUROPE→NORTH_AMERICA": 0.9,
  "MIDDLE_EAST→EUROPE": 0.8,
  "SOUTH_ASIA→EUROPE": 0.88,
};

const COMMODITY_SURCHARGE: Record<string, number> = {
  hazardous: 450,
  refrigerated: 350,
  oversized: 500,
  fragile: 200,
  electronics: 150,
  pharmaceutical: 300,
  automotive: 200,
};

function getWeightKg(weight: number | null, unit: string | null): number {
  if (!weight) return 1000;
  if (unit === "LB") return weight * 0.453592;
  return weight;
}

function getVolumeCbm(volume: number | null): number {
  if (!volume || volume <= 0) return 15;
  return volume;
}

function computeBaseFreight(
  route: RouteOption,
  weightKg: number,
  volumeCbm: number,
): number {
  const chargeableWeight = Math.max(weightKg / 1000, volumeCbm);
  const perCbmRate = 45;
  const distanceFactor = route.totalTransitDays / 14;
  const base = Math.max(chargeableWeight * perCbmRate * distanceFactor, 350);

  if (route.type === "TRANSSHIPMENT") {
    return base * 0.92;
  }
  if (route.type === "ALTERNATIVE") {
    return base * 0.97;
  }
  return base;
}

function detectCommoditySurcharge(commodity: string | null): number {
  if (!commodity) return 0;
  const lower = commodity.toLowerCase();
  for (const [keyword, surcharge] of Object.entries(COMMODITY_SURCHARGE)) {
    if (lower.includes(keyword)) return surcharge;
  }
  return 0;
}

export function priceRoutes(
  routes: RouteOption[],
  ctx: ShipmentPricingContext,
  regionKey: string | null,
): PricedRoute[] {
  const weightKg = getWeightKg(ctx.grossWeight, ctx.weightUnit);
  const volumeCbm = getVolumeCbm(ctx.volume);
  const regionMult = regionKey ? (REGION_MULTIPLIERS[regionKey] ?? 1.0) : 1.0;
  const commoditySurcharge = detectCommoditySurcharge(ctx.commodity);

  return routes.map((route) => {
    const breakdown: CostBreakdown[] = [];

    const baseFreight = Math.round(computeBaseFreight(route, weightKg, volumeCbm) * regionMult);
    breakdown.push({ code: "FRT", label: "Ocean Freight", amount: baseFreight });

    const thcOrigin = Math.round(Math.max(weightKg * 0.012, 150));
    breakdown.push({ code: "THC-O", label: "Terminal Handling (Origin)", amount: thcOrigin });

    const thcDest = Math.round(Math.max(weightKg * 0.01, 120));
    breakdown.push({ code: "THC-D", label: "Terminal Handling (Destination)", amount: thcDest });

    breakdown.push({ code: "DOC", label: "Documentation Fee", amount: 75 });
    breakdown.push({ code: "AMS", label: "AMS / Customs Filing", amount: 35 });
    breakdown.push({ code: "ISF", label: "Importer Security Filing", amount: 50 });

    const baf = Math.round(baseFreight * 0.08);
    if (baf > 0) {
      breakdown.push({ code: "BAF", label: "Bunker Adjustment Factor", amount: baf });
    }

    if (commoditySurcharge > 0) {
      breakdown.push({ code: "SPCL", label: "Special Cargo Surcharge", amount: commoditySurcharge });
    }

    if (route.type === "TRANSSHIPMENT") {
      const transFee = 185;
      breakdown.push({ code: "TSF", label: "Transshipment Fee", amount: transFee });
    }

    if (route.legs.some((l) => l.mode === "Truck/Rail" || l.mode === "Rail")) {
      const intermodal = Math.round(250 + (route.legs.find((l) => l.mode !== "Ocean")?.transitDays ?? 2) * 80);
      breakdown.push({ code: "IML", label: "Intermodal Transport", amount: intermodal });
    }

    if (ctx.cargoValue && ctx.cargoValue > 0) {
      const insurance = Math.round(ctx.cargoValue * 0.003);
      if (insurance > 50) {
        breakdown.push({ code: "INS", label: "Cargo Insurance", amount: insurance });
      }
    }

    const estimatedCost = breakdown.reduce((s, b) => s + b.amount, 0);
    const varianceFactor = route.type === "DIRECT" ? 0.08 : 0.12;

    let costConfidence: "HIGH" | "MEDIUM" | "LOW" = "MEDIUM";
    if (route.type === "DIRECT" && regionKey) costConfidence = "HIGH";
    if (!ctx.grossWeight && !ctx.volume) costConfidence = "LOW";

    return {
      ...route,
      estimatedCost,
      costRange: {
        low: Math.round(estimatedCost * (1 - varianceFactor)),
        high: Math.round(estimatedCost * (1 + varianceFactor)),
      },
      currency: "USD",
      costBreakdown: breakdown,
      costConfidence,
    };
  });
}
