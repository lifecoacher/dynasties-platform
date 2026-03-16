import { z } from "zod";

export const vesselPositionRecordSchema = z.object({
  vesselName: z.string(),
  imo: z.string().optional(),
  mmsi: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  heading: z.number().optional(),
  speed: z.number().optional(),
  status: z.enum(["underway", "anchored", "moored", "at_berth", "drifting", "unknown"]).default("unknown"),
  destination: z.string().optional(),
  eta: z.string().datetime().optional(),
  positionTimestamp: z.string().datetime(),
});

export const portCongestionRecordSchema = z.object({
  portCode: z.string(),
  portName: z.string(),
  congestionLevel: z.enum(["low", "moderate", "high", "critical"]),
  waitingVessels: z.number().int().optional(),
  avgWaitDays: z.number().optional(),
  avgBerthDays: z.number().optional(),
  capacityUtilization: z.number().min(0).max(1).optional(),
  trendDirection: z.enum(["improving", "stable", "worsening"]).optional(),
  snapshotTimestamp: z.string().datetime(),
});

export const sanctionsRecordSchema = z.object({
  listName: z.string(),
  entityName: z.string(),
  entityType: z.enum(["individual", "organization", "vessel", "aircraft"]),
  aliases: z.array(z.string()).optional(),
  country: z.string().optional(),
  sanctionProgram: z.string().optional(),
  listingDate: z.string().datetime().optional(),
  expirationDate: z.string().datetime().optional(),
  identifiers: z.record(z.string()).optional(),
  status: z.enum(["active", "removed", "amended"]).default("active"),
  sourceQuality: z.number().min(0).max(1).optional(),
});

export const deniedPartyRecordSchema = z.object({
  listName: z.string(),
  partyName: z.string(),
  partyType: z.enum(["individual", "organization"]),
  country: z.string().optional(),
  address: z.string().optional(),
  reason: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  status: z.enum(["active", "removed"]).default("active"),
  sourceQuality: z.number().min(0).max(1).optional(),
  listingDate: z.string().datetime().optional(),
});

export const disruptionRecordSchema = z.object({
  eventType: z.enum([
    "port_closure", "canal_blockage", "labor_strike", "geopolitical",
    "natural_disaster", "piracy", "regulatory_change", "infrastructure_failure",
  ]),
  title: z.string(),
  description: z.string().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["active", "monitoring", "resolved", "expired"]).default("active"),
  affectedRegion: z.string().optional(),
  affectedPorts: z.array(z.string()).optional(),
  affectedLanes: z.array(z.string()).optional(),
  estimatedImpactDays: z.number().optional(),
  confidence: z.number().min(0).max(1).optional(),
  startDate: z.string().datetime(),
  expectedEndDate: z.string().datetime().optional(),
});

export const weatherRiskRecordSchema = z.object({
  eventType: z.enum(["typhoon", "hurricane", "storm", "fog", "ice", "monsoon", "flooding", "extreme_heat"]),
  title: z.string(),
  description: z.string().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["forecast", "active", "passing", "resolved"]).default("forecast"),
  affectedRegion: z.string().optional(),
  affectedPorts: z.array(z.string()).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  radiusKm: z.number().optional(),
  windSpeedKnots: z.number().optional(),
  confidence: z.number().min(0).max(1).optional(),
  forecastDate: z.string().datetime(),
  expectedStartDate: z.string().datetime().optional(),
  expectedEndDate: z.string().datetime().optional(),
});

export const laneMarketSignalRecordSchema = z.object({
  originPort: z.string(),
  destinationPort: z.string(),
  signalType: z.enum(["rate_change", "capacity_shift", "demand_surge", "volume_drop", "transit_time_change"]),
  direction: z.enum(["up", "down", "stable"]),
  magnitude: z.number().optional(),
  currentRate: z.number().optional(),
  previousRate: z.number().optional(),
  rateUnit: z.string().optional(),
  avgTransitDays: z.number().optional(),
  capacityUtilization: z.number().optional(),
  confidence: z.number().min(0).max(1).optional(),
  signalTimestamp: z.string().datetime(),
});

export type VesselPositionRecord = z.infer<typeof vesselPositionRecordSchema>;
export type PortCongestionRecord = z.infer<typeof portCongestionRecordSchema>;
export type SanctionsRecord = z.infer<typeof sanctionsRecordSchema>;
export type DeniedPartyRecord = z.infer<typeof deniedPartyRecordSchema>;
export type DisruptionRecord = z.infer<typeof disruptionRecordSchema>;
export type WeatherRiskRecord = z.infer<typeof weatherRiskRecordSchema>;
export type LaneMarketSignalRecord = z.infer<typeof laneMarketSignalRecordSchema>;

export type IntelligenceRecord =
  | VesselPositionRecord
  | PortCongestionRecord
  | SanctionsRecord
  | DeniedPartyRecord
  | DisruptionRecord
  | WeatherRiskRecord
  | LaneMarketSignalRecord;

export interface IntelligenceAdapter<T> {
  sourceType: string;
  fetch(): Promise<T[]>;
  validate(records: T[]): { valid: T[]; invalid: number };
}
