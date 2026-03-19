import { callAI } from "@workspace/integrations-anthropic-ai";
import type { ShipmentEventType } from "@workspace/db/schema";

export interface ClassificationInput {
  description: string;
  timestamp?: string;
  location?: string;
  metadata?: Record<string, any>;
}

export interface ClassificationOutput {
  eventType: ShipmentEventType;
  confidence: number;
  normalizedLocation: string | null;
}

const HEURISTIC_PATTERNS: [RegExp, ShipmentEventType, number][] = [
  [/\b(deliver(ed|y)|received|signed|pod)\b/i, "DELIVERED", 0.95],
  [/\b(out for delivery|last mile|dispatched)\b/i, "OUT_FOR_DELIVERY", 0.9],
  [/\b(customs? hold|detained|customs? stop|held at customs)\b/i, "CUSTOMS_HOLD", 0.95],
  [/\b(customs? (clear|release|cleared|released))\b/i, "CUSTOMS_RELEASED", 0.95],
  [/\b(delay(ed)?|postpone|setback|behind schedule)\b/i, "DELAYED", 0.9],
  [/\b(arriv(ed|al).*dest|reached.*port|docked|berthed|at destination)\b/i, "ARRIVED_DESTINATION", 0.9],
  [/\b(arriv(ed|al).*trans|tranship|relay port|intermediate)\b/i, "ARRIVED_TRANSSHIPMENT", 0.85],
  [/\b(depart(ed|ure).*trans|left.*trans|sailed.*trans)\b/i, "DEPARTED_TRANSSHIPMENT", 0.85],
  [/\b(depart(ed|ure)|sail(ed)?|left port|etd|vessel departed|loaded on vessel)\b/i, "DEPARTED_ORIGIN", 0.9],
  [/\b(pick(ed)? up|collected|cargo received|gate in)\b/i, "PICKED_UP", 0.9],
  [/\b(book(ed|ing).*confirm|confirmed|booking accepted)\b/i, "BOOKING_CONFIRMED", 0.9],
  [/\b(creat(ed|ion)|new shipment|initiated|draft)\b/i, "SHIPMENT_CREATED", 0.85],
];

export function classifyByHeuristics(input: ClassificationInput): ClassificationOutput {
  const text = [input.description, input.location, JSON.stringify(input.metadata || {})]
    .filter(Boolean)
    .join(" ");

  for (const [pattern, eventType, confidence] of HEURISTIC_PATTERNS) {
    if (pattern.test(text)) {
      return {
        eventType,
        confidence,
        normalizedLocation: normalizeLocation(input.location),
      };
    }
  }

  return {
    eventType: "UNKNOWN",
    confidence: 0,
    normalizedLocation: normalizeLocation(input.location),
  };
}

export async function classifyEvent(input: ClassificationInput): Promise<ClassificationOutput> {
  const heuristic = classifyByHeuristics(input);
  if (heuristic.confidence >= 0.85) {
    return heuristic;
  }

  try {
    const prompt = `You are a logistics event classifier for an ocean freight forwarding platform.

Classify this event into ONE of these canonical types:
- SHIPMENT_CREATED — new shipment record created
- BOOKING_CONFIRMED — carrier booking confirmed
- PICKED_UP — cargo picked up from shipper
- DEPARTED_ORIGIN — vessel departed origin port
- ARRIVED_TRANSSHIPMENT — arrived at transshipment/relay port
- DEPARTED_TRANSSHIPMENT — departed transshipment port
- ARRIVED_DESTINATION — vessel arrived at destination port
- CUSTOMS_HOLD — cargo held by customs
- CUSTOMS_RELEASED — cargo cleared by customs
- DELAYED — shipment delayed
- OUT_FOR_DELIVERY — cargo out for final delivery
- DELIVERED — cargo delivered to consignee
- UNKNOWN — cannot determine

Event description: "${input.description}"
${input.timestamp ? `Timestamp: ${input.timestamp}` : ""}
${input.location ? `Location: ${input.location}` : ""}

Respond ONLY with JSON (no markdown):
{
  "eventType": "CANONICAL_TYPE",
  "confidence": 0.0 to 1.0
}`;

    const response = await callAI({
      taskType: "event-classification",
      systemPrompt: "You are a logistics event classifier. Respond only with valid JSON.",
      userMessage: prompt,
      maxTokens: 200,
      temperature: 0.1,
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const validTypes = [
        "SHIPMENT_CREATED", "BOOKING_CONFIRMED", "PICKED_UP", "DEPARTED_ORIGIN",
        "ARRIVED_TRANSSHIPMENT", "DEPARTED_TRANSSHIPMENT", "ARRIVED_DESTINATION",
        "CUSTOMS_HOLD", "CUSTOMS_RELEASED", "DELAYED", "OUT_FOR_DELIVERY", "DELIVERED", "UNKNOWN",
      ];
      const eventType = validTypes.includes(parsed.eventType) ? parsed.eventType : "UNKNOWN";
      return {
        eventType: eventType as ShipmentEventType,
        confidence: Math.min(Math.max(parsed.confidence || 0, 0), 1),
        normalizedLocation: normalizeLocation(input.location),
      };
    }
  } catch (err: any) {
    console.error("[event-classifier] AI classification failed:", err.message);
  }

  return heuristic.eventType !== "UNKNOWN" ? heuristic : {
    eventType: "UNKNOWN",
    confidence: 0,
    normalizedLocation: normalizeLocation(input.location),
  };
}

function normalizeLocation(location: string | null | undefined): string | null {
  if (!location || location.trim() === "") return null;

  let norm = location.trim();

  const portCodeMatch = norm.match(/^([A-Z]{5})$/);
  if (portCodeMatch) {
    return portCodeMatch[1];
  }

  const portWithCountry = norm.match(/^([A-Z]{2})([A-Z]{3})$/);
  if (portWithCountry) {
    return norm;
  }

  norm = norm
    .replace(/\s+/g, " ")
    .replace(/[,]+/g, ",")
    .trim();

  return norm;
}
