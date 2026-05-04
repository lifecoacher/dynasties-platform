CREATE TYPE "public"."migration_job_status" AS ENUM('UPLOADED', 'CLASSIFYING', 'CLASSIFIED', 'MAPPING', 'MAPPED', 'VALIDATING', 'VALIDATED', 'IMPORTING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."shipment_event_source" AS ENUM('IMPORT', 'MANUAL', 'API', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."shipment_event_type" AS ENUM('SHIPMENT_CREATED', 'BOOKING_CONFIRMED', 'PICKED_UP', 'DEPARTED_ORIGIN', 'ARRIVED_TRANSSHIPMENT', 'DEPARTED_TRANSSHIPMENT', 'ARRIVED_DESTINATION', 'CUSTOMS_HOLD', 'CUSTOMS_RELEASED', 'DELAYED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'UNKNOWN');--> statement-breakpoint
CREATE TYPE "public"."generated_doc_status" AS ENUM('DRAFT', 'GENERATED', 'BLOCKED', 'SUPERSEDED');--> statement-breakpoint
CREATE TYPE "public"."generated_doc_type" AS ENUM('COMMERCIAL_INVOICE', 'PACKING_LIST', 'BILL_OF_LADING', 'CUSTOMS_DECLARATION', 'SHIPMENT_SUMMARY');--> statement-breakpoint
CREATE TYPE "public"."reconciliation_status" AS ENUM('MATCHED', 'MINOR_VARIANCE', 'MAJOR_VARIANCE', 'UNMATCHED');--> statement-breakpoint
CREATE TABLE "intelligence_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text,
	"source_name" text NOT NULL,
	"source_type" text NOT NULL,
	"provider_name" text NOT NULL,
	"ingestion_method" text NOT NULL,
	"schedule_expression" text,
	"auth_config" jsonb,
	"source_status" text DEFAULT 'active' NOT NULL,
	"last_synced_at" timestamp,
	"last_success_at" timestamp,
	"last_failure_at" timestamp,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vessel_port_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text,
	"source_id" text NOT NULL,
	"vessel_name" text NOT NULL,
	"imo" text,
	"port_code" text NOT NULL,
	"port_name" text NOT NULL,
	"call_type" text NOT NULL,
	"arrival_time" timestamp,
	"departure_time" timestamp,
	"berth_duration_hours" real,
	"fingerprint" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vessel_positions" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text,
	"source_id" text NOT NULL,
	"vessel_name" text NOT NULL,
	"imo" text,
	"mmsi" text,
	"latitude" real NOT NULL,
	"longitude" real NOT NULL,
	"heading" real,
	"speed" real,
	"status" text DEFAULT 'unknown' NOT NULL,
	"destination" text,
	"eta" timestamp,
	"fingerprint" text NOT NULL,
	"position_timestamp" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "port_congestion_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text,
	"source_id" text NOT NULL,
	"port_code" text NOT NULL,
	"port_name" text NOT NULL,
	"congestion_level" text NOT NULL,
	"waiting_vessels" integer,
	"avg_wait_days" real,
	"avg_berth_days" real,
	"capacity_utilization" real,
	"trend_direction" text,
	"fingerprint" text NOT NULL,
	"snapshot_timestamp" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "denied_parties" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text,
	"source_id" text NOT NULL,
	"list_name" text NOT NULL,
	"party_name" text NOT NULL,
	"party_type" text NOT NULL,
	"country" text,
	"address" text,
	"reason" text,
	"aliases" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"fingerprint" text NOT NULL,
	"source_quality" real,
	"listing_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sanctions_entities" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text,
	"source_id" text NOT NULL,
	"list_name" text NOT NULL,
	"entity_name" text NOT NULL,
	"entity_type" text NOT NULL,
	"aliases" jsonb,
	"country" text,
	"sanction_program" text,
	"listing_date" timestamp,
	"expiration_date" timestamp,
	"identifiers" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"fingerprint" text NOT NULL,
	"source_quality" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disruption_events" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text,
	"source_id" text NOT NULL,
	"event_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"severity" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"affected_region" text,
	"affected_ports" jsonb,
	"affected_lanes" jsonb,
	"estimated_impact_days" real,
	"confidence" real,
	"start_date" timestamp NOT NULL,
	"expected_end_date" timestamp,
	"resolved_date" timestamp,
	"fingerprint" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weather_risk_events" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text,
	"source_id" text NOT NULL,
	"event_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"severity" text NOT NULL,
	"status" text DEFAULT 'forecast' NOT NULL,
	"affected_region" text,
	"affected_ports" jsonb,
	"latitude" real,
	"longitude" real,
	"radius_km" real,
	"wind_speed_knots" real,
	"confidence" real,
	"forecast_date" timestamp NOT NULL,
	"expected_start_date" timestamp,
	"expected_end_date" timestamp,
	"fingerprint" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lane_market_signals" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text,
	"source_id" text NOT NULL,
	"origin_port" text NOT NULL,
	"destination_port" text NOT NULL,
	"lane_id" text NOT NULL,
	"signal_type" text NOT NULL,
	"direction" text NOT NULL,
	"magnitude" real,
	"current_rate" real,
	"previous_rate" real,
	"rate_unit" text,
	"avg_transit_days" real,
	"capacity_utilization" real,
	"confidence" real,
	"fingerprint" text NOT NULL,
	"signal_timestamp" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text,
	"source_id" text NOT NULL,
	"source_type" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"records_fetched" integer DEFAULT 0 NOT NULL,
	"records_validated" integer DEFAULT 0 NOT NULL,
	"records_persisted" integer DEFAULT 0 NOT NULL,
	"records_deduplicated" integer DEFAULT 0 NOT NULL,
	"records_failed" integer DEFAULT 0 NOT NULL,
	"graph_edges_created" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"error_details" jsonb,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment_intelligence_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"shipment_id" text NOT NULL,
	"congestion_score" real DEFAULT 0 NOT NULL,
	"disruption_score" real DEFAULT 0 NOT NULL,
	"weather_risk_score" real DEFAULT 0 NOT NULL,
	"sanctions_risk_score" real DEFAULT 0 NOT NULL,
	"vessel_risk_score" real DEFAULT 0 NOT NULL,
	"market_pressure_score" real DEFAULT 0 NOT NULL,
	"composite_intel_score" real DEFAULT 0 NOT NULL,
	"linked_signal_ids" jsonb NOT NULL,
	"external_reason_codes" jsonb NOT NULL,
	"evidence_summary" jsonb NOT NULL,
	"snapshot_hash" text NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carrier_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text,
	"carrier_name" text NOT NULL,
	"performance_score" real DEFAULT 0 NOT NULL,
	"anomaly_score" real DEFAULT 0 NOT NULL,
	"reliability_score" real DEFAULT 0 NOT NULL,
	"lane_stress_exposure" real DEFAULT 0 NOT NULL,
	"composite_score" real DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text,
	"entity_id" text NOT NULL,
	"entity_name" text NOT NULL,
	"sanctions_risk_score" real DEFAULT 0 NOT NULL,
	"denied_party_confidence" real DEFAULT 0 NOT NULL,
	"documentation_irregularity" real DEFAULT 0 NOT NULL,
	"composite_score" real DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lane_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text,
	"origin_port" text NOT NULL,
	"destination_port" text NOT NULL,
	"congestion_score" real DEFAULT 0 NOT NULL,
	"disruption_score" real DEFAULT 0 NOT NULL,
	"delay_stress_score" real DEFAULT 0 NOT NULL,
	"market_pressure_score" real DEFAULT 0 NOT NULL,
	"composite_stress_score" real DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "port_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text,
	"port_code" text NOT NULL,
	"port_name" text,
	"congestion_severity" real DEFAULT 0 NOT NULL,
	"weather_exposure" real DEFAULT 0 NOT NULL,
	"disruption_exposure" real DEFAULT 0 NOT NULL,
	"operational_volatility" real DEFAULT 0 NOT NULL,
	"composite_score" real DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operational_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"user_id" text,
	"event_type" text NOT NULL,
	"title" text NOT NULL,
	"message" text,
	"severity" text DEFAULT 'INFO' NOT NULL,
	"related_task_id" text,
	"related_shipment_id" text,
	"related_recommendation_id" text,
	"read" boolean DEFAULT false,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"recommendation_id" text NOT NULL,
	"shipment_id" text,
	"recommendation_type" text NOT NULL,
	"urgency" text NOT NULL,
	"confidence" numeric NOT NULL,
	"intelligence_enriched" boolean DEFAULT false,
	"outcome" text NOT NULL,
	"task_type_resolved" text,
	"priority_resolved" text,
	"due_hours_resolved" integer,
	"reason" text NOT NULL,
	"task_id" text,
	"applied" boolean DEFAULT false,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_events" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"task_id" text NOT NULL,
	"event_type" text NOT NULL,
	"actor_id" text NOT NULL,
	"before_value" text,
	"after_value" text,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"shipment_id" text,
	"recommendation_id" text,
	"snapshot_id" text,
	"task_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"priority" text DEFAULT 'MEDIUM' NOT NULL,
	"assigned_to" text,
	"created_by" text NOT NULL,
	"creation_source" text DEFAULT 'MANUAL',
	"policy_decision_id" text,
	"due_at" timestamp,
	"completed_at" timestamp,
	"escalation_level" integer DEFAULT 0,
	"escalated_at" timestamp,
	"last_escalation_check" timestamp,
	"priority_score" numeric,
	"execution_notes" text,
	"completion_notes" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historical_patterns" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"pattern_type" text NOT NULL,
	"subject_key" text NOT NULL,
	"subject_name" text,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"sample_count" integer DEFAULT 0 NOT NULL,
	"avg_value" real DEFAULT 0 NOT NULL,
	"min_value" real,
	"max_value" real,
	"trend_direction" text,
	"trend_strength" real,
	"pattern_data" jsonb,
	"metadata" jsonb,
	"computed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pre_shipment_risk_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"shipment_id" text NOT NULL,
	"overall_risk_score" real NOT NULL,
	"lane_stress_score" real DEFAULT 0 NOT NULL,
	"port_congestion_score" real DEFAULT 0 NOT NULL,
	"disruption_risk_score" real DEFAULT 0 NOT NULL,
	"weather_exposure_score" real DEFAULT 0 NOT NULL,
	"carrier_reliability_score" real DEFAULT 0 NOT NULL,
	"entity_compliance_score" real DEFAULT 0 NOT NULL,
	"risk_level" text NOT NULL,
	"mitigations" jsonb NOT NULL,
	"component_details" jsonb,
	"readiness_score" real,
	"readiness_components" jsonb,
	"evaluated_at" timestamp DEFAULT now() NOT NULL,
	"shipment_etd" timestamp,
	"days_until_departure" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "predictive_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"alert_type" text NOT NULL,
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"affected_ports" jsonb,
	"affected_lanes" jsonb,
	"affected_shipment_ids" jsonb,
	"trend_data" jsonb,
	"confidence_score" real DEFAULT 0 NOT NULL,
	"predicted_impact_days" real,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"expires_at" timestamp,
	"resolved_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"shipment_id" text NOT NULL,
	"status" text NOT NULL,
	"confidence" real NOT NULL,
	"overall_risk_score" real NOT NULL,
	"readiness_score" real NOT NULL,
	"reason_codes" jsonb NOT NULL,
	"required_actions" jsonb NOT NULL,
	"recommended_alternatives" jsonb,
	"input_scores" jsonb NOT NULL,
	"decided_at" timestamp DEFAULT now() NOT NULL,
	"decided_by" text,
	"overridden_by" text,
	"override_reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mitigation_playbooks" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"shipment_id" text NOT NULL,
	"trigger_condition" text NOT NULL,
	"trigger_source" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"steps" jsonb NOT NULL,
	"total_steps" integer NOT NULL,
	"completed_steps" integer DEFAULT 0 NOT NULL,
	"priority" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "release_gate_holds" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"shipment_id" text NOT NULL,
	"gate_type" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"severity" text NOT NULL,
	"reason" text NOT NULL,
	"policy_rule" text NOT NULL,
	"required_action" text NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp,
	"resolution_notes" text,
	"trigger_data" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_comparisons" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"shipment_id" text NOT NULL,
	"baseline_scenario" jsonb NOT NULL,
	"alternative_scenarios" jsonb NOT NULL,
	"best_alternative" text,
	"computed_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carrier_allocations" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"carrier_name" text NOT NULL,
	"lane" text,
	"allocation" text NOT NULL,
	"confidence" real NOT NULL,
	"reliability_score" real NOT NULL,
	"recommendation_trigger_rate" real DEFAULT 0 NOT NULL,
	"switch_away_rate" real DEFAULT 0 NOT NULL,
	"disruption_exposure" real DEFAULT 0 NOT NULL,
	"lane_performance" real DEFAULT 0 NOT NULL,
	"risk_adjusted_score" real NOT NULL,
	"shipment_count" integer DEFAULT 0 NOT NULL,
	"factors" jsonb NOT NULL,
	"suggested_actions" jsonb NOT NULL,
	"computed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intervention_attributions" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"period" text NOT NULL,
	"delays_avoided" integer DEFAULT 0 NOT NULL,
	"estimated_days_saved" real DEFAULT 0 NOT NULL,
	"margin_protected" real DEFAULT 0 NOT NULL,
	"risks_mitigated" integer DEFAULT 0 NOT NULL,
	"interventions_triggered" integer DEFAULT 0 NOT NULL,
	"interventions_completed" integer DEFAULT 0 NOT NULL,
	"tasks_auto_created" integer DEFAULT 0 NOT NULL,
	"booking_holds_prevented_issues" integer DEFAULT 0 NOT NULL,
	"recommendations_accepted" integer DEFAULT 0 NOT NULL,
	"recommendations_total" integer DEFAULT 0 NOT NULL,
	"intelligence_enriched_impact" real DEFAULT 0 NOT NULL,
	"internal_only_impact" real DEFAULT 0 NOT NULL,
	"attribution_details" jsonb NOT NULL,
	"computed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lane_strategies" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"origin_port" text NOT NULL,
	"destination_port" text NOT NULL,
	"strategy" text NOT NULL,
	"confidence" real NOT NULL,
	"stress_score" real NOT NULL,
	"delay_exposure" real NOT NULL,
	"disruption_frequency" real NOT NULL,
	"congestion_trend" real NOT NULL,
	"recommendation_volume" integer DEFAULT 0 NOT NULL,
	"task_volume" integer DEFAULT 0 NOT NULL,
	"exception_count" integer DEFAULT 0 NOT NULL,
	"margin_pressure" real DEFAULT 0 NOT NULL,
	"shipment_count" integer DEFAULT 0 NOT NULL,
	"factors" jsonb NOT NULL,
	"suggested_actions" jsonb NOT NULL,
	"computed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "network_recommendations" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"scope" text NOT NULL,
	"scope_identifier" text NOT NULL,
	"type" text NOT NULL,
	"priority" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"suggested_action" text NOT NULL,
	"estimated_impact" jsonb,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"acknowledged_by" text,
	"acknowledged_at" timestamp,
	"fingerprint" text NOT NULL,
	"computed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"period" text NOT NULL,
	"total_shipments" integer NOT NULL,
	"active_shipments" integer NOT NULL,
	"risk_distribution" jsonb NOT NULL,
	"delay_exposure" real NOT NULL,
	"compliance_exposure" real NOT NULL,
	"margin_at_risk" real NOT NULL,
	"mitigated_exposure" real NOT NULL,
	"unmitigated_exposure" real NOT NULL,
	"exposure_by_lane" jsonb,
	"exposure_by_carrier" jsonb,
	"exposure_by_port" jsonb,
	"trends" jsonb,
	"snapshot_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operating_modes" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"mode_name" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"policy_overrides" jsonb NOT NULL,
	"description" text,
	"activated_by" text,
	"activated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_simulations" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"simulation_name" text NOT NULL,
	"policy_changes" jsonb NOT NULL,
	"baseline_summary" jsonb NOT NULL,
	"simulated_summary" jsonb NOT NULL,
	"impact_analysis" jsonb NOT NULL,
	"simulated_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"policy_id" text NOT NULL,
	"policy_key" text NOT NULL,
	"previous_value" jsonb,
	"new_value" jsonb NOT NULL,
	"version" integer NOT NULL,
	"changed_by" text NOT NULL,
	"change_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"report_type" text NOT NULL,
	"title" text NOT NULL,
	"report_data" jsonb NOT NULL,
	"format" text DEFAULT 'JSON' NOT NULL,
	"generated_by" text,
	"period_start" timestamp,
	"period_end" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"policy_key" text NOT NULL,
	"policy_value" jsonb NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text,
	"task_type" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "balance_financing_records" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"customer_billing_profile_id" text NOT NULL,
	"application_status" text NOT NULL,
	"term_days" integer,
	"financed_amount" numeric(14, 2),
	"provider_fee_rate" real,
	"provider_fee_amount" numeric(12, 2),
	"client_facing_fee_rate" real,
	"client_facing_fee_amount" numeric(12, 2),
	"dynasties_spread_amount" numeric(12, 2),
	"provider_external_ref" text,
	"provider_name" text DEFAULT 'balance' NOT NULL,
	"settlement_status" text DEFAULT 'PENDING' NOT NULL,
	"decline_reason" text,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp,
	"decided_at" timestamp,
	"funded_at" timestamp,
	"repaid_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"legal_entity_name" text NOT NULL,
	"billing_email" text NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"invoice_prefix" text DEFAULT 'INV' NOT NULL,
	"default_payment_terms" text DEFAULT 'NET_30' NOT NULL,
	"collections_contact_name" text,
	"collections_contact_email" text,
	"collections_contact_phone" text,
	"payment_provider_status" text DEFAULT 'NOT_CONNECTED' NOT NULL,
	"balance_provider_status" text DEFAULT 'NOT_CONNECTED' NOT NULL,
	"finance_enabled" boolean DEFAULT false NOT NULL,
	"spread_model" text DEFAULT 'PASS_THROUGH' NOT NULL,
	"spread_bps" integer DEFAULT 0 NOT NULL,
	"platform_fee_amount" numeric(12, 2) DEFAULT '0',
	"platform_fee_currency" text DEFAULT 'USD',
	"branding" jsonb,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "charge_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"billing_account_id" text NOT NULL,
	"name" text NOT NULL,
	"charge_type" text NOT NULL,
	"calculation_method" text DEFAULT 'FLAT' NOT NULL,
	"base_amount" numeric(12, 2),
	"rate_per_unit" numeric(12, 4),
	"percentage_basis" real,
	"currency" text DEFAULT 'USD' NOT NULL,
	"applicable_customer_id" text,
	"applicable_lane_origin" text,
	"applicable_lane_destination" text,
	"applicable_commodity" text,
	"auto_apply" boolean DEFAULT false NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commercial_events" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"event_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"actor_type" text DEFAULT 'SYSTEM' NOT NULL,
	"actor_id" text,
	"amount" numeric(14, 2),
	"currency" text,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_billing_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"billing_account_id" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_external_id" text,
	"billing_email" text NOT NULL,
	"billing_address" text,
	"billing_city" text,
	"billing_country" text,
	"payment_terms" text DEFAULT 'NET_30' NOT NULL,
	"credit_limit" numeric(14, 2),
	"current_exposure" numeric(14, 2) DEFAULT '0' NOT NULL,
	"risk_status" text DEFAULT 'LOW' NOT NULL,
	"balance_eligibility" text DEFAULT 'NOT_ASSESSED' NOT NULL,
	"preferred_payment_method" text,
	"default_currency" text DEFAULT 'USD' NOT NULL,
	"notes" text,
	"entity_id" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_line_items" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"line_type" text NOT NULL,
	"description" text NOT NULL,
	"quantity" real DEFAULT 1 NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"shipment_id" text,
	"shipment_reference" text,
	"charge_rule_id" text,
	"source_event_id" text,
	"editable" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_option_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"billing_account_id" text NOT NULL,
	"pay_now_enabled" boolean DEFAULT true NOT NULL,
	"pay_later_enabled" boolean DEFAULT false NOT NULL,
	"net_30_enabled" boolean DEFAULT true NOT NULL,
	"net_60_enabled" boolean DEFAULT false NOT NULL,
	"ach_enabled" boolean DEFAULT true NOT NULL,
	"card_enabled" boolean DEFAULT true NOT NULL,
	"wire_enabled" boolean DEFAULT false NOT NULL,
	"balance_offer_visible" boolean DEFAULT false NOT NULL,
	"fee_handling" text DEFAULT 'PASS_THROUGH' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receivables" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"customer_billing_profile_id" text NOT NULL,
	"original_amount" numeric(14, 2) NOT NULL,
	"outstanding_amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"due_date" timestamp NOT NULL,
	"days_overdue" integer DEFAULT 0 NOT NULL,
	"collections_status" text DEFAULT 'CURRENT' NOT NULL,
	"dispute_status" text DEFAULT 'NONE' NOT NULL,
	"dispute_reason" text,
	"finance_status" text DEFAULT 'NONE' NOT NULL,
	"receivable_transferred" boolean DEFAULT false NOT NULL,
	"settlement_status" text DEFAULT 'UNSETTLED' NOT NULL,
	"payments" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "receivables_invoice_id_unique" UNIQUE("invoice_id")
);
--> statement-breakpoint
CREATE TABLE "document_validation_results" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"shipment_id" text NOT NULL,
	"status" text NOT NULL,
	"readiness_level" text NOT NULL,
	"missing_documents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"missing_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"inconsistencies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suspicious_findings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recommended_actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reasoning_summary" text,
	"source_documents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"validated_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routing_pricing_results" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"shipment_id" text NOT NULL,
	"recommended_route_index" text DEFAULT '0' NOT NULL,
	"route_options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"risk_factors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recommendation_summary" text,
	"reasoning" text,
	"analyzed_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"shipment_id" text NOT NULL,
	"final_status" text NOT NULL,
	"release_allowed" boolean NOT NULL,
	"decision_reason" text NOT NULL,
	"base_risk_score" real,
	"dynamic_risk_score" real,
	"final_risk_score" real,
	"compliance_status" text,
	"doc_validation_status" text,
	"readiness_score" real,
	"shipment_status" text,
	"input_snapshot" jsonb NOT NULL,
	"decided_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "migration_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"status" "migration_job_status" DEFAULT 'UPLOADED' NOT NULL,
	"uploaded_files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"classification_results" jsonb DEFAULT '[]'::jsonb,
	"mapping_results" jsonb DEFAULT '[]'::jsonb,
	"user_corrections" jsonb DEFAULT '{}'::jsonb,
	"validation_summary" jsonb DEFAULT 'null'::jsonb,
	"import_results" jsonb DEFAULT 'null'::jsonb,
	"error_message" text,
	"total_rows" integer DEFAULT 0,
	"mapped_rows" integer DEFAULT 0,
	"imported_rows" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment_events" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"shipment_id" text NOT NULL,
	"event_type" "shipment_event_type" NOT NULL,
	"event_timestamp" timestamp NOT NULL,
	"location" text,
	"source" "shipment_event_source" NOT NULL,
	"raw_payload" jsonb,
	"normalized_data" jsonb,
	"is_critical_event" boolean DEFAULT false NOT NULL,
	"requires_attention" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment_documents_generated" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"shipment_id" text NOT NULL,
	"invoice_id" text,
	"document_type" "generated_doc_type" NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"generation_status" "generated_doc_status" DEFAULT 'GENERATED' NOT NULL,
	"source_snapshot" jsonb NOT NULL,
	"validation_snapshot" jsonb,
	"html_content" text,
	"storage_key" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"superseded_by" text
);
--> statement-breakpoint
CREATE TABLE "carrier_invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"shipment_id" text,
	"carrier_name" text NOT NULL,
	"invoice_number" text NOT NULL,
	"invoice_date" timestamp NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"line_items" jsonb DEFAULT '[]'::jsonb,
	"raw_payload" jsonb,
	"shipment_reference" text,
	"match_confidence" real,
	"match_method" text,
	"requires_attention" text DEFAULT 'false' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliation_results" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"shipment_id" text NOT NULL,
	"carrier_invoice_id" text NOT NULL,
	"expected_amount" numeric(12, 2) NOT NULL,
	"actual_amount" numeric(12, 2) NOT NULL,
	"variance_amount" numeric(12, 2) NOT NULL,
	"variance_percentage" real NOT NULL,
	"reconciliation_status" "reconciliation_status" NOT NULL,
	"discrepancy_details" jsonb,
	"reconciled_by" text,
	"resolution_status" text DEFAULT 'PENDING' NOT NULL,
	"resolution_note" text,
	"resolved_by" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_line_items" (
	"id" text PRIMARY KEY NOT NULL,
	"quote_id" text NOT NULL,
	"charge_type" text NOT NULL,
	"description" text NOT NULL,
	"quantity" real DEFAULT 1 NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"customer_id" text,
	"quote_number" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"origin" text,
	"destination" text,
	"port_of_loading" text,
	"port_of_discharge" text,
	"incoterms" text,
	"cargo_summary" text,
	"commodity" text,
	"hs_code" text,
	"quantity" integer,
	"package_count" integer,
	"gross_weight" real,
	"weight_unit" text,
	"volume" real,
	"volume_unit" text,
	"currency" text DEFAULT 'USD' NOT NULL,
	"quoted_amount" numeric(12, 2),
	"pricing_snapshot" jsonb,
	"valid_until" timestamp,
	"notes" text,
	"converted_shipment_id" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounting_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"provider" text NOT NULL,
	"connection_status" text DEFAULT 'NOT_CONNECTED' NOT NULL,
	"realm_id" text,
	"company_name" text,
	"token_encrypted" text,
	"refresh_token_encrypted" text,
	"token_expires_at" timestamp,
	"last_sync_at" timestamp,
	"last_sync_status" text,
	"last_sync_error" text,
	"settings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounting_sync_mappings" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"dynasties_entity_id" text NOT NULL,
	"external_entity_id" text,
	"sync_status" text DEFAULT 'PENDING' NOT NULL,
	"sync_direction" text DEFAULT 'PUSH' NOT NULL,
	"last_sync_at" timestamp,
	"last_sync_error" text,
	"external_data" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_event_log" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"shipment_id" text,
	"event_type" text NOT NULL,
	"analysis_run_id" text,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment_ai_analysis_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"shipment_id" text NOT NULL,
	"trigger_type" text NOT NULL,
	"trigger_source_entity_id" text,
	"trigger_source_entity_type" text,
	"status" text NOT NULL,
	"analysis_version" integer NOT NULL,
	"input_snapshot_meta" jsonb,
	"output_summary" jsonb,
	"model_used" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"latency_ms" integer,
	"used_fallback" boolean DEFAULT false NOT NULL,
	"error_message" text,
	"before_state" jsonb,
	"after_state" jsonb,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment_ai_state" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"shipment_id" text NOT NULL,
	"analysis_status" text DEFAULT 'PENDING' NOT NULL,
	"analysis_version" integer DEFAULT 1 NOT NULL,
	"last_analyzed_at" timestamp,
	"last_trigger_event" text,
	"last_trigger_source" text,
	"last_analysis_run_id" text,
	"risk_score" real,
	"compliance_risk" real,
	"margin_risk" real,
	"operational_readiness" real,
	"confidence_score" real,
	"recommended_actions_summary" jsonb,
	"explanation_snapshot" text,
	"active_issues_summary" jsonb,
	"active_recommendation_count" integer DEFAULT 0 NOT NULL,
	"used_deterministic_fallback" boolean DEFAULT false NOT NULL,
	"highest_urgency" text,
	"last_failed_at" timestamp,
	"last_input_hash" text,
	"is_stale" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"stripe_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"status" text DEFAULT 'PROCESSING' NOT NULL,
	"error" text,
	"metadata" jsonb
);
--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "shipment_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "stripe_price_id" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "billing_status" text DEFAULT 'INACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "plan_type" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "seat_limit" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "shipment_limit_monthly" integer DEFAULT 40 NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "shipments_used_this_cycle" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "current_period_start" timestamp;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "current_period_end" timestamp;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "trial_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "deployment_fee_status" text DEFAULT 'NOT_REQUIRED' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "onboarding_paid" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "onboarding_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "stripe_connect_account_id" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "connect_onboarding_started" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "connect_onboarding_completed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "connect_charges_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "connect_payouts_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "connect_last_sync_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "clerk_id" text;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "carrier" text;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "cargo_value" real;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "source_quote_id" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "customer_billing_profile_id" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "bill_to_name" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "bill_to_email" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "discount_total" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "finance_fee" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "dynasties_spread" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "payment_terms" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "finance_eligible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "finance_status" text DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "payment_method" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "paid_at" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "source_quote_id" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "invoice_source" text DEFAULT 'MANUAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "exceptions" ADD COLUMN "invoice_id" text;--> statement-breakpoint
ALTER TABLE "exceptions" ADD COLUMN "document_id" text;--> statement-breakpoint
ALTER TABLE "exceptions" ADD COLUMN "detected_from" text;--> statement-breakpoint
ALTER TABLE "exceptions" ADD COLUMN "recommended_actions" jsonb;--> statement-breakpoint
ALTER TABLE "exceptions" ADD COLUMN "assigned_to_user_id" text;--> statement-breakpoint
ALTER TABLE "exceptions" ADD COLUMN "due_at" timestamp;--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN "fingerprint" text;--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN "external_reason_codes" jsonb;--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN "signal_evidence" jsonb;--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN "analysis_run_id" text;--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN "intelligence_enriched" text DEFAULT 'false';--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN "snapshot_id" text;--> statement-breakpoint
ALTER TABLE "recommendations" ADD COLUMN "superseded_by_id" text;--> statement-breakpoint
ALTER TABLE "intelligence_sources" ADD CONSTRAINT "intelligence_sources_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_port_calls" ADD CONSTRAINT "vessel_port_calls_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vessel_positions" ADD CONSTRAINT "vessel_positions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "port_congestion_snapshots" ADD CONSTRAINT "port_congestion_snapshots_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "denied_parties" ADD CONSTRAINT "denied_parties_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sanctions_entities" ADD CONSTRAINT "sanctions_entities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disruption_events" ADD CONSTRAINT "disruption_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weather_risk_events" ADD CONSTRAINT "weather_risk_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lane_market_signals" ADD CONSTRAINT "lane_market_signals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD CONSTRAINT "ingestion_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_intelligence_snapshots" ADD CONSTRAINT "shipment_intelligence_snapshots_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_intelligence_snapshots" ADD CONSTRAINT "shipment_intelligence_snapshots_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_scores" ADD CONSTRAINT "carrier_scores_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_scores" ADD CONSTRAINT "entity_scores_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lane_scores" ADD CONSTRAINT "lane_scores_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "port_scores" ADD CONSTRAINT "port_scores_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_notifications" ADD CONSTRAINT "operational_notifications_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_notifications" ADD CONSTRAINT "operational_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_decisions" ADD CONSTRAINT "policy_decisions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_task_id_workflow_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."workflow_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_tasks" ADD CONSTRAINT "workflow_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_patterns" ADD CONSTRAINT "historical_patterns_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_shipment_risk_reports" ADD CONSTRAINT "pre_shipment_risk_reports_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_shipment_risk_reports" ADD CONSTRAINT "pre_shipment_risk_reports_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "predictive_alerts" ADD CONSTRAINT "predictive_alerts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_decisions" ADD CONSTRAINT "booking_decisions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_decisions" ADD CONSTRAINT "booking_decisions_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mitigation_playbooks" ADD CONSTRAINT "mitigation_playbooks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mitigation_playbooks" ADD CONSTRAINT "mitigation_playbooks_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_gate_holds" ADD CONSTRAINT "release_gate_holds_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_gate_holds" ADD CONSTRAINT "release_gate_holds_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_comparisons" ADD CONSTRAINT "scenario_comparisons_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_comparisons" ADD CONSTRAINT "scenario_comparisons_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_allocations" ADD CONSTRAINT "carrier_allocations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intervention_attributions" ADD CONSTRAINT "intervention_attributions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lane_strategies" ADD CONSTRAINT "lane_strategies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "network_recommendations" ADD CONSTRAINT "network_recommendations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operating_modes" ADD CONSTRAINT "operating_modes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operating_modes" ADD CONSTRAINT "operating_modes_activated_by_users_id_fk" FOREIGN KEY ("activated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_simulations" ADD CONSTRAINT "policy_simulations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_simulations" ADD CONSTRAINT "policy_simulations_simulated_by_users_id_fk" FOREIGN KEY ("simulated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_policy_id_tenant_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."tenant_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "policy_versions" ADD CONSTRAINT "policy_versions_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_snapshots" ADD CONSTRAINT "report_snapshots_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_snapshots" ADD CONSTRAINT "report_snapshots_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_policies" ADD CONSTRAINT "tenant_policies_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_policies" ADD CONSTRAINT "tenant_policies_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_financing_records" ADD CONSTRAINT "balance_financing_records_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_financing_records" ADD CONSTRAINT "balance_financing_records_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_financing_records" ADD CONSTRAINT "balance_financing_records_customer_billing_profile_id_customer_billing_profiles_id_fk" FOREIGN KEY ("customer_billing_profile_id") REFERENCES "public"."customer_billing_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_rules" ADD CONSTRAINT "charge_rules_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_rules" ADD CONSTRAINT "charge_rules_billing_account_id_billing_accounts_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commercial_events" ADD CONSTRAINT "commercial_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_billing_profiles" ADD CONSTRAINT "customer_billing_profiles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_billing_profiles" ADD CONSTRAINT "customer_billing_profiles_billing_account_id_billing_accounts_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_option_configs" ADD CONSTRAINT "payment_option_configs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_option_configs" ADD CONSTRAINT "payment_option_configs_billing_account_id_billing_accounts_id_fk" FOREIGN KEY ("billing_account_id") REFERENCES "public"."billing_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_customer_billing_profile_id_customer_billing_profiles_id_fk" FOREIGN KEY ("customer_billing_profile_id") REFERENCES "public"."customer_billing_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_validation_results" ADD CONSTRAINT "document_validation_results_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_validation_results" ADD CONSTRAINT "document_validation_results_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routing_pricing_results" ADD CONSTRAINT "routing_pricing_results_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routing_pricing_results" ADD CONSTRAINT "routing_pricing_results_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_decisions" ADD CONSTRAINT "shipment_decisions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_decisions" ADD CONSTRAINT "shipment_decisions_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migration_jobs" ADD CONSTRAINT "migration_jobs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_documents_generated" ADD CONSTRAINT "shipment_documents_generated_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_documents_generated" ADD CONSTRAINT "shipment_documents_generated_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_invoices" ADD CONSTRAINT "carrier_invoices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carrier_invoices" ADD CONSTRAINT "carrier_invoices_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_results" ADD CONSTRAINT "reconciliation_results_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_results" ADD CONSTRAINT "reconciliation_results_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_results" ADD CONSTRAINT "reconciliation_results_carrier_invoice_id_carrier_invoices_id_fk" FOREIGN KEY ("carrier_invoice_id") REFERENCES "public"."carrier_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_entities_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_converted_shipment_id_shipments_id_fk" FOREIGN KEY ("converted_shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_connections" ADD CONSTRAINT "accounting_connections_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_sync_mappings" ADD CONSTRAINT "accounting_sync_mappings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_sync_mappings" ADD CONSTRAINT "accounting_sync_mappings_connection_id_accounting_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."accounting_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_event_log" ADD CONSTRAINT "ai_event_log_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_event_log" ADD CONSTRAINT "ai_event_log_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_ai_analysis_runs" ADD CONSTRAINT "shipment_ai_analysis_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_ai_analysis_runs" ADD CONSTRAINT "shipment_ai_analysis_runs_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_ai_state" ADD CONSTRAINT "shipment_ai_state_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_ai_state" ADD CONSTRAINT "shipment_ai_state_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "is_company_id_idx" ON "intelligence_sources" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "is_source_type_idx" ON "intelligence_sources" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "is_status_idx" ON "intelligence_sources" USING btree ("source_status");--> statement-breakpoint
CREATE INDEX "vpc_company_id_idx" ON "vessel_port_calls" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "vpc_imo_idx" ON "vessel_port_calls" USING btree ("imo");--> statement-breakpoint
CREATE INDEX "vpc_port_code_idx" ON "vessel_port_calls" USING btree ("port_code");--> statement-breakpoint
CREATE INDEX "vpc_fingerprint_idx" ON "vessel_port_calls" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "vp_company_id_idx" ON "vessel_positions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "vp_imo_idx" ON "vessel_positions" USING btree ("imo");--> statement-breakpoint
CREATE INDEX "vp_mmsi_idx" ON "vessel_positions" USING btree ("mmsi");--> statement-breakpoint
CREATE INDEX "vp_vessel_name_idx" ON "vessel_positions" USING btree ("vessel_name");--> statement-breakpoint
CREATE INDEX "vp_fingerprint_idx" ON "vessel_positions" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "vp_position_ts_idx" ON "vessel_positions" USING btree ("position_timestamp");--> statement-breakpoint
CREATE INDEX "pcs_company_id_idx" ON "port_congestion_snapshots" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "pcs_port_code_idx" ON "port_congestion_snapshots" USING btree ("port_code");--> statement-breakpoint
CREATE INDEX "pcs_congestion_level_idx" ON "port_congestion_snapshots" USING btree ("congestion_level");--> statement-breakpoint
CREATE INDEX "pcs_fingerprint_idx" ON "port_congestion_snapshots" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "pcs_snapshot_ts_idx" ON "port_congestion_snapshots" USING btree ("snapshot_timestamp");--> statement-breakpoint
CREATE INDEX "dp_company_id_idx" ON "denied_parties" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "dp_party_name_idx" ON "denied_parties" USING btree ("party_name");--> statement-breakpoint
CREATE INDEX "dp_list_name_idx" ON "denied_parties" USING btree ("list_name");--> statement-breakpoint
CREATE INDEX "dp_fingerprint_idx" ON "denied_parties" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "dp_status_idx" ON "denied_parties" USING btree ("status");--> statement-breakpoint
CREATE INDEX "se_company_id_idx" ON "sanctions_entities" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "se_entity_name_idx" ON "sanctions_entities" USING btree ("entity_name");--> statement-breakpoint
CREATE INDEX "se_list_name_idx" ON "sanctions_entities" USING btree ("list_name");--> statement-breakpoint
CREATE INDEX "se_entity_type_idx" ON "sanctions_entities" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "se_fingerprint_idx" ON "sanctions_entities" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "se_status_idx" ON "sanctions_entities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "de_company_id_idx" ON "disruption_events" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "de_event_type_idx" ON "disruption_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "de_severity_idx" ON "disruption_events" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "de_status_idx" ON "disruption_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "de_fingerprint_idx" ON "disruption_events" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "de_start_date_idx" ON "disruption_events" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "wre_company_id_idx" ON "weather_risk_events" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "wre_event_type_idx" ON "weather_risk_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "wre_severity_idx" ON "weather_risk_events" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "wre_status_idx" ON "weather_risk_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wre_fingerprint_idx" ON "weather_risk_events" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "lms_company_id_idx" ON "lane_market_signals" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "lms_lane_id_idx" ON "lane_market_signals" USING btree ("lane_id");--> statement-breakpoint
CREATE INDEX "lms_signal_type_idx" ON "lane_market_signals" USING btree ("signal_type");--> statement-breakpoint
CREATE INDEX "lms_fingerprint_idx" ON "lane_market_signals" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "lms_signal_ts_idx" ON "lane_market_signals" USING btree ("signal_timestamp");--> statement-breakpoint
CREATE INDEX "ir_company_id_idx" ON "ingestion_runs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "ir_source_id_idx" ON "ingestion_runs" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "ir_source_type_idx" ON "ingestion_runs" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "ir_status_idx" ON "ingestion_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ir_started_at_idx" ON "ingestion_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "intel_snapshots_company_id_idx" ON "shipment_intelligence_snapshots" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "intel_snapshots_shipment_id_idx" ON "shipment_intelligence_snapshots" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "intel_snapshots_hash_idx" ON "shipment_intelligence_snapshots" USING btree ("snapshot_hash");--> statement-breakpoint
CREATE INDEX "intel_snapshots_generated_at_idx" ON "shipment_intelligence_snapshots" USING btree ("generated_at");--> statement-breakpoint
CREATE INDEX "carrier_scores_company_id_idx" ON "carrier_scores" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "carrier_scores_carrier_name_idx" ON "carrier_scores" USING btree ("carrier_name");--> statement-breakpoint
CREATE INDEX "carrier_scores_composite_idx" ON "carrier_scores" USING btree ("composite_score");--> statement-breakpoint
CREATE INDEX "entity_scores_company_id_idx" ON "entity_scores" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "entity_scores_entity_id_idx" ON "entity_scores" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "entity_scores_composite_idx" ON "entity_scores" USING btree ("composite_score");--> statement-breakpoint
CREATE INDEX "lane_scores_company_id_idx" ON "lane_scores" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "lane_scores_origin_dest_idx" ON "lane_scores" USING btree ("origin_port","destination_port");--> statement-breakpoint
CREATE INDEX "lane_scores_composite_idx" ON "lane_scores" USING btree ("composite_stress_score");--> statement-breakpoint
CREATE INDEX "port_scores_company_id_idx" ON "port_scores" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "port_scores_port_code_idx" ON "port_scores" USING btree ("port_code");--> statement-breakpoint
CREATE INDEX "port_scores_composite_idx" ON "port_scores" USING btree ("composite_score");--> statement-breakpoint
CREATE INDEX "op_notifications_company_id_idx" ON "operational_notifications" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "op_notifications_user_id_idx" ON "operational_notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "op_notifications_event_type_idx" ON "operational_notifications" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "op_notifications_read_idx" ON "operational_notifications" USING btree ("read");--> statement-breakpoint
CREATE INDEX "op_notifications_created_at_idx" ON "operational_notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "policy_decisions_company_id_idx" ON "policy_decisions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "policy_decisions_recommendation_id_idx" ON "policy_decisions" USING btree ("recommendation_id");--> statement-breakpoint
CREATE INDEX "policy_decisions_outcome_idx" ON "policy_decisions" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX "policy_decisions_created_at_idx" ON "policy_decisions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "task_events_company_id_idx" ON "task_events" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "task_events_task_id_idx" ON "task_events" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_events_event_type_idx" ON "task_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "task_events_created_at_idx" ON "task_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "workflow_tasks_company_id_idx" ON "workflow_tasks" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "workflow_tasks_shipment_id_idx" ON "workflow_tasks" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "workflow_tasks_recommendation_id_idx" ON "workflow_tasks" USING btree ("recommendation_id");--> statement-breakpoint
CREATE INDEX "workflow_tasks_task_type_idx" ON "workflow_tasks" USING btree ("task_type");--> statement-breakpoint
CREATE INDEX "workflow_tasks_status_idx" ON "workflow_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workflow_tasks_assigned_to_idx" ON "workflow_tasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "workflow_tasks_due_at_idx" ON "workflow_tasks" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "workflow_tasks_created_at_idx" ON "workflow_tasks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "workflow_tasks_priority_score_idx" ON "workflow_tasks" USING btree ("priority_score");--> statement-breakpoint
CREATE INDEX "workflow_tasks_escalation_level_idx" ON "workflow_tasks" USING btree ("escalation_level");--> statement-breakpoint
CREATE INDEX "hp_company_id_idx" ON "historical_patterns" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "hp_pattern_type_idx" ON "historical_patterns" USING btree ("pattern_type");--> statement-breakpoint
CREATE INDEX "hp_subject_key_idx" ON "historical_patterns" USING btree ("subject_key");--> statement-breakpoint
CREATE INDEX "psr_company_id_idx" ON "pre_shipment_risk_reports" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "psr_shipment_id_idx" ON "pre_shipment_risk_reports" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "psr_risk_level_idx" ON "pre_shipment_risk_reports" USING btree ("risk_level");--> statement-breakpoint
CREATE INDEX "psr_overall_risk_idx" ON "pre_shipment_risk_reports" USING btree ("overall_risk_score");--> statement-breakpoint
CREATE INDEX "pa_company_id_idx" ON "predictive_alerts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "pa_alert_type_idx" ON "predictive_alerts" USING btree ("alert_type");--> statement-breakpoint
CREATE INDEX "pa_severity_idx" ON "predictive_alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "pa_status_idx" ON "predictive_alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bd_company_id_idx" ON "booking_decisions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "bd_shipment_id_idx" ON "booking_decisions" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "bd_status_idx" ON "booking_decisions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mp_company_id_idx" ON "mitigation_playbooks" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "mp_shipment_id_idx" ON "mitigation_playbooks" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "mp_status_idx" ON "mitigation_playbooks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rgh_company_id_idx" ON "release_gate_holds" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "rgh_shipment_id_idx" ON "release_gate_holds" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "rgh_gate_type_idx" ON "release_gate_holds" USING btree ("gate_type");--> statement-breakpoint
CREATE INDEX "rgh_status_idx" ON "release_gate_holds" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sc_company_id_idx" ON "scenario_comparisons" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "sc_shipment_id_idx" ON "scenario_comparisons" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "ca_company_idx" ON "carrier_allocations" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "ca_carrier_idx" ON "carrier_allocations" USING btree ("carrier_name");--> statement-breakpoint
CREATE INDEX "ca_allocation_idx" ON "carrier_allocations" USING btree ("allocation");--> statement-breakpoint
CREATE INDEX "ia_company_idx" ON "intervention_attributions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "ia_period_idx" ON "intervention_attributions" USING btree ("period");--> statement-breakpoint
CREATE INDEX "ia_computed_idx" ON "intervention_attributions" USING btree ("computed_at");--> statement-breakpoint
CREATE INDEX "ls_company_idx" ON "lane_strategies" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "ls_origin_idx" ON "lane_strategies" USING btree ("origin_port");--> statement-breakpoint
CREATE INDEX "ls_dest_idx" ON "lane_strategies" USING btree ("destination_port");--> statement-breakpoint
CREATE INDEX "ls_strategy_idx" ON "lane_strategies" USING btree ("strategy");--> statement-breakpoint
CREATE INDEX "nr_company_idx" ON "network_recommendations" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "nr_scope_idx" ON "network_recommendations" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "nr_type_idx" ON "network_recommendations" USING btree ("type");--> statement-breakpoint
CREATE INDEX "nr_status_idx" ON "network_recommendations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "nr_fingerprint_idx" ON "network_recommendations" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "ps_company_idx" ON "portfolio_snapshots" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "ps_period_idx" ON "portfolio_snapshots" USING btree ("period");--> statement-breakpoint
CREATE INDEX "ps_snapshot_idx" ON "portfolio_snapshots" USING btree ("snapshot_at");--> statement-breakpoint
CREATE INDEX "om_company_id_idx" ON "operating_modes" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "om_mode_name_idx" ON "operating_modes" USING btree ("mode_name");--> statement-breakpoint
CREATE INDEX "om_is_active_idx" ON "operating_modes" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "ps_company_id_idx" ON "policy_simulations" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "ps_created_at_idx" ON "policy_simulations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "pv_company_id_idx" ON "policy_versions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "pv_policy_id_idx" ON "policy_versions" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "pv_created_at_idx" ON "policy_versions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "rs_company_id_idx" ON "report_snapshots" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "rs_report_type_idx" ON "report_snapshots" USING btree ("report_type");--> statement-breakpoint
CREATE INDEX "rs_created_at_idx" ON "report_snapshots" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tp_company_id_idx" ON "tenant_policies" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "tp_policy_key_idx" ON "tenant_policies" USING btree ("policy_key");--> statement-breakpoint
CREATE INDEX "tp_category_idx" ON "tenant_policies" USING btree ("category");--> statement-breakpoint
CREATE INDEX "tp_company_key_idx" ON "tenant_policies" USING btree ("company_id","policy_key");--> statement-breakpoint
CREATE INDEX "ai_usage_logs_company_id_idx" ON "ai_usage_logs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "ai_usage_logs_task_type_idx" ON "ai_usage_logs" USING btree ("task_type");--> statement-breakpoint
CREATE INDEX "ai_usage_logs_created_at_idx" ON "ai_usage_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "bfr_company_id_idx" ON "balance_financing_records" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "bfr_invoice_id_idx" ON "balance_financing_records" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "bfr_customer_id_idx" ON "balance_financing_records" USING btree ("customer_billing_profile_id");--> statement-breakpoint
CREATE INDEX "bfr_status_idx" ON "balance_financing_records" USING btree ("application_status");--> statement-breakpoint
CREATE UNIQUE INDEX "bfr_invoice_id_unique_idx" ON "balance_financing_records" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "billing_accounts_company_id_idx" ON "billing_accounts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "charge_rules_company_id_idx" ON "charge_rules" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "charge_rules_billing_account_idx" ON "charge_rules" USING btree ("billing_account_id");--> statement-breakpoint
CREATE INDEX "charge_rules_charge_type_idx" ON "charge_rules" USING btree ("charge_type");--> statement-breakpoint
CREATE INDEX "charge_rules_active_idx" ON "charge_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "ce_company_id_idx" ON "commercial_events" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "ce_event_type_idx" ON "commercial_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "ce_entity_id_idx" ON "commercial_events" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "ce_created_at_idx" ON "commercial_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "cbp_company_id_idx" ON "customer_billing_profiles" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "cbp_billing_account_id_idx" ON "customer_billing_profiles" USING btree ("billing_account_id");--> statement-breakpoint
CREATE INDEX "cbp_status_idx" ON "customer_billing_profiles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "cbp_risk_status_idx" ON "customer_billing_profiles" USING btree ("risk_status");--> statement-breakpoint
CREATE INDEX "ili_invoice_id_idx" ON "invoice_line_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "ili_shipment_id_idx" ON "invoice_line_items" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "poc_company_id_idx" ON "payment_option_configs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "poc_billing_account_id_idx" ON "payment_option_configs" USING btree ("billing_account_id");--> statement-breakpoint
CREATE INDEX "receivables_company_id_idx" ON "receivables" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "receivables_invoice_id_idx" ON "receivables" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "receivables_customer_id_idx" ON "receivables" USING btree ("customer_billing_profile_id");--> statement-breakpoint
CREATE INDEX "receivables_collections_status_idx" ON "receivables" USING btree ("collections_status");--> statement-breakpoint
CREATE INDEX "receivables_due_date_idx" ON "receivables" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "doc_validation_results_company_id_idx" ON "document_validation_results" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "doc_validation_results_shipment_id_uniq" ON "document_validation_results" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "doc_validation_results_status_idx" ON "document_validation_results" USING btree ("status");--> statement-breakpoint
CREATE INDEX "routing_pricing_results_company_id_idx" ON "routing_pricing_results" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "routing_pricing_results_shipment_id_uniq" ON "routing_pricing_results" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "routing_pricing_results_analyzed_at_idx" ON "routing_pricing_results" USING btree ("analyzed_at");--> statement-breakpoint
CREATE INDEX "shipment_decisions_company_id_idx" ON "shipment_decisions" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shipment_decisions_shipment_id_uniq" ON "shipment_decisions" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "shipment_decisions_final_status_idx" ON "shipment_decisions" USING btree ("final_status");--> statement-breakpoint
CREATE INDEX "shipment_decisions_decided_at_idx" ON "shipment_decisions" USING btree ("decided_at");--> statement-breakpoint
CREATE INDEX "shipment_events_company_id_idx" ON "shipment_events" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "shipment_events_shipment_id_idx" ON "shipment_events" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "shipment_events_event_type_idx" ON "shipment_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "shipment_events_event_timestamp_idx" ON "shipment_events" USING btree ("event_timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "shipment_events_dedup_idx" ON "shipment_events" USING btree ("shipment_id","event_type","event_timestamp");--> statement-breakpoint
CREATE INDEX "gen_docs_company_id_idx" ON "shipment_documents_generated" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "gen_docs_shipment_id_idx" ON "shipment_documents_generated" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "gen_docs_doc_type_idx" ON "shipment_documents_generated" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "gen_docs_status_idx" ON "shipment_documents_generated" USING btree ("generation_status");--> statement-breakpoint
CREATE INDEX "gen_docs_shipment_type_idx" ON "shipment_documents_generated" USING btree ("shipment_id","document_type");--> statement-breakpoint
CREATE INDEX "carrier_invoices_company_idx" ON "carrier_invoices" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "carrier_invoices_shipment_idx" ON "carrier_invoices" USING btree ("shipment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "carrier_invoices_company_invoice_number_idx" ON "carrier_invoices" USING btree ("company_id","invoice_number");--> statement-breakpoint
CREATE INDEX "reconciliation_results_company_idx" ON "reconciliation_results" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "reconciliation_results_shipment_idx" ON "reconciliation_results" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "reconciliation_results_carrier_invoice_idx" ON "reconciliation_results" USING btree ("carrier_invoice_id");--> statement-breakpoint
CREATE INDEX "quote_line_items_quote_id_idx" ON "quote_line_items" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "quotes_company_id_idx" ON "quotes" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "quotes_customer_id_idx" ON "quotes" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "quotes_status_idx" ON "quotes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "quotes_created_at_idx" ON "quotes" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_company_quote_number_idx" ON "quotes" USING btree ("company_id","quote_number");--> statement-breakpoint
CREATE UNIQUE INDEX "acc_conn_company_provider_uniq" ON "accounting_connections" USING btree ("company_id","provider");--> statement-breakpoint
CREATE INDEX "acc_conn_company_id_idx" ON "accounting_connections" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "acc_conn_status_idx" ON "accounting_connections" USING btree ("connection_status");--> statement-breakpoint
CREATE UNIQUE INDEX "acc_sync_entity_uniq" ON "accounting_sync_mappings" USING btree ("connection_id","entity_type","dynasties_entity_id");--> statement-breakpoint
CREATE INDEX "acc_sync_company_id_idx" ON "accounting_sync_mappings" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "acc_sync_connection_id_idx" ON "accounting_sync_mappings" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "acc_sync_entity_type_idx" ON "accounting_sync_mappings" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "acc_sync_status_idx" ON "accounting_sync_mappings" USING btree ("sync_status");--> statement-breakpoint
CREATE INDEX "acc_sync_external_id_idx" ON "accounting_sync_mappings" USING btree ("external_entity_id");--> statement-breakpoint
CREATE INDEX "ai_event_log_company_idx" ON "ai_event_log" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "ai_event_log_shipment_idx" ON "ai_event_log" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "ai_event_log_event_type_idx" ON "ai_event_log" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "ai_event_log_created_idx" ON "ai_event_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_analysis_runs_company_idx" ON "shipment_ai_analysis_runs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "ai_analysis_runs_shipment_idx" ON "shipment_ai_analysis_runs" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "ai_analysis_runs_trigger_idx" ON "shipment_ai_analysis_runs" USING btree ("trigger_type");--> statement-breakpoint
CREATE INDEX "ai_analysis_runs_status_idx" ON "shipment_ai_analysis_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_analysis_runs_created_idx" ON "shipment_ai_analysis_runs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shipment_ai_state_shipment_uniq" ON "shipment_ai_state" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "shipment_ai_state_company_idx" ON "shipment_ai_state" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "shipment_ai_state_status_idx" ON "shipment_ai_state" USING btree ("analysis_status");--> statement-breakpoint
CREATE INDEX "shipment_ai_state_risk_idx" ON "shipment_ai_state" USING btree ("risk_score");--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_webhook_event_id_uniq" ON "stripe_webhook_events" USING btree ("stripe_event_id");--> statement-breakpoint
CREATE INDEX "stripe_webhook_status_idx" ON "stripe_webhook_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "stripe_webhook_received_idx" ON "stripe_webhook_events" USING btree ("received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_clerk_id_idx" ON "users" USING btree ("clerk_id");--> statement-breakpoint
CREATE INDEX "invoices_customer_bp_idx" ON "invoices" USING btree ("customer_billing_profile_id");--> statement-breakpoint
CREATE INDEX "invoices_due_date_idx" ON "invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "exceptions_detected_from_idx" ON "exceptions" USING btree ("detected_from");--> statement-breakpoint
CREATE INDEX "exceptions_assigned_to_idx" ON "exceptions" USING btree ("assigned_to_user_id");--> statement-breakpoint
CREATE INDEX "recommendations_fingerprint_idx" ON "recommendations" USING btree ("fingerprint");