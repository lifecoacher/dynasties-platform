import {
  getRequiredDocuments,
  getRequiredFields,
  CONSISTENCY_CHECKS,
  type RequiredDocRule,
} from "./rules.js";

export interface DocumentInfo {
  documentId: string;
  documentType: string | null;
  filename: string | null;
  extractedData: Record<string, any> | null;
  extractionStatus: string | null;
  documentTypeConfidence: number | null;
}

export interface MissingDocument {
  code: string;
  label: string;
  reason: string;
  severity: "WARNING" | "CRITICAL";
}

export interface MissingField {
  documentType?: string | null;
  field: string;
  severity: "WARNING" | "CRITICAL";
  detail: string;
}

export interface Inconsistency {
  code: string;
  field: string;
  values: string[];
  severity: "WARNING" | "CRITICAL";
  detail: string;
}

export interface SuspiciousFinding {
  code: string;
  title: string;
  detail: string;
  severity: "WARNING" | "CRITICAL";
}

export interface SourceDocument {
  documentId: string;
  documentType?: string | null;
  filename?: string | null;
  validationState: "VALID" | "INCOMPLETE" | "CONFLICTED" | "UNKNOWN";
}

export interface CheckerResult {
  missingDocuments: MissingDocument[];
  missingFields: MissingField[];
  inconsistencies: Inconsistency[];
  suspiciousFindings: SuspiciousFinding[];
  sourceDocuments: SourceDocument[];
}

function extractFieldValue(extracted: Record<string, any>, field: string): string | null {
  const entry = extracted[field];
  if (!entry) return null;
  if (typeof entry === "string") return entry;
  if (typeof entry === "number") return String(entry);
  if (entry && typeof entry === "object" && "value" in entry) {
    const val = entry.value;
    if (val === null || val === undefined || val === "") return null;
    return String(val);
  }
  return null;
}

function extractConfidence(extracted: Record<string, any>, field: string): number | null {
  const entry = extracted[field];
  if (entry && typeof entry === "object" && "confidence" in entry) {
    return typeof entry.confidence === "number" ? entry.confidence : null;
  }
  return null;
}

export function runDeterministicChecks(
  documents: DocumentInfo[],
  shipmentStatus: string,
  shipmentType?: string | null,
): CheckerResult {
  const missingDocuments: MissingDocument[] = [];
  const missingFields: MissingField[] = [];
  const inconsistencies: Inconsistency[] = [];
  const suspiciousFindings: SuspiciousFinding[] = [];
  const sourceDocuments: SourceDocument[] = [];

  const docTypeSet = new Set(
    documents.filter((d) => d.documentType).map((d) => d.documentType as string),
  );

  const requiredDocs = getRequiredDocuments(shipmentStatus, shipmentType);
  for (const rule of requiredDocs) {
    if (!docTypeSet.has(rule.code)) {
      missingDocuments.push({
        code: rule.code,
        label: rule.label,
        reason: `Required ${rule.label} is missing for this shipment.`,
        severity: rule.severity,
      });
    }
  }

  const docStates = new Map<string, "VALID" | "INCOMPLETE" | "CONFLICTED" | "UNKNOWN">();

  for (const doc of documents) {
    const docType = doc.documentType || "UNKNOWN";
    let state: "VALID" | "INCOMPLETE" | "CONFLICTED" | "UNKNOWN" = "VALID";

    if (!doc.extractedData || doc.extractionStatus !== "EXTRACTED") {
      state = "UNKNOWN";
      if (doc.extractionStatus === "FAILED") {
        suspiciousFindings.push({
          code: "EXTRACTION_FAILED",
          title: `Extraction failed: ${doc.filename || doc.documentId}`,
          detail: `Document extraction failed for ${docType}. Manual review required.`,
          severity: "CRITICAL",
        });
      }
    } else {
      const fieldRules = getRequiredFields(docType);
      for (const rule of fieldRules) {
        const value = extractFieldValue(doc.extractedData, rule.field);
        if (!value) {
          missingFields.push({
            documentType: docType,
            field: rule.field,
            severity: rule.severity,
            detail: `${rule.label} is missing in ${docType}.`,
          });
          if (rule.severity === "CRITICAL") state = "INCOMPLETE";
        }

        const confidence = extractConfidence(doc.extractedData, rule.field);
        if (confidence !== null && confidence < 0.5) {
          suspiciousFindings.push({
            code: "LOW_CONFIDENCE",
            title: `Low confidence: ${rule.label} in ${docType}`,
            detail: `Extracted ${rule.label} has low confidence (${(confidence * 100).toFixed(0)}%). Verify manually.`,
            severity: "WARNING",
          });
        }
      }
    }

    if (doc.documentTypeConfidence !== null && doc.documentTypeConfidence < 0.6) {
      suspiciousFindings.push({
        code: "LOW_DOCTYPE_CONFIDENCE",
        title: `Document type uncertain: ${doc.filename || doc.documentId}`,
        detail: `Document classified as ${docType} with only ${((doc.documentTypeConfidence ?? 0) * 100).toFixed(0)}% confidence.`,
        severity: "WARNING",
      });
    }

    docStates.set(doc.documentId, state);

    sourceDocuments.push({
      documentId: doc.documentId,
      documentType: docType,
      filename: doc.filename,
      validationState: state,
    });
  }

  const extractedDocs = documents.filter(
    (d) => d.extractedData && d.extractionStatus === "EXTRACTED",
  );

  for (const check of CONSISTENCY_CHECKS) {
    const valuesMap = new Map<string, string>();
    for (const doc of extractedDocs) {
      const val = extractFieldValue(doc.extractedData!, check.field);
      if (val) {
        valuesMap.set(doc.documentType || doc.documentId, val);
      }
    }

    if (valuesMap.size >= 2) {
      const uniqueValues = [...new Set(valuesMap.values())];
      if (uniqueValues.length > 1) {
        const normalizedUnique = [...new Set(uniqueValues.map((v) => v.toLowerCase().trim()))];
        if (normalizedUnique.length > 1) {
          inconsistencies.push({
            code: check.code,
            field: check.field,
            values: uniqueValues,
            severity: check.severity,
            detail: `${check.label} differs across documents: ${uniqueValues.map((v) => `"${v}"`).join(" vs ")}`,
          });

          for (const doc of extractedDocs) {
            const val = extractFieldValue(doc.extractedData!, check.field);
            if (val) {
              const cur = docStates.get(doc.documentId);
              if (cur !== "INCOMPLETE") {
                docStates.set(doc.documentId, "CONFLICTED");
              }
            }
          }
        }
      }
    }
  }

  for (const sd of sourceDocuments) {
    sd.validationState = docStates.get(sd.documentId) || sd.validationState;
  }

  return {
    missingDocuments,
    missingFields,
    inconsistencies,
    suspiciousFindings,
    sourceDocuments,
  };
}

export function deriveStatus(result: CheckerResult): {
  status: "READY" | "REVIEW" | "BLOCKED";
  readinessLevel: "COMPLETE" | "PARTIAL" | "INSUFFICIENT";
} {
  const hasCriticalMissing = result.missingDocuments.some((d) => d.severity === "CRITICAL");
  const hasCriticalFields = result.missingFields.some((f) => f.severity === "CRITICAL");
  const hasCriticalInconsistency = result.inconsistencies.some((i) => i.severity === "CRITICAL");
  const hasCriticalSuspicious = result.suspiciousFindings.some((s) => s.severity === "CRITICAL");

  const hasWarnings =
    result.missingDocuments.some((d) => d.severity === "WARNING") ||
    result.missingFields.some((f) => f.severity === "WARNING") ||
    result.inconsistencies.some((i) => i.severity === "WARNING") ||
    result.suspiciousFindings.some((s) => s.severity === "WARNING");

  if (hasCriticalMissing || (hasCriticalInconsistency && hasCriticalFields)) {
    return { status: "BLOCKED", readinessLevel: "INSUFFICIENT" };
  }

  if (hasCriticalFields || hasCriticalInconsistency || hasCriticalSuspicious) {
    return { status: "REVIEW", readinessLevel: "PARTIAL" };
  }

  if (hasWarnings) {
    return { status: "REVIEW", readinessLevel: "PARTIAL" };
  }

  return { status: "READY", readinessLevel: "COMPLETE" };
}
