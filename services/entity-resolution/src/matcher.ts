import { db } from "@workspace/db";
import { entitiesTable } from "@workspace/db/schema";
import { eq, and, ilike } from "drizzle-orm";
import { normalizeEntityName } from "@workspace/shared-utils";

export interface MatchCandidate {
  id: string;
  name: string;
  normalizedName: string;
  entityType: string;
  matchType: "exact" | "normalized" | "fuzzy";
  score: number;
}

export interface MatchResult {
  matched: boolean;
  entityId: string | null;
  candidates: MatchCandidate[];
  matchType: "exact" | "normalized" | "fuzzy" | "none";
  confidence: number;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

const FUZZY_THRESHOLD = 0.8;

export async function matchEntity(
  rawName: string,
  entityType: string,
  companyId: string,
): Promise<MatchResult> {
  const normalizedInput = normalizeEntityName(rawName);

  const exactMatches = await db
    .select()
    .from(entitiesTable)
    .where(
      and(
        eq(entitiesTable.companyId, companyId),
        eq(entitiesTable.entityType, entityType as typeof entitiesTable.entityType.enumValues[number]),
        ilike(entitiesTable.name, rawName.trim()),
      ),
    )
    .limit(5);

  if (exactMatches.length > 0) {
    return {
      matched: true,
      entityId: exactMatches[0].id,
      candidates: exactMatches.map((e) => ({
        id: e.id,
        name: e.name,
        normalizedName: e.normalizedName,
        entityType: e.entityType,
        matchType: "exact" as const,
        score: 1.0,
      })),
      matchType: "exact",
      confidence: 1.0,
    };
  }

  const normalizedMatches = await db
    .select()
    .from(entitiesTable)
    .where(
      and(
        eq(entitiesTable.companyId, companyId),
        eq(entitiesTable.entityType, entityType as typeof entitiesTable.entityType.enumValues[number]),
        eq(entitiesTable.normalizedName, normalizedInput),
      ),
    )
    .limit(5);

  if (normalizedMatches.length > 0) {
    return {
      matched: true,
      entityId: normalizedMatches[0].id,
      candidates: normalizedMatches.map((e) => ({
        id: e.id,
        name: e.name,
        normalizedName: e.normalizedName,
        entityType: e.entityType,
        matchType: "normalized" as const,
        score: 0.95,
      })),
      matchType: "normalized",
      confidence: 0.95,
    };
  }

  const allEntities = await db
    .select()
    .from(entitiesTable)
    .where(
      and(
        eq(entitiesTable.companyId, companyId),
        eq(entitiesTable.entityType, entityType as typeof entitiesTable.entityType.enumValues[number]),
      ),
    )
    .limit(200);

  const fuzzyCandidates: MatchCandidate[] = [];
  for (const entity of allEntities) {
    const score = similarity(normalizedInput, entity.normalizedName);
    if (score >= FUZZY_THRESHOLD) {
      fuzzyCandidates.push({
        id: entity.id,
        name: entity.name,
        normalizedName: entity.normalizedName,
        entityType: entity.entityType,
        matchType: "fuzzy",
        score,
      });
    }
  }

  fuzzyCandidates.sort((a, b) => b.score - a.score);

  if (fuzzyCandidates.length > 0 && fuzzyCandidates[0].score >= 0.9) {
    return {
      matched: true,
      entityId: fuzzyCandidates[0].id,
      candidates: fuzzyCandidates.slice(0, 5),
      matchType: "fuzzy",
      confidence: fuzzyCandidates[0].score,
    };
  }

  if (fuzzyCandidates.length > 0) {
    return {
      matched: false,
      entityId: null,
      candidates: fuzzyCandidates.slice(0, 5),
      matchType: "fuzzy",
      confidence: fuzzyCandidates[0].score,
    };
  }

  return {
    matched: false,
    entityId: null,
    candidates: [],
    matchType: "none",
    confidence: 0,
  };
}
