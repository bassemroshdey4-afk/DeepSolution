# DeepSolution Authentication Architecture

## Overview

DeepSolution uses **Supabase Auth** exclusively for authentication with **Google OAuth** as the primary login method. The system implements a **multi-tenant architecture** where each user belongs to one or more workspaces (tenants).

## Auth Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER AUTHENTICATION FLOW                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  /login  │────▶│  Google  │────▶│ Supabase │────▶│ /auth/   │────▶│ Decision │
│   Page   │     │  OAuth   │     │   Auth   │     │ callback │     │  Point   │
└──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
                                                                          │
                                                          ┌───────────────┴───────────────┐
                                                          │                               │
                                                          ▼                               ▼
                                                   ┌──────────────┐              ┌──────────────┐
                                                   │ New User?    │              │ Has Tenant?  │
                                                   │ No Profile   │              │ Yes          │
                                                   └──────────────┘              └──────────────┘
                                                          │                               │
                                                          ▼                               ▼
                                                   ┌──────────────┐              ┌──────────────┐
                                                   │ /onboarding  │              │ /dashboard   │
                                                   │ Create Tenant│              │ Main App     │
                                                   └──────────────┘              └──────────────┘
```

## Database Schema

### Tables

The multi-tenant auth system uses three core tables in Supabase.

**tenants** - Represents a workspace/company:

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Business name |
| domain | TEXT | Optional custom domain |
| logo_url | TEXT | Company logo |
| settings | JSONB | Business settings (country, currency, etc.) |
| subscription_status | TEXT | trial, active, suspended, cancelled |
| trial_ends_at | TIMESTAMPTZ | Trial expiration date |
| created_at | TIMESTAMPTZ | Creation timestamp |

**profiles** - User profiles linked to Supabase Auth:

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | FK to auth.users |
| email | TEXT | User email |
| full_name | TEXT | Display name |
| avatar_url | TEXT | Profile picture |
| default_tenant_id | UUID | FK to tenants |
| locale | TEXT | Preferred language |
| timezone | TEXT | User timezone |

**tenant_users** - Many-to-many relationship:

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| tenant_id | UUID | FK to tenants |
| user_id | UUID | FK to profiles |
| role | TEXT | owner, admin, member, viewer |
| invited_by | UUID | Who invited this user |
| joined_at | TIMESTAMPTZ | When user joined |

## Data Isolation

Every business entity table includes a `tenant_id` column for data isolation.

**Row Level Security (RLS)** is enabled on all tables with policies that ensure users can only access data belonging to their tenant(s).

Helper functions are provided in the database:

- `get_user_tenant_ids()` - Returns array of tenant IDs user belongs to
- `user_belongs_to_tenant(tenant_id)` - Checks if user has access to specific tenant

## User Roles

The system supports four roles within a tenant:

| Role | Permissions |
|------|-------------|
| **owner** | Full access, can delete tenant, manage billing |
| **admin** | Full access except billing and tenant deletion |
| **member** | Create/edit own content, view all tenant data |
| **viewer** | Read-only access to tenant data |

## Environment Variables

Required environment variables for authentication:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `NEXT_PUBLIC_SITE_URL` | Production domain (https://deepsolution.vercel.app) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin key (never expose to client) |

## Supabase Configuration

### URL Configuration (Authentication → URL Configuration)

| Setting | Value |
|---------|-------|
| Site URL | `https://deepsolution.vercel.app` |
| Redirect URLs | `https://deepsolution.vercel.app/auth/callback` |

### Google OAuth Provider (Authentication → Providers → Google)

1. Enable Google provider
2. Add Client ID from Google Cloud Console
3. Add Client Secret from Google Cloud Console
4. Authorized redirect URI in Google Cloud: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`

## Google OAuth Branding

For a professional appearance in the Google consent screen:

1. Go to Google Cloud Console → APIs & Services → OAuth consent screen
2. Set Application name: **DeepSolution**
3. Upload application logo (minimum 120x120px)
4. Add authorized domains: `deepsolution.vercel.app`, `supabase.co`
5. Set support email and developer contact

## Files Structure

```
nextjs-app/src/
├── app/
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts      # OAuth callback handler
│   ├── login/
│   │   └── page.tsx          # Login page with Google button
│   └── onboarding/
│       └── page.tsx          # New user onboarding
├── contexts/
│   ├── AuthContext.tsx       # Auth state management
│   └── TenantContext.tsx     # Tenant state management
├── lib/
│   ├── supabase.ts           # Client-side Supabase client
│   ├── supabase-server.ts    # Server-side Supabase client
│   └── api-utils.ts          # API utilities with tenant isolation
└── sql/
    └── 03_multi_tenant_auth.sql  # Schema and RLS policies
```

## Verification Checklist

Before going live, verify the following:

- [ ] Supabase project created and URL/keys configured
- [ ] Google OAuth provider enabled in Supabase
- [ ] Google Cloud OAuth consent screen configured with "DeepSolution" branding
- [ ] Redirect URLs added in both Supabase and Google Cloud
- [ ] SQL schema executed in Supabase (03_multi_tenant_auth.sql)
- [ ] Environment variables set in Vercel
- [ ] Test: New user login → redirects to /onboarding
- [ ] Test: Existing user login → redirects to /dashboard
- [ ] Test: User can only see their own tenant's data
- [ ] Test: RLS policies prevent cross-tenant data access

## Security Notes

1. **Never expose** `SUPABASE_SERVICE_ROLE_KEY` to the client
2. **Always use** RLS policies for data access control
3. **Validate** tenant membership on every API request
4. **Log** authentication events for audit trail
5. **Implement** rate limiting on auth endpoints

---

*Last updated: January 25, 2026*
*Author: DeepSolution Engineering Team*
