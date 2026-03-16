import type { IntelligenceAdapter, PortCongestionRecord } from "./types.js";
import { portCongestionRecordSchema } from "./types.js";

const FIXTURE_DATA: PortCongestionRecord[] = [
  {
    portCode: "CNSHA",
    portName: "Shanghai",
    congestionLevel: "high",
    waitingVessels: 42,
    avgWaitDays: 3.5,
    avgBerthDays: 2.1,
    capacityUtilization: 0.92,
    trendDirection: "worsening",
    snapshotTimestamp: new Date().toISOString(),
  },
  {
    portCode: "SGSIN",
    portName: "Singapore",
    congestionLevel: "moderate",
    waitingVessels: 18,
    avgWaitDays: 1.2,
    avgBerthDays: 1.5,
    capacityUtilization: 0.78,
    trendDirection: "stable",
    snapshotTimestamp: new Date().toISOString(),
  },
  {
    portCode: "NLRTM",
    portName: "Rotterdam",
    congestionLevel: "low",
    waitingVessels: 5,
    avgWaitDays: 0.3,
    avgBerthDays: 1.0,
    capacityUtilization: 0.55,
    trendDirection: "improving",
    snapshotTimestamp: new Date().toISOString(),
  },
  {
    portCode: "USLAX",
    portName: "Los Angeles",
    congestionLevel: "critical",
    waitingVessels: 67,
    avgWaitDays: 7.2,
    avgBerthDays: 3.4,
    capacityUtilization: 0.97,
    trendDirection: "worsening",
    snapshotTimestamp: new Date().toISOString(),
  },
  {
    portCode: "DEHAM",
    portName: "Hamburg",
    congestionLevel: "moderate",
    waitingVessels: 12,
    avgWaitDays: 1.8,
    avgBerthDays: 1.6,
    capacityUtilization: 0.72,
    trendDirection: "stable",
    snapshotTimestamp: new Date().toISOString(),
  },
  {
    portCode: "HKHKG",
    portName: "Hong Kong",
    congestionLevel: "high",
    waitingVessels: 31,
    avgWaitDays: 2.8,
    avgBerthDays: 1.9,
    capacityUtilization: 0.88,
    trendDirection: "worsening",
    snapshotTimestamp: new Date().toISOString(),
  },
];

export class PortCongestionAdapter implements IntelligenceAdapter<PortCongestionRecord> {
  sourceType = "port_congestion";

  async fetch(): Promise<PortCongestionRecord[]> {
    return FIXTURE_DATA.map((d) => ({
      ...d,
      snapshotTimestamp: new Date().toISOString(),
    }));
  }

  validate(records: PortCongestionRecord[]) {
    const valid: PortCongestionRecord[] = [];
    let invalid = 0;
    for (const r of records) {
      const result = portCongestionRecordSchema.safeParse(r);
      if (result.success) {
        valid.push(result.data);
      } else {
        invalid++;
      }
    }
    return { valid, invalid };
  }
}
