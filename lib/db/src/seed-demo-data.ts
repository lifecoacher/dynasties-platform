import { db, type DbTransaction } from "./index.js";
import {
  companiesTable,
  usersTable,
  entitiesTable,
  shipmentsTable,
  complianceScreeningsTable,
  riskScoresTable,
  insuranceQuotesTable,
  eventsTable,
} from "./schema/index.js";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";

function genId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeEntityName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

const DEMO_COMPANIES = [
  { id: "cmp_seed_001", name: "Dynasties Global Logistics", slug: "dynasties-global", industry: "Freight Forwarding", country: "United States", tradeLanes: ["Asia-North America", "Asia-Europe", "Europe-North America"], contactEmail: "admin@dynasties.io", contactPhone: "+1-212-555-0100" },
  { id: "cmp_seed_002", name: "Pacific Rim Trading Co", slug: "pacific-rim-trading", industry: "International Trade", country: "Singapore", tradeLanes: ["Asia-Americas", "Intra-Asia", "Asia-Oceania"], contactEmail: "ops@pacificrim.sg", contactPhone: "+65-6555-0200" },
  { id: "cmp_seed_003", name: "EuroFreight Solutions GmbH", slug: "eurofreight-solutions", industry: "Freight Forwarding", country: "Germany", tradeLanes: ["Europe-Asia", "Intra-Europe", "Europe-Middle East"], contactEmail: "dispatch@eurofreight.de", contactPhone: "+49-40-555-0300" },
  { id: "cmp_seed_004", name: "Atlas Supply Chain Partners", slug: "atlas-supply-chain", industry: "Supply Chain Management", country: "United Kingdom", tradeLanes: ["UK-Asia", "UK-Americas", "UK-Africa"], contactEmail: "logistics@atlassc.co.uk", contactPhone: "+44-20-7555-0400" },
  { id: "cmp_seed_005", name: "Mumbai Maritime Services", slug: "mumbai-maritime", industry: "Maritime Logistics", country: "India", tradeLanes: ["India-Middle East", "India-Europe", "India-Southeast Asia"], contactEmail: "bookings@mumbaimaritime.in", contactPhone: "+91-22-5555-0500" },
];

const DEMO_USERS = [
  { companyId: "cmp_seed_001", email: "admin@dynasties.io", name: "Sarah Chen", role: "ADMIN" },
  { companyId: "cmp_seed_001", email: "operator@dynasties.io", name: "Marcus Rodriguez", role: "OPERATOR" },
  { companyId: "cmp_seed_001", email: "viewer@dynasties.io", name: "Emily Thompson", role: "VIEWER" },
  { companyId: "cmp_seed_002", email: "admin@pacificrim.sg", name: "Wei Lin Tan", role: "ADMIN" },
  { companyId: "cmp_seed_002", email: "ops@pacificrim.sg", name: "Akira Yamamoto", role: "OPERATOR" },
  { companyId: "cmp_seed_003", email: "admin@eurofreight.de", name: "Hans Mueller", role: "ADMIN" },
  { companyId: "cmp_seed_003", email: "dispatch@eurofreight.de", name: "Sofia Bianchi", role: "OPERATOR" },
  { companyId: "cmp_seed_004", email: "admin@atlassc.co.uk", name: "James Whitfield", role: "ADMIN" },
  { companyId: "cmp_seed_004", email: "ops@atlassc.co.uk", name: "Priya Patel", role: "OPERATOR" },
  { companyId: "cmp_seed_005", email: "admin@mumbaimaritime.in", name: "Rajesh Sharma", role: "ADMIN" },
  { companyId: "cmp_seed_005", email: "bookings@mumbaimaritime.in", name: "Ananya Desai", role: "OPERATOR" },
];

const DEMO_CUSTOMERS: Array<{ companyId: string; name: string; entityType: string; country: string; email: string; city: string }> = [
  { companyId: "cmp_seed_001", name: "MegaTech Electronics Shenzhen", entityType: "CUSTOMER", country: "China", email: "export@megatech-sz.cn", city: "Shenzhen" },
  { companyId: "cmp_seed_001", name: "Continental Auto Parts GmbH", entityType: "CUSTOMER", country: "Germany", email: "procurement@continental-parts.de", city: "Stuttgart" },
  { companyId: "cmp_seed_001", name: "Sunrise Textiles Bangladesh", entityType: "CUSTOMER", country: "Bangladesh", email: "orders@sunrise-textiles.bd", city: "Dhaka" },
  { companyId: "cmp_seed_001", name: "Golden Gate Importers LLC", entityType: "CUSTOMER", country: "United States", email: "receiving@goldengate-imports.com", city: "San Francisco" },
  { companyId: "cmp_seed_001", name: "Nordic Fish Export AS", entityType: "CUSTOMER", country: "Norway", email: "sales@nordicfish.no", city: "Bergen" },
  { companyId: "cmp_seed_001", name: "Amazon Timber Brazil", entityType: "CUSTOMER", country: "Brazil", email: "logistics@amazontimber.br", city: "Manaus" },
  { companyId: "cmp_seed_001", name: "Seoul Semiconductor Co", entityType: "CUSTOMER", country: "South Korea", email: "export@seoulsemi.kr", city: "Seoul" },
  { companyId: "cmp_seed_001", name: "Dubai Luxury Goods Trading", entityType: "CUSTOMER", country: "United Arab Emirates", email: "ops@dubailuxury.ae", city: "Dubai" },
  { companyId: "cmp_seed_001", name: "Kenya Coffee Cooperative", entityType: "CUSTOMER", country: "Kenya", email: "sales@kenyacoffee.ke", city: "Nairobi" },
  { companyId: "cmp_seed_001", name: "Melbourne Wine Merchants", entityType: "CUSTOMER", country: "Australia", email: "orders@melbwine.au", city: "Melbourne" },
  { companyId: "cmp_seed_002", name: "Shanghai Steel Works", entityType: "CUSTOMER", country: "China", email: "sales@shanghaisteelworks.cn", city: "Shanghai" },
  { companyId: "cmp_seed_002", name: "Bangkok Rubber Industries", entityType: "CUSTOMER", country: "Thailand", email: "export@bangkokrubber.th", city: "Bangkok" },
  { companyId: "cmp_seed_002", name: "Hanoi Furniture Export", entityType: "CUSTOMER", country: "Vietnam", email: "sales@hanoifurniture.vn", city: "Hanoi" },
  { companyId: "cmp_seed_002", name: "Jakarta Palm Oil Corp", entityType: "CUSTOMER", country: "Indonesia", email: "ops@jakartapalm.id", city: "Jakarta" },
  { companyId: "cmp_seed_002", name: "Manila Garment Works", entityType: "CUSTOMER", country: "Philippines", email: "export@manilagarments.ph", city: "Manila" },
  { companyId: "cmp_seed_002", name: "KL Electronics Sdn Bhd", entityType: "CUSTOMER", country: "Malaysia", email: "sales@klelectronics.my", city: "Kuala Lumpur" },
  { companyId: "cmp_seed_002", name: "Tokyo Precision Instruments", entityType: "CUSTOMER", country: "Japan", email: "export@tokyoprecision.jp", city: "Tokyo" },
  { companyId: "cmp_seed_002", name: "Taipei Circuit Board Co", entityType: "CUSTOMER", country: "Taiwan", email: "orders@taipeicircuit.tw", city: "Taipei" },
  { companyId: "cmp_seed_002", name: "Busan Container Services", entityType: "CUSTOMER", country: "South Korea", email: "ops@busancontainer.kr", city: "Busan" },
  { companyId: "cmp_seed_002", name: "Ho Chi Minh Seafood Co", entityType: "CUSTOMER", country: "Vietnam", email: "export@hcmseafood.vn", city: "Ho Chi Minh City" },
  { companyId: "cmp_seed_003", name: "Bavarian Motor Parts AG", entityType: "CUSTOMER", country: "Germany", email: "logistics@bavarianmotor.de", city: "Munich" },
  { companyId: "cmp_seed_003", name: "Lyon Pharmaceuticals SAS", entityType: "CUSTOMER", country: "France", email: "supply@lyonpharma.fr", city: "Lyon" },
  { companyId: "cmp_seed_003", name: "Rotterdam Chemical Trading", entityType: "CUSTOMER", country: "Netherlands", email: "ops@rotchem.nl", city: "Rotterdam" },
  { companyId: "cmp_seed_003", name: "Barcelona Olive Exports", entityType: "CUSTOMER", country: "Spain", email: "sales@barcelonaolive.es", city: "Barcelona" },
  { companyId: "cmp_seed_003", name: "Milan Fashion Group SpA", entityType: "CUSTOMER", country: "Italy", email: "logistics@milanfashion.it", city: "Milan" },
  { companyId: "cmp_seed_003", name: "Athens Marble Industries", entityType: "CUSTOMER", country: "Greece", email: "export@athensmarble.gr", city: "Athens" },
  { companyId: "cmp_seed_003", name: "Istanbul Ceramics Co", entityType: "CUSTOMER", country: "Turkey", email: "sales@istanbulceramics.tr", city: "Istanbul" },
  { companyId: "cmp_seed_003", name: "Warsaw Electronics Dist", entityType: "CUSTOMER", country: "Poland", email: "orders@warsawelec.pl", city: "Warsaw" },
  { companyId: "cmp_seed_003", name: "Antwerp Diamond Trading", entityType: "CUSTOMER", country: "Belgium", email: "ops@antwerpdiamonds.be", city: "Antwerp" },
  { companyId: "cmp_seed_003", name: "Zurich Precision Watches", entityType: "CUSTOMER", country: "Switzerland", email: "export@zurichwatches.ch", city: "Zurich" },
  { companyId: "cmp_seed_004", name: "Manchester Textile Mills", entityType: "CUSTOMER", country: "United Kingdom", email: "orders@manchestertextile.co.uk", city: "Manchester" },
  { companyId: "cmp_seed_004", name: "Edinburgh Whisky Exports", entityType: "CUSTOMER", country: "United Kingdom", email: "sales@edinburghwhisky.co.uk", city: "Edinburgh" },
  { companyId: "cmp_seed_004", name: "Lagos Cocoa Processors", entityType: "CUSTOMER", country: "Nigeria", email: "export@lagoscocoa.ng", city: "Lagos" },
  { companyId: "cmp_seed_004", name: "Cape Town Wines Ltd", entityType: "CUSTOMER", country: "South Africa", email: "sales@capetownwines.za", city: "Cape Town" },
  { companyId: "cmp_seed_004", name: "Toronto Maple Syrup Co", entityType: "CUSTOMER", country: "Canada", email: "export@torontosyrup.ca", city: "Toronto" },
  { companyId: "cmp_seed_004", name: "New York Fashion Imports", entityType: "CUSTOMER", country: "United States", email: "buying@nyfashion.com", city: "New York" },
  { companyId: "cmp_seed_004", name: "Dublin Tech Components", entityType: "CUSTOMER", country: "Ireland", email: "supply@dublintech.ie", city: "Dublin" },
  { companyId: "cmp_seed_004", name: "Casablanca Phosphates SA", entityType: "CUSTOMER", country: "Morocco", email: "export@casaphosphates.ma", city: "Casablanca" },
  { companyId: "cmp_seed_004", name: "Nairobi Tea Estates", entityType: "CUSTOMER", country: "Kenya", email: "sales@nairobiteaestates.ke", city: "Nairobi" },
  { companyId: "cmp_seed_004", name: "Accra Gold Minerals", entityType: "CUSTOMER", country: "Ghana", email: "export@accragold.gh", city: "Accra" },
  { companyId: "cmp_seed_005", name: "Mumbai Spice Trading Co", entityType: "CUSTOMER", country: "India", email: "export@mumbaispice.in", city: "Mumbai" },
  { companyId: "cmp_seed_005", name: "Chennai Auto Components", entityType: "CUSTOMER", country: "India", email: "sales@chennaiauto.in", city: "Chennai" },
  { companyId: "cmp_seed_005", name: "Delhi Pharmaceutical Exports", entityType: "CUSTOMER", country: "India", email: "export@delhipharma.in", city: "New Delhi" },
  { companyId: "cmp_seed_005", name: "Jeddah Import Trading", entityType: "CUSTOMER", country: "Saudi Arabia", email: "ops@jeddahimport.sa", city: "Jeddah" },
  { companyId: "cmp_seed_005", name: "Colombo Tea Corp", entityType: "CUSTOMER", country: "Sri Lanka", email: "export@colombotea.lk", city: "Colombo" },
  { companyId: "cmp_seed_005", name: "Karachi Cotton Mills", entityType: "CUSTOMER", country: "Pakistan", email: "sales@karachicotton.pk", city: "Karachi" },
  { companyId: "cmp_seed_005", name: "Dhaka Garment Export Ltd", entityType: "CUSTOMER", country: "Bangladesh", email: "orders@dhakagarment.bd", city: "Dhaka" },
  { companyId: "cmp_seed_005", name: "Abu Dhabi Construction Supplies", entityType: "CUSTOMER", country: "United Arab Emirates", email: "ops@adconstruction.ae", city: "Abu Dhabi" },
  { companyId: "cmp_seed_005", name: "Muscat Marine Equipment", entityType: "CUSTOMER", country: "Oman", email: "sales@muscatmarine.om", city: "Muscat" },
  { companyId: "cmp_seed_005", name: "Doha Building Materials", entityType: "CUSTOMER", country: "Qatar", email: "procurement@dohabuilding.qa", city: "Doha" },
];

interface ShipmentSeed {
  companyId: string;
  reference: string;
  status: string;
  commodity: string;
  hsCode: string;
  portOfLoading: string;
  portOfDischarge: string;
  vessel: string;
  voyage: string;
  incoterms: string;
  blNumber: string;
  bookingNumber: string;
  grossWeight: string;
  weightUnit: string;
  containerType: string;
  packageCount: number;
  riskScore: number;
  complianceStatus: string;
  insurancePremium: number;
  insuredValue: number;
}

const DEMO_SHIPMENTS: ShipmentSeed[] = [
  { companyId: "cmp_seed_001", reference: "DYN-2026-00138", status: "APPROVED", commodity: "Consumer Electronics - LED Monitors", hsCode: "8528", portOfLoading: "Shenzhen, China", portOfDischarge: "Los Angeles, USA", vessel: "COSCO Shipping Universe", voyage: "COSCO-SH-00138", incoterms: "FOB", blNumber: "COSU6284751900", bookingNumber: "BK-2026-00138", grossWeight: "12500", weightUnit: "KG", containerType: "40HC", packageCount: 480, riskScore: 18, complianceStatus: "CLEAR", insurancePremium: 1250, insuredValue: 285000 },
  { companyId: "cmp_seed_001", reference: "DYN-2026-00147", status: "APPROVED", commodity: "Precision Optical Lenses", hsCode: "9001", portOfLoading: "Shanghai, China", portOfDischarge: "Rotterdam, Netherlands", vessel: "Ever Given", voyage: "EVER-SH-00147", incoterms: "FOB", blNumber: "EISU9384562100", bookingNumber: "BK-2026-00147", grossWeight: "3200", weightUnit: "KG", containerType: "20GP", packageCount: 120, riskScore: 22, complianceStatus: "CLEAR", insurancePremium: 2800, insuredValue: 450000 },
  { companyId: "cmp_seed_001", reference: "DYN-2026-00152", status: "PENDING_REVIEW", commodity: "Industrial Chemical Compounds", hsCode: "3808", portOfLoading: "Bangkok, Thailand", portOfDischarge: "Mumbai, India", vessel: "Evergreen Marine", voyage: "EVER-BKK-00152", incoterms: "CIF", blNumber: "EGLV5829100340", bookingNumber: "BK-2026-00152", grossWeight: "28000", weightUnit: "KG", containerType: "20TK", packageCount: 1, riskScore: 72, complianceStatus: "FLAGGED", insurancePremium: 4200, insuredValue: 180000 },
  { companyId: "cmp_seed_001", reference: "DYN-2026-00201", status: "DRAFT", commodity: "Automotive Brake Components", hsCode: "8708", portOfLoading: "Hamburg, Germany", portOfDischarge: "New York, USA", vessel: "Hapag-Lloyd Express", voyage: "HLCU-HAM-00201", incoterms: "FOB", blNumber: "HLCU2847561000", bookingNumber: "BK-2026-00201", grossWeight: "18500", weightUnit: "KG", containerType: "40GP", packageCount: 340, riskScore: 15, complianceStatus: "CLEAR", insurancePremium: 980, insuredValue: 220000 },
  { companyId: "cmp_seed_001", reference: "DYN-2026-00202", status: "DRAFT", commodity: "Lithium-Ion Battery Packs", hsCode: "8507", portOfLoading: "Shenzhen, China", portOfDischarge: "Long Beach, USA", vessel: "OOCL Hong Kong", voyage: "OOLU-SZ-00202", incoterms: "FOB", blNumber: "OOLU7829345000", bookingNumber: "BK-2026-00202", grossWeight: "8200", weightUnit: "KG", containerType: "20GP", packageCount: 200, riskScore: 55, complianceStatus: "CLEAR", insurancePremium: 3600, insuredValue: 520000 },
  { companyId: "cmp_seed_002", reference: "PRT-2026-00301", status: "APPROVED", commodity: "Structural Steel Beams", hsCode: "7207", portOfLoading: "Shanghai, China", portOfDischarge: "Singapore", vessel: "Yang Ming Cosmos", voyage: "YMLU-SH-00301", incoterms: "CFR", blNumber: "YMLU9284710050", bookingNumber: "BK-PRT-00301", grossWeight: "45000", weightUnit: "KG", containerType: "40FR", packageCount: 25, riskScore: 12, complianceStatus: "CLEAR", insurancePremium: 850, insuredValue: 165000 },
  { companyId: "cmp_seed_002", reference: "PRT-2026-00302", status: "DRAFT", commodity: "Natural Rubber Sheets", hsCode: "4001", portOfLoading: "Laem Chabang, Thailand", portOfDischarge: "Busan, South Korea", vessel: "HMM Algeciras", voyage: "HMM-LCB-00302", incoterms: "FOB", blNumber: "HDMU6183920040", bookingNumber: "BK-PRT-00302", grossWeight: "22000", weightUnit: "KG", containerType: "40GP", packageCount: 80, riskScore: 8, complianceStatus: "CLEAR", insurancePremium: 620, insuredValue: 95000 },
  { companyId: "cmp_seed_002", reference: "PRT-2026-00303", status: "PENDING_REVIEW", commodity: "Frozen Seafood - Shrimp", hsCode: "0306", portOfLoading: "Ho Chi Minh City, Vietnam", portOfDischarge: "Tokyo, Japan", vessel: "ONE Commitment", voyage: "ONE-HCM-00303", incoterms: "CIF", blNumber: "ONEY2847193050", bookingNumber: "BK-PRT-00303", grossWeight: "15000", weightUnit: "KG", containerType: "40RH", packageCount: 600, riskScore: 35, complianceStatus: "CLEAR", insurancePremium: 2100, insuredValue: 310000 },
  { companyId: "cmp_seed_002", reference: "PRT-2026-00304", status: "DRAFT", commodity: "Wooden Furniture - Teak Tables", hsCode: "9403", portOfLoading: "Haiphong, Vietnam", portOfDischarge: "Melbourne, Australia", vessel: "ANL Barwon", voyage: "ANL-HP-00304", incoterms: "FOB", blNumber: "ANLU8291640030", bookingNumber: "BK-PRT-00304", grossWeight: "9800", weightUnit: "KG", containerType: "40HC", packageCount: 45, riskScore: 10, complianceStatus: "CLEAR", insurancePremium: 450, insuredValue: 72000 },
  { companyId: "cmp_seed_003", reference: "EFS-2026-00401", status: "APPROVED", commodity: "Precision Machine Tools", hsCode: "8431", portOfLoading: "Hamburg, Germany", portOfDischarge: "Shanghai, China", vessel: "MSC Oscar", voyage: "MSC-HAM-00401", incoterms: "DAP", blNumber: "MSCU9182730060", bookingNumber: "BK-EFS-00401", grossWeight: "32000", weightUnit: "KG", containerType: "40FR", packageCount: 8, riskScore: 20, complianceStatus: "CLEAR", insurancePremium: 5200, insuredValue: 890000 },
  { companyId: "cmp_seed_003", reference: "EFS-2026-00402", status: "DRAFT", commodity: "Pharmaceutical Tablets - Paracetamol", hsCode: "3004", portOfLoading: "Antwerp, Belgium", portOfDischarge: "Jeddah, Saudi Arabia", vessel: "CMA CGM Marco Polo", voyage: "CMA-ANT-00402", incoterms: "CIF", blNumber: "CMAU7293810040", bookingNumber: "BK-EFS-00402", grossWeight: "5600", weightUnit: "KG", containerType: "20RF", packageCount: 280, riskScore: 28, complianceStatus: "CLEAR", insurancePremium: 1800, insuredValue: 420000 },
  { companyId: "cmp_seed_003", reference: "EFS-2026-00403", status: "PENDING_REVIEW", commodity: "Italian Marble Slabs", hsCode: "6802", portOfLoading: "Genoa, Italy", portOfDischarge: "Dubai (Jebel Ali)", vessel: "Maersk Sealand", voyage: "MAEU-GEN-00403", incoterms: "FOB", blNumber: "MAEU8472910080", bookingNumber: "BK-EFS-00403", grossWeight: "52000", weightUnit: "KG", containerType: "20GP", packageCount: 18, riskScore: 42, complianceStatus: "CLEAR", insurancePremium: 1500, insuredValue: 195000 },
  { companyId: "cmp_seed_003", reference: "EFS-2026-00404", status: "APPROVED", commodity: "Swiss Watch Movements", hsCode: "9101", portOfLoading: "Le Havre, France", portOfDischarge: "New York, USA", vessel: "CMA CGM Bougainville", voyage: "CMA-LH-00404", incoterms: "DDP", blNumber: "CMAU5829340020", bookingNumber: "BK-EFS-00404", grossWeight: "420", weightUnit: "KG", containerType: "20GP", packageCount: 50, riskScore: 30, complianceStatus: "CLEAR", insurancePremium: 8500, insuredValue: 2100000 },
  { companyId: "cmp_seed_004", reference: "ATL-2026-00501", status: "APPROVED", commodity: "Single Malt Scotch Whisky", hsCode: "2208", portOfLoading: "Felixstowe, UK", portOfDischarge: "Singapore", vessel: "MSC Gulsun", voyage: "MSC-FXT-00501", incoterms: "CIF", blNumber: "MSCU6182940070", bookingNumber: "BK-ATL-00501", grossWeight: "14200", weightUnit: "KG", containerType: "20GP", packageCount: 1200, riskScore: 14, complianceStatus: "CLEAR", insurancePremium: 3200, insuredValue: 680000 },
  { companyId: "cmp_seed_004", reference: "ATL-2026-00502", status: "DRAFT", commodity: "Raw Cocoa Beans", hsCode: "1801", portOfLoading: "Lagos, Nigeria", portOfDischarge: "London Gateway, UK", vessel: "Evergreen Ever Act", voyage: "EVER-LAG-00502", incoterms: "FOB", blNumber: "EISU7293810050", bookingNumber: "BK-ATL-00502", grossWeight: "38000", weightUnit: "KG", containerType: "40GP", packageCount: 950, riskScore: 48, complianceStatus: "CLEAR", insurancePremium: 1100, insuredValue: 142000 },
  { companyId: "cmp_seed_004", reference: "ATL-2026-00503", status: "PENDING_REVIEW", commodity: "Conflict-Zone Minerals", hsCode: "2609", portOfLoading: "Mombasa, Kenya", portOfDischarge: "Felixstowe, UK", vessel: "Maersk Alabama", voyage: "MAEU-MOM-00503", incoterms: "FOB", blNumber: "MAEU3918470060", bookingNumber: "BK-ATL-00503", grossWeight: "25000", weightUnit: "KG", containerType: "20GP", packageCount: 60, riskScore: 85, complianceStatus: "FLAGGED", insurancePremium: 6800, insuredValue: 380000 },
  { companyId: "cmp_seed_005", reference: "MMS-2026-00601", status: "APPROVED", commodity: "Basmati Rice Premium Grade", hsCode: "1006", portOfLoading: "Mumbai, India", portOfDischarge: "Jeddah, Saudi Arabia", vessel: "UASC Barzan", voyage: "UASC-BOM-00601", incoterms: "CFR", blNumber: "UASC8291730040", bookingNumber: "BK-MMS-00601", grossWeight: "42000", weightUnit: "KG", containerType: "40HC", packageCount: 2100, riskScore: 6, complianceStatus: "CLEAR", insurancePremium: 380, insuredValue: 58000 },
  { companyId: "cmp_seed_005", reference: "MMS-2026-00602", status: "DRAFT", commodity: "Cotton Yarn - Ring Spun", hsCode: "5205", portOfLoading: "Chennai, India", portOfDischarge: "Ho Chi Minh City, Vietnam", vessel: "Wan Hai 316", voyage: "WH-MAA-00602", incoterms: "FOB", blNumber: "WHLC5918240030", bookingNumber: "BK-MMS-00602", grossWeight: "18000", weightUnit: "KG", containerType: "40GP", packageCount: 400, riskScore: 11, complianceStatus: "CLEAR", insurancePremium: 520, insuredValue: 88000 },
  { companyId: "cmp_seed_005", reference: "MMS-2026-00603", status: "PENDING_REVIEW", commodity: "Controlled Pharmaceutical Precursors", hsCode: "2933", portOfLoading: "Mumbai, India", portOfDischarge: "Istanbul, Turkey", vessel: "ZIM Antwerp", voyage: "ZIM-BOM-00603", incoterms: "CIF", blNumber: "ZIMU7381920050", bookingNumber: "BK-MMS-00603", grossWeight: "3800", weightUnit: "KG", containerType: "20GP", packageCount: 120, riskScore: 78, complianceStatus: "FLAGGED", insurancePremium: 4500, insuredValue: 290000 },
  { companyId: "cmp_seed_005", reference: "MMS-2026-00604", status: "APPROVED", commodity: "Auto Spare Parts - Engine Blocks", hsCode: "8409", portOfLoading: "Chennai, India", portOfDischarge: "Durban, South Africa", vessel: "MSC Sixin", voyage: "MSC-MAA-00604", incoterms: "FOB", blNumber: "MSCU4829170040", bookingNumber: "BK-MMS-00604", grossWeight: "27000", weightUnit: "KG", containerType: "40GP", packageCount: 160, riskScore: 19, complianceStatus: "CLEAR", insurancePremium: 1100, insuredValue: 195000 },
];

export async function seedDemoData() {
  console.log("[seed] Starting demo data seed...");

  const passwordHash = await bcrypt.hash("DynastiesDemo2026!", 12);

  for (const company of DEMO_COMPANIES) {
    const [existing] = await db.select({ id: companiesTable.id }).from(companiesTable).where(eq(companiesTable.id, company.id)).limit(1);
    if (!existing) {
      await db.insert(companiesTable).values({
        ...company,
        settings: {},
      });
      console.log(`[seed] Company created: ${company.name}`);
    } else {
      await db.update(companiesTable).set({
        industry: company.industry,
        country: company.country,
        tradeLanes: company.tradeLanes,
        contactPhone: company.contactPhone,
      }).where(eq(companiesTable.id, company.id));
      console.log(`[seed] Company updated: ${company.name}`);
    }
  }

  for (const user of DEMO_USERS) {
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, user.email)).limit(1);
    if (!existing) {
      await db.insert(usersTable).values({
        id: genId(),
        companyId: user.companyId,
        email: user.email,
        name: user.name,
        passwordHash,
        role: user.role as any,
        isActive: true,
      });
      console.log(`[seed] User created: ${user.email} (${user.role})`);
    }
  }

  for (const customer of DEMO_CUSTOMERS) {
    const normalizedName = normalizeEntityName(customer.name);
    const [existing] = await db.select({ id: entitiesTable.id }).from(entitiesTable)
      .where(and(eq(entitiesTable.normalizedName, normalizedName), eq(entitiesTable.companyId, customer.companyId))).limit(1);
    if (!existing) {
      await db.insert(entitiesTable).values({
        id: genId(),
        companyId: customer.companyId,
        name: customer.name,
        normalizedName,
        entityType: "CUSTOMER",
        status: "VERIFIED",
        country: customer.country,
        city: customer.city,
        contactEmail: customer.email,
      });
    }
  }
  console.log(`[seed] Customers: ${DEMO_CUSTOMERS.length} records`);

  for (const shipment of DEMO_SHIPMENTS) {
    const [existing] = await db.select({ id: shipmentsTable.id }).from(shipmentsTable)
      .where(eq(shipmentsTable.reference, shipment.reference)).limit(1);

    if (existing) {
      console.log(`[seed] Shipment ${shipment.reference} exists, skipping`);
      continue;
    }

    const shipmentId = genId();
    const now = new Date();
    const createdOffset = Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000);
    const createdAt = new Date(now.getTime() - createdOffset);

    await db.transaction(async (tx: DbTransaction) => {
      await tx.insert(shipmentsTable).values({
        id: shipmentId,
        companyId: shipment.companyId,
        reference: shipment.reference,
        status: shipment.status as any,
        commodity: shipment.commodity,
        hsCode: shipment.hsCode,
        portOfLoading: shipment.portOfLoading,
        portOfDischarge: shipment.portOfDischarge,
        vessel: shipment.vessel,
        voyage: shipment.voyage,
        incoterms: shipment.incoterms,
        blNumber: shipment.blNumber,
        bookingNumber: shipment.bookingNumber,
        grossWeight: shipment.grossWeight,
        weightUnit: shipment.weightUnit,
        containerType: shipment.containerType,
        packageCount: shipment.packageCount,
        extractionConfidence: 0.92,
        createdAt,
      });

      await tx.insert(eventsTable).values({
        id: genId(),
        companyId: shipment.companyId,
        eventType: "SHIPMENT_CREATED",
        entityType: "shipment",
        entityId: shipmentId,
        actorType: "SERVICE",
        metadata: { reference: shipment.reference },
        createdAt,
      });

      await tx.insert(complianceScreeningsTable).values({
        id: genId(),
        companyId: shipment.companyId,
        shipmentId,
        status: shipment.complianceStatus as any,
        matchCount: shipment.complianceStatus === "FLAGGED" ? 2 : 0,
        screenedParties: 3,
        listsChecked: ["OFAC-SDN", "EU-CONSOLIDATED", "UN-SANCTIONS"],
        matches: shipment.complianceStatus === "FLAGGED"
          ? [{ entity: "Possible match", list: "OFAC-SDN", score: 0.72, determination: "POSSIBLE_MATCH" }]
          : [],
        screenedAt: new Date(createdAt.getTime() + 2000),
        createdAt: new Date(createdAt.getTime() + 2000),
      });

      await tx.insert(eventsTable).values({
        id: genId(),
        companyId: shipment.companyId,
        eventType: "COMPLIANCE_SCREENED",
        entityType: "shipment",
        entityId: shipmentId,
        actorType: "SERVICE",
        metadata: { status: shipment.complianceStatus },
        createdAt: new Date(createdAt.getTime() + 2000),
      });

      const subScores = {
        cargoType: Math.min(100, shipment.riskScore + Math.floor(Math.random() * 10)),
        tradeLane: Math.min(100, shipment.riskScore + Math.floor(Math.random() * 15)),
        counterparty: shipment.complianceStatus === "FLAGGED" ? shipment.riskScore + 10 : Math.max(0, shipment.riskScore - 5),
        routeGeopolitical: Math.max(0, shipment.riskScore + Math.floor(Math.random() * 8) - 4),
        seasonal: Math.max(0, shipment.riskScore - Math.floor(Math.random() * 10)),
        documentCompleteness: Math.max(0, 100 - shipment.riskScore - Math.floor(Math.random() * 10)),
      };

      await tx.insert(riskScoresTable).values({
        id: genId(),
        companyId: shipment.companyId,
        shipmentId,
        compositeScore: shipment.riskScore,
        recommendedAction: shipment.riskScore >= 60 ? "ESCALATE" : shipment.riskScore >= 30 ? "OPERATOR_REVIEW" : "AUTO_APPROVE",
        subScores,
        scoredAt: new Date(createdAt.getTime() + 3000),
        primaryRiskFactors: shipment.riskScore >= 60
          ? [{ factor: "High-risk trade corridor", explanation: "This route has elevated regulatory scrutiny" }, { factor: "Commodity sensitivity", explanation: "Cargo type requires enhanced due diligence" }]
          : shipment.riskScore >= 30
            ? [{ factor: "Moderate route congestion", explanation: "Transit delays possible on this corridor" }]
            : [{ factor: "Established trade lane", explanation: "Well-documented route with reliable carriers" }],
        createdAt: new Date(createdAt.getTime() + 3000),
      });

      await tx.insert(eventsTable).values({
        id: genId(),
        companyId: shipment.companyId,
        eventType: "RISK_SCORED",
        entityType: "shipment",
        entityId: shipmentId,
        actorType: "SERVICE",
        metadata: { compositeScore: shipment.riskScore },
        createdAt: new Date(createdAt.getTime() + 3000),
      });

      await tx.insert(insuranceQuotesTable).values({
        id: genId(),
        companyId: shipment.companyId,
        shipmentId,
        coverageType: shipment.riskScore >= 60 ? "NAMED_PERILS" : "ALL_RISK",
        estimatedInsuredValue: String(shipment.insuredValue),
        estimatedPremium: String(shipment.insurancePremium),
        currency: "USD",
        coverageRationale: `Marine cargo ${shipment.riskScore >= 60 ? "extended" : "standard"} coverage for ${shipment.commodity} via ${shipment.incoterms} from ${shipment.portOfLoading} to ${shipment.portOfDischarge}.`,
        exclusions: shipment.riskScore >= 60
          ? ["War & terrorism (unless separately endorsed)", "Inherent vice or nature of goods", "Sanctions-related losses"]
          : ["War & terrorism", "Inherent vice"],
        confidenceScore: shipment.riskScore >= 60 ? 0.78 : 0.94,
        quotedAt: new Date(createdAt.getTime() + 3500),
        createdAt: new Date(createdAt.getTime() + 3500),
      });

      await tx.insert(eventsTable).values({
        id: genId(),
        companyId: shipment.companyId,
        eventType: "INSURANCE_QUOTED",
        entityType: "shipment",
        entityId: shipmentId,
        actorType: "SERVICE",
        metadata: { premium: shipment.insurancePremium, currency: "USD" },
        createdAt: new Date(createdAt.getTime() + 3500),
      });

      if (shipment.status === "APPROVED") {
        await tx.insert(eventsTable).values({
          id: genId(),
          companyId: shipment.companyId,
          eventType: "SHIPMENT_APPROVED",
          entityType: "shipment",
          entityId: shipmentId,
          actorType: "USER",
          metadata: {},
          createdAt: new Date(createdAt.getTime() + 86400000),
        });
      }
    });

    console.log(`[seed] Shipment created: ${shipment.reference} (${shipment.status})`);
  }

  console.log("[seed] Demo data seeding complete.");
}
