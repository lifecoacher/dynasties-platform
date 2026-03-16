export const THRESHOLDS = {
  RISK_HIGH: 70,
  RISK_MODERATE: 50,
  RISK_INSURANCE_MISMATCH: 60,
  INSURANCE_LOW_CONFIDENCE: 0.5,
  INSURANCE_MARGIN_RATIO_PCT: 15,
  TRADE_LANE_DELAY_FREQUENCY: 0.3,
  TRADE_LANE_DELAY_HIGH: 0.5,
  CARRIER_PERFORMANCE_LOW: 50,
  TRANSIT_DAYS_UNUSUALLY_LONG: 60,
} as const;

export const EXPIRY_HOURS: Record<string, Record<string, number>> = {
  CRITICAL: { default: 24 },
  HIGH: { default: 72 },
  MEDIUM: { default: 168 },
  LOW: { default: 336 },
};

export function getExpiryHours(urgency: string, _type: string): number {
  return EXPIRY_HOURS[urgency]?.default ?? 168;
}

export function computeExpiresAt(urgency: string, type: string, now?: Date): Date {
  const hours = getExpiryHours(urgency, type);
  const d = new Date(now ?? Date.now());
  d.setTime(d.getTime() + hours * 60 * 60 * 1000);
  return d;
}
