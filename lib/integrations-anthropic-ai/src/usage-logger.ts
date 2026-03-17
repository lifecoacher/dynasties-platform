import { db } from "@workspace/db";
import { aiUsageLogsTable } from "@workspace/db/schema";
import { generateId } from "@workspace/shared-utils";
import type { OrchestratorResponse } from "./orchestrator.js";

export interface UsageLogEntry {
  taskType: string;
  companyId?: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: "success" | "error" | "fallback";
  errorMessage?: string;
  estimatedCostUsd?: number;
  metadata?: Record<string, unknown>;
}

export function buildUsageLog(
  taskType: string,
  response: OrchestratorResponse,
  companyId?: string,
  metadata?: Record<string, unknown>,
): UsageLogEntry {
  return {
    taskType,
    companyId,
    model: response.model,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
    latencyMs: response.latencyMs,
    status: response.status,
    errorMessage: response.errorMessage,
    estimatedCostUsd: response.estimatedCostUsd,
    metadata,
  };
}

export async function persistUsageLog(
  taskType: string,
  response: OrchestratorResponse,
  companyId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(aiUsageLogsTable).values({
      id: generateId(),
      companyId: companyId ?? null,
      taskType,
      model: response.model,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      latencyMs: response.latencyMs,
      status: response.status,
      errorMessage: response.errorMessage ?? null,
      metadata: {
        ...metadata,
        estimatedCostUsd: response.estimatedCostUsd,
        validationPassed: response.validationPassed,
      },
    });
  } catch (err) {
    console.error("[ai-usage-logger] failed to persist usage log:", err);
  }
}
