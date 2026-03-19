import type { PricedRoute } from "./pricing.js";
import type { RiskFactor } from "./risk.js";

let anthropicClient: any = null;

async function getAnthropicClient() {
  if (anthropicClient) return anthropicClient;
  try {
    const mod = await import("@workspace/integrations-anthropic-ai");
    anthropicClient = mod.anthropic;
    return anthropicClient;
  } catch {
    return null;
  }
}

interface AgentInput {
  shipmentRef: string;
  originCode: string;
  destinationCode: string;
  commodity: string | null;
  hsCode: string | null;
  grossWeight: number | null;
  volume: number | null;
  incoterms: string | null;
  routes: PricedRoute[];
  riskFactors: RiskFactor[];
}

interface AgentOutput {
  recommendedRouteIndex: number;
  recommendationSummary: string;
  reasoning: string;
}

function buildDeterministicOutput(input: AgentInput): AgentOutput {
  let bestIdx = 0;
  let bestScore = -Infinity;

  input.routes.forEach((route, i) => {
    let score = 100;
    score -= route.totalTransitDays * 1.5;
    score -= route.estimatedCost / 500;
    if (route.type === "DIRECT") score += 10;
    if (route.costConfidence === "HIGH") score += 5;
    if (route.costConfidence === "LOW") score -= 5;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  });

  const best = input.routes[bestIdx];
  const highRisks = input.riskFactors.filter((r) => r.severity === "HIGH");

  const summaryParts: string[] = [
    `Recommended route: ${best.label}.`,
    `Estimated cost: $${best.estimatedCost.toLocaleString()} (${best.costConfidence} confidence).`,
    `Transit time: ${best.totalTransitDays} days.`,
  ];

  if (highRisks.length > 0) {
    summaryParts.push(
      `Warning: ${highRisks.length} high-severity risk(s) identified — ${highRisks.map((r) => r.title).join(", ")}.`,
    );
  }

  if (input.routes.length > 1) {
    const alts = input.routes
      .filter((_, i) => i !== bestIdx)
      .map((r) => `${r.label} ($${r.estimatedCost.toLocaleString()}, ${r.totalTransitDays}d)`)
      .join("; ");
    summaryParts.push(`Alternatives: ${alts}.`);
  }

  const reasoningParts: string[] = [
    `Route analysis for shipment ${input.shipmentRef} from ${input.originCode} to ${input.destinationCode}.`,
  ];
  if (input.commodity) reasoningParts.push(`Commodity: ${input.commodity}.`);
  if (input.grossWeight) reasoningParts.push(`Weight: ${input.grossWeight}kg.`);

  reasoningParts.push(
    `${input.routes.length} route option(s) evaluated. ${best.label} selected as optimal based on cost-transit balance.`,
  );
  if (best.type === "DIRECT") {
    reasoningParts.push("Direct routing preferred for fastest transit and minimal handling risk.");
  }
  if (highRisks.length > 0) {
    reasoningParts.push(`Risk advisory: ${highRisks.map((r) => r.detail).join(" ")}`);
  }

  return {
    recommendedRouteIndex: bestIdx,
    recommendationSummary: summaryParts.join(" "),
    reasoning: reasoningParts.join(" "),
  };
}

export async function runRoutingPricingAgent(
  input: AgentInput,
): Promise<AgentOutput> {
  const client = await getAnthropicClient();
  if (!client) {
    return buildDeterministicOutput(input);
  }

  try {
    const routeSummaries = input.routes.map((r, i) => ({
      index: i,
      label: r.label,
      type: r.type,
      transitDays: r.totalTransitDays,
      estimatedCost: r.estimatedCost,
      costRange: r.costRange,
      confidence: r.costConfidence,
      advantages: r.advantages,
      disadvantages: r.disadvantages,
    }));

    const prompt = `You are a freight forwarding routing analyst. Analyze these route options for shipment ${input.shipmentRef} and provide a recommendation.

SHIPMENT CONTEXT:
- Origin: ${input.originCode}
- Destination: ${input.destinationCode}
- Commodity: ${input.commodity || "General cargo"}
- HS Code: ${input.hsCode || "N/A"}
- Weight: ${input.grossWeight ? `${input.grossWeight}kg` : "Unknown"}
- Volume: ${input.volume ? `${input.volume} CBM` : "Unknown"}
- Incoterms: ${input.incoterms || "N/A"}

ROUTE OPTIONS:
${JSON.stringify(routeSummaries, null, 2)}

RISK FACTORS:
${JSON.stringify(input.riskFactors, null, 2)}

Respond with EXACTLY this JSON structure (no other text):
{
  "recommendedRouteIndex": <number - index of best route>,
  "recommendationSummary": "<2-3 sentences summarizing your recommendation and key tradeoffs>",
  "reasoning": "<3-5 sentences explaining your analysis: why this route, cost/transit balance, risk considerations>"
}`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 600,
      temperature: 0.1,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      response.content?.[0]?.type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return buildDeterministicOutput(input);

    const parsed = JSON.parse(jsonMatch[0]) as {
      recommendedRouteIndex?: number;
      recommendationSummary?: string;
      reasoning?: string;
    };

    const idx = parsed.recommendedRouteIndex ?? 0;
    if (idx < 0 || idx >= input.routes.length) {
      return buildDeterministicOutput(input);
    }

    return {
      recommendedRouteIndex: idx,
      recommendationSummary:
        parsed.recommendationSummary ||
        buildDeterministicOutput(input).recommendationSummary,
      reasoning:
        parsed.reasoning || buildDeterministicOutput(input).reasoning,
    };
  } catch {
    return buildDeterministicOutput(input);
  }
}
