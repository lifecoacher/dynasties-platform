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
- **Authentication & Authorization:** Dual-mode authentication using JWT (demo) and Clerk (production). Supports multi-tenancy and role-based access control.
- **Security:** Rate limiting, explicit CORS, and global error handling.
- **Job Queues:** Abstraction for job types, supporting in-process EventEmitter (dev) and SQS (production).
- **File Storage:** Abstraction for file storage, defaulting to local filesystem and switching to S3 for production.
- **AI Agent Output Validation:** AI outputs are structured JSON, validated against Zod schemas, with fallbacks to deterministic output on failure.
- **Database Transactions:** Multi-step write operations are wrapped in transactions.
- **Deployment:** Docker for containerization, `docker-compose.yml` for local development, and Terraform for AWS production infrastructure (ECS Fargate, RDS PostgreSQL, S3, SQS, ALB, CloudFront). CI/CD is managed via GitHub Actions.

**Feature Specifications:**
The system automates various freight forwarding stages, including:
- **Data Ingestion & Processing:** Email ingestion, document extraction, entity resolution, shipment construction.
- **Compliance & Risk:** Automated compliance screening and composite risk scoring.
- **Financial Operations:** Insurance quoting, pricing, document generation, and a comprehensive billing module with invoice lifecycle management, receivables tracking, and financing integration.
- **Exception Management:** Automated detection and AI classification of exception types.
- **AI Decision Engine:** Provides deterministic recommendations with lifecycle management and external intelligence enrichment.
- **Control Tower:** An AI-powered dashboard for active recommendations, external intelligence, and graph-native operator intelligence.
- **External Intelligence Ingestion & Reanalysis:** Framework for ingesting external signals (AIS vessel positions, port congestion, sanctions, weather) and automatically re-evaluating shipments.
- **Workflow Task & Case Management:** Recommendation-to-action pipeline with audit trails and semi-autonomous workflow orchestration.
- **Predictive Intelligence & Proactive Intervention:** Pre-shipment risk evaluation, disruption forecasting, and booking-time decisioning.
- **Strategic Intelligence & Network Optimization:** Portfolio-level intelligence, lane strategy, and network optimization recommendations.
- **Policy Optimization & Productization:** Tenant-configurable policy engine with versioning and simulation.
- **Customer Management:** Customer import and directory functionalities.
- **Compliance Agent:** Orchestrates sanctions screening and risk scoring with AI reasoning.
- **Documentation Validation Agent:** Runs deterministic and AI-enhanced document completeness/consistency validation.
- **Routing & Pricing Agent:** Generates optimal route options with cost estimates and risk-aware recommendations using AI reasoning.
- **Global Decision Engine:** Centralizes all agent outputs into a single deterministic decision. Computes unified risk (max of base/dynamic scores, 0-100 clamped), evaluates compliance/doc/risk/gate inputs, produces finalStatus (APPROVED/BLOCKED/REJECTED/REVIEW) with releaseAllowed boolean. Enforces state machine guards: approval requires decision APPROVED + releaseAllowed=true, no decision = no approval. Schema: `shipment_decisions` (unique per shipment). API: POST/GET `/shipments/:id/decision`. Service: `services/shipment-decision/`. Fail-closed on input unavailability (marks REVIEW). UI: Decision panel in ShipmentDetail right sidebar, release gates reflect decision truth.
- **Active Financing Platform:** Manages invoice financing through a strict 5-state machine (NONE→OFFERED→ACCEPTED→FUNDED→REPAID) with explicit handling of transferred receivables and robust KPI integrity.

## External Dependencies
- **AI Integration:** Anthropic Claude via `@workspace/integrations-anthropic-ai`.
- **Authentication:** Clerk (`@clerk/clerk-react`, `@clerk/express`), `jsonwebtoken`.
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
- **External Signal Providers (Demo):** OpenWeather (live weather), AISStream (vessel positions).