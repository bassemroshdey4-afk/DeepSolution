# n8n Runbook

This document provides operational guidance for running and maintaining n8n as the official automation layer for DeepSolution. All automation workflows must be implemented through n8n.

## Overview

n8n serves as the central automation hub for DeepSolution, orchestrating workflows between the application, database, external APIs, and notification systems.

| Aspect | Configuration |
|--------|---------------|
| Role | Official automation layer |
| Deployment | Self-hosted or n8n Cloud |
| Integration | HTTP webhooks to tRPC endpoints |
| Authentication | HMAC-SHA256 signed requests |

## Official Workflow Suite

DeepSolution uses 6 official workflows for marketing automation:

| ID | Name | Trigger | Purpose |
|----|------|---------|---------|
| WF-001 | Campaign Re-Evaluation Scheduler | Cron (6h) | Periodic campaign analysis |
| WF-002 | Ad Platform Metrics Ingestion | Cron (3h) | Pull metrics from ad platforms |
| WF-003 | Decision Notification | Webhook | Notify clients of new decisions |
| WF-004 | Approval → Execute | Webhook | Execute approved decisions |
| WF-005 | Landing Page Publish Pipeline | Webhook | Publish landing pages |
| WF-006 | Ops Alerts | Cron (1h) | Detect budget/performance anomalies |

## Installation and Setup

### Self-Hosted Installation (Recommended for Production)

```bash
# Using Docker Compose
version: '3.8'
services:
  n8n:
    image: n8nio/n8n:latest
    restart: always
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=${N8N_ADMIN_PASSWORD}
      - WEBHOOK_URL=https://n8n.deepsolution.com
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=${SUPABASE_HOST}
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_USER=${N8N_DB_USER}
      - DB_POSTGRESDB_PASSWORD=${N8N_DB_PASSWORD}
    volumes:
      - n8n_data:/home/node/.n8n
    networks:
      - deepsolution

volumes:
  n8n_data:

networks:
  deepsolution:
    external: true
```

### n8n Cloud Setup

For managed hosting, use n8n Cloud with the following configuration:

| Setting | Value |
|---------|-------|
| Plan | Pro (for webhook support) |
| Region | EU or US (match Supabase region) |
| Executions | Based on workflow volume |

## Secrets Management

### Required Secrets

| Secret | Purpose | Where to Set |
|--------|---------|--------------|
| `N8N_WEBHOOK_SECRET` | HMAC webhook authentication | n8n Credentials + App |
| `SUPABASE_URL` | Database connection | n8n Credentials |
| `SUPABASE_SERVICE_KEY` | Database access | n8n Credentials |
| `SMTP_HOST` | Email sending | n8n Credentials |
| `SMTP_PORT` | Email port | n8n Credentials |
| `SMTP_USER` | Email authentication | n8n Credentials |
| `SMTP_PASSWORD` | Email authentication | n8n Credentials |
| `SMTP_FROM_EMAIL` | Sender email address | n8n Environment |
| `CORE_API_URL` | DeepSolution API URL | n8n Environment |
| `APP_URL` | Frontend app URL | n8n Environment |

### Setting Secrets in n8n

1. Go to n8n Dashboard → Settings → Credentials
2. Create credentials for each service:

**Supabase Database Credential:**
```json
{
  "type": "postgres",
  "host": "db.xxxx.supabase.co",
  "port": 5432,
  "database": "postgres",
  "user": "postgres",
  "password": "your-service-key",
  "ssl": true
}
```

**SMTP Credential:**
```json
{
  "type": "smtp",
  "host": "smtp.sendgrid.net",
  "port": 587,
  "secure": false,
  "user": "apikey",
  "password": "SG.xxxx"
}
```

### Secret Rotation Schedule

| Secret | Rotation Frequency | Procedure |
|--------|-------------------|-----------|
| `N8N_WEBHOOK_SECRET` | Quarterly | Update in both n8n and app env |
| `SUPABASE_SERVICE_KEY` | Quarterly | Regenerate in Supabase dashboard |
| SMTP credentials | Annually | Update in email provider |
| OAuth tokens | Auto-refresh | Handled by n8n |

## SMTP Configuration

### Supported Email Providers

| Provider | SMTP Host | Port | Security |
|----------|-----------|------|----------|
| SendGrid | smtp.sendgrid.net | 587 | STARTTLS |
| Mailgun | smtp.mailgun.org | 587 | STARTTLS |
| AWS SES | email-smtp.{region}.amazonaws.com | 587 | STARTTLS |
| Postmark | smtp.postmarkapp.com | 587 | STARTTLS |

### Email Templates

All workflows use HTML email templates with consistent branding:

| Workflow | Email Type | Subject Pattern |
|----------|------------|-----------------|
| WF-003 | Decision Notification | `[DeepSolution] Campaign Update: {campaign_name}` |
| WF-004 | Execution Confirmation | `[DeepSolution] Decision Executed: {campaign_name}` |
| WF-005 | Publish Notification | `[DeepSolution] Landing Page Published: {page_name}` |
| WF-006 | Ops Alert | `[DeepSolution Alert] {severity}: {alert_type} - {campaign_name}` |

### Testing SMTP

Before deploying, test SMTP configuration:

```bash
# Using n8n's built-in test
curl -X POST "https://n8n.deepsolution.com/api/v1/credentials/test" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type": "smtp", "id": "smtp-credentials"}'
```

## Webhook Security

### HMAC Signature Verification

All webhooks use HMAC-SHA256 signatures for authentication:

**Request Headers:**
| Header | Description |
|--------|-------------|
| `X-DeepSolution-Signature` | `sha256=<hmac_hex>` |
| `X-DeepSolution-Timestamp` | Unix timestamp (milliseconds) |
| `Content-Type` | `application/json` |

**Signature Generation (in n8n):**
```javascript
const crypto = require('crypto');
const body = JSON.stringify($json.body);
const signature = 'sha256=' + crypto
  .createHmac('sha256', $env.N8N_WEBHOOK_SECRET)
  .update(body)
  .digest('hex');
```

**Signature Verification (in App):**
```typescript
import crypto from 'crypto';

function verifyWebhookSignature(
  body: string,
  signature: string,
  timestamp: string,
  secret: string
): boolean {
  // Check timestamp (5 min tolerance)
  const now = Date.now();
  const requestTime = parseInt(timestamp);
  if (Math.abs(now - requestTime) > 300000) {
    return false;
  }
  
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

## Workflow Details

### WF-001: Campaign Re-Evaluation Scheduler

**Purpose:** Periodically evaluate campaigns that need review based on spend, time since last evaluation, or forced review flag.

| Aspect | Configuration |
|--------|---------------|
| Trigger | Cron every 6 hours (adjustable 4-12h) |
| Input | `campaigns` table (active, needs review) |
| Output | `marketing_decisions` table |
| Idempotency | `WF-001:{tenant_id}:{campaign_id}:{date}` |

**Data Flow:**
```
Schedule → Query Campaigns → Filter → Check Idempotency → Call Decision Engine → Store Decision → Update Campaign → Audit Log
```

### WF-002: Ad Platform Metrics Ingestion

**Purpose:** Pull metrics from connected ad platforms (Meta, Google) and normalize into unified schema.

| Aspect | Configuration |
|--------|---------------|
| Trigger | Cron every 3 hours |
| Input | `ad_platform_connections` table |
| Output | `ad_platform_metrics` table |
| Idempotency | Upsert on `(tenant_id, platform, campaign_id, date)` |

**Supported Platforms:**
- Meta (Facebook/Instagram Ads)
- Google Ads
- TikTok Ads (planned)
- CSV Upload (fallback)

### WF-003: Decision Notification

**Purpose:** Send professional email notifications when new marketing decisions are created.

| Aspect | Configuration |
|--------|---------------|
| Trigger | Webhook on decision insert |
| Input | `marketing_decisions` table |
| Output | Email + `notification_logs` table |
| Idempotency | `WF-003:{decision_id}:email` |

**Notification Preferences:**
- `email_enabled`: Enable/disable email notifications
- `min_confidence`: Minimum confidence score to notify (default: 70)

### WF-004: Approval → Execute

**Purpose:** Execute approved decisions via platform APIs or generate manual instructions.

| Aspect | Configuration |
|--------|---------------|
| Trigger | Webhook on decision approval |
| Input | `marketing_decisions` + `ad_platform_connections` |
| Output | `execution_logs` table + Email |
| Idempotency | `WF-004:{decision_id}:execute` |

**Execution Modes:**
1. **Auto Execute:** When platform API access is available
2. **Manual Instructions:** When API access is not available

### WF-005: Landing Page Publish Pipeline

**Purpose:** Publish landing pages and notify clients with the live URL.

| Aspect | Configuration |
|--------|---------------|
| Trigger | Webhook on publish action |
| Input | `landing_pages` table |
| Output | Update `published_url` + Email |
| Idempotency | `WF-005:{page_id}:{version}:publish` |

### WF-006: Ops Alerts (Budget/Anomalies)

**Purpose:** Detect performance anomalies and budget issues, alert clients, and optionally force re-evaluation.

| Aspect | Configuration |
|--------|---------------|
| Trigger | Cron every hour |
| Input | `ad_platform_metrics` + `campaigns` |
| Output | Email + optional `force_review` flag |
| Idempotency | `WF-006:{campaign_id}:{alert_type}:{hour}` |

**Alert Types:**
| Alert | Severity | Force Review |
|-------|----------|--------------|
| `budget_exhaustion` | Critical | Yes |
| `spend_spike` | High | No |
| `roas_collapse` | Critical | Yes |
| `ctr_drop` | Medium | No |

## Database Tables

### Required Tables for n8n

```sql
-- Workflow execution tracking
CREATE TABLE workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id VARCHAR(50) NOT NULL,
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  entity_id UUID,
  entity_type VARCHAR(50),
  status VARCHAR(20) DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflow_executions_idempotency ON workflow_executions(idempotency_key);
CREATE INDEX idx_workflow_executions_tenant ON workflow_executions(tenant_id);

-- Audit logs for all workflow actions
CREATE TABLE workflow_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id VARCHAR(50) NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  event_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflow_audit_tenant ON workflow_audit_logs(tenant_id);
CREATE INDEX idx_workflow_audit_event ON workflow_audit_logs(event_type);

-- Dead letter queue for failed executions
CREATE TABLE n8n_dead_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id VARCHAR(50) NOT NULL,
  tenant_id UUID,
  payload JSONB NOT NULL,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Notification logs
CREATE TABLE notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  decision_id UUID,
  channel VARCHAR(20) NOT NULL,
  recipient VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Execution logs for decision execution
CREATE TABLE execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  decision_id UUID NOT NULL,
  execution_mode VARCHAR(50) NOT NULL,
  changes_applied JSONB,
  instructions JSONB,
  status VARCHAR(20) DEFAULT 'completed',
  executed_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Error Handling

### Retry Strategy

| Error Type | Retry Count | Backoff |
|------------|-------------|---------|
| Network timeout | 3 | Exponential (5s, 10s, 20s) |
| Rate limit (429) | 5 | Fixed (60s) |
| Server error (5xx) | 3 | Exponential |
| Client error (4xx) | 0 | No retry |
| Signature invalid | 0 | No retry (security) |

### Dead Letter Queue

Failed executions after all retries are logged:

```sql
INSERT INTO n8n_dead_letters (
  workflow_id,
  tenant_id,
  payload,
  error_message,
  retry_count
) VALUES (
  'WF-001',
  'tenant-uuid',
  '{"campaign_id": "..."}',
  'Connection timeout after 3 retries',
  3
);
```

### Manual Resolution

To resolve dead letter items:

1. Query dead letters: `SELECT * FROM n8n_dead_letters WHERE resolved_at IS NULL`
2. Fix underlying issue
3. Re-run workflow manually with payload
4. Mark as resolved: `UPDATE n8n_dead_letters SET resolved_at = NOW() WHERE id = '...'`

## Monitoring

### Health Check Workflow

Create a health check workflow that runs every 5 minutes:

```javascript
// Health check nodes:
1. Check Supabase connectivity (SELECT 1)
2. Check SMTP connectivity (send test email to self)
3. Check Core API availability (GET /health)
4. Log results to health_checks table
```

### Metrics to Track

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| Execution success rate | % of successful executions | < 95% |
| Average execution time | Time per workflow | > 30s |
| Dead letter count | Failed executions | > 10/hour |
| Webhook response time | Time to respond | > 5s |

### Alerting

Configure alerts in n8n:

1. Add Error Trigger node to each workflow
2. Connect to Email node with ops team address
3. Include: workflow name, error message, timestamp, payload

## Importing Workflows

### From JSON Files

1. Go to n8n Dashboard → Workflows
2. Click "Import from File"
3. Select JSON file from `n8n-workflows/` directory
4. Configure credentials (replace placeholders)
5. Activate workflow

### Workflow Files

| File | Workflow |
|------|----------|
| `WF-001-campaign-reevaluation.json` | Campaign Re-Evaluation Scheduler |
| `WF-002-metrics-ingestion.json` | Ad Platform Metrics Ingestion |
| `WF-003-decision-notification.json` | Decision Notification |
| `WF-004-approval-execute.json` | Approval → Execute |
| `WF-005-landing-page-publish.json` | Landing Page Publish Pipeline |
| `WF-006-ops-alerts.json` | Ops Alerts |

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Webhook not triggering | Signature mismatch | Verify `N8N_WEBHOOK_SECRET` matches |
| Email not sending | SMTP credentials | Check credentials in n8n |
| Database timeout | Connection pool | Increase pool size in Supabase |
| Duplicate processing | Missing idempotency | Check `workflow_executions` table |
| OAuth token expired | Token not refreshed | Re-authenticate in n8n |

### Debug Mode

Enable debug logging:

```javascript
// In n8n Code node
console.log('Input:', JSON.stringify($input.all(), null, 2));
console.log('Environment:', $env.CORE_API_URL);
```

### Log Locations

| Log Type | Location |
|----------|----------|
| n8n execution logs | n8n Dashboard → Executions |
| Application logs | Vercel → Logs |
| Database logs | Supabase → Logs |
| Audit logs | `workflow_audit_logs` table |

## Security Checklist

- [ ] HMAC webhook secret is set and matches in both n8n and app
- [ ] All credentials are stored in n8n Credentials (not hardcoded)
- [ ] HTTPS is enabled for all webhook endpoints
- [ ] Rate limiting is configured on webhook endpoints
- [ ] Audit logging is enabled for all workflows
- [ ] Dead letter queue is monitored
- [ ] Secret rotation schedule is documented
- [ ] Access control is configured (Admin/Editor/Viewer roles)

---

**IMPORTANT**: This runbook is the authoritative guide for n8n operations. All team members working with automation must be familiar with these procedures. For workflow-specific details, refer to AUTOMATION_AUTHORITY.md.


## Shipping OPS Automation Suite

In addition to marketing workflows, DeepSolution uses 4 shipping automation workflows:

| ID | Name | Trigger | Purpose |
|----|------|---------|---------|
| S1 | Shipping Status Ingestion | Cron (3h) | Pull shipping updates from carriers |
| S2 | Provider→Internal Mapping | Webhook | Map provider statuses to internal states |
| S3 | Ops Station Routing | Webhook | Route orders to correct UI queues |
| S4 | Courier Performance Analytics | Cron (12h) | Compute carrier metrics |

### S1: Shipping Status Ingestion

**Purpose:** Pull shipping status updates from multiple sources and ingest into the system.

| Aspect | Configuration |
|--------|---------------|
| Trigger | Cron every 3-6 hours |
| Input | `shipments` table (active shipments) |
| Output | `shipment_events` table |
| Idempotency | `S1:{tenant_id}:{tracking_number}:{provider_status}:{occurred_at}` |

**Ingestion Modes:**

| Mode | Description | Setup |
|------|-------------|-------|
| API | Direct carrier API calls | Configure carrier credentials |
| CSV | Upload CSV file | Use tRPC endpoint |
| Email | Parse email content | Forward emails to ingestion endpoint |

### CSV Upload Ingestion Setup

For carriers without API access, users can upload CSV files with status updates.

**Required CSV Columns:**
| Column | Required | Description |
|--------|----------|-------------|
| `tracking_number` or `awb` | Yes | Shipment tracking number |
| `status` | Yes | Provider status code |
| `date` or `timestamp` | No | Event timestamp (defaults to now) |
| `location` | No | Event location |
| `description` | No | Status description |

**Example CSV:**
```csv
tracking_number,status,date,location,description
AWB123456789,delivered,2024-01-15 14:30:00,Riyadh,Package delivered to customer
AWB987654321,in_transit,2024-01-15 10:00:00,Jeddah,Package in transit
```

**Upload via tRPC:**
```typescript
const result = await trpc.shippingAutomation.ingestFromCSV.mutate({
  csv_content: csvString,
  provider: "aramex"
});
```

### Email Ingestion Setup

For carriers that send status updates via email, configure email forwarding.

**Setup Steps:**
1. Create a dedicated email address (e.g., `shipping-updates@deepsolution.com`)
2. Configure email forwarding to the ingestion endpoint
3. Set up email parsing rules per carrier

**Supported Email Patterns:**
| Pattern | Extracted Data |
|---------|----------------|
| `tracking: AWB123456789` | Tracking number |
| `delivered` | Status: delivered |
| `out for delivery` | Status: out_for_delivery |
| `in transit` | Status: in_transit |
| `returned` | Status: returned |

**Email Parsing via tRPC:**
```typescript
const result = await trpc.shippingAutomation.ingestFromEmail.mutate({
  email_content: emailBody,
  provider: "smsa"
});
```

### S2: Provider→Internal Status Mapping

**Purpose:** Translate provider-specific status codes to internal order states.

| Aspect | Configuration |
|--------|---------------|
| Trigger | Webhook on new `shipment_event` |
| Input | `shipment_events` + `provider_status_mapping` |
| Output | `orders.state` + `order_internal_events` |
| Idempotency | `S2:{tenant_id}:{shipment_event_id}` |

**Default Mappings:**
| Provider | Provider Status | Internal Status |
|----------|-----------------|-----------------|
| * | `pending` | `operations_pending` |
| * | `picked_up` | `shipped` |
| * | `in_transit` | `in_transit` |
| * | `delivered` | `delivered` |
| aramex | `SHP` | `shipped` |
| aramex | `DEL` | `delivered` |
| smsa | `Delivered` | `delivered` |

**Custom Mapping:**
```typescript
await trpc.shippingAutomation.upsertStatusMapping.mutate({
  provider: "custom_carrier",
  provider_status: "DLVD",
  internal_status: "delivered",
  triggers_station: "finance",
  is_terminal: true
});
```

### S3: Ops Station Routing

**Purpose:** Route orders to the correct UI queue based on their state.

| Aspect | Configuration |
|--------|---------------|
| Trigger | Webhook on `orders.state` change |
| Input | `orders` + `order_station_metrics` |
| Output | `order_station_metrics` + `orders.current_station` |
| Idempotency | `S3:{tenant_id}:{order_id}:{state}` |

**Station Routing Rules:**
| State | Station | SLA Target |
|-------|---------|------------|
| `new`, `call_center_pending` | CallCenter | 60 min |
| `operations_pending`, `operations_processing` | Operations | 240 min |
| `delivered`, `finance_pending` | Finance | 1440 min |
| `return_*` | Returns | 2880 min |

### S4: Courier Performance Analytics

**Purpose:** Compute daily carrier performance metrics and generate recommendations.

| Aspect | Configuration |
|--------|---------------|
| Trigger | Cron every 12 hours |
| Input | `shipments` (last 30 days) |
| Output | `courier_performance_daily` |
| Idempotency | `S4:{tenant_id}:{date}` |

**Computed Metrics:**
| Metric | Description |
|--------|-------------|
| `avg_pickup_hours` | Average time from order to pickup |
| `avg_delivery_hours` | Average time from order to delivery |
| `avg_return_cycle_hours` | Average time for return cycle |
| `avg_cod_remittance_hours` | Average time for COD settlement |
| `delivery_rate` | Successful deliveries / total |
| `return_rate` | Returns / total |
| `on_time_rate` | Delivered within 72 hours |
| `score` | Composite score (0-100) |

**Scoring Formula:**
```
Score = 50 (base)
      + (delivery_rate × 20)
      - (return_rate × 15)
      + (on_time_rate × 15)
      - min(pickup_hours/24, 1) × 10
```

## Shipping Database Tables

### Required Tables

```sql
-- Shipment events history
CREATE TABLE shipment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  shipment_id UUID NOT NULL REFERENCES shipments(id),
  tracking_number VARCHAR(100) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  provider_status VARCHAR(100) NOT NULL,
  internal_status VARCHAR(50),
  location VARCHAR(255),
  description TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  raw_data JSONB,
  ingestion_mode VARCHAR(20) NOT NULL, -- api, csv, email, manual
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Provider status mapping
CREATE TABLE provider_status_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  provider VARCHAR(50) NOT NULL,
  provider_status VARCHAR(100) NOT NULL,
  internal_status VARCHAR(50) NOT NULL,
  triggers_station VARCHAR(20),
  is_terminal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, provider, provider_status)
);

-- Order internal events (station timeline)
CREATE TABLE order_internal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  from_state VARCHAR(50),
  to_state VARCHAR(50) NOT NULL,
  station VARCHAR(20) NOT NULL,
  triggered_by VARCHAR(20) NOT NULL, -- system, user, automation
  user_id UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order station metrics (SLA timers)
CREATE TABLE order_station_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  station VARCHAR(20) NOT NULL,
  entered_at TIMESTAMPTZ NOT NULL,
  exited_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  sla_target_minutes INTEGER NOT NULL,
  sla_breached BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Courier performance daily aggregates
CREATE TABLE courier_performance_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  courier VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  region VARCHAR(100),
  total_shipments INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  returned_count INTEGER DEFAULT 0,
  avg_pickup_hours DECIMAL(10,2),
  avg_delivery_hours DECIMAL(10,2),
  avg_return_cycle_hours DECIMAL(10,2),
  avg_cod_remittance_hours DECIMAL(10,2),
  delivery_rate DECIMAL(5,4),
  return_rate DECIMAL(5,4),
  on_time_rate DECIMAL(5,4),
  score INTEGER,
  recommendations JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, courier, date, region)
);

-- Indexes
CREATE INDEX idx_shipment_events_tenant ON shipment_events(tenant_id);
CREATE INDEX idx_shipment_events_tracking ON shipment_events(tracking_number);
CREATE INDEX idx_order_internal_events_order ON order_internal_events(order_id);
CREATE INDEX idx_order_station_metrics_order ON order_station_metrics(order_id);
CREATE INDEX idx_order_station_metrics_station ON order_station_metrics(station, exited_at);
CREATE INDEX idx_courier_performance_daily_tenant ON courier_performance_daily(tenant_id, date);
```

## Shipping Workflow Files

Import these workflow files into n8n:

| File | Workflow |
|------|----------|
| `S1-shipping-status-ingestion.json` | Shipping Status Ingestion |
| `S2-status-mapping.json` | Provider→Internal Status Mapping |
| `S3-station-routing.json` | Ops Station Routing |
| `S4-courier-analytics.json` | Courier Performance Analytics |

## Shipping Secrets

Additional secrets required for shipping workflows:

| Secret | Purpose | Where to Set |
|--------|---------|--------------|
| `ARAMEX_API_KEY` | Aramex API access | n8n Credentials |
| `ARAMEX_ACCOUNT_NUMBER` | Aramex account | n8n Credentials |
| `SMSA_API_KEY` | SMSA API access | n8n Credentials |
| `JNT_API_KEY` | J&T API access | n8n Credentials |

---

**IMPORTANT**: For shipping automation details, refer to SHIPPING_AUTOMATION_MAP.md.
