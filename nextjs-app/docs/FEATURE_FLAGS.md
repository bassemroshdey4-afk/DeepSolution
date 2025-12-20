# Feature Flags System

**DeepSolution Platform**

This document describes the feature flags system used to control feature availability across the platform.

---

## Overview

The feature flags system provides granular control over feature availability at three levels: global, tenant, and user. This enables progressive rollouts, A/B testing, and access control.

---

## Flag Levels

### Global Flags

Global flags set the default behavior for all users and tenants.

**Table:** `feature_flags`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `flag_key` | VARCHAR(100) | Unique identifier |
| `name` | VARCHAR(255) | Human-readable name |
| `description` | TEXT | Flag description |
| `default_status` | ENUM | enabled/disabled/super_admin_only |
| `category` | VARCHAR(50) | Grouping category |
| `is_system` | BOOLEAN | System-managed flag |

### Tenant Flags

Tenant flags override global defaults for specific tenants.

**Table:** `tenant_feature_flags`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Reference to tenant |
| `flag_id` | UUID | Reference to flag |
| `status` | ENUM | enabled/disabled/super_admin_only |

### User Flags

User flags override both global and tenant settings for specific users.

**Table:** `user_feature_flags`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Reference to user |
| `flag_id` | UUID | Reference to flag |
| `status` | ENUM | enabled/disabled/super_admin_only |

---

## Evaluation Logic

Flags are evaluated in the following order, with higher priority overriding lower.

```
User Override > Tenant Override > Global Default
```

### Status Values

| Status | Behavior |
|--------|----------|
| `enabled` | Feature is available to all |
| `disabled` | Feature is not available |
| `super_admin_only` | Feature is available only to Super Admins |

### Evaluation Function

The database function `check_feature_flag` handles evaluation.

```sql
SELECT check_feature_flag('flag_key', user_id, tenant_id);
-- Returns: true or false
```

---

## Available Flags

### Authentication & Access

| Flag Key | Name | Default | Description |
|----------|------|---------|-------------|
| `enable_public_signup` | Public Signup | disabled | Allow new users to sign up |

### AI Features

| Flag Key | Name | Default | Description |
|----------|------|---------|-------------|
| `enable_deep_intelligence` | Deep Intelligence™ | super_admin_only | AI-powered product analytics |
| `enable_marketing_decision_engine` | Marketing Decision Engine | super_admin_only | AI marketing optimization |
| `enable_ad_creator` | Ad Creator | super_admin_only | AI ad creative generation |
| `enable_landing_builder` | Landing Page Builder | super_admin_only | AI landing page generation |

### Operations

| Flag Key | Name | Default | Description |
|----------|------|---------|-------------|
| `enable_shipping_ops` | Shipping Operations | super_admin_only | Advanced shipping management |
| `enable_finance_profit_engine` | Finance & Profit Engine | super_admin_only | Profit analytics |
| `enable_integrations` | Third-party Integrations | super_admin_only | External platform integrations |

### System

| Flag Key | Name | Default | Description |
|----------|------|---------|-------------|
| `enable_ai_calls` | AI API Calls | super_admin_only | Master switch for AI calls |
| `enable_batch_ai_jobs` | Batch AI Jobs | super_admin_only | Scheduled AI processing |

---

## Usage in Code

### Server-Side (TypeScript)

```typescript
import { checkFlag, FLAGS } from '@/lib/feature-flags';

// Check single flag
const isEnabled = await checkFlag(FLAGS.ENABLE_DEEP_INTELLIGENCE, {
  userId: user.id,
  tenantId: tenant.id,
});

if (!isEnabled) {
  throw new Error('Feature not available');
}

// Check multiple flags
import { checkFlags } from '@/lib/feature-flags';

const flags = await checkFlags([
  FLAGS.ENABLE_DEEP_INTELLIGENCE,
  FLAGS.ENABLE_AD_CREATOR,
], { userId: user.id });

if (flags[FLAGS.ENABLE_DEEP_INTELLIGENCE]) {
  // Show Deep Intelligence UI
}
```

### Client-Side (React)

```typescript
// In a React component
const { data: flags } = useFeatureFlags();

if (flags?.enable_deep_intelligence) {
  return <DeepIntelligencePanel />;
}

return <FeatureLockedMessage />;
```

### Database (SQL)

```sql
-- Check flag for specific user
SELECT check_feature_flag('enable_deep_intelligence', 'user-uuid', 'tenant-uuid');

-- Get all enabled flags for user
SELECT ff.flag_key
FROM feature_flags ff
WHERE check_feature_flag(ff.flag_key, 'user-uuid', 'tenant-uuid') = true;
```

---

## Managing Flags

### Enable Flag Globally

```sql
UPDATE feature_flags 
SET default_status = 'enabled', updated_at = NOW()
WHERE flag_key = 'enable_public_signup';
```

### Enable Flag for Tenant

```sql
INSERT INTO tenant_feature_flags (tenant_id, flag_id, status)
SELECT 'tenant-uuid', id, 'enabled'
FROM feature_flags WHERE flag_key = 'enable_deep_intelligence';
```

### Enable Flag for User

```sql
INSERT INTO user_feature_flags (user_id, flag_id, status)
SELECT 'user-uuid', id, 'enabled'
FROM feature_flags WHERE flag_key = 'enable_deep_intelligence';
```

### Disable Flag

```sql
-- Global
UPDATE feature_flags SET default_status = 'disabled' WHERE flag_key = 'flag_key';

-- Tenant
UPDATE tenant_feature_flags SET status = 'disabled' WHERE tenant_id = 'tenant-uuid' AND flag_id = 'flag-uuid';

-- User
UPDATE user_feature_flags SET status = 'disabled' WHERE user_id = 'user-uuid' AND flag_id = 'flag-uuid';
```

---

## Super Admin Override

Super Admins automatically have access to all `super_admin_only` features. The system checks the `super_admins` table to determine Super Admin status.

```sql
-- Check if user is Super Admin
SELECT is_super_admin('user-uuid');
-- Returns: true or false
```

---

## Caching

The feature flags system uses in-memory caching with a 5-minute TTL to reduce database queries.

**Cache Behavior:**
- Flags are cached on first access
- Cache refreshes every 5 minutes
- Manual refresh available via `refreshFlagsCache()`

**Note:** For immediate flag changes, either wait for cache expiry or restart the application.

---

## Adding New Flags

To add a new feature flag, insert into the `feature_flags` table.

```sql
INSERT INTO feature_flags (flag_key, name, description, default_status, category, is_system)
VALUES (
  'enable_new_feature',
  'New Feature',
  'Description of the new feature',
  'disabled',
  'category',
  false
);
```

Then add the flag key to the `FLAGS` constant in `src/lib/feature-flags.ts`.

```typescript
export const FLAGS = {
  // ... existing flags
  ENABLE_NEW_FEATURE: 'enable_new_feature',
} as const;
```

---

## Best Practices

### Naming Conventions

- Use `enable_` prefix for on/off features
- Use `show_` prefix for UI visibility flags
- Use `allow_` prefix for permission flags
- Use lowercase with underscores

### Default States

- New features should default to `disabled` or `super_admin_only`
- Only set `enabled` after thorough testing
- Document the reason for each default state

### Cleanup

- Remove flags after features are stable and fully rolled out
- Keep audit trail of flag changes
- Document flag lifecycle in comments

---

**Last Updated:** December 2024
