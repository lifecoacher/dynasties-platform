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

type ExtractionHandler = (job: ExtractionJob) => Promise<void>;
type PipelineHandler = (job: ShipmentPipelineJob) => Promise<void>;
type ComplianceHandler = (job: ComplianceJob) => Promise<void>;
type RiskHandler = (job: RiskJob) => Promise<void>;
type InsuranceHandler = (job: InsuranceJob) => Promise<void>;

const emitter = new EventEmitter();
const EXTRACTION_QUEUE = "extraction-jobs";
const PIPELINE_QUEUE = "shipment-pipeline-jobs";
const COMPLIANCE_QUEUE = "compliance-jobs";
const RISK_QUEUE = "risk-jobs";
const INSURANCE_QUEUE = "insurance-jobs";

let extractionWrapper: ((job: ExtractionJob) => void) | null = null;
let pipelineWrapper: ((job: ShipmentPipelineJob) => void) | null = null;
let complianceWrapper: ((job: ComplianceJob) => void) | null = null;
let riskWrapper: ((job: RiskJob) => void) | null = null;
let insuranceWrapper: ((job: InsuranceJob) => void) | null = null;

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

export function publishExtractionJob(job: ExtractionJob): void {
  setImmediate(() => {
    emitter.emit(EXTRACTION_QUEUE, job);
  });
}

export function publishPipelineJob(job: ShipmentPipelineJob): void {
  setImmediate(() => {
    emitter.emit(PIPELINE_QUEUE, job);
  });
}

export function publishComplianceJob(job: ComplianceJob): void {
  setImmediate(() => {
    emitter.emit(COMPLIANCE_QUEUE, job);
  });
}

export function publishRiskJob(job: RiskJob): void {
  setImmediate(() => {
    emitter.emit(RISK_QUEUE, job);
  });
}

export function publishInsuranceJob(job: InsuranceJob): void {
  setImmediate(() => {
    emitter.emit(INSURANCE_QUEUE, job);
  });
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
  };
}
