import {
  registerExtractionConsumer,
  registerPipelineConsumer,
  registerComplianceConsumer,
  registerRiskConsumer,
  registerInsuranceConsumer,
  registerPricingConsumer,
  registerDocGenConsumer,
  registerBillingConsumer,
  registerExceptionConsumer,
  registerTradeLaneConsumer,
  registerClaimsConsumer,
  registerDecisionConsumer,
  registerIngestionConsumer,
  registerIntelligenceLinkingConsumer,
  setDlqPersistHandler,
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
  ExceptionJob,
  TradeLaneJob,
  ClaimsJob,
  DecisionJob,
  IngestionJob,
  IntelligenceLinkingJob,
} from "@workspace/queue";
import { processExtractionJob } from "@workspace/svc-document-extraction";
import { runShipmentPipeline } from "@workspace/svc-shipment-construction";
import { runComplianceScreening } from "@workspace/svc-compliance-screening";
import { runRiskIntelligence } from "@workspace/svc-risk-intelligence";
import { runInsuranceQuoteGeneration } from "@workspace/svc-insurance";
import { runPricing } from "@workspace/svc-pricing";
import { runDocumentGeneration } from "@workspace/svc-document-generation";
import { runBilling } from "@workspace/svc-billing";
import { runExceptionDetection } from "@workspace/svc-exception-management";
import { runTradeLaneUpdate } from "@workspace/svc-trade-lane-intelligence";
import { runClaimPreparation } from "@workspace/svc-claims-management";
import { runDecisionEngine } from "@workspace/svc-decision-engine";
import { runIngestionPipeline } from "@workspace/svc-intelligence-ingestion";
import { runIntelligenceLinking } from "@workspace/svc-intelligence-ingestion/linker";
import { db } from "@workspace/db";
import {
  deadLetterJobsTable,
  complianceScreeningsTable,
  riskScoresTable,
  insuranceQuotesTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import { publishDecisionJob } from "@workspace/queue";

async function tryTriggerDecisionEngine(shipmentId: string, companyId: string): Promise<void> {
  const [compliance] = await db
    .select({ id: complianceScreeningsTable.id })
    .from(complianceScreeningsTable)
    .where(eq(complianceScreeningsTable.shipmentId, shipmentId))
    .limit(1);

  const [risk] = await db
    .select({ id: riskScoresTable.id })
    .from(riskScoresTable)
    .where(eq(riskScoresTable.shipmentId, shipmentId))
    .limit(1);

  const [insurance] = await db
    .select({ id: insuranceQuotesTable.id })
    .from(insuranceQuotesTable)
    .where(eq(insuranceQuotesTable.shipmentId, shipmentId))
    .limit(1);

  if (compliance && risk && insurance) {
    console.log(`[consumer] M4 complete for shipment=${shipmentId}, triggering decision engine`);
    publishDecisionJob({ companyId, shipmentId, trigger: "m4_complete" });
  }
}

export function startConsumers(): void {
  setDlqPersistHandler(async (entry) => {
    try {
      await db.insert(deadLetterJobsTable).values({
        id: generateId(),
        queueName: entry.queueName,
        jobBody: entry.jobBody,
        errorMessage: entry.errorMessage,
        errorStack: entry.errorStack || null,
        attemptCount: entry.attemptCount,
        status: "FAILED",
      });
      console.log(`[dlq] persisted failed job from ${entry.queueName}`);
    } catch (err) {
      console.error(`[dlq] failed to persist:`, err);
    }
  });

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
      await tryTriggerDecisionEngine(job.shipmentId, job.companyId);
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
      await tryTriggerDecisionEngine(job.shipmentId, job.companyId);
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
      await tryTriggerDecisionEngine(job.shipmentId, job.companyId);
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

  registerExceptionConsumer(async (job: ExceptionJob) => {
    const result = await runExceptionDetection(job.shipmentId, job.companyId);
    if (result.success) {
      console.log(
        `[consumer] exceptions complete: shipment=${job.shipmentId} found=${result.exceptionsCreated} types=${result.exceptionTypes.join(",") || "none"}`,
      );
    } else {
      console.log(`[consumer] exceptions failed: ${result.error}`);
    }
  });
  console.log("[consumer] exception job consumer registered");

  registerTradeLaneConsumer(async (job: TradeLaneJob) => {
    const result = await runTradeLaneUpdate(job.shipmentId, job.companyId);
    if (result.success) {
      console.log(
        `[consumer] trade-lane complete: shipment=${job.shipmentId} lane=${result.origin}→${result.destination} count=${result.shipmentCount}`,
      );
    } else {
      console.log(`[consumer] trade-lane failed: ${result.error}`);
    }
  });
  console.log("[consumer] trade-lane job consumer registered");

  registerClaimsConsumer(async (job: ClaimsJob) => {
    const result = await runClaimPreparation(job.shipmentId, job.companyId, job.claimType, job.incidentDescription);
    if (result.success) {
      console.log(
        `[consumer] claims complete: shipment=${job.shipmentId} claim=${result.claimNumber}`,
      );
    } else {
      console.log(`[consumer] claims failed: ${result.error}`);
    }
  });
  console.log("[consumer] claims job consumer registered");

  registerDecisionConsumer(async (job: DecisionJob) => {
    const result = await runDecisionEngine(job.shipmentId, job.companyId);
    if (result.success) {
      console.log(
        `[consumer] decision-engine complete: shipment=${job.shipmentId} recommendations=${result.recommendationsCreated} edges=${result.graphEdgesCreated}`,
      );
    } else {
      console.log(`[consumer] decision-engine failed: ${result.error}`);
    }
  });
  console.log("[consumer] decision-engine consumer registered");

  registerIngestionConsumer(async (job: IngestionJob) => {
    const result = await runIngestionPipeline(job.sourceId, job.sourceType, job.companyId);
    console.log(
      `[consumer] ingestion complete: source=${job.sourceType} persisted=${result.persisted} deduped=${result.deduplicated} failed=${result.failed}`,
    );
  });
  console.log("[consumer] ingestion consumer registered");

  registerIntelligenceLinkingConsumer(async (job: IntelligenceLinkingJob) => {
    const edgesCreated = await runIntelligenceLinking(job.companyId, job.sourceType, job.ingestionRunId);
    console.log(
      `[consumer] intelligence-linking complete: source=${job.sourceType} edges=${edgesCreated}`,
    );
  });
  console.log("[consumer] intelligence-linking consumer registered");
}
