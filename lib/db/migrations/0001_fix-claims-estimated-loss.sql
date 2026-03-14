DROP INDEX "compliance_screenings_shipment_id_idx";--> statement-breakpoint
DROP INDEX "risk_scores_shipment_id_idx";--> statement-breakpoint
DROP INDEX "insurance_quotes_shipment_id_idx";--> statement-breakpoint
ALTER TABLE "insurance_quotes" ALTER COLUMN "estimated_insured_value" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "insurance_quotes" ALTER COLUMN "estimated_premium" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "shipment_charges" ALTER COLUMN "unit_price" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "shipment_charges" ALTER COLUMN "total_amount" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "shipment_charges" ALTER COLUMN "tax_rate" SET DATA TYPE numeric(5, 4);--> statement-breakpoint
ALTER TABLE "shipment_charges" ALTER COLUMN "tax_rate" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "shipment_charges" ALTER COLUMN "tax_amount" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "shipment_charges" ALTER COLUMN "tax_amount" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "rate_tables" ALTER COLUMN "unit_price" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "subtotal" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "tax_total" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "tax_total" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "grand_total" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "trade_lane_stats" ALTER COLUMN "avg_cost" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "trade_lane_stats" ALTER COLUMN "min_cost" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "trade_lane_stats" ALTER COLUMN "max_cost" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "claims" ALTER COLUMN "estimated_loss" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_screenings_shipment_id_uniq" ON "compliance_screenings" USING btree ("shipment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "risk_scores_shipment_id_uniq" ON "risk_scores" USING btree ("shipment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "insurance_quotes_shipment_id_uniq" ON "insurance_quotes" USING btree ("shipment_id");