import { EventEmitter } from "node:events";
import crypto from "node:crypto";

export interface DeadLetterEntry {
  queueName: string;
  jobBody: Record<string, unknown>;
  errorMessage: string;
  errorStack?: string;
  attemptCount: number;
}

let dlqPersistFn: ((entry: DeadLetterEntry) => Promise<void>) | null = null;

export function setDlqPersistHandler(fn: (entry: DeadLetterEntry) => Promise<void>): void {
  dlqPersistFn = fn;
}

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

export interface DecisionJob {
  companyId: string;
  shipmentId: string;
  trigger: "m4_complete" | "exception_detected" | "manual";
}

export interface IngestionJob {
  sourceId: string;
  sourceType: string;
  companyId: string | null;
  trigger: "scheduled" | "manual" | "webhook";
}

export interface IntelligenceLinkingJob {
  companyId: string;
  sourceType: string;
  recordIds: string[];
  ingestionRunId: string;
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
type DecisionHandler = (job: DecisionJob) => Promise<void>;
type IngestionHandler = (job: IngestionJob) => Promise<void>;
type IntelligenceLinkingHandler = (job: IntelligenceLinkingJob) => Promise<void>;

interface QueueMessage<T> {
  id: string;
  body: T;
  receiptHandle?: string;
  attempt: number;
}

const QUEUE_URLS: Record<string, string> = {};
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000];

let sqsClient: import("@aws-sdk/client-sqs").SQSClient | null = null;
let sqsLoaded = false;
let useSqs = false;

async function getSqs(): Promise<import("@aws-sdk/client-sqs").SQSClient | null> {
  if (sqsLoaded) return sqsClient;
  sqsLoaded = true;

  if (process.env.QUEUE_BACKEND === "local" || !process.env.SQS_ENDPOINT) {
    console.log("[queue] using in-memory EventEmitter backend");
    return null;
  }

  try {
    const { SQSClient } = await import("@aws-sdk/client-sqs");
    sqsClient = new SQSClient({
      region: process.env.AWS_REGION || "us-east-1",
      ...(process.env.SQS_ENDPOINT ? { endpoint: process.env.SQS_ENDPOINT } : {}),
    });
    useSqs = true;
    console.log("[queue] using SQS backend");
    return sqsClient;
  } catch {
    console.warn("[queue] @aws-sdk/client-sqs not available, falling back to EventEmitter");
    return null;
  }
}

function resolveQueueUrl(queueName: string): string {
  const endpoint = process.env.SQS_ENDPOINT || "https://sqs.us-east-1.amazonaws.com";
  const accountId = process.env.AWS_ACCOUNT_ID || "000000000000";
  return `${endpoint}/${accountId}/dynasties-${queueName}`;
}

function generateIdempotencyToken(job: Record<string, unknown>): string {
  const data = JSON.stringify(job);
  return crypto.createHash("sha256").update(data).digest("hex").slice(0, 32);
}

async function sqsPublish(queueName: string, body: Record<string, unknown>): Promise<void> {
  const client = await getSqs();
  if (!client) return;

  const { SendMessageCommand } = await import("@aws-sdk/client-sqs");
  const queueUrl = QUEUE_URLS[queueName] || resolveQueueUrl(queueName);
  QUEUE_URLS[queueName] = queueUrl;

  await client.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(body),
      MessageGroupId: (body.companyId as string) || "default",
      MessageDeduplicationId: generateIdempotencyToken(body),
    }),
  );
}

type AnyHandler = (job: any) => Promise<void>;
const handlers: Record<string, AnyHandler> = {};
const pollingIntervals: Record<string, ReturnType<typeof setInterval>> = {};

async function sqsStartPolling(queueName: string): Promise<void> {
  const client = await getSqs();
  if (!client) return;

  const { ReceiveMessageCommand, DeleteMessageCommand } = await import("@aws-sdk/client-sqs");
  const queueUrl = QUEUE_URLS[queueName] || resolveQueueUrl(queueName);
  QUEUE_URLS[queueName] = queueUrl;

  if (pollingIntervals[queueName]) return;

  const poll = async () => {
    const handler = handlers[queueName];
    if (!handler) return;

    try {
      const resp = await client.send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 5,
          WaitTimeSeconds: 10,
          VisibilityTimeout: 300,
        }),
      );

      if (!resp.Messages?.length) return;

      for (const msg of resp.Messages) {
        if (!msg.Body || !msg.ReceiptHandle) continue;

        try {
          const body = JSON.parse(msg.Body);
          await handler(body);

          await client.send(
            new DeleteMessageCommand({
              QueueUrl: queueUrl,
              ReceiptHandle: msg.ReceiptHandle,
            }),
          );
        } catch (err) {
          console.error(`[queue:sqs] ${queueName} message processing failed:`, err);
        }
      }
    } catch (err) {
      console.error(`[queue:sqs] ${queueName} polling error:`, err);
    }
  };

  pollingIntervals[queueName] = setInterval(poll, 1000);
  poll();
}

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
const DECISION_QUEUE = "decision-jobs";
const INGESTION_QUEUE = "ingestion-jobs";
const INTELLIGENCE_LINKING_QUEUE = "intelligence-linking-jobs";

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
let decisionWrapper: ((job: DecisionJob) => void) | null = null;
let ingestionWrapper: ((job: IngestionJob) => void) | null = null;
let intelligenceLinkingWrapper: ((job: IntelligenceLinkingJob) => void) | null = null;

function wrapWithRetry<T>(
  queueName: string,
  fn: (job: T) => Promise<void>,
): (job: T) => void {
  return (job: T) => {
    const attempt = async (retryCount: number) => {
      try {
        await fn(job);
      } catch (err) {
        if (retryCount < MAX_RETRIES) {
          const delay = RETRY_DELAYS[retryCount] || 15000;
          console.error(
            `[queue] ${queueName} job failed (attempt ${retryCount + 1}/${MAX_RETRIES}), retrying in ${delay}ms:`,
            err,
          );
          setTimeout(() => attempt(retryCount + 1), delay);
        } else {
          const errObj = err instanceof Error ? err : new Error(String(err));
          console.error(
            `[queue:dlq] ${queueName} job exhausted retries, sending to DLQ:`,
            errObj.message,
            JSON.stringify(job),
          );
          if (dlqPersistFn) {
            dlqPersistFn({
              queueName,
              jobBody: job as unknown as Record<string, unknown>,
              errorMessage: errObj.message,
              errorStack: errObj.stack,
              attemptCount: MAX_RETRIES,
            }).catch((dlqErr) => {
              console.error(`[queue:dlq] failed to persist DLQ entry:`, dlqErr);
            });
          }
        }
      }
    };
    attempt(0);
  };
}

function registerConsumer<T>(
  queueName: string,
  fn: (job: T) => Promise<void>,
  currentWrapper: ((job: T) => void) | null,
): (job: T) => void {
  if (currentWrapper) {
    emitter.removeListener(queueName, currentWrapper);
  }
  const wrapper = wrapWithRetry(queueName, fn);
  emitter.on(queueName, wrapper);

  handlers[queueName] = fn as AnyHandler;
  getSqs().then((client) => {
    if (client) sqsStartPolling(queueName);
  });

  return wrapper;
}

export function registerExtractionConsumer(fn: ExtractionHandler): void {
  extractionWrapper = registerConsumer(EXTRACTION_QUEUE, fn, extractionWrapper);
}

export function registerPipelineConsumer(fn: PipelineHandler): void {
  pipelineWrapper = registerConsumer(PIPELINE_QUEUE, fn, pipelineWrapper);
}

export function registerComplianceConsumer(fn: ComplianceHandler): void {
  complianceWrapper = registerConsumer(COMPLIANCE_QUEUE, fn, complianceWrapper);
}

export function registerRiskConsumer(fn: RiskHandler): void {
  riskWrapper = registerConsumer(RISK_QUEUE, fn, riskWrapper);
}

export function registerInsuranceConsumer(fn: InsuranceHandler): void {
  insuranceWrapper = registerConsumer(INSURANCE_QUEUE, fn, insuranceWrapper);
}

export function registerPricingConsumer(fn: PricingHandler): void {
  pricingWrapper = registerConsumer(PRICING_QUEUE, fn, pricingWrapper);
}

export function registerDocGenConsumer(fn: DocGenHandler): void {
  docgenWrapper = registerConsumer(DOCGEN_QUEUE, fn, docgenWrapper);
}

export function registerBillingConsumer(fn: BillingHandler): void {
  billingWrapper = registerConsumer(BILLING_QUEUE, fn, billingWrapper);
}

export function registerExceptionConsumer(fn: ExceptionHandler): void {
  exceptionWrapper = registerConsumer(EXCEPTION_QUEUE, fn, exceptionWrapper);
}

export function registerTradeLaneConsumer(fn: TradeLaneHandler): void {
  tradeLaneWrapper = registerConsumer(TRADE_LANE_QUEUE, fn, tradeLaneWrapper);
}

export function registerClaimsConsumer(fn: ClaimsHandler): void {
  claimsWrapper = registerConsumer(CLAIMS_QUEUE, fn, claimsWrapper);
}

export function registerDecisionConsumer(fn: DecisionHandler): void {
  decisionWrapper = registerConsumer(DECISION_QUEUE, fn, decisionWrapper);
}

export function registerIngestionConsumer(fn: IngestionHandler): void {
  ingestionWrapper = registerConsumer(INGESTION_QUEUE, fn, ingestionWrapper);
}

export function registerIntelligenceLinkingConsumer(fn: IntelligenceLinkingHandler): void {
  intelligenceLinkingWrapper = registerConsumer(INTELLIGENCE_LINKING_QUEUE, fn, intelligenceLinkingWrapper);
}

async function publish(queueName: string, job: Record<string, unknown>): Promise<void> {
  const client = await getSqs();
  if (client) {
    try {
      await sqsPublish(queueName, job);
      return;
    } catch (err) {
      console.error(`[queue] SQS publish failed for ${queueName}, falling back to local:`, err);
    }
  }
  setImmediate(() => {
    emitter.emit(queueName, job);
  });
}

export function publishExtractionJob(job: ExtractionJob): void {
  publish(EXTRACTION_QUEUE, job as unknown as Record<string, unknown>);
}

export function publishPipelineJob(job: ShipmentPipelineJob): void {
  publish(PIPELINE_QUEUE, job as unknown as Record<string, unknown>);
}

export function publishComplianceJob(job: ComplianceJob): void {
  publish(COMPLIANCE_QUEUE, job as unknown as Record<string, unknown>);
}

export function publishRiskJob(job: RiskJob): void {
  publish(RISK_QUEUE, job as unknown as Record<string, unknown>);
}

export function publishInsuranceJob(job: InsuranceJob): void {
  publish(INSURANCE_QUEUE, job as unknown as Record<string, unknown>);
}

export function publishPricingJob(job: PricingJob): void {
  publish(PRICING_QUEUE, job as unknown as Record<string, unknown>);
}

export function publishDocGenJob(job: DocGenJob): void {
  publish(DOCGEN_QUEUE, job as unknown as Record<string, unknown>);
}

export function publishBillingJob(job: BillingJob): void {
  publish(BILLING_QUEUE, job as unknown as Record<string, unknown>);
}

export function publishExceptionJob(job: ExceptionJob): void {
  publish(EXCEPTION_QUEUE, job as unknown as Record<string, unknown>);
}

export function publishTradeLaneJob(job: TradeLaneJob): void {
  publish(TRADE_LANE_QUEUE, job as unknown as Record<string, unknown>);
}

export function publishClaimsJob(job: ClaimsJob): void {
  publish(CLAIMS_QUEUE, job as unknown as Record<string, unknown>);
}

export function publishDecisionJob(job: DecisionJob): void {
  publish(DECISION_QUEUE, job as unknown as Record<string, unknown>);
}

export function publishIngestionJob(job: IngestionJob): void {
  publish(INGESTION_QUEUE, job as unknown as Record<string, unknown>);
}

export function publishIntelligenceLinkingJob(job: IntelligenceLinkingJob): void {
  publish(INTELLIGENCE_LINKING_QUEUE, job as unknown as Record<string, unknown>);
}

export function publishM4Jobs(companyId: string, shipmentId: string): void {
  publishComplianceJob({ companyId, shipmentId, trigger: "shipment_created" });
  publishRiskJob({ companyId, shipmentId, trigger: "shipment_created" });
  publishInsuranceJob({ companyId, shipmentId, trigger: "shipment_created" });
}

export function getQueueStats(): Record<string, number | string> {
  return {
    backend: useSqs ? "sqs" : "event-emitter",
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
    decisionListeners: emitter.listenerCount(DECISION_QUEUE),
    ingestionListeners: emitter.listenerCount(INGESTION_QUEUE),
    intelligenceLinkingListeners: emitter.listenerCount(INTELLIGENCE_LINKING_QUEUE),
  };
}
