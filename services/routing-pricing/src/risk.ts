export interface RiskFactor {
  code: string;
  title: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  detail: string;
}

interface RiskContext {
  originCode: string;
  destinationCode: string;
  commodity: string | null;
  hsCode: string | null;
  cargoValue: number | null;
  complianceStatus: string | null;
  complianceRiskLevel: string | null;
  docValidationStatus: string | null;
  docReadiness: string | null;
  hasTransshipment: boolean;
  transitDays: number;
}

const HIGH_RISK_JURISDICTIONS = new Set([
  "IR", "SY", "KP", "CU", "VE", "RU", "BY", "MM",
]);

const CONGESTION_PORTS = new Set([
  "USLAX", "USNYC", "CNSHA", "NLRTM",
]);

const DUAL_USE_HS_PREFIXES = ["84", "85", "87", "88", "90"];

export function evaluateRisks(ctx: RiskContext): RiskFactor[] {
  const risks: RiskFactor[] = [];

  if (ctx.complianceStatus === "BLOCKED") {
    risks.push({
      code: "COMPLIANCE_BLOCKED",
      title: "Compliance Block",
      severity: "HIGH",
      detail: "Shipment has a compliance block — routing may be restricted or prohibited.",
    });
  } else if (ctx.complianceStatus === "ALERT") {
    risks.push({
      code: "COMPLIANCE_ALERT",
      title: "Compliance Alert",
      severity: "MEDIUM",
      detail: "Compliance screening flagged potential matches requiring review before routing.",
    });
  }

  if (ctx.complianceRiskLevel === "HIGH" || ctx.complianceRiskLevel === "CRITICAL") {
    risks.push({
      code: "HIGH_RISK_SCORE",
      title: "Elevated Risk Score",
      severity: "HIGH",
      detail: `Risk intelligence scored this shipment as ${ctx.complianceRiskLevel} — additional due diligence recommended.`,
    });
  }

  if (ctx.docValidationStatus === "BLOCKED") {
    risks.push({
      code: "DOC_BLOCKED",
      title: "Documentation Incomplete",
      severity: "HIGH",
      detail: `Document validation shows critical gaps (readiness: ${ctx.docReadiness || "UNKNOWN"}) — shipment cannot proceed without resolution.`,
    });
  } else if (ctx.docValidationStatus === "REVIEW") {
    risks.push({
      code: "DOC_REVIEW",
      title: "Documentation Needs Review",
      severity: ctx.docReadiness === "INSUFFICIENT" ? "HIGH" : "MEDIUM",
      detail: `Documentation is ${ctx.docReadiness === "INSUFFICIENT" ? "insufficient" : "partially complete"} — review and corrections needed before clearance.`,
    });
  }

  const originCountry = ctx.originCode.substring(0, 2);
  const destCountry = ctx.destinationCode.substring(0, 2);
  if (HIGH_RISK_JURISDICTIONS.has(originCountry) || HIGH_RISK_JURISDICTIONS.has(destCountry)) {
    risks.push({
      code: "JURISDICTION_RISK",
      title: "High-Risk Jurisdiction",
      severity: "HIGH",
      detail: `Trade involves a sanctioned or high-risk jurisdiction (${HIGH_RISK_JURISDICTIONS.has(originCountry) ? originCountry : destCountry}).`,
    });
  }

  if (CONGESTION_PORTS.has(ctx.originCode)) {
    risks.push({
      code: "ORIGIN_CONGESTION",
      title: "Port Congestion (Origin)",
      severity: "LOW",
      detail: `${ctx.originCode} is a high-volume port with periodic congestion — factor in potential delays.`,
    });
  }
  if (CONGESTION_PORTS.has(ctx.destinationCode)) {
    risks.push({
      code: "DEST_CONGESTION",
      title: "Port Congestion (Destination)",
      severity: "LOW",
      detail: `${ctx.destinationCode} is a high-volume port — plan for possible berthing delays.`,
    });
  }

  if (ctx.hsCode) {
    const prefix = ctx.hsCode.substring(0, 2);
    if (DUAL_USE_HS_PREFIXES.includes(prefix)) {
      risks.push({
        code: "DUAL_USE_COMMODITY",
        title: "Potential Dual-Use Commodity",
        severity: "MEDIUM",
        detail: `HS code ${ctx.hsCode} falls under a dual-use category — export license may be required.`,
      });
    }
  }

  if (ctx.cargoValue && ctx.cargoValue > 500000) {
    risks.push({
      code: "HIGH_VALUE_CARGO",
      title: "High-Value Shipment",
      severity: "MEDIUM",
      detail: `Cargo valued at $${(ctx.cargoValue / 1000).toFixed(0)}K — enhanced security and insurance recommended.`,
    });
  }

  if (ctx.hasTransshipment) {
    risks.push({
      code: "TRANSSHIPMENT_RISK",
      title: "Transshipment Handling Risk",
      severity: "LOW",
      detail: "Selected route involves transshipment — cargo handling at intermediate port increases delay/damage risk.",
    });
  }

  if (ctx.transitDays > 35) {
    risks.push({
      code: "LONG_TRANSIT",
      title: "Extended Transit Time",
      severity: "LOW",
      detail: `Estimated ${ctx.transitDays}-day transit — consider impact on inventory and financing costs.`,
    });
  }

  return risks;
}
