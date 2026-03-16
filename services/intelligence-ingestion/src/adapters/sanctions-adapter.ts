import type { IntelligenceAdapter, SanctionsRecord, DeniedPartyRecord } from "./types.js";
import { sanctionsRecordSchema, deniedPartyRecordSchema } from "./types.js";

const SANCTIONS_FIXTURES: SanctionsRecord[] = [
  {
    listName: "OFAC SDN",
    entityName: "IRAN SHIPPING LINES",
    entityType: "organization",
    aliases: ["IRISL", "Islamic Republic of Iran Shipping Lines"],
    country: "IR",
    sanctionProgram: "Iran",
    listingDate: "2008-09-10T00:00:00.000Z",
    identifiers: { imoNumbers: "7632826,7632814" },
    status: "active",
    sourceQuality: 0.99,
  },
  {
    listName: "OFAC SDN",
    entityName: "COSCO SHIPPING (DALIAN)",
    entityType: "organization",
    aliases: ["COSCO Dalian"],
    country: "CN",
    sanctionProgram: "Iran",
    listingDate: "2019-09-25T00:00:00.000Z",
    identifiers: {},
    status: "active",
    sourceQuality: 0.95,
  },
  {
    listName: "EU Consolidated List",
    entityName: "NORTH KOREA MARITIME",
    entityType: "organization",
    aliases: ["DPRK Maritime Corp"],
    country: "KP",
    sanctionProgram: "DPRK",
    listingDate: "2017-06-02T00:00:00.000Z",
    identifiers: {},
    status: "active",
    sourceQuality: 0.98,
  },
  {
    listName: "OFAC SDN",
    entityName: "MV WISE HONEST",
    entityType: "vessel",
    aliases: [],
    country: "KP",
    sanctionProgram: "DPRK",
    listingDate: "2019-05-09T00:00:00.000Z",
    identifiers: { imo: "8514132" },
    status: "active",
    sourceQuality: 0.99,
  },
];

const DENIED_PARTY_FIXTURES: DeniedPartyRecord[] = [
  {
    listName: "BIS Entity List",
    partyName: "HUAWEI TECHNOLOGIES CO LTD",
    partyType: "organization",
    country: "CN",
    address: "Shenzhen, Guangdong",
    reason: "National security concerns",
    aliases: ["Huawei", "HUAWEI DEVICE CO."],
    status: "active",
    sourceQuality: 0.97,
    listingDate: "2019-05-16T00:00:00.000Z",
  },
  {
    listName: "BIS Denied Persons List",
    partyName: "VIKTOR BOUT",
    partyType: "individual",
    country: "RU",
    reason: "Arms trafficking",
    aliases: ["Victor Bout", "Viktor Anatolyevich Bout"],
    status: "active",
    sourceQuality: 0.99,
    listingDate: "2008-03-06T00:00:00.000Z",
  },
];

export class SanctionsAdapter implements IntelligenceAdapter<SanctionsRecord> {
  sourceType = "sanctions";

  async fetch(): Promise<SanctionsRecord[]> {
    return SANCTIONS_FIXTURES;
  }

  validate(records: SanctionsRecord[]) {
    const valid: SanctionsRecord[] = [];
    let invalid = 0;
    for (const r of records) {
      const result = sanctionsRecordSchema.safeParse(r);
      if (result.success) {
        valid.push(result.data);
      } else {
        invalid++;
      }
    }
    return { valid, invalid };
  }
}

export class DeniedPartiesAdapter implements IntelligenceAdapter<DeniedPartyRecord> {
  sourceType = "denied_parties";

  async fetch(): Promise<DeniedPartyRecord[]> {
    return DENIED_PARTY_FIXTURES;
  }

  validate(records: DeniedPartyRecord[]) {
    const valid: DeniedPartyRecord[] = [];
    let invalid = 0;
    for (const r of records) {
      const result = deniedPartyRecordSchema.safeParse(r);
      if (result.success) {
        valid.push(result.data);
      } else {
        invalid++;
      }
    }
    return { valid, invalid };
  }
}
