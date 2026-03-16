export const LORIAN_TENANT_ID = "tenant_lorian_demo";
export const LORIAN_COMPANY_ID = "cmp_lorian_001";
export const SEED_SOURCE = "lorian_demo_dataset";
export const SEED_VERSION = "v1";

export const USERS = {
  admin: { id: "usr_lor_admin", email: "admin@lorian.demo", name: "Anika Patel", role: "ADMIN" as const },
  manager: { id: "usr_lor_mgr", email: "manager@lorian.demo", name: "James Thornton", role: "MANAGER" as const },
  operator: { id: "usr_lor_ops", email: "ops@lorian.demo", name: "Chen Wei", role: "OPERATOR" as const },
  viewer: { id: "usr_lor_view", email: "viewer@lorian.demo", name: "Sofia Reyes", role: "VIEWER" as const },
};

export const PASSWORD = "LorianDemo2026!";

export const PORTS = [
  { code: "CNSHA", name: "Shanghai", country: "China", region: "East Asia" },
  { code: "CNSZX", name: "Shenzhen", country: "China", region: "East Asia" },
  { code: "SGSIN", name: "Singapore", country: "Singapore", region: "Southeast Asia" },
  { code: "NLRTM", name: "Rotterdam", country: "Netherlands", region: "Europe" },
  { code: "DEHAM", name: "Hamburg", country: "Germany", region: "Europe" },
  { code: "USLAX", name: "Los Angeles", country: "United States", region: "North America" },
  { code: "USNYC", name: "New York", country: "United States", region: "North America" },
  { code: "AEJEA", name: "Jebel Ali", country: "UAE", region: "Middle East" },
  { code: "JPYOK", name: "Yokohama", country: "Japan", region: "East Asia" },
  { code: "GBFXT", name: "Felixstowe", country: "United Kingdom", region: "Europe" },
];

export const CARRIERS = [
  { name: "MAERSK", full: "Maersk Line" },
  { name: "MSC", full: "Mediterranean Shipping Company" },
  { name: "COSCO", full: "COSCO Shipping Lines" },
  { name: "CMA_CGM", full: "CMA CGM Group" },
  { name: "HAPAG", full: "Hapag-Lloyd" },
  { name: "EVERGREEN", full: "Evergreen Marine Corp" },
  { name: "ONE", full: "Ocean Network Express" },
  { name: "ZIM", full: "ZIM Integrated Shipping" },
];

export const TRADE_LANES = [
  { origin: "CNSHA", destination: "USLAX", label: "Shanghai → Los Angeles" },
  { origin: "CNSZX", destination: "NLRTM", label: "Shenzhen → Rotterdam" },
  { origin: "CNSHA", destination: "NLRTM", label: "Shanghai → Rotterdam" },
  { origin: "SGSIN", destination: "USNYC", label: "Singapore → New York" },
  { origin: "DEHAM", destination: "CNSHA", label: "Hamburg → Shanghai" },
  { origin: "CNSHA", destination: "AEJEA", label: "Shanghai → Jebel Ali" },
  { origin: "JPYOK", destination: "USLAX", label: "Yokohama → Los Angeles" },
  { origin: "GBFXT", destination: "SGSIN", label: "Felixstowe → Singapore" },
  { origin: "CNSZX", destination: "DEHAM", label: "Shenzhen → Hamburg" },
  { origin: "SGSIN", destination: "AEJEA", label: "Singapore → Jebel Ali" },
];

export const SHIPPERS = [
  { id: "ent_lor_ship_01", name: "Shenzhen MegaTech Electronics", type: "SHIPPER", country: "China", city: "Shenzhen" },
  { id: "ent_lor_ship_02", name: "Shanghai Precision Optics Co", type: "SHIPPER", country: "China", city: "Shanghai" },
  { id: "ent_lor_ship_03", name: "Yokohama Auto Parts Ltd", type: "SHIPPER", country: "Japan", city: "Yokohama" },
  { id: "ent_lor_ship_04", name: "Hamburg Industrial Machinery GmbH", type: "SHIPPER", country: "Germany", city: "Hamburg" },
  { id: "ent_lor_ship_05", name: "Singapore Polymer Sciences Pte", type: "SHIPPER", country: "Singapore", city: "Singapore" },
  { id: "ent_lor_ship_06", name: "Guangzhou Textile Export Corp", type: "SHIPPER", country: "China", city: "Guangzhou" },
];

export const CONSIGNEES = [
  { id: "ent_lor_cons_01", name: "Pacific Coast Importers LLC", type: "CONSIGNEE", country: "United States", city: "Los Angeles" },
  { id: "ent_lor_cons_02", name: "European Distribution Hub BV", type: "CONSIGNEE", country: "Netherlands", city: "Rotterdam" },
  { id: "ent_lor_cons_03", name: "Atlantic Trade Partners Inc", type: "CONSIGNEE", country: "United States", city: "New York" },
  { id: "ent_lor_cons_04", name: "Gulf Logistics Trading FZE", type: "CONSIGNEE", country: "UAE", city: "Dubai" },
  { id: "ent_lor_cons_05", name: "London Import Consortium Ltd", type: "CONSIGNEE", country: "United Kingdom", city: "London" },
  { id: "ent_lor_cons_06", name: "Bavaria Industrial Supplies AG", type: "CONSIGNEE", country: "Germany", city: "Munich" },
];

export const SANCTIONS_ENTITIES_DATA = [
  { name: "Crimson Shell Trading FZE", type: "organization" as const, country: "UAE", program: "OFAC SDN", list: "OFAC" },
  { name: "Viktor Petrov", type: "individual" as const, country: "Russia", program: "EU Russia Sanctions", list: "EU Consolidated" },
  { name: "Jade Dragon Shipping Ltd", type: "organization" as const, country: "Myanmar", program: "OFAC Myanmar", list: "OFAC" },
];

export function lid(prefix: string, n: number): string {
  return `${prefix}_lor_${String(n).padStart(3, "0")}`;
}

export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86400000);
}

export function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 3600000);
}

export function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86400000);
}
