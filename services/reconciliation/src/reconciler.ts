import { db } from "@workspace/db";
import { shipmentChargesTable, type ReconciliationStatus } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

interface CarrierLineItem {
  code: string;
  description: string;
  amount: number;
  currency?: string;
  chargeType?: string;
}

interface LineItemVariance {
  chargeCode: string;
  description: string;
  expectedAmount: number;
  actualAmount: number;
  variance: number;
  variancePercent: number;
}

interface MissingCharge {
  chargeCode: string;
  description: string;
  expectedAmount: number;
}

interface UnexpectedCharge {
  code: string;
  description: string;
  amount: number;
}

interface DiscrepancyDetails {
  lineItemVariances: LineItemVariance[];
  missingCharges: MissingCharge[];
  unexpectedCharges: UnexpectedCharge[];
  summary: string;
}

export interface ReconciliationInput {
  companyId: string;
  shipmentId: string;
  carrierLineItems: CarrierLineItem[];
  carrierTotal: number;
}

export interface ReconciliationOutput {
  expectedAmount: number;
  actualAmount: number;
  varianceAmount: number;
  variancePercentage: number;
  reconciliationStatus: ReconciliationStatus;
  discrepancyDetails: DiscrepancyDetails;
}

function normalizeChargeCode(code: string): string {
  return code
    .toUpperCase()
    .replace(/[-_\s]+/g, "_")
    .replace(/^(CHRG|CHG|CHARGE)_/, "")
    .trim();
}

function classifyStatus(variancePercent: number): ReconciliationStatus {
  const abs = Math.abs(variancePercent);
  if (abs <= 2) return "MATCHED";
  if (abs <= 5) return "MINOR_VARIANCE";
  return "MAJOR_VARIANCE";
}

export async function reconcile(input: ReconciliationInput): Promise<ReconciliationOutput> {
  const expectedCharges = await db
    .select()
    .from(shipmentChargesTable)
    .where(
      and(
        eq(shipmentChargesTable.companyId, input.companyId),
        eq(shipmentChargesTable.shipmentId, input.shipmentId),
      ),
    );

  const expectedTotal = expectedCharges.reduce(
    (sum, ch) => sum + parseFloat(ch.totalAmount || "0"),
    0,
  );

  const actualTotal = input.carrierTotal;

  const expectedMap = new Map<
    string,
    { code: string; description: string; amount: number }
  >();
  for (const ch of expectedCharges) {
    const key = normalizeChargeCode(ch.chargeCode);
    const existing = expectedMap.get(key);
    expectedMap.set(key, {
      code: ch.chargeCode,
      description: ch.description,
      amount: (existing?.amount || 0) + parseFloat(ch.totalAmount || "0"),
    });
  }

  const actualMap = new Map<
    string,
    { code: string; description: string; amount: number }
  >();
  for (const li of input.carrierLineItems) {
    const key = normalizeChargeCode(li.code);
    const existing = actualMap.get(key);
    actualMap.set(key, {
      code: li.code,
      description: li.description,
      amount: (existing?.amount || 0) + li.amount,
    });
  }

  const lineItemVariances: LineItemVariance[] = [];
  const missingCharges: MissingCharge[] = [];
  const unexpectedCharges: UnexpectedCharge[] = [];
  const matchedActualKeys = new Set<string>();

  for (const [key, expected] of expectedMap) {
    const actual = actualMap.get(key);
    if (actual) {
      matchedActualKeys.add(key);
      const variance = actual.amount - expected.amount;
      const variancePercent =
        expected.amount !== 0
          ? (variance / expected.amount) * 100
          : actual.amount !== 0
            ? 100
            : 0;
      lineItemVariances.push({
        chargeCode: expected.code,
        description: expected.description,
        expectedAmount: expected.amount,
        actualAmount: actual.amount,
        variance,
        variancePercent: Math.round(variancePercent * 100) / 100,
      });
    } else {
      missingCharges.push({
        chargeCode: expected.code,
        description: expected.description,
        expectedAmount: expected.amount,
      });
    }
  }

  for (const [key, actual] of actualMap) {
    if (!matchedActualKeys.has(key)) {
      unexpectedCharges.push({
        code: actual.code,
        description: actual.description,
        amount: actual.amount,
      });
    }
  }

  const varianceAmount = actualTotal - expectedTotal;
  const variancePercentage =
    expectedTotal !== 0
      ? Math.round((varianceAmount / expectedTotal) * 10000) / 100
      : actualTotal !== 0
        ? 100
        : 0;

  let reconciliationStatus: ReconciliationStatus;

  if (expectedCharges.length === 0 && input.carrierLineItems.length === 0) {
    reconciliationStatus = "UNMATCHED";
  } else if (expectedCharges.length === 0) {
    reconciliationStatus = "UNMATCHED";
  } else {
    reconciliationStatus = classifyStatus(variancePercentage);
  }

  const overcharges = lineItemVariances.filter((v) => v.variance > 0);
  const undercharges = lineItemVariances.filter((v) => v.variance < 0);

  const summaryParts: string[] = [];
  if (reconciliationStatus === "MATCHED") {
    summaryParts.push("All charges matched within acceptable tolerance.");
  } else {
    summaryParts.push(
      `Total variance: ${varianceAmount >= 0 ? "+" : ""}${varianceAmount.toFixed(2)} (${variancePercentage}%).`,
    );
    if (overcharges.length > 0)
      summaryParts.push(`${overcharges.length} overcharge(s) detected.`);
    if (undercharges.length > 0)
      summaryParts.push(`${undercharges.length} undercharge(s) detected.`);
    if (missingCharges.length > 0)
      summaryParts.push(
        `${missingCharges.length} expected charge(s) missing from carrier invoice.`,
      );
    if (unexpectedCharges.length > 0)
      summaryParts.push(
        `${unexpectedCharges.length} unexpected charge(s) on carrier invoice.`,
      );
  }

  return {
    expectedAmount: Math.round(expectedTotal * 100) / 100,
    actualAmount: Math.round(actualTotal * 100) / 100,
    varianceAmount: Math.round(varianceAmount * 100) / 100,
    variancePercentage,
    reconciliationStatus,
    discrepancyDetails: {
      lineItemVariances,
      missingCharges,
      unexpectedCharges,
      summary: summaryParts.join(" "),
    },
  };
}
