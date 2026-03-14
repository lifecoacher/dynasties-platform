type DocumentType =
  | "BOL"
  | "COMMERCIAL_INVOICE"
  | "PACKING_LIST"
  | "CERTIFICATE_OF_ORIGIN"
  | "ARRIVAL_NOTICE"
  | "CUSTOMS_DECLARATION"
  | "RATE_CONFIRMATION"
  | "UNKNOWN";

interface ClassificationResult {
  documentType: DocumentType;
  confidence: number;
}

const FILENAME_PATTERNS: [RegExp, DocumentType, number][] = [
  [/b[\/]?l|bill\s*of\s*lading|bol/i, "BOL", 0.85],
  [/commercial\s*invoice|comm?\s*inv/i, "COMMERCIAL_INVOICE", 0.85],
  [/packing\s*list|pkg\s*list/i, "PACKING_LIST", 0.85],
  [/cert.*origin|c[\/]?o/i, "CERTIFICATE_OF_ORIGIN", 0.8],
  [/arrival\s*notice|a[\/]?n/i, "ARRIVAL_NOTICE", 0.8],
  [/customs|declaration/i, "CUSTOMS_DECLARATION", 0.75],
  [/rate\s*confirm/i, "RATE_CONFIRMATION", 0.8],
];

const CONTENT_PATTERNS: [RegExp, DocumentType, number][] = [
  [/bill\s*of\s*lading|shipper|consignee.*notify/i, "BOL", 0.7],
  [/commercial\s*invoice|unit\s*price|total\s*amount/i, "COMMERCIAL_INVOICE", 0.7],
  [/packing\s*list|carton|package.*weight/i, "PACKING_LIST", 0.7],
  [/certificate\s*of\s*origin|country\s*of\s*origin.*goods/i, "CERTIFICATE_OF_ORIGIN", 0.7],
  [/arrival\s*notice|eta.*vessel/i, "ARRIVAL_NOTICE", 0.7],
  [/customs\s*declaration|import.*duty/i, "CUSTOMS_DECLARATION", 0.65],
  [/rate\s*confirmation|freight\s*charge/i, "RATE_CONFIRMATION", 0.7],
];

export function classifyDocumentType(
  fileName: string,
  contentPreview?: string,
): ClassificationResult {
  for (const [pattern, docType, confidence] of FILENAME_PATTERNS) {
    if (pattern.test(fileName)) {
      return { documentType: docType, confidence };
    }
  }

  if (contentPreview) {
    const preview = contentPreview.slice(0, 500);
    for (const [pattern, docType, confidence] of CONTENT_PATTERNS) {
      if (pattern.test(preview)) {
        return { documentType: docType, confidence };
      }
    }
  }

  return { documentType: "UNKNOWN", confidence: 0 };
}
