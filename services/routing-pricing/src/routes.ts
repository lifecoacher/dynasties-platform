export interface PortInfo {
  code: string;
  name: string;
  lat: number;
  lng: number;
  region: string;
}

export interface RouteLeg {
  from: string;
  to: string;
  mode: string;
  transitDays: number;
}

export interface RouteOption {
  label: string;
  type: "DIRECT" | "TRANSSHIPMENT" | "ALTERNATIVE";
  legs: RouteLeg[];
  totalTransitDays: number;
  advantages: string[];
  disadvantages: string[];
}

const PORTS: Record<string, PortInfo> = {
  CNSHA: { code: "CNSHA", name: "Shanghai", lat: 31.23, lng: 121.47, region: "EAST_ASIA" },
  CNSZX: { code: "CNSZX", name: "Shenzhen", lat: 22.54, lng: 114.05, region: "EAST_ASIA" },
  SGSIN: { code: "SGSIN", name: "Singapore", lat: 1.26, lng: 103.84, region: "SE_ASIA" },
  NLRTM: { code: "NLRTM", name: "Rotterdam", lat: 51.91, lng: 4.48, region: "EUROPE" },
  DEHAM: { code: "DEHAM", name: "Hamburg", lat: 53.55, lng: 9.99, region: "EUROPE" },
  USLAX: { code: "USLAX", name: "Los Angeles", lat: 33.74, lng: -118.27, region: "NORTH_AMERICA" },
  USNYC: { code: "USNYC", name: "New York", lat: 40.68, lng: -74.04, region: "NORTH_AMERICA" },
  AEJEA: { code: "AEJEA", name: "Jebel Ali", lat: 25.01, lng: 55.06, region: "MIDDLE_EAST" },
  JPYOK: { code: "JPYOK", name: "Yokohama", lat: 35.44, lng: 139.64, region: "EAST_ASIA" },
  GBFXT: { code: "GBFXT", name: "Felixstowe", lat: 51.96, lng: 1.35, region: "EUROPE" },
  HKHKG: { code: "HKHKG", name: "Hong Kong", lat: 22.30, lng: 114.16, region: "EAST_ASIA" },
  KRPUS: { code: "KRPUS", name: "Busan", lat: 35.10, lng: 129.04, region: "EAST_ASIA" },
  TWKHH: { code: "TWKHH", name: "Kaohsiung", lat: 22.62, lng: 120.30, region: "EAST_ASIA" },
  MYPKG: { code: "MYPKG", name: "Port Klang", lat: 2.99, lng: 101.39, region: "SE_ASIA" },
  LKCMB: { code: "LKCMB", name: "Colombo", lat: 6.94, lng: 79.84, region: "SOUTH_ASIA" },
  EGPSD: { code: "EGPSD", name: "Port Said", lat: 31.26, lng: 32.30, region: "MIDDLE_EAST" },
  BEANR: { code: "BEANR", name: "Antwerp", lat: 51.23, lng: 4.41, region: "EUROPE" },
};

const TRANSSHIPMENT_HUBS: Record<string, string[]> = {
  "EAST_ASIA→EUROPE": ["SGSIN", "LKCMB", "AEJEA"],
  "EAST_ASIA→NORTH_AMERICA": ["KRPUS", "TWKHH"],
  "EAST_ASIA→MIDDLE_EAST": ["SGSIN", "HKHKG"],
  "SE_ASIA→EUROPE": ["LKCMB", "AEJEA"],
  "SE_ASIA→NORTH_AMERICA": ["HKHKG", "KRPUS"],
  "EUROPE→NORTH_AMERICA": ["GBFXT"],
  "EUROPE→EAST_ASIA": ["EGPSD", "SGSIN"],
  "MIDDLE_EAST→EUROPE": ["EGPSD"],
  "SOUTH_ASIA→EUROPE": ["AEJEA", "EGPSD"],
};

const BASE_TRANSIT_DAYS: Record<string, number> = {
  "CNSHA→USLAX": 14,
  "CNSHA→USNYC": 25,
  "CNSHA→NLRTM": 28,
  "CNSHA→DEHAM": 30,
  "CNSHA→GBFXT": 29,
  "CNSZX→USLAX": 16,
  "CNSZX→NLRTM": 26,
  "CNSZX→DEHAM": 28,
  "SGSIN→NLRTM": 22,
  "SGSIN→DEHAM": 24,
  "SGSIN→USLAX": 20,
  "SGSIN→USNYC": 28,
  "HKHKG→USLAX": 15,
  "HKHKG→NLRTM": 27,
  "KRPUS→USLAX": 12,
  "KRPUS→USNYC": 22,
  "JPYOK→USLAX": 11,
  "JPYOK→USNYC": 20,
  "AEJEA→NLRTM": 15,
  "AEJEA→DEHAM": 17,
  "AEJEA→GBFXT": 16,
  "LKCMB→NLRTM": 18,
  "LKCMB→DEHAM": 20,
  "BEANR→USNYC": 12,
  "NLRTM→USNYC": 11,
  "NLRTM→USLAX": 20,
  "DEHAM→USNYC": 12,
};

function lookupPort(portCode: string): PortInfo | null {
  if (!portCode) return null;
  const upper = portCode.toUpperCase().replace(/\s+/g, "");
  if (PORTS[upper]) return PORTS[upper];
  const match = Object.values(PORTS).find(
    (p) => p.name.toUpperCase() === upper || p.code === upper,
  );
  return match || null;
}

function haversineNm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3440.065;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function estimateTransitDays(origin: PortInfo, dest: PortInfo): number {
  const key = `${origin.code}→${dest.code}`;
  if (BASE_TRANSIT_DAYS[key]) return BASE_TRANSIT_DAYS[key];
  const nm = haversineNm(origin.lat, origin.lng, dest.lat, dest.lng);
  const avgSpeedKnots = 14;
  return Math.max(3, Math.round(nm / (avgSpeedKnots * 24)));
}

export function generateRoutes(
  originCode: string,
  destinationCode: string,
): RouteOption[] {
  const origin = lookupPort(originCode);
  const dest = lookupPort(destinationCode);

  if (!origin || !dest) {
    const transitDays = 21;
    return [
      {
        label: `Direct: ${originCode} → ${destinationCode}`,
        type: "DIRECT",
        legs: [
          {
            from: originCode,
            to: destinationCode,
            mode: "Ocean",
            transitDays,
          },
        ],
        totalTransitDays: transitDays,
        advantages: ["Shortest handling time", "Single vessel"],
        disadvantages: ["Limited scheduling flexibility"],
      },
    ];
  }

  const routes: RouteOption[] = [];

  const directDays = estimateTransitDays(origin, dest);
  routes.push({
    label: `Direct: ${origin.name} → ${dest.name}`,
    type: "DIRECT",
    legs: [
      {
        from: origin.code,
        to: dest.code,
        mode: "Ocean",
        transitDays: directDays,
      },
    ],
    totalTransitDays: directDays,
    advantages: [
      "Fastest transit time",
      "No transshipment risk",
      "Single carrier responsibility",
    ],
    disadvantages: [
      "Higher cost on some lanes",
      "Less scheduling flexibility",
    ],
  });

  const laneKey = `${origin.region}→${dest.region}`;
  const hubs = TRANSSHIPMENT_HUBS[laneKey] || [];

  for (const hubCode of hubs.slice(0, 2)) {
    const hub = PORTS[hubCode];
    if (!hub || hub.code === origin.code || hub.code === dest.code) continue;

    const leg1Days = estimateTransitDays(origin, hub);
    const dwellDays = 2;
    const leg2Days = estimateTransitDays(hub, dest);
    const totalDays = leg1Days + dwellDays + leg2Days;

    if (totalDays <= directDays * 1.6) {
      routes.push({
        label: `Via ${hub.name}: ${origin.name} → ${hub.name} → ${dest.name}`,
        type: "TRANSSHIPMENT",
        legs: [
          { from: origin.code, to: hub.code, mode: "Ocean", transitDays: leg1Days },
          { from: hub.code, to: dest.code, mode: "Ocean", transitDays: leg2Days },
        ],
        totalTransitDays: totalDays,
        advantages: [
          "More carrier options",
          "Potentially lower cost",
          `Hub port ${hub.name} has high connectivity`,
        ],
        disadvantages: [
          `+${totalDays - directDays} days vs direct`,
          "Transshipment handling risk",
          `${dwellDays}-day dwell at ${hub.name}`,
        ],
      });
    }
  }

  if (dest.region === "EUROPE" && routes.length < 3) {
    const altEuroPorts: Record<string, string> = {
      NLRTM: "DEHAM",
      DEHAM: "NLRTM",
      GBFXT: "NLRTM",
      BEANR: "NLRTM",
    };
    const altCode = altEuroPorts[dest.code];
    if (altCode && PORTS[altCode]) {
      const altPort = PORTS[altCode];
      const altDays = estimateTransitDays(origin, altPort);
      const lastMileDays = 2;
      routes.push({
        label: `Alt Discharge: ${origin.name} → ${altPort.name} + overland to ${dest.name}`,
        type: "ALTERNATIVE",
        legs: [
          { from: origin.code, to: altPort.code, mode: "Ocean", transitDays: altDays },
          { from: altPort.code, to: dest.code, mode: "Truck/Rail", transitDays: lastMileDays },
        ],
        totalTransitDays: altDays + lastMileDays,
        advantages: [
          `Alternative discharge at ${altPort.name}`,
          "Avoids congestion at destination port",
        ],
        disadvantages: [
          "Additional overland cost",
          "Multi-modal coordination required",
        ],
      });
    }
  }

  if (dest.region === "NORTH_AMERICA" && routes.length < 3) {
    const altUSPorts: Record<string, string> = {
      USLAX: "USNYC",
      USNYC: "USLAX",
    };
    const altCode = altUSPorts[dest.code];
    if (altCode && PORTS[altCode]) {
      const altPort = PORTS[altCode];
      const altDays = estimateTransitDays(origin, altPort);
      const railDays = 5;
      routes.push({
        label: `Alt Port: ${origin.name} → ${altPort.name} + intermodal to ${dest.name}`,
        type: "ALTERNATIVE",
        legs: [
          { from: origin.code, to: altPort.code, mode: "Ocean", transitDays: altDays },
          { from: altPort.code, to: dest.code, mode: "Rail", transitDays: railDays },
        ],
        totalTransitDays: altDays + railDays,
        advantages: [
          `Alternate entry at ${altPort.name}`,
          "May avoid port congestion",
        ],
        disadvantages: [
          "Additional intermodal cost",
          `+${altDays + railDays - routes[0].totalTransitDays} days vs direct`,
        ],
      });
    }
  }

  return routes;
}

export function getPortInfo(code: string): PortInfo | null {
  return lookupPort(code);
}
