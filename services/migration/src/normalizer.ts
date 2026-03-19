import type { MappingResult, ValidationSummary } from "@workspace/db/schema";

export interface NormalizedEntity {
  type: "customer" | "shipment" | "invoice" | "line_item";
  data: Record<string, any>;
  sourceFile: string;
  sourceRowIndex: number;
  warnings: string[];
}

export interface NormalizationOutput {
  entities: NormalizedEntity[];
  validation: ValidationSummary;
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value || value.trim() === "") return null;

  const dateFormats = [
    /^(\d{4})-(\d{2})-(\d{2})/, // ISO
    /^(\d{2})\/(\d{2})\/(\d{4})/, // MM/DD/YYYY
    /^(\d{2})-(\d{2})-(\d{4})/, // MM-DD-YYYY
    /^(\d{2})\.(\d{2})\.(\d{4})/, // DD.MM.YYYY
  ];

  for (const fmt of dateFormats) {
    const match = value.match(fmt);
    if (match) {
      try {
        const d = new Date(value);
        if (!isNaN(d.getTime())) {
          return d.toISOString();
        }
      } catch {}
    }
  }

  try {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  } catch {}

  return null;
}

function normalizeNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return value;

  const cleaned = value.replace(/[,$\s€£¥]/g, "").replace(/,/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function normalizeCurrency(value: string | null | undefined): string {
  if (!value) return "USD";
  const upper = value.toUpperCase().trim();
  const currencyMap: Record<string, string> = {
    "$": "USD", "US$": "USD", "USD": "USD", "DOLLAR": "USD", "DOLLARS": "USD",
    "€": "EUR", "EUR": "EUR", "EURO": "EUR",
    "£": "GBP", "GBP": "GBP",
    "¥": "JPY", "JPY": "JPY", "CNY": "CNY", "RMB": "CNY",
    "SGD": "SGD", "HKD": "HKD", "AED": "AED",
  };
  return currencyMap[upper] || upper;
}

function fuzzyMatch(a: string, b: string): number {
  const na = a.toLowerCase().replace(/[^a-z0-9]/g, "");
  const nb = b.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.8;

  let matches = 0;
  const shorter = na.length < nb.length ? na : nb;
  const longer = na.length >= nb.length ? na : nb;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++;
  }
  return matches / Math.max(na.length, nb.length);
}

function applyFieldMapping(
  row: Record<string, any>,
  mappings: MappingResult["fieldMappings"],
): Record<string, any> {
  const result: Record<string, any> = {};
  for (const mapping of mappings) {
    if (!mapping.targetField) continue;
    const value = row[mapping.sourceField];
    if (value == null || value === "") continue;
    result[mapping.targetField] = value;
  }
  return result;
}

export function normalizeData(
  parsedFiles: { fileName: string; rows: Record<string, any>[] }[],
  mappingResults: MappingResult[],
): NormalizationOutput {
  const entities: NormalizedEntity[] = [];
  const customerNames = new Map<string, number>();

  for (const mapping of mappingResults) {
    const file = parsedFiles.find((f) => f.fileName === mapping.fileName);
    if (!file) continue;

    for (let i = 0; i < file.rows.length; i++) {
      const row = file.rows[i];
      const mapped = applyFieldMapping(row, mapping.fieldMappings);
      const warnings: string[] = [];

      if (mapping.fileType === "customers") {
        if (!mapped.name) {
          warnings.push("Missing required field: name");
        } else {
          const normName = mapped.name.toLowerCase().trim();
          const existingCount = customerNames.get(normName) || 0;
          if (existingCount > 0) {
            warnings.push(`Potential duplicate: "${mapped.name}" appears ${existingCount + 1} times`);
          }
          customerNames.set(normName, existingCount + 1);
        }

        entities.push({
          type: "customer",
          data: {
            name: mapped.name || "",
            email: mapped.email || null,
            phone: mapped.phone || null,
            address: [mapped.address, mapped.city, mapped.state, mapped.country, mapped.postalCode]
              .filter(Boolean).join(", ") || null,
            contactName: mapped.contactName || null,
            taxId: mapped.taxId || null,
            accountNumber: mapped.accountNumber || null,
          },
          sourceFile: mapping.fileName,
          sourceRowIndex: i,
          warnings,
        });
      }

      if (mapping.fileType === "shipments") {
        if (!mapped.reference && !mapped.bookingNumber) {
          warnings.push("Missing reference or booking number");
        }

        entities.push({
          type: "shipment",
          data: {
            reference: mapped.reference || mapped.bookingNumber || `IMPORT-${i + 1}`,
            status: mapped.status || "DRAFT",
            portOfLoading: mapped.portOfLoading || null,
            portOfDischarge: mapped.portOfDischarge || null,
            vessel: mapped.vessel || null,
            voyage: mapped.voyage || null,
            containerNumber: mapped.containerNumber || null,
            bookingNumber: mapped.bookingNumber || null,
            blNumber: mapped.blNumber || null,
            commodity: mapped.commodity || null,
            hsCode: mapped.hsCode || null,
            incoterms: mapped.incoterms || null,
            packageCount: normalizeNumber(mapped.packageCount),
            grossWeight: normalizeNumber(mapped.grossWeight),
            weightUnit: mapped.weightUnit || "KG",
            volume: normalizeNumber(mapped.volume),
            volumeUnit: mapped.volumeUnit || "CBM",
            etd: normalizeDate(mapped.etd),
            eta: normalizeDate(mapped.eta),
            _customerName: mapped.customerName || null,
          },
          sourceFile: mapping.fileName,
          sourceRowIndex: i,
          warnings,
        });
      }

      if (mapping.fileType === "invoices") {
        if (!mapped.invoiceNumber) {
          warnings.push("Missing required field: invoiceNumber");
        }

        const grandTotal = normalizeNumber(mapped.grandTotal);
        const subtotal = normalizeNumber(mapped.subtotal) || grandTotal;
        const tax = normalizeNumber(mapped.tax) || 0;

        entities.push({
          type: "invoice",
          data: {
            invoiceNumber: mapped.invoiceNumber || `INV-IMPORT-${i + 1}`,
            issueDate: normalizeDate(mapped.issueDate),
            dueDate: normalizeDate(mapped.dueDate),
            subtotal: subtotal || 0,
            tax: tax,
            grandTotal: grandTotal || (subtotal || 0) + tax,
            currency: normalizeCurrency(mapped.currency),
            paymentTerms: mapped.paymentTerms || "NET_30",
            status: mapped.status || "DRAFT",
            notes: mapped.notes || null,
            _customerName: mapped.customerName || null,
            _shipmentReference: mapped.shipmentReference || null,
          },
          sourceFile: mapping.fileName,
          sourceRowIndex: i,
          warnings,
        });
      }

      if (mapping.fileType === "line_items") {
        entities.push({
          type: "line_item",
          data: {
            description: mapped.description || "",
            lineType: mapped.lineType || "FEE",
            quantity: normalizeNumber(mapped.quantity) || 1,
            unitPrice: normalizeNumber(mapped.unitPrice) || 0,
            amount: normalizeNumber(mapped.amount) || 0,
            _invoiceNumber: mapped.invoiceNumber || null,
          },
          sourceFile: mapping.fileName,
          sourceRowIndex: i,
          warnings,
        });
      }
    }
  }

  const customers = entities.filter((e) => e.type === "customer");
  const shipments = entities.filter((e) => e.type === "shipment");
  const invoices = entities.filter((e) => e.type === "invoice");
  const lineItems = entities.filter((e) => e.type === "line_item");

  const uniqueCustomerNames = new Set(
    customers.map((c) => (c.data.name as string).toLowerCase().trim()).filter(Boolean),
  );
  const dupCustomers = [...customerNames.entries()].filter(([, count]) => count > 1);

  const missingRequired: ValidationSummary["missingRequiredFields"] = [];
  const custNoName = customers.filter((c) => !c.data.name).length;
  if (custNoName > 0) missingRequired.push({ entity: "customers", field: "name", count: custNoName });
  const shipNoRef = shipments.filter((s) => !s.data.reference || s.data.reference.startsWith("IMPORT-")).length;
  if (shipNoRef > 0) missingRequired.push({ entity: "shipments", field: "reference", count: shipNoRef });
  const invNoNum = invoices.filter((inv) => !inv.data.invoiceNumber || inv.data.invoiceNumber.startsWith("INV-IMPORT-")).length;
  if (invNoNum > 0) missingRequired.push({ entity: "invoices", field: "invoiceNumber", count: invNoNum });

  const totalInvoiceValue = invoices.reduce((sum, inv) => sum + (inv.data.grandTotal || 0), 0);

  const invoiceCustomerLinked = invoices.filter((inv) => inv.data._customerName).length;
  const shipmentCustomerLinked = shipments.filter((s) => s.data._customerName).length;
  const invoiceShipmentLinked = invoices.filter((inv) => inv.data._shipmentReference).length;

  const validation: ValidationSummary = {
    totalCustomers: uniqueCustomerNames.size,
    totalShipments: shipments.length,
    totalInvoices: invoices.length,
    totalInvoiceValue: Math.round(totalInvoiceValue * 100) / 100,
    totalLineItems: lineItems.length,
    missingRequiredFields: missingRequired,
    duplicateWarnings: dupCustomers.map(([name, count]) => ({
      entity: "customers",
      field: "name",
      count,
    })),
    relationshipLinks: [
      { from: "invoices", to: "customers", linked: invoiceCustomerLinked, unlinked: invoices.length - invoiceCustomerLinked },
      { from: "shipments", to: "customers", linked: shipmentCustomerLinked, unlinked: shipments.length - shipmentCustomerLinked },
      { from: "invoices", to: "shipments", linked: invoiceShipmentLinked, unlinked: invoices.length - invoiceShipmentLinked },
    ],
  };

  return { entities, validation };
}

export function deduplicateCustomers(entities: NormalizedEntity[]): NormalizedEntity[] {
  const seen = new Map<string, NormalizedEntity>();
  const result: NormalizedEntity[] = [];

  for (const entity of entities) {
    if (entity.type !== "customer") {
      result.push(entity);
      continue;
    }

    const name = (entity.data.name as string).toLowerCase().trim();
    const existing = seen.get(name);

    if (existing) {
      for (const [key, value] of Object.entries(entity.data)) {
        if (value && !existing.data[key]) {
          existing.data[key] = value;
        }
      }
      continue;
    }

    let merged = false;
    for (const [existingName, existingEntity] of seen) {
      if (fuzzyMatch(name, existingName) >= 0.85) {
        for (const [key, value] of Object.entries(entity.data)) {
          if (value && !existingEntity.data[key]) {
            existingEntity.data[key] = value;
          }
        }
        merged = true;
        break;
      }
    }

    if (!merged) {
      seen.set(name, entity);
      result.push(entity);
    }
  }

  return result;
}
