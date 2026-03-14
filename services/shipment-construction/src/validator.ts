import { z } from "zod/v4";
import type { ShipmentDraft } from "./builder.js";

const ShipmentDraftSchema = z.object({
  companyId: z.string().min(1),
  reference: z.string().min(1).max(100),
  status: z.literal("DRAFT"),
  shipperId: z.string().nullable(),
  consigneeId: z.string().nullable(),
  notifyPartyId: z.string().nullable(),
  carrierId: z.string().nullable(),
  portOfLoading: z.string().max(255).nullable(),
  portOfDischarge: z.string().max(255).nullable(),
  vessel: z.string().max(255).nullable(),
  voyage: z.string().max(100).nullable(),
  commodity: z.string().max(500).nullable(),
  hsCode: z.string().max(20).nullable(),
  packageCount: z.number().int().positive().nullable(),
  grossWeight: z.number().positive().nullable(),
  weightUnit: z.enum(["KG", "LB"]).nullable(),
  volume: z.number().positive().nullable(),
  volumeUnit: z.enum(["CBM", "CFT"]).nullable(),
  incoterms: z.string().max(10).nullable(),
  bookingNumber: z.string().max(100).nullable(),
  blNumber: z.string().max(100).nullable(),
  conflicts: z.array(z.object({
    field: z.string(),
    values: z.array(z.object({
      documentIndex: z.number(),
      value: z.unknown(),
      confidence: z.number(),
    })),
  })),
  documentIds: z.array(z.string().min(1)).min(1),
});

export interface ShipmentValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateShipmentDraft(draft: ShipmentDraft): ShipmentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const result = ShipmentDraftSchema.safeParse(draft);
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push(`${issue.path.join(".")}: ${issue.message}`);
    }
    return { valid: false, errors, warnings };
  }

  if (!draft.shipperId && !draft.consigneeId) {
    warnings.push("No shipper or consignee resolved — shipment draft may need manual party assignment");
  }

  if (!draft.portOfLoading && !draft.portOfDischarge) {
    warnings.push("No ports extracted — routing information will need manual entry");
  }

  if (draft.conflicts.length > 0) {
    for (const conflict of draft.conflicts) {
      warnings.push(`Conflict on field "${conflict.field}" — ${conflict.values.length} different values found across documents`);
    }
  }

  return { valid: true, errors: [], warnings };
}
