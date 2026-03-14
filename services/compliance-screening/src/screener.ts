import { normalizeEntityName } from "@workspace/shared-utils";

export interface ScreenPartyInput {
  entityId: string;
  name: string;
  entityType: string;
  country?: string | null;
}

export interface ScreenMatch {
  listName: string;
  matchedEntry: string;
  similarity: number;
  matchType: string;
  recommendation: string;
}

export interface ScreenResult {
  status: "CLEAR" | "ALERT" | "BLOCKED";
  screenedParties: number;
  matchCount: number;
  matches: ScreenMatch[];
  listsChecked: string[];
  ambiguousMatches: AmbiguousMatch[];
}

export interface AmbiguousMatch {
  entityId: string;
  entityName: string;
  listName: string;
  matchedEntry: string;
  similarity: number;
}

const SANCTIONS_LISTS: Record<string, string[]> = {
  "OFAC SDN": [
    "BANK OF DANDONG",
    "KOREA MINING DEVELOPMENT TRADING CORPORATION",
    "ISLAMIC REVOLUTIONARY GUARD CORPS",
    "RUSSIAN DIRECT INVESTMENT FUND",
    "ROSOBORONEXPORT",
    "NORTH KOREA SHIPPING CORP",
    "SYRIA SCIENTIFIC STUDIES AND RESEARCH CENTER",
    "HUAWEI CLOUD COMPUTING TECHNOLOGIES",
    "IRAN ELECTRONICS INDUSTRIES",
    "WAGNER GROUP",
  ],
  "EU SANCTIONS": [
    "SBERBANK OF RUSSIA",
    "VTB BANK",
    "GAZPROMBANK",
    "RUSSIAN AGRICULTURAL BANK",
    "PROMSVYAZBANK",
    "RUSSIAN RAILWAYS",
    "SOVCOMFLOT",
    "BELARUSIAN POTASH COMPANY",
    "BELARUSKALI",
    "MYANMAR OIL AND GAS ENTERPRISE",
  ],
  "UN CONSOLIDATED": [
    "KOREA RYONBONG GENERAL CORPORATION",
    "GREEN PINE ASSOCIATED CORPORATION",
    "OCEAN MARITIME MANAGEMENT COMPANY",
    "AL-QAIDA",
    "ISLAMIC STATE IN IRAQ AND THE LEVANT",
    "BOKO HARAM",
    "HOUTHIS",
    "NATIONAL LIBERATION FRONT",
    "HAQQANI NETWORK",
    "LASHKAR-E-TAYYIBA",
  ],
};

const HIGH_RISK_COUNTRIES = new Set([
  "NORTH KOREA", "DPRK", "IRAN", "SYRIA", "CUBA", "CRIMEA",
  "DONETSK", "LUHANSK", "BELARUS", "MYANMAR", "RUSSIA",
  "AFGHANISTAN", "IRAQ", "LIBYA", "SOMALIA", "SUDAN", "YEMEN",
  "SOUTH SUDAN", "CENTRAL AFRICAN REPUBLIC", "DEMOCRATIC REPUBLIC OF THE CONGO",
  "ERITREA", "LEBANON", "MALI", "NICARAGUA", "VENEZUELA", "ZIMBABWE",
]);

function levenshteinSimilarity(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb === 0 ? 1 : 0;
  if (lb === 0) return 0;

  const matrix: number[][] = [];
  for (let i = 0; i <= la; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= lb; j++) {
    matrix[0]![j] = j;
  }
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      );
    }
  }
  const distance = matrix[la]![lb]!;
  return 1 - distance / Math.max(la, lb);
}

export function screenParties(parties: ScreenPartyInput[]): ScreenResult {
  const matches: ScreenMatch[] = [];
  const ambiguousMatches: AmbiguousMatch[] = [];
  const listsChecked = Object.keys(SANCTIONS_LISTS);

  for (const party of parties) {
    const normalizedParty = normalizeEntityName(party.name).toUpperCase();

    if (party.country) {
      const countryUpper = party.country.toUpperCase();
      if (HIGH_RISK_COUNTRIES.has(countryUpper)) {
        matches.push({
          listName: "HIGH_RISK_COUNTRIES",
          matchedEntry: party.country,
          similarity: 1.0,
          matchType: "country_risk",
          recommendation: "REVIEW",
        });
      }
    }

    for (const [listName, entries] of Object.entries(SANCTIONS_LISTS)) {
      for (const entry of entries) {
        const normalizedEntry = entry.toLowerCase();

        if (normalizedParty === normalizedEntry) {
          matches.push({
            listName,
            matchedEntry: entry,
            similarity: 1.0,
            matchType: "exact",
            recommendation: "BLOCK",
          });
          continue;
        }

        const similarity = levenshteinSimilarity(normalizedParty, normalizedEntry);

        if (similarity >= 0.9) {
          matches.push({
            listName,
            matchedEntry: entry,
            similarity,
            matchType: "fuzzy_high",
            recommendation: "BLOCK",
          });
        } else if (similarity >= 0.75) {
          ambiguousMatches.push({
            entityId: party.entityId,
            entityName: party.name,
            listName,
            matchedEntry: entry,
            similarity,
          });
        }
      }
    }
  }

  let status: "CLEAR" | "ALERT" | "BLOCKED";
  if (matches.some((m) => m.recommendation === "BLOCK")) {
    status = "BLOCKED";
  } else if (matches.length > 0 || ambiguousMatches.length > 0) {
    status = "ALERT";
  } else {
    status = "CLEAR";
  }

  return {
    status,
    screenedParties: parties.length,
    matchCount: matches.length,
    matches,
    listsChecked,
    ambiguousMatches,
  };
}
