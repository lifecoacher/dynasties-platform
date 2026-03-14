# Dynasties — The Operating System for Global Trade

## The Problem

Global freight forwarding runs on unstructured data. Every day, thousands of shipping documents — Bills of Lading, packing lists, commercial invoices — arrive as email attachments. Operators manually read these documents, type data into systems, check compliance lists, assess risk, arrange insurance, and generate invoices.

This process is slow, error-prone, and expensive. A single shipment can require 30+ manual data entry steps across multiple systems. Errors in HS codes, weights, or party names cascade into customs delays, compliance violations, and financial losses.

## What Dynasties Does

Dynasties is an AI-powered operating system that automates the entire freight forwarding workflow — from email to invoice — in minutes instead of hours.

**One email in. Fully processed shipment out.**

### How It Works

1. **An email arrives** containing shipping documents (Bill of Lading, packing list, etc.)

2. **AI reads the documents** and extracts every relevant field — shipper, consignee, commodity, HS codes, weights, volumes, vessel, routing — with confidence scores for each field

3. **Entities are automatically resolved** — the system recognizes known trading partners or creates new records, eliminating duplicate entries

4. **A complete shipment record is created** with all extracted data, ready for operator review

5. **Three intelligence engines run simultaneously:**
   - **Compliance screening** checks all parties against OFAC, EU, and UN sanctions lists
   - **Risk scoring** evaluates the shipment across multiple factors and recommends whether to auto-approve, review, or reject
   - **Insurance quoting** calculates cargo insurance premiums based on commodity, value, and trade lane

6. **The operator reviews and approves** — correcting any AI extractions if needed, with full visibility into the AI's reasoning

7. **Pricing, documents, and invoicing** are generated automatically upon approval

## The Intelligence Layer

What makes Dynasties different is not just automation — it's intelligence.

**For every shipment, the system provides:**
- Full compliance screening with sanctions check results
- Composite risk score with factor-level breakdown
- Insurance quote with premium calculation rationale
- Extraction confidence scores showing where AI was certain and where it flagged for review
- Complete decision trace showing exactly how the system reached each conclusion

**For the portfolio, the system provides:**
- Trade lane analytics showing cost trends and delay probabilities
- Exception detection identifying anomalies across the pipeline
- Entity relationship mapping showing trading partner networks

## Why This Becomes the Operating System for Global Trade

### Data Moat
Every shipment processed makes the system smarter. Entity resolution improves with each match. Risk scoring calibrates with each decision. Trade lane intelligence accumulates with each completed shipment.

### Network Effect
As more forwarders use Dynasties, the collective intelligence about trade lanes, carriers, and compliance risks grows — creating value for every participant.

### Platform Extension Points
The modular architecture enables natural expansion into:
- Customs brokerage automation
- Carrier rate management
- Supply chain financing
- Predictive logistics

## By the Numbers

| Metric | Manual Process | Dynasties |
|--------|---------------|-----------|
| Document processing | 30-45 minutes | Under 2 minutes |
| Compliance check | Manual lookup | Automated, instant |
| Risk assessment | Subjective judgment | Data-driven scoring |
| Insurance quoting | Broker phone call | Instant AI quote |
| Invoice generation | End of day | Immediate on approval |

## Technical Foundation

- **AI with guardrails:** LLMs never write directly to the database. Every AI output is validated before it touches the system of record.
- **Multi-tenant by design:** Complete data isolation between organizations, enforced at every layer.
- **Financial precision:** All monetary calculations use exact decimal arithmetic — no floating point errors.
- **Full audit trail:** Every action — human or AI — is logged with actor type, timestamp, and context.
- **Cloud-native deployment:** Scales automatically based on demand using containerized microservices.

## Current Capabilities (Validated)

- Bill of Lading processing: 100% success rate
- Shipping Instructions processing: 100% success rate
- Entity resolution accuracy: 100% (3-tier matching)
- Compliance screening: Operational across OFAC/EU/UN
- Risk scoring: Composite scores with factor breakdown
- Insurance quoting: Premium calculation with AI rationale
- Operator workbench: Full review, edit, approve/reject workflow
- Shipment Intelligence dashboard: Portfolio-wide analytics
- AI Decision Trace: Complete transparency into system reasoning
