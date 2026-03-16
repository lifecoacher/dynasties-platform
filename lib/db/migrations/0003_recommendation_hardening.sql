ALTER TABLE "recommendations" ADD COLUMN "fingerprint" text;
ALTER TABLE "recommendations" ADD COLUMN "superseded_by_id" text;

CREATE INDEX "recommendations_fingerprint_idx" ON "recommendations" USING btree ("fingerprint");

CREATE UNIQUE INDEX "recommendations_active_fingerprint_idx"
  ON "recommendations" ("shipment_id", "fingerprint")
  WHERE status IN ('PENDING', 'SHOWN');
