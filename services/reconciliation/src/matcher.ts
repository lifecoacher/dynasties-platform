import { db } from "@workspace/db";
import { shipmentsTable } from "@workspace/db/schema";
import { eq, and, ilike, or } from "drizzle-orm";

export interface MatchResult {
  shipmentId: string | null;
  confidence: number;
  method: "EXACT" | "FUZZY" | "MANUAL" | "UNMATCHED";
  shipmentReference?: string;
}

export async function matchCarrierInvoiceToShipment(
  companyId: string,
  shipmentReference: string | null | undefined,
  carrierName: string | null | undefined,
): Promise<MatchResult> {
  if (!shipmentReference) {
    return { shipmentId: null, confidence: 0, method: "UNMATCHED" };
  }

  const trimmedRef = shipmentReference.trim();

  const exactMatches = await db
    .select({ id: shipmentsTable.id, reference: shipmentsTable.reference })
    .from(shipmentsTable)
    .where(
      and(
        eq(shipmentsTable.companyId, companyId),
        eq(shipmentsTable.reference, trimmedRef),
      ),
    )
    .limit(1);

  if (exactMatches.length > 0) {
    return {
      shipmentId: exactMatches[0].id,
      confidence: 1.0,
      method: "EXACT",
      shipmentReference: exactMatches[0].reference ?? undefined,
    };
  }

  const fuzzyMatches = await db
    .select({ id: shipmentsTable.id, reference: shipmentsTable.reference })
    .from(shipmentsTable)
    .where(
      and(
        eq(shipmentsTable.companyId, companyId),
        or(
          ilike(shipmentsTable.reference, `%${trimmedRef}%`),
          ilike(shipmentsTable.reference, `%${trimmedRef.replace(/[-_\s]/g, "%")}%`),
        ),
      ),
    )
    .limit(5);

  if (fuzzyMatches.length === 1) {
    return {
      shipmentId: fuzzyMatches[0].id,
      confidence: 0.85,
      method: "FUZZY",
      shipmentReference: fuzzyMatches[0].reference ?? undefined,
    };
  }

  if (fuzzyMatches.length > 1) {
    return { shipmentId: null, confidence: 0, method: "UNMATCHED" };
  }

  return { shipmentId: null, confidence: 0, method: "UNMATCHED" };
}
