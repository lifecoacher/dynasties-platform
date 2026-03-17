import { getExternalSignalsConfig } from "../config/external-signals.js";

export interface VesselPosition {
  source: "aisstream";
  mmsi: string;
  shipName: string;
  lat: number;
  lng: number;
  speedKnots: number;
  courseOverGround: number;
  navigationalStatus: string;
  timestamp: string;
}

function logProviderCall(outcome: "success" | "error" | "disabled" | "fallback", latencyMs: number, detail?: string): void {
  console.log(JSON.stringify({
    provider: "aisstream",
    outcome,
    latencyMs: Math.round(latencyMs),
    fallback: outcome === "fallback" || outcome === "disabled",
    detail: detail || undefined,
    timestamp: new Date().toISOString(),
  }));
}

export async function fetchVesselPositions(_mmsis: string[]): Promise<VesselPosition[] | null> {
  const cfg = getExternalSignalsConfig();

  if (!cfg.ais.enabled || !cfg.ais.apiKey) {
    logProviderCall("disabled", 0, "AISStream disabled or API key missing — using seeded vessel data");
    return null;
  }

  logProviderCall("disabled", 0,
    "AISStream integration intentionally disabled for demo stability. " +
    "AISStream uses WebSocket streaming which creates a fragile dependency: " +
    "connections can drop, rate limits are strict, and the streaming model " +
    "doesn't align with request/response demo flows. " +
    "Seeded vessel intelligence data provides a more reliable demo experience."
  );
  return null;
}

export function getAisStreamStatus(): {
  enabled: boolean;
  reason: string;
  apiKeyPresent: boolean;
} {
  const cfg = getExternalSignalsConfig();
  return {
    enabled: false,
    reason: "Intentionally disabled — WebSocket streaming is fragile for demo. " +
      "Provider wrapper exists and can be activated for production use.",
    apiKeyPresent: !!cfg.ais.apiKey,
  };
}
