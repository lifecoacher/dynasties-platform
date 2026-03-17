import { anthropic } from "./client.js";
import type Anthropic from "@anthropic-ai/sdk";

export interface OrchestratorRequest {
  taskType: string;
  systemPrompt: string;
  userMessage: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  companyId?: string;
}

export interface OrchestratorResponse {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: "success" | "error" | "fallback";
  errorMessage?: string;
}

const MODEL_ROUTING: Record<string, string> = {
  "document-extraction": "claude-sonnet-4-6",
  "risk-analysis": "claude-haiku-4-5",
  "compliance-screening": "claude-haiku-4-5",
  "claims-management": "claude-haiku-4-5",
  "trade-lane-intelligence": "claude-haiku-4-5",
  "command-center-chat": "claude-haiku-4-5",
  default: "claude-haiku-4-5",
};

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
      });

      const latencyMs = Date.now() - start;
      const textContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");

      const result: OrchestratorResponse = {
        content: textContent,
        model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        latencyMs,
        status: "success",
      };

      console.log(
        `[ai-orchestrator] task=${req.taskType} model=${model} input=${result.inputTokens} output=${result.outputTokens} latency=${latencyMs}ms status=success`,
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
  };
}

export { MODEL_ROUTING, selectModel };
