# Dynasties — Agentic Operating System for Global Trade

## Overview
Dynasties is an AI operating layer for global freight forwarding and logistics. It transforms unstructured operational data (emails, PDFs, spreadsheets) into structured, actionable workflows using AI agents and deterministic execution services. The project aims to enhance efficiency, automate logistics processes, and provide an AI operating system for global trade, unlocking new levels of automation and insight for logistics providers.

## User Preferences
I prefer iterative development with a focus on delivering functional, well-tested components in each step.
I value clear and concise communication.
I prefer to be asked before major architectural changes or significant refactoring.
I like to see unit and integration tests for new features.
I prefer detailed explanations for complex logic or design decisions.
Do not make changes to the `infrastructure/` folder.
Do not make changes to the `tests/` folder without prior discussion.

## System Architecture
The core architectural principle is that AI models do not directly write to the system of record. Instead, agents produce structured JSON outputs processed by deterministic services with validation and approval mechanisms. The system is built as a monorepo using pnpm workspaces.

**UI/UX Decisions:**
The design features an AI-native operating system with a three-zone layout (left sidebar, central workspace, right context panel). The design system uses Dynasties branding with specific fonts (Space Grotesk, Inter), a dark infrastructure palette, primary teal, warning amber, destructive red, and various shades for text. It uses an 8px grid system and Framer Motion for animations.

**Technical Implementations:**
- **Backend:** Node.js 24, TypeScript 5.9, Express 5.
- **Database:** PostgreSQL with Drizzle ORM.
- **Validation:** Zod for data validation.
- **Authentication & Authorization:** Dual-mode authentication using JWT (demo) and Clerk (production). Supports multi-tenancy via `company_id` and role-based access control (ADMIN, MANAGER, OPERATOR, VIEWER).
- **Security:** Rate limiting, explicit CORS, and global error handling.
- **Job Queues:** Abstraction for 12 job types, supporting in-process EventEmitter (dev) and SQS (production).
- **File Storage:** Abstraction for file storage, defaulting to local filesystem and switching to S3 for production.
- **AI Agent Output Validation:** AI outputs are structured JSON, validated against Zod schemas, with fallbacks to deterministic output on failure.
- **Database Transactions:** Multi-step write operations are wrapped in transactions.
- **Deployment:** Docker for containerization, `docker-compose.yml` for local development, and Terraform for AWS production infrastructure (ECS Fargate, RDS PostgreSQL, S3, SQS, ALB, CloudFront). CI/CD is managed via GitHub Actions.

**Feature Specifications:**
The system automates various freight forwarding stages:
- **Data Ingestion & Processing:** Email ingestion, document extraction (OCR/AI), entity resolution, shipment construction.
- **Compliance & Risk:** Automated compliance screening and composite risk scoring.
- **Financial Operations:** Insurance quoting, pricing, document generation.
- **Exception Management:** Automated detection and AI classification of exception types.
- **AI Decision Engine:** Provides 9 types of deterministic recommendations with lifecycle management, urgency-based expiry, and external intelligence enrichment.
- **Control Tower:** An AI-powered dashboard for active recommendations, with "By Urgency" and "By Impact" views, and an External Intelligence section (high-risk ports, disruptions, sanctions, congestion, weather).
- **External Intelligence Ingestion:** Framework for ingesting external signals (AIS vessel positions, port congestion, sanctions, weather) into the trade graph.
- **Intelligence-Driven Reanalysis:** Automatic re-evaluation of active shipments based on new intelligence.
- **Graph-Native Operator Intelligence:** Dossier views for lanes, ports, carriers, and entities, aggregating scores, recommendations, and intelligence signals.
- **Workflow Task & Case Management:** Recommendation-to-action pipeline with `workflow_tasks` and `task_events` audit trail.
- **Semi-Autonomous Workflow Orchestration:** Policy engine for auto-task creation, SLA/escalation management, notifications, and routing.
- **Predictive Intelligence:** Pre-shipment risk evaluation, disruption forecasting, shipment readiness scoring, historical pattern analysis, and early recommendation generation.
- **Proactive Intervention & Booking-Time Decisioning:** Booking decision engine with weighted risk scoring, release gate holds, mitigation playbooks, alert-to-action automation, and scenario comparison.
- **Strategic Intelligence & Network Optimization:** Portfolio-level intelligence, lane strategy, carrier allocation, network optimization recommendations, portfolio risk/margin views, and intervention attribution.
- **Policy Optimization & Productization:** Tenant-configurable policy engine, policy versioning, what-if policy simulation, operating mode presets, and reporting/export service.
- **Customer Management:** Customer import and directory functionalities.
- **Billing & Receivables:** Full commercial billing module with billing accounts, customer billing profiles (6 seeded), charge rules (7 types), invoice lifecycle (DRAFT→ISSUED→SENT→PAID/OVERDUE/DISPUTED/CANCELLED/FINANCED), receivables tracking with aging, Balance financing integration (spread calculation, provider abstraction), and commercial event audit trail. UI includes Overview dashboard with KPI cards (including Platform Revenue from financing spreads) and aging chart, Invoices list with status filters, Invoice detail with action buttons (send/pay/dispute/cancel) + line items + receivable + financing data + audit trail, Customers list + detail with exposure/credit/risk, and Settings page showing account config, finance settings, payment options, and charge rules.
- **Compliance Agent:** `POST /shipments/:id/compliance-check` orchestrates sanctions screening + risk scoring + AI reasoning in parallel. Deletes prior records, runs `runComplianceScreening` (fuzzy OFAC/EU/UN screening with AI agent for ambiguous matches) and `runRiskIntelligence` (weighted scoring with AI factor explanations) via `Promise.allSettled`, persists results to `compliance_screenings` + `risk_scores` tables + audit events. Uses existing services in `services/compliance-screening/` and `services/risk-intelligence/`. UI: "Run Compliance Check" / "Re-Run Check" button on ShipmentDetail page with toast feedback, shows status (CLEAR/ALERT/BLOCKED), parties screened, match details, and screening timestamp. Requires OPERATOR+ role.
- **Documentation Validation Agent:** `POST /shipments/:id/document-validation-check` runs deterministic + AI-enhanced document completeness/consistency validation. Service at `services/document-validation/` following existing pattern (rules.ts, checker.ts, agent.ts, validator.ts, index.ts). Deterministic layer: required documents by shipment stage (core=BOL+Invoice+PackingList, customs/extended by status), required fields per document type, cross-document consistency checks (shipper, consignee, commodity, ports, values, weight, package count), extraction confidence checks. AI layer: Anthropic Claude haiku for reasoning summary + recommended actions with lazy client init + graceful fallback. Output: status (READY/REVIEW/BLOCKED), readinessLevel (COMPLETE/PARTIAL/INSUFFICIENT), missing documents/fields, inconsistencies, suspicious findings, reasoning summary, recommended actions. Persisted to `document_validation_results` table. `GET /shipments/:id/document-validation` returns latest result. UI: "Run Document Validation" / "Re-Run Validation" button on ShipmentDetail page, renders all sections with severity-colored badges. Tenant-scoped queries. OPERATOR+ role. Audit event: DOC_VALIDATION_COMPLETED.
- **Active Financing Platform:** Any invoice with `financeEligible=true` and status OVERDUE/SENT/PARTIALLY_PAID (or financeStatus=OFFERED) can be financed via the "Get Paid Now" flow. Financing engine (`artifacts/api-server/src/services/financing-engine.ts`) computes terms: 2.5% provider rate + 0.5% platform spread = 3.0% customer rate. **Strict 5-state machine: NONE→OFFERED→ACCEPTED→FUNDED→REPAID.** Transitions enforced by `validateFinanceTransition` — cannot skip states (e.g., OFFERED→FUNDED blocked, must go through ACCEPTED). Four API endpoints: `offer-financing` (NONE→OFFERED), `accept-financing` (OFFERED→ACCEPTED, user action, creates financing record), `fund-financing` (ACCEPTED→FUNDED, system disbursement, transfers receivable), `mark-repaid` (FUNDED→REPAID). Legacy `request-financing` endpoint deprecated (returns 410). **Financial truth:** When funded, receivable `collectionsStatus` = `FINANCED` (not CURRENT), `receivableTransferred` = true, outstanding = 0, settlement = SETTLED. Receivable is explicitly marked as transferred/sold to the financing provider — the system never fakes a "paid" or "current" state. UI receivable block shows "Financed / Sold" with "Transferred" badge and "Transfer Status: Transferred to Provider" column. Funded panel says "Receivable Sold — Financed" not "Invoice Financed". Audit events per step: BALANCE_REQUESTED, BALANCE_ACCEPTED, BALANCE_FUNDED ("Receivable transferred to financing provider"), SPREAD_RECORDED, BALANCE_REPAID — all with entityType=INVOICE, entityId=invoice.id. UI shows three financing states: offer panel (Get Paid Now / Accept Financing), accepted panel (teal Disburse Funds button with instruction text "Click 'Disburse Funds' to transfer $X to your account"), and funded panel (green, Receivable Sold — Financed). Mark Paid hidden during ACCEPTED state. **KPI integrity:** All KPI values are server-computed by `/billing/receivables/overview` — no client-side KPI calculation exists. Overdue KPI uses receivable outstanding amounts (not invoice grandTotal) for accurate partial-payment handling; `totalOverdue`, `countOverdue`, and `countOverdueInvoices` all derive from the same invoice+receivable join — guaranteed coherent. Overdue excludes financeStatus FUNDED/REPAID. Outstanding for transferred receivables displays "$0.00 — Transferred to Provider" (not "Sold"). StatusBadge has explicit FINANCED/FUNDED styling (emerald green). **Demo controls:** `POST /billing/invoices/:id/demo-reset` (ADMIN-only) resets any invoice to its date-based original state (SENT/OVERDUE/DRAFT), clears financing records, payment data, disputes, and demo-generated audit entries — enables repeatable demo loops. `POST /billing/invoices/:id/resolve-dispute` returns DISPUTED invoices to SENT/OVERDUE. UI: small "Reset (Demo)" button on every invoice detail page (with confirmation dialog), "Resolve Dispute" button on DISPUTED invoices. Transferred receivables excluded from outstanding/aging/open counts. Revenue Earned is `totalSpread` (sum of `dynastiesSpreadAmount` from financing records). Response also includes `totalFinancingFees`, `countOverdueInvoices`, `countDisputed`, `countPaid`, `totalInvoiced`, `totalInvoiceCount` — all server-derived. UI reads these fields directly; reload always produces consistent values. Invoice list sorted by urgency, "Days" column, relative dates, FINANCED badge green. Audit trail chronological.

## External Signal Integrations
Backend-only provider integrations for enriching demo with live external data. Controlled by feature flags:
- `DEMO_EXTERNAL_SIGNALS=true/false` — global toggle
- `DEMO_USE_WEATHER_API=true/false` — OpenWeather live weather
- `DEMO_USE_AIS_API=true/false` — AISStream vessel positions (disabled by default)

**OpenWeather** (`artifacts/api-server/src/providers/openweather.ts`):
- Uses free 2.5 Current Weather API (does not include alerts — One Call 3.0 paid plan required)
- In-memory TTL cache (15min), 5s timeout, 1 retry
- Falls back to seeded weather_risk_events on any failure
- Observability: structured JSON logs with provider/outcome/latency/fallback
- Secrets: `OPENWEATHER_API_KEY` (read from Replit Secrets, never exposed to frontend)
- Features using it: Shipment Detail (Port Weather widget), weather enrichment API

**AISStream** (`artifacts/api-server/src/providers/aisstream.ts`):
- WebSocket-based vessel position API — wrapper exists but streaming not implemented
- Disabled by default (`DEMO_USE_AIS_API=false`) for demo stability
- Can be enabled via flag but will still return seeded data until WebSocket ingestion is built
- Secrets: `AISSTREAM_API_KEY` (read from Replit Secrets)

**API Endpoints:**
- `GET /api/intelligence/weather/live/:portCode` — live or seeded weather for a port
- `GET /api/shipments/:id/weather-context` — weather for shipment's ports (origin + destination)
- `GET /api/intelligence/providers/status` — provider config, cache stats, AIS status

**Port Coordinates:** `artifacts/api-server/src/providers/port-coordinates.ts` — lat/lng for 17 major ports

**Fallback behavior:** If any provider fails or is disabled, UI renders seeded intelligence data seamlessly. No visible page depends on a live provider to render.

## External Dependencies
- **AI Integration:** Anthropic Claude via `@workspace/integrations-anthropic-ai` for model routing, retries, Zod schema validation, and cost estimation.
- **Authentication:** `@clerk/clerk-react`, `@clerk/express`, `jsonwebtoken`.
- **Database:** PostgreSQL.
- **ORM:** Drizzle ORM.
- **Email Parsing:** `mailparser`.
- **PDF Parsing:** `pdf-parse`.
- **HTTP Framework:** Express 5.
- **Validation Library:** Zod.
- **OpenAPI Codegen:** Orval.
- **Logging Library:** pino.
- **Authentication Libraries:** `bcryptjs`.
- **Rate Limiting:** `express-rate-limit`.