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

type ExtractionHandler = (job: ExtractionJob) => Promise<void>;
type PipelineHandler = (job: ShipmentPipelineJob) => Promise<void>;

const emitter = new EventEmitter();
const EXTRACTION_QUEUE = "extraction-jobs";
const PIPELINE_QUEUE = "shipment-pipeline-jobs";

let extractionWrapper: ((job: ExtractionJob) => void) | null = null;
let pipelineWrapper: ((job: ShipmentPipelineJob) => void) | null = null;

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

export function getQueueStats(): { extractionListeners: number; pipelineListeners: number } {
  return {
    extractionListeners: emitter.listenerCount(EXTRACTION_QUEUE),
    pipelineListeners: emitter.listenerCount(PIPELINE_QUEUE),
  };
}
