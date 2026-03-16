import { describe, it, expect } from "vitest";
import { VesselPositionAdapter } from "../adapters/vessel-position-adapter.js";
import { PortCongestionAdapter } from "../adapters/port-congestion-adapter.js";
import { SanctionsAdapter, DeniedPartiesAdapter } from "../adapters/sanctions-adapter.js";
import { DisruptionAdapter, WeatherRiskAdapter } from "../adapters/disruption-adapter.js";
import {
  vesselPositionRecordSchema,
  portCongestionRecordSchema,
  sanctionsRecordSchema,
  deniedPartyRecordSchema,
  disruptionRecordSchema,
  weatherRiskRecordSchema,
} from "../adapters/types.js";
import { computeFingerprint } from "../fingerprint.js";

describe("VesselPositionAdapter", () => {
  const adapter = new VesselPositionAdapter();

  it("fetches fixture data", async () => {
    const records = await adapter.fetch();
    expect(records.length).toBeGreaterThanOrEqual(5);
  });

  it("validates all records successfully", async () => {
    const records = await adapter.fetch();
    const { valid, invalid } = adapter.validate(records);
    expect(invalid).toBe(0);
    expect(valid.length).toBe(records.length);
  });

  it("each record passes Zod schema", async () => {
    const records = await adapter.fetch();
    for (const r of records) {
      const result = vesselPositionRecordSchema.safeParse(r);
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid records", () => {
    const { valid, invalid } = adapter.validate([
      { vesselName: "TEST", latitude: 999, longitude: 0, positionTimestamp: "not-a-date" } as any,
    ]);
    expect(invalid).toBe(1);
    expect(valid.length).toBe(0);
  });
});

describe("PortCongestionAdapter", () => {
  const adapter = new PortCongestionAdapter();

  it("fetches fixture data", async () => {
    const records = await adapter.fetch();
    expect(records.length).toBeGreaterThanOrEqual(6);
  });

  it("validates all records", async () => {
    const records = await adapter.fetch();
    const { valid, invalid } = adapter.validate(records);
    expect(invalid).toBe(0);
    expect(valid.length).toBe(records.length);
  });

  it("each record passes Zod schema", async () => {
    const records = await adapter.fetch();
    for (const r of records) {
      expect(portCongestionRecordSchema.safeParse(r).success).toBe(true);
    }
  });
});

describe("SanctionsAdapter", () => {
  const adapter = new SanctionsAdapter();

  it("fetches fixture data", async () => {
    const records = await adapter.fetch();
    expect(records.length).toBeGreaterThanOrEqual(4);
  });

  it("validates all records", async () => {
    const records = await adapter.fetch();
    const { valid, invalid } = adapter.validate(records);
    expect(invalid).toBe(0);
    expect(valid.length).toBe(records.length);
  });

  it("records include list names and entity types", async () => {
    const records = await adapter.fetch();
    for (const r of records) {
      expect(r.listName).toBeTruthy();
      expect(["individual", "organization", "vessel", "aircraft"]).toContain(r.entityType);
    }
  });
});

describe("DeniedPartiesAdapter", () => {
  const adapter = new DeniedPartiesAdapter();

  it("fetches fixture data", async () => {
    const records = await adapter.fetch();
    expect(records.length).toBeGreaterThanOrEqual(2);
  });

  it("validates all records", async () => {
    const records = await adapter.fetch();
    const { valid, invalid } = adapter.validate(records);
    expect(invalid).toBe(0);
    expect(valid.length).toBe(records.length);
  });
});

describe("DisruptionAdapter", () => {
  const adapter = new DisruptionAdapter();

  it("fetches fixture data", async () => {
    const records = await adapter.fetch();
    expect(records.length).toBeGreaterThanOrEqual(4);
  });

  it("validates all records", async () => {
    const records = await adapter.fetch();
    const { valid, invalid } = adapter.validate(records);
    expect(invalid).toBe(0);
    expect(valid.length).toBe(records.length);
  });

  it("includes affected lanes and ports", async () => {
    const records = await adapter.fetch();
    const withLanes = records.filter((r) => r.affectedLanes && r.affectedLanes.length > 0);
    expect(withLanes.length).toBeGreaterThan(0);
  });
});

describe("WeatherRiskAdapter", () => {
  const adapter = new WeatherRiskAdapter();

  it("fetches fixture data", async () => {
    const records = await adapter.fetch();
    expect(records.length).toBeGreaterThanOrEqual(2);
  });

  it("validates all records", async () => {
    const records = await adapter.fetch();
    const { valid, invalid } = adapter.validate(records);
    expect(invalid).toBe(0);
    expect(valid.length).toBe(records.length);
  });
});

describe("computeFingerprint", () => {
  it("produces a 40-char hex string", () => {
    const fp = computeFingerprint("CNSHA", "2026-01-01");
    expect(fp).toMatch(/^[0-9a-f]{40}$/);
  });

  it("is deterministic", () => {
    const fp1 = computeFingerprint("CNSHA", "disruption", "critical");
    const fp2 = computeFingerprint("CNSHA", "disruption", "critical");
    expect(fp1).toBe(fp2);
  });

  it("varies with different inputs", () => {
    const fp1 = computeFingerprint("CNSHA", "disruption");
    const fp2 = computeFingerprint("SGSIN", "disruption");
    expect(fp1).not.toBe(fp2);
  });

  it("handles null/undefined inputs", () => {
    const fp1 = computeFingerprint("CNSHA", null, undefined);
    const fp2 = computeFingerprint("CNSHA", null, undefined);
    expect(fp1).toBe(fp2);
    expect(fp1).toMatch(/^[0-9a-f]{40}$/);
  });

  it("is case-insensitive", () => {
    const fp1 = computeFingerprint("CNSHA");
    const fp2 = computeFingerprint("cnsha");
    expect(fp1).toBe(fp2);
  });
});
