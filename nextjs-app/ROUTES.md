# DeepSolution Routes Documentation

## Overview

This document provides a comprehensive list of all routes in the DeepSolution Next.js application.

## Public Routes (No Auth Required)

| Route | Description | Status |
|-------|-------------|--------|
| `/` | Landing page / Homepage | ✅ Active |
| `/login` | User authentication page | ✅ Active |
| `/auth/callback` | OAuth callback handler | ✅ Active |

## Protected Routes (Auth Required)

### Dashboard & Operations

| Route | Description | Status |
|-------|-------------|--------|
| `/dashboard` | Main dashboard with stats and quick actions | ✅ Active |
| `/orders` | Order management | ✅ Active |
| `/products` | Product catalog management | ✅ Active |
| `/inventory` | Inventory tracking | ✅ Active |
| `/purchasing` | Purchase order management | ✅ Active |
| `/shipping` | Shipping and delivery tracking | ✅ Active |

### Marketing

| Route | Description | Status |
|-------|-------------|--------|
| `/campaigns` | Marketing campaigns | ✅ Active |
| `/landing-pages` | Landing page builder | ✅ Active |
| `/content-writer` | AI-powered content generation | ✅ Active |

### AI & Intelligence

| Route | Description | Status |
|-------|-------------|--------|
| `/ai-pipeline` | Deep Intelligence™ AI pipeline | ✅ Active |

### Finance

| Route | Description | Status |
|-------|-------------|--------|
| `/wallet` | Wallet and transactions | ✅ Active |
| `/profit` | Profit analytics | ✅ Active |

### Settings & Admin

| Route | Description | Status |
|-------|-------------|--------|
| `/audit-log` | Activity audit log | ✅ Active |
| `/integrations` | Third-party integrations | ✅ Active |
| `/payment-settings` | Payment configuration | ✅ Active |

### Super Admin (Restricted)

| Route | Description | Status |
|-------|-------------|--------|
| `/env-check` | Environment variables check | ✅ Active |

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/super-admin/check` | GET | Super admin status check |
| `/api/super-admin/env-check` | GET | Environment variables API |
| `/auth/callback` | GET | OAuth callback handler |

## Route Protection

- **Public routes**: No authentication required
- **Protected routes**: Require valid Supabase session
- **Super Admin routes**: Require super admin privileges

## Sidebar Navigation Structure

```
├── العمليات (Operations)
│   ├── لوحة التحكم (/dashboard)
│   ├── الطلبات (/orders)
│   ├── المنتجات (/products)
│   ├── المخزون (/inventory)
│   ├── المشتريات (/purchasing)
│   └── الشحن (/shipping)
├── التسويق (Marketing)
│   ├── الحملات (/campaigns)
│   ├── صفحات الهبوط (/landing-pages)
│   └── كاتب المحتوى (/content-writer)
├── الذكاء الاصطناعي (AI)
│   └── Deep Intelligence™ (/ai-pipeline)
├── المالية (Finance)
│   ├── المحفظة (/wallet)
│   └── تحليلات الربحية (/profit)
└── الإعدادات (Settings)
    ├── سجل المراجعة (/audit-log)
    ├── التكاملات (/integrations)
    └── إعدادات الدفع (/payment-settings)
```

## Last Updated

December 24, 2024
