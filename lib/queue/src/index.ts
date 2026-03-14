import { EventEmitter } from "node:events";

export interface ExtractionJob {
  documentId: string;
  companyId: string;
  s3Key: string;
  fileName: string;
  mimeType: string;
  documentType: string;
}

type JobHandler = (job: ExtractionJob) => Promise<void>;

const emitter = new EventEmitter();
const EXTRACTION_QUEUE = "extraction-jobs";

let currentWrapper: ((job: ExtractionJob) => void) | null = null;

export function registerExtractionConsumer(fn: JobHandler): void {
  if (currentWrapper) {
    emitter.removeListener(EXTRACTION_QUEUE, currentWrapper);
  }

  const wrapper = (job: ExtractionJob) => {
    fn(job).catch((err) => {
      console.error(`[queue] extraction job failed for doc=${job.documentId}:`, err);
    });
  };

  currentWrapper = wrapper;
  emitter.on(EXTRACTION_QUEUE, wrapper);
}

export function publishExtractionJob(job: ExtractionJob): void {
  setImmediate(() => {
    emitter.emit(EXTRACTION_QUEUE, job);
  });
}

export function getQueueStats(): { listenerCount: number } {
  return { listenerCount: emitter.listenerCount(EXTRACTION_QUEUE) };
}
