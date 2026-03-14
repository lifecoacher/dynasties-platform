# Dynasties — System Architecture Overview

## What Is Dynasties?

Dynasties is an AI-powered operating system for global freight forwarding. It transforms unstructured shipping documents — emails, Bills of Lading, packing lists, commercial invoices — into structured, validated, and actionable shipment intelligence.

---

## Core Architecture Principle

**LLMs never write directly to the database.** Every AI agent produces structured JSON output. That output is validated by Zod schemas before any deterministic service writes to the system of record. If AI validation fails, the system falls back to deterministic processing — never silently fails.

```
Email → AI Agent → JSON → Zod Validation → Deterministic Service → Database
```

---

## Module Architecture

### 1. Email Ingestion Service
**Purpose:** Receives raw MIME emails and parses them into structured records.
- Parses MIME structure using `mailparser`
- Extracts attachments (PDFs, text files)
- Stores raw files to object storage (S3 in production, local filesystem in development)
- Creates `ingested_emails` and `ingested_documents` database records
- Publishes extraction jobs to the queue

### 2. Document Extraction Engine
**Purpose:** Uses AI to extract structured data from shipping documents.
- Reads document content (plain text or PDF via `pdf-parse`)
- Sends content to Claude (Anthropic) with a structured extraction prompt
- AI returns JSON with field-level confidence scores
- Zod validates the extracted fields against the shipment schema
- Fields flagged for human review when confidence is below threshold
- Triggers the shipment pipeline upon completion

### 3. Entity Resolution Service
**Purpose:** Matches extracted party names to existing database entities or creates new ones.
- Three-tier matching: exact name match → normalized match → fuzzy match
- Resolves shipper, consignee, notify party, and carrier
- Creates new `entities` records when no match is found
- Tracks entity status (UNVERIFIED → VERIFIED via operator confirmation)
- Prevents duplicate entity proliferation

### 4. Shipment Construction Engine
**Purpose:** Assembles a complete shipment draft from extracted documents and resolved entities.
- Merges fields from multiple documents for the same booking
- Detects and reports field conflicts when documents disagree
- Generates a unique shipment reference (SHP-{B/L number})
- Sets initial status to DRAFT for operator review
- Uses advisory locks (`pg_advisory_xact_lock`) to prevent race conditions

### 5. Compliance Screening Engine
**Purpose:** Screens all shipment parties against sanctions and restricted party lists.
- Checks shipper, consignee, notify party, and carrier
- Simulates OFAC, EU, and UN sanctions list screening
- AI agent provides confidence scores for ambiguous matches
- Returns CLEAR, FLAGGED, or ALERT status
- Unique index per shipment prevents duplicate screenings
- All writes wrapped in database transactions

### 6. Risk Scoring Engine
**Purpose:** Calculates a composite risk score for each shipment.
- Evaluates multiple risk factors: trade lane, commodity, party history, compliance
- AI agent generates factor-level scores and explanations
- Produces a composite score (0.0 = no risk, 1.0 = maximum risk)
- Recommends action: AUTO_APPROVE, MANUAL_REVIEW, or REJECT
- Unique index per shipment ensures idempotency

### 7. Insurance Quoting Engine
**Purpose:** Generates cargo insurance quotes based on shipment characteristics.
- Evaluates cargo value, commodity type, trade lane risk, and vessel
- AI agent determines coverage type and premium calculation rationale
- Supports NAMED_PERILS and ALL_RISK coverage types
- Calculates premium based on cargo value and risk adjustments
- Unique index per shipment prevents duplicate quotes

### 8. Pricing Engine
**Purpose:** Calculates shipment charges from rate tables and AI-suggested supplementals.
- Applies deterministic charges from rate tables
- AI agent suggests additional charges based on shipment context
- Deduplicates charges by charge code
- All charges inserted in a single database transaction

### 9. Document Generation Engine
**Purpose:** Produces shipment documents (HBL, Arrival Notice, Summary).
- Generates structured text documents from shipment data
- Stores generated documents in object storage
- Creates database records linking documents to shipments

### 10. Billing Engine
**Purpose:** Consolidates charges into invoices.
- Aggregates all shipment charges
- Generates invoice content with line items
- Creates invoice records with 30-day payment terms
- Triggers exception management and trade lane intelligence

### 11. Exception Management (Future Enhancement)
**Purpose:** Automated detection of anomalies across the pipeline.
- Detects 6 exception types: extraction failures, document conflicts, compliance alerts, high risk, missing documents, billing discrepancies
- AI agent classifies severity and recommends resolution

### 12. Trade Lane Intelligence (Future Enhancement)
**Purpose:** Aggregates shipment statistics by origin-destination trade lane.
- Calculates average costs, transit times, and delay probabilities
- AI generates advisory on seasonal factors and cost optimization

---

## Data Flow

```
[Email Inbox]
      │
      ▼
[Email Ingestion] ──→ ingested_emails + ingested_documents
      │
      ▼
[Document Extraction] ──→ AI extracts fields + confidence scores
      │
      ▼
[Entity Resolution] ──→ entities table (match or create)
      │
      ▼
[Shipment Construction] ──→ shipments table (DRAFT status)
      │
      ├──→ [Compliance Screening] ──→ compliance_screenings
      ├──→ [Risk Scoring] ──→ risk_scores
      └──→ [Insurance Quoting] ──→ insurance_quotes
              │
              ▼
      [Operator Review] ──→ APPROVE / REJECT
              │
              ▼ (on APPROVE)
      [Pricing] ──→ shipment_charges
              │
              ▼
      [Document Generation] ──→ HBL, Arrival Notice, Summary
              │
              ▼
      [Billing] ──→ invoices
              │
              ├──→ [Exception Management]
              └──→ [Trade Lane Intelligence]
```

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 24, TypeScript 5.9 |
| API | Express 5, OpenAPI specification |
| Database | PostgreSQL with Drizzle ORM |
| Validation | Zod (all inputs and AI outputs) |
| AI | Anthropic Claude Sonnet |
| Queue | In-process EventEmitter (dev) / SQS (production) |
| Storage | Local filesystem (dev) / S3 (production) |
| Frontend | React 19, Vite, Tailwind CSS, React Query |
| Auth | JWT with bcrypt, role-based access control |
| Deployment | Docker, ECS Fargate, RDS, CloudFront |

---

## Security Architecture

- **Multi-tenant isolation:** All queries scoped by `companyId` from JWT claims
- **Role-based access:** ADMIN, MANAGER, OPERATOR, VIEWER hierarchy
- **Rate limiting:** Login (15/15min) and API (200/60s) rate limits
- **CORS:** Explicit origin allowlist
- **Financial precision:** All monetary values stored as `numeric(12,2)`
- **Idempotency:** Unique database indexes prevent duplicate processing
- **Atomic writes:** All multi-step operations wrapped in database transactions
