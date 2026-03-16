CREATE TABLE "container_types" (
	"code" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"length_ft" integer NOT NULL,
	"category" text NOT NULL,
	"max_payload_kg" integer,
	"teu" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"region" text,
	"sub_region" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "currencies" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hs_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"chapter" text NOT NULL,
	"section" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incoterms" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ports" (
	"locode" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"country" text NOT NULL,
	"country_code" text NOT NULL,
	"port_type" text NOT NULL,
	"latitude" text,
	"longitude" text,
	"timezone" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"shipment_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"explanation" text NOT NULL,
	"reason_codes" jsonb NOT NULL,
	"confidence" real NOT NULL,
	"urgency" text NOT NULL,
	"expected_delay_impact_days" real,
	"expected_margin_impact_pct" real,
	"expected_risk_reduction" real,
	"recommended_action" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"source_agent" text NOT NULL,
	"source_data" jsonb,
	"expires_at" timestamp,
	"responded_at" timestamp,
	"responded_by" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendation_outcomes" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"recommendation_id" text NOT NULL,
	"shipment_id" text NOT NULL,
	"action" text NOT NULL,
	"modification_notes" text,
	"actor_id" text NOT NULL,
	"actor_type" text NOT NULL,
	"actual_delay_days" real,
	"actual_claim_occurred" text,
	"actual_cost_delta" numeric(12, 2),
	"actual_margin_delta" numeric(12, 2),
	"post_decision_notes" text,
	"outcome_evaluation" text DEFAULT 'PENDING',
	"outcome_data" jsonb,
	"decided_at" timestamp DEFAULT now() NOT NULL,
	"evaluated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_graph_edges" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"edge_type" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"weight" real DEFAULT 1,
	"occurrence_count" integer DEFAULT 1 NOT NULL,
	"confidence" real,
	"first_seen" timestamp DEFAULT now() NOT NULL,
	"last_seen" timestamp DEFAULT now() NOT NULL,
	"source_metadata" text,
	"properties" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dead_letter_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"queue_name" text NOT NULL,
	"job_body" jsonb NOT NULL,
	"error_message" text NOT NULL,
	"error_stack" text,
	"attempt_count" integer NOT NULL,
	"status" text DEFAULT 'FAILED' NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "industry" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "trade_lanes" jsonb;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "contact_phone" text;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_outcomes" ADD CONSTRAINT "recommendation_outcomes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_outcomes" ADD CONSTRAINT "recommendation_outcomes_recommendation_id_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."recommendations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_outcomes" ADD CONSTRAINT "recommendation_outcomes_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_graph_edges" ADD CONSTRAINT "trade_graph_edges_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "countries_region_idx" ON "countries" USING btree ("region");--> statement-breakpoint
CREATE INDEX "hs_codes_chapter_idx" ON "hs_codes" USING btree ("chapter");--> statement-breakpoint
CREATE INDEX "ports_country_code_idx" ON "ports" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "ports_type_idx" ON "ports" USING btree ("port_type");--> statement-breakpoint
CREATE INDEX "recommendations_company_id_idx" ON "recommendations" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "recommendations_shipment_id_idx" ON "recommendations" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "recommendations_type_idx" ON "recommendations" USING btree ("type");--> statement-breakpoint
CREATE INDEX "recommendations_status_idx" ON "recommendations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "recommendations_urgency_idx" ON "recommendations" USING btree ("urgency");--> statement-breakpoint
CREATE INDEX "recommendations_created_at_idx" ON "recommendations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "rec_outcomes_company_id_idx" ON "recommendation_outcomes" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "rec_outcomes_recommendation_id_idx" ON "recommendation_outcomes" USING btree ("recommendation_id");--> statement-breakpoint
CREATE INDEX "rec_outcomes_shipment_id_idx" ON "recommendation_outcomes" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "rec_outcomes_action_idx" ON "recommendation_outcomes" USING btree ("action");--> statement-breakpoint
CREATE INDEX "rec_outcomes_evaluation_idx" ON "recommendation_outcomes" USING btree ("outcome_evaluation");--> statement-breakpoint
CREATE INDEX "tge_company_id_idx" ON "trade_graph_edges" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "tge_edge_type_idx" ON "trade_graph_edges" USING btree ("edge_type");--> statement-breakpoint
CREATE INDEX "tge_source_idx" ON "trade_graph_edges" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "tge_target_idx" ON "trade_graph_edges" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "tge_last_seen_idx" ON "trade_graph_edges" USING btree ("last_seen");--> statement-breakpoint
CREATE INDEX "dlj_queue_name_idx" ON "dead_letter_jobs" USING btree ("queue_name");--> statement-breakpoint
CREATE INDEX "dlj_status_idx" ON "dead_letter_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dlj_created_at_idx" ON "dead_letter_jobs" USING btree ("created_at");