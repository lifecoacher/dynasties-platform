import { z } from "zod/v4";
import { ShipmentStatus } from "./enums";

export const ShipmentSchema = z.object({
  id: z.string().ulid(),
  companyId: z.string().ulid(),
  reference: z.string().max(100),
  status: ShipmentStatus,
  shipperId: z.string().ulid().optional(),
  consigneeId: z.string().ulid().optional(),
  notifyPartyId: z.string().ulid().optional(),
  carrierId: z.string().ulid().optional(),
  portOfLoading: z.string().max(255).optional(),
  portOfDischarge: z.string().max(255).optional(),
  placeOfReceipt: z.string().max(255).optional(),
  placeOfDelivery: z.string().max(255).optional(),
  vessel: z.string().max(255).optional(),
  voyage: z.string().max(100).optional(),
  commodity: z.string().max(500).optional(),
  hsCode: z.string().max(20).optional(),
  packageCount: z.number().int().optional(),
  grossWeight: z.number().optional(),
  weightUnit: z.enum(["KG", "LB"]).optional(),
  volume: z.number().optional(),
  volumeUnit: z.enum(["CBM", "CFT"]).optional(),
  freightTerms: z.enum(["PREPAID", "COLLECT", "THIRD_PARTY"]).optional(),
  incoterms: z.string().max(10).optional(),
  etd: z.date().optional(),
  eta: z.date().optional(),
  bookingNumber: z.string().max(100).optional(),
  blNumber: z.string().max(100).optional(),
  operatorNotes: z.string().optional(),
  approvedAt: z.date().optional(),
  approvedBy: z.string().ulid().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Shipment = z.infer<typeof ShipmentSchema>;

export const CreateShipmentSchema = ShipmentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  approvedAt: true,
  approvedBy: true,
});
export type CreateShipment = z.infer<typeof CreateShipmentSchema>;
