import { callAI } from "@workspace/integrations-anthropic-ai";
import type { MappingResult, FieldMapping } from "@workspace/db/schema";

const SCHEMA_TARGETS: Record<string, Record<string, string>> = {
  customers: {
    name: "Company or customer name",
    email: "Email address",
    phone: "Phone number",
    address: "Street address",
    city: "City",
    state: "State or province",
    country: "Country",
    postalCode: "Postal/ZIP code",
    accountNumber: "Account number or customer ID",
    contactName: "Primary contact person name",
    taxId: "Tax ID or VAT number",
    website: "Company website URL",
  },
  shipments: {
    reference: "Shipment reference or booking number",
    status: "Shipment status",
    portOfLoading: "Origin port or city",
    portOfDischarge: "Destination port or city",
    vessel: "Vessel or carrier name",
    voyage: "Voyage number",
    containerNumber: "Container number",
    bookingNumber: "Booking reference",
    blNumber: "Bill of lading number",
    commodity: "Commodity or goods description",
    hsCode: "HS code or tariff classification",
    incoterms: "Incoterms (FOB, CIF, etc.)",
    packageCount: "Number of packages",
    grossWeight: "Gross weight",
    weightUnit: "Weight unit (KG, LBS)",
    volume: "Volume/CBM",
    volumeUnit: "Volume unit",
    etd: "Estimated departure date",
    eta: "Estimated arrival date",
    customerName: "Shipper or customer name (for linking)",
  },
  invoices: {
    invoiceNumber: "Invoice number",
    customerName: "Customer or bill-to name (for linking)",
    shipmentReference: "Related shipment reference (for linking)",
    issueDate: "Invoice date",
    dueDate: "Payment due date",
    subtotal: "Subtotal amount",
    tax: "Tax amount",
    grandTotal: "Total/grand total amount",
    currency: "Currency code (USD, EUR, etc.)",
    paymentTerms: "Payment terms (NET_30, etc.)",
    status: "Invoice status",
    notes: "Notes or remarks",
  },
  line_items: {
    invoiceNumber: "Related invoice number (for linking)",
    description: "Line item description",
    lineType: "Charge type (FREIGHT, FEE, etc.)",
    quantity: "Quantity",
    unitPrice: "Unit price",
    amount: "Line total amount",
  },
  payments: {
    invoiceNumber: "Related invoice number (for linking)",
    paymentDate: "Payment date",
    amount: "Payment amount",
    currency: "Currency",
    method: "Payment method",
    reference: "Payment reference or transaction ID",
  },
};

export interface MapperInput {
  fileName: string;
  fileType: string;
  headers: string[];
  sampleRows: Record<string, any>[];
}

export async function mapFields(input: MapperInput): Promise<MappingResult> {
  const targetSchema = SCHEMA_TARGETS[input.fileType];
  if (!targetSchema) {
    return {
      fileName: input.fileName,
      fileType: input.fileType,
      fieldMappings: [],
      unmappedFields: input.headers,
      autoMappedPercent: 0,
    };
  }

  const prompt = `You are a schema mapping expert for a logistics/freight forwarding platform.

Map each source column from the uploaded file to the closest matching target field.

Source file type: ${input.fileType}
Source columns: ${JSON.stringify(input.headers)}
Sample data:
${JSON.stringify(input.sampleRows.slice(0, 3), null, 2)}

Target schema fields:
${Object.entries(targetSchema).map(([k, v]) => `  "${k}": ${v}`).join("\n")}

For each source column, determine:
1. Which target field it maps to (or null if no match)
2. Confidence score (0.0-1.0)
3. Any transformation needed (e.g., "parse_date", "split_origin_destination", "normalize_currency", "extract_number", null if none)

Consider:
- Fuzzy matching (e.g., "Client Name" → "name", "POL" → "portOfLoading")
- Combined fields (e.g., "Route" containing "NYC → LON" → split into portOfLoading + portOfDischarge)
- Date format variations
- Currency normalization

Respond ONLY with a JSON object (no markdown):
{
  "mappings": [
    {
      "sourceField": "exact source column name",
      "targetField": "target field name or null",
      "confidence": 0.0 to 1.0,
      "transformation": "transformation type or null"
    }
  ]
}`;

  let mappings: FieldMapping[] = [];

  try {
    const response = await callAI({
      taskType: "schema-mapping",
      systemPrompt: "You are a data schema mapping expert. Respond only with valid JSON.",
      userMessage: prompt,
      maxTokens: 2000,
      temperature: 0.1,
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      mappings = (parsed.mappings || []).map((m: any) => ({
        sourceField: m.sourceField,
        targetField: m.targetField || "",
        confidence: Math.min(Math.max(m.confidence || 0, 0), 1),
        transformation: m.transformation || null,
        userConfirmed: false,
      }));
    }
  } catch (err: any) {
    console.error("[mapper] AI mapping failed, using heuristic fallback:", err.message);
  }

  if (mappings.length === 0) {
    mappings = heuristicMap(input.headers, targetSchema);
  }

  const mapped = mappings.filter((m) => m.targetField && m.targetField !== "");
  const unmapped = input.headers.filter(
    (h) => !mappings.some((m) => m.sourceField === h && m.targetField),
  );
  const autoHighConf = mapped.filter((m) => m.confidence >= 0.9);
  const autoMappedPercent = input.headers.length > 0
    ? Math.round((autoHighConf.length / input.headers.length) * 100)
    : 0;

  return {
    fileName: input.fileName,
    fileType: input.fileType,
    fieldMappings: mappings,
    unmappedFields: unmapped,
    autoMappedPercent,
  };
}

function heuristicMap(headers: string[], targetSchema: Record<string, string>): FieldMapping[] {
  const targetKeys = Object.keys(targetSchema);

  return headers.map((header) => {
    const norm = header.toLowerCase().replace(/[^a-z0-9]/g, "");

    let bestMatch = "";
    let bestScore = 0;

    for (const target of targetKeys) {
      const targetNorm = target.toLowerCase().replace(/[^a-z0-9]/g, "");

      if (norm === targetNorm) {
        bestMatch = target;
        bestScore = 1;
        break;
      }

      if (norm.includes(targetNorm) || targetNorm.includes(norm)) {
        const score = 0.7;
        if (score > bestScore) {
          bestMatch = target;
          bestScore = score;
        }
      }

      const commonAliases: Record<string, string[]> = {
        name: ["company", "customer", "client", "companyname", "customername", "clientname", "billto"],
        email: ["emailaddress", "mail", "contactemail"],
        phone: ["telephone", "tel", "phonenumber", "mobile"],
        reference: ["ref", "shipmentref", "bookingref", "referencenumber", "shipmentnumber"],
        portOfLoading: ["pol", "origin", "originport", "loadingport", "from"],
        portOfDischarge: ["pod", "destination", "destport", "dischargeport", "to"],
        invoiceNumber: ["invno", "invoiceno", "invnumber", "invoiceid"],
        grandTotal: ["total", "totalamount", "invoiceamount", "amt"],
        dueDate: ["paymentdue", "due", "paymentdate"],
        issueDate: ["invoicedate", "date", "issueddate"],
        grossWeight: ["weight", "wt", "totalweight"],
        commodity: ["goods", "description", "product", "cargo", "goodsdescription"],
        containerNumber: ["container", "containerno", "cntr"],
        bookingNumber: ["booking", "bookingno"],
        blNumber: ["bl", "billoflading", "bolnumber"],
        customerName: ["customer", "shipper", "client", "billto"],
      };

      for (const [target2, aliases] of Object.entries(commonAliases)) {
        if (targetKeys.includes(target2) && aliases.includes(norm)) {
          if (0.85 > bestScore) {
            bestMatch = target2;
            bestScore = 0.85;
          }
        }
      }
    }

    return {
      sourceField: header,
      targetField: bestScore >= 0.5 ? bestMatch : "",
      confidence: bestScore,
      transformation: null,
      userConfirmed: false,
    };
  });
}
