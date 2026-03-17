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
    metadata,
  };
}
