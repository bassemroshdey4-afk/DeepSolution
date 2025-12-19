# Shipping OPS Automation Map

This document provides a complete mapping of all shipping automation workflows, their inputs, outputs, and integration points. It serves as the authoritative reference for the shipping operations automation layer.

## Overview

The Shipping OPS Automation Track enables automatic order status tracking and station routing, even when courier APIs are unavailable. The system supports three ingestion modes: API connectors, CSV upload, and email parsing.

| Component | Purpose |
|-----------|---------|
| S1: Shipping Status Ingestion | Pull/receive shipping updates from multiple sources |
| S2: Provider→Internal Mapping | Translate provider statuses to internal order states |
| S3: Ops Station Routing | Route orders to correct UI queues (CallCenter/Ops/Finance/Returns) |
| S4: Courier Performance Analytics | Compute carrier metrics and recommendations |

## Data Model

### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `shipment_events` | History of all shipping status updates | `tracking_number`, `provider_status`, `internal_status`, `occurred_at` |
| `provider_status_mapping` | Maps provider statuses to internal states | `provider`, `provider_status`, `internal_status`, `triggers_station` |
| `order_internal_events` | Station timeline for each order | `order_id`, `from_state`, `to_state`, `station`, `triggered_by` |
| `order_station_metrics` | SLA timers per station | `order_id`, `station`, `entered_at`, `exited_at`, `sla_breached` |
| `courier_performance_daily` | Daily courier aggregates | `courier`, `date`, `delivery_rate`, `return_rate`, `score` |

### Internal Order States

The system uses a comprehensive state machine for order tracking:

| State | Station | Description |
|-------|---------|-------------|
| `new` | CallCenter | New order awaiting confirmation |
| `call_center_pending` | CallCenter | Awaiting customer confirmation call |
| `call_center_confirmed` | Operations | Customer confirmed, ready for processing |
| `operations_pending` | Operations | Awaiting fulfillment |
| `operations_processing` | Operations | Being packed/prepared |
| `shipped` | - | Handed to carrier |
| `in_transit` | - | In carrier network |
| `out_for_delivery` | - | With delivery driver |
| `delivered` | Finance | Successfully delivered |
| `finance_pending` | Finance | Awaiting COD settlement |
| `finance_settled` | - | COD collected and settled |
| `return_requested` | Returns | Customer requested return |
| `return_in_transit` | Returns | Return shipment in transit |
| `return_received` | Returns | Return received at warehouse |
| `cancelled` | - | Order cancelled |

### SLA Targets

| Station | Target Time | Description |
|---------|-------------|-------------|
| CallCenter | 60 minutes | Time to confirm order with customer |
| Operations | 240 minutes | Time to process and ship order |
| Finance | 1440 minutes (24h) | Time to settle COD after delivery |
| Returns | 2880 minutes (48h) | Time to process return after receipt |

## Workflow S1: Shipping Status Ingestion

### Overview

| Aspect | Configuration |
|--------|---------------|
| Trigger | Cron every 3-6 hours |
| Workflow ID | S1 |
| Idempotency Key | `S1:{tenant_id}:{tracking_number}:{provider_status}:{occurred_at}` |

### Ingestion Modes

The workflow supports three ingestion modes to accommodate different carrier integration levels:

**Mode 1: API Connector**

For carriers with API access (Aramex, SMSA, J&T, etc.), the workflow calls the carrier API directly.

| Input | Source |
|-------|--------|
| Carrier credentials | `ad_platform_connections` table |
| Tracking numbers | `shipments` table (pending updates) |

| Output | Destination |
|--------|-------------|
| Shipment events | `shipment_events` table |
| Shipment status | `shipments.status` field |

**Mode 2: CSV Upload (Add-on)**

For carriers without API access, users can upload CSV files with status updates.

| Input | Format |
|-------|--------|
| CSV file | Columns: `tracking_number`, `status`, `date`, `location` (optional), `description` (optional) |
| Provider name | Selected by user |

| Output | Destination |
|--------|-------------|
| Parsed events | `shipment_events` table |

**Mode 3: Email Parsing (Add-on)**

For carriers that send status updates via email, the workflow can parse email content.

| Input | Format |
|-------|--------|
| Email content | Raw email body text |
| Provider name | Detected or specified |

| Output | Destination |
|--------|-------------|
| Extracted events | `shipment_events` table |

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        S1: Shipping Status Ingestion                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐                            │
│  │ API Mode │   │ CSV Mode │   │Email Mode│                            │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘                            │
│       │              │              │                                    │
│       └──────────────┼──────────────┘                                    │
│                      ▼                                                   │
│              ┌───────────────┐                                          │
│              │ Parse Events  │                                          │
│              └───────┬───────┘                                          │
│                      ▼                                                   │
│              ┌───────────────┐                                          │
│              │Check Idempot. │──── Skip if exists                       │
│              └───────┬───────┘                                          │
│                      ▼                                                   │
│              ┌───────────────┐                                          │
│              │Find Shipment  │                                          │
│              └───────┬───────┘                                          │
│                      ▼                                                   │
│              ┌───────────────┐                                          │
│              │Get Status Map │                                          │
│              └───────┬───────┘                                          │
│                      ▼                                                   │
│  ┌───────────────────┼───────────────────┐                              │
│  │                   │                   │                              │
│  ▼                   ▼                   ▼                              │
│ shipment_events   shipments        Trigger S2                           │
│ (INSERT)          (UPDATE)         (if mapped)                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Audit Events

| Event Type | Payload |
|------------|---------|
| `SHIPMENT_STATUS_INGESTED` | `tracking_number`, `provider_status`, `internal_status`, `ingestion_mode` |

## Workflow S2: Provider→Internal Status Mapping

### Overview

| Aspect | Configuration |
|--------|---------------|
| Trigger | Webhook on new `shipment_event` |
| Workflow ID | S2 |
| Idempotency Key | `S2:{tenant_id}:{shipment_event_id}` |

### Input

| Source | Data |
|--------|------|
| `shipment_events` | New event with `provider_status` |
| `provider_status_mapping` | Mapping rules (tenant-specific or default) |
| `orders` | Current order state |

### Processing

1. Retrieve shipment event and associated order
2. Look up status mapping (tenant-specific first, then default)
3. Update order state if mapping found
4. Create order internal event for audit trail
5. Trigger S3 if station routing needed

### Output

| Destination | Data |
|-------------|------|
| `orders.state` | Updated internal state |
| `order_internal_events` | State transition record |

### Default Status Mappings

The system includes pre-configured mappings for common carriers:

| Provider | Provider Status | Internal Status | Triggers Station |
|----------|-----------------|-----------------|------------------|
| * | `pending` | `operations_pending` | Operations |
| * | `picked_up` | `shipped` | - |
| * | `in_transit` | `in_transit` | - |
| * | `out_for_delivery` | `out_for_delivery` | - |
| * | `delivered` | `delivered` | Finance |
| * | `returned` | `return_received` | Returns |
| aramex | `SHP` | `shipped` | - |
| aramex | `OFD` | `out_for_delivery` | - |
| aramex | `DEL` | `delivered` | Finance |
| aramex | `RTS` | `return_in_transit` | Returns |
| smsa | `Shipped` | `shipped` | - |
| smsa | `Delivered` | `delivered` | Finance |
| jnt | `PICKUP_DONE` | `shipped` | - |
| jnt | `DELIVERED` | `delivered` | Finance |

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    S2: Provider→Internal Status Mapping                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  shipment_events ──────┐                                                │
│                        ▼                                                │
│              ┌───────────────┐                                          │
│              │Check Idempot. │──── Skip if exists                       │
│              └───────┬───────┘                                          │
│                      ▼                                                   │
│              ┌───────────────┐                                          │
│              │Get Event+Order│                                          │
│              └───────┬───────┘                                          │
│                      ▼                                                   │
│  provider_status_mapping                                                │
│         │            │                                                   │
│         ▼            ▼                                                   │
│  ┌─────────────┐ ┌─────────────┐                                        │
│  │Tenant Rules │ │Default Rules│                                        │
│  └──────┬──────┘ └──────┬──────┘                                        │
│         └───────┬───────┘                                                │
│                 ▼                                                        │
│         ┌───────────────┐                                               │
│         │ Map Status    │                                               │
│         └───────┬───────┘                                               │
│                 ▼                                                        │
│  ┌──────────────┼──────────────┐                                        │
│  │              │              │                                        │
│  ▼              ▼              ▼                                        │
│ orders    order_internal   Trigger S3                                   │
│ (UPDATE)  _events (INSERT) (if station)                                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Audit Events

| Event Type | Payload |
|------------|---------|
| `ORDER_STATUS_MAPPED` | `from_state`, `to_state`, `station`, `shipment_event_id` |

## Workflow S3: Ops Station Routing

### Overview

| Aspect | Configuration |
|--------|---------------|
| Trigger | Webhook on `orders.state` change |
| Workflow ID | S3 |
| Idempotency Key | `S3:{tenant_id}:{order_id}:{state}` |

### Input

| Source | Data |
|--------|------|
| `orders` | Order ID and new state |
| `order_station_metrics` | Current station metrics |

### Processing

1. Determine target station from state
2. Close previous station metrics (calculate duration, check SLA breach)
3. Create new station metric entry
4. Update order's current station

### Station Routing Rules

| State | Target Station |
|-------|----------------|
| `new`, `call_center_pending` | CallCenter |
| `call_center_confirmed`, `operations_pending`, `operations_processing` | Operations |
| `delivered`, `finance_pending` | Finance |
| `return_requested`, `return_in_transit`, `return_received` | Returns |
| `shipped`, `in_transit`, `out_for_delivery`, `finance_settled`, `cancelled` | None (no active station) |

### Output

| Destination | Data |
|-------------|------|
| `order_station_metrics` | New station entry with SLA target |
| `orders.current_station` | Updated current station |

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       S3: Ops Station Routing                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  orders.state change ──┐                                                │
│                        ▼                                                │
│              ┌───────────────┐                                          │
│              │Check Idempot. │──── Skip if exists                       │
│              └───────┬───────┘                                          │
│                      ▼                                                   │
│              ┌───────────────┐                                          │
│              │Determine Stn. │                                          │
│              └───────┬───────┘                                          │
│                      │                                                   │
│         ┌────────────┼────────────┐                                     │
│         │            │            │                                     │
│         ▼            ▼            ▼                                     │
│    No Station   Close Previous  Create New                              │
│    (skip)       Station Metric  Station Metric                          │
│                      │            │                                     │
│                      ▼            ▼                                     │
│              ┌───────────────────────┐                                  │
│              │ Calculate Duration    │                                  │
│              │ Check SLA Breach      │                                  │
│              └───────────┬───────────┘                                  │
│                          ▼                                              │
│  ┌───────────────────────┼───────────────────────┐                      │
│  │                       │                       │                      │
│  ▼                       ▼                       ▼                      │
│ order_station_metrics  orders.current_station  workflow_audit_logs     │
│ (INSERT/UPDATE)        (UPDATE)                (INSERT)                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Audit Events

| Event Type | Payload |
|------------|---------|
| `ORDER_ROUTED_TO_STATION` | `station`, `state` |

## Workflow S4: Courier Performance Analytics

### Overview

| Aspect | Configuration |
|--------|---------------|
| Trigger | Cron every 12 hours |
| Workflow ID | S4 |
| Idempotency Key | `S4:{tenant_id}:{date}` |

### Input

| Source | Data |
|--------|------|
| `shipments` | Last 30 days of shipment data |

### Processing

1. Group shipments by carrier and region
2. Calculate metrics for each group:
   - Average pickup time (hours from creation to pickup)
   - Average delivery time (hours from creation to delivery)
   - Average return cycle time (hours from creation to return)
   - Average COD remittance time (hours from delivery to settlement)
   - Delivery rate (delivered / total)
   - Return rate (returned / total)
   - On-time rate (delivered within 72 hours)
3. Calculate composite score (0-100)
4. Generate recommendations

### Scoring Formula

```
Score = 50 (base)
      + (delivery_rate × 20)      // Up to 20 points
      - (return_rate × 15)        // Lose up to 15 points
      + (on_time_rate × 15)       // Up to 15 points
      - min(pickup_hours/24, 1) × 10  // Lose up to 10 points for slow pickup
```

### Output

| Destination | Data |
|-------------|------|
| `courier_performance_daily` | Daily aggregates per carrier/region |

### Recommendation Rules

| Condition | Recommendation |
|-----------|----------------|
| Delivery rate > 90% AND Return rate < 10% | "Excellent performance - consider as primary carrier" |
| Return rate > 20% | "High return rate - investigate delivery quality" |
| Average pickup > 24 hours | "Slow pickup times - consider for non-urgent orders only" |
| COD remittance > 168 hours (7 days) | "Slow COD remittance - monitor cash flow impact" |

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   S4: Courier Performance Analytics                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Cron (12h) ───────────┐                                                │
│                        ▼                                                │
│              ┌───────────────┐                                          │
│              │Check Idempot. │──── Skip if exists                       │
│              └───────┬───────┘                                          │
│                      ▼                                                   │
│              ┌───────────────┐                                          │
│              │Query Shipments│ (last 30 days)                           │
│              └───────┬───────┘                                          │
│                      ▼                                                   │
│              ┌───────────────┐                                          │
│              │Group by Carrier│                                         │
│              │   & Region    │                                          │
│              └───────┬───────┘                                          │
│                      ▼                                                   │
│  ┌───────────────────────────────────────────┐                          │
│  │ For each group:                           │                          │
│  │  - Calculate avg pickup/delivery/return   │                          │
│  │  - Calculate delivery/return/on-time rate │                          │
│  │  - Calculate composite score              │                          │
│  │  - Generate recommendations               │                          │
│  └───────────────────┬───────────────────────┘                          │
│                      ▼                                                   │
│  ┌───────────────────┼───────────────────┐                              │
│  │                   │                   │                              │
│  ▼                   ▼                   ▼                              │
│ courier_performance  workflow_audit     recommendations                 │
│ _daily (UPSERT)      _logs (INSERT)     (returned)                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Audit Events

| Event Type | Payload |
|------------|---------|
| `COURIER_PERFORMANCE_COMPUTED` | `couriers_analyzed`, `recommendations_count` |

## Security

### Webhook Authentication

All webhooks use HMAC-SHA256 signatures:

| Header | Description |
|--------|-------------|
| `X-DeepSolution-Signature` | `sha256=<hmac_hex>` |
| `X-DeepSolution-Timestamp` | Unix timestamp (milliseconds) |

### Tenant Isolation

All data is tenant-scoped using Row Level Security (RLS):
- Every table includes `tenant_id` column
- All queries filter by `tenant_id`
- Cross-tenant access is prevented at database level

### Secrets Management

| Secret | Purpose | Scope |
|--------|---------|-------|
| `N8N_WEBHOOK_SECRET` | Webhook signature verification | Global |
| `CARRIER_API_KEY_{CARRIER}` | Carrier API authentication | Per-tenant |
| `SMTP_*` | Email notifications | Global |

## API Endpoints

### tRPC Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `shippingAutomation.ingestStatus` | Mutation | Ingest shipping events (API mode) |
| `shippingAutomation.ingestFromCSV` | Mutation | Ingest from CSV file |
| `shippingAutomation.ingestFromEmail` | Mutation | Ingest from email content |
| `shippingAutomation.mapStatus` | Mutation | Map provider status (internal) |
| `shippingAutomation.routeToStation` | Mutation | Route order to station (internal) |
| `shippingAutomation.computePerformance` | Mutation | Compute courier performance |
| `shippingAutomation.getOrdersByStation` | Query | Get orders in a station queue |
| `shippingAutomation.getStationMetrics` | Query | Get station summary metrics |
| `shippingAutomation.getCourierPerformance` | Query | Get courier performance data |
| `shippingAutomation.getStatusMappings` | Query | Get status mapping rules |
| `shippingAutomation.upsertStatusMapping` | Mutation | Create/update mapping rule |

## Integration with n8n

### Workflow Files

| File | Workflow |
|------|----------|
| `S1-shipping-status-ingestion.json` | Shipping Status Ingestion |
| `S2-status-mapping.json` | Provider→Internal Status Mapping |
| `S3-station-routing.json` | Ops Station Routing |
| `S4-courier-analytics.json` | Courier Performance Analytics |

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `CORE_API_URL` | DeepSolution API base URL |
| `N8N_WEBHOOK_SECRET` | Webhook signature secret |
| `SUPABASE_URL` | Database connection |
| `SUPABASE_SERVICE_KEY` | Database access |

## Verification Checklist

### S1: Shipping Status Ingestion
- [ ] API connector pulls updates for active shipments
- [ ] CSV upload parses and ingests events
- [ ] Email parsing extracts tracking numbers and statuses
- [ ] Idempotency prevents duplicate events
- [ ] Audit log records each ingestion

### S2: Provider→Internal Status Mapping
- [ ] Tenant-specific mappings override defaults
- [ ] Default mappings cover common carriers
- [ ] Order state updates correctly
- [ ] Order internal events created
- [ ] S3 triggered when station routing needed

### S3: Ops Station Routing
- [ ] Orders appear in correct station queue
- [ ] Previous station metrics closed
- [ ] SLA timers calculated correctly
- [ ] SLA breaches detected
- [ ] Audit log records routing

### S4: Courier Performance Analytics
- [ ] Metrics calculated for all carriers
- [ ] Regional breakdown available
- [ ] Scores reflect actual performance
- [ ] Recommendations generated
- [ ] Daily aggregates stored

---

**IMPORTANT**: This document is the authoritative reference for shipping automation. All changes to workflows must be reflected here. For operational procedures, refer to N8N_RUNBOOK.md.
