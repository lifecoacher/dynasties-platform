-- ============================================================
-- DYNASTIES PILOT SCENARIO SEED
-- Lorian Freight Solutions — Operational Week of April 7, 2026
-- ============================================================
-- Scenario: 4 shipments in different lifecycle stages,
-- connected to real intelligence signals, with recommendations,
-- tasks, exceptions, and invoices that tell a coherent story.
-- ============================================================

BEGIN;

-- ============================================================
-- PHASE 0: CLEAN EXISTING SCATTERED DATA
-- Remove test/junk records in dependency order
-- ============================================================

DELETE FROM task_events WHERE company_id = 'cmp_lorian_001';
DELETE FROM policy_decisions WHERE company_id = 'cmp_lorian_001';
DELETE FROM operational_notifications WHERE company_id = 'cmp_lorian_001';

DELETE FROM balance_financing_records WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = 'cmp_lorian_001');
DELETE FROM receivables WHERE company_id = 'cmp_lorian_001';
DELETE FROM invoice_line_items WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = 'cmp_lorian_001');
DELETE FROM invoices WHERE company_id = 'cmp_lorian_001';

DELETE FROM exceptions WHERE company_id = 'cmp_lorian_001';
DELETE FROM workflow_tasks WHERE company_id = 'cmp_lorian_001';
DELETE FROM recommendation_outcomes WHERE recommendation_id IN (SELECT id FROM recommendations WHERE company_id = 'cmp_lorian_001');
DELETE FROM recommendation_outcomes WHERE shipment_id IN (SELECT id FROM shipments WHERE company_id = 'cmp_lorian_001');
DELETE FROM recommendations WHERE company_id = 'cmp_lorian_001';

DELETE FROM ai_event_log WHERE shipment_id IN (SELECT id FROM shipments WHERE company_id = 'cmp_lorian_001');
DELETE FROM shipment_ai_analysis_runs WHERE shipment_id IN (SELECT id FROM shipments WHERE company_id = 'cmp_lorian_001');
DELETE FROM shipment_ai_state WHERE shipment_id IN (SELECT id FROM shipments WHERE company_id = 'cmp_lorian_001');
DELETE FROM shipment_events WHERE shipment_id IN (SELECT id FROM shipments WHERE company_id = 'cmp_lorian_001');
DELETE FROM shipment_intelligence_snapshots WHERE shipment_id IN (SELECT id FROM shipments WHERE company_id = 'cmp_lorian_001');
DELETE FROM shipment_documents WHERE shipment_id IN (SELECT id FROM shipments WHERE company_id = 'cmp_lorian_001');
DELETE FROM shipment_documents_generated WHERE shipment_id IN (SELECT id FROM shipments WHERE company_id = 'cmp_lorian_001');
DELETE FROM shipment_charges WHERE shipment_id IN (SELECT id FROM shipments WHERE company_id = 'cmp_lorian_001');
DELETE FROM shipment_decisions WHERE shipment_id IN (SELECT id FROM shipments WHERE company_id = 'cmp_lorian_001');
DELETE FROM risk_scores WHERE shipment_id IN (SELECT id FROM shipments WHERE company_id = 'cmp_lorian_001');
DELETE FROM compliance_screenings WHERE shipment_id IN (SELECT id FROM shipments WHERE company_id = 'cmp_lorian_001');
DELETE FROM document_validation_results WHERE shipment_id IN (SELECT id FROM shipments WHERE company_id = 'cmp_lorian_001');
DELETE FROM booking_decisions WHERE shipment_id IN (SELECT id FROM shipments WHERE company_id = 'cmp_lorian_001');
DELETE FROM reconciliation_results WHERE carrier_invoice_id IN (SELECT id FROM carrier_invoices WHERE shipment_id IN (SELECT id FROM shipments WHERE company_id = 'cmp_lorian_001'));
DELETE FROM carrier_invoices WHERE shipment_id IN (SELECT id FROM shipments WHERE company_id = 'cmp_lorian_001');
DELETE FROM claim_communications WHERE claim_id IN (SELECT id FROM claims WHERE shipment_id IN (SELECT id FROM shipments WHERE company_id = 'cmp_lorian_001'));
DELETE FROM claims WHERE shipment_id IN (SELECT id FROM shipments WHERE company_id = 'cmp_lorian_001');
DELETE FROM insurance_quotes WHERE shipment_id IN (SELECT id FROM shipments WHERE company_id = 'cmp_lorian_001');
DELETE FROM mitigation_playbooks WHERE shipment_id IN (SELECT id FROM shipments WHERE company_id = 'cmp_lorian_001');
DELETE FROM operator_corrections WHERE shipment_id IN (SELECT id FROM shipments WHERE company_id = 'cmp_lorian_001');
DELETE FROM pre_shipment_risk_reports WHERE shipment_id IN (SELECT id FROM shipments WHERE company_id = 'cmp_lorian_001');
DELETE FROM reconciliation_results WHERE shipment_id IN (SELECT id FROM shipments WHERE company_id = 'cmp_lorian_001');
DELETE FROM release_gate_holds WHERE shipment_id IN (SELECT id FROM shipments WHERE company_id = 'cmp_lorian_001');
DELETE FROM routing_pricing_results WHERE shipment_id IN (SELECT id FROM shipments WHERE company_id = 'cmp_lorian_001');
DELETE FROM scenario_comparisons WHERE shipment_id IN (SELECT id FROM shipments WHERE company_id = 'cmp_lorian_001');
UPDATE quotes SET converted_shipment_id = NULL WHERE converted_shipment_id IN (SELECT id FROM shipments WHERE company_id = 'cmp_lorian_001');

DELETE FROM shipments WHERE company_id = 'cmp_lorian_001'
  AND id NOT IN ('shp_lor_001','shp_lor_003','shp_lor_005','shp_lor_007');

-- ============================================================
-- PHASE 1: UPDATE 4 SHIPMENTS — THE SCENARIO
-- ============================================================

-- SHIPMENT 1: "Healthy / On Track"
-- Shanghai → Rotterdam, Sovereign Maersk, consumer electronics
-- Currently transiting Indian Ocean toward Suez, ETA April 15. No issues.
UPDATE shipments SET
  reference = 'LOR-2026-0001',
  status = 'IN_TRANSIT',
  port_of_loading = 'CNSHA',
  port_of_discharge = 'NLRTM',
  vessel = 'Sovereign Maersk',
  voyage = 'SM-426E',
  carrier = 'MAERSK',
  commodity = 'Consumer Electronics (Laptops & Tablets)',
  hs_code = '8471.30',
  package_count = 450,
  gross_weight = 12500,
  weight_unit = 'KG',
  volume = 185,
  volume_unit = 'CBM',
  freight_terms = 'PREPAID',
  incoterms = 'CIF',
  cargo_value = 285000,
  booking_number = 'MAEU-2026-04281',
  bl_number = 'MAEU5284726',
  shipper_id = 'ent_lor_ship_01',
  consignee_id = 'ent_lor_cons_02',
  etd = '2026-03-28 08:00:00',
  eta = '2026-04-15 14:00:00',
  operator_notes = 'Standard transit via Suez. All documents cleared. Tracking normal.',
  updated_at = NOW()
WHERE id = 'shp_lor_001';

-- SHIPMENT 2: "At Risk" — Congestion + Strike + Weather
-- Shanghai → Los Angeles, COSCO Shipping Universe
-- In transit, arriving into critical LA congestion + port strike
UPDATE shipments SET
  reference = 'LOR-2026-0003',
  status = 'IN_TRANSIT',
  port_of_loading = 'CNSHA',
  port_of_discharge = 'USLAX',
  vessel = 'COSCO Shipping Universe',
  voyage = 'CSU-0412W',
  carrier = 'COSCO',
  commodity = 'Auto Parts & Accessories',
  hs_code = '8708.99',
  package_count = 280,
  gross_weight = 18200,
  weight_unit = 'KG',
  volume = 142,
  volume_unit = 'CBM',
  freight_terms = 'PREPAID',
  incoterms = 'FOB',
  cargo_value = 410000,
  booking_number = 'COSU-2026-07832',
  bl_number = 'COSU9417283',
  shipper_id = 'ent_lor_ship_03',
  consignee_id = 'ent_lor_cons_01',
  etd = '2026-03-22 06:00:00',
  eta = '2026-04-09 18:00:00',
  operator_notes = 'ETA at risk — LA port congestion critical + active strike. Reroute under review.',
  updated_at = NOW()
WHERE id = 'shp_lor_003';

-- SHIPMENT 3: "Exception / Problem"
-- Kaohsiung → Savannah, YM Witness (Yang Ming)
-- Arrived at port but held in customs — missing documents
UPDATE shipments SET
  reference = 'LOR-2026-0005',
  status = 'AT_PORT',
  port_of_loading = 'TWKHH',
  port_of_discharge = 'USSAV',
  vessel = 'YM Witness',
  voyage = 'YMW-0326N',
  carrier = 'YANG MING',
  commodity = 'Industrial Chemical Compounds',
  hs_code = '2903.15',
  package_count = 120,
  gross_weight = 24000,
  weight_unit = 'KG',
  volume = 96,
  volume_unit = 'CBM',
  freight_terms = 'COLLECT',
  incoterms = 'DAP',
  cargo_value = 168000,
  booking_number = 'YMLU-2026-03419',
  bl_number = 'YMLU7823941',
  shipper_id = 'ent_lor_ship_05',
  consignee_id = 'ent_lor_cons_03',
  etd = '2026-03-10 10:00:00',
  eta = '2026-04-02 08:00:00',
  operator_notes = 'URGENT: Vessel arrived April 2 but cargo held — customs requires MSDS + Certificate of Origin. Demurrage accruing.',
  updated_at = NOW()
WHERE id = 'shp_lor_005';

-- SHIPMENT 4: "Completed / Delivered"
-- Singapore → Hamburg, CMA CGM Marco Polo
-- Delivered March 28, invoice paid, clean closure
UPDATE shipments SET
  reference = 'LOR-2026-0007',
  status = 'DELIVERED',
  port_of_loading = 'SGSIN',
  port_of_discharge = 'DEHAM',
  vessel = 'CMA CGM Marco Polo',
  voyage = 'CMA-0308E',
  carrier = 'CMA CGM',
  commodity = 'Textile Fabrics (Cotton & Polyester)',
  hs_code = '5208.32',
  package_count = 200,
  gross_weight = 8400,
  weight_unit = 'KG',
  volume = 110,
  volume_unit = 'CBM',
  freight_terms = 'PREPAID',
  incoterms = 'CIF',
  cargo_value = 145000,
  booking_number = 'CMAU-2026-02187',
  bl_number = 'CMAU3829104',
  shipper_id = 'ent_lor_ship_06',
  consignee_id = 'ent_lor_cons_02',
  etd = '2026-03-01 12:00:00',
  eta = '2026-03-28 06:00:00',
  operator_notes = 'Delivered successfully. Final invoice settled. No exceptions.',
  updated_at = NOW()
WHERE id = 'shp_lor_007';


-- ============================================================
-- PHASE 2: RECOMMENDATIONS
-- Tied to shipments + intelligence signals
-- ============================================================

-- REC 1: Route advisory for Shipment 1 (Shanghai → Rotterdam, Suez)
INSERT INTO recommendations (
  id, company_id, shipment_id, type, title, explanation,
  reason_codes, confidence, urgency, recommended_action,
  expected_delay_impact_days, expected_margin_impact_pct, expected_risk_reduction,
  status, source_agent, signal_evidence, created_at, updated_at
) VALUES (
  'rec_pilot_001', 'cmp_lorian_001', 'shp_lor_001',
  'ROUTE_ADJUSTMENT',
  'Monitor Suez Canal transit — capacity reduced',
  'Intelligence indicates Suez Canal operating at reduced capacity due to ongoing restrictions. Shipment LOR-2026-0001 is routed via Suez on Sovereign Maersk (voyage SM-426E). Current transit is on schedule, but delays of 1-2 days are possible at canal entry. English Channel fog advisories also noted near destination.',
  '["SUEZ_CAPACITY_REDUCTION","WEATHER_FOG_ADVISORY"]',
  0.72, 'MEDIUM',
  'Continue monitoring vessel tracking. Notify consignee of potential 1-2 day delay window. No reroute needed at this time.',
  1.5, -0.8, 0.15,
  'SHOWN', 'decision-engine',
  '[{"type":"disruption","title":"Suez Canal Capacity Reduction","severity":"high"},{"type":"weather","title":"Dense Fog Advisory — English Channel","severity":"medium"}]',
  '2026-04-06 09:00:00', '2026-04-06 09:00:00'
);

-- REC 2: Critical reroute for Shipment 2 (Shanghai → LA, port strike)
INSERT INTO recommendations (
  id, company_id, shipment_id, type, title, explanation,
  reason_codes, confidence, urgency, recommended_action,
  expected_delay_impact_days, expected_margin_impact_pct, expected_risk_reduction,
  status, source_agent, signal_evidence, created_at, updated_at
) VALUES (
  'rec_pilot_002', 'cmp_lorian_001', 'shp_lor_003',
  'ROUTE_ADJUSTMENT',
  'Reroute via Long Beach — LA port strike active',
  'Los Angeles port is experiencing critical congestion compounded by an active port workers strike. COSCO Shipping Universe (voyage CSU-0412W) carrying auto parts valued at $410K is currently en route with ETA April 9. Recommend immediate reroute to Port of Long Beach or Oakland to avoid 5-8 day berthing delay. Carrier COSCO has confirmed Long Beach berth availability for April 10.',
  '["PORT_STRIKE_ACTIVE","CRITICAL_CONGESTION","BERTH_UNAVAILABLE"]',
  0.91, 'CRITICAL',
  'Contact COSCO operations desk to request diversion to Long Beach. Update consignee Pacific Coast Importers on revised ETA. File amended customs entry for USLGB.',
  6.0, -3.2, 0.65,
  'PENDING', 'decision-engine',
  '[{"type":"disruption","title":"Los Angeles Port Workers Strike","severity":"critical"},{"type":"port_congestion","portCode":"USLAX","congestionLevel":"critical"},{"type":"weather","title":"Typhoon Haikui — Western Pacific","severity":"critical"}]',
  '2026-04-07 06:30:00', '2026-04-07 06:30:00'
);

-- REC 3: Weather risk for Shipment 2
INSERT INTO recommendations (
  id, company_id, shipment_id, type, title, explanation,
  reason_codes, confidence, urgency, recommended_action,
  expected_delay_impact_days, expected_margin_impact_pct, expected_risk_reduction,
  status, source_agent, signal_evidence, created_at, updated_at
) VALUES (
  'rec_pilot_003', 'cmp_lorian_001', 'shp_lor_003',
  'RISK_MITIGATION',
  'Typhoon Haikui — assess cargo insurance coverage',
  'Typhoon Haikui is active in the Western Pacific with critical severity. COSCO Shipping Universe is transiting this region. Current cargo insurance may not cover weather-related delays or damage at standard rates. Recommend reviewing policy terms and considering supplemental coverage for the $410K auto parts cargo.',
  '["TYPHOON_ACTIVE","CARGO_EXPOSURE","INSURANCE_GAP"]',
  0.84, 'HIGH',
  'Review cargo insurance policy for weather exclusions. Request supplemental coverage quote from underwriter. Document vessel position relative to storm track.',
  2.0, -1.5, 0.45,
  'PENDING', 'decision-engine',
  '[{"type":"weather","title":"Typhoon Haikui — Western Pacific","severity":"critical"}]',
  '2026-04-07 06:35:00', '2026-04-07 06:35:00'
);

-- REC 4: Compliance escalation for Shipment 3 (customs hold)
INSERT INTO recommendations (
  id, company_id, shipment_id, type, title, explanation,
  reason_codes, confidence, urgency, recommended_action,
  expected_delay_impact_days, expected_margin_impact_pct, expected_risk_reduction,
  status, source_agent, signal_evidence, created_at, updated_at
) VALUES (
  'rec_pilot_004', 'cmp_lorian_001', 'shp_lor_005',
  'COMPLIANCE_ESCALATION',
  'Customs hold — missing MSDS and Certificate of Origin',
  'Shipment LOR-2026-0005 (industrial chemical compounds, HS 2903.15) has been held at Port of Savannah since April 2. US Customs requires Material Safety Data Sheet (MSDS) and Certificate of Origin before release. Demurrage charges are accruing at $450/day. The shipper Singapore Polymer Sciences has been contacted but has not yet provided documents. This is day 5 of the hold.',
  '["CUSTOMS_HOLD","MISSING_DOCUMENTS","DEMURRAGE_ACCRUING","CHEMICAL_COMPLIANCE"]',
  0.95, 'CRITICAL',
  'Escalate to shipper management for immediate document provision. Engage customs broker to file for temporary release bond. Calculate demurrage exposure and notify consignee of delay.',
  5.0, -4.8, 0.70,
  'ACCEPTED', 'decision-engine',
  '[]',
  '2026-04-03 14:00:00', '2026-04-06 10:00:00'
);


-- ============================================================
-- PHASE 3: WORK QUEUE TASKS
-- Derived from recommendations, linked to shipments
-- ============================================================

-- TASK 1: Review reroute for Shipment 2 (from rec_pilot_002)
INSERT INTO workflow_tasks (
  id, company_id, shipment_id, recommendation_id, task_type,
  title, description, status, priority, creation_source,
  assigned_to, created_by, due_at, priority_score,
  metadata, created_at, updated_at
) VALUES (
  'tsk_pilot_001', 'cmp_lorian_001', 'shp_lor_003', 'rec_pilot_002',
  'ROUTE_REVIEW',
  'Review reroute to Long Beach — LOR-2026-0003',
  'LA port strike and critical congestion require immediate decision on diverting COSCO Shipping Universe to Long Beach. Carrier has confirmed berth availability April 10. Decision needed by April 8 EOD to allow course correction. Cargo: auto parts, $410K value.',
  'OPEN', 'CRITICAL', 'RECOMMENDATION',
  'usr_lor_ops', 'usr_lor_admin', '2026-04-08 17:00:00', 95,
  '{"originalPort":"USLAX","alternatePort":"USLGB","carrierContact":"COSCO Operations +1-562-555-0147","estimatedSaving":"5-6 days"}',
  '2026-04-07 06:45:00', '2026-04-07 06:45:00'
);

-- TASK 2: Insurance review for Shipment 2 (from rec_pilot_003)
INSERT INTO workflow_tasks (
  id, company_id, shipment_id, recommendation_id, task_type,
  title, description, status, priority, creation_source,
  assigned_to, created_by, due_at, priority_score,
  metadata, created_at, updated_at
) VALUES (
  'tsk_pilot_002', 'cmp_lorian_001', 'shp_lor_003', 'rec_pilot_003',
  'INSURANCE_REVIEW',
  'Verify cargo insurance — Typhoon Haikui exposure',
  'Typhoon Haikui is active in the Western Pacific along the transit route of COSCO Shipping Universe. Review existing cargo insurance policy for weather exclusions on auto parts cargo ($410K). Request supplemental coverage quote if gaps found. Document vessel position vs storm track.',
  'OPEN', 'HIGH', 'RECOMMENDATION',
  'usr_lor_ops', 'usr_lor_admin', '2026-04-09 12:00:00', 78,
  '{"policyNumber":"CML-2026-4892","underwriter":"Allianz Marine","cargoValue":410000}',
  '2026-04-07 07:00:00', '2026-04-07 07:00:00'
);

-- TASK 3: Resolve customs hold for Shipment 3 (from rec_pilot_004)
INSERT INTO workflow_tasks (
  id, company_id, shipment_id, recommendation_id, task_type,
  title, description, status, priority, creation_source,
  assigned_to, created_by, due_at, escalation_level, priority_score,
  metadata, created_at, updated_at
) VALUES (
  'tsk_pilot_003', 'cmp_lorian_001', 'shp_lor_005', 'rec_pilot_004',
  'HOLD_REVIEW_TASK',
  'Resolve customs hold — obtain MSDS & CoO for LOR-2026-0005',
  'Shipment held at Savannah since April 2. US Customs requires MSDS (Material Safety Data Sheet) and Certificate of Origin for HS 2903.15 chemical compounds. Shipper Singapore Polymer Sciences contacted April 3 — no response yet. Demurrage: $450/day, currently $2,250 accrued. Escalate to shipper senior management if no response by April 8.',
  'IN_PROGRESS', 'CRITICAL', 'RECOMMENDATION',
  'usr_lor_ops', 'usr_lor_admin', '2026-04-08 09:00:00', 1, 98,
  '{"demurrageRate":450,"demurrageAccrued":2250,"shipperContact":"ops@sgpolymer.com","customsBroker":"Savannah Customs Services LLC","holdReference":"USSAV-HOLD-2026-04187"}',
  '2026-04-03 15:00:00', '2026-04-06 10:00:00'
);

-- TASK 4: Contact carrier about delay for Shipment 2
INSERT INTO workflow_tasks (
  id, company_id, shipment_id, task_type,
  title, description, status, priority, creation_source,
  assigned_to, created_by, due_at, priority_score,
  metadata, created_at, updated_at
) VALUES (
  'tsk_pilot_004', 'cmp_lorian_001', 'shp_lor_003',
  'CUSTOMER_COMMUNICATION_TASK',
  'Notify Pacific Coast Importers of potential delay — LOR-2026-0003',
  'Consignee Pacific Coast Importers LLC needs advance notice of potential 5-8 day delay on auto parts shipment due to LA port strike. Provide updated ETA and reroute options. Key contact: James Chen, Procurement Director.',
  'OPEN', 'HIGH', 'MANUAL',
  'usr_lor_ops', 'usr_lor_mgr', '2026-04-08 12:00:00', 72,
  '{"consigneeContact":"j.chen@pacificcoastimporters.com","consigneePhone":"+1-310-555-0283"}',
  '2026-04-07 08:00:00', '2026-04-07 08:00:00'
);


-- ============================================================
-- PHASE 4: EXCEPTIONS
-- Tied to problem shipments
-- ============================================================

-- EXCEPTION 1: Customs hold on Shipment 3
INSERT INTO exceptions (
  id, company_id, shipment_id, exception_type, severity, status,
  detected_from, title, description, detected_by,
  impact_summary, recommended_action, requires_escalation,
  metadata, created_at, updated_at
) VALUES (
  'exc_pilot_001', 'cmp_lorian_001', 'shp_lor_005',
  'CUSTOMS_HOLD', 'CRITICAL', 'ESCALATED',
  'SYSTEM',
  'Customs Hold — Savannah Port (MSDS + CoO Required)',
  'US Customs and Border Protection has placed a hold on shipment LOR-2026-0005 at Port of Savannah. Required documents: (1) Material Safety Data Sheet for industrial chemical compounds HS 2903.15, (2) Certificate of Origin. Hold initiated April 2, 2026. Cargo cannot be released until documentation is provided and verified.',
  'CBP Automated Targeting System',
  'Cargo release blocked. Demurrage accruing at $450/day ($2,250 to date). Consignee production schedule at risk — Atlantic Trade Partners needs materials by April 12.',
  'Obtain MSDS and Certificate of Origin from shipper. File with customs broker for expedited review.',
  true,
  '{"holdReference":"USSAV-HOLD-2026-04187","demurrageRate":450,"customsOffice":"Port of Savannah CBP","requiredDocs":["MSDS","Certificate of Origin"]}',
  '2026-04-02 10:00:00', '2026-04-06 10:00:00'
);

-- EXCEPTION 2: Missing documents on Shipment 3
INSERT INTO exceptions (
  id, company_id, shipment_id, exception_type, severity, status,
  detected_from, title, description, detected_by,
  impact_summary, recommended_action, requires_escalation,
  metadata, created_at, updated_at
) VALUES (
  'exc_pilot_002', 'cmp_lorian_001', 'shp_lor_005',
  'MISSING_DOCUMENTS', 'HIGH', 'IN_PROGRESS',
  'DOCUMENT',
  'Missing Certificate of Origin — LOR-2026-0005',
  'Certificate of Origin for industrial chemical compounds (HS 2903.15) shipped from Kaohsiung, Taiwan has not been received. Shipper Singapore Polymer Sciences was requested to provide on April 3. Follow-up sent April 5 with no response. This document is required for customs clearance at Savannah.',
  'Document Management System',
  'Customs clearance blocked until CoO is provided. Combined with missing MSDS, this is preventing cargo release.',
  'Escalate to shipper senior management. Consider engaging Taiwan trade office for expedited certificate issuance.',
  false,
  '{"documentType":"Certificate of Origin","requestedDate":"2026-04-03","followUpDate":"2026-04-05","shipperEmail":"ops@sgpolymer.com"}',
  '2026-04-03 08:00:00', '2026-04-05 14:00:00'
);

-- EXCEPTION 3: Delayed shipment on Shipment 2 (LA strike impact)
INSERT INTO exceptions (
  id, company_id, shipment_id, exception_type, severity, status,
  detected_from, title, description, detected_by,
  impact_summary, recommended_action, requires_escalation,
  metadata, created_at, updated_at
) VALUES (
  'exc_pilot_003', 'cmp_lorian_001', 'shp_lor_003',
  'DELAYED_SHIPMENT', 'HIGH', 'OPEN',
  'EVENT',
  'Port Strike Delay — ETA at risk for LOR-2026-0003',
  'Los Angeles Port Workers Strike (active since April 1) is causing critical congestion at USLAX. COSCO Shipping Universe with auto parts cargo ($410K) has ETA April 9 but may face 5-8 day berthing delay. Combined with Typhoon Haikui weather risk in Western Pacific, this shipment faces compounding delay factors.',
  'Intelligence Engine',
  'Estimated 5-8 day delay. Consignee Pacific Coast Importers has JIT production dependency on these parts. Late delivery penalty clause: $2,500/day after April 12.',
  'Initiate reroute to Long Beach. Notify consignee of delay. Review late delivery penalty exposure.',
  true,
  '{"originalETA":"2026-04-09","estimatedDelay":"5-8 days","penaltyClause":"$2,500/day after April 12","weatherRisk":"Typhoon Haikui"}',
  '2026-04-07 06:00:00', '2026-04-07 06:00:00'
);


-- ============================================================
-- PHASE 5: INVOICES + LINE ITEMS
-- ============================================================

-- INVOICE 1: Shipment 4 (Delivered) — Paid, clean
INSERT INTO invoices (
  id, company_id, shipment_id, invoice_number, status,
  subtotal, tax_total, grand_total, currency, line_items,
  invoice_source, payment_terms, due_date, issued_at, paid_at,
  bill_to_name, bill_to_email,
  customer_billing_profile_id,
  notes, created_at, updated_at
) VALUES (
  'inv_pilot_001', 'cmp_lorian_001', 'shp_lor_007',
  'LOR-INV-2026-0042', 'PAID',
  5850.00, 0.00, 5850.00, 'USD',
  '[{"type":"FREIGHT","description":"Ocean freight Singapore → Hamburg (110 CBM)","amount":3200},{"type":"CUSTOMS","description":"Customs brokerage and clearance — Hamburg","amount":450},{"type":"INSURANCE","description":"Cargo insurance (CIF) — textile fabrics","amount":580},{"type":"FEE","description":"Documentation and handling fee","amount":175},{"type":"STORAGE","description":"Terminal handling charges — Singapore","amount":820},{"type":"SURCHARGE","description":"Peak season surcharge","amount":625}]',
  'SHIPMENT', 'NET30', '2026-04-28 00:00:00', '2026-03-29 10:00:00', '2026-04-04 15:30:00',
  'European Distribution Hub BV', 'accounts@eurodist.nl',
  'cbp_01KM4CFGSHDWVCRAE35YXRK3AK',
  'Final invoice for textile shipment SGP→HAM. Paid in full.',
  '2026-03-29 10:00:00', '2026-04-04 15:30:00'
);

INSERT INTO invoice_line_items (id, invoice_id, line_type, description, quantity, unit_price, amount, shipment_id, shipment_reference) VALUES
  ('ili_pilot_001', 'inv_pilot_001', 'FREIGHT', 'Ocean freight Singapore → Hamburg (110 CBM)', 1, 3200.00, 3200.00, 'shp_lor_007', 'LOR-2026-0007'),
  ('ili_pilot_002', 'inv_pilot_001', 'CUSTOMS', 'Customs brokerage and clearance — Hamburg', 1, 450.00, 450.00, 'shp_lor_007', 'LOR-2026-0007'),
  ('ili_pilot_003', 'inv_pilot_001', 'INSURANCE', 'Cargo insurance (CIF) — textile fabrics', 1, 580.00, 580.00, 'shp_lor_007', 'LOR-2026-0007'),
  ('ili_pilot_004', 'inv_pilot_001', 'FEE', 'Documentation and handling fee', 1, 175.00, 175.00, 'shp_lor_007', 'LOR-2026-0007'),
  ('ili_pilot_005', 'inv_pilot_001', 'STORAGE', 'Terminal handling charges — Singapore', 1, 820.00, 820.00, 'shp_lor_007', 'LOR-2026-0007'),
  ('ili_pilot_006', 'inv_pilot_001', 'SURCHARGE', 'Peak season surcharge', 1, 625.00, 625.00, 'shp_lor_007', 'LOR-2026-0007');

-- INVOICE 2: Shipment 2 (At Risk) — Issued, unpaid, showing exposure
INSERT INTO invoices (
  id, company_id, shipment_id, invoice_number, status,
  subtotal, tax_total, grand_total, currency, line_items,
  invoice_source, payment_terms, due_date, issued_at,
  bill_to_name, bill_to_email,
  customer_billing_profile_id,
  notes, created_at, updated_at
) VALUES (
  'inv_pilot_002', 'cmp_lorian_001', 'shp_lor_003',
  'LOR-INV-2026-0048', 'ISSUED',
  8750.00, 0.00, 8750.00, 'USD',
  '[{"type":"FREIGHT","description":"Ocean freight Shanghai → Los Angeles (142 CBM)","amount":5400},{"type":"CUSTOMS","description":"Customs brokerage — US entry (HS 8708.99)","amount":650},{"type":"INSURANCE","description":"Cargo insurance — auto parts","amount":820},{"type":"FEE","description":"Documentation and handling","amount":175},{"type":"STORAGE","description":"Terminal handling — Shanghai","amount":780},{"type":"SURCHARGE","description":"Congestion surcharge — USLAX","amount":925}]',
  'SHIPMENT', 'NET30', '2026-05-07 00:00:00', '2026-04-05 09:00:00',
  'Pacific Coast Importers LLC', 'ap@pacificcoastimporters.com',
  'cbp_01KM4CFGSHDWVCRAE35YXRK3AK',
  'Invoice issued pre-delivery. Note: potential surcharges pending if reroute to Long Beach is executed.',
  '2026-04-05 09:00:00', '2026-04-07 06:00:00'
);

INSERT INTO invoice_line_items (id, invoice_id, line_type, description, quantity, unit_price, amount, shipment_id, shipment_reference) VALUES
  ('ili_pilot_007', 'inv_pilot_002', 'FREIGHT', 'Ocean freight Shanghai → Los Angeles (142 CBM)', 1, 5400.00, 5400.00, 'shp_lor_003', 'LOR-2026-0003'),
  ('ili_pilot_008', 'inv_pilot_002', 'CUSTOMS', 'Customs brokerage — US entry (HS 8708.99)', 1, 650.00, 650.00, 'shp_lor_003', 'LOR-2026-0003'),
  ('ili_pilot_009', 'inv_pilot_002', 'INSURANCE', 'Cargo insurance — auto parts', 1, 820.00, 820.00, 'shp_lor_003', 'LOR-2026-0003'),
  ('ili_pilot_010', 'inv_pilot_002', 'FEE', 'Documentation and handling', 1, 175.00, 175.00, 'shp_lor_003', 'LOR-2026-0003'),
  ('ili_pilot_011', 'inv_pilot_002', 'STORAGE', 'Terminal handling — Shanghai', 1, 780.00, 780.00, 'shp_lor_003', 'LOR-2026-0003'),
  ('ili_pilot_012', 'inv_pilot_002', 'SURCHARGE', 'Congestion surcharge — USLAX', 1, 925.00, 925.00, 'shp_lor_003', 'LOR-2026-0003');

-- INVOICE 3: Shipment 3 (Customs hold) — Draft, demurrage accruing
INSERT INTO invoices (
  id, company_id, shipment_id, invoice_number, status,
  subtotal, tax_total, grand_total, currency, line_items,
  invoice_source, payment_terms,
  bill_to_name, bill_to_email,
  customer_billing_profile_id,
  notes, created_at, updated_at
) VALUES (
  'inv_pilot_003', 'cmp_lorian_001', 'shp_lor_005',
  'LOR-INV-2026-0051', 'DRAFT',
  9475.00, 0.00, 9475.00, 'USD',
  '[{"type":"FREIGHT","description":"Ocean freight Kaohsiung → Savannah (96 CBM)","amount":4800},{"type":"CUSTOMS","description":"Customs brokerage — Savannah (pending clearance)","amount":550},{"type":"INSURANCE","description":"Cargo insurance — chemical compounds","amount":1050},{"type":"FEE","description":"Hazmat documentation handling","amount":325},{"type":"STORAGE","description":"Demurrage — Savannah (5 days × $450)","amount":2250},{"type":"FEE","description":"Terminal handling — Kaohsiung","amount":500}]',
  'SHIPMENT', 'NET30',
  'Atlantic Trade Partners Inc', 'billing@atlantictrade.com',
  'cbp_01KM4CFGSHDWVCRAE35YXRK3AK',
  'DRAFT — Demurrage charges accruing. Do not issue until customs hold resolved. Current demurrage: $2,250 (5 days × $450).',
  '2026-04-05 11:00:00', '2026-04-07 08:00:00'
);

INSERT INTO invoice_line_items (id, invoice_id, line_type, description, quantity, unit_price, amount, shipment_id, shipment_reference) VALUES
  ('ili_pilot_013', 'inv_pilot_003', 'FREIGHT', 'Ocean freight Kaohsiung → Savannah (96 CBM)', 1, 4800.00, 4800.00, 'shp_lor_005', 'LOR-2026-0005'),
  ('ili_pilot_014', 'inv_pilot_003', 'CUSTOMS', 'Customs brokerage — Savannah (pending clearance)', 1, 550.00, 550.00, 'shp_lor_005', 'LOR-2026-0005'),
  ('ili_pilot_015', 'inv_pilot_003', 'INSURANCE', 'Cargo insurance — chemical compounds', 1, 1050.00, 1050.00, 'shp_lor_005', 'LOR-2026-0005'),
  ('ili_pilot_016', 'inv_pilot_003', 'FEE', 'Hazmat documentation handling', 1, 325.00, 325.00, 'shp_lor_005', 'LOR-2026-0005'),
  ('ili_pilot_017', 'inv_pilot_003', 'STORAGE', 'Demurrage — Savannah (5 days × $450)', 5, 450.00, 2250.00, 'shp_lor_005', 'LOR-2026-0005'),
  ('ili_pilot_018', 'inv_pilot_003', 'FEE', 'Terminal handling — Kaohsiung', 1, 500.00, 500.00, 'shp_lor_005', 'LOR-2026-0005');

-- ============================================================
-- PHASE 6: RECEIVABLES
-- ============================================================

-- Receivable for paid invoice (Shipment 4)
INSERT INTO receivables (
  id, company_id, invoice_id, customer_billing_profile_id,
  original_amount, outstanding_amount, currency,
  due_date, days_overdue, collections_status,
  dispute_status, settlement_status,
  payments, created_at, updated_at
) VALUES (
  'rcv_pilot_001', 'cmp_lorian_001', 'inv_pilot_001', 'cbp_01KM4CFGSHDWVCRAE35YXRK3AK',
  5850.00, 0.00, 'USD',
  '2026-04-28 00:00:00', 0, 'CURRENT',
  'NONE', 'SETTLED',
  '[{"date":"2026-04-04","amount":5850.00,"method":"wire_transfer","reference":"WR-EUR-20260404"}]',
  '2026-03-29 10:00:00', '2026-04-04 15:30:00'
);

-- Receivable for issued invoice (Shipment 2) — not yet due
INSERT INTO receivables (
  id, company_id, invoice_id, customer_billing_profile_id,
  original_amount, outstanding_amount, currency,
  due_date, days_overdue, collections_status,
  dispute_status, settlement_status,
  created_at, updated_at
) VALUES (
  'rcv_pilot_002', 'cmp_lorian_001', 'inv_pilot_002', 'cbp_01KM4CFGSHDWVCRAE35YXRK3AK',
  8750.00, 8750.00, 'USD',
  '2026-05-07 00:00:00', 0, 'CURRENT',
  'NONE', 'UNSETTLED',
  '2026-04-05 09:00:00', '2026-04-05 09:00:00'
);

-- ============================================================
-- PHASE 7: TASK EVENTS (audit trail for in-progress task)
-- ============================================================

INSERT INTO task_events (id, company_id, task_id, event_type, actor_id, notes, created_at) VALUES
  ('tevt_pilot_001', 'cmp_lorian_001', 'tsk_pilot_003', 'CREATED', 'usr_lor_admin', 'Task auto-created from customs hold exception', '2026-04-03 15:00:00'),
  ('tevt_pilot_002', 'cmp_lorian_001', 'tsk_pilot_003', 'STATUS_CHANGED', 'usr_lor_ops', 'Status changed from OPEN to IN_PROGRESS. Contacted shipper for MSDS.', '2026-04-04 09:00:00'),
  ('tevt_pilot_003', 'cmp_lorian_001', 'tsk_pilot_003', 'ESCALATED', 'usr_lor_mgr', 'Escalated — shipper unresponsive after 48 hours. Engaging senior contact.', '2026-04-06 10:00:00');


-- ============================================================
-- PHASE 8: COMPLIANCE SCREENINGS + RISK SCORES
-- ============================================================

INSERT INTO compliance_screenings (id, company_id, shipment_id, status, screened_parties, match_count, matches, lists_checked, screened_at, created_at) VALUES
  ('cs_pilot_001', 'cmp_lorian_001', 'shp_lor_001', 'CLEAR', 3, 0, '[]', '["OFAC SDN","EU Sanctions","BIS Entity List"]', '2026-03-27 10:00:00', '2026-03-27 10:00:00'),
  ('cs_pilot_002', 'cmp_lorian_001', 'shp_lor_003', 'CLEAR', 3, 0, '[]', '["OFAC SDN","EU Sanctions","BIS Entity List"]', '2026-03-21 08:00:00', '2026-03-21 08:00:00'),
  ('cs_pilot_003', 'cmp_lorian_001', 'shp_lor_005', 'FLAGGED', 3, 1, '[{"listName":"BIS Entity List","entityName":"Singapore Polymer Sciences Pte","matchType":"PARTIAL","confidence":0.62,"notes":"Partial name match with restricted entity — requires manual review"}]', '["OFAC SDN","EU Sanctions","BIS Entity List"]', '2026-03-09 14:00:00', '2026-03-09 14:00:00'),
  ('cs_pilot_004', 'cmp_lorian_001', 'shp_lor_007', 'CLEAR', 3, 0, '[]', '["OFAC SDN","EU Sanctions","BIS Entity List"]', '2026-02-28 16:00:00', '2026-02-28 16:00:00');

INSERT INTO risk_scores (id, company_id, shipment_id, composite_score, sub_scores, primary_risk_factors, recommended_action, scored_at, created_at) VALUES
  ('rsk_pilot_001', 'cmp_lorian_001', 'shp_lor_001', 28,
   '{"valueRisk": 35, "carrierRisk": 10, "countryRisk": 20, "commodityRisk": 30, "routeRisk": 25, "weatherRisk": 15}',
   '[{"factor":"Suez Canal capacity reduction","detail":"Route passes through Suez Canal currently operating at reduced capacity"},{"factor":"High-value electronics cargo","detail":"$285K consumer electronics — moderate theft/damage risk"}]',
   'AUTO_APPROVE', '2026-03-28 06:00:00', '2026-03-28 06:00:00'),
  ('rsk_pilot_002', 'cmp_lorian_001', 'shp_lor_003', 82,
   '{"valueRisk": 45, "carrierRisk": 15, "countryRisk": 20, "commodityRisk": 25, "routeRisk": 90, "weatherRisk": 85}',
   '[{"factor":"LA port workers strike — critical congestion","detail":"Destination port USLAX experiencing active strike and critical congestion levels"},{"factor":"Typhoon Haikui — Western Pacific","detail":"Active typhoon on transit route with critical severity rating"},{"factor":"High-value auto parts","detail":"$410K cargo with JIT delivery dependency — late delivery penalties apply"}]',
   'MANUAL_REVIEW', '2026-04-07 06:00:00', '2026-04-07 06:00:00'),
  ('rsk_pilot_003', 'cmp_lorian_001', 'shp_lor_005', 74,
   '{"valueRisk": 30, "carrierRisk": 20, "countryRisk": 25, "commodityRisk": 65, "routeRisk": 15, "complianceRisk": 85}',
   '[{"factor":"Customs hold — documentation incomplete","detail":"Missing MSDS and Certificate of Origin for HS 2903.15 chemical compounds"},{"factor":"Partial compliance match","detail":"Shipper Singapore Polymer Sciences flagged for partial match on BIS Entity List"},{"factor":"Demurrage accruing","detail":"$450/day demurrage since April 2 — $2,250 accrued to date"}]',
   'ESCALATE', '2026-04-03 10:00:00', '2026-04-03 10:00:00'),
  ('rsk_pilot_004', 'cmp_lorian_001', 'shp_lor_007', 12,
   '{"valueRisk": 20, "carrierRisk": 8, "countryRisk": 10, "commodityRisk": 10, "routeRisk": 8, "weatherRisk": 5}',
   '[{"factor":"Low-risk commodity","detail":"Textile fabrics — minimal regulatory or compliance concerns"}]',
   'AUTO_APPROVE', '2026-03-01 08:00:00', '2026-03-01 08:00:00');


-- ============================================================
-- PHASE 9: QUOTE LINKAGE
-- ============================================================

UPDATE quotes SET
  converted_shipment_id = 'shp_lor_001',
  commodity = 'Consumer Electronics (Laptops & Tablets)',
  quoted_amount = 5850.00
WHERE id = 'qt_01KM46RWJD7BVZWGZE2TT1VWGT' AND company_id = 'cmp_lorian_001';

UPDATE shipments SET source_quote_id = 'qt_01KM46RWJD7BVZWGZE2TT1VWGT' WHERE id = 'shp_lor_001';

UPDATE quotes SET
  converted_shipment_id = 'shp_lor_003',
  origin = 'Shanghai, China',
  destination = 'Los Angeles, USA',
  port_of_loading = 'CNSHA',
  port_of_discharge = 'USLAX',
  commodity = 'Auto Parts & Accessories',
  quoted_amount = 8750.00
WHERE id = 'qt_01KM473KWM3FV003SA5VRAY1CH' AND company_id = 'cmp_lorian_001';

UPDATE shipments SET source_quote_id = 'qt_01KM473KWM3FV003SA5VRAY1CH' WHERE id = 'shp_lor_003';

COMMIT;
