import { registerExtractionConsumer, type ExtractionJob } from "@workspace/queue";
import { processExtractionJob } from "@workspace/svc-document-extraction";

export function startExtractionConsumer(): void {
  registerExtractionConsumer(async (job: ExtractionJob) => {
    await processExtractionJob(job);
  });
  console.log("[consumer] extraction job consumer registered");
}
