import { z } from "zod/v4";
import { DocumentType } from "./enums";

export const ShipmentDocumentSchema = z.object({
  id: z.string().ulid(),
  companyId: z.string().ulid(),
  shipmentId: z.string().ulid(),
  documentId: z.string().ulid().optional(),
  documentType: DocumentType,
  s3Key: z.string().max(1000).optional(),
  isGenerated: z.boolean(),
  generatedAt: z.date().optional(),
  createdAt: z.date(),
});
export type ShipmentDocument = z.infer<typeof ShipmentDocumentSchema>;

export const CreateShipmentDocumentSchema = ShipmentDocumentSchema.omit({
  id: true,
  createdAt: true,
  generatedAt: true,
});
export type CreateShipmentDocument = z.infer<
  typeof CreateShipmentDocumentSchema
>;
