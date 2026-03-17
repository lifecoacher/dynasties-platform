import { anthropic } from "./client.js";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

export interface OrchestratorRequest {
  taskType: string;
  systemPrompt: string;
  userMessage: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  companyId?: string;
  structuredSchema?: z.ZodType<any>;
}

export interface OrchestratorResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: "success" | "error" | "fallback";
  errorMessage?: string;
  parsedOutput?: unknown;
  validationPassed?: boolean;
  estimatedCostUsd?: number;
}

const MODEL_ROUTING: Record<string, string> = {
  "document-extraction": "claude-sonnet-4-6",
  "recommendation-enrichment": "claude-sonnet-4-6",
  "shipment-analysis": "claude-sonnet-4-6",
  "risk-analysis": "claude-haiku-4-5",
  "compliance-screening": "claude-haiku-4-5",
  "claims-management": "claude-haiku-4-5",
  "trade-lane-intelligence": "claude-haiku-4-5",
  "command-center-chat": "claude-haiku-4-5",
  default: "claude-haiku-4-5",
};

const COST_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "claude-haiku-4-5-20241022": { input: 1.0, output: 5.0 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = COST_PER_MILLION_TOKENS[model] || { input: 3.0, output: 15.0 };
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

function selectModel(taskType: string, override?: string): string {
  if (override) return override;
  return MODEL_ROUTING[taskType] || MODEL_ROUTING.default;
}

export async function callAI(req: OrchestratorRequest): Promise<OrchestratorResponse> {
  const model = selectModel(req.taskType, req.model);
  const maxTokens = req.maxTokens || 4096;
  const start = Date.now();

  let attempts = 0;
  const maxRetries = 2;

  while (attempts <= maxRetries) {
    try {
      const response = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        temperature: req.temperature ?? 0,
        system: req.systemPrompt,
        messages: [{ role: "user", content: req.userMessage }],
      }, { timeout: 90_000 });

      const latencyMs = Date.now() - start;
      const textContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");

      const cost = estimateCost(model, response.usage.input_tokens, response.usage.output_tokens);

      const result: OrchestratorResponse = {
        content: textContent,
        model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        latencyMs,
        status: "success",
        estimatedCostUsd: cost,
      };

      if (req.structuredSchema) {
        try {
          const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
          const jsonStr = jsonMatch ? jsonMatch[1].trim() : textContent.trim();
          const parsed = JSON.parse(jsonStr);
          const validated = req.structuredSchema.safeParse(parsed);
          if (validated.success) {
            result.parsedOutput = validated.data;
            result.validationPassed = true;
          } else {
            console.warn(
              `[ai-orchestrator] Zod validation failed for task=${req.taskType}:`,
              validated.error.flatten(),
            );
            result.validationPassed = false;
            result.status = "fallback";
          }
        } catch (parseErr: any) {
          console.warn(
            `[ai-orchestrator] JSON parse failed for task=${req.taskType}: ${parseErr.message}`,
          );
          result.validationPassed = false;
          result.status = "fallback";
        }
      }

      console.log(
        `[ai-orchestrator] task=${req.taskType} model=${model} input=${result.inputTokens} output=${result.outputTokens} latency=${latencyMs}ms cost=$${cost.toFixed(6)} status=${result.status}${result.validationPassed !== undefined ? ` validated=${result.validationPassed}` : ""}`,
      );

      return result;
    } catch (err: any) {
      attempts++;
      const latencyMs = Date.now() - start;

      if (err?.status === 429 && attempts <= maxRetries) {
        const retryAfter = Math.min(2 ** attempts * 1000, 10000);
        console.warn(
          `[ai-orchestrator] rate limited on task=${req.taskType}, retrying in ${retryAfter}ms (attempt ${attempts}/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryAfter));
        continue;
      }

      if (err?.status === 529 && attempts <= maxRetries) {
        const retryAfter = Math.min(2 ** attempts * 2000, 15000);
        console.warn(
          `[ai-orchestrator] API overloaded on task=${req.taskType}, retrying in ${retryAfter}ms (attempt ${attempts}/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryAfter));
        continue;
      }

      const errorMessage = err?.message || "Unknown AI error";
      console.error(
        `[ai-orchestrator] task=${req.taskType} model=${model} latency=${latencyMs}ms status=error error=${errorMessage}`,
      );

      return {
        content: "",
        model,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs,
        status: "error",
        errorMessage,
        estimatedCostUsd: 0,
      };
    }
  }

  return {
    content: "",
    model,
    inputTokens: 0,
    outputTokens: 0,
    latencyMs: Date.now() - start,
    status: "error",
    errorMessage: "Max retries exceeded",
    estimatedCostUsd: 0,
  };
}

export { MODEL_ROUTING, selectModel, estimateCost, COST_PER_MILLION_TOKENS };
