# Dynasties — Agentic Operating System for Global Trade

## Overview
Dynasties is an AI operating layer designed for global freight forwarding and logistics. Its primary purpose is to transform unstructured operational data (emails, PDFs, spreadsheets) into structured, actionable workflows. The project aims to enhance efficiency and automation in the logistics industry by using AI agents and deterministic execution services, ensuring AI outputs are validated and integrated into the system of record through controlled processes. The business vision is to build the foundational AI operating system for global trade, unlocking unprecedented levels of automation and insight for logistics providers.

## User Preferences
I prefer iterative development with a focus on delivering functional, well-tested components in each step.
I value clear and concise communication.
I prefer to be asked before major architectural changes or significant refactoring.
I like to see unit and integration tests for new features.
I prefer detailed explanations for complex logic or design decisions.
Do not make changes to the `infrastructure/` folder.
Do not make changes to the `tests/` folder without prior discussion.

## System Architecture
The core architectural principle is that AI models do not directly write to the system of record. Instead, agents produce structured JSON outputs processed by deterministic services with validation and approval mechanisms before any database writes. The system is built as a monorepo using pnpm workspaces.

**UI/UX Decisions:**
The project features an AI-native operating system design with a three-zone layout: left sidebar, central workspace, and a right context panel for agent activity and alerts. The design system uses the Inter font, a dark palette with subtle accent colors, an 8px grid system, and Framer Motion for animations.

**Technical Implementations:**
- **Backend:** Node.js 24, TypeScript 5.9, Express 5.
- **Database:** PostgreSQL with Drizzle ORM.
- **Validation:** Zod for data validation.
- **Authentication & Authorization:** JWT-based authentication with Bearer tokens, bcryptjs for password hashing, and role-based access control (ADMIN, MANAGER, OPERATOR, VIEWER). Multi-tenancy is supported via `company_id`.
- **Security:** Rate limiting, explicit CORS origin allowlist, and a global error handler.
- **Job Queues:** Abstraction for 12 job types (e.g., extraction, shipment-pipeline) supporting in-process EventEmitter for dev and SQS for production.
- **File Storage:** Abstraction for file storage, defaulting to local filesystem and switching to S3 for production.
- **AI Agent Output Validation:** All AI agents return structured JSON, validated against Zod schemas, with fallbacks to deterministic output on failure.
- **Database Transactions:** Multi-step write operations are wrapped in database transactions.
- **Deployment:** Docker for containerization, `docker-compose.yml` for local development, and Terraform for AWS production infrastructure (ECS Fargate, RDS PostgreSQL, S3, SQS, ALB, CloudFront). CI/CD is managed via GitHub Actions.

**Feature Specifications:**
The system automates various freight forwarding stages, including:
- **Data Ingestion & Processing:** Email ingestion, document extraction using OCR and AI, entity resolution, and shipment construction.
- **Compliance & Risk:** Automated compliance screening and calculation of composite risk scores.
- **Financial Operations:** Insurance quoting, pricing based on rate tables, and document generation.
- **Exception Management:** Automated detection and AI classification of exception types.
- **AI Decision Engine:** Provides deterministic recommendations (9 types) with fingerprint-based deduplication, lifecycle management, and urgency-based expiry. Recommendations are enriched by external intelligence, incorporating external reason codes and signal evidence.
- **Control Tower:** An AI-powered dashboard filtering active recommendations, with dual view modes ("By Urgency" and "By Impact") and an External Intelligence section displaying high-risk ports, active disruptions, sanctions alerts, congestion hotspots, and weather risks.
- **External Intelligence Ingestion:** Framework for ingesting external signals (AIS vessel positions, port congestion, sanctions/denied parties, disruptions, weather risks) into the trade graph. This includes API endpoints and new DB tables for storing intelligence data with tenant/global scoping.
- **Intelligence-Driven Reanalysis:** Automatic re-evaluation of active shipments when new intelligence is ingested, utilizing a reanalysis queue and persistent scoring layer. Includes an analytics page for recommendation quality metrics and persistent scoring panels.
- **Graph-Native Operator Intelligence:** Dossier views for lanes, ports, carriers, and entities, aggregating scores, related shipments, active recommendations, intelligence signals, and graph relationships. Features impact-based recommendation prioritization and diagnostics analytics.
- **Workflow Task & Case Management:** A recommendation-to-action pipeline with a `workflow_tasks` table (9 task types, 5 statuses) and `task_events` audit trail. Includes API endpoints for task creation, management, and retrieval.
- **Semi-Autonomous Workflow Orchestration:** Policy engine for auto-task creation, SLA/escalation management, notifications, and routing. Features idempotent task creation, priority scoring, and operational notifications. Includes workflow analytics for completion, overdue, and escalation rates.
- **Predictive Intelligence (Phase 5A):** Pre-shipment risk evaluation combining 6 risk components (lane stress, port congestion, disruption, weather, carrier reliability, entity compliance) with weighted scoring. Disruption forecasting with 6 alert types (congestion trends, disruption clusters, weather forecasts, lane stress rising, port risk escalation, carrier degradation). Shipment readiness scoring (documentation, compliance, risk exposure, operational info). Historical pattern analysis (lane delays, port disruptions, carrier performance, entity compliance). Early recommendation generation with fingerprint deduplication. New service: `@workspace/svc-predictive-intelligence`. New tables: `pre_shipment_risk_reports`, `predictive_alerts`, `historical_patterns`. UI: Predictive Intelligence page with overview/alerts/patterns tabs, and Pre-Shipment Risk + Readiness widgets on ShipmentDetail. 25 tests in `phase5a.test.ts`.
- **Proactive Intervention & Booking-Time Decisioning (Phase 5B):** Booking decision engine (5 statuses: APPROVED, APPROVED_WITH_CAUTION, REQUIRES_REVIEW, RECOMMEND_ALTERNATIVE, BLOCKED) with weighted risk scoring and override capability. Release gate holds with policy-based evaluation (COMPLIANCE, RISK_THRESHOLD, DOCUMENT_VERIFICATION, INSURANCE, CARRIER_APPROVAL, SANCTIONS_CHECK) and audit trail. Mitigation playbooks auto-generated from risk conditions with step-level tracking. Alert-to-action automation converting predictive alerts into recommendations, workflow tasks, and gate holds. Scenario comparison for carrier/port/departure/insurance alternatives. Predictive performance analytics (alert accuracy, recommendation acceptance, booking distribution). New tables: `booking_decisions`, `release_gate_holds`, `mitigation_playbooks`, `scenario_comparisons`. 6 new services, 16 new API routes, UI widgets in ShipmentDetail + Performance tab in PredictiveIntelligence page. 28 tests in `phase5b.test.ts`.
- **Customer Management:** Customer import and directory functionalities.

## External Dependencies
- **AI Integration:** Anthropic Claude Sonnet (via Replit AI Integrations).
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