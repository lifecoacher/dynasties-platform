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
- **AI Decision Engine:** Provides deterministic recommendations (8 types: CARRIER_SWITCH, ROUTE_ADJUSTMENT, INSURANCE_ADJUSTMENT, COMPLIANCE_ESCALATION, DELAY_WARNING, MARGIN_WARNING, DOCUMENT_CORRECTION, RISK_MITIGATION) after compliance, risk, and insurance stages are complete. Features: fingerprint-based deduplication (SHA-256 hash of shipment+type+reasonCodes+action), lifecycle management (PENDING→SHOWN→ACCEPTED/MODIFIED/REJECTED→IMPLEMENTED, plus EXPIRED/SUPERSEDED), urgency-based expiry (CRITICAL=24h, HIGH=72h, MEDIUM=7d, LOW=14d), stale rec auto-expiry on query. Thresholds centralized in `services/decision-engine/src/config.ts`. Full modify flow with notes modal and outcome recording UI (delay, cost, margin, claim, evaluation).
- **Control Tower:** An AI-powered dashboard filtering active (non-expired, non-superseded) recommendations with stat cards, urgent recommendations, and shipment intervention views. Includes External Intelligence section with 5 widgets: High-Risk Ports, Active Disruptions, Sanctions Alerts, Congestion Hotspots, Weather Risks. "Ingest Intel" button triggers ingestion of all 6 source types.
- **External Intelligence Ingestion (Phase 2A):** Framework for ingesting external signals (AIS vessel positions, port congestion, sanctions/denied parties, disruptions, weather risks) into the trade graph. Architecture: fixture-backed adapters → Zod validation → fingerprint-based dedup → DB persist → event logging → graph linking. Service: `@workspace/svc-intelligence-ingestion` at `services/intelligence-ingestion/`. 9 API endpoints under `/api/intelligence/`. All intelligence data uses tenant/global scoping (`companyId = tenant OR IS NULL`). New DB tables: intelligence_sources, vessel_positions, vessel_port_calls, port_congestion_snapshots, sanctions_entities, denied_parties, disruption_events, weather_risk_events, lane_market_signals, ingestion_runs. 9 new trade graph edge types for entity linking.
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