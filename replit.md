# Dynasties — Agentic Operating System for Global Trade

## Overview
Dynasties is an AI operating layer designed for global freight forwarding and logistics. Its primary purpose is to transform unstructured operational data from various sources (emails, PDFs, spreadsheets) into structured, actionable workflows. The project aims to enhance efficiency and automation in the logistics industry by using AI agents and deterministic execution services, ensuring AI outputs are validated and integrated into the system of record through controlled processes.

## User Preferences
I prefer iterative development with a focus on delivering functional, well-tested components in each step.
I value clear and concise communication.
I prefer to be asked before major architectural changes or significant refactoring.
I like to see unit and integration tests for new features.
I prefer detailed explanations for complex logic or design decisions.
Do not make changes to the `infrastructure/` folder.
Do not make changes to the `tests/` folder without prior discussion.

## System Architecture
The core architectural principle is that AI models do not directly write to the system of record. Instead, agents produce structured JSON outputs that are processed by deterministic services with validation and approval mechanisms before any database writes occur. The system is built as a monorepo using pnpm workspaces.

**UI/UX Decisions:**
The project features an AI-native operating system design with a three-zone layout: left sidebar, central workspace, and a right context panel for agent activity and alerts. The design system uses the Inter font, a dark palette with subtle accent colors, an 8px grid system, and Framer Motion for animations.

**Technical Implementations:**
- **Backend:** Node.js 24, TypeScript 5.9, Express 5.
- **Database:** PostgreSQL with Drizzle ORM.
- **Validation:** Zod for data validation, including `drizzle-zod` and Orval for API codegen.
- **Authentication & Authorization:** JWT-based authentication with Bearer tokens, bcryptjs for password hashing, and role-based access control (ADMIN, MANAGER, OPERATOR, VIEWER). All database tables support multi-tenancy via `company_id`.
- **Security:** Rate limiting with `express-rate-limit`, explicit CORS origin allowlist, and a global error handler.
- **Job Queues:** An abstraction for job queuing supports 12 job types (e.g., extraction, shipment-pipeline, compliance, risk) and is designed to swap between in-process EventEmitter for dev and SQS for production.
- **File Storage:** An abstraction for file storage is used, defaulting to local filesystem and switching to S3 for production.
- **AI Agent Output Validation:** All AI agents return structured JSON, validated against Zod schemas, with fallbacks to deterministic output on failure.
- **Database Transactions:** Multi-step write operations are wrapped in database transactions.
- **Deployment:** Docker for containerization, `docker-compose.yml` for local development, and Terraform for AWS production infrastructure (ECS Fargate, RDS PostgreSQL, S3, SQS, ALB, CloudFront). CI/CD is managed via GitHub Actions.

**Feature Specifications:**
The system automates various freight forwarding stages:
- **Data Ingestion & Processing:** Email ingestion, document extraction using OCR and AI, entity resolution, and shipment construction.
- **Compliance & Risk:** Automated compliance screening against sanctions lists and calculation of composite risk scores with AI explanations.
- **Financial Operations:** Insurance quoting, pricing based on rate tables, and document generation (e.g., HBL, Arrival Notices).
- **Exception Management:** Automated detection and AI classification of six exception types (e.g., extraction failures, compliance alerts).
- **AI Decision Engine:** Provides deterministic recommendations (9 types: CARRIER_SWITCH, ROUTE_ADJUSTMENT, INSURANCE_ADJUSTMENT, COMPLIANCE_ESCALATION, DELAY_WARNING, MARGIN_WARNING, DOCUMENT_CORRECTION, RISK_MITIGATION, PRICING_ALERT) after compliance, risk, and insurance stages are complete. Features: fingerprint-based deduplication (SHA-256 hash of shipment+type+reasonCodes+action), lifecycle management (PENDING→SHOWN→ACCEPTED/MODIFIED/REJECTED→IMPLEMENTED, plus EXPIRED/SUPERSEDED), urgency-based expiry (CRITICAL=24h, HIGH=72h, MEDIUM=7d, LOW=14d), stale rec auto-expiry on query. Thresholds centralized in `services/decision-engine/src/config.ts`. Full modify flow with notes modal and outcome recording UI (delay, cost, margin, claim, evaluation).
- **Recommendation Enrichment (Phase 2B):** Decision engine now queries ingested intelligence tables before generating recommendations. Intelligence summary builder (`services/decision-engine/src/intelligence-summary.ts`) computes per-shipment scores: congestion, disruption, weather, sanctions, vessel, market pressure. All 9 recommendation types are intelligence-aware: COMPLIANCE_ESCALATION (sanctions feed confirmation), RISK_MITIGATION (multi-signal escalation), INSURANCE_ADJUSTMENT (weather/disruption exposure), DELAY_WARNING (congestion-lowered threshold), CARRIER_SWITCH (vessel anomaly threshold raise), ROUTE_ADJUSTMENT (external disruption signals), MARGIN_WARNING (unchanged), DOCUMENT_CORRECTION (unchanged), PRICING_ALERT (new — market signals, congestion surcharges, disruption premiums). Recommendations carry `externalReasonCodes`, `signalEvidence`, and `intelligenceEnriched` fields. 12 external reason codes defined. UI shows "Intel" badge, external signal chips, and evidence section. INTEL_THRESHOLDS in config.ts govern all enrichment triggers.
- **Control Tower:** An AI-powered dashboard filtering active (non-expired, non-superseded) recommendations with stat cards, urgent recommendations, and shipment intervention views. Dual view modes: "By Urgency" (classic urgency-grouped view) and "By Impact" (impact-score-ranked priority queue with sort controls: impact, margin, delay, risk, recency; intelligence-triggered badges; recently-changed highlighting). Includes External Intelligence section with 5 widgets: High-Risk Ports, Active Disruptions, Sanctions Alerts, Congestion Hotspots, Weather Risks. "Ingest Intel" button triggers ingestion of all 6 source types.
- **External Intelligence Ingestion (Phase 2A):** Framework for ingesting external signals (AIS vessel positions, port congestion, sanctions/denied parties, disruptions, weather risks) into the trade graph. Architecture: fixture-backed adapters → Zod validation → fingerprint-based dedup → DB persist → event logging → graph linking. Service: `@workspace/svc-intelligence-ingestion` at `services/intelligence-ingestion/`. 9 API endpoints under `/api/intelligence/`. All intelligence data uses tenant/global scoping (`companyId = tenant OR IS NULL`). New DB tables: intelligence_sources, vessel_positions, vessel_port_calls, port_congestion_snapshots, sanctions_entities, denied_parties, disruption_events, weather_risk_events, lane_market_signals, ingestion_runs. 9 new trade graph edge types for entity linking.
- **Intelligence-Driven Reanalysis (Phase 3A):** Automatic re-evaluation of active shipments when new intelligence is ingested. Reanalysis queue with 5-minute throttling and 50-shipment batch cap. Impacted shipment detection via port/lane/entity/vessel matching using existing graph edge types (`SHIPPER_USES_CARRIER`, `SHIPPER_SHIPS_TO_CONSIGNEE`, `ENTITY_SANCTIONS_MATCH`, `ENTITY_DENIED_PARTY_MATCH`). Intelligence snapshots persisted per decision run with SHA-256 change-detection hashing; recommendations linked to `snapshotId` for auditability. Persistent scoring layer computes lane stress, port risk, carrier risk, and entity risk scores from intelligence tables using select-then-upsert pattern with tenant-scoped writes. Analytics page with recommendation quality metrics (acceptance rate, enrichment rate, by-type/by-urgency breakdown) and persistent scoring panels. New tables: `shipment_intelligence_snapshots`, `lane_scores`, `port_scores`, `carrier_scores`, `entity_scores`. Service files: `services/intelligence-ingestion/src/reanalysis.ts`, `services/decision-engine/src/scoring.ts`. API: `/api/analytics/recommendations`, `/api/analytics/scores`, `/api/analytics/snapshots/:id`.
- **Graph-Native Operator Intelligence (Phase 3B):** Dossier views for lanes, ports, carriers, and entities — each aggregating persistent scores, related shipments, active recommendations, intelligence signals, outcome patterns, and graph relationships. Impact-based recommendation prioritization with deterministic scoring formula (marginImpact×0.25 + delayImpact×0.25 + riskImpact×0.2 + confidence×0.15 + recency×0.15). Diagnostics analytics tab showing acceptance/rejection rates by type, intel-enriched vs internal acceptance rates, outcome quality, urgency bands, top false positives. Recommendation change diffing endpoint comparing consecutive recommendation generations per shipment with score deltas and trigger summaries; collapsible diff panel in ShipmentDetail. API endpoints: `/api/dossiers/lanes/:origin/:destination`, `/api/dossiers/ports/:portCode`, `/api/dossiers/carriers/:carrierId`, `/api/dossiers/entities/:entityId`, `/api/dossiers/graph/:nodeType/:nodeId`, `/api/recommendations/prioritized`, `/api/shipments/:id/recommendations/diff`, `/api/analytics/diagnostics`. UI pages: `LaneDossier`, `PortDossier`, `CarrierDossier`, `EntityDossier`. Tests: `services/decision-engine/src/__tests__/phase3b.test.ts` (19 tests).
- **Customer Management:** Customer import and directory functionalities.

## External Dependencies
- **AI Integration:** Anthropic Claude Sonnet (via Replit AI Integrations) for AI agent capabilities.
- **Database:** PostgreSQL.
- **ORM:** Drizzle ORM.
- **Email Parsing:** `mailparser`.
- **PDF Parsing:** `pdf-parse`.
- **HTTP Framework:** Express 5.
- **Validation Library:** Zod.
- **OpenAPI Codegen:** Orval.
- **Logging Library:** pino.
- **Authentication Libraries:** `jsonwebtoken`, `bcryptjs`.
- **Rate Limiting:** `express-rate-limit`.