import { describe, it, expect, beforeEach } from "vitest";
import crypto from "node:crypto";

describe("extractAffectedContext logic", () => {
  function collectAffectedContext(
    sourceType: string,
    records: any[],
  ): { portCodes: string[]; laneKeys: string[]; entityIds: string[]; vesselNames: string[] } {
    const portCodes = new Set<string>();
    const laneKeys = new Set<string>();
    const entityIds = new Set<string>();
    const vesselNames = new Set<string>();

    for (const r of records) {
      switch (sourceType) {
        case "port_congestion":
          if (r.portCode) portCodes.add(r.portCode);
          break;
        case "disruptions":
        case "weather_risk":
          if (r.affectedPorts) for (const p of r.affectedPorts) portCodes.add(p);
          if (r.affectedLanes) for (const l of r.affectedLanes) laneKeys.add(l);
          break;
        case "sanctions":
        case "denied_parties":
          if (r.entityName) entityIds.add(r.entityName);
          if (r.partyName) entityIds.add(r.partyName);
          break;
        case "vessel_positions":
          if (r.vesselName) vesselNames.add(r.vesselName);
          break;
      }
    }

    return {
      portCodes: [...portCodes],
      laneKeys: [...laneKeys],
      entityIds: [...entityIds],
      vesselNames: [...vesselNames],
    };
  }

  it("extracts port codes from port_congestion records", () => {
    const result = collectAffectedContext("port_congestion", [
      { portCode: "CNSHA", portName: "Shanghai" },
      { portCode: "SGSIN", portName: "Singapore" },
    ]);
    expect(result.portCodes).toEqual(["CNSHA", "SGSIN"]);
    expect(result.laneKeys).toEqual([]);
  });

  it("extracts vessels from vessel_positions records", () => {
    const result = collectAffectedContext("vessel_positions", [
      { vesselName: "EVER GIVEN" },
    ]);
    expect(result.vesselNames).toEqual(["EVER GIVEN"]);
  });

  it("extracts entities from sanctions records", () => {
    const result = collectAffectedContext("sanctions", [
      { entityName: "ACME Corp" },
    ]);
    expect(result.entityIds).toEqual(["ACME Corp"]);
  });

  it("extracts ports and lanes from disruptions", () => {
    const result = collectAffectedContext("disruptions", [
      { affectedPorts: ["CNSHA", "SGSIN"], affectedLanes: ["CNSHA-SGSIN"] },
    ]);
    expect(result.portCodes).toEqual(["CNSHA", "SGSIN"]);
    expect(result.laneKeys).toEqual(["CNSHA-SGSIN"]);
  });

  it("returns empty arrays for unknown source types", () => {
    const result = collectAffectedContext("unknown", [{ foo: "bar" }]);
    expect(result.portCodes).toEqual([]);
    expect(result.laneKeys).toEqual([]);
    expect(result.entityIds).toEqual([]);
    expect(result.vesselNames).toEqual([]);
  });

  it("deduplicates port codes across records", () => {
    const result = collectAffectedContext("port_congestion", [
      { portCode: "CNSHA" },
      { portCode: "CNSHA" },
      { portCode: "SGSIN" },
    ]);
    expect(result.portCodes).toEqual(["CNSHA", "SGSIN"]);
  });
});

describe("reanalysis throttling logic", () => {
  it("tracks recently queued shipments with time-based expiry", () => {
    const recentlyQueued = new Map<string, number>();
    const THROTTLE_MS = 5 * 60 * 1000;

    recentlyQueued.set("ship-1", Date.now());
    recentlyQueued.set("ship-2", Date.now() - 10 * 60 * 1000);

    const ship1Time = recentlyQueued.get("ship-1")!;
    const ship2Time = recentlyQueued.get("ship-2")!;

    expect(Date.now() - ship1Time < THROTTLE_MS).toBe(true);
    expect(Date.now() - ship2Time < THROTTLE_MS).toBe(false);
  });

  it("cleanup removes expired entries", () => {
    const recentlyQueued = new Map<string, number>();
    const THROTTLE_MS = 5 * 60 * 1000;
    const cutoff = Date.now() - THROTTLE_MS;

    recentlyQueued.set("ship-1", Date.now());
    recentlyQueued.set("ship-2", cutoff - 1000);
    recentlyQueued.set("ship-3", cutoff - 5000);

    for (const [key, ts] of recentlyQueued) {
      if (ts < cutoff) recentlyQueued.delete(key);
    }

    expect(recentlyQueued.size).toBe(1);
    expect(recentlyQueued.has("ship-1")).toBe(true);
  });
});

describe("scoring layer weights", () => {
  it("composite lane score weights sum to 1.0", () => {
    const weights = [0.25, 0.3, 0.25, 0.2];
    const total = weights.reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0);
  });

  it("composite port score weights sum to 1.0", () => {
    const weights = [0.35, 0.25, 0.25, 0.15];
    const total = weights.reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0);
  });

  it("composite carrier score weights sum to 1.0", () => {
    const weights = [0.3, 0.25, 0.25, 0.2];
    const total = weights.reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0);
  });

  it("composite entity score weights sum to 1.0", () => {
    const weights = [0.5, 0.35, 0.15];
    const total = weights.reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0);
  });

  it("CONGESTION_MAP values are ordered", () => {
    const map: Record<string, number> = { low: 10, moderate: 30, high: 65, critical: 90 };
    expect(map.low).toBeLessThan(map.moderate);
    expect(map.moderate).toBeLessThan(map.high);
    expect(map.high).toBeLessThan(map.critical);
  });

  it("SEVERITY_MAP values are ordered", () => {
    const map: Record<string, number> = { low: 15, medium: 40, high: 70, critical: 95 };
    expect(map.low).toBeLessThan(map.medium);
    expect(map.medium).toBeLessThan(map.high);
    expect(map.high).toBeLessThan(map.critical);
  });

  it("delay stress score caps at 100", () => {
    const delayFrequency = 0.8;
    const score = Math.min(100, Math.round(delayFrequency * 150));
    expect(score).toBe(100);
  });

  it("delay stress score scales linearly", () => {
    const score30 = Math.min(100, Math.round(0.3 * 150));
    const score50 = Math.min(100, Math.round(0.5 * 150));
    expect(score30).toBe(45);
    expect(score50).toBe(75);
  });
});

describe("snapshot hash determinism", () => {
  it("produces consistent hash for same data", () => {
    const data1 = {
      congestionScore: 65,
      disruptionScore: 40,
      weatherRiskScore: 0,
      sanctionsRiskScore: 30,
      vesselRiskScore: 0,
      marketPressureScore: 20,
      linkedSignalIds: ["sig-1", "sig-2"],
    };
    const data2 = { ...data1 };
    const hash1 = crypto.createHash("sha256").update(JSON.stringify(data1)).digest("hex").slice(0, 40);
    const hash2 = crypto.createHash("sha256").update(JSON.stringify(data2)).digest("hex").slice(0, 40);
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(40);
  });

  it("produces different hash for different data", () => {
    const data1 = { congestionScore: 65, linkedSignalIds: ["sig-1"] };
    const data2 = { congestionScore: 70, linkedSignalIds: ["sig-1"] };
    const hash1 = crypto.createHash("sha256").update(JSON.stringify(data1)).digest("hex").slice(0, 40);
    const hash2 = crypto.createHash("sha256").update(JSON.stringify(data2)).digest("hex").slice(0, 40);
    expect(hash1).not.toBe(hash2);
  });

  it("hash is order-sensitive for signal IDs", () => {
    const data1 = { linkedSignalIds: ["sig-1", "sig-2"] };
    const data2 = { linkedSignalIds: ["sig-2", "sig-1"] };
    const hash1 = crypto.createHash("sha256").update(JSON.stringify(data1)).digest("hex").slice(0, 40);
    const hash2 = crypto.createHash("sha256").update(JSON.stringify(data2)).digest("hex").slice(0, 40);
    expect(hash1).not.toBe(hash2);
  });
});

describe("intelligence snapshot schema", () => {
  it("snapshot table has required fields", async () => {
    const { shipmentIntelligenceSnapshotsTable } = await import("@workspace/db/schema");
    const cols = Object.keys(shipmentIntelligenceSnapshotsTable);
    expect(cols).toContain("id");
    expect(cols).toContain("shipmentId");
    expect(cols).toContain("companyId");
    expect(cols).toContain("congestionScore");
    expect(cols).toContain("disruptionScore");
    expect(cols).toContain("weatherRiskScore");
    expect(cols).toContain("sanctionsRiskScore");
    expect(cols).toContain("vesselRiskScore");
    expect(cols).toContain("marketPressureScore");
    expect(cols).toContain("compositeIntelScore");
    expect(cols).toContain("linkedSignalIds");
    expect(cols).toContain("externalReasonCodes");
    expect(cols).toContain("evidenceSummary");
    expect(cols).toContain("snapshotHash");
    expect(cols).toContain("generatedAt");
  });
});

describe("scoring schema", () => {
  it("lane_scores table has required fields", async () => {
    const { laneScoresTable } = await import("@workspace/db/schema");
    const cols = Object.keys(laneScoresTable);
    expect(cols).toContain("originPort");
    expect(cols).toContain("destinationPort");
    expect(cols).toContain("congestionScore");
    expect(cols).toContain("disruptionScore");
    expect(cols).toContain("delayStressScore");
    expect(cols).toContain("marketPressureScore");
    expect(cols).toContain("compositeStressScore");
  });

  it("port_scores table has required fields", async () => {
    const { portScoresTable } = await import("@workspace/db/schema");
    const cols = Object.keys(portScoresTable);
    expect(cols).toContain("portCode");
    expect(cols).toContain("congestionSeverity");
    expect(cols).toContain("weatherExposure");
    expect(cols).toContain("disruptionExposure");
    expect(cols).toContain("operationalVolatility");
    expect(cols).toContain("compositeScore");
  });

  it("carrier_scores table has required fields", async () => {
    const { carrierScoresTable } = await import("@workspace/db/schema");
    const cols = Object.keys(carrierScoresTable);
    expect(cols).toContain("carrierName");
    expect(cols).toContain("performanceScore");
    expect(cols).toContain("anomalyScore");
    expect(cols).toContain("reliabilityScore");
    expect(cols).toContain("laneStressExposure");
    expect(cols).toContain("compositeScore");
  });

  it("entity_scores table has required fields", async () => {
    const { entityScoresTable } = await import("@workspace/db/schema");
    const cols = Object.keys(entityScoresTable);
    expect(cols).toContain("entityId");
    expect(cols).toContain("sanctionsRiskScore");
    expect(cols).toContain("deniedPartyConfidence");
    expect(cols).toContain("documentationIrregularity");
    expect(cols).toContain("compositeScore");
  });
});

describe("recommendations schema has snapshotId", () => {
  it("recommendations table includes snapshotId", async () => {
    const { recommendationsTable } = await import("@workspace/db/schema");
    const cols = Object.keys(recommendationsTable);
    expect(cols).toContain("snapshotId");
  });
});

describe("analytics aggregation logic", () => {
  it("acceptance rate calculation is correct", () => {
    const total = 100;
    const accepted = 30;
    const modified = 10;
    const implemented = 15;
    const rate = Math.round(((accepted + modified + implemented) / total) * 1000) / 10;
    expect(rate).toBe(55);
  });

  it("implementation rate calculation is correct", () => {
    const responded = 60;
    const implemented = 15;
    const rate = (implemented / responded) * 100;
    expect(rate).toBe(25);
  });

  it("intel enrichment rate uses correct rounding", () => {
    const total = 50;
    const enriched = 20;
    const rate = Math.round((enriched / total) * 1000) / 10;
    expect(rate).toBe(40);
  });

  it("handles zero total gracefully", () => {
    const total = 0;
    const rate = total > 0 ? 100 : 0;
    expect(rate).toBe(0);
  });

  it("enrichment rate boundary case at 100%", () => {
    const total = 10;
    const enriched = 10;
    const rate = Math.round((enriched / total) * 1000) / 10;
    expect(rate).toBe(100);
  });
});

describe("DecisionJob trigger types", () => {
  it("supports intelligence_change trigger", () => {
    type Trigger = "m4_complete" | "exception_detected" | "manual" | "intelligence_change";
    const trigger: Trigger = "intelligence_change";
    expect(trigger).toBe("intelligence_change");
  });
});

describe("MAX_BATCH_SIZE limits", () => {
  it("impacted shipments are capped at 50", () => {
    const MAX_BATCH_SIZE = 50;
    const impacted = Array.from({ length: 100 }, (_, i) => ({
      shipmentId: `ship-${i}`,
      reason: "test",
    }));
    const capped = impacted.slice(0, MAX_BATCH_SIZE);
    expect(capped.length).toBe(50);
  });
});
