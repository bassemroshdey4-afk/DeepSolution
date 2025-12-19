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

## Architecture

### Workflow Categories

| Category | Purpose | Examples |
|----------|---------|----------|
| Sales/Ops | Order and inventory management | Order Created → Reserve Stock |
| Shipping | Carrier integration and tracking | Shipping Status Sync |
| Finance | Payment and settlement processing | COD Settlement Sync |
| Alerts | Notifications and monitoring | Low Stock Alert |

### Data Flow

All n8n workflows follow a consistent pattern:

```
Trigger → Validate → Transform → Execute → Log → Respond
```

Each step is documented in AUTOMATION_AUTHORITY.md with specific data sources and destinations.

## Installation and Setup

### Self-Hosted Installation

For production environments, n8n should be deployed on a dedicated server:

```bash
# Using Docker
docker run -d \
  --name n8n \
  -p 5678:5678 \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=<secure-password> \
  -e WEBHOOK_URL=https://n8n.deepsolution.com \
  -v n8n_data:/home/node/.n8n \
  n8nio/n8n
```

### n8n Cloud

For managed hosting, use n8n Cloud with the following configuration:

| Setting | Value |
|---------|-------|
| Plan | Pro (for webhook support) |
| Region | EU or US (match Supabase region) |
| Executions | Based on workflow volume |

## Webhook Configuration

### Endpoint Structure

All webhooks follow a consistent URL pattern:

```
https://api.deepsolution.com/api/trpc/n8nWorkflows.<workflowName>
```

### Authentication

Every webhook request must include HMAC-SHA256 authentication:

| Header | Description |
|--------|-------------|
| `x-n8n-signature` | HMAC-SHA256 signature |
| `x-n8n-timestamp` | Unix timestamp (seconds) |
| `Content-Type` | `application/json` |

### Signature Generation

```javascript
const crypto = require('crypto');

function generateSignature(payload, timestamp, secret) {
  const message = `${timestamp}.${JSON.stringify(payload)}`;
  return crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
}
```

### Signature Verification (Server-Side)

```typescript
function verifyWebhookSignature(
  payload: unknown,
  signature: string,
  timestamp: string,
  secret: string
): boolean {
  const message = `${timestamp}.${JSON.stringify(payload)}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
  
  // Timing-safe comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

## Secrets Management

### Required Secrets

| Secret | Purpose | Where to Set |
|--------|---------|--------------|
| `N8N_WEBHOOK_SECRET` | Webhook authentication | n8n Credentials + Vercel |
| `SUPABASE_SERVICE_KEY` | Database access | n8n Credentials |
| `SMTP_HOST` | Email sending | n8n Credentials |
| `SMTP_USER` | Email authentication | n8n Credentials |
| `SMTP_PASSWORD` | Email authentication | n8n Credentials |

### Setting Secrets in n8n

1. Go to n8n Dashboard → Credentials
2. Create new credential for each service type
3. Use credential references in workflows (never hardcode)

### Secret Rotation

| Secret | Rotation Frequency |
|--------|-------------------|
| `N8N_WEBHOOK_SECRET` | Quarterly |
| `SUPABASE_SERVICE_KEY` | Quarterly |
| SMTP credentials | Annually or on incident |

## SMTP Configuration

### Email Provider Setup

| Provider | SMTP Host | Port | Security |
|----------|-----------|------|----------|
| SendGrid | smtp.sendgrid.net | 587 | STARTTLS |
| Mailgun | smtp.mailgun.org | 587 | STARTTLS |
| AWS SES | email-smtp.{region}.amazonaws.com | 587 | STARTTLS |

### n8n Email Node Configuration

```json
{
  "credentials": {
    "smtp": {
      "host": "smtp.sendgrid.net",
      "port": 587,
      "secure": false,
      "user": "apikey",
      "password": "{{ $credentials.smtp_password }}"
    }
  }
}
```

### Email Templates

All automated emails should use consistent templates:

| Email Type | Template | Variables |
|------------|----------|-----------|
| Low Stock Alert | `low_stock_alert` | `productName`, `currentStock`, `threshold` |
| Order Confirmation | `order_confirmed` | `orderNumber`, `customerName`, `total` |
| Shipping Update | `shipping_update` | `orderNumber`, `trackingNumber`, `status` |

## Workflow Registry

### Active Workflows

| ID | Name | Trigger | Status |
|----|------|---------|--------|
| WF-001 | Order Created → Reserve Stock | Webhook | Active |
| WF-002 | Order Fulfilled → Deduct Stock | Webhook | Active |
| WF-003 | Shipping Status Sync | Schedule (15min) | Active |
| WF-004 | COD Settlement Sync | Schedule (daily) | Active |
| WF-005 | Low Stock Alert | Webhook | Active |

### Workflow Documentation

Each workflow is fully documented in AUTOMATION_AUTHORITY.md with:

- Trigger type and configuration
- Input data sources
- Processing steps
- Output destinations
- Idempotency keys
- Error handling

## Idempotency

### Why Idempotency Matters

Webhooks can be delivered multiple times due to network issues or retries. Every workflow must be idempotent to prevent duplicate processing.

### Implementation Pattern

```typescript
// Check for existing execution
const existing = await supabase
  .from('workflow_executions')
  .select('id')
  .eq('idempotency_key', idempotencyKey)
  .single();

if (existing.data) {
  return { status: 'already_processed', executionId: existing.data.id };
}

// Process and record
await supabase.from('workflow_executions').insert({
  workflow_name: 'order_reserve_stock',
  idempotency_key: idempotencyKey,
  status: 'completed',
  // ...
});
```

### Idempotency Keys by Workflow

| Workflow | Idempotency Key Format |
|----------|----------------------|
| Order Reserve Stock | `reserve_stock_{orderId}` |
| Order Deduct Stock | `deduct_stock_{orderId}_{timestamp}` |
| Shipping Sync | `shipping_sync_{shipmentId}_{status}` |
| COD Settlement | `cod_settlement_{settlementId}` |
| Low Stock Alert | `low_stock_{productId}_{date}` |

## Error Handling

### Retry Strategy

| Error Type | Retry Count | Backoff |
|------------|-------------|---------|
| Network timeout | 3 | Exponential (1s, 2s, 4s) |
| Rate limit | 5 | Fixed (60s) |
| Server error (5xx) | 3 | Exponential |
| Client error (4xx) | 0 | No retry |

### Dead Letter Queue

Failed executions after all retries are logged to the dead letter queue:

```sql
INSERT INTO n8n_dead_letters (
  workflow_name,
  payload,
  error_message,
  retry_count,
  created_at
) VALUES (
  'order_reserve_stock',
  '{"orderId": "..."}',
  'Connection timeout',
  3,
  NOW()
);
```

### Alert on Failures

Configure n8n to send alerts on workflow failures:

1. Add Error Trigger node to each workflow
2. Connect to notification node (Email/Slack)
3. Include workflow name, error message, and timestamp

## Monitoring

### Health Check

Create a health check workflow that runs every 5 minutes:

1. Check database connectivity
2. Check SMTP connectivity
3. Check webhook endpoint availability
4. Log results to monitoring table

### Metrics to Track

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| Execution success rate | % of successful executions | < 95% |
| Average execution time | Time per workflow | > 30s |
| Queue depth | Pending executions | > 100 |
| Dead letter count | Failed executions | > 10/hour |

### Dashboard

Set up monitoring dashboard with:

- Execution counts by workflow
- Success/failure rates
- Average execution times
- Error distribution

## Backup and Recovery

### Workflow Backup

Export all workflows regularly:

```bash
# Export all workflows
curl -X GET "https://n8n.deepsolution.com/api/v1/workflows" \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  > workflows_backup_$(date +%Y%m%d).json
```

### Recovery Process

1. Stop n8n instance
2. Import workflows from backup
3. Verify credentials are configured
4. Test each workflow with sample data
5. Resume normal operation

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Webhook not triggering | Signature mismatch | Verify secret matches |
| Email not sending | SMTP credentials | Check credentials in n8n |
| Database timeout | Connection pool | Increase pool size |
| Duplicate processing | Missing idempotency | Add idempotency check |

### Debug Mode

Enable debug logging for troubleshooting:

```bash
# Set environment variable
N8N_LOG_LEVEL=debug

# Or in workflow
console.log(JSON.stringify($input.all(), null, 2));
```

### Log Locations

| Log Type | Location |
|----------|----------|
| n8n execution logs | n8n Dashboard → Executions |
| Application logs | Vercel → Logs |
| Database logs | Supabase → Logs |

## Security Considerations

### Access Control

| Role | Permissions |
|------|-------------|
| Admin | Full access, can create/edit workflows |
| Editor | Can edit existing workflows |
| Viewer | Read-only access to executions |

### Network Security

1. Use HTTPS for all webhook endpoints
2. Whitelist n8n IP addresses if possible
3. Use VPN for self-hosted n8n
4. Enable rate limiting on webhook endpoints

### Audit Trail

All workflow executions are logged with:

- Timestamp
- Workflow name
- Input data (sanitized)
- Output data
- Execution duration
- User/system that triggered

---

**IMPORTANT**: This runbook is the authoritative guide for n8n operations. All team members working with automation must be familiar with these procedures.
