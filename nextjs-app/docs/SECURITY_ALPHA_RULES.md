# Security Rules for Private Alpha

**DeepSolution Private Alpha**

This document outlines the security measures implemented for the Private Alpha deployment. These rules ensure the platform remains private and secure during development.

---

## Access Control

### HTTP Basic Authentication

The platform uses HTTP Basic Authentication as the first line of defense during Private Alpha.

**Configuration:**

| Variable | Purpose |
|----------|---------|
| `ENABLE_BASIC_AUTH` | Set to `true` to enable |
| `BASIC_AUTH_USER` | Username for authentication |
| `BASIC_AUTH_PASS` | Password for authentication |

**Behavior:**
- When enabled, all routes require Basic Auth credentials
- Public paths (health checks, webhooks) are excluded
- Failed authentication returns 401 with WWW-Authenticate header

**Excluded Paths:**
- `/api/health` - Health check endpoint
- `/api/webhook` - Webhook endpoints
- `/_next` - Next.js static assets
- `/favicon.ico` - Favicon
- `/robots.txt` - Robots file
- `/brand` - Brand assets

---

## Search Engine Blocking

### robots.txt

The robots.txt file blocks all search engine crawlers.

```
User-agent: *
Disallow: /
```

All major crawlers are explicitly blocked, including Googlebot, Bingbot, DuckDuckBot, and social media crawlers.

### X-Robots-Tag Header

Every response includes the X-Robots-Tag header.

```
X-Robots-Tag: noindex, nofollow, noarchive, nosnippet
```

This header is set by the middleware and applies to all routes.

### Meta Tags

HTML pages include noindex meta tags in the head section.

```html
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
<meta name="googlebot" content="noindex, nofollow" />
```

### Open Graph Disabled

Open Graph and Twitter Card meta tags are disabled to prevent link previews on social media platforms.

---

## Public Signup

### Disabled by Default

Public signup is disabled during Private Alpha. The `enable_public_signup` feature flag is set to `disabled` by default.

**Behavior:**
- Signup forms are hidden or disabled
- Direct API calls to signup endpoints are rejected
- Only Super Admin can create new users

### Enabling Signup (Future)

When ready for public access, update the feature flag.

```sql
UPDATE feature_flags 
SET default_status = 'enabled' 
WHERE flag_key = 'enable_public_signup';
```

---

## Super Admin System

### Invisible to Customers

The Super Admin concept is completely hidden from regular users.

**Hidden Elements:**
- No "Super Admin" label in UI
- No admin routes in navigation
- No admin-related API responses to non-admins

### Access Requirements

Super Admin access requires direct database entry.

```sql
INSERT INTO super_admins (user_id, notes)
VALUES ('user-uuid', 'Reason for access');
```

### Hidden Routes

Super Admin routes are not linked in the UI and use a separate route group.

| Route | Purpose |
|-------|---------|
| `/env-check` | Environment and health check |
| `/admin/tenants` | Tenant management (future) |
| `/admin/users` | User management (future) |
| `/admin/audit` | Audit log viewer (future) |

### Capabilities

Super Admins can perform the following actions.

| Capability | Description |
|------------|-------------|
| Manage Tenants | View, enable, disable tenants |
| Manage Users | View, enable, disable users |
| View Audit Logs | Access all system audit logs |
| Manage Feature Flags | Enable/disable features globally |
| View AI Usage | Access AI usage statistics |
| System Health | View environment and health status |

---

## Feature Flags

### Default States

All premium features are restricted to Super Admin only during Private Alpha.

| Flag | Default State |
|------|---------------|
| `enable_public_signup` | disabled |
| `enable_deep_intelligence` | super_admin_only |
| `enable_marketing_decision_engine` | super_admin_only |
| `enable_ad_creator` | super_admin_only |
| `enable_landing_builder` | super_admin_only |
| `enable_shipping_ops` | super_admin_only |
| `enable_finance_profit_engine` | super_admin_only |
| `enable_integrations` | super_admin_only |
| `enable_ai_calls` | super_admin_only |
| `enable_batch_ai_jobs` | super_admin_only |

### Evaluation Order

Feature flags are evaluated in the following order.

1. **User Override** - Highest priority, per-user settings
2. **Tenant Override** - Per-tenant settings
3. **Default Status** - Global default

---

## AI Protection

### Kill Switch

The `enable_ai_calls` flag acts as a master kill switch for all AI API calls.

**When Disabled:**
- All AI features return error messages
- No API calls are made to OpenAI
- Usage is logged as "killed"

### Rate Limits

Rate limits protect against excessive AI usage.

| Scope | Requests/Hour | Tokens/Hour | Cost/Hour |
|-------|---------------|-------------|-----------|
| Per User | 100 | 500,000 | $10 |
| Per Tenant | 500 | 2,000,000 | $50 |
| Global | 5,000 | 10,000,000 | $500 |
| Per Run | - | 100,000 | $5 |

### Usage Logging

All AI calls are logged with the following information.

| Field | Description |
|-------|-------------|
| `user_id` | User who triggered the call |
| `tenant_id` | Associated tenant |
| `feature_key` | Which feature made the call |
| `model` | AI model used |
| `prompt_tokens` | Input tokens |
| `completion_tokens` | Output tokens |
| `estimated_cost_usd` | Estimated cost |
| `run_status` | completed/failed/rate_limited/killed |

---

## Security Headers

The middleware adds the following security headers to all responses.

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | nosniff |
| `X-Frame-Options` | DENY |
| `X-XSS-Protection` | 1; mode=block |
| `Referrer-Policy` | strict-origin-when-cross-origin |
| `Content-Security-Policy` | Restrictive CSP policy |

---

## Audit Logging

All sensitive actions are logged to the `audit_logs` table.

**Logged Actions:**
- User enable/disable
- Tenant enable/disable
- Feature flag changes
- Super Admin grants/revokes
- Login attempts (future)

**Log Fields:**
- `action` - What happened
- `entity_type` - What was affected
- `entity_id` - ID of affected entity
- `user_id` - Who performed the action
- `old_values` - Previous state (JSON)
- `new_values` - New state (JSON)
- `ip_address` - Client IP
- `created_at` - Timestamp

---

## Checklist for Production

Before moving to production, verify the following.

| Item | Verified |
|------|----------|
| Basic Auth credentials are strong | ☐ |
| Basic Auth password is not committed to code | ☐ |
| All environment variables are in Vercel, not in code | ☐ |
| Supabase RLS policies are enabled | ☐ |
| Service role key is only used server-side | ☐ |
| robots.txt is blocking crawlers | ☐ |
| X-Robots-Tag header is present | ☐ |
| Super Admin is the only user with full access | ☐ |
| AI kill switch is tested | ☐ |
| Rate limits are configured | ☐ |

---

**Last Updated:** December 2024
