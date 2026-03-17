export interface PortCoords {
  lat: number;
  lng: number;
  name: string;
}

const PORT_COORDINATES: Record<string, PortCoords> = {
  CNSHA: { lat: 31.23, lng: 121.47, name: "Shanghai" },
  CNSZX: { lat: 22.54, lng: 114.05, name: "Shenzhen" },
  SGSIN: { lat: 1.26, lng: 103.84, name: "Singapore" },
  NLRTM: { lat: 51.91, lng: 4.48, name: "Rotterdam" },
  DEHAM: { lat: 53.55, lng: 9.99, name: "Hamburg" },
  USLAX: { lat: 33.74, lng: -118.27, name: "Los Angeles" },
  USNYC: { lat: 40.68, lng: -74.04, name: "New York" },
  AEJEA: { lat: 25.01, lng: 55.06, name: "Jebel Ali" },
  JPYOK: { lat: 35.44, lng: 139.64, name: "Yokohama" },
  GBFXT: { lat: 51.96, lng: 1.35, name: "Felixstowe" },
  HKHKG: { lat: 22.30, lng: 114.16, name: "Hong Kong" },
  KRPUS: { lat: 35.10, lng: 129.04, name: "Busan" },
  TWKHH: { lat: 22.62, lng: 120.30, name: "Kaohsiung" },
  MYPKG: { lat: 2.99, lng: 101.39, name: "Port Klang" },
  LKCMB: { lat: 6.94, lng: 79.84, name: "Colombo" },
  EGPSD: { lat: 31.26, lng: 32.30, name: "Port Said" },
  BEANR: { lat: 51.23, lng: 4.41, name: "Antwerp" },
};

export function getPortCoordinates(portCode: string): PortCoords | null {
  return PORT_COORDINATES[portCode] || null;
}

export function getAllPortCoordinates(): Record<string, PortCoords> {
  return { ...PORT_COORDINATES };
}
