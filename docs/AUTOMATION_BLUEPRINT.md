# DeepSolution Automation Blueprint

## Overview

This document defines the n8n automation workflows for DeepSolution platform. Each workflow is designed to be:
- **Idempotent**: Safe to retry without duplicating effects
- **Auditable**: Every money/stock change emits an audit log entry
- **Resilient**: Proper error handling with dead-letter queues

---

## Workflow Summary Table

| # | Workflow Name | Trigger | Frequency | Priority |
|---|--------------|---------|-----------|----------|
| 1 | Order Created → Reserve Stock | Webhook (order.created) | Real-time | Critical |
| 2 | Order Fulfilled → Deduct Stock + COGS + P&L | Webhook (order.fulfilled) | Real-time | Critical |
| 3 | Shipping Status Sync | Cron + Webhook | Every 15 min | High |
| 4 | COD Settlement Sync | Cron | Daily 6 AM | High |
| 5 | Low Stock Alert | Cron | Every 6 hours | Medium |

---

## Workflow 1: Order Created → Reserve Stock

### Purpose
When a new order is created, automatically reserve stock for each order item to prevent overselling.

### Specification

| Field | Value |
|-------|-------|
| **Name** | `order-created-reserve-stock` |
| **Trigger Type** | Webhook POST `/api/n8n/order-created` |
| **Input Sources** | `orders` table, `order_items` table, `products` table |
| **Processing Steps** | 1. Validate order exists and status = 'pending'<br>2. For each order_item, check available stock<br>3. Reserve stock (increment reserved_stock)<br>4. Create stock_movement record (type: 'reserve')<br>5. Emit audit log |
| **Output Targets** | `products.reserved_stock`, `stock_movements`, `audit_logs` |
| **Idempotency Key** | `order_id` + `action:reserve` |
| **Retries** | 3 times with exponential backoff (1s, 5s, 30s) |
| **Dead-Letter** | Log to `n8n_dead_letters` table |
| **Secrets Used** | `SUPABASE_SERVICE_KEY`, `N8N_WEBHOOK_SECRET` |
| **Logs Emitted** | `order.stock.reserved`, `order.stock.insufficient` |
| **Audit Events** | `STOCK_RESERVED` with order_id, product_id, quantity |

### Dataflow Diagram

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   orders    │────▶│  n8n Node:   │────▶│    products     │
│  (trigger)  │     │  Validate &  │     │ (reserved_stock)│
└─────────────┘     │  Process     │     └─────────────────┘
                    └──────────────┘              │
                           │                      ▼
                           │              ┌─────────────────┐
                           └─────────────▶│ stock_movements │
                                          └─────────────────┘
```

### How to Verify
1. Create a new order via API/UI
2. Check `products.reserved_stock` increased by order quantity
3. Check `stock_movements` has new record with type='reserve'
4. Check audit log for `STOCK_RESERVED` event

---

## Workflow 2: Order Fulfilled → Deduct Stock + COGS + P&L

### Purpose
When an order is shipped/fulfilled, convert reserved stock to actual deduction, calculate COGS, and recompute profit/loss.

### Specification

| Field | Value |
|-------|-------|
| **Name** | `order-fulfilled-deduct-stock` |
| **Trigger Type** | Webhook POST `/api/n8n/order-fulfilled` |
| **Input Sources** | `orders`, `order_items`, `products`, `supplier_products` |
| **Processing Steps** | 1. Validate order status changed to 'shipped' or 'delivered'<br>2. Release reserved stock<br>3. Deduct actual stock (decrement quantity)<br>4. Calculate COGS from supplier_products.unit_cost<br>5. Write to order_costs<br>6. Trigger P&L recomputation<br>7. Emit audit log |
| **Output Targets** | `products.quantity`, `products.reserved_stock`, `stock_movements`, `order_costs`, `order_pnl` |
| **Idempotency Key** | `order_id` + `action:deduct` + `version` |
| **Retries** | 3 times with exponential backoff |
| **Dead-Letter** | Log to `n8n_dead_letters` table |
| **Secrets Used** | `SUPABASE_SERVICE_KEY`, `N8N_WEBHOOK_SECRET` |
| **Logs Emitted** | `order.stock.deducted`, `order.cogs.calculated`, `order.pnl.computed` |
| **Audit Events** | `STOCK_DEDUCTED`, `COGS_RECORDED`, `PNL_COMPUTED` |

### Dataflow Diagram

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   orders    │────▶│  n8n Node:   │────▶│    products     │
│ (fulfilled) │     │  Deduct &    │     │   (quantity)    │
└─────────────┘     │  Calculate   │     └─────────────────┘
                    └──────────────┘              │
                           │                      ▼
                    ┌──────┴──────┐       ┌─────────────────┐
                    ▼             ▼       │ stock_movements │
             ┌────────────┐ ┌──────────┐  └─────────────────┘
             │order_costs │ │order_pnl │
             └────────────┘ └──────────┘
```

### How to Verify
1. Update order status to 'shipped'
2. Check `products.quantity` decreased
3. Check `products.reserved_stock` decreased
4. Check `order_costs` has COGS value
5. Check `order_pnl` has computed profit

---

## Workflow 3: Shipping Status Sync

### Purpose
Synchronize shipping status from carriers (API/RPA/Sheet) to update shipments and order status.

### Specification

| Field | Value |
|-------|-------|
| **Name** | `shipping-status-sync` |
| **Trigger Type** | Cron (*/15 * * * *) + Webhook for real-time |
| **Input Sources** | Carrier APIs (Aramex, SMSA, DHL), `shipments`, `shipping_carrier_configs` |
| **Processing Steps** | 1. Get active shipments with pending status<br>2. For each carrier, fetch latest status<br>3. Normalize status to standard enum<br>4. Update shipment.tracking_events<br>5. Update shipment.status<br>6. Sync order.status if needed<br>7. Detect delays/failures<br>8. Emit audit log |
| **Output Targets** | `shipments`, `shipping_events`, `orders.status` |
| **Idempotency Key** | `shipment_id` + `event_timestamp` + `status` |
| **Retries** | 3 times for API failures |
| **Dead-Letter** | Log failed syncs to `shipping_sync_logs` |
| **Secrets Used** | `ARAMEX_API_KEY`, `SMSA_API_KEY`, `DHL_API_KEY` |
| **Logs Emitted** | `shipping.status.updated`, `shipping.delay.detected`, `shipping.failed` |
| **Audit Events** | `SHIPPING_STATUS_CHANGED` |

### Dataflow Diagram

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Carrier APIs   │────▶│  n8n Node:   │────▶│   shipments     │
│ (Aramex/SMSA)   │     │  Normalize & │     │ (tracking_events│
└─────────────────┘     │  Update      │     └─────────────────┘
                        └──────────────┘              │
                               │                      ▼
                               │              ┌─────────────────┐
                               └─────────────▶│     orders      │
                                              │    (status)     │
                                              └─────────────────┘
```

### How to Verify
1. Create a shipment with tracking number
2. Wait for cron or trigger webhook
3. Check `shipments.tracking_events` has new entries
4. Check `shipments.status` updated
5. Check `orders.status` synced if applicable

---

## Workflow 4: COD Settlement Sync

### Purpose
Synchronize COD (Cash on Delivery) settlements from carriers to finalize order profit.

### Specification

| Field | Value |
|-------|-------|
| **Name** | `cod-settlement-sync` |
| **Trigger Type** | Cron (0 6 * * *) - Daily at 6 AM |
| **Input Sources** | Carrier settlement reports, `shipments`, `orders` |
| **Processing Steps** | 1. Fetch COD settlement reports from carriers<br>2. Match settlements to shipments by tracking_number<br>3. Update shipment.cod_collected = true<br>4. Update shipment.cod_collected_at<br>5. Finalize order profit (set order_pnl.status = 'finalized')<br>6. Create wallet transaction for COD amount<br>7. Emit audit log |
| **Output Targets** | `shipments`, `order_pnl`, `wallet_transactions`, `cod_settlements` |
| **Idempotency Key** | `settlement_id` + `tracking_number` |
| **Retries** | 3 times |
| **Dead-Letter** | Log to `cod_settlement_errors` |
| **Secrets Used** | `CARRIER_SETTLEMENT_API_KEYS` |
| **Logs Emitted** | `cod.collected`, `cod.settlement.processed`, `profit.finalized` |
| **Audit Events** | `COD_COLLECTED`, `PROFIT_FINALIZED` |

### Dataflow Diagram

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│ Carrier Reports │────▶│  n8n Node:   │────▶│   shipments     │
│ (COD Settled)   │     │  Match &     │     │ (cod_collected) │
└─────────────────┘     │  Finalize    │     └─────────────────┘
                        └──────────────┘              │
                               │                      ▼
                        ┌──────┴──────┐       ┌─────────────────┐
                        ▼             ▼       │   order_pnl     │
                 ┌────────────┐ ┌──────────┐  │  (finalized)    │
                 │  wallet_   │ │   cod_   │  └─────────────────┘
                 │transactions│ │settlements│
                 └────────────┘ └──────────┘
```

### How to Verify
1. Have a delivered COD order
2. Run the workflow (or wait for cron)
3. Check `shipments.cod_collected` = true
4. Check `order_pnl.status` = 'finalized'
5. Check `wallet_transactions` has COD credit

---

## Workflow 5: Low Stock Alert

### Purpose
Monitor stock levels and send email alerts when products fall below threshold.

### Specification

| Field | Value |
|-------|-------|
| **Name** | `low-stock-alert` |
| **Trigger Type** | Cron (0 */6 * * *) - Every 6 hours |
| **Input Sources** | `products`, `tenant_settings` |
| **Processing Steps** | 1. Query products where available_stock < low_stock_threshold<br>2. Group by tenant<br>3. Generate alert email content<br>4. Send email via SMTP<br>5. Create audit log entry<br>6. Update product.last_alert_at to prevent spam |
| **Output Targets** | SMTP email, `audit_logs`, `products.last_alert_at` |
| **Idempotency Key** | `product_id` + `alert_date` (daily) |
| **Retries** | 2 times for email failures |
| **Dead-Letter** | Log failed alerts |
| **Secrets Used** | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` |
| **Logs Emitted** | `stock.low.detected`, `stock.alert.sent` |
| **Audit Events** | `LOW_STOCK_ALERT_SENT` |

### Dataflow Diagram

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│    products     │────▶│  n8n Node:   │────▶│   SMTP Email    │
│ (low stock)     │     │  Check &     │     │   (alert)       │
└─────────────────┘     │  Alert       │     └─────────────────┘
                        └──────────────┘              │
                               │                      ▼
                               │              ┌─────────────────┐
                               └─────────────▶│   audit_logs    │
                                              └─────────────────┘
```

### How to Verify
1. Set a product's quantity below threshold
2. Run the workflow (or wait for cron)
3. Check email inbox for alert
4. Check audit log for `LOW_STOCK_ALERT_SENT`

---

## Idempotency Implementation

All workflows use a common idempotency pattern:

```typescript
// Check if already processed
const existing = await supabase
  .from('workflow_executions')
  .select('id')
  .eq('idempotency_key', key)
  .single();

if (existing) {
  return { skipped: true, reason: 'Already processed' };
}

// Process workflow...

// Record execution
await supabase
  .from('workflow_executions')
  .insert({
    idempotency_key: key,
    workflow_name: name,
    executed_at: new Date().toISOString(),
    result: 'success'
  });
```

---

## Audit Log Schema

```typescript
interface AuditLogEntry {
  id: string;
  tenant_id: string;
  event_type: string;  // e.g., 'STOCK_RESERVED', 'COD_COLLECTED'
  entity_type: string; // e.g., 'order', 'product', 'shipment'
  entity_id: string;
  action: string;
  old_value: object | null;
  new_value: object;
  metadata: object;
  user_id: string | null;
  workflow_name: string | null;
  created_at: string;
}
```

---

## Error Handling & Dead Letters

Failed workflow executions are logged to `n8n_dead_letters`:

```typescript
interface DeadLetter {
  id: string;
  workflow_name: string;
  trigger_data: object;
  error_message: string;
  error_stack: string;
  retry_count: number;
  max_retries: number;
  created_at: string;
  last_retry_at: string | null;
  resolved_at: string | null;
}
```

---

## Webhook Security

All webhooks are secured with HMAC signature verification:

```typescript
const signature = req.headers['x-n8n-signature'];
const expectedSignature = crypto
  .createHmac('sha256', process.env.N8N_WEBHOOK_SECRET)
  .update(JSON.stringify(req.body))
  .digest('hex');

if (signature !== expectedSignature) {
  throw new Error('Invalid webhook signature');
}
```

---

## Environment Variables Required

| Variable | Description | Used By |
|----------|-------------|---------|
| `SUPABASE_SERVICE_KEY` | Supabase admin key | All workflows |
| `N8N_WEBHOOK_SECRET` | Webhook signature secret | All webhooks |
| `SMTP_HOST` | Email server host | Low Stock Alert |
| `SMTP_USER` | Email username | Low Stock Alert |
| `SMTP_PASS` | Email password | Low Stock Alert |
| `ARAMEX_API_KEY` | Aramex tracking API | Shipping Sync |
| `SMSA_API_KEY` | SMSA tracking API | Shipping Sync |
| `DHL_API_KEY` | DHL tracking API | Shipping Sync |

---

## Monitoring & Observability

Each workflow emits structured logs that can be queried:

```sql
-- Check workflow execution history
SELECT * FROM workflow_executions 
WHERE workflow_name = 'order-created-reserve-stock'
ORDER BY executed_at DESC LIMIT 100;

-- Check dead letters
SELECT * FROM n8n_dead_letters 
WHERE resolved_at IS NULL
ORDER BY created_at DESC;

-- Check audit trail for an order
SELECT * FROM audit_logs 
WHERE entity_type = 'order' AND entity_id = 'order-123'
ORDER BY created_at;
```
