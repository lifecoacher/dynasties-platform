import type { ExtractionOutput } from "@workspace/shared-schemas";

export interface ShipmentDraftInput {
  documentIds: string[];
  extractedDataList: ExtractionOutput[];
  resolvedParties: Record<string, { entityId: string }>;
  companyId: string;
}

export interface ShipmentConflict {
  field: string;
  values: { documentIndex: number; value: unknown; confidence: number }[];
}

export interface ShipmentDraft {
  companyId: string;
  reference: string;
  status: "DRAFT";
  shipperId: string | null;
  consigneeId: string | null;
  notifyPartyId: string | null;
  carrierId: string | null;
  portOfLoading: string | null;
  portOfDischarge: string | null;
  vessel: string | null;
  voyage: string | null;
  commodity: string | null;
  hsCode: string | null;
  packageCount: number | null;
  grossWeight: number | null;
  weightUnit: string | null;
  volume: number | null;
  volumeUnit: string | null;
  incoterms: string | null;
  bookingNumber: string | null;
  blNumber: string | null;
  conflicts: ShipmentConflict[];
  documentIds: string[];
}

type ExtractedField = { value: unknown; confidence: number; source?: string; needsReview?: boolean };

function pickBestValue(
  fieldName: string,
  dataList: ExtractionOutput[],
): { value: unknown; conflict: ShipmentConflict | null } {
  const entries: { documentIndex: number; value: unknown; confidence: number }[] = [];

  for (let i = 0; i < dataList.length; i++) {
    const field = (dataList[i] as Record<string, ExtractedField | undefined>)[fieldName];
    if (field && field.value !== undefined && field.value !== null) {
      entries.push({ documentIndex: i, value: field.value, confidence: field.confidence });
    }
  }

  if (entries.length === 0) return { value: null, conflict: null };
  if (entries.length === 1) return { value: entries[0].value, conflict: null };

  const normalized = entries.map((e) =>
    typeof e.value === "string" ? e.value.trim().toLowerCase() : JSON.stringify(e.value),
  );
  const allSame = normalized.every((v) => v === normalized[0]);

  if (allSame) return { value: entries[0].value, conflict: null };

  entries.sort((a, b) => b.confidence - a.confidence);
  return {
    value: entries[0].value,
    conflict: { field: fieldName, values: entries },
  };
}

function parseWeight(raw: unknown): { weight: number | null; unit: string | null } {
  if (typeof raw === "number") return { weight: raw, unit: "KG" };
  if (typeof raw !== "string") return { weight: null, unit: null };

  const match = raw.match(/([\d,.]+)\s*(KG|LB|kg|lb|MT|mt)?/);
  if (!match) return { weight: null, unit: null };

  const weight = parseFloat(match[1].replace(/,/g, ""));
  const unit = (match[2] || "KG").toUpperCase();
  return { weight: isNaN(weight) ? null : weight, unit: unit === "MT" ? "KG" : unit };
}

function parseVolume(raw: unknown): { volume: number | null; unit: string | null } {
  if (typeof raw === "number") return { volume: raw, unit: "CBM" };
  if (typeof raw !== "string") return { volume: null, unit: null };

  const match = raw.match(/([\d,.]+)\s*(CBM|CFT|cbm|cft)?/);
  if (!match) return { volume: null, unit: null };

  const volume = parseFloat(match[1].replace(/,/g, ""));
  const unit = (match[2] || "CBM").toUpperCase();
  return { volume: isNaN(volume) ? null : volume, unit };
}

function extractIncoterms(freightTerms: unknown): string | null {
  if (typeof freightTerms !== "string") return null;
  const incoMatch = freightTerms.match(/\b(EXW|FCA|CPT|CIP|DAP|DPU|DDP|FAS|FOB|CFR|CIF)\b/i);
  return incoMatch ? incoMatch[1].toUpperCase() : null;
}

function generateReference(blNumber: unknown, bookingNumber: unknown): string {
  if (typeof blNumber === "string" && blNumber.trim()) return `SHP-${blNumber.trim()}`;
  if (typeof bookingNumber === "string" && bookingNumber.trim()) return `SHP-${bookingNumber.trim()}`;
  return `SHP-${Date.now().toString(36).toUpperCase()}`;
}

export function buildShipmentDraft(input: ShipmentDraftInput): ShipmentDraft {
  const { extractedDataList, resolvedParties, companyId, documentIds } = input;
  const conflicts: ShipmentConflict[] = [];

  const fields = [
    "portOfLoading", "portOfDischarge", "vessel", "voyage",
    "commodity", "hsCode", "packageCount", "weight", "volume",
    "freightTerms", "bookingNumber", "blNumber",
  ];

  const resolved: Record<string, unknown> = {};
  for (const field of fields) {
    const result = pickBestValue(field, extractedDataList);
    resolved[field] = result.value;
    if (result.conflict) conflicts.push(result.conflict);
  }

  const shipmentDateResult = pickBestValue("shipmentDate", extractedDataList);
  if (shipmentDateResult.conflict) conflicts.push(shipmentDateResult.conflict);

  const weightParsed = parseWeight(resolved.weight);
  const volumeParsed = parseVolume(resolved.volume);
  const incoterms = extractIncoterms(resolved.freightTerms);

  return {
    companyId,
    reference: generateReference(resolved.blNumber, resolved.bookingNumber),
    status: "DRAFT",
    shipperId: resolvedParties.SHIPPER?.entityId || null,
    consigneeId: resolvedParties.CONSIGNEE?.entityId || null,
    notifyPartyId: resolvedParties.NOTIFY_PARTY?.entityId || null,
    carrierId: resolvedParties.CARRIER?.entityId || null,
    portOfLoading: typeof resolved.portOfLoading === "string" ? resolved.portOfLoading : null,
    portOfDischarge: typeof resolved.portOfDischarge === "string" ? resolved.portOfDischarge : null,
    vessel: typeof resolved.vessel === "string" ? resolved.vessel : null,
    voyage: typeof resolved.voyage === "string" ? resolved.voyage : null,
    commodity: typeof resolved.commodity === "string" ? resolved.commodity : null,
    hsCode: typeof resolved.hsCode === "string" ? resolved.hsCode : null,
    packageCount: typeof resolved.packageCount === "number" ? resolved.packageCount : null,
    grossWeight: weightParsed.weight,
    weightUnit: weightParsed.unit,
    volume: volumeParsed.volume,
    volumeUnit: volumeParsed.unit,
    incoterms,
    bookingNumber: typeof resolved.bookingNumber === "string" ? resolved.bookingNumber : null,
    blNumber: typeof resolved.blNumber === "string" ? resolved.blNumber : null,
    conflicts,
    documentIds,
  };
}
