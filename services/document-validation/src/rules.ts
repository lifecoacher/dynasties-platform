export interface RequiredDocRule {
  code: string;
  label: string;
  severity: "WARNING" | "CRITICAL";
}

const CORE_DOCS: RequiredDocRule[] = [
  { code: "COMMERCIAL_INVOICE", label: "Commercial Invoice", severity: "CRITICAL" },
  { code: "PACKING_LIST", label: "Packing List", severity: "CRITICAL" },
  { code: "BOL", label: "Bill of Lading", severity: "CRITICAL" },
];

const CUSTOMS_DOCS: RequiredDocRule[] = [
  { code: "CERTIFICATE_OF_ORIGIN", label: "Certificate of Origin", severity: "WARNING" },
  { code: "CUSTOMS_DECLARATION", label: "Customs Declaration", severity: "WARNING" },
];

const EXTENDED_DOCS: RequiredDocRule[] = [
  { code: "ARRIVAL_NOTICE", label: "Arrival Notice", severity: "WARNING" },
  { code: "HBL", label: "House Bill of Lading", severity: "WARNING" },
];

export function getRequiredDocuments(
  shipmentStatus: string,
  shipmentType?: string | null,
): RequiredDocRule[] {
  const rules = [...CORE_DOCS];

  const advancedStatuses = [
    "APPROVED", "IN_TRANSIT", "ARRIVED", "CUSTOMS_CLEARANCE", "DELIVERED",
  ];
  if (advancedStatuses.includes(shipmentStatus)) {
    rules.push(...CUSTOMS_DOCS);
  }

  const lateStatuses = ["ARRIVED", "CUSTOMS_CLEARANCE", "DELIVERED"];
  if (lateStatuses.includes(shipmentStatus)) {
    rules.push(...EXTENDED_DOCS);
  }

  return rules;
}

export interface RequiredFieldRule {
  field: string;
  severity: "WARNING" | "CRITICAL";
  label: string;
}

const FIELD_RULES_BY_DOC: Record<string, RequiredFieldRule[]> = {
  BOL: [
    { field: "shipper", severity: "CRITICAL", label: "Shipper" },
    { field: "consignee", severity: "CRITICAL", label: "Consignee" },
    { field: "portOfLoading", severity: "CRITICAL", label: "Port of Loading" },
    { field: "portOfDischarge", severity: "CRITICAL", label: "Port of Discharge" },
    { field: "vessel", severity: "WARNING", label: "Vessel Name" },
    { field: "blNumber", severity: "WARNING", label: "B/L Number" },
    { field: "commodity", severity: "WARNING", label: "Commodity" },
  ],
  COMMERCIAL_INVOICE: [
    { field: "shipper", severity: "CRITICAL", label: "Shipper/Seller" },
    { field: "consignee", severity: "CRITICAL", label: "Consignee/Buyer" },
    { field: "cargoValue", severity: "CRITICAL", label: "Invoice Amount" },
    { field: "commodity", severity: "WARNING", label: "Commodity Description" },
    { field: "hsCode", severity: "WARNING", label: "HS Code" },
  ],
  PACKING_LIST: [
    { field: "shipper", severity: "WARNING", label: "Shipper" },
    { field: "packageCount", severity: "CRITICAL", label: "Package Count" },
    { field: "weight", severity: "WARNING", label: "Gross Weight" },
    { field: "commodity", severity: "WARNING", label: "Commodity" },
  ],
  HBL: [
    { field: "shipper", severity: "CRITICAL", label: "Shipper" },
    { field: "consignee", severity: "CRITICAL", label: "Consignee" },
    { field: "portOfLoading", severity: "WARNING", label: "Port of Loading" },
    { field: "portOfDischarge", severity: "WARNING", label: "Port of Discharge" },
  ],
  ARRIVAL_NOTICE: [
    { field: "consignee", severity: "WARNING", label: "Consignee" },
    { field: "vessel", severity: "WARNING", label: "Vessel" },
    { field: "portOfDischarge", severity: "WARNING", label: "Port of Discharge" },
  ],
  CERTIFICATE_OF_ORIGIN: [
    { field: "shipper", severity: "WARNING", label: "Exporter" },
    { field: "commodity", severity: "WARNING", label: "Commodity" },
  ],
};

export function getRequiredFields(documentType: string): RequiredFieldRule[] {
  return FIELD_RULES_BY_DOC[documentType] || [];
}

export interface ConsistencyField {
  code: string;
  field: string;
  label: string;
  severity: "WARNING" | "CRITICAL";
}

export const CONSISTENCY_CHECKS: ConsistencyField[] = [
  { code: "SHIPPER_MISMATCH", field: "shipper", label: "Shipper Name", severity: "CRITICAL" },
  { code: "CONSIGNEE_MISMATCH", field: "consignee", label: "Consignee Name", severity: "CRITICAL" },
  { code: "COMMODITY_MISMATCH", field: "commodity", label: "Commodity Description", severity: "WARNING" },
  { code: "PORT_LOADING_MISMATCH", field: "portOfLoading", label: "Port of Loading", severity: "WARNING" },
  { code: "PORT_DISCHARGE_MISMATCH", field: "portOfDischarge", label: "Port of Discharge", severity: "WARNING" },
  { code: "CARGO_VALUE_MISMATCH", field: "cargoValue", label: "Invoice/Cargo Value", severity: "CRITICAL" },
  { code: "WEIGHT_MISMATCH", field: "weight", label: "Gross Weight", severity: "WARNING" },
  { code: "PACKAGE_COUNT_MISMATCH", field: "packageCount", label: "Package Count", severity: "WARNING" },
];
