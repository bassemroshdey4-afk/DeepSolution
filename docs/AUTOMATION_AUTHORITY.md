# DeepSolution Automation Authority

## Executive Summary

This document serves as the **single source of truth** for all automation workflows in the DeepSolution platform. Every workflow is documented with complete data lineage, trigger conditions, transformation logic, and failure handling. The automation layer is built on **n8n**, an open-source workflow automation platform that can be self-hosted and operated without any external dependencies.

---

## Automation Architecture

### System Overview

The automation system follows a hub-and-spoke model where n8n acts as the orchestration layer, connecting the core application with external services.

```
┌─────────────────────────────────────────────────────────────────┐
│                        DeepSolution Core                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │ Orders  │  │Products │  │Shipments│  │ Wallet  │            │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘            │
│       │            │            │            │                   │
│       └────────────┴────────────┴────────────┘                   │
│                          │                                       │
│                    ┌─────┴─────┐                                 │
│                    │  tRPC API │                                 │
│                    └─────┬─────┘                                 │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                    ┌──────┴──────┐
                    │    n8n      │
                    │ Orchestrator│
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    ┌────┴────┐      ┌─────┴─────┐     ┌────┴────┐
    │ Carriers│      │   SMTP    │     │ Webhooks│
    │  APIs   │      │  Server   │     │ External│
    └─────────┘      └───────────┘     └─────────┘
```

### Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Orchestrator | n8n (self-hosted) | Workflow execution and scheduling |
| Trigger Layer | Webhooks + Cron | Event-driven and scheduled execution |
| Data Store | Supabase (PostgreSQL) | Persistent storage and audit trail |
| Queue | n8n built-in | Retry and dead-letter handling |
| Monitoring | n8n execution logs | Observability and debugging |

---

## Complete Workflow Registry

### Workflow Index

| ID | Workflow Name | Trigger | Frequency | Status |
|----|---------------|---------|-----------|--------|
| WF-001 | Order Created → Reserve Stock | Webhook | Real-time | Active |
| WF-002 | Order Fulfilled → Deduct Stock + P&L | Webhook | Real-time | Active |
| WF-003 | Shipping Status Sync | Cron + Webhook | 15 min | Active |
| WF-004 | COD Settlement Sync | Cron | Daily 6 AM | Active |
| WF-005 | Low Stock Alert | Cron | Every 6 hours | Active |

---

## WF-001: Order Created → Reserve Stock

### Purpose

When a new order is created, this workflow automatically reserves inventory for each line item to prevent overselling during the fulfillment window.

### Data Flow

| Stage | Source | Transformation | Destination |
|-------|--------|----------------|-------------|
| Input | `orders` table | Extract order_id, tenant_id | Workflow context |
| Lookup | `order_items` table | Get product_id, quantity | Memory |
| Lookup | `products` table | Get current stock, reserved | Memory |
| Calculate | Memory | available = quantity - reserved | Memory |
| Validate | Memory | Check available >= requested | Decision |
| Update | Memory | new_reserved = reserved + requested | `products.reserved_stock` |
| Record | Memory | Create movement record | `stock_movements` |
| Audit | Memory | Log reservation event | `audit_logs` |

### Trigger Configuration

```json
{
  "type": "webhook",
  "method": "POST",
  "path": "/api/n8n/order-created",
  "authentication": "header",
  "headerName": "X-N8N-Signature",
  "headerValue": "{{HMAC-SHA256(body, N8N_WEBHOOK_SECRET)}}"
}
```

### Idempotency

| Key Format | Example | Storage |
|------------|---------|---------|
| `{order_id}:reserve` | `ord_abc123:reserve` | `workflow_executions` table |

### Failure Handling

| Failure Type | Action | Retry |
|--------------|--------|-------|
| Product not found | Log error, skip item | No |
| Insufficient stock | Log warning, continue | No |
| Database error | Retry with backoff | 3x |
| Timeout | Retry with backoff | 3x |

### Audit Events

| Event Type | Entity | Payload |
|------------|--------|---------|
| `STOCK_RESERVED` | order | `{order_id, reservations: [{product_id, quantity}]}` |
| `STOCK_INSUFFICIENT` | order | `{order_id, product_id, requested, available}` |

---

## WF-002: Order Fulfilled → Deduct Stock + P&L

### Purpose

When an order is marked as shipped or delivered, this workflow converts reserved stock to actual deductions, calculates Cost of Goods Sold (COGS), and computes the profit/loss for the order.

### Data Flow

| Stage | Source | Transformation | Destination |
|-------|--------|----------------|-------------|
| Input | `orders` table | Extract order_id, status | Workflow context |
| Validate | Memory | Check status in [shipped, delivered] | Decision |
| Lookup | `order_items` table | Get items with quantities | Memory |
| Lookup | `products` table | Get cost_price per item | Memory |
| Calculate | Memory | COGS = Σ(quantity × cost_price) | Memory |
| Update | Memory | quantity -= ordered, reserved -= ordered | `products` |
| Record | Memory | Create sale movement | `stock_movements` |
| Write | Memory | Store COGS | `order_costs` |
| Calculate | Memory | profit = revenue - COGS - shipping | Memory |
| Write | Memory | Store P&L | `order_pnl` |
| Audit | Memory | Log all events | `audit_logs` |

### Trigger Configuration

```json
{
  "type": "webhook",
  "method": "POST",
  "path": "/api/n8n/order-fulfilled",
  "authentication": "header",
  "headerName": "X-N8N-Signature"
}
```

### Idempotency

| Key Format | Example | Storage |
|------------|---------|---------|
| `{order_id}:deduct` | `ord_abc123:deduct` | `workflow_executions` table |

### Failure Handling

| Failure Type | Action | Retry |
|--------------|--------|-------|
| Order not found | Log error, abort | No |
| Invalid status | Skip silently | No |
| Calculation error | Log, use fallback | No |
| Database error | Retry with backoff | 3x |

### Audit Events

| Event Type | Entity | Payload |
|------------|--------|---------|
| `STOCK_DEDUCTED` | order | `{order_id, deductions: [{product_id, quantity}]}` |
| `COGS_RECORDED` | order | `{order_id, total_cogs}` |
| `PNL_COMPUTED` | order | `{order_id, revenue, cogs, shipping, net_profit}` |

---

## WF-003: Shipping Status Sync

### Purpose

This workflow synchronizes shipping status from carrier systems (via API, webhook, or manual import) to keep shipment records and order statuses up to date.

### Data Flow

| Stage | Source | Transformation | Destination |
|-------|--------|----------------|-------------|
| Input | Carrier API / Webhook | Extract tracking events | Workflow context |
| Lookup | `shipments` table | Find by tracking_number | Memory |
| Normalize | Memory | Map carrier status → standard enum | Memory |
| Append | Memory | Add to tracking_events array | `shipments.tracking_events` |
| Update | Memory | Set new status | `shipments.status` |
| Sync | Memory | Map to order status | `orders.status` |
| Audit | Memory | Log status change | `audit_logs` |

### Status Normalization Map

| Carrier Status | Normalized Status |
|----------------|-------------------|
| "Delivered", "Package Delivered" | `DELIVERED` |
| "In Transit", "On the way" | `IN_TRANSIT` |
| "Out for Delivery" | `OUT_FOR_DELIVERY` |
| "Picked Up", "Collected" | `PICKED_UP` |
| "Failed", "Delivery Failed" | `FAILED` |
| "Returned", "Return to Sender" | `RETURNED` |
| "Created", "Shipment Created" | `CREATED` |

### Order Status Mapping

| Shipping Status | Order Status |
|-----------------|--------------|
| `PICKED_UP` | `in_transit` |
| `IN_TRANSIT` | `in_transit` |
| `OUT_FOR_DELIVERY` | `out_for_delivery` |
| `DELIVERED` | `delivered` |
| `FAILED` | `failed` |
| `RETURNED` | `returned` |

### Trigger Configuration

```json
{
  "triggers": [
    {
      "type": "cron",
      "expression": "0 */15 * * * *",
      "description": "Every 15 minutes"
    },
    {
      "type": "webhook",
      "path": "/api/n8n/shipping-update",
      "description": "Real-time carrier webhooks"
    }
  ]
}
```

### Idempotency

| Key Format | Example | Storage |
|------------|---------|---------|
| `{shipment_id}:{status}:{timestamp}` | `shp_123:DELIVERED:2024-01-15T10:00:00Z` | `workflow_executions` |

### Failure Handling

| Failure Type | Action | Retry |
|--------------|--------|-------|
| Carrier API down | Log, retry later | 3x |
| Shipment not found | Log warning | No |
| Invalid status | Use IN_TRANSIT default | No |

### Audit Events

| Event Type | Entity | Payload |
|------------|--------|---------|
| `SHIPPING_STATUS_CHANGED` | shipment | `{shipment_id, old_status, new_status, carrier}` |

---

## WF-004: COD Settlement Sync

### Purpose

This workflow processes Cash on Delivery (COD) settlement reports from carriers to mark payments as collected and finalize order profitability.

### Data Flow

| Stage | Source | Transformation | Destination |
|-------|--------|----------------|-------------|
| Input | Carrier settlement report | Parse tracking numbers, amounts | Workflow context |
| Lookup | `shipments` table | Match by tracking_number | Memory |
| Validate | Memory | Check not already collected | Decision |
| Update | Memory | Set cod_collected = true | `shipments` |
| Record | Memory | Create settlement record | `cod_settlements` |
| Finalize | Memory | Set P&L status = finalized | `order_pnl` |
| Credit | Memory | Add COD to wallet | `wallet_transactions` |
| Audit | Memory | Log collection | `audit_logs` |

### Trigger Configuration

```json
{
  "type": "cron",
  "expression": "0 0 6 * * *",
  "timezone": "Asia/Riyadh",
  "description": "Daily at 6 AM local time"
}
```

### Idempotency

| Key Format | Example | Storage |
|------------|---------|---------|
| `{settlement_id}:{tracking_number}` | `stl_789:AWB123456` | `workflow_executions` |

### Failure Handling

| Failure Type | Action | Retry |
|--------------|--------|-------|
| Settlement already processed | Skip silently | No |
| Shipment not found | Log error | No |
| Amount mismatch | Log warning, proceed | No |
| Database error | Retry with backoff | 3x |

### Audit Events

| Event Type | Entity | Payload |
|------------|--------|---------|
| `COD_COLLECTED` | shipment | `{shipment_id, amount, settlement_id}` |
| `PROFIT_FINALIZED` | order | `{order_id, final_profit}` |

---

## WF-005: Low Stock Alert

### Purpose

This workflow monitors inventory levels and sends email alerts when products fall below their defined thresholds, preventing stockouts.

### Data Flow

| Stage | Source | Transformation | Destination |
|-------|--------|----------------|-------------|
| Query | `products` table | Filter where available < threshold | Memory |
| Group | Memory | Group by tenant | Memory |
| Template | Memory | Generate email content | Memory |
| Send | Memory | Dispatch via SMTP | Email server |
| Record | Memory | Create alert record | `stock_alerts` |
| Audit | Memory | Log alert sent | `audit_logs` |

### Trigger Configuration

```json
{
  "type": "cron",
  "expression": "0 0 */6 * * *",
  "description": "Every 6 hours"
}
```

### Idempotency

| Key Format | Example | Storage |
|------------|---------|---------|
| `{tenant_id}:low-stock:{date}` | `tnt_123:low-stock:2024-01-15` | `workflow_executions` |

The daily key prevents alert spam while ensuring at least one notification per day.

### Failure Handling

| Failure Type | Action | Retry |
|--------------|--------|-------|
| SMTP failure | Retry, then log | 2x |
| No low stock | Skip silently | No |
| Email bounce | Log warning | No |

### Audit Events

| Event Type | Entity | Payload |
|------------|--------|---------|
| `LOW_STOCK_ALERT_SENT` | inventory | `{tenant_id, product_count, recipient_email}` |

---

## Database Tables for Automation

### Core Tables Used

| Table | Read | Write | Purpose |
|-------|------|-------|---------|
| `orders` | ✓ | ✓ | Order data and status |
| `order_items` | ✓ | - | Line items |
| `products` | ✓ | ✓ | Stock levels |
| `shipments` | ✓ | ✓ | Tracking data |
| `wallet_transactions` | - | ✓ | Financial records |

### Automation-Specific Tables

| Table | Purpose | Retention |
|-------|---------|-----------|
| `workflow_executions` | Idempotency tracking | 90 days |
| `n8n_dead_letters` | Failed executions | Until resolved |
| `stock_movements` | Inventory audit trail | Permanent |
| `stock_alerts` | Alert history | 30 days |
| `cod_settlements` | COD reconciliation | Permanent |
| `audit_logs` | Complete audit trail | Permanent |

### Schema: workflow_executions

```sql
CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  workflow_name VARCHAR(100) NOT NULL,
  result VARCHAR(20) NOT NULL, -- 'success', 'failed', 'skipped'
  metadata JSONB,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_executions_key ON workflow_executions(idempotency_key);
CREATE INDEX idx_workflow_executions_name ON workflow_executions(workflow_name);
```

### Schema: n8n_dead_letters

```sql
CREATE TABLE n8n_dead_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_name VARCHAR(100) NOT NULL,
  trigger_data JSONB NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_retry_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_dead_letters_unresolved ON n8n_dead_letters(resolved_at) WHERE resolved_at IS NULL;
```

---

## Security Configuration

### Webhook Authentication

All webhooks use HMAC-SHA256 signature verification:

```javascript
const crypto = require('crypto');

function verifyWebhook(body, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(body))
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

### Required Secrets

| Secret | Purpose | Rotation |
|--------|---------|----------|
| `N8N_WEBHOOK_SECRET` | Webhook signature | Quarterly |
| `SUPABASE_SERVICE_KEY` | Database access | As needed |
| `SMTP_PASS` | Email sending | As needed |
| `ARAMEX_API_KEY` | Carrier integration | Per carrier policy |
| `SMSA_API_KEY` | Carrier integration | Per carrier policy |

### Access Control

| Role | Permissions |
|------|-------------|
| n8n Service Account | Read/write to automation tables only |
| Application | Full access via tRPC |
| Admin | Direct database access |

---

## Monitoring and Observability

### Health Checks

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `/api/health` | Application health | `{ status: "ok" }` |
| `/api/n8n/health` | n8n connectivity | `{ connected: true }` |

### Key Metrics

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Workflow execution time | n8n logs | > 30 seconds |
| Dead letter count | `n8n_dead_letters` | > 10 unresolved |
| Failed executions | `workflow_executions` | > 5% failure rate |
| Stock alerts pending | `stock_alerts` | > 24 hours old |

### Log Format

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "workflow": "order-created-reserve-stock",
  "execution_id": "exec_abc123",
  "tenant_id": "tnt_xyz",
  "status": "success",
  "duration_ms": 245,
  "input": { "order_id": "ord_123" },
  "output": { "reservations": 3 }
}
```

---

## Disaster Recovery

### Backup Strategy

| Component | Method | Frequency | Retention |
|-----------|--------|-----------|-----------|
| Database | pg_dump | Daily | 30 days |
| n8n workflows | JSON export | Weekly | 90 days |
| Secrets | Encrypted backup | Monthly | 1 year |

### Recovery Procedures

**Database Recovery:**
```bash
pg_restore -d $DATABASE_URL backup.sql
```

**n8n Workflow Recovery:**
```bash
# Import workflow JSON via n8n CLI or UI
n8n import:workflow --input=workflow.json
```

### Failover

If n8n becomes unavailable:
1. All webhooks return 503 (retry later)
2. Cron jobs queue in n8n
3. Manual execution via tRPC endpoints remains available
4. No data loss due to idempotency

---

## Conclusion

This document establishes complete authority over the automation layer. Every workflow is:

1. **Documented** with full data lineage
2. **Idempotent** to prevent duplicate processing
3. **Auditable** with complete event logs
4. **Recoverable** with proper failure handling
5. **Secure** with authentication and access control

The automation system operates independently of any AI services and can be maintained, modified, or replaced by any qualified engineer with access to this documentation.

**You have full authority over this automation layer.**
