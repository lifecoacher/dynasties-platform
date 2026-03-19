import type { GeneratedDocType } from "@workspace/db/schema";

export interface ValidationField {
  field: string;
  label: string;
  present: boolean;
  value?: any;
}

export interface ValidationResult {
  ready: boolean;
  documentType: GeneratedDocType;
  requiredFields: ValidationField[];
  missingFields: string[];
  suggestions: string[];
}

export interface DocContext {
  shipment: Record<string, any>;
  shipper: Record<string, any> | null;
  consignee: Record<string, any> | null;
  notifyParty: Record<string, any> | null;
  carrier: Record<string, any> | null;
  invoice: Record<string, any> | null;
  lineItems: Array<Record<string, any>>;
}

function checkField(ctx: DocContext, path: string, label: string): ValidationField {
  const parts = path.split(".");
  let val: any = ctx;
  for (const p of parts) {
    val = val?.[p];
  }
  const present = val !== null && val !== undefined && val !== "";
  return { field: path, label, present, value: present ? val : undefined };
}

const VALIDATION_RULES: Record<GeneratedDocType, (ctx: DocContext) => ValidationResult> = {
  COMMERCIAL_INVOICE: (ctx) => {
    const fields = [
      checkField(ctx, "shipper.name", "Seller / Shipper Name"),
      checkField(ctx, "shipper.address", "Seller Address"),
      checkField(ctx, "consignee.name", "Buyer / Consignee Name"),
      checkField(ctx, "consignee.address", "Buyer Address"),
      checkField(ctx, "shipment.commodity", "Product Description"),
      checkField(ctx, "shipment.packageCount", "Quantity"),
      checkField(ctx, "shipment.cargoValue", "Declared Value"),
      checkField(ctx, "invoice.currency", "Currency"),
      checkField(ctx, "invoice.invoiceNumber", "Invoice Number"),
    ];
    const missing = fields.filter((f) => !f.present).map((f) => f.label);
    const suggestions: string[] = [];
    if (missing.includes("Declared Value")) suggestions.push("Set cargo value on the shipment");
    if (missing.includes("Seller / Shipper Name")) suggestions.push("Assign a shipper entity to this shipment");
    if (missing.includes("Invoice Number")) suggestions.push("Create an invoice for this shipment first");
    return {
      ready: missing.length === 0,
      documentType: "COMMERCIAL_INVOICE",
      requiredFields: fields,
      missingFields: missing,
      suggestions,
    };
  },

  PACKING_LIST: (ctx) => {
    const fields = [
      checkField(ctx, "shipper.name", "Shipper Name"),
      checkField(ctx, "consignee.name", "Consignee Name"),
      checkField(ctx, "shipment.packageCount", "Package Count"),
      checkField(ctx, "shipment.grossWeight", "Gross Weight"),
      checkField(ctx, "shipment.commodity", "Item Description"),
      checkField(ctx, "shipment.reference", "Shipment Reference"),
    ];
    const missing = fields.filter((f) => !f.present).map((f) => f.label);
    const suggestions: string[] = [];
    if (missing.includes("Package Count")) suggestions.push("Add package count to shipment details");
    if (missing.includes("Gross Weight")) suggestions.push("Add gross weight to shipment details");
    return {
      ready: missing.length === 0,
      documentType: "PACKING_LIST",
      requiredFields: fields,
      missingFields: missing,
      suggestions,
    };
  },

  BILL_OF_LADING: (ctx) => {
    const fields = [
      checkField(ctx, "shipper.name", "Shipper Name"),
      checkField(ctx, "consignee.name", "Consignee Name"),
      checkField(ctx, "shipment.portOfLoading", "Port of Loading"),
      checkField(ctx, "shipment.portOfDischarge", "Port of Discharge"),
      checkField(ctx, "shipment.commodity", "Cargo Description"),
      checkField(ctx, "shipment.packageCount", "Number of Packages"),
      checkField(ctx, "shipment.grossWeight", "Gross Weight"),
    ];
    const missing = fields.filter((f) => !f.present).map((f) => f.label);
    const suggestions: string[] = [];
    if (missing.includes("Port of Loading")) suggestions.push("Set origin port on shipment");
    if (missing.includes("Port of Discharge")) suggestions.push("Set destination port on shipment");
    if (!ctx.shipment?.blNumber) suggestions.push("Assign a B/L number (will use draft number otherwise)");
    return {
      ready: missing.length === 0,
      documentType: "BILL_OF_LADING",
      requiredFields: fields,
      missingFields: missing,
      suggestions,
    };
  },

  CUSTOMS_DECLARATION: (ctx) => {
    const fields = [
      checkField(ctx, "shipper.name", "Exporter Name"),
      checkField(ctx, "consignee.name", "Importer Name"),
      checkField(ctx, "shipment.commodity", "Goods Description"),
      checkField(ctx, "shipment.hsCode", "HS Code"),
      checkField(ctx, "shipment.portOfLoading", "Port of Export"),
      checkField(ctx, "shipment.portOfDischarge", "Port of Import"),
      checkField(ctx, "shipment.cargoValue", "Declared Value"),
      checkField(ctx, "shipment.packageCount", "Number of Packages"),
    ];
    const missing = fields.filter((f) => !f.present).map((f) => f.label);
    const suggestions: string[] = [];
    if (missing.includes("HS Code")) suggestions.push("Add the HS tariff code for the commodity");
    if (missing.includes("Declared Value")) suggestions.push("Set the cargo value for customs declaration");
    return {
      ready: missing.length === 0,
      documentType: "CUSTOMS_DECLARATION",
      requiredFields: fields,
      missingFields: missing,
      suggestions,
    };
  },

  SHIPMENT_SUMMARY: (ctx) => {
    const fields = [
      checkField(ctx, "shipment.reference", "Shipment Reference"),
      checkField(ctx, "shipment.status", "Shipment Status"),
      checkField(ctx, "shipment.commodity", "Commodity"),
    ];
    const missing = fields.filter((f) => !f.present).map((f) => f.label);
    return {
      ready: missing.length === 0,
      documentType: "SHIPMENT_SUMMARY",
      requiredFields: fields,
      missingFields: missing,
      suggestions: [],
    };
  },
};

export function validateDocumentReadiness(
  docType: GeneratedDocType,
  ctx: DocContext,
): ValidationResult {
  const validator = VALIDATION_RULES[docType];
  if (!validator) {
    return {
      ready: false,
      documentType: docType,
      requiredFields: [],
      missingFields: ["Unknown document type"],
      suggestions: [],
    };
  }
  return validator(ctx);
}

export function validateAllDocuments(ctx: DocContext): ValidationResult[] {
  return (["COMMERCIAL_INVOICE", "PACKING_LIST", "BILL_OF_LADING", "CUSTOMS_DECLARATION", "SHIPMENT_SUMMARY"] as GeneratedDocType[]).map(
    (docType) => validateDocumentReadiness(docType, ctx),
  );
}
