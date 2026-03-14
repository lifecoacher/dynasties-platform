import {
  registerExtractionConsumer,
  registerPipelineConsumer,
  registerComplianceConsumer,
  registerRiskConsumer,
  registerInsuranceConsumer,
  registerPricingConsumer,
  registerDocGenConsumer,
  registerBillingConsumer,
} from "@workspace/queue";
import type {
  ExtractionJob,
  ShipmentPipelineJob,
  ComplianceJob,
  RiskJob,
  InsuranceJob,
  PricingJob,
  DocGenJob,
  BillingJob,
} from "@workspace/queue";
import { processExtractionJob } from "@workspace/svc-document-extraction";
import { runShipmentPipeline } from "@workspace/svc-shipment-construction";
import { runComplianceScreening } from "@workspace/svc-compliance-screening";
import { runRiskIntelligence } from "@workspace/svc-risk-intelligence";
import { runInsuranceQuoteGeneration } from "@workspace/svc-insurance";
import { runPricing } from "@workspace/svc-pricing";
import { runDocumentGeneration } from "@workspace/svc-document-generation";
import { runBilling } from "@workspace/svc-billing";

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

  registerComplianceConsumer(async (job: ComplianceJob) => {
    const result = await runComplianceScreening(job.shipmentId, job.companyId);
    if (result.success) {
      console.log(
        `[consumer] compliance complete: shipment=${job.shipmentId} status=${result.status} matches=${result.matchCount}`,
      );
    } else {
      console.log(`[consumer] compliance failed: ${result.error}`);
    }
  });
  console.log("[consumer] compliance job consumer registered");

  registerRiskConsumer(async (job: RiskJob) => {
    const result = await runRiskIntelligence(job.shipmentId, job.companyId);
    if (result.success) {
      console.log(
        `[consumer] risk complete: shipment=${job.shipmentId} score=${result.compositeScore} action=${result.recommendedAction}`,
      );
    } else {
      console.log(`[consumer] risk failed: ${result.error}`);
    }
  });
  console.log("[consumer] risk job consumer registered");

  registerInsuranceConsumer(async (job: InsuranceJob) => {
    const result = await runInsuranceQuoteGeneration(job.shipmentId, job.companyId);
    if (result.success) {
      console.log(
        `[consumer] insurance complete: shipment=${job.shipmentId} coverage=${result.coverageType} premium=${result.estimatedPremium}`,
      );
    } else {
      console.log(`[consumer] insurance failed: ${result.error}`);
    }
  });
  console.log("[consumer] insurance job consumer registered");

  registerPricingConsumer(async (job: PricingJob) => {
    const result = await runPricing(job.shipmentId, job.companyId);
    if (result.success) {
      console.log(
        `[consumer] pricing complete: shipment=${job.shipmentId} charges=${result.chargeCount} total=$${result.totalAmount.toFixed(2)}`,
      );
    } else {
      console.log(`[consumer] pricing failed: ${result.error}`);
    }
  });
  console.log("[consumer] pricing job consumer registered");

  registerDocGenConsumer(async (job: DocGenJob) => {
    const result = await runDocumentGeneration(job.shipmentId, job.companyId);
    if (result.success) {
      console.log(
        `[consumer] docgen complete: shipment=${job.shipmentId} docs=${result.documentsGenerated} types=${result.documentTypes.join(",")}`,
      );
    } else {
      console.log(`[consumer] docgen failed: ${result.error}`);
    }
  });
  console.log("[consumer] docgen job consumer registered");

  registerBillingConsumer(async (job: BillingJob) => {
    const result = await runBilling(job.shipmentId, job.companyId);
    if (result.success) {
      console.log(
        `[consumer] billing complete: shipment=${job.shipmentId} invoice=${result.invoiceNumber} total=$${result.grandTotal.toFixed(2)}`,
      );
    } else {
      console.log(`[consumer] billing failed: ${result.error}`);
    }
  });
  console.log("[consumer] billing job consumer registered");
}
