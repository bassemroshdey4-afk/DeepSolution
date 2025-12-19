# DeepSolution Automation Authority

## Executive Summary

This document serves as the **single source of truth** for all automation workflows in the DeepSolution platform. Every workflow is documented with complete data lineage, trigger conditions, transformation logic, and failure handling. The automation layer is built on **n8n**, an open-source workflow automation platform that can be self-hosted and operated without any external dependencies.

---

## Automation Architecture

### System Overview

The automation system follows a hub-and-spoke model where n8n acts as the orchestration layer, connecting the core application with external services.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DeepSolution Core                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Marketing  │  │  Landing    │  │   Ad       │  │   Ops      │        │
│  │  Decision   │  │   Pages     │  │  Platforms │  │  Alerts    │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │                │
│         └────────────────┴────────────────┴────────────────┘                │
│                                   │                                         │
│                            ┌──────┴──────┐                                  │
│                            │   tRPC API  │                                  │
│                            └──────┬──────┘                                  │
└───────────────────────────────────┼─────────────────────────────────────────┘
                                    │
                             ┌──────┴──────┐
                             │     n8n     │
                             │ Orchestrator│
                             └──────┬──────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
     ┌────┴────┐              ┌─────┴─────┐             ┌────┴────┐
     │   Ad    │              │   SMTP    │             │ Webhooks│
     │Platforms│              │  Server   │             │ External│
     └─────────┘              └───────────┘             └─────────┘
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

## Security Requirements

### HMAC Webhook Signatures

All webhooks use HMAC-SHA256 signatures for authentication:

```typescript
// Signature generation
const signature = crypto
  .createHmac('sha256', N8N_WEBHOOK_SECRET)
  .update(JSON.stringify(payload))
  .digest('hex');

// Header format
X-DeepSolution-Signature: sha256={signature}
X-DeepSolution-Timestamp: {unix_timestamp}
```

### Per-Tenant Secrets

Each tenant has isolated secrets stored in `tenant_secrets` table:

| Secret Type | Purpose | Rotation |
|-------------|---------|----------|
| `webhook_secret` | HMAC signing | 90 days |
| `ad_platform_tokens` | API access | Per platform policy |
| `smtp_credentials` | Email sending | 180 days |

### Idempotency Keys

All workflows use idempotency keys to prevent duplicate execution:

| Format | Example | TTL |
|--------|---------|-----|
| `{workflow_id}:{tenant_id}:{entity_id}:{action}` | `WF-001:t_123:camp_456:evaluate` | 24h |

### Rate Limiting

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Webhook triggers | 100 req | 1 min |
| API calls per tenant | 1000 req | 1 hour |
| Email notifications | 50 emails | 1 hour |

---

## Complete Workflow Registry

### Workflow Index

| ID | Workflow Name | Trigger | Frequency | Status |
|----|---------------|---------|-----------|--------|
| WF-001 | Campaign Re-Evaluation Scheduler | Cron | 6h (4-12h adjustable) | Active |
| WF-002 | Ad Platform Metrics Ingestion | Cron | 3-6h | Active |
| WF-003 | Decision Notification | Webhook | Real-time | Active |
| WF-004 | Approval → Execute | Webhook | Real-time | Active |
| WF-005 | Landing Page Publish Pipeline | Webhook | Real-time | Active |
| WF-006 | Ops Alerts (Budget/Anomalies) | Cron | Hourly | Active |

---

## WF-001: Campaign Re-Evaluation Scheduler

### Purpose

Periodically evaluates active campaigns to determine if marketing decisions need to be updated based on performance data, spend thresholds, or data freshness.

### Data Flow

| Stage | Source | Transformation | Destination |
|-------|--------|----------------|-------------|
| Query | `tenants` table | Get active tenants | Memory |
| Query | `campaigns` table | Get campaigns needing review | Memory |
| Filter | Memory | Check spend threshold, data freshness | Memory |
| Call | Core API | Run Marketing Decision Engine | Memory |
| Store | Memory | Save decision_version, explanation | `marketing_decisions` |
| Update | Memory | Set next_check_at | `campaigns` |
| Audit | Memory | Log evaluation | `workflow_audit_logs` |

### Trigger Configuration

```json
{
  "type": "cron",
  "expression": "0 0 */6 * * *",
  "timezone": "UTC",
  "description": "Every 6 hours (adjustable 4-12h via env)",
  "configurable": {
    "env_var": "CAMPAIGN_EVAL_INTERVAL_HOURS",
    "min": 4,
    "max": 12,
    "default": 6
  }
}
```

### Review Criteria

| Criterion | Threshold | Action |
|-----------|-----------|--------|
| Spend since last review | > $50 | Trigger review |
| Data freshness | > 6 hours | Trigger review |
| Performance change | > 20% ROAS delta | Trigger review |
| Manual flag | `force_review = true` | Trigger review |

### Output Schema

```typescript
interface CampaignDecision {
  decision_id: string;
  tenant_id: string;
  campaign_id: string;
  decision_version: number;
  client_explanation: string;  // Human-readable summary
  confidence: number;          // 0-100
  recommendations: {
    action: 'continue' | 'pause' | 'adjust' | 'scale';
    budget_change?: number;
    audience_change?: string;
    creative_change?: string;
  };
  next_check_at: string;       // ISO timestamp
  created_at: string;
}
```

### Idempotency

| Key Format | Example | Storage |
|------------|---------|---------|
| `WF-001:{tenant_id}:{campaign_id}:{date}` | `WF-001:t_123:camp_456:2024-01-15` | `workflow_executions` |

### Failure Handling

| Failure Type | Action | Retry |
|--------------|--------|-------|
| Tenant not found | Skip, log warning | No |
| API timeout | Retry with backoff | 3x |
| Decision engine error | Log, use previous decision | No |
| Database error | Retry with backoff | 3x |

### Audit Events

| Event Type | Entity | Payload |
|------------|--------|---------|
| `CAMPAIGN_EVALUATED` | campaign | `{campaign_id, decision_version, confidence}` |
| `EVALUATION_SKIPPED` | campaign | `{campaign_id, reason}` |

---

## WF-002: Ad Platform Metrics Ingestion

### Purpose

Pulls performance metrics from ad platforms (Meta, Google, TikTok) and normalizes them into a unified schema for analysis and decision-making.

### Data Flow

| Stage | Source | Transformation | Destination |
|-------|--------|----------------|-------------|
| Query | `ad_platform_connections` | Get active connections | Memory |
| Auth | Memory | Refresh OAuth tokens if needed | Memory |
| Pull | Platform APIs | Fetch metrics for date range | Memory |
| Normalize | Memory | Map to unified schema | Memory |
| Upsert | Memory | Insert/update metrics | `ad_platform_metrics` |
| Fallback | CSV Upload | Process manual uploads | `ad_platform_metrics` |
| Audit | Memory | Log ingestion | `workflow_audit_logs` |

### Platform Connectors

| Platform | API Version | Auth Method | Rate Limit |
|----------|-------------|-------------|------------|
| Meta Ads | v18.0 | OAuth 2.0 | 200 req/hour |
| Google Ads | v14 | OAuth 2.0 | 15,000 req/day |
| TikTok Ads | v1.3 | OAuth 2.0 | 100 req/min |

### Unified Metrics Schema

```typescript
interface UnifiedMetrics {
  tenant_id: string;
  platform: 'meta' | 'google' | 'tiktok';
  campaign_id: string;
  ad_set_id?: string;
  ad_id?: string;
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpm: number;
  roas: number;
  raw_data: object;  // Original platform response
  ingested_at: string;
}
```

### Trigger Configuration

```json
{
  "type": "cron",
  "expression": "0 0 */3 * * *",
  "timezone": "UTC",
  "description": "Every 3 hours (adjustable 3-6h)",
  "configurable": {
    "env_var": "METRICS_INGESTION_INTERVAL_HOURS",
    "min": 3,
    "max": 6,
    "default": 3
  }
}
```

### CSV Fallback (Add-on)

For platforms without API access, users can upload CSV exports:

| Field | Required | Format |
|-------|----------|--------|
| `campaign_name` | Yes | String |
| `date` | Yes | YYYY-MM-DD |
| `impressions` | Yes | Integer |
| `clicks` | Yes | Integer |
| `spend` | Yes | Decimal |
| `conversions` | No | Integer |
| `revenue` | No | Decimal |

### Idempotency

| Key Format | Example | Storage |
|------------|---------|---------|
| `WF-002:{tenant_id}:{platform}:{date}` | `WF-002:t_123:meta:2024-01-15` | `workflow_executions` |

### Failure Handling

| Failure Type | Action | Retry |
|--------------|--------|-------|
| OAuth expired | Refresh token, retry | 1x |
| Rate limited | Backoff, retry | 3x |
| API error | Log, skip platform | No |
| Parse error | Log, use partial data | No |

### Audit Events

| Event Type | Entity | Payload |
|------------|--------|---------|
| `METRICS_INGESTED` | tenant | `{platform, records_count, date_range}` |
| `METRICS_FAILED` | tenant | `{platform, error, date_range}` |

---

## WF-003: Decision Notification

### Purpose

Sends professional, client-facing notifications when new marketing decisions are made, ensuring stakeholders are informed of recommendations and required actions.

### Data Flow

| Stage | Source | Transformation | Destination |
|-------|--------|----------------|-------------|
| Trigger | Webhook / Polling | Receive new decision event | Memory |
| Lookup | `marketing_decisions` | Get full decision details | Memory |
| Lookup | `tenants` | Get notification preferences | Memory |
| Format | Memory | Generate client-friendly summary | Memory |
| Send | SMTP | Send email notification | External |
| Store | Memory | Log notification | `notification_logs` |
| Audit | Memory | Log event | `workflow_audit_logs` |

### Trigger Configuration

```json
{
  "triggers": [
    {
      "type": "webhook",
      "path": "/api/n8n/decision-created",
      "method": "POST",
      "authentication": "hmac"
    },
    {
      "type": "cron",
      "expression": "0 */5 * * * *",
      "description": "Poll for unnotified decisions every 5 min"
    }
  ]
}
```

### Email Template

```html
Subject: [DeepSolution] Campaign Update: {{campaign_name}}

Hi {{client_name}},

Our AI has analyzed your campaign "{{campaign_name}}" and has a recommendation:

**Recommendation:** {{action}}
**Confidence:** {{confidence}}%

**Summary:**
{{client_explanation}}

**Next Steps:**
{{#if requires_approval}}
Please review and approve this recommendation in your dashboard.
{{else}}
This change will be applied automatically in 24 hours unless you object.
{{/if}}

---
DeepSolution Marketing Intelligence
```

### Notification Preferences

| Preference | Options | Default |
|------------|---------|---------|
| `email_enabled` | true/false | true |
| `email_frequency` | immediate/daily/weekly | immediate |
| `min_confidence` | 0-100 | 70 |
| `notify_on` | all/high-impact/critical | high-impact |

### Idempotency

| Key Format | Example | Storage |
|------------|---------|---------|
| `WF-003:{decision_id}:{channel}` | `WF-003:dec_123:email` | `workflow_executions` |

### Failure Handling

| Failure Type | Action | Retry |
|--------------|--------|-------|
| SMTP error | Retry with backoff | 3x |
| Invalid email | Log, skip | No |
| Template error | Use fallback template | No |

### Audit Events

| Event Type | Entity | Payload |
|------------|--------|---------|
| `NOTIFICATION_SENT` | decision | `{decision_id, channel, recipient}` |
| `NOTIFICATION_FAILED` | decision | `{decision_id, channel, error}` |

---

## WF-004: Approval → Execute

### Purpose

When a client approves a marketing decision, this workflow executes the recommended changes on ad platforms (when APIs exist) or generates manual execution instructions.

### Data Flow

| Stage | Source | Transformation | Destination |
|-------|--------|----------------|-------------|
| Trigger | Webhook | Receive approval event | Memory |
| Verify | Memory | Validate HMAC signature | Decision |
| Check | `workflow_executions` | Verify idempotency | Decision |
| Lookup | `marketing_decisions` | Get decision details | Memory |
| Route | Memory | Check platform API availability | Decision |
| Execute | Platform API | Apply changes (if API exists) | External |
| Generate | Memory | Create manual instructions (if no API) | Memory |
| Store | Memory | Log execution | `execution_logs` |
| Notify | SMTP | Send confirmation | External |
| Audit | Memory | Log event | `workflow_audit_logs` |

### Trigger Configuration

```json
{
  "type": "webhook",
  "path": "/api/n8n/decision-approved",
  "method": "POST",
  "authentication": "hmac",
  "headers": {
    "X-DeepSolution-Signature": "required",
    "X-DeepSolution-Timestamp": "required"
  }
}
```

### Execution Modes

| Mode | Condition | Action |
|------|-----------|--------|
| `auto_execute` | Platform API connected | Apply changes via API |
| `manual_instructions` | No API access | Generate step-by-step guide |
| `hybrid` | Partial API access | Execute what's possible, guide the rest |

### Manual Instruction Template

```markdown
## Manual Execution Required

Campaign: {{campaign_name}}
Platform: {{platform}}
Decision: {{decision_id}}

### Steps to Execute:

1. Log into {{platform}} Ads Manager
2. Navigate to Campaign: {{campaign_name}}
3. Apply the following changes:
   {{#each changes}}
   - {{this.field}}: Change from {{this.old_value}} to {{this.new_value}}
   {{/each}}
4. Save changes
5. Return to DeepSolution and mark as "Executed"

### Deadline: {{deadline}}
```

### Idempotency

| Key Format | Example | Storage |
|------------|---------|---------|
| `WF-004:{decision_id}:execute` | `WF-004:dec_123:execute` | `workflow_executions` |

### Failure Handling

| Failure Type | Action | Retry |
|--------------|--------|-------|
| Invalid signature | Reject, log security event | No |
| Already executed | Return success (idempotent) | No |
| API error | Fallback to manual instructions | No |
| Partial failure | Execute what's possible, log rest | No |

### Audit Events

| Event Type | Entity | Payload |
|------------|--------|---------|
| `DECISION_EXECUTED` | decision | `{decision_id, mode, changes_applied}` |
| `MANUAL_INSTRUCTIONS_GENERATED` | decision | `{decision_id, platform, steps_count}` |
| `EXECUTION_FAILED` | decision | `{decision_id, error, partial_success}` |

---

## WF-005: Landing Page Publish Pipeline

### Purpose

Handles the publication of landing pages, including version management, URL generation, and client notification.

### Data Flow

| Stage | Source | Transformation | Destination |
|-------|--------|----------------|-------------|
| Trigger | Webhook | Receive publish request | Memory |
| Verify | Memory | Validate signature + permissions | Decision |
| Lookup | `landing_pages` | Get page details | Memory |
| Validate | Memory | Check page is ready | Decision |
| Publish | Memory | Generate published URL | Memory |
| Update | Memory | Set status = published | `landing_pages` |
| Store | Memory | Record published_url | `landing_pages` |
| Notify | SMTP | Send publish confirmation | External |
| Audit | Memory | Log event | `workflow_audit_logs` |

### Trigger Configuration

```json
{
  "type": "webhook",
  "path": "/api/n8n/landing-page-publish",
  "method": "POST",
  "authentication": "hmac"
}
```

### URL Generation

| Environment | Pattern | Example |
|-------------|---------|---------|
| Production | `{tenant_slug}.deepsolution.app/{page_slug}` | `acme.deepsolution.app/summer-sale` |
| Preview | `preview.deepsolution.app/{tenant_id}/{page_id}` | `preview.deepsolution.app/t_123/lp_456` |
| Custom Domain | `{custom_domain}/{page_slug}` | `landing.acme.com/summer-sale` |

### Publication Checklist

| Check | Required | Action if Failed |
|-------|----------|------------------|
| Page status = review | Yes | Reject |
| All sections visible | No | Warn |
| SEO fields filled | No | Warn |
| Theme configured | No | Use default |

### Idempotency

| Key Format | Example | Storage |
|------------|---------|---------|
| `WF-005:{page_id}:{version}:publish` | `WF-005:lp_123:3:publish` | `workflow_executions` |

### Failure Handling

| Failure Type | Action | Retry |
|--------------|--------|-------|
| Page not found | Reject with error | No |
| Invalid status | Reject with error | No |
| URL conflict | Generate unique slug | 1x |
| Notification failed | Log, continue | No |

### Audit Events

| Event Type | Entity | Payload |
|------------|--------|---------|
| `LANDING_PAGE_PUBLISHED` | landing_page | `{page_id, version, published_url}` |
| `LANDING_PAGE_UNPUBLISHED` | landing_page | `{page_id, version, reason}` |

---

## WF-006: Ops Alerts (Budget/Anomalies)

### Purpose

Monitors campaign performance for anomalies, budget issues, and performance degradation. Sends alerts and optionally triggers re-evaluation.

### Data Flow

| Stage | Source | Transformation | Destination |
|-------|--------|----------------|-------------|
| Query | `ad_platform_metrics` | Get recent metrics | Memory |
| Analyze | Memory | Detect anomalies | Memory |
| Check | Memory | Compare against thresholds | Decision |
| Alert | SMTP | Send alert notification | External |
| Flag | Memory | Mark campaign for review | `campaigns` |
| Audit | Memory | Log alert | `workflow_audit_logs` |

### Trigger Configuration

```json
{
  "type": "cron",
  "expression": "0 0 * * * *",
  "timezone": "UTC",
  "description": "Every hour"
}
```

### Anomaly Detection Rules

| Rule | Threshold | Severity | Action |
|------|-----------|----------|--------|
| Budget exhaustion | > 90% spent | Critical | Alert + Force review |
| Spend spike | > 200% of daily average | High | Alert |
| ROAS collapse | < 50% of baseline | Critical | Alert + Force review |
| CTR drop | < 50% of baseline | Medium | Alert |
| Creative fatigue | CTR declining 3+ days | Medium | Alert |
| Conversion drop | < 30% of baseline | High | Alert |

### Alert Template

```html
Subject: [DeepSolution Alert] {{severity}}: {{alert_type}} - {{campaign_name}}

⚠️ ALERT: {{alert_type}}

Campaign: {{campaign_name}}
Severity: {{severity}}
Detected at: {{timestamp}}

**Details:**
{{description}}

**Current Value:** {{current_value}}
**Expected Range:** {{expected_range}}

**Recommended Action:**
{{recommendation}}

{{#if force_review}}
A campaign re-evaluation has been automatically triggered.
{{/if}}

---
DeepSolution Ops Monitoring
```

### Idempotency

| Key Format | Example | Storage |
|------------|---------|---------|
| `WF-006:{campaign_id}:{alert_type}:{hour}` | `WF-006:camp_123:budget_exhaustion:2024-01-15T10` | `workflow_executions` |

### Failure Handling

| Failure Type | Action | Retry |
|--------------|--------|-------|
| Metrics unavailable | Skip, log warning | No |
| Alert send failed | Retry with backoff | 3x |
| Database error | Retry with backoff | 3x |

### Audit Events

| Event Type | Entity | Payload |
|------------|--------|---------|
| `OPS_ALERT_TRIGGERED` | campaign | `{campaign_id, alert_type, severity}` |
| `FORCE_REVIEW_TRIGGERED` | campaign | `{campaign_id, reason}` |

---

## Database Tables Used

### Core Tables

| Table | Used By | Access |
|-------|---------|--------|
| `tenants` | WF-001, WF-002 | Read |
| `campaigns` | WF-001, WF-006 | Read/Write |
| `marketing_decisions` | WF-001, WF-003, WF-004 | Read/Write |
| `ad_platform_metrics` | WF-002, WF-006 | Read/Write |
| `ad_platform_connections` | WF-002 | Read |
| `landing_pages` | WF-005 | Read/Write |
| `notification_logs` | WF-003 | Write |
| `execution_logs` | WF-004 | Write |

### Audit Tables

| Table | Purpose | Retention |
|-------|---------|-----------|
| `workflow_audit_logs` | All workflow events | 90 days |
| `workflow_executions` | Idempotency tracking | 7 days |

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `N8N_WEBHOOK_SECRET` | HMAC signing secret | Yes |
| `SUPABASE_URL` | Database connection | Yes |
| `SUPABASE_SERVICE_KEY` | Database auth | Yes |
| `SMTP_HOST` | Email server | Yes |
| `SMTP_PORT` | Email port | Yes |
| `SMTP_USER` | Email auth | Yes |
| `SMTP_PASS` | Email auth | Yes |
| `CAMPAIGN_EVAL_INTERVAL_HOURS` | WF-001 frequency | No (default: 6) |
| `METRICS_INGESTION_INTERVAL_HOURS` | WF-002 frequency | No (default: 3) |

---

## Monitoring & Observability

### Health Checks

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `GET /api/n8n/health` | n8n connectivity | `{"status": "ok"}` |
| `GET /api/n8n/workflows` | List active workflows | Array of workflow IDs |

### Metrics to Track

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `workflow_execution_time` | Duration per workflow | > 60s |
| `workflow_failure_rate` | Failures / Total | > 5% |
| `webhook_latency` | Time to process | > 5s |
| `notification_delivery_rate` | Delivered / Sent | < 95% |

---

## Disaster Recovery

### Backup Strategy

| Component | Frequency | Retention |
|-----------|-----------|-----------|
| n8n workflows | On change | 30 versions |
| Workflow credentials | Daily | 7 days |
| Execution logs | Continuous | 90 days |

### Recovery Procedures

1. **n8n Down**: Workflows queue in dead-letter, auto-retry on recovery
2. **Database Down**: n8n pauses, resumes when connection restored
3. **SMTP Down**: Notifications queue, retry with exponential backoff

---

**Document Version:** 2.0
**Last Updated:** December 2024
**Author:** DeepSolution Engineering Team
