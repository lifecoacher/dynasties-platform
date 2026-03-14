import { EventEmitter } from "node:events";

export interface ExtractionJob {
  documentId: string;
  companyId: string;
  s3Key: string;
  fileName: string;
  mimeType: string;
  documentType: string;
}

export interface ShipmentPipelineJob {
  companyId: string;
  documentIds: string[];
  emailId: string | null;
  trigger: "extraction_complete";
}

export interface ComplianceJob {
  companyId: string;
  shipmentId: string;
  trigger: "shipment_created";
}

export interface RiskJob {
  companyId: string;
  shipmentId: string;
  trigger: "shipment_created";
}

export interface InsuranceJob {
  companyId: string;
  shipmentId: string;
  trigger: "shipment_created";
}

export interface PricingJob {
  companyId: string;
  shipmentId: string;
  trigger: "shipment_approved";
}

export interface DocGenJob {
  companyId: string;
  shipmentId: string;
  trigger: "charges_calculated";
}

export interface BillingJob {
  companyId: string;
  shipmentId: string;
  trigger: "documents_generated";
}

export interface ExceptionJob {
  companyId: string;
  shipmentId: string;
  trigger: "invoice_created" | "shipment_created" | "manual";
}

export interface TradeLaneJob {
  companyId: string;
  shipmentId: string;
  trigger: "invoice_created" | "manual";
}

export interface ClaimsJob {
  companyId: string;
  shipmentId: string;
  claimType: string;
  incidentDescription: string;
  trigger: "manual";
}

type ExtractionHandler = (job: ExtractionJob) => Promise<void>;
type PipelineHandler = (job: ShipmentPipelineJob) => Promise<void>;
type ComplianceHandler = (job: ComplianceJob) => Promise<void>;
type RiskHandler = (job: RiskJob) => Promise<void>;
type InsuranceHandler = (job: InsuranceJob) => Promise<void>;
type PricingHandler = (job: PricingJob) => Promise<void>;
type DocGenHandler = (job: DocGenJob) => Promise<void>;
type BillingHandler = (job: BillingJob) => Promise<void>;
type ExceptionHandler = (job: ExceptionJob) => Promise<void>;
type TradeLaneHandler = (job: TradeLaneJob) => Promise<void>;
type ClaimsHandler = (job: ClaimsJob) => Promise<void>;

const emitter = new EventEmitter();
const EXTRACTION_QUEUE = "extraction-jobs";
const PIPELINE_QUEUE = "shipment-pipeline-jobs";
const COMPLIANCE_QUEUE = "compliance-jobs";
const RISK_QUEUE = "risk-jobs";
const INSURANCE_QUEUE = "insurance-jobs";
const PRICING_QUEUE = "pricing-jobs";
const DOCGEN_QUEUE = "docgen-jobs";
const BILLING_QUEUE = "billing-jobs";
const EXCEPTION_QUEUE = "exception-jobs";
const TRADE_LANE_QUEUE = "trade-lane-jobs";
const CLAIMS_QUEUE = "claims-jobs";

let extractionWrapper: ((job: ExtractionJob) => void) | null = null;
let pipelineWrapper: ((job: ShipmentPipelineJob) => void) | null = null;
let complianceWrapper: ((job: ComplianceJob) => void) | null = null;
let riskWrapper: ((job: RiskJob) => void) | null = null;
let insuranceWrapper: ((job: InsuranceJob) => void) | null = null;
let pricingWrapper: ((job: PricingJob) => void) | null = null;
let docgenWrapper: ((job: DocGenJob) => void) | null = null;
let billingWrapper: ((job: BillingJob) => void) | null = null;
let exceptionWrapper: ((job: ExceptionJob) => void) | null = null;
let tradeLaneWrapper: ((job: TradeLaneJob) => void) | null = null;
let claimsWrapper: ((job: ClaimsJob) => void) | null = null;

export function registerExtractionConsumer(fn: ExtractionHandler): void {
  if (extractionWrapper) {
    emitter.removeListener(EXTRACTION_QUEUE, extractionWrapper);
  }
  const wrapper = (job: ExtractionJob) => {
    fn(job).catch((err) => {
      console.error(`[queue] extraction job failed for doc=${job.documentId}:`, err);
    });
  };
  extractionWrapper = wrapper;
  emitter.on(EXTRACTION_QUEUE, wrapper);
}

export function registerPipelineConsumer(fn: PipelineHandler): void {
  if (pipelineWrapper) {
    emitter.removeListener(PIPELINE_QUEUE, pipelineWrapper);
  }
  const wrapper = (job: ShipmentPipelineJob) => {
    fn(job).catch((err) => {
      console.error(`[queue] pipeline job failed for docs=${job.documentIds.join(",")}:`, err);
    });
  };
  pipelineWrapper = wrapper;
  emitter.on(PIPELINE_QUEUE, wrapper);
}

export function registerComplianceConsumer(fn: ComplianceHandler): void {
  if (complianceWrapper) {
    emitter.removeListener(COMPLIANCE_QUEUE, complianceWrapper);
  }
  const wrapper = (job: ComplianceJob) => {
    fn(job).catch((err) => {
      console.error(`[queue] compliance job failed for shipment=${job.shipmentId}:`, err);
    });
  };
  complianceWrapper = wrapper;
  emitter.on(COMPLIANCE_QUEUE, wrapper);
}

export function registerRiskConsumer(fn: RiskHandler): void {
  if (riskWrapper) {
    emitter.removeListener(RISK_QUEUE, riskWrapper);
  }
  const wrapper = (job: RiskJob) => {
    fn(job).catch((err) => {
      console.error(`[queue] risk job failed for shipment=${job.shipmentId}:`, err);
    });
  };
  riskWrapper = wrapper;
  emitter.on(RISK_QUEUE, wrapper);
}

export function registerInsuranceConsumer(fn: InsuranceHandler): void {
  if (insuranceWrapper) {
    emitter.removeListener(INSURANCE_QUEUE, insuranceWrapper);
  }
  const wrapper = (job: InsuranceJob) => {
    fn(job).catch((err) => {
      console.error(`[queue] insurance job failed for shipment=${job.shipmentId}:`, err);
    });
  };
  insuranceWrapper = wrapper;
  emitter.on(INSURANCE_QUEUE, wrapper);
}

export function registerPricingConsumer(fn: PricingHandler): void {
  if (pricingWrapper) {
    emitter.removeListener(PRICING_QUEUE, pricingWrapper);
  }
  const wrapper = (job: PricingJob) => {
    fn(job).catch((err) => {
      console.error(`[queue] pricing job failed for shipment=${job.shipmentId}:`, err);
    });
  };
  pricingWrapper = wrapper;
  emitter.on(PRICING_QUEUE, wrapper);
}

export function registerDocGenConsumer(fn: DocGenHandler): void {
  if (docgenWrapper) {
    emitter.removeListener(DOCGEN_QUEUE, docgenWrapper);
  }
  const wrapper = (job: DocGenJob) => {
    fn(job).catch((err) => {
      console.error(`[queue] docgen job failed for shipment=${job.shipmentId}:`, err);
    });
  };
  docgenWrapper = wrapper;
  emitter.on(DOCGEN_QUEUE, wrapper);
}

export function registerBillingConsumer(fn: BillingHandler): void {
  if (billingWrapper) {
    emitter.removeListener(BILLING_QUEUE, billingWrapper);
  }
  const wrapper = (job: BillingJob) => {
    fn(job).catch((err) => {
      console.error(`[queue] billing job failed for shipment=${job.shipmentId}:`, err);
    });
  };
  billingWrapper = wrapper;
  emitter.on(BILLING_QUEUE, wrapper);
}

export function publishExtractionJob(job: ExtractionJob): void {
  setImmediate(() => { emitter.emit(EXTRACTION_QUEUE, job); });
}

export function publishPipelineJob(job: ShipmentPipelineJob): void {
  setImmediate(() => { emitter.emit(PIPELINE_QUEUE, job); });
}

export function publishComplianceJob(job: ComplianceJob): void {
  setImmediate(() => { emitter.emit(COMPLIANCE_QUEUE, job); });
}

export function publishRiskJob(job: RiskJob): void {
  setImmediate(() => { emitter.emit(RISK_QUEUE, job); });
}

export function publishInsuranceJob(job: InsuranceJob): void {
  setImmediate(() => { emitter.emit(INSURANCE_QUEUE, job); });
}

export function publishPricingJob(job: PricingJob): void {
  setImmediate(() => { emitter.emit(PRICING_QUEUE, job); });
}

export function publishDocGenJob(job: DocGenJob): void {
  setImmediate(() => { emitter.emit(DOCGEN_QUEUE, job); });
}

export function publishBillingJob(job: BillingJob): void {
  setImmediate(() => { emitter.emit(BILLING_QUEUE, job); });
}

export function registerExceptionConsumer(fn: ExceptionHandler): void {
  if (exceptionWrapper) {
    emitter.removeListener(EXCEPTION_QUEUE, exceptionWrapper);
  }
  const wrapper = (job: ExceptionJob) => {
    fn(job).catch((err) => {
      console.error(`[queue] exception job failed for shipment=${job.shipmentId}:`, err);
    });
  };
  exceptionWrapper = wrapper;
  emitter.on(EXCEPTION_QUEUE, wrapper);
}

export function registerTradeLaneConsumer(fn: TradeLaneHandler): void {
  if (tradeLaneWrapper) {
    emitter.removeListener(TRADE_LANE_QUEUE, tradeLaneWrapper);
  }
  const wrapper = (job: TradeLaneJob) => {
    fn(job).catch((err) => {
      console.error(`[queue] trade-lane job failed for shipment=${job.shipmentId}:`, err);
    });
  };
  tradeLaneWrapper = wrapper;
  emitter.on(TRADE_LANE_QUEUE, wrapper);
}

export function registerClaimsConsumer(fn: ClaimsHandler): void {
  if (claimsWrapper) {
    emitter.removeListener(CLAIMS_QUEUE, claimsWrapper);
  }
  const wrapper = (job: ClaimsJob) => {
    fn(job).catch((err) => {
      console.error(`[queue] claims job failed for shipment=${job.shipmentId}:`, err);
    });
  };
  claimsWrapper = wrapper;
  emitter.on(CLAIMS_QUEUE, wrapper);
}

export function publishExceptionJob(job: ExceptionJob): void {
  setImmediate(() => { emitter.emit(EXCEPTION_QUEUE, job); });
}

export function publishTradeLaneJob(job: TradeLaneJob): void {
  setImmediate(() => { emitter.emit(TRADE_LANE_QUEUE, job); });
}

export function publishClaimsJob(job: ClaimsJob): void {
  setImmediate(() => { emitter.emit(CLAIMS_QUEUE, job); });
}

export function publishM4Jobs(companyId: string, shipmentId: string): void {
  publishComplianceJob({ companyId, shipmentId, trigger: "shipment_created" });
  publishRiskJob({ companyId, shipmentId, trigger: "shipment_created" });
  publishInsuranceJob({ companyId, shipmentId, trigger: "shipment_created" });
}

export function getQueueStats(): Record<string, number> {
  return {
    extractionListeners: emitter.listenerCount(EXTRACTION_QUEUE),
    pipelineListeners: emitter.listenerCount(PIPELINE_QUEUE),
    complianceListeners: emitter.listenerCount(COMPLIANCE_QUEUE),
    riskListeners: emitter.listenerCount(RISK_QUEUE),
    insuranceListeners: emitter.listenerCount(INSURANCE_QUEUE),
    pricingListeners: emitter.listenerCount(PRICING_QUEUE),
    docgenListeners: emitter.listenerCount(DOCGEN_QUEUE),
    billingListeners: emitter.listenerCount(BILLING_QUEUE),
    exceptionListeners: emitter.listenerCount(EXCEPTION_QUEUE),
    tradeLaneListeners: emitter.listenerCount(TRADE_LANE_QUEUE),
    claimsListeners: emitter.listenerCount(CLAIMS_QUEUE),
  };
}
