export function normalizeRiskScore(score: number | undefined | null): number | null {
  if (score == null) return null;
  const n = Number(score);
  if (n <= 1 && n >= 0) return Math.round(n * 100);
  return Math.round(n);
}

export function riskColor(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score < 30) return "text-emerald-400";
  if (score < 60) return "text-amber-400";
  return "text-red-400";
}

export function riskLabel(score: number | null): string {
  if (score == null) return "N/A";
  if (score < 30) return "Low";
  if (score < 60) return "Medium";
  return "High";
}

export function riskCssColor(score: number | null): string {
  if (score == null) return "hsl(var(--muted-foreground))";
  if (score < 30) return "hsl(var(--success))";
  if (score >= 70) return "hsl(var(--destructive))";
  return "hsl(var(--warning))";
}

export function formatCurrency(amount: number | string | null | undefined, currency = "USD"): string {
  if (amount == null) return "N/A";
  return `${currency} ${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatWeight(weight: number | string | null | undefined, unit = "KG"): string {
  if (weight == null) return "N/A";
  return `${Number(weight).toLocaleString("en-US")} ${unit}`;
}

export function humanizeLabel(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function agentLabel(eventType: string): string {
  const map: Record<string, string> = {
    "EMAIL_RECEIVED": "Ingestion Agent",
    "EMAIL_INGESTED": "Ingestion Agent",
    "DOCUMENT_EXTRACTED": "Extraction Agent",
    "EXTRACTION_COMPLETED": "Extraction Agent",
    "ENTITY_RESOLVED": "Entity Resolution Agent",
    "SHIPMENT_CREATED": "Shipment Construction Agent",
    "SHIPMENT_CONSTRUCTED": "Shipment Construction Agent",
    "COMPLIANCE_SCREENED": "Compliance Agent",
    "COMPLIANCE_SCREENING_COMPLETED": "Compliance Agent",
    "RISK_SCORED": "Risk Intelligence Agent",
    "RISK_SCORING_COMPLETED": "Risk Intelligence Agent",
    "INSURANCE_QUOTED": "Insurance Agent",
    "INSURANCE_QUOTE_GENERATED": "Insurance Agent",
    "PRICING_COMPLETED": "Pricing Agent",
    "SHIPMENT_PRICED": "Pricing Agent",
    "DOCUMENT_GENERATED": "Document Generation Agent",
    "DOCGEN_COMPLETED": "Document Generation Agent",
    "INVOICE_GENERATED": "Billing Agent",
    "BILLING_COMPLETED": "Billing Agent",
    "SHIPMENT_APPROVED": "Operator",
    "SHIPMENT_REJECTED": "Operator",
    "FIELD_CORRECTED": "Operator",
    "RATE_TABLE_CREATED": "Operator",
    "EXCEPTION_DETECTED": "Exception Agent",
    "TRADE_LANE_UPDATED": "Trade Lane Agent",
  };
  return map[eventType] || humanizeLabel(eventType);
}

export function humanizeCoverageType(type: string): string {
  const map: Record<string, string> = {
    "ALL_RISK": "All Risk",
    "NAMED_PERILS": "Named Perils",
    "TOTAL_LOSS": "Total Loss Only",
  };
  return map[type] || humanizeLabel(type);
}

export function humanizeDocType(type: string): string {
  const map: Record<string, string> = {
    "BOL": "Bill of Lading",
    "HBL": "House Bill of Lading",
    "COMMERCIAL_INVOICE": "Commercial Invoice",
    "PACKING_LIST": "Packing List",
    "CERTIFICATE_OF_ORIGIN": "Certificate of Origin",
    "ARRIVAL_NOTICE": "Arrival Notice",
    "CUSTOMS_DECLARATION": "Customs Declaration",
    "RATE_CONFIRMATION": "Rate Confirmation",
    "SHIPMENT_SUMMARY": "Shipment Summary",
    "INVOICE": "Invoice",
    "UNKNOWN": "Shipping Document",
  };
  return map[type] || humanizeLabel(type);
}
