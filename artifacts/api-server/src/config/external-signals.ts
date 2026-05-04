import { createLogger } from "@workspace/config";

const logger = createLogger("external-signals");

export interface ExternalSignalsConfig {
  enabled: boolean;
  weather: {
    enabled: boolean;
    apiKey: string | null;
  };
  ais: {
    enabled: boolean;
    apiKey: string | null;
  };
}

let _config: ExternalSignalsConfig | null = null;

export function getExternalSignalsConfig(): ExternalSignalsConfig {
  if (_config) return _config;

  const globalEnabled = process.env.DEMO_EXTERNAL_SIGNALS === "true";

  _config = {
    enabled: globalEnabled,
    weather: {
      enabled: globalEnabled && process.env.DEMO_USE_WEATHER_API === "true",
      apiKey: process.env.OPENWEATHER_API_KEY || null,
    },
    ais: {
      enabled: globalEnabled && process.env.DEMO_USE_AIS_API === "true",
      apiKey: process.env.AISSTREAM_API_KEY || null,
    },
  };

  return _config;
}

export function logExternalSignalsConfig(): void {
  const cfg = getExternalSignalsConfig();
  logger.info({
    globalEnabled: cfg.enabled,
    weatherEnabled: cfg.weather.enabled,
    weatherKeyPresent: !!cfg.weather.apiKey,
    aisEnabled: cfg.ais.enabled,
    aisKeyPresent: !!cfg.ais.apiKey,
  }, "External signals configuration");

  if (cfg.weather.enabled && !cfg.weather.apiKey) {
    logger.warn("Weather API enabled but OPENWEATHER_API_KEY is missing — will use fallback data");
  }
  if (cfg.ais.enabled && !cfg.ais.apiKey) {
    logger.warn("AIS API enabled but AISSTREAM_API_KEY is missing — will use fallback data");
  }
}
