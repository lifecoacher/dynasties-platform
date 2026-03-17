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

  if (!cfg.ais.enabled) {
    logProviderCall("disabled", 0, "AISStream disabled via DEMO_USE_AIS_API flag — using seeded vessel data");
    return null;
  }

  if (!cfg.ais.apiKey) {
    logProviderCall("disabled", 0, "AISStream enabled but AISSTREAM_API_KEY missing — using seeded vessel data");
    return null;
  }

  logProviderCall("fallback", 0,
    "AISStream provider is enabled but WebSocket streaming is not yet implemented. " +
    "AISStream uses WebSocket connections which require a persistent listener model " +
    "that doesn't align with request/response demo flows. " +
    "Production implementation would open a managed WebSocket, buffer recent positions, " +
    "and serve them via a REST-like cache. Using seeded vessel data for now."
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
    enabled: cfg.ais.enabled,
    reason: cfg.ais.enabled
      ? "Enabled via flags — WebSocket streaming not yet implemented, falling back to seeded data"
      : "Disabled via DEMO_USE_AIS_API flag. Set to 'true' to opt in (will still use seeded data until WebSocket ingestion is built).",
    apiKeyPresent: !!cfg.ais.apiKey,
  };
}
