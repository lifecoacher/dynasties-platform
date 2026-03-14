# Dynasties — Agentic Operating System for Global Trade

## Overview
Dynasties is an AI operating layer designed for global freight forwarding and logistics. Its primary purpose is to transform unstructured operational data (from emails, PDFs, spreadsheets) into structured, actionable workflows. This is achieved through the use of AI agents and deterministic execution services. The project aims to enhance efficiency and automation in a traditionally manual industry by ensuring that AI outputs are validated and integrated into the system of record through controlled processes.

## User Preferences
I prefer iterative development with a focus on delivering functional, well-tested components in each step.
I value clear and concise communication.
I prefer to be asked before major architectural changes or significant refactoring.
I like to see unit and integration tests for new features.
I prefer detailed explanations for complex logic or design decisions.
Do not make changes to the `infrastructure/` folder.
Do not make changes to the `tests/` folder without prior discussion.

## System Architecture
The core architectural principle is that LLMs never directly write to the system of record; instead, agents produce structured JSON outputs which are then processed by deterministic services with validation and approval mechanisms before any database writes occur.

**UI/UX Decisions:**
The project includes a React-based Operator Workbench UI (`workbench/`) for managing operations and interacting with the system. A mockup sandbox (`mockup-sandbox/`) is used for design component development.

**Technical Implementations:**
- **Monorepo:** Managed with pnpm workspaces.
- **Backend:** Node.js 24, TypeScript 5.9, Express 5.
- **Database:** PostgreSQL with Drizzle ORM for schema definition and interaction.
- **Validation:** Zod for data validation, including `drizzle-zod` for ORM integration and Orval for API codegen from OpenAPI specifications. Request body validation via `validateBody()` middleware using Zod schemas in `artifacts/api-server/src/schemas/index.ts`.
- **Build System:** esbuild for CJS bundling.
- **Logging:** pino for efficient logging.
- **ID Generation:** ULID for unique identifiers across the system.
- **Multi-tenancy:** All database tables include `company_id`. All route handlers scope queries by `companyId` from JWT claims via `getCompanyId(req)`.
- **API:** All routes are exposed under `/api` and defined via OpenAPI specification, from which React Query hooks and Zod schemas are generated.
- **Financial Columns:** All monetary values use `numeric(12,2)` (not float/real) in schema definitions.
- **Pagination:** All list endpoints support `?page=N&limit=N` via `parsePagination()` helper. Responses include `pagination` metadata.

**Authentication & Authorization:**
- **JWT Auth:** Bearer token auth via `Authorization` header. Tokens include `userId`, `companyId`, `email`, `role`.
- **Password Hashing:** bcryptjs with 12 rounds.
- **Roles:** ADMIN (level 4), MANAGER (level 3), OPERATOR (level 2), VIEWER (level 1).
- **Middleware Chain:** `requireAuth` → `requireTenant` → route handlers. Health and auth routes are public.
- **Frontend Auth:** `AuthProvider` context in workbench stores JWT in localStorage. `customFetch` (api-client-react) auto-injects `Authorization: Bearer` header. Token validated against `/auth/me` on page load. 401 responses trigger automatic logout.
- **Dev Auto-Login:** In dev mode (`import.meta.env.DEV`), `LoginPage` auto-logs in with seed admin credentials for demo convenience.
- **Role Guards:** `requireRole(...roles)` for exact role match, `requireMinRole(role)` for hierarchy-based access.
- **Admin Routes:** Inline `[requireAuth, requireRole("ADMIN")]` per-route (not router-level to avoid Express 5 middleware leaking).
- **JWT Secret:** `JWT_SECRET` env var, minimum 32 characters, validated at startup via Zod.
- **JWT Role Refresh:** `refreshRole` middleware fetches live role from DB on each request and handles deactivated users.
- **Seed Admin:** `admin@dynasties.io` / `DynastiesAdmin2026!` in `cmp_seed_001`.

**Security & Rate Limiting:**
- **Rate Limiting:** `express-rate-limit` — `loginLimiter` (15 requests/15min on auth), `apiLimiter` (200 requests/60s global).
- **Request Logging:** Middleware logs method/path/status/duration/userId/companyId on every request.
- **CORS:** Explicit origin allowlist via `CORS_ALLOWED_ORIGINS` env var.
- **Global Error Handler:** Catches unhandled errors, returns 500 with safe error messages.
- **Request Validation:** Zod `validateBody()` middleware on all mutation endpoints.

**Audit Logging:**
- All events include `actorType`: `USER` (API routes), `SERVICE` (queue consumers), `AGENT` (AI agents), `SYSTEM` (automated).
- Events table uses plain `text` for `eventType` (not enum) for extensibility.

**Feature Specifications:**
The system processes various stages of freight forwarding, including:
- **Email Ingestion:** Parsing MIME, extracting attachments, creating `ingested_emails` and `ingested_documents` records.
- **Document Extraction:** OCR processing, AI agent-based data extraction, and Zod schema validation for extracted data. This triggers the `ShipmentPipelineJob`. Race condition on `tryTriggerPipeline` fixed with `pg_advisory_xact_lock`.
- **Entity Resolution:** Deterministic matching (exact, normalized, fuzzy) to create or reuse `entities` records.
- **Shipment Construction:** Assembling shipment drafts and handling field conflicts.
- **Compliance Screening:** Screening shipment parties against sanctions lists with AI agent assistance for ambiguous matches. Unique constraint on `shipmentId`.
- **Risk Intelligence:** Calculating composite risk scores and providing AI-driven explanations. Unique constraint on `shipmentId`.
- **Insurance Quoting:** Generating cargo insurance quotes with AI-generated rationale. Unique constraint on `shipmentId`.
- **Pricing:** Calculating shipment charges based on rate tables and AI-suggested supplemental charges.
- **Document Generation:** Generating critical documents like HBL, Arrival Notices, and Shipment Summaries.
- **Billing:** Consolidating charges and generating invoices.
- **Exception Management:** Automated detection of 6 exception types (extraction failures, document conflicts, compliance alerts, high risk, missing documents, billing discrepancies) with AI agent classification and severity assessment. Triggered after billing completion.
- **Trade Lane Intelligence:** Aggregation of shipment statistics per origin-destination lane with AI advisory on cost ranges, transit times, delay probability, and seasonal factors. Triggered after billing completion.
- **Claims Management:** On-demand claim preparation with AI agent for claim narrative generation, coverage analysis, and submission recommendations. Initiated via API.

**System Design Choices:**
- **Modular Services:** The architecture is broken down into distinct services (e.g., `email-ingestion`, `document-extraction`, `entity-resolution`) to promote separation of concerns and scalability.
- **Job Queues:** An abstraction for job queuing (`lib/queue`) supports 11 job types (extraction, shipment-pipeline, compliance, risk, insurance, pricing, docgen, billing, exception, trade-lane, claims), defaulting to in-process EventEmitter for development and designed to swap to SQS for production. Queue health check in `/api/healthz` verifies all 11 consumers are registered.
- **File Storage:** An abstraction for file storage (`lib/storage`) uses the local filesystem for development and will switch to S3 for production.
- **Agent Output Validation:** All AI agents return structured JSON, which is then validated against Zod schemas. If validation fails, services fall back to deterministic output, ensuring no silent failures.
- **Composite TypeScript Projects:** The monorepo leverages TypeScript's composite project feature for efficient type-checking and building across shared libraries.
- **N+1 Prevention:** GET /shipments uses batch queries (4 parallel `IN` queries) instead of per-shipment lookups.
- **Idempotency:** Unique indexes on `shipmentId` in compliance_screenings, risk_scores, insurance_quotes tables prevent duplicate processing.

**Deployment Architecture (M8):**
- **Docker:** Multi-stage `Dockerfile` for API server, `Dockerfile.frontend` for nginx-served frontend.
- **docker-compose.yml:** Local dev with PostgreSQL 16, LocalStack (S3/SQS), API, and frontend services.
- **Terraform IaC (`infra/main.tf`):** AWS production: VPC, ECS Fargate (2-10 tasks with auto-scaling on CPU 70%/memory 80%), RDS PostgreSQL 16 (multi-AZ), S3 (raw + generated docs + frontend), SQS (11 queues + DLQs), ALB with HTTPS (ACM cert + TLS 1.3), CloudFront, SSM Parameter Store for secrets, CloudWatch alarms (5xx, RDS CPU, DLQ depth).
- **CI/CD (`.github/workflows/deploy.yml`):** GitHub Actions: lint/typecheck → build/push ECR (API + frontend) → run DB migrations → deploy ECS → sync frontend to S3 + CloudFront invalidation.

## External Dependencies
- **AI Integration:** Anthropic Claude Sonnet (via Replit AI Integrations) for AI agent capabilities in document extraction, compliance, risk intelligence, insurance, and pricing.
- **Database:** PostgreSQL.
- **ORM:** Drizzle ORM.
- **Email Parsing:** `mailparser` for MIME parsing in email ingestion.
- **PDF Parsing:** `pdf-parse` for OCR in document extraction.
- **HTTP Framework:** Express 5.
- **Validation Library:** Zod.
- **OpenAPI Codegen:** Orval.
- **Logging Library:** pino.
- **Auth:** jsonwebtoken, bcryptjs.
- **Rate Limiting:** express-rate-limit.

## Environment Variables
Required:
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — JWT signing key (minimum 32 characters)

Optional:
- `PORT` — Server port (default: 8080 for API, 22653 for workbench)
- `NODE_ENV` — development | production | test
- `LOG_LEVEL` — fatal | error | warn | info | debug | trace
- `ANTHROPIC_API_KEY` — Anthropic API key for AI agents
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY` — Alternative Anthropic key (Replit integrations)
- `CORS_ALLOWED_ORIGINS` — Comma-separated allowed origins
- `STORAGE_BACKEND` — `local` | `s3` (default: local)
- `QUEUE_BACKEND` — `local` | `sqs` (default: local)
- `AWS_REGION` — AWS region (default: us-east-1)
- `S3_ENDPOINT` — Custom S3 endpoint (for LocalStack)
- `SQS_ENDPOINT` — Custom SQS endpoint (for LocalStack)
- `S3_BUCKET_RAW_DOCUMENTS` — S3 bucket for raw documents
- `S3_BUCKET_GENERATED_DOCUMENTS` — S3 bucket for generated documents
