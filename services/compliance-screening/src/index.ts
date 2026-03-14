import { db } from "@workspace/db";
import {
  complianceScreeningsTable,
  eventsTable,
  shipmentsTable,
  entitiesTable,
} from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { generateId } from "@workspace/shared-utils";
import { screenParties, type ScreenPartyInput } from "./screener.js";
import { runComplianceAgent } from "./agent.js";
import { validateComplianceOutput, type ComplianceResolution } from "./validator.js";

export interface ComplianceResult {
  screeningId: string | null;
  status: "CLEAR" | "ALERT" | "BLOCKED";
  matchCount: number;
  agentResolutions: ComplianceResolution[];
  success: boolean;
  error: string | null;
}

export async function runComplianceScreening(
  shipmentId: string,
  companyId: string,
): Promise<ComplianceResult> {
  console.log(`[compliance] starting screening for shipment=${shipmentId}`);

  const [shipment] = await db
    .select()
    .from(shipmentsTable)
    .where(eq(shipmentsTable.id, shipmentId))
    .limit(1);

  if (!shipment || shipment.companyId !== companyId) {
    return {
      screeningId: null,
      status: "CLEAR",
      matchCount: 0,
      agentResolutions: [],
      success: false,
      error: "Shipment not found or company mismatch",
    };
  }

  const existing = await db
    .select({ id: complianceScreeningsTable.id })
    .from(complianceScreeningsTable)
    .where(eq(complianceScreeningsTable.shipmentId, shipmentId))
    .limit(1);

  if (existing.length > 0) {
    console.log(`[compliance] screening already exists for shipment=${shipmentId}, skipping`);
    return {
      screeningId: existing[0]!.id,
      status: "CLEAR",
      matchCount: 0,
      agentResolutions: [],
      success: true,
      error: null,
    };
  }

  const partyIds = [shipment.shipperId, shipment.consigneeId, shipment.notifyPartyId, shipment.carrierId].filter(
    (id): id is string => id !== null,
  );

  const parties: ScreenPartyInput[] = [];
  for (const partyId of partyIds) {
    const [entity] = await db
      .select()
      .from(entitiesTable)
      .where(and(eq(entitiesTable.id, partyId), eq(entitiesTable.companyId, companyId)))
      .limit(1);

    if (entity) {
      parties.push({
        entityId: entity.id,
        name: entity.name,
        entityType: entity.entityType,
        country: entity.country,
      });
    }
  }

  if (parties.length === 0) {
    console.log(`[compliance] no parties to screen for shipment=${shipmentId}`);
    const screeningId = generateId();
    await db.insert(complianceScreeningsTable).values({
      id: screeningId,
      companyId,
      shipmentId,
      status: "CLEAR",
      screenedParties: 0,
      matchCount: 0,
      matches: [],
      listsChecked: [],
      screenedAt: new Date(),
    });

    await db.insert(eventsTable).values({
    actorType: "SERVICE",
      id: generateId(),
      companyId,
      eventType: "COMPLIANCE_SCREENED",
      entityType: "shipment",
      entityId: shipmentId,
      serviceId: "compliance-screening",
      metadata: {
        screeningId,
        status: "CLEAR",
        screenedParties: 0,
        matchCount: 0,
        listsChecked: [],
      },
    });

    return {
      screeningId,
      status: "CLEAR",
      matchCount: 0,
      agentResolutions: [],
      success: true,
      error: null,
    };
  }

  const screenResult = screenParties(parties);

  let agentResolutions: ComplianceResolution[] = [];

  if (screenResult.ambiguousMatches.length > 0) {
    console.log(
      `[compliance] ${screenResult.ambiguousMatches.length} ambiguous matches, consulting agent`,
    );

    try {
      const agentOutput = await runComplianceAgent(screenResult.ambiguousMatches);
      const validation = validateComplianceOutput(agentOutput.raw);

      if (validation.valid) {
        agentResolutions = validation.data;

        for (const resolution of agentResolutions) {
          if (resolution.recommendation === "BLOCK") {
            screenResult.matches.push({
              listName: resolution.listName,
              matchedEntry: resolution.matchedEntry,
              similarity: 0.8,
              matchType: "agent_confirmed",
              recommendation: "BLOCK",
            });
          } else if (resolution.recommendation === "FLAG_FOR_REVIEW") {
            screenResult.matches.push({
              listName: resolution.listName,
              matchedEntry: resolution.matchedEntry,
              similarity: 0.8,
              matchType: "agent_flagged",
              recommendation: "REVIEW",
            });
          }
        }

        if (screenResult.matches.some((m) => m.recommendation === "BLOCK")) {
          screenResult.status = "BLOCKED";
        } else if (screenResult.matches.length > 0) {
          screenResult.status = "ALERT";
        }

        screenResult.matchCount = screenResult.matches.length;
      } else {
        console.log(`[compliance] agent validation failed: ${validation.errors.join("; ")}`);
        screenResult.status = "ALERT";
        screenResult.matches.push(
          ...screenResult.ambiguousMatches.map((m) => ({
            listName: m.listName,
            matchedEntry: m.matchedEntry,
            similarity: m.similarity,
            matchType: "ambiguous_unresolved",
            recommendation: "REVIEW",
          })),
        );
        screenResult.matchCount = screenResult.matches.length;
      }
    } catch (err) {
      console.error("[compliance] agent error, treating ambiguous as alerts:", err);
      screenResult.status = "ALERT";
      screenResult.matches.push(
        ...screenResult.ambiguousMatches.map((m) => ({
          listName: m.listName,
          matchedEntry: m.matchedEntry,
          similarity: m.similarity,
          matchType: "ambiguous_unresolved",
          recommendation: "REVIEW",
        })),
      );
      screenResult.matchCount = screenResult.matches.length;
    }
  }

  const screeningId = generateId();

  await db.insert(complianceScreeningsTable).values({
    id: screeningId,
    companyId,
    shipmentId,
    status: screenResult.status,
    screenedParties: screenResult.screenedParties,
    matchCount: screenResult.matchCount,
    matches: screenResult.matches,
    listsChecked: screenResult.listsChecked,
    screenedAt: new Date(),
  });

  await db.insert(eventsTable).values({
    actorType: "SERVICE",
    id: generateId(),
    companyId,
    eventType: "COMPLIANCE_SCREENED",
    entityType: "shipment",
    entityId: shipmentId,
    serviceId: "compliance-screening",
    metadata: {
      screeningId,
      status: screenResult.status,
      screenedParties: screenResult.screenedParties,
      matchCount: screenResult.matchCount,
      listsChecked: screenResult.listsChecked,
    },
  });

  if (screenResult.status !== "CLEAR") {
    await db.insert(eventsTable).values({
    actorType: "SERVICE",
      id: generateId(),
      companyId,
      eventType: "COMPLIANCE_ALERT",
      entityType: "shipment",
      entityId: shipmentId,
      serviceId: "compliance-screening",
      metadata: {
        screeningId,
        status: screenResult.status,
        matches: screenResult.matches,
        agentResolutions,
      },
    });
  }

  console.log(
    `[compliance] screening complete: shipment=${shipmentId} status=${screenResult.status} parties=${screenResult.screenedParties} matches=${screenResult.matchCount}`,
  );

  return {
    screeningId,
    status: screenResult.status,
    matchCount: screenResult.matchCount,
    agentResolutions,
    success: true,
    error: null,
  };
}
