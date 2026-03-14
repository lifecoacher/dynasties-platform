# Dynasties — Agentic Operating System for Global Trade

## Overview

Dynasties is an AI operating layer for global freight forwarding and logistics. It converts unstructured operational inputs (emails, PDFs, spreadsheets) into structured operational workflows using AI agents and deterministic execution services.

**Core Architectural Rule**: LLMs never directly write to the system of record. Agents produce structured JSON only. All writes happen through deterministic services with validation and approval.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Logging**: pino
- **ID generation**: ULID
- **AI**: Anthropic Claude Sonnet (via Replit AI Integrations)

## Structure

```text
workspace/
├── artifacts/                    # Deployable applications
│   ├── api-server/               # Express API server
│   └── mockup-sandbox/           # Design component sandbox
├── lib/                          # Shared libraries (composite, emit declarations)
│   ├── api-spec/                 # OpenAPI spec + Orval codegen config
│   ├── api-client-react/         # Generated React Query hooks
│   ├── api-zod/                  # Generated Zod schemas from OpenAPI
│   ├── db/                       # Drizzle ORM schema + DB connection
│   ├── shared-schemas/           # Domain Zod schemas (inter-service contracts)
│   ├── config/                   # Env var loading, logger, error types
│   ├── shared-utils/             # ID generation, entity normalization, doc classifier
│   ├── storage/                  # File storage abstraction (local FS for dev, S3 for prod)
│   ├── queue/                    # Job queue abstraction (EventEmitter for dev, SQS for prod)
│   └── integrations-anthropic-ai/ # Anthropic SDK client + batch utilities
├── services/
│   ├── email-ingestion/          # M2: MIME parsing, attachment extraction, email records
│   ├── document-extraction/      # M2: OCR + Claude agent + ExtractionValidator
│   ├── entity-resolution/        # M3: fuzzy matching, entity creation
│   ├── shipment-construction/    # M3: shipment draft assembly
│   ├── compliance-screening/     # M4: sanctions list screening
│   ├── risk-intelligence/        # M4: risk scoring algorithm
│   ├── insurance/                # M4: cargo insurance quoting
│   ├── pricing/                  # M6: charge calculation
│   ├── document-generation/      # M6: PDF generation
│   ├── billing/                  # M6: invoicing
│   ├── exception-management/     # M7: exception detection and routing
│   ├── claims-management/        # M7: claims lifecycle
│   ├── trade-lane-intelligence/  # M7: lane analytics
│   ├── agent-worker/             # Agent definitions and orchestration
│   └── workflow-orchestrator/    # Workflow state machine
├── infrastructure/               # AWS IaC (Terraform, M8)
├── tests/                        # Integration and isolation tests
├── scripts/                      # Utility scripts
├── .data/uploads/                # Local file storage (dev only, gitignored)
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── tsconfig.json
```

## Database Schema (12 First-Slice Tables)

All tables use ULID text primary keys. All tables include `company_id` for multi-tenancy.

| Table | Purpose | Milestone |
|-------|---------|-----------|
| companies | Tenant companies | M1 |
| users | Operators and admins | M1 |
| ingested_emails | Raw email intake records | M1 |
| ingested_documents | Parsed documents with extraction data (JSONB) | M1 |
| entities | Resolved parties (shipper, consignee, carrier, etc.) | M1 |
| shipments | Core shipment records | M1 |
| shipment_documents | Join table linking shipments to documents | M1 |
| compliance_screenings | Sanctions screening results | M1 |
| risk_scores | Multi-factor risk assessments | M1 |
| insurance_quotes | Cargo insurance quotes (Phase One: quote only) | M1 |
| operator_corrections | Field corrections by operators (learning loop) | M1 |
| events | Immutable audit log of all system actions | M1 |

### Deferred Tables
- `containers`, `memory_graph_nodes`, `memory_graph_edges`, `classification_precedents` → M3
- `shipment_charges`, `invoices`, `rate_tables`, `rules` → M6
- `exceptions`, `trade_lane_stats` → M7
- `claims`, `claim_communications` → M7
- `insurance_policies` → Phase Two (binding requires insurer API)
- `migration_imports` → M2

## TypeScript & Composite Projects

Every `lib/*` package extends `tsconfig.base.json` with `composite: true`. The root `tsconfig.json` lists all lib packages as project references.

- **Typecheck from root**: `pnpm run typecheck`
- **Build libs only**: `pnpm run typecheck:libs` (runs `tsc --build`)
- `artifacts/*` and `services/*` are leaf workspace packages checked with `tsc --noEmit`

## API Routes (Current)

All routes are under `/api` on the Express server:

| Route | Method | Description |
|-------|--------|-------------|
| `/api/healthz` | GET | Health check |
| `/api/shipments` | GET | List shipments |
| `/api/shipments/:id` | GET | Get shipment by ID |
| `/api/shipments/:id/compliance` | GET | Compliance screening for shipment |
| `/api/shipments/:id/risk` | GET | Risk score for shipment |
| `/api/shipments/:id/insurance` | GET | Insurance quote for shipment |
| `/api/entities` | GET | List entities |
| `/api/entities/:id` | GET | Get entity by ID |
| `/api/documents` | GET | List ingested documents |
| `/api/documents/:id` | GET | Get document by ID |
| `/api/documents/upload` | POST | Upload document (multipart, triggers extraction) |
| `/api/emails` | GET | List ingested emails |
| `/api/emails/ingest` | POST | Ingest raw email (multipart .eml, extracts attachments) |
| `/api/events` | GET | List events (optional ?type= filter) |

## M2 Extraction Pipeline

The first executable intelligence pipeline:

```
Upload/Email → File stored → Extraction job queued → OCR → Agent → Validator → DB write
```

### Components:
- **`lib/storage`** (`@workspace/storage`): File storage abstraction. Local filesystem (`.data/uploads/`) for dev; will swap to S3 in M8.
- **`lib/queue`** (`@workspace/queue`): Job queue abstraction. In-process EventEmitter for dev; will swap to SQS in M8.
- **`services/email-ingestion`** (`@workspace/svc-email-ingestion`): MIME parsing via `mailparser`, attachment extraction, creates `ingested_emails` + `ingested_documents` records.
- **`services/document-extraction`** (`@workspace/svc-document-extraction`): OCR via `pdf-parse`, Document Extraction Agent (Claude Sonnet), ExtractionValidator (Zod schema validation).

### Core Rule Enforcement:
- `agent.ts`: Claude Sonnet returns structured JSON only. System prompt enforces JSON-only output.
- `validator.ts`: ExtractionValidator validates agent output against `ExtractionOutputSchema` (Zod). Only validated data is written to `ingested_documents.extracted_data`.
- If validation fails: document marked as FAILED, `AGENT_VALIDATION_FAILURE` event logged.
- If validation passes: document marked as EXTRACTED, `EXTRACTION_COMPLETED` event logged with field/review counts.

### Extracted Fields:
shipper, consignee, notifyParty, vessel, voyage, portOfLoading, portOfDischarge, commodity, hsCode, packageCount, weight, volume, freightTerms, releaseType, shipmentDate, containerNumbers, bookingNumber, blNumber

Each field includes: `value`, `confidence` (0-1), `source` (quote from document), `needsReview` (boolean).

## Key Packages

### `lib/shared-schemas` (`@workspace/shared-schemas`)
Domain Zod schemas for all 12 first-slice entities. Includes `ExtractionOutputSchema` — the Zod contract that gates all agent output.

### `lib/config` (`@workspace/config`)
- `loadEnv()` — Zod-validated environment variable loader
- `createLogger(serviceName)` — pino logger factory
- Error types: `AppError`, `ValidationError`, `AgentOutputError`

### `lib/shared-utils` (`@workspace/shared-utils`)
- `generateId()` — ULID generation
- `normalizeEntityName(name)` — Strip legal suffixes, lowercase, normalize whitespace
- `classifyDocumentType(fileName, contentPreview?)` — Deterministic document type classification

### `lib/db` (`@workspace/db`)
Drizzle ORM with PostgreSQL. 12 tables with foreign keys and indexes.
- `pnpm --filter @workspace/db run push` — push schema to dev database

### `lib/integrations-anthropic-ai` (`@workspace/integrations-anthropic-ai`)
Anthropic SDK client via Replit AI Integrations proxy. No API key required — uses `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` and `AI_INTEGRATIONS_ANTHROPIC_API_KEY` env vars (auto-provisioned).

## Root Scripts

- `pnpm run build` — typecheck then recursively build all packages
- `pnpm run typecheck` — full workspace typecheck
- `pnpm --filter @workspace/api-spec run codegen` — generate React Query hooks + Zod schemas from OpenAPI

## Build Roadmap

| Milestone | Focus | Status |
|-----------|-------|--------|
| M1 | Foundation & Repo Setup | ✅ Complete |
| M2 | Email Ingestion & Document Extraction | ✅ Complete |
| M3 | Entity Resolution & Shipment Construction | Next |
| M4 | Compliance, Risk & Insurance | Planned |
| M5 | Operator Workbench UI | Planned |
| M6 | Pricing, Document Generation & Invoicing | Planned |
| M7 | Exceptions, Claims & Trade Lane Intelligence | Planned |
| M8 | AWS Deployment & Pilot Readiness | Planned |
