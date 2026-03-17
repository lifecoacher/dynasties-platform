import { getExternalSignalsConfig } from "../config/external-signals.js";

export interface WeatherSummary {
  source: "openweather";
  location: { lat: number; lng: number; name?: string };
  current: {
    tempC: number;
    feelsLikeC: number;
    humidity: number;
    windSpeedKmh: number;
    windGustKmh: number | null;
    description: string;
    icon: string;
    visibility: number;
    pressure: number;
  };
  alerts: Array<{
    event: string;
    severity: "minor" | "moderate" | "severe" | "extreme";
    description: string;
    start: string;
    end: string;
  }>;
  seaState: {
    windBeaufort: number;
    operationalRisk: "low" | "moderate" | "high" | "critical";
    description: string;
  };
  fetchedAt: string;
  cacheTtlMs: number;
}

interface CacheEntry {
  data: WeatherSummary;
  expiresAt: number;
}

const CACHE_TTL_MS = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5000;
const MAX_RETRIES = 1;

const cache = new Map<string, CacheEntry>();

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)}_${lng.toFixed(2)}`;
}

function windToBeaufort(speedKmh: number): number {
  if (speedKmh < 1) return 0;
  if (speedKmh < 6) return 1;
  if (speedKmh < 12) return 2;
  if (speedKmh < 20) return 3;
  if (speedKmh < 29) return 4;
  if (speedKmh < 39) return 5;
  if (speedKmh < 50) return 6;
  if (speedKmh < 62) return 7;
  if (speedKmh < 75) return 8;
  if (speedKmh < 89) return 9;
  if (speedKmh < 103) return 10;
  if (speedKmh < 118) return 11;
  return 12;
}

function beaufortToRisk(beaufort: number): { risk: "low" | "moderate" | "high" | "critical"; description: string } {
  if (beaufort <= 4) return { risk: "low", description: "Calm to moderate seas" };
  if (beaufort <= 6) return { risk: "moderate", description: "Rough seas, possible delays" };
  if (beaufort <= 8) return { risk: "high", description: "Very rough seas, likely operational impact" };
  return { risk: "critical", description: "Storm conditions, navigation hazardous" };
}

function mapAlertSeverity(owSeverity: string): "minor" | "moderate" | "severe" | "extreme" {
  const s = (owSeverity || "").toLowerCase();
  if (s === "extreme") return "extreme";
  if (s === "severe") return "severe";
  if (s === "moderate") return "moderate";
  return "minor";
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function logProviderCall(outcome: "success" | "error" | "fallback", latencyMs: number, detail?: string): void {
  console.log(JSON.stringify({
    provider: "openweather",
    outcome,
    latencyMs: Math.round(latencyMs),
    fallback: outcome === "fallback",
    detail: detail || undefined,
    timestamp: new Date().toISOString(),
  }));
}

export async function fetchWeather(lat: number, lng: number): Promise<WeatherSummary | null> {
  const cfg = getExternalSignalsConfig();
  if (!cfg.weather.enabled || !cfg.weather.apiKey) {
    return null;
  }

  const key = cacheKey(lat, lng);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const apiKey = cfg.weather.apiKey;
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&appid=${apiKey}`;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const start = Date.now();
    try {
      const res = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS);
      const elapsed = Date.now() - start;

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        lastError = new Error(`OpenWeather API ${res.status}: ${body.slice(0, 200)}`);
        logProviderCall("error", elapsed, `HTTP ${res.status} (attempt ${attempt + 1})`);
        continue;
      }

      const data = await res.json() as any;
      const elapsed2 = Date.now() - start;

      const windSpeedKmh = (data.wind?.speed || 0) * 3.6;
      const windGustKmh = data.wind?.gust ? data.wind.gust * 3.6 : null;
      const beaufort = windToBeaufort(windGustKmh || windSpeedKmh);
      const seaState = beaufortToRisk(beaufort);

      const result: WeatherSummary = {
        source: "openweather",
        location: {
          lat,
          lng,
          name: data.name || undefined,
        },
        current: {
          tempC: Math.round(data.main?.temp ?? 0),
          feelsLikeC: Math.round(data.main?.feels_like ?? 0),
          humidity: data.main?.humidity ?? 0,
          windSpeedKmh: Math.round(windSpeedKmh),
          windGustKmh: windGustKmh ? Math.round(windGustKmh) : null,
          description: data.weather?.[0]?.description || "Unknown",
          icon: data.weather?.[0]?.icon || "01d",
          visibility: data.visibility ?? 10000,
          pressure: data.main?.pressure ?? 1013,
        },
        alerts: [],  // Free API 2.5 does not include alerts; One Call 3.0 (paid) required for weather alerts
        seaState: {
          windBeaufort: beaufort,
          operationalRisk: seaState.risk,
          description: seaState.description,
        },
        fetchedAt: new Date().toISOString(),
        cacheTtlMs: CACHE_TTL_MS,
      };

      cache.set(key, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
      logProviderCall("success", elapsed2);
      return result;
    } catch (err: any) {
      const elapsed = Date.now() - start;
      lastError = err;
      logProviderCall("error", elapsed, `${err.name}: ${err.message} (attempt ${attempt + 1})`);
    }
  }

  logProviderCall("fallback", 0, lastError?.message || "Unknown error after retries");
  return null;
}

export function clearWeatherCache(): void {
  cache.clear();
}

export function getWeatherCacheStats(): { size: number; entries: string[] } {
  const entries: string[] = [];
  for (const [key, entry] of cache) {
    const ttlRemaining = Math.max(0, entry.expiresAt - Date.now());
    entries.push(`${key} (${Math.round(ttlRemaining / 1000)}s remaining)`);
  }
  return { size: cache.size, entries };
}
