import { z } from "zod/v4";

export const ShipmentStatus = z.enum([
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
  "IN_TRANSIT",
  "DELIVERED",
  "CLOSED",
  "CANCELLED",
]);
export type ShipmentStatus = z.infer<typeof ShipmentStatus>;

export const DocumentType = z.enum([
  "BOL",
  "COMMERCIAL_INVOICE",
  "PACKING_LIST",
  "CERTIFICATE_OF_ORIGIN",
  "ARRIVAL_NOTICE",
  "CUSTOMS_DECLARATION",
  "RATE_CONFIRMATION",
  "HBL",
  "SHIPMENT_SUMMARY",
  "INVOICE",
  "UNKNOWN",
]);
export type DocumentType = z.infer<typeof DocumentType>;

export const ComplianceStatus = z.enum(["CLEAR", "ALERT", "BLOCKED"]);
export type ComplianceStatus = z.infer<typeof ComplianceStatus>;

export const EntityStatus = z.enum(["VERIFIED", "UNVERIFIED"]);
export type EntityStatus = z.infer<typeof EntityStatus>;

export const EntityType = z.enum([
  "SHIPPER",
  "CONSIGNEE",
  "CARRIER",
  "NOTIFY_PARTY",
  "FORWARDER",
  "AGENT",
  "VENDOR",
  "CUSTOMER",
]);
export type EntityType = z.infer<typeof EntityType>;

export const ExtractionStatus = z.enum([
  "PENDING",
  "PROCESSING",
  "EXTRACTED",
  "FAILED",
]);
export type ExtractionStatus = z.infer<typeof ExtractionStatus>;

export const EmailStatus = z.enum([
  "RECEIVED",
  "PROCESSING",
  "PROCESSED",
  "FAILED",
]);
export type EmailStatus = z.infer<typeof EmailStatus>;

export const InsuranceCoverageType = z.enum([
  "ALL_RISK",
  "NAMED_PERILS",
  "TOTAL_LOSS",
]);
export type InsuranceCoverageType = z.infer<typeof InsuranceCoverageType>;

export const RiskAction = z.enum([
  "AUTO_APPROVE",
  "OPERATOR_REVIEW",
  "ESCALATE",
]);
export type RiskAction = z.infer<typeof RiskAction>;

export const EventType = z.enum([
  "SHIPMENT_CREATED",
  "SHIPMENT_UPDATED",
  "SHIPMENT_APPROVED",
  "SHIPMENT_REJECTED",
  "EXTRACTION_COMPLETED",
  "EXTRACTION_FAILED",
  "ENTITY_RESOLVED",
  "ENTITY_CREATED",
  "COMPLIANCE_SCREENED",
  "COMPLIANCE_ALERT",
  "RISK_SCORED",
  "INSURANCE_QUOTED",
  "DOCUMENT_CONFLICT",
  "OPERATOR_CORRECTION",
  "AGENT_VALIDATION_FAILURE",
]);
export type EventType = z.infer<typeof EventType>;
