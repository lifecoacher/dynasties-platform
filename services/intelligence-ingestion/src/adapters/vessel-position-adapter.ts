import type { IntelligenceAdapter, VesselPositionRecord } from "./types.js";
import { vesselPositionRecordSchema } from "./types.js";

const FIXTURE_DATA: VesselPositionRecord[] = [
  {
    vesselName: "EVER GIVEN",
    imo: "9811000",
    mmsi: "353136000",
    latitude: 30.4567,
    longitude: 32.3498,
    heading: 185,
    speed: 12.5,
    status: "underway",
    destination: "CNSHA",
    eta: new Date(Date.now() + 7 * 86400000).toISOString(),
    positionTimestamp: new Date().toISOString(),
  },
  {
    vesselName: "MSC OSCAR",
    imo: "9703318",
    mmsi: "636018207",
    latitude: 1.2644,
    longitude: 103.8198,
    heading: 0,
    speed: 0,
    status: "moored",
    destination: "SGSIN",
    positionTimestamp: new Date().toISOString(),
  },
  {
    vesselName: "CMA CGM MARCO POLO",
    imo: "9454448",
    mmsi: "228339600",
    latitude: 22.3193,
    longitude: 114.1694,
    heading: 270,
    speed: 8.3,
    status: "underway",
    destination: "HKHKG",
    eta: new Date(Date.now() + 2 * 86400000).toISOString(),
    positionTimestamp: new Date().toISOString(),
  },
  {
    vesselName: "MAERSK MC-KINNEY MOLLER",
    imo: "9619907",
    mmsi: "219018734",
    latitude: 51.9496,
    longitude: 4.1453,
    heading: 90,
    speed: 0.2,
    status: "at_berth",
    destination: "NLRTM",
    positionTimestamp: new Date().toISOString(),
  },
  {
    vesselName: "OOCL HONG KONG",
    imo: "9776171",
    mmsi: "477588800",
    latitude: 34.0522,
    longitude: -118.2437,
    heading: 315,
    speed: 14.1,
    status: "underway",
    destination: "USLAX",
    eta: new Date(Date.now() + 1 * 86400000).toISOString(),
    positionTimestamp: new Date().toISOString(),
  },
];

export class VesselPositionAdapter implements IntelligenceAdapter<VesselPositionRecord> {
  sourceType = "vessel_positions";

  async fetch(): Promise<VesselPositionRecord[]> {
    return FIXTURE_DATA.map((d) => ({
      ...d,
      positionTimestamp: new Date().toISOString(),
    }));
  }

  validate(records: VesselPositionRecord[]) {
    const valid: VesselPositionRecord[] = [];
    let invalid = 0;
    for (const r of records) {
      const result = vesselPositionRecordSchema.safeParse(r);
      if (result.success) {
        valid.push(result.data);
      } else {
        invalid++;
      }
    }
    return { valid, invalid };
  }
}
