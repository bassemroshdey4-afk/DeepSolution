# DeepSolution Architecture Ownership

## Executive Summary

This document establishes the architectural ownership and control boundaries for the DeepSolution e-commerce management platform. The system is designed to be **fully operable without AI assistance**, with all components using standard, widely-adopted technologies that any qualified engineer can maintain, extend, or replace.

---

## Stack Overview

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| **Frontend** | React 19 + Vite | 19.x / 7.x | Industry standard, large ecosystem, excellent DX |
| **Future Frontend** | Next.js App Router | 14.x+ | SSR/SSG capabilities, better SEO, incremental adoption |
| **Backend** | Express + tRPC | 4.x / 11.x | Type-safe API layer, minimal boilerplate, full TypeScript |
| **Database** | Supabase (PostgreSQL) | Latest | Open-source, self-hostable, real-time capabilities |
| **Automation** | n8n | Self-hosted | Open-source workflow automation, visual editor |
| **Auth** | JWT + OAuth 2.0 | Standard | Portable, replaceable with any OAuth provider |
| **Styling** | Tailwind CSS 4 | 4.x | Utility-first, no vendor lock-in |
| **Testing** | Vitest | 2.x | Fast, Vite-native, Jest-compatible |

---

## Directory Structure

```
deepsolution/
├── client/                 # React frontend (current)
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page-level components
│   │   ├── contexts/       # React contexts
│   │   ├── hooks/          # Custom hooks
│   │   └── lib/            # Utilities (trpc client)
│   └── public/             # Static assets
├── server/                 # Express + tRPC backend
│   ├── _core/              # Framework internals (auth, context, env)
│   ├── *.ts                # Feature routers
│   └── *.test.ts           # Unit tests
├── docs/                   # Documentation
├── n8n-workflows/          # Exported n8n workflow JSONs
├── scripts/                # Utility scripts
└── supabase/               # Database migrations
```

---

## AI vs Core System Boundaries

### What AI Does (Optional Enhancement)

AI features are **add-ons** that enhance the platform but are not required for core functionality.

| Feature | AI Role | Fallback Without AI |
|---------|---------|---------------------|
| Content Writer | Generate product descriptions | Manual input by user |
| Smart Routing | Recommend optimal carrier | User selects carrier manually |
| Price Optimization | Suggest pricing | User sets prices manually |
| Demand Forecasting | Predict inventory needs | User monitors stock manually |
| Customer Insights | Analyze behavior patterns | Standard analytics dashboards |

### What Core System Does (Always Works)

These features operate independently of any AI service.

| Feature | Implementation | Dependencies |
|---------|----------------|--------------|
| Order Management | tRPC procedures + Supabase | PostgreSQL only |
| Inventory Tracking | Stock movements table | PostgreSQL only |
| Shipping Integration | Carrier APIs + n8n | External carrier APIs |
| Wallet & Billing | Transaction ledger | PostgreSQL only |
| User Authentication | JWT + OAuth | Any OAuth provider |
| Profit Calculation | SQL aggregations | PostgreSQL only |
| Audit Logging | Event sourcing pattern | PostgreSQL only |

---

## Operability Without AI

### Verification Checklist

The following confirms the system operates without AI dependencies:

| Component | AI Required? | Verification |
|-----------|--------------|--------------|
| User login/logout | No | OAuth flow works with any provider |
| Create/edit products | No | CRUD operations via tRPC |
| Process orders | No | Order state machine in PostgreSQL |
| Track inventory | No | Stock movements table |
| Generate invoices | No | Template-based PDF generation |
| Shipping tracking | No | Carrier API webhooks |
| Financial reports | No | SQL queries on transaction tables |
| Multi-tenant isolation | No | Row-level security in Supabase |

### Disabling AI Features

To disable all AI features, set the following environment variable:

```bash
AI_FEATURES_ENABLED=false
```

The system will:
1. Hide AI-related menu items
2. Skip AI processing in workflows
3. Use fallback values for AI-generated content
4. Continue all core operations normally

---

## Data Ownership

### Where Data Lives

| Data Type | Storage | Access Method | Export Format |
|-----------|---------|---------------|---------------|
| User accounts | Supabase `users` table | SQL / tRPC | JSON, CSV |
| Products | Supabase `products` table | SQL / tRPC | JSON, CSV |
| Orders | Supabase `orders` table | SQL / tRPC | JSON, CSV |
| Transactions | Supabase `wallet_transactions` | SQL / tRPC | JSON, CSV |
| Files/Images | S3-compatible storage | Presigned URLs | Direct download |
| Audit logs | Supabase `audit_logs` table | SQL / tRPC | JSON, CSV |

### Data Export

All data can be exported via:
1. **Supabase Dashboard**: Direct SQL queries and CSV export
2. **tRPC Endpoints**: Programmatic access with pagination
3. **pg_dump**: Full PostgreSQL backup

### Data Portability

The system uses standard PostgreSQL schemas. To migrate to another platform:
1. Export via `pg_dump`
2. Import to any PostgreSQL-compatible database
3. Update `DATABASE_URL` environment variable
4. Restart services

---

## Authentication Architecture

### Current Implementation

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│  OAuth Flow  │────▶│  JWT Token  │
│   (React)   │     │  (Standard)  │     │  (Cookie)   │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Any OAuth   │
                    │   Provider   │
                    └──────────────┘
```

### Replacing OAuth Provider

The OAuth implementation is provider-agnostic. To switch providers:

1. Update `OAUTH_SERVER_URL` to new provider
2. Update `VITE_OAUTH_PORTAL_URL` for login redirect
3. Ensure new provider returns standard claims (sub, email, name)
4. No code changes required

### Self-Hosted Auth Option

For complete independence, implement local auth:
1. Add password hashing (bcrypt)
2. Create login/register endpoints
3. Issue JWT tokens directly
4. Remove OAuth dependency entirely

---

## API Architecture

### tRPC Router Structure

```
appRouter
├── auth          # Authentication (login, logout, me)
├── onboarding    # Tenant creation
├── products      # Product CRUD
├── orders        # Order management
├── inventory     # Stock tracking
├── shipping      # Shipment management
├── wallet        # Financial transactions
├── profit        # P&L calculations
├── auditLog      # Audit trail
├── n8nWorkflows  # Automation endpoints
├── aiAddons      # AI features (optional)
└── superAdmin    # Platform administration
```

### API Documentation

All endpoints are self-documenting via TypeScript types. To generate OpenAPI spec:

```bash
# Install trpc-openapi
pnpm add trpc-openapi

# Generate spec
pnpm run generate:openapi
```

---

## Database Schema Ownership

### Core Tables (Required)

| Table | Purpose | Owner |
|-------|---------|-------|
| `users` | User accounts | Core system |
| `tenants` | Multi-tenant isolation | Core system |
| `products` | Product catalog | Core system |
| `orders` | Order records | Core system |
| `order_items` | Order line items | Core system |
| `shipments` | Shipping records | Core system |
| `wallet_transactions` | Financial ledger | Core system |
| `stock_movements` | Inventory changes | Core system |
| `audit_logs` | Event history | Core system |

### AI Tables (Optional)

| Table | Purpose | Can Be Dropped? |
|-------|---------|-----------------|
| `ai_usage_logs` | AI consumption tracking | Yes |
| `ai_addons` | AI feature definitions | Yes |
| `tenant_ai_subscriptions` | AI billing | Yes |
| `generated_content` | AI outputs | Yes |

---

## Deployment Independence

### Self-Hosting Requirements

| Component | Minimum Requirement | Recommended |
|-----------|---------------------|-------------|
| Node.js | 18.x | 20.x LTS |
| PostgreSQL | 14.x | 15.x+ |
| RAM | 2 GB | 4 GB+ |
| Storage | 20 GB | 100 GB+ |
| n8n | Self-hosted | Docker |

### Deployment Options

1. **VPS (DigitalOcean, Linode, Hetzner)**
   - Full control
   - Lowest cost
   - Manual maintenance

2. **Container Platform (Railway, Render)**
   - Managed infrastructure
   - Easy scaling
   - Moderate cost

3. **Kubernetes**
   - Enterprise scale
   - Complex setup
   - Full control

### Environment Variables

All configuration is via environment variables, no hardcoded values:

```bash
# Database
DATABASE_URL=postgresql://...

# Auth
JWT_SECRET=your-secret-key
OAUTH_SERVER_URL=https://your-oauth-provider

# Storage
S3_BUCKET=your-bucket
S3_REGION=your-region
S3_ACCESS_KEY=...
S3_SECRET_KEY=...

# Optional: AI
AI_FEATURES_ENABLED=true
OPENAI_API_KEY=... # Only if AI enabled
```

---

## Maintenance Without AI

### Common Operations

| Task | Command/Action | AI Required? |
|------|----------------|--------------|
| Deploy update | `git pull && pnpm build && pm2 restart` | No |
| Database backup | `pg_dump $DATABASE_URL > backup.sql` | No |
| Add new feature | Edit routers, run migrations | No |
| Fix bug | Edit code, run tests, deploy | No |
| Scale horizontally | Add more instances behind load balancer | No |
| Monitor health | Check `/api/health` endpoint | No |

### Troubleshooting Guide

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| 500 errors | Database connection | Check `DATABASE_URL` |
| Auth failures | JWT secret mismatch | Verify `JWT_SECRET` |
| Missing data | Migration not run | Run `pnpm db:push` |
| Slow queries | Missing indexes | Add database indexes |
| File upload fails | S3 credentials | Check S3 env vars |

---

## Conclusion

DeepSolution is architected for **complete ownership and control**. Every component uses standard, open-source technologies with clear documentation. The system operates fully without AI assistance, with AI features serving as optional enhancements rather than core dependencies.

Any qualified full-stack engineer can:
- Understand the codebase within days
- Make modifications without special tools
- Deploy to any infrastructure
- Migrate data to alternative platforms
- Remove or replace any component

**This is your system. You own it completely.**
