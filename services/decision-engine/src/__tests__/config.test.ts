import { describe, it, expect } from "vitest";
import { computeExpiresAt, getExpiryHours, THRESHOLDS } from "../config.js";

describe("THRESHOLDS", () => {
  it("has all expected keys", () => {
    expect(THRESHOLDS.RISK_HIGH).toBe(70);
    expect(THRESHOLDS.RISK_MODERATE).toBe(50);
    expect(THRESHOLDS.INSURANCE_LOW_CONFIDENCE).toBe(0.5);
    expect(THRESHOLDS.CARRIER_PERFORMANCE_LOW).toBe(50);
    expect(THRESHOLDS.TRANSIT_DAYS_UNUSUALLY_LONG).toBe(60);
    expect(THRESHOLDS.TRADE_LANE_DELAY_FREQUENCY).toBe(0.3);
    expect(THRESHOLDS.INSURANCE_MARGIN_RATIO_PCT).toBe(15);
  });
});

describe("getExpiryHours", () => {
  it("returns 24 for CRITICAL", () => {
    expect(getExpiryHours("CRITICAL", "RISK_MITIGATION")).toBe(24);
  });

  it("returns 72 for HIGH", () => {
    expect(getExpiryHours("HIGH", "DELAY_WARNING")).toBe(72);
  });

  it("returns 168 for MEDIUM", () => {
    expect(getExpiryHours("MEDIUM", "MARGIN_WARNING")).toBe(168);
  });

  it("returns 336 for LOW", () => {
    expect(getExpiryHours("LOW", "ROUTE_ADJUSTMENT")).toBe(336);
  });

  it("defaults to 168 for unknown urgency", () => {
    expect(getExpiryHours("UNKNOWN", "WHATEVER")).toBe(168);
  });
});

describe("computeExpiresAt", () => {
  it("returns future date based on urgency", () => {
    const now = new Date("2026-03-16T12:00:00Z");
    const result = computeExpiresAt("CRITICAL", "RISK_MITIGATION", now);
    const expected = new Date("2026-03-17T12:00:00Z");
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("returns 72 hours for HIGH", () => {
    const now = new Date("2026-03-16T12:00:00Z");
    const result = computeExpiresAt("HIGH", "COMPLIANCE_ESCALATION", now);
    const expected = new Date("2026-03-19T12:00:00Z");
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("returns 14 days for LOW", () => {
    const now = new Date("2026-03-16T12:00:00Z");
    const result = computeExpiresAt("LOW", "ROUTE_ADJUSTMENT", now);
    const expected = new Date("2026-03-30T12:00:00Z");
    expect(result.getTime()).toBe(expected.getTime());
  });
});
