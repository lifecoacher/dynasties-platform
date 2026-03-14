import { db } from "@workspace/db";
import { entitiesTable, eventsTable } from "@workspace/db/schema";
import { generateId, normalizeEntityName } from "@workspace/shared-utils";
import { matchEntity, type MatchResult } from "./matcher.js";

export { matchEntity } from "./matcher.js";

export interface PartyInput {
  rawName: string;
  entityType: "SHIPPER" | "CONSIGNEE" | "NOTIFY_PARTY" | "CARRIER";
  address?: string;
}

export interface ResolvedParty {
  entityId: string;
  name: string;
  entityType: string;
  matchType: "exact" | "normalized" | "fuzzy" | "created";
  confidence: number;
  isNew: boolean;
}

export interface EntityResolutionResult {
  parties: Record<string, ResolvedParty>;
  newEntitiesCreated: number;
  matchedEntities: number;
}

function extractAddress(rawName: string): { name: string; address: string | null } {
  const commaIdx = rawName.indexOf(",");
  if (commaIdx === -1) return { name: rawName.trim(), address: null };

  const name = rawName.slice(0, commaIdx).trim();
  const address = rawName.slice(commaIdx + 1).trim();
  return { name, address: address || null };
}

export async function resolveParties(
  parties: PartyInput[],
  companyId: string,
): Promise<EntityResolutionResult> {
  const result: Record<string, ResolvedParty> = {};
  let newCount = 0;
  let matchedCount = 0;

  for (const party of parties) {
    const { name: cleanName, address: parsedAddress } = extractAddress(party.rawName);
    const address = party.address || parsedAddress;

    const match: MatchResult = await matchEntity(cleanName, party.entityType, companyId);

    if (match.matched && match.entityId) {
      result[party.entityType] = {
        entityId: match.entityId,
        name: match.candidates[0]?.name || cleanName,
        entityType: party.entityType,
        matchType: match.matchType === "none" ? "created" : match.matchType,
        confidence: match.confidence,
        isNew: false,
      };
      matchedCount++;

      await db.insert(eventsTable).values({
        id: generateId(),
        companyId,
        eventType: "ENTITY_RESOLVED",
        entityType: "entity",
        entityId: match.entityId,
        metadata: {
          rawName: party.rawName,
          matchType: match.matchType,
          confidence: match.confidence,
          candidateCount: match.candidates.length,
        },
      });
    } else {
      const entityId = generateId();
      const normalizedName = normalizeEntityName(cleanName);

      await db.insert(entitiesTable).values({
        id: entityId,
        companyId,
        name: cleanName,
        normalizedName,
        entityType: party.entityType,
        status: "UNVERIFIED",
        address: address || undefined,
      });

      result[party.entityType] = {
        entityId,
        name: cleanName,
        entityType: party.entityType,
        matchType: "created",
        confidence: 0,
        isNew: true,
      };
      newCount++;

      await db.insert(eventsTable).values({
        id: generateId(),
        companyId,
        eventType: "ENTITY_CREATED",
        entityType: "entity",
        entityId,
        metadata: {
          rawName: party.rawName,
          name: cleanName,
          normalizedName,
          type: party.entityType,
          fuzzyCandidates: match.candidates.length,
        },
      });
    }
  }

  return {
    parties: result,
    newEntitiesCreated: newCount,
    matchedEntities: matchedCount,
  };
}
