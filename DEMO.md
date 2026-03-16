# Lorian Demo Environment

A self-contained demo dataset for **Dynasties** — the agentic OS for global freight forwarding. The Lorian Freight Solutions demo provides a realistic, isolated environment covering every major feature across the platform.

## Quick Start

```bash
# Seed the Lorian demo (idempotent — skips if already seeded)
pnpm --filter @workspace/db run seed:lorian

# Reset — destroys and re-seeds from scratch
pnpm --filter @workspace/db run reset:lorian

# Destroy — removes all Lorian demo data, leaves other tenants intact
pnpm --filter @workspace/db run destroy:lorian
```

## Login Credentials

| Role     | Email                  | Password          |
|----------|------------------------|--------------------|
| Admin    | admin@lorian.demo      | LorianDemo2026!    |
| Manager  | manager@lorian.demo    | LorianDemo2026!    |
| Operator | ops@lorian.demo        | LorianDemo2026!    |
| Viewer   | viewer@lorian.demo     | LorianDemo2026!    |

## What's Included

### Company & Users
- **Lorian Freight Solutions** — Singapore-based freight forwarder
- 4 users across all role levels (Admin, Manager, Operator, Viewer)

### Entities (20)
- 6 shippers (China, Japan, Germany, Singapore)
- 6 consignees (US, Netherlands, UAE, UK, Germany)
- 8 carrier entities (Maersk, MSC, COSCO, CMA CGM, Hapag-Lloyd, Evergreen, ONE, ZIM)

### Shipments (20)
Full lifecycle coverage across 10 trade lanes:
- **Active**: IN_TRANSIT (6), AT_PORT (1), CUSTOMS (1), BOOKED (3), APPROVED (1), PENDING_REVIEW (2), PENDING (1)
- **Completed**: DELIVERED (1), CLOSED (1)
- **Terminal**: REJECTED (1), CANCELLED (1), DRAFT (1)

Commodities range from consumer electronics to industrial machinery, with realistic cargo values ($67K–$730K).

### Intelligence Layer
- **7 intelligence sources** (AIS, port congestion, OFAC, EU denied parties, disruption alerts, weather, market signals)
- **6 disruption events** (typhoon, labor strike, Suez blockage, Red Sea security, LA crane failure)
- **4 weather risk events** (typhoon, monsoon, fog, Pacific storm)
- **3 sanctioned entities** + 1 denied party
- **10 port congestion snapshots** (all 10 ports)
- **8 vessel positions** with real-time tracking data
- **4 vessel port calls**
- **6 lane market signals** (rate changes, capacity shifts, demand surges)

### Scoring & Analytics
- **10 lane scores**, **10 port scores**, **8 carrier scores**, **12 entity scores**
- **13 shipment intelligence snapshots**
- **13 pre-shipment risk reports** (LOW to CRITICAL)
- **5 predictive alerts** (congestion trends, disruption clusters, weather forecasts)
- **6 historical patterns**

### Decision Engine
- **12 recommendations** (carrier switches, route adjustments, compliance escalations, delay warnings, etc.)
- **5 recommendation outcomes** (accepted, rejected, implemented)
- **8 workflow tasks** (compliance cases, route reviews, disruption response, risk mitigation)
- **Task events** (creation, assignment, completion audit trail)
- **5 policy decisions** (auto-created tasks from policy engine)
- **6 operational notifications**

### Proactive Intelligence
- **12 booking decisions** (approved, approved with caution, requires review)
- **5 release gate holds** (compliance blocks, disruption approvals, weather holds)
- **3 mitigation playbooks** (multi-step response plans with status tracking)
- **1 scenario comparison** (Suez rerouting analysis)

### Strategic Layer
- **10 lane strategies** (STABLE, MONITOR_CLOSELY, REDUCE_EXPOSURE, REROUTE_CONDITIONAL, REPRICE_LANE, TIGHTEN_GATES)
- **8 carrier allocations** (PREFERRED, ACCEPTABLE_MONITOR, AVOID, REDUCE, INCREASE)
- **5 network recommendations** (diversify routing, reduce port traffic, shift carrier volume)
- **2 portfolio snapshots** (daily + weekly)
- **1 intervention attribution** (weekly value summary)

### Policy & Governance
- **3 tenant policy overrides** (confidence threshold, compliance screening, critical SLA)
- **1 operating mode** (SEMI_AUTONOMOUS)
- **2 report snapshots** (executive summary, portfolio risk)
- **40 trade graph edges** (shipment-lane, shipper-carrier, shipment-port relationships)

## Demo Scenarios

### 1. Disruption Response
Walk through the typhoon + Suez blockage impact on active shipments. Show how the system auto-creates tasks, triggers gate holds, and generates mitigation playbooks.

### 2. Compliance Workflow
Demonstrate the dual-use goods compliance case for polymer resins — from sanctions screening alert through gate hold to resolution.

### 3. Strategic Intelligence
Show lane strategies recommending route diversification and carrier reallocation based on composite stress analysis.

### 4. Policy Optimization
Use PolicyStudio to adjust operating mode from SEMI_AUTONOMOUS to APPROVAL_HEAVY and see how it changes task creation behavior.

### 5. Portfolio Overview
Walk through the executive summary report, portfolio risk distribution, and intervention attribution metrics.

## Data Isolation

All Lorian data uses the company ID `cmp_lorian_001`. The destroy script deletes exclusively by this company ID, so other tenant data is never affected.

All entity IDs follow the pattern `*_lor_*` for easy identification.

## Architecture

```
lib/db/src/lorian-demo/
├── constants.ts         # IDs, entities, helper functions
├── seed-lorian.ts       # Main seed script (38 table groups)
├── destroy-lorian.ts    # Ordered deletion (FK-safe)
├── reset-lorian.ts      # Destroy + re-seed
└── index.ts             # Public exports
```
