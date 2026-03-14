import { registerExtractionConsumer, registerPipelineConsumer } from "@workspace/queue";
import type { ExtractionJob, ShipmentPipelineJob } from "@workspace/queue";
import { processExtractionJob } from "@workspace/svc-document-extraction";
import { runShipmentPipeline } from "@workspace/svc-shipment-construction";

export function startConsumers(): void {
  registerExtractionConsumer(async (job: ExtractionJob) => {
    await processExtractionJob(job);
  });
  console.log("[consumer] extraction job consumer registered");

  registerPipelineConsumer(async (job: ShipmentPipelineJob) => {
    const result = await runShipmentPipeline(job.documentIds, job.companyId);
    if (result.success) {
      console.log(
        `[consumer] pipeline complete: shipment=${result.shipmentId} ref=${result.reference} entities=${result.entitiesCreated}new/${result.entitiesMatched}matched`,
      );
    } else {
      console.log(`[consumer] pipeline failed: ${result.error}`);
    }
  });
  console.log("[consumer] shipment pipeline consumer registered");
}
