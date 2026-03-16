import { db } from "../index.js";
import { eq } from "drizzle-orm";
import { LORIAN_COMPANY_ID } from "./constants.js";
import {
  reportSnapshotsTable,
  policySimulationsTable,
  policyVersionsTable,
  operatingModesTable,
  tenantPoliciesTable,
  interventionAttributionsTable,
  portfolioSnapshotsTable,
  networkRecommendationsTable,
  carrierAllocationsTable,
  laneStrategiesTable,
  scenarioComparisonsTable,
  mitigationPlaybooksTable,
  releaseGateHoldsTable,
  bookingDecisionsTable,
  historicalPatternsTable,
  predictiveAlertsTable,
  preShipmentRiskReportsTable,
  operationalNotificationsTable,
  policyDecisionsTable,
  taskEventsTable,
  workflowTasksTable,
  recommendationOutcomesTable,
  recommendationsTable,
  shipmentIntelligenceSnapshotsTable,
  entityScoresTable,
  carrierScoresTable,
  portScoresTable,
  laneScoresTable,
  tradeLaneStatsTable,
  tradeGraphEdgesTable,
  laneMarketSignalsTable,
  vesselPortCallsTable,
  vesselPositionsTable,
  portCongestionSnapshotsTable,
  deniedPartiesTable,
  sanctionsEntitiesTable,
  weatherRiskEventsTable,
  disruptionEventsTable,
  intelligenceSourcesTable,
  riskScoresTable,
  claimCommunicationsTable,
  claimsTable,
  invoicesTable,
  shipmentChargesTable,
  exceptionsTable,
  operatorCorrectionsTable,
  insuranceQuotesTable,
  complianceScreeningsTable,
  shipmentDocumentsTable,
  eventsTable,
  ingestedDocumentsTable,
  ingestedEmailsTable,
  ingestionRunsTable,
  shipmentsTable,
  entitiesTable,
  usersTable,
  companiesTable,
} from "../schema/index.js";

const TABLES_IN_ORDER = [
  { table: reportSnapshotsTable, name: "report_snapshots" },
  { table: policySimulationsTable, name: "policy_simulations" },
  { table: policyVersionsTable, name: "policy_versions" },
  { table: operatingModesTable, name: "operating_modes" },
  { table: tenantPoliciesTable, name: "tenant_policies" },
  { table: interventionAttributionsTable, name: "intervention_attributions" },
  { table: portfolioSnapshotsTable, name: "portfolio_snapshots" },
  { table: networkRecommendationsTable, name: "network_recommendations" },
  { table: carrierAllocationsTable, name: "carrier_allocations" },
  { table: laneStrategiesTable, name: "lane_strategies" },
  { table: scenarioComparisonsTable, name: "scenario_comparisons" },
  { table: mitigationPlaybooksTable, name: "mitigation_playbooks" },
  { table: releaseGateHoldsTable, name: "release_gate_holds" },
  { table: bookingDecisionsTable, name: "booking_decisions" },
  { table: historicalPatternsTable, name: "historical_patterns" },
  { table: predictiveAlertsTable, name: "predictive_alerts" },
  { table: preShipmentRiskReportsTable, name: "pre_shipment_risk_reports" },
  { table: operationalNotificationsTable, name: "operational_notifications" },
  { table: policyDecisionsTable, name: "policy_decisions" },
  { table: taskEventsTable, name: "task_events" },
  { table: workflowTasksTable, name: "workflow_tasks" },
  { table: recommendationOutcomesTable, name: "recommendation_outcomes" },
  { table: recommendationsTable, name: "recommendations" },
  { table: shipmentIntelligenceSnapshotsTable, name: "shipment_intelligence_snapshots" },
  { table: entityScoresTable, name: "entity_scores" },
  { table: carrierScoresTable, name: "carrier_scores" },
  { table: portScoresTable, name: "port_scores" },
  { table: laneScoresTable, name: "lane_scores" },
  { table: tradeLaneStatsTable, name: "trade_lane_stats" },
  { table: tradeGraphEdgesTable, name: "trade_graph_edges" },
  { table: laneMarketSignalsTable, name: "lane_market_signals" },
  { table: vesselPortCallsTable, name: "vessel_port_calls" },
  { table: vesselPositionsTable, name: "vessel_positions" },
  { table: portCongestionSnapshotsTable, name: "port_congestion_snapshots" },
  { table: deniedPartiesTable, name: "denied_parties" },
  { table: sanctionsEntitiesTable, name: "sanctions_entities" },
  { table: weatherRiskEventsTable, name: "weather_risk_events" },
  { table: disruptionEventsTable, name: "disruption_events" },
  { table: intelligenceSourcesTable, name: "intelligence_sources" },
  { table: claimCommunicationsTable, name: "claim_communications" },
  { table: claimsTable, name: "claims" },
  { table: invoicesTable, name: "invoices" },
  { table: shipmentChargesTable, name: "shipment_charges" },
  { table: exceptionsTable, name: "exceptions" },
  { table: operatorCorrectionsTable, name: "operator_corrections" },
  { table: insuranceQuotesTable, name: "insurance_quotes" },
  { table: complianceScreeningsTable, name: "compliance_screenings" },
  { table: shipmentDocumentsTable, name: "shipment_documents" },
  { table: eventsTable, name: "events" },
  { table: riskScoresTable, name: "risk_scores" },
  { table: ingestedDocumentsTable, name: "ingested_documents" },
  { table: ingestedEmailsTable, name: "ingested_emails" },
  { table: ingestionRunsTable, name: "ingestion_runs" },
  { table: shipmentsTable, name: "shipments" },
  { table: entitiesTable, name: "entities" },
  { table: usersTable, name: "users" },
  { table: companiesTable, name: "companies" },
];

export async function destroyLorian() {
  console.log("=== DESTROYING LORIAN DEMO DATA ===\n");

  for (const { table, name } of TABLES_IN_ORDER) {
    const companyIdCol = (table as any).companyId ?? (table as any).company_id;
    if (companyIdCol) {
      await db.delete(table).where(eq(companyIdCol, LORIAN_COMPANY_ID));
      console.log(`  Deleted from ${name}`);
    } else if (name === "companies") {
      await db.delete(table).where(eq((table as any).id, LORIAN_COMPANY_ID));
      console.log(`  Deleted from ${name}`);
    }
  }

  console.log("\n=== LORIAN DEMO DATA DESTROYED ===");
}

if (process.argv[1]?.endsWith("destroy-lorian.ts") || process.argv[1]?.endsWith("destroy-lorian.js")) {
  destroyLorian().then(() => process.exit(0)).catch((err) => {
    console.error("Destroy failed:", err);
    process.exit(1);
  });
}
