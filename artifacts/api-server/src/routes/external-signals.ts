import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  weatherRiskEventsTable,
  shipmentsTable,
} from "@workspace/db/schema";
import { eq, and, inArray, or, sql, desc } from "drizzle-orm";
import { getCompanyId } from "../middlewares/tenant.js";
import { getExternalSignalsConfig } from "../config/external-signals.js";
import { fetchWeather, getWeatherCacheStats, type WeatherSummary } from "../providers/openweather.js";
import { getAisStreamStatus } from "../providers/aisstream.js";
import { getPortCoordinates } from "../providers/port-coordinates.js";

const router: IRouter = Router();

router.get("/intelligence/weather/live/:portCode", async (req, res) => {
  const portCode = req.params.portCode.toUpperCase();
  const coords = getPortCoordinates(portCode);

  if (!coords) {
    res.status(404).json({ error: `Unknown port code: ${portCode}` });
    return;
  }

  const live = await fetchWeather(coords.lat, coords.lng);

  if (live) {
    res.json({
      data: {
        ...live,
        portCode,
        portName: coords.name,
      },
    });
    return;
  }

  const companyId = getCompanyId(req);
  const seeded = await db
    .select()
    .from(weatherRiskEventsTable)
    .where(
      and(
        inArray(weatherRiskEventsTable.status, ["forecast", "active"]),
        or(
          eq(weatherRiskEventsTable.companyId, companyId),
          sql`${weatherRiskEventsTable.companyId} IS NULL`,
        ),
      ),
    )
    .orderBy(desc(weatherRiskEventsTable.forecastDate))
    .limit(20);

  const portWeather = seeded.filter((w) => {
    const ports = (w.affectedPorts as string[]) || [];
    return ports.includes(portCode);
  });

  res.json({
    data: {
      source: "seeded",
      portCode,
      portName: coords.name,
      events: portWeather,
      fallbackReason: "Live weather unavailable — using seeded intelligence data",
    },
  });
});

router.get("/shipments/:id/weather-context", async (req, res) => {
  const companyId = getCompanyId(req);
  const shipmentId = req.params.id;

  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(
      and(
        eq(shipmentsTable.id, shipmentId),
        eq(shipmentsTable.companyId, companyId),
      ),
    )
    .limit(1);

  if (!shipment) {
    res.status(404).json({ error: "Shipment not found" });
    return;
  }

  const portCodes = [shipment.portOfLoading, shipment.portOfDischarge].filter(Boolean) as string[];

  const portWeather: Record<string, {
    portCode: string;
    portName: string;
    live: WeatherSummary | null;
    seededEvents: any[];
  }> = {};

  for (const code of portCodes) {
    const coords = getPortCoordinates(code);
    if (!coords) continue;

    const live = await fetchWeather(coords.lat, coords.lng);

    const seeded = await db
      .select()
      .from(weatherRiskEventsTable)
      .where(
        and(
          inArray(weatherRiskEventsTable.status, ["forecast", "active"]),
          or(
            eq(weatherRiskEventsTable.companyId, companyId),
            sql`${weatherRiskEventsTable.companyId} IS NULL`,
          ),
        ),
      )
      .orderBy(desc(weatherRiskEventsTable.forecastDate))
      .limit(20);

    const portEvents = seeded.filter((w) => {
      const ports = (w.affectedPorts as string[]) || [];
      return ports.includes(code);
    });

    portWeather[code] = {
      portCode: code,
      portName: coords.name,
      live,
      seededEvents: portEvents,
    };
  }

  const cfg = getExternalSignalsConfig();
  const hasLiveData = Object.values(portWeather).some((p) => p.live !== null);

  res.json({
    data: {
      shipmentId,
      portWeather,
      liveWeatherEnabled: cfg.weather.enabled,
      hasLiveData,
    },
  });
});

router.get("/intelligence/providers/status", async (_req, res) => {
  const cfg = getExternalSignalsConfig();
  const weatherCache = getWeatherCacheStats();
  const aisStatus = getAisStreamStatus();

  res.json({
    data: {
      globalEnabled: cfg.enabled,
      providers: {
        openweather: {
          enabled: cfg.weather.enabled,
          apiKeyPresent: !!cfg.weather.apiKey,
          cacheEntries: weatherCache.size,
          cacheDetails: weatherCache.entries,
        },
        aisstream: aisStatus,
      },
    },
  });
});

export default router;
