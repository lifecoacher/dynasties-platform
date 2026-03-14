import { z } from "zod/v4";
import { DocumentType, ExtractionStatus } from "./enums";

export const ExtractedFieldSchema = z.object({
  value: z.unknown(),
  confidence: z.number().min(0).max(1),
  source: z.string().optional(),
  needsReview: z.boolean().optional(),
});
export type ExtractedField = z.infer<typeof ExtractedFieldSchema>;

export const IngestedDocumentSchema = z.object({
  id: z.string().ulid(),
  companyId: z.string().ulid(),
  emailId: z.string().ulid().optional(),
  fileName: z.string().max(500),
  mimeType: z.string().max(100),
  documentType: DocumentType,
  documentTypeConfidence: z.number().min(0).max(1).optional(),
  s3Key: z.string().max(1000),
  extractedData: z.record(z.string(), ExtractedFieldSchema).optional(),
  extractionStatus: ExtractionStatus,
  extractionError: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type IngestedDocument = z.infer<typeof IngestedDocumentSchema>;

export const CreateIngestedDocumentSchema = IngestedDocumentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  extractedData: true,
  extractionError: true,
});
export type CreateIngestedDocument = z.infer<
  typeof CreateIngestedDocumentSchema
>;

export const ExtractionOutputSchema = z.object({
  shipper: ExtractedFieldSchema.optional(),
  consignee: ExtractedFieldSchema.optional(),
  notifyParty: ExtractedFieldSchema.optional(),
  vessel: ExtractedFieldSchema.optional(),
  voyage: ExtractedFieldSchema.optional(),
  portOfLoading: ExtractedFieldSchema.optional(),
  portOfDischarge: ExtractedFieldSchema.optional(),
  commodity: ExtractedFieldSchema.optional(),
  hsCode: ExtractedFieldSchema.optional(),
  packageCount: ExtractedFieldSchema.optional(),
  weight: ExtractedFieldSchema.optional(),
  volume: ExtractedFieldSchema.optional(),
  freightTerms: ExtractedFieldSchema.optional(),
  releaseType: ExtractedFieldSchema.optional(),
  shipmentDate: ExtractedFieldSchema.optional(),
  containerNumbers: ExtractedFieldSchema.optional(),
  bookingNumber: ExtractedFieldSchema.optional(),
  blNumber: ExtractedFieldSchema.optional(),
});
export type ExtractionOutput = z.infer<typeof ExtractionOutputSchema>;
