# n8n Workflows - DeepSolution

## Overview

This document defines all n8n automation workflows with step-by-step execution, idempotency patterns, retry logic, and dead-letter handling.

---

## Workflow Standards

### Idempotency

Every workflow that creates or modifies data MUST be idempotent. Running the same workflow multiple times with the same input produces the same result.

**Pattern:**

```
1. Extract unique identifier from input (message_id, order_id, etc.)
2. Check if already processed:
   SELECT id FROM processed_events WHERE event_id = $1
3. If exists: skip processing, return success
4. If not: process and record:
   INSERT INTO processed_events (event_id, workflow, processed_at, result)
   VALUES ($1, $2, NOW(), $3)
```

### Retry Logic

| Retry Level | Max Attempts | Backoff | When |
|-------------|--------------|---------|------|
| Node level | 3 | Exponential (1s, 2s, 4s) | HTTP errors, timeouts |
| Workflow level | 2 | Fixed 30s | Workflow-level failures |
| Manual | Unlimited | N/A | Dead-letter queue |

### Dead-Letter Queue

Failed workflows after all retries go to dead-letter table for manual review.

```sql
CREATE TABLE workflow_dead_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_name VARCHAR(100) NOT NULL,
  trigger_data JSONB NOT NULL,
  error_message TEXT,
  error_stack TEXT,
  attempts INT DEFAULT 0,
  first_failed_at TIMESTAMPTZ DEFAULT NOW(),
  last_failed_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT
);
```

### Logging

Every workflow logs to a central table:

```sql
CREATE TABLE workflow_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_name VARCHAR(100) NOT NULL,
  execution_id VARCHAR(100),
  tenant_id UUID,
  status VARCHAR(20) NOT NULL, -- 'started', 'completed', 'failed', 'skipped'
  input_summary JSONB,
  output_summary JSONB,
  duration_ms INT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Alerting

| Condition | Alert Channel | Priority |
|-----------|---------------|----------|
| Workflow failed 3+ times | Email to admin | High |
| Dead-letter queue > 10 items | Email to admin | High |
| Workflow latency > 60s | Slack/Discord | Medium |
| Daily summary | Email to admin | Low |

---

## Workflow 1: WhatsApp Order Ingestion

**Purpose:** Receive orders from WhatsApp and create them in the system.

**Trigger:** Webhook from WhatsApp Business API

### Flow Diagram

```
[Webhook: WhatsApp Message]
         │
         ▼
[Check Idempotency] ──(already processed)──> [Return 200 OK]
         │
         │ (new message)
         ▼
[Parse Message Content]
         │
         ▼
[Identify Tenant by Phone]
         │
         ├──(tenant not found)──> [Log & Skip]
         │
         ▼
[Extract Order Data]
         │
         ├──(parse failed)──> [Send Error Reply] ──> [Log]
         │
         ▼
[Validate Required Fields]
         │
         ├──(invalid)──> [Send Validation Error] ──> [Log]
         │
         ▼
[Create Order in Supabase]
         │
         ├──(failed)──> [Retry 3x] ──(still failed)──> [Dead-Letter]
         │
         ▼
[Update Product Stock]
         │
         ▼
[Send Confirmation to Customer]
         │
         ▼
[Record Idempotency Key]
         │
         ▼
[Log Success]
```

### Step-by-Step

| Step | Node Type | Configuration | Error Handling |
|------|-----------|---------------|----------------|
| 1 | Webhook | POST /webhook/whatsapp, Headers: X-Hub-Signature | Validate signature |
| 2 | Function | Check `processed_events` for `message_id` | Skip if exists |
| 3 | Function | Parse message body, extract text/media | Log parse errors |
| 4 | Supabase | Query `tenants` by `settings->whatsapp_number` | Skip if not found |
| 5 | Function | Regex/NLP to extract: name, phone, address, products | Return structured data |
| 6 | Function | Validate: name required, phone required, at least 1 product | Return validation errors |
| 7 | Supabase | INSERT into `orders` with generated order_number | Retry 3x |
| 8 | Supabase | INSERT into `order_items` | Retry 3x |
| 9 | Supabase | UPDATE `products` SET stock_quantity = stock_quantity - ordered_qty | Retry 3x |
| 10 | HTTP | POST to WhatsApp API: confirmation message | Retry 2x |
| 11 | Supabase | INSERT into `processed_events` | - |
| 12 | Supabase | INSERT into `workflow_logs` | - |

### Idempotency Key

```
Key: whatsapp_msg_{message_id}
TTL: 7 days
```

### Expected Message Format

```
اسم العميل: أحمد محمد
الجوال: 0501234567
العنوان: الرياض، حي النخيل، شارع الملك فهد
المنتج: قميص أزرق - 2
المنتج: بنطلون أسود - 1
```

### Confirmation Message Template

```
✅ تم استلام طلبك بنجاح!

رقم الطلب: {{order_number}}
المنتجات: {{products_summary}}
المجموع: {{total}} {{currency}}

سيتم التواصل معك قريباً لتأكيد الطلب.
```

---

## Workflow 2: Order Status Notifications

**Purpose:** Send notifications to customers when order status changes.

**Trigger:** Supabase Database Webhook on `orders` UPDATE

### Flow Diagram

```
[DB Webhook: Order Updated]
         │
         ▼
[Check Status Changed]
         │
         ├──(no change)──> [Skip]
         │
         ▼
[Check Idempotency]
         │
         ├──(already sent)──> [Skip]
         │
         ▼
[Get Tenant Settings]
         │
         ▼
[Check Notification Enabled]
         │
         ├──(disabled)──> [Log & Skip]
         │
         ▼
[Get Message Template]
         │
         ▼
[Format Message with Order Data]
         │
         ▼
[Send via WhatsApp/SMS]
         │
         ├──(failed)──> [Retry 3x] ──> [Dead-Letter]
         │
         ▼
[Record Idempotency Key]
         │
         ▼
[Log Success]
```

### Step-by-Step

| Step | Node Type | Configuration | Error Handling |
|------|-----------|---------------|----------------|
| 1 | Webhook | Supabase webhook, table: orders, event: UPDATE | Validate payload |
| 2 | IF | `old.status != new.status` | Skip if same |
| 3 | Function | Check `processed_events` for `order_{id}_status_{new_status}` | Skip if exists |
| 4 | Supabase | Query `tenants` by `id` | Fail workflow |
| 5 | IF | `tenant.settings.notifications.whatsapp_enabled == true` | Skip if disabled |
| 6 | Function | Get template for `new.status` from templates map | Use default template |
| 7 | Function | Replace placeholders: {{order_number}}, {{status}}, etc. | - |
| 8 | HTTP | POST to WhatsApp API with formatted message | Retry 3x |
| 9 | Supabase | INSERT into `processed_events` | - |
| 10 | Supabase | INSERT into `workflow_logs` | - |

### Status Message Templates (Arabic)

| Status | Template |
|--------|----------|
| confirmed | "✅ تم تأكيد طلبك رقم {{order_number}}. جاري تجهيز الطلب." |
| processing | "📦 طلبك رقم {{order_number}} قيد التجهيز." |
| ready_to_ship | "🎁 طلبك رقم {{order_number}} جاهز للشحن." |
| shipped | "🚚 تم شحن طلبك رقم {{order_number}}. رقم التتبع: {{tracking_number}}" |
| delivered | "🎉 تم توصيل طلبك رقم {{order_number}}. شكراً لتسوقك معنا!" |
| cancelled | "❌ تم إلغاء طلبك رقم {{order_number}}. للاستفسار: {{support_phone}}" |

### Idempotency Key

```
Key: order_{order_id}_status_{status}_{timestamp_minute}
TTL: 24 hours
```

---

## Workflow 3: Low Stock Alerts

**Purpose:** Alert store owner when product stock is low.

**Trigger:** Cron schedule (every 6 hours)

### Flow Diagram

```
[Cron: Every 6 hours]
         │
         ▼
[Get All Active Tenants]
         │
         ▼
[For Each Tenant]
         │
         ▼
    [Query Low Stock Products]
         │
         ├──(none found)──> [Skip Tenant]
         │
         ▼
    [Check Last Alert Time]
         │
         ├──(alerted within 24h)──> [Skip]
         │
         ▼
    [Format Alert Message]
         │
         ▼
    [Send Alert (Email/WhatsApp)]
         │
         ├──(failed)──> [Retry 2x] ──> [Log Error]
         │
         ▼
    [Update Last Alert Time]
         │
         ▼
    [Log Success]
```

### Step-by-Step

| Step | Node Type | Configuration | Error Handling |
|------|-----------|---------------|----------------|
| 1 | Cron | Every 6 hours: 0 */6 * * * | - |
| 2 | Supabase | SELECT * FROM tenants WHERE status = 'active' | Log if empty |
| 3 | SplitInBatches | Process 10 tenants at a time | - |
| 4 | Supabase | SELECT * FROM products WHERE tenant_id = $1 AND stock_quantity <= low_stock_threshold AND stock_quantity > 0 AND status = 'active' | Continue if empty |
| 5 | IF | products.length > 0 | Skip if empty |
| 6 | Function | Check tenant.settings.last_low_stock_alert | Skip if < 24h ago |
| 7 | Function | Format: "⚠️ منتجات منخفضة المخزون:\n{{products_list}}" | - |
| 8 | HTTP | Send via configured channel (email/WhatsApp) | Retry 2x |
| 9 | Supabase | UPDATE tenants SET settings = jsonb_set(settings, '{last_low_stock_alert}', '"{{now}}"') | - |
| 10 | Supabase | INSERT into workflow_logs | - |

### Alert Message Template

```
⚠️ تنبيه: منتجات منخفضة المخزون

{{#each products}}
• {{name}}: {{stock_quantity}} متبقي (الحد الأدنى: {{low_stock_threshold}})
{{/each}}

يرجى إعادة تعبئة المخزون قريباً.
```

### Idempotency

This workflow is naturally idempotent because it checks `last_low_stock_alert` before sending.

---

## Workflow 4: Daily Reports

**Purpose:** Send daily summary report to store owner.

**Trigger:** Cron schedule (daily at 08:00 tenant timezone)

### Flow Diagram

```
[Cron: Daily 08:00 UTC]
         │
         ▼
[Get All Active Tenants]
         │
         ▼
[For Each Tenant]
         │
         ▼
    [Check Tenant Timezone]
         │
         ├──(not 08:00 local)──> [Skip]
         │
         ▼
    [Query Yesterday's Metrics]
         │
         ▼
    [Calculate Statistics]
         │
         ▼
    [Format Report]
         │
         ▼
    [Send Report (Email)]
         │
         ├──(failed)──> [Retry 2x] ──> [Dead-Letter]
         │
         ▼
    [Log Success]
```

### Step-by-Step

| Step | Node Type | Configuration | Error Handling |
|------|-----------|---------------|----------------|
| 1 | Cron | Every hour: 0 * * * * | - |
| 2 | Supabase | SELECT * FROM tenants WHERE status = 'active' | - |
| 3 | SplitInBatches | Process 10 tenants at a time | - |
| 4 | Function | Check if current UTC hour = 08:00 in tenant.timezone | Skip if not |
| 5 | Supabase | Query orders, revenue, new customers for yesterday | - |
| 6 | Function | Calculate: total_orders, total_revenue, avg_order_value, top_products, conversion_rate | - |
| 7 | Function | Format HTML email with metrics | - |
| 8 | Email | Send to tenant owner email | Retry 2x |
| 9 | Supabase | INSERT into workflow_logs | - |

### Report Template

```
📊 تقرير يومي - {{date}}

الطلبات:
• إجمالي الطلبات: {{total_orders}}
• الطلبات المؤكدة: {{confirmed_orders}}
• الطلبات الملغاة: {{cancelled_orders}}

الإيرادات:
• إجمالي الإيرادات: {{total_revenue}} {{currency}}
• متوسط قيمة الطلب: {{avg_order_value}} {{currency}}

المنتجات الأكثر مبيعاً:
{{#each top_products}}
{{@index}}. {{name}} ({{quantity}} وحدة)
{{/each}}

مركز الاتصال:
• مكالمات ناجحة: {{successful_calls}}
• بانتظار الاتصال: {{pending_calls}}
• لا يوجد رد: {{no_answer}}

الحملات:
• أفضل ROAS: {{best_campaign}} ({{best_roas}}x)
```

### Idempotency Key

```
Key: daily_report_{tenant_id}_{date}
TTL: 48 hours
```

---

## Workflow 5: Campaign Budget Sync (Phase 2)

**Purpose:** Sync campaign spend from Facebook/Google Ads.

**Trigger:** Cron schedule (every 4 hours)

### Flow Diagram

```
[Cron: Every 4 hours]
         │
         ▼
[Get Tenants with Connected Ads]
         │
         ▼
[For Each Tenant]
         │
         ▼
    [For Each Platform (FB/Google)]
         │
         ▼
        [Fetch Campaign Metrics]
             │
             ├──(API error)──> [Retry 3x] ──> [Log Error]
             │
             ▼
        [Match with Local Campaigns]
             │
             ▼
        [Update budget_spent]
             │
             ▼
        [Recalculate ROAS]
             │
             ▼
        [Log Success]
```

### Step-by-Step

| Step | Node Type | Configuration | Error Handling |
|------|-----------|---------------|----------------|
| 1 | Cron | Every 4 hours: 0 */4 * * * | - |
| 2 | Supabase | SELECT * FROM tenants WHERE settings->'integrations'->'facebook' IS NOT NULL OR settings->'integrations'->'google' IS NOT NULL | - |
| 3 | SplitInBatches | Process 5 tenants at a time | - |
| 4 | IF | Check which platforms are connected | - |
| 5 | HTTP | GET Facebook Marketing API /campaigns | Retry 3x |
| 6 | HTTP | GET Google Ads API /campaigns | Retry 3x |
| 7 | Function | Match by external_campaign_id or utm_campaign | Log unmatched |
| 8 | Supabase | UPDATE campaigns SET budget_spent = $1 WHERE id = $2 | - |
| 9 | Supabase | Trigger ROAS recalculation (via trigger) | - |
| 10 | Supabase | INSERT into workflow_logs | - |

---

## Workflow 6: Shipping Tracking Updates (Phase 2)

**Purpose:** Poll shipping providers for tracking updates.

**Trigger:** Cron schedule (every 2 hours)

### Flow Diagram

```
[Cron: Every 2 hours]
         │
         ▼
[Get Pending Shipments]
         │
         ▼
[Group by Provider]
         │
         ▼
[For Each Provider]
         │
         ▼
    [Batch API Call]
         │
         ├──(API error)──> [Retry 3x] ──> [Log Error]
         │
         ▼
    [For Each Shipment]
         │
         ▼
        [Compare Status]
             │
             ├──(no change)──> [Skip]
             │
             ▼
        [Update Shipment]
             │
             ▼
        [Update Order Status]
             │
             ▼
        [Trigger Notification Workflow]
             │
             ▼
        [Log Success]
```

### Step-by-Step

| Step | Node Type | Configuration | Error Handling |
|------|-----------|---------------|----------------|
| 1 | Cron | Every 2 hours: 0 */2 * * * | - |
| 2 | Supabase | SELECT * FROM shipments WHERE status NOT IN ('delivered', 'returned', 'failed') AND tracking_number IS NOT NULL | - |
| 3 | Function | Group shipments by provider_code | - |
| 4 | SplitInBatches | Process by provider | - |
| 5 | HTTP | Call provider tracking API (batch if supported) | Retry 3x |
| 6 | Function | Parse response, map to standard status | Log parse errors |
| 7 | IF | new_status != current_status | Skip if same |
| 8 | Supabase | UPDATE shipments SET status = $1, tracking_events = $2 | - |
| 9 | Supabase | UPDATE orders SET status = $1 WHERE id = $2 (if applicable) | - |
| 10 | Webhook | Trigger Workflow 2 (notifications) | - |
| 11 | Supabase | INSERT into workflow_logs | - |

### Provider Status Mapping

| Provider Status | Standard Status |
|-----------------|-----------------|
| SMSA: "Picked Up" | picked_up |
| SMSA: "In Transit" | in_transit |
| SMSA: "Out for Delivery" | out_for_delivery |
| SMSA: "Delivered" | delivered |
| SMSA: "Failed Delivery" | failed |
| Aramex: "Collected" | picked_up |
| Aramex: "In Transit" | in_transit |
| Aramex: "On Route" | out_for_delivery |
| Aramex: "Delivered" | delivered |

---

## Dead-Letter Processing

### Manual Review Workflow

**Trigger:** Manual or scheduled (daily)

```
[Get Dead-Letter Items]
         │
         ▼
[For Each Item]
         │
         ▼
    [Display in Admin UI]
         │
         ▼
    [Admin Action]
         │
         ├──[Retry]──> [Re-execute Workflow]
         │
         ├──[Skip]──> [Mark Resolved]
         │
         └──[Investigate]──> [Add Notes]
```

### Dead-Letter Dashboard Queries

```sql
-- Pending items by workflow
SELECT workflow_name, COUNT(*) as count
FROM workflow_dead_letters
WHERE resolved_at IS NULL
GROUP BY workflow_name;

-- Recent failures
SELECT *
FROM workflow_dead_letters
WHERE resolved_at IS NULL
ORDER BY last_failed_at DESC
LIMIT 20;

-- Resolve item
UPDATE workflow_dead_letters
SET resolved_at = NOW(),
    resolved_by = $1,
    resolution_notes = $2
WHERE id = $3;
```

---

## Monitoring Dashboard

### Key Metrics

| Metric | Query | Alert Threshold |
|--------|-------|-----------------|
| Workflows/hour | COUNT from workflow_logs WHERE created_at > NOW() - INTERVAL '1 hour' | - |
| Success rate | COUNT(status='completed') / COUNT(*) * 100 | < 95% |
| Avg duration | AVG(duration_ms) | > 30000ms |
| Dead-letter count | COUNT from workflow_dead_letters WHERE resolved_at IS NULL | > 10 |
| Failed last hour | COUNT from workflow_logs WHERE status='failed' AND created_at > NOW() - INTERVAL '1 hour' | > 5 |

### Alert Configuration

```yaml
alerts:
  - name: workflow_failure_rate
    condition: success_rate < 95
    for: 15m
    severity: high
    channels: [email, slack]
    
  - name: dead_letter_queue
    condition: dead_letter_count > 10
    for: 5m
    severity: high
    channels: [email]
    
  - name: workflow_slow
    condition: avg_duration > 60000
    for: 30m
    severity: medium
    channels: [slack]
```

---

## n8n Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| SUPABASE_URL | Supabase project URL | https://xxx.supabase.co |
| SUPABASE_SERVICE_KEY | Service role key (not anon) | eyJ... |
| WHATSAPP_API_URL | WhatsApp Business API URL | https://graph.facebook.com/v18.0 |
| WHATSAPP_ACCESS_TOKEN | WhatsApp API token | EAA... |
| SMTP_HOST | Email SMTP host | smtp.gmail.com |
| SMTP_USER | SMTP username | noreply@domain.com |
| SMTP_PASS | SMTP password | *** |
| WEBHOOK_SECRET | Secret for validating webhooks | random-string |

---

## Webhook Security

### Signature Validation

All incoming webhooks MUST validate signatures.

**WhatsApp:**
```javascript
const crypto = require('crypto');

function validateWhatsAppSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return `sha256=${expectedSignature}` === signature;
}
```

**Supabase:**
```javascript
function validateSupabaseWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  return expectedSignature === signature;
}
```

---

## Workflow Testing

### Test Scenarios

| Workflow | Test Case | Expected Result |
|----------|-----------|-----------------|
| WhatsApp Order | Valid message | Order created, confirmation sent |
| WhatsApp Order | Duplicate message | Skipped (idempotent) |
| WhatsApp Order | Invalid format | Error message sent |
| WhatsApp Order | Unknown tenant | Logged and skipped |
| Status Notification | Status changed | Notification sent |
| Status Notification | Same status | Skipped |
| Status Notification | Notifications disabled | Skipped |
| Low Stock | Products below threshold | Alert sent |
| Low Stock | No low stock | No alert |
| Low Stock | Alert sent within 24h | Skipped |

### Test Data

```json
{
  "whatsapp_order_valid": {
    "from": "966501234567",
    "text": "اسم العميل: أحمد\nالجوال: 0501234567\nالعنوان: الرياض\nالمنتج: قميص - 2"
  },
  "whatsapp_order_invalid": {
    "from": "966501234567",
    "text": "مرحبا"
  }
}
```
