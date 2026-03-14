CREATE TABLE "companies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"contact_email" text,
	"ses_email_address" text,
	"settings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "ingested_emails" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"message_id" text NOT NULL,
	"from_address" text NOT NULL,
	"to_address" text NOT NULL,
	"subject" text,
	"body_text" text,
	"s3_key" text NOT NULL,
	"attachment_count" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingested_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"email_id" text,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"document_type" text NOT NULL,
	"document_type_confidence" real,
	"s3_key" text NOT NULL,
	"extracted_data" jsonb,
	"extraction_status" text NOT NULL,
	"extraction_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"entity_type" text NOT NULL,
	"status" text NOT NULL,
	"address" text,
	"city" text,
	"country" text,
	"contact_email" text,
	"contact_phone" text,
	"tax_id" text,
	"scac_code" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"reference" text NOT NULL,
	"status" text NOT NULL,
	"shipper_id" text,
	"consignee_id" text,
	"notify_party_id" text,
	"carrier_id" text,
	"port_of_loading" text,
	"port_of_discharge" text,
	"place_of_receipt" text,
	"place_of_delivery" text,
	"vessel" text,
	"voyage" text,
	"commodity" text,
	"hs_code" text,
	"package_count" integer,
	"gross_weight" real,
	"weight_unit" text,
	"volume" real,
	"volume_unit" text,
	"freight_terms" text,
	"incoterms" text,
	"etd" timestamp,
	"eta" timestamp,
	"booking_number" text,
	"bl_number" text,
	"operator_notes" text,
	"approved_at" timestamp,
	"approved_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"shipment_id" text NOT NULL,
	"document_id" text,
	"document_type" text NOT NULL,
	"s3_key" text,
	"is_generated" boolean DEFAULT false NOT NULL,
	"generated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_screenings" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"shipment_id" text NOT NULL,
	"status" text NOT NULL,
	"screened_parties" integer NOT NULL,
	"match_count" integer DEFAULT 0 NOT NULL,
	"matches" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"lists_checked" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"screened_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"shipment_id" text NOT NULL,
	"composite_score" real NOT NULL,
	"sub_scores" jsonb NOT NULL,
	"primary_risk_factors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recommended_action" text NOT NULL,
	"scored_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insurance_quotes" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"shipment_id" text NOT NULL,
	"coverage_type" text NOT NULL,
	"estimated_insured_value" real NOT NULL,
	"estimated_premium" real NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"coverage_rationale" text NOT NULL,
	"exclusions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence_score" real NOT NULL,
	"quoted_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operator_corrections" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"shipment_id" text NOT NULL,
	"field_name" text NOT NULL,
	"original_value" jsonb,
	"corrected_value" jsonb,
	"original_confidence" real,
	"corrected_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"event_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"actor_type" text,
	"user_id" text,
	"service_id" text,
	"before_state" jsonb,
	"after_state" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment_charges" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"shipment_id" text NOT NULL,
	"charge_code" text NOT NULL,
	"description" text NOT NULL,
	"charge_type" text NOT NULL,
	"quantity" real DEFAULT 1 NOT NULL,
	"unit_price" real NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"total_amount" real NOT NULL,
	"tax_rate" real DEFAULT 0,
	"tax_amount" real DEFAULT 0,
	"source" text NOT NULL,
	"rate_table_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_tables" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"carrier" text NOT NULL,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"container_type" text,
	"charge_code" text NOT NULL,
	"description" text NOT NULL,
	"unit_price" real NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"valid_from" timestamp,
	"valid_to" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"shipment_id" text NOT NULL,
	"invoice_number" text NOT NULL,
	"status" text NOT NULL,
	"bill_to_entity_id" text,
	"subtotal" real NOT NULL,
	"tax_total" real DEFAULT 0 NOT NULL,
	"grand_total" real NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"line_items" jsonb NOT NULL,
	"due_date" timestamp,
	"issued_at" timestamp,
	"pdf_storage_key" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "exceptions" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"shipment_id" text,
	"exception_type" text NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"detected_by" text NOT NULL,
	"impact_summary" text,
	"recommended_action" text,
	"requires_escalation" boolean DEFAULT false NOT NULL,
	"agent_classification" jsonb,
	"resolved_by" text,
	"resolved_at" timestamp,
	"resolution_notes" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_lane_stats" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"carrier" text,
	"shipment_count" integer DEFAULT 0 NOT NULL,
	"avg_cost" real,
	"min_cost" real,
	"max_cost" real,
	"avg_transit_days" real,
	"delay_count" integer DEFAULT 0 NOT NULL,
	"delay_frequency" real,
	"avg_document_count" real,
	"document_complexity" text,
	"carrier_performance_score" real,
	"agent_advisory" jsonb,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"shipment_id" text NOT NULL,
	"claim_number" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"claim_type" text NOT NULL,
	"incident_date" timestamp,
	"incident_description" text NOT NULL,
	"estimated_loss" real,
	"currency" text DEFAULT 'USD' NOT NULL,
	"claim_narrative" text,
	"required_documents" jsonb,
	"coverage_analysis" jsonb,
	"submission_recommendation" text,
	"evidence_keys" jsonb,
	"filed_by" text,
	"filed_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "claims_claim_number_unique" UNIQUE("claim_number")
);
--> statement-breakpoint
CREATE TABLE "claim_communications" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"claim_id" text NOT NULL,
	"direction" text NOT NULL,
	"communication_type" text NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"attachment_keys" jsonb,
	"author" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingested_emails" ADD CONSTRAINT "ingested_emails_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingested_documents" ADD CONSTRAINT "ingested_documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingested_documents" ADD CONSTRAINT "ingested_documents_email_id_ingested_emails_id_fk" FOREIGN KEY ("email_id") REFERENCES "public"."ingested_emails"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_shipper_id_entities_id_fk" FOREIGN KEY ("shipper_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_consignee_id_entities_id_fk" FOREIGN KEY ("consignee_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_notify_party_id_entities_id_fk" FOREIGN KEY ("notify_party_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_carrier_id_entities_id_fk" FOREIGN KEY ("carrier_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_documents" ADD CONSTRAINT "shipment_documents_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_documents" ADD CONSTRAINT "shipment_documents_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_documents" ADD CONSTRAINT "shipment_documents_document_id_ingested_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."ingested_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_screenings" ADD CONSTRAINT "compliance_screenings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_screenings" ADD CONSTRAINT "compliance_screenings_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_scores" ADD CONSTRAINT "risk_scores_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_scores" ADD CONSTRAINT "risk_scores_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_quotes" ADD CONSTRAINT "insurance_quotes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_quotes" ADD CONSTRAINT "insurance_quotes_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_corrections" ADD CONSTRAINT "operator_corrections_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operator_corrections" ADD CONSTRAINT "operator_corrections_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_charges" ADD CONSTRAINT "shipment_charges_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_charges" ADD CONSTRAINT "shipment_charges_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_tables" ADD CONSTRAINT "rate_tables_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_lane_stats" ADD CONSTRAINT "trade_lane_stats_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_communications" ADD CONSTRAINT "claim_communications_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claim_communications" ADD CONSTRAINT "claim_communications_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "companies_slug_idx" ON "companies" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "users_company_id_idx" ON "users" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "ingested_emails_company_id_idx" ON "ingested_emails" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "ingested_emails_status_idx" ON "ingested_emails" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ingested_emails_created_at_idx" ON "ingested_emails" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ingested_documents_company_id_idx" ON "ingested_documents" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "ingested_documents_email_id_idx" ON "ingested_documents" USING btree ("email_id");--> statement-breakpoint
CREATE INDEX "ingested_documents_status_idx" ON "ingested_documents" USING btree ("extraction_status");--> statement-breakpoint
CREATE INDEX "ingested_documents_type_idx" ON "ingested_documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "entities_company_id_idx" ON "entities" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "entities_normalized_name_idx" ON "entities" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "entities_type_idx" ON "entities" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "entities_status_idx" ON "entities" USING btree ("status");--> statement-breakpoint
CREATE INDEX "shipments_company_id_idx" ON "shipments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "shipments_status_idx" ON "shipments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "shipments_reference_idx" ON "shipments" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "shipments_created_at_idx" ON "shipments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "shipments_shipper_id_idx" ON "shipments" USING btree ("shipper_id");--> statement-breakpoint
CREATE INDEX "shipments_consignee_id_idx" ON "shipments" USING btree ("consignee_id");--> statement-breakpoint
CREATE INDEX "shipment_documents_company_id_idx" ON "shipment_documents" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "shipment_documents_shipment_id_idx" ON "shipment_documents" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "shipment_documents_type_idx" ON "shipment_documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "compliance_screenings_company_id_idx" ON "compliance_screenings" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "compliance_screenings_shipment_id_idx" ON "compliance_screenings" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "compliance_screenings_status_idx" ON "compliance_screenings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "risk_scores_company_id_idx" ON "risk_scores" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "risk_scores_shipment_id_idx" ON "risk_scores" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "insurance_quotes_company_id_idx" ON "insurance_quotes" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "insurance_quotes_shipment_id_idx" ON "insurance_quotes" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "operator_corrections_company_id_idx" ON "operator_corrections" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "operator_corrections_shipment_id_idx" ON "operator_corrections" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "events_company_id_idx" ON "events" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "events_event_type_idx" ON "events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "events_entity_id_idx" ON "events" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "events_created_at_idx" ON "events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "events_actor_type_idx" ON "events" USING btree ("actor_type");--> statement-breakpoint
CREATE INDEX "shipment_charges_company_id_idx" ON "shipment_charges" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "shipment_charges_shipment_id_idx" ON "shipment_charges" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "rate_tables_company_id_idx" ON "rate_tables" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "rate_tables_carrier_idx" ON "rate_tables" USING btree ("carrier");--> statement-breakpoint
CREATE INDEX "rate_tables_origin_dest_idx" ON "rate_tables" USING btree ("origin","destination");--> statement-breakpoint
CREATE INDEX "invoices_company_id_idx" ON "invoices" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "invoices_shipment_id_idx" ON "invoices" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "invoices_invoice_number_idx" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "exceptions_company_id_idx" ON "exceptions" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "exceptions_shipment_id_idx" ON "exceptions" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "exceptions_type_idx" ON "exceptions" USING btree ("exception_type");--> statement-breakpoint
CREATE INDEX "exceptions_status_idx" ON "exceptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "exceptions_severity_idx" ON "exceptions" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "trade_lane_stats_company_id_idx" ON "trade_lane_stats" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "trade_lane_stats_origin_dest_idx" ON "trade_lane_stats" USING btree ("origin","destination");--> statement-breakpoint
CREATE INDEX "trade_lane_stats_carrier_idx" ON "trade_lane_stats" USING btree ("carrier");--> statement-breakpoint
CREATE INDEX "claims_company_id_idx" ON "claims" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "claims_shipment_id_idx" ON "claims" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "claims_status_idx" ON "claims" USING btree ("status");--> statement-breakpoint
CREATE INDEX "claims_type_idx" ON "claims" USING btree ("claim_type");--> statement-breakpoint
CREATE INDEX "claim_communications_company_id_idx" ON "claim_communications" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "claim_communications_claim_id_idx" ON "claim_communications" USING btree ("claim_id");