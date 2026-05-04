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
  registerReanalysisConsumer,
  registerIntelligenceLinkingConsumer,
  registerAiRuntimeConsumer,
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
  ReanalysisJob,
  IntelligenceLinkingJob,
  AiRuntimeJob,
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
import { findImpactedShipments, triggerReanalysis } from "@workspace/svc-intelligence-ingestion/reanalysis";
import { computeAndPersistScores } from "@workspace/svc-decision-engine/scoring";
import { runShipmentAnalysis } from "@workspace/svc-ai-runtime";
import { triggerAiReanalysis } from "@workspace/svc-ai-runtime/triggers";
import { db } from "@workspace/db";
import {
  deadLetterJobsTable,
  complianceScreeningsTable,
  riskScoresTable,
  insuranceQuotesTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import { publishDecisionJob } from "@workspace/queue";
import { createLogger } from "@workspace/config";

const logger = createLogger("consumer");

async function tryTriggerDecisionEngine(shipmentId: string, companyId: string): Promise<void> {
  const [compliance] = await db
    .select({ id: complianceScreeningsTable.id })
    .from(complianceScreeningsTable)
    .where(and(eq(complianceScreeningsTable.shipmentId, shipmentId), eq(complianceScreeningsTable.companyId, companyId)))
    .limit(1);

  const [risk] = await db
    .select({ id: riskScoresTable.id })
    .from(riskScoresTable)
    .where(and(eq(riskScoresTable.shipmentId, shipmentId), eq(riskScoresTable.companyId, companyId)))
    .limit(1);

  const [insurance] = await db
    .select({ id: insuranceQuotesTable.id })
    .from(insuranceQuotesTable)
    .where(and(eq(insuranceQuotesTable.shipmentId, shipmentId), eq(insuranceQuotesTable.companyId, companyId)))
    .limit(1);

  if (compliance && risk && insurance) {
    logger.info({ shipmentId }, "M4 complete, triggering decision engine");
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
      logger.info({ queue: entry.queueName }, "Persisted failed job to DLQ");
    } catch (err) {
      logger.error({ err }, "Failed to persist DLQ entry");
    }
  });

  registerExtractionConsumer(async (job: ExtractionJob) => {
    await processExtractionJob(job);
  });
  logger.info("Extraction job consumer registered");

  registerPipelineConsumer(async (job: ShipmentPipelineJob) => {
    const result = await runShipmentPipeline(job.documentIds, job.companyId);
    if (result.success) {
      logger.info({ shipmentId: result.shipmentId, reference: result.reference, entitiesCreated: result.entitiesCreated, entitiesMatched: result.entitiesMatched }, "Pipeline complete");
    } else {
      logger.warn({ error: result.error }, "Pipeline failed");
    }
  });
  logger.info("Shipment pipeline consumer registered");

  registerComplianceConsumer(async (job: ComplianceJob) => {
    const result = await runComplianceScreening(job.shipmentId, job.companyId);
    if (result.success) {
      logger.info({ shipmentId: job.shipmentId, status: result.status, matchCount: result.matchCount }, "Compliance complete");
      await tryTriggerDecisionEngine(job.shipmentId, job.companyId);
      triggerAiReanalysis(job.companyId, job.shipmentId, "COMPLIANCE_UPDATED");
    } else {
      logger.warn({ shipmentId: job.shipmentId, error: result.error }, "Compliance failed");
    }
  });
  logger.info("Compliance job consumer registered");

  registerRiskConsumer(async (job: RiskJob) => {
    const result = await runRiskIntelligence(job.shipmentId, job.companyId);
    if (result.success) {
      logger.info({ shipmentId: job.shipmentId, compositeScore: result.compositeScore, recommendedAction: result.recommendedAction }, "Risk complete");
      await tryTriggerDecisionEngine(job.shipmentId, job.companyId);
      triggerAiReanalysis(job.companyId, job.shipmentId, "RISK_UPDATED");
    } else {
      logger.warn({ shipmentId: job.shipmentId, error: result.error }, "Risk failed");
    }
  });
  logger.info("Risk job consumer registered");

  registerInsuranceConsumer(async (job: InsuranceJob) => {
    const result = await runInsuranceQuoteGeneration(job.shipmentId, job.companyId);
    if (result.success) {
      logger.info({ shipmentId: job.shipmentId, coverageType: result.coverageType, estimatedPremium: result.estimatedPremium }, "Insurance complete");
      await tryTriggerDecisionEngine(job.shipmentId, job.companyId);
      triggerAiReanalysis(job.companyId, job.shipmentId, "INSURANCE_UPDATED");
    } else {
      logger.warn({ shipmentId: job.shipmentId, error: result.error }, "Insurance failed");
    }
  });
  logger.info("Insurance job consumer registered");

  registerPricingConsumer(async (job: PricingJob) => {
    const result = await runPricing(job.shipmentId, job.companyId);
    if (result.success) {
      logger.info({ shipmentId: job.shipmentId, chargeCount: result.chargeCount, totalAmount: result.totalAmount.toFixed(2) }, "Pricing complete");
      triggerAiReanalysis(job.companyId, job.shipmentId, "PRICING_UPDATED");
    } else {
      logger.warn({ shipmentId: job.shipmentId, error: result.error }, "Pricing failed");
    }
  });
  logger.info("Pricing job consumer registered");

  registerDocGenConsumer(async (job: DocGenJob) => {
    const result = await runDocumentGeneration(job.shipmentId, job.companyId);
    if (result.success) {
      logger.info({ shipmentId: job.shipmentId, documentsGenerated: result.documentsGenerated, documentTypes: result.documentTypes }, "Docgen complete");
    } else {
      logger.warn({ shipmentId: job.shipmentId, error: result.error }, "Docgen failed");
    }
  });
  logger.info("Docgen job consumer registered");

  registerBillingConsumer(async (job: BillingJob) => {
    const result = await runBilling(job.shipmentId, job.companyId);
    if (result.success) {
      logger.info({ shipmentId: job.shipmentId, invoiceNumber: result.invoiceNumber, grandTotal: result.grandTotal.toFixed(2) }, "Billing complete");
    } else {
      logger.warn({ shipmentId: job.shipmentId, error: result.error }, "Billing failed");
    }
  });
  logger.info("Billing job consumer registered");

  registerExceptionConsumer(async (job: ExceptionJob) => {
    const result = await runExceptionDetection(job.shipmentId, job.companyId);
    if (result.success) {
      logger.info({ shipmentId: job.shipmentId, exceptionsCreated: result.exceptionsCreated, exceptionTypes: result.exceptionTypes }, "Exceptions complete");
      if (result.exceptionsCreated > 0) {
        triggerAiReanalysis(job.companyId, job.shipmentId, "EXCEPTION_CREATED");
      }
    } else {
      logger.warn({ shipmentId: job.shipmentId, error: result.error }, "Exceptions failed");
    }
  });
  logger.info("Exception job consumer registered");

  registerTradeLaneConsumer(async (job: TradeLaneJob) => {
    const result = await runTradeLaneUpdate(job.shipmentId, job.companyId);
    if (result.success) {
      logger.info({ shipmentId: job.shipmentId, origin: result.origin, destination: result.destination, shipmentCount: result.shipmentCount }, "Trade-lane complete");
    } else {
      logger.warn({ shipmentId: job.shipmentId, error: result.error }, "Trade-lane failed");
    }
  });
  logger.info("Trade-lane job consumer registered");

  registerClaimsConsumer(async (job: ClaimsJob) => {
    const result = await runClaimPreparation(job.shipmentId, job.companyId, job.claimType, job.incidentDescription);
    if (result.success) {
      logger.info({ shipmentId: job.shipmentId, claimNumber: result.claimNumber }, "Claims complete");
    } else {
      logger.warn({ shipmentId: job.shipmentId, error: result.error }, "Claims failed");
    }
  });
  logger.info("Claims job consumer registered");

  registerDecisionConsumer(async (job: DecisionJob) => {
    const result = await runDecisionEngine(job.shipmentId, job.companyId);
    if (result.success) {
      logger.info({ shipmentId: job.shipmentId, recommendationsCreated: result.recommendationsCreated, graphEdgesCreated: result.graphEdgesCreated }, "Decision-engine complete");
    } else {
      logger.warn({ shipmentId: job.shipmentId, error: result.error }, "Decision-engine failed");
    }
  });
  logger.info("Decision-engine consumer registered");

  registerIngestionConsumer(async (job: IngestionJob) => {
    const result = await runIngestionPipeline(job.sourceId, job.sourceType, job.companyId);
    logger.info({ sourceType: job.sourceType, persisted: result.persisted, deduplicated: result.deduplicated, failed: result.failed }, "Ingestion complete");
  });
  logger.info("Ingestion consumer registered");

  registerIntelligenceLinkingConsumer(async (job: IntelligenceLinkingJob) => {
    const edgesCreated = await runIntelligenceLinking(job.companyId, job.sourceType, job.ingestionRunId);
    logger.info({ sourceType: job.sourceType, edgesCreated }, "Intelligence-linking complete");
  });
  logger.info("Intelligence-linking consumer registered");

  registerAiRuntimeConsumer(async (job: AiRuntimeJob) => {
    logger.info({ shipmentId: job.shipmentId, triggerType: job.triggerType }, "AI-runtime processing");
    try {
      const result = await runShipmentAnalysis({
        shipmentId: job.shipmentId,
        companyId: job.companyId,
        triggerType: job.triggerType as any,
        triggerSourceEntityId: job.triggerSourceEntityId,
        triggerSourceEntityType: job.triggerSourceEntityType,
      });
      logger.info({ shipmentId: job.shipmentId, runId: result.runId, success: result.success }, "AI-runtime complete");
    } catch (err) {
      logger.error({ err, shipmentId: job.shipmentId }, "AI-runtime failed");
    }
  });
  logger.info("AI-runtime consumer registered");

  registerReanalysisConsumer(async (job: ReanalysisJob) => {
    const impacted = await findImpactedShipments(
      job.companyId,
      job.sourceType,
      job.affectedPorts,
      job.affectedLanes,
      job.affectedEntities,
      job.affectedVessels,
    );

    if (impacted.length > 0) {
      const result = await triggerReanalysis(
        job.companyId,
        job.sourceType,
        impacted,
        job.ingestionRunId,
      );
      logger.info({ sourceType: job.sourceType, shipmentsIdentified: result.shipmentsIdentified, shipmentsQueued: result.shipmentsQueued, skippedDuplicate: result.skippedDuplicate }, "Reanalysis complete");
    } else {
      logger.info({ sourceType: job.sourceType }, "Reanalysis: no impacted shipments");
    }

    try {
      await computeAndPersistScores(job.companyId);
      logger.info({ companyId: job.companyId }, "Scoring refresh complete");
    } catch (err) {
      logger.error({ err }, "Scoring refresh failed");
    }
  });
  logger.info("Reanalysis consumer registered");
}
