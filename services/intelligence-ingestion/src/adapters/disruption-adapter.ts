import type { IntelligenceAdapter, DisruptionRecord, WeatherRiskRecord } from "./types.js";
import { disruptionRecordSchema, weatherRiskRecordSchema } from "./types.js";

const DISRUPTION_FIXTURES: DisruptionRecord[] = [
  {
    eventType: "port_closure",
    title: "Shanghai Port Partial Closure — COVID Protocols",
    description: "Terminal 3 and 4 at Shanghai port operating at 40% capacity due to enhanced health screening protocols.",
    severity: "high",
    status: "active",
    affectedRegion: "East China",
    affectedPorts: ["CNSHA"],
    affectedLanes: ["CNSHA-USLAX", "CNSHA-NLRTM", "CNSHA-SGSIN"],
    estimatedImpactDays: 14,
    confidence: 0.85,
    startDate: new Date(Date.now() - 3 * 86400000).toISOString(),
    expectedEndDate: new Date(Date.now() + 11 * 86400000).toISOString(),
  },
  {
    eventType: "canal_blockage",
    title: "Suez Canal Capacity Reduction",
    description: "Maintenance dredging reducing canal throughput by 25% for scheduled infrastructure upgrades.",
    severity: "medium",
    status: "active",
    affectedRegion: "Mediterranean / Red Sea",
    affectedPorts: ["EGPSD", "EGSUZ"],
    affectedLanes: ["CNSHA-NLRTM", "SGSIN-DEHAM", "HKHKG-NLRTM"],
    estimatedImpactDays: 21,
    confidence: 0.92,
    startDate: new Date(Date.now() - 5 * 86400000).toISOString(),
    expectedEndDate: new Date(Date.now() + 16 * 86400000).toISOString(),
  },
  {
    eventType: "labor_strike",
    title: "Los Angeles Port Workers Strike",
    description: "ILWU workers at Ports of LA/Long Beach conducting work slowdown over contract negotiations.",
    severity: "critical",
    status: "active",
    affectedRegion: "US West Coast",
    affectedPorts: ["USLAX", "USLGB"],
    affectedLanes: ["CNSHA-USLAX", "HKHKG-USLAX"],
    estimatedImpactDays: 10,
    confidence: 0.78,
    startDate: new Date(Date.now() - 1 * 86400000).toISOString(),
    expectedEndDate: new Date(Date.now() + 9 * 86400000).toISOString(),
  },
  {
    eventType: "geopolitical",
    title: "Red Sea Shipping Route Risk Elevation",
    description: "Ongoing security concerns in the Red Sea region forcing vessels to consider Cape of Good Hope routing.",
    severity: "high",
    status: "monitoring",
    affectedRegion: "Red Sea / Gulf of Aden",
    affectedPorts: ["YEADW", "DJJIB"],
    affectedLanes: ["CNSHA-NLRTM", "SGSIN-DEHAM"],
    estimatedImpactDays: 30,
    confidence: 0.88,
    startDate: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
];

const WEATHER_RISK_FIXTURES: WeatherRiskRecord[] = [
  {
    eventType: "typhoon",
    title: "Typhoon Haikui — Western Pacific",
    description: "Category 3 typhoon tracking toward Taiwan Strait, expected to impact East China Sea shipping lanes.",
    severity: "critical",
    status: "active",
    affectedRegion: "Western Pacific",
    affectedPorts: ["TWTPE", "CNSHA", "CNNBO"],
    latitude: 24.5,
    longitude: 121.3,
    radiusKm: 350,
    windSpeedKnots: 95,
    confidence: 0.82,
    forecastDate: new Date().toISOString(),
    expectedStartDate: new Date(Date.now() + 1 * 86400000).toISOString(),
    expectedEndDate: new Date(Date.now() + 4 * 86400000).toISOString(),
  },
  {
    eventType: "fog",
    title: "Dense Fog Advisory — English Channel",
    description: "Persistent fog conditions reducing visibility below 200m in Dover Strait area.",
    severity: "medium",
    status: "active",
    affectedRegion: "English Channel",
    affectedPorts: ["NLRTM", "BEANR", "GBLGP"],
    confidence: 0.91,
    forecastDate: new Date().toISOString(),
    expectedStartDate: new Date().toISOString(),
    expectedEndDate: new Date(Date.now() + 2 * 86400000).toISOString(),
  },
];

export class DisruptionAdapter implements IntelligenceAdapter<DisruptionRecord> {
  sourceType = "disruptions";

  async fetch(): Promise<DisruptionRecord[]> {
    return DISRUPTION_FIXTURES;
  }

  validate(records: DisruptionRecord[]) {
    const valid: DisruptionRecord[] = [];
    let invalid = 0;
    for (const r of records) {
      const result = disruptionRecordSchema.safeParse(r);
      if (result.success) {
        valid.push(result.data);
      } else {
        invalid++;
      }
    }
    return { valid, invalid };
  }
}

export class WeatherRiskAdapter implements IntelligenceAdapter<WeatherRiskRecord> {
  sourceType = "weather_risk";

  async fetch(): Promise<WeatherRiskRecord[]> {
    return WEATHER_RISK_FIXTURES;
  }

  validate(records: WeatherRiskRecord[]) {
    const valid: WeatherRiskRecord[] = [];
    let invalid = 0;
    for (const r of records) {
      const result = weatherRiskRecordSchema.safeParse(r);
      if (result.success) {
        valid.push(result.data);
      } else {
        invalid++;
      }
    }
    return { valid, invalid };
  }
}
