# Module Breakdown - DeepSolution

## Module Architecture

```
/server
  /modules
    /tenants      # Tenant management
    /auth         # Authentication
    /products     # Product catalog
    /orders       # Order management
    /inventory    # Stock tracking
    /shipping     # Shipping integration
    /campaigns    # Marketing campaigns
    /accounting   # Financial reports
    /ai           # AI services
    /notifications # Alerts & notifications
```

---

## 1. Tenants Module

### Purpose
Manage tenant lifecycle: creation, settings, suspension.

### Database Tables
- `tenants`
- `api_usage`

### Functions

| Function | Input | Output | Logic |
|----------|-------|--------|-------|
| `createTenant` | `{subdomain, name, ownerEmail, ownerPassword}` | `{tenant, user}` | 1. Validate subdomain uniqueness. 2. Create tenant record. 3. Create owner user with role='owner'. 4. Initialize api_usage for current month. 5. Return both. |
| `getTenant` | `{tenantId}` | `tenant` | Fetch tenant by ID with settings. |
| `updateTenantSettings` | `{tenantId, settings}` | `tenant` | Merge new settings into existing JSONB. |
| `checkSubdomainAvailable` | `{subdomain}` | `boolean` | Query tenants table for subdomain. |
| `suspendTenant` | `{tenantId, reason}` | `void` | Set status='suspended'. Log activity. |
| `getUsageStats` | `{tenantId, month}` | `api_usage` | Return current month usage vs limits. |

### API Endpoints

| Method | Path | Auth | Function |
|--------|------|------|----------|
| POST | `/api/tenants` | Public | createTenant |
| GET | `/api/tenants/check-subdomain` | Public | checkSubdomainAvailable |
| GET | `/api/tenants/me` | Protected | getTenant (from JWT) |
| PATCH | `/api/tenants/me/settings` | Protected | updateTenantSettings |
| GET | `/api/tenants/me/usage` | Protected | getUsageStats |

---

## 2. Auth Module

### Purpose
Handle user authentication, sessions, password management.

### Database Tables
- `users`

### Functions

| Function | Input | Output | Logic |
|----------|-------|--------|-------|
| `login` | `{email, password}` | `{token, user}` | 1. Find user by email. 2. Verify password hash. 3. Generate JWT with user_id, tenant_id, role. 4. Update last_login_at. 5. Return token. |
| `register` | `{tenantId, email, password, name}` | `user` | 1. Check email uniqueness within tenant. 2. Hash password. 3. Create user with role='member'. 4. Return user. |
| `logout` | `{token}` | `void` | Invalidate token (if using blacklist) or no-op for stateless JWT. |
| `forgotPassword` | `{email}` | `void` | 1. Find user. 2. Generate reset token. 3. Send email with reset link. |
| `resetPassword` | `{token, newPassword}` | `void` | 1. Validate reset token. 2. Hash new password. 3. Update user. |
| `changePassword` | `{userId, oldPassword, newPassword}` | `void` | 1. Verify old password. 2. Hash new password. 3. Update user. |
| `getCurrentUser` | `{userId}` | `user` | Fetch user by ID. |

### JWT Payload Structure

```json
{
  "sub": "user_uuid",
  "tenant_id": "tenant_uuid",
  "role": "owner|admin|member",
  "email": "user@example.com",
  "iat": 1702648800,
  "exp": 1702735200
}
```

### API Endpoints

| Method | Path | Auth | Function |
|--------|------|------|----------|
| POST | `/api/auth/login` | Public | login |
| POST | `/api/auth/register` | Protected (owner/admin) | register |
| POST | `/api/auth/logout` | Protected | logout |
| POST | `/api/auth/forgot-password` | Public | forgotPassword |
| POST | `/api/auth/reset-password` | Public | resetPassword |
| POST | `/api/auth/change-password` | Protected | changePassword |
| GET | `/api/auth/me` | Protected | getCurrentUser |

---

## 3. Products Module

### Purpose
Manage product catalog: CRUD, stock levels, categories.

### Database Tables
- `products`
- `inventory_logs`

### Functions

| Function | Input | Output | Logic |
|----------|-------|--------|-------|
| `createProduct` | `{tenantId, name, sellingPrice, ...}` | `product` | 1. Generate SKU if not provided. 2. Insert product. 3. Log activity. |
| `updateProduct` | `{productId, updates}` | `product` | 1. Validate productId belongs to tenant. 2. Update fields. 3. Log activity. |
| `deleteProduct` | `{productId}` | `void` | 1. Check no active orders reference this product. 2. Set status='archived' (soft delete). |
| `getProduct` | `{productId}` | `product` | Fetch single product. |
| `listProducts` | `{tenantId, status?, search?, page, limit}` | `{products, total}` | Paginated list with filters. |
| `adjustStock` | `{productId, change, reason, referenceId?}` | `product` | 1. Get current stock. 2. Calculate new stock. 3. Update product. 4. Insert inventory_log. |
| `getLowStockProducts` | `{tenantId}` | `products[]` | WHERE stock_quantity <= low_stock_threshold. |
| `getProductStockHistory` | `{productId, page, limit}` | `inventory_logs[]` | Paginated inventory_logs for product. |

### Stock Adjustment Types

| Type | Trigger | Change |
|------|---------|--------|
| `order_confirmed` | Order call_status → confirmed | Negative |
| `order_cancelled` | Order status → cancelled | Positive (restore) |
| `manual_adjustment` | Admin action | +/- |
| `restock` | Inventory receipt | Positive |
| `return` | Order returned | Positive |

### API Endpoints

| Method | Path | Auth | Function |
|--------|------|------|----------|
| POST | `/api/products` | Protected | createProduct |
| GET | `/api/products` | Protected | listProducts |
| GET | `/api/products/:id` | Protected | getProduct |
| PATCH | `/api/products/:id` | Protected | updateProduct |
| DELETE | `/api/products/:id` | Protected | deleteProduct |
| POST | `/api/products/:id/adjust-stock` | Protected | adjustStock |
| GET | `/api/products/:id/stock-history` | Protected | getProductStockHistory |
| GET | `/api/products/low-stock` | Protected | getLowStockProducts |

---

## 4. Orders Module

### Purpose
Handle order lifecycle: creation, status updates, call center workflow.

### Database Tables
- `orders`
- `activity_logs`

### Functions

| Function | Input | Output | Logic |
|----------|-------|--------|-------|
| `createOrder` | `{tenantId, customerName, customerPhone, items, ...}` | `order` | 1. Generate order_number (format: #YYMMDD-XXX). 2. Calculate subtotal, total. 3. Insert order. 4. Log activity. |
| `updateOrderStatus` | `{orderId, status}` | `order` | 1. Validate status transition. 2. Update status. 3. If shipped: set shipped_at. 4. If delivered: set delivered_at. 5. Log activity. 6. Trigger notification. |
| `updateCallStatus` | `{orderId, callStatus}` | `order` | 1. Update call_status. 2. If confirmed: trigger stock deduction. 3. Log activity. |
| `getOrder` | `{orderId}` | `order` | Fetch order with all details. |
| `listOrders` | `{tenantId, status?, callStatus?, dateFrom?, dateTo?, search?, page, limit}` | `{orders, total}` | Paginated list with filters. |
| `assignToCampaign` | `{orderId, campaignId}` | `order` | 1. Update campaign_id. 2. Trigger campaign metrics update. |
| `cancelOrder` | `{orderId, reason}` | `order` | 1. Set status='cancelled'. 2. If was confirmed: restore stock. 3. Log activity. |
| `getOrderStats` | `{tenantId, dateFrom, dateTo}` | `stats` | Aggregate: total orders, revenue, by status, by call_status. |

### Order Status Flow

```
new → confirmed → processing → shipped → delivered
  ↓                              ↓
cancelled                     returned
```

### Call Status Flow

```
pending → called → confirmed
            ↓         ↓
        no_answer   rejected
            ↓
         callback → called → ...
```

### Order Number Generation

```
Format: #YYMMDD-XXX
Example: #241215-001, #241215-002, ...

Logic:
1. Get current date as YYMMDD
2. Count orders for tenant today
3. Increment by 1
4. Pad to 3 digits
```

### API Endpoints

| Method | Path | Auth | Function |
|--------|------|------|----------|
| POST | `/api/orders` | Protected | createOrder |
| GET | `/api/orders` | Protected | listOrders |
| GET | `/api/orders/:id` | Protected | getOrder |
| PATCH | `/api/orders/:id/status` | Protected | updateOrderStatus |
| PATCH | `/api/orders/:id/call-status` | Protected | updateCallStatus |
| POST | `/api/orders/:id/cancel` | Protected | cancelOrder |
| POST | `/api/orders/:id/assign-campaign` | Protected | assignToCampaign |
| GET | `/api/orders/stats` | Protected | getOrderStats |

---

## 5. Inventory Module

### Purpose
Track stock levels, alerts, adjustments.

### Database Tables
- `products` (stock_quantity, low_stock_threshold)
- `inventory_logs`

### Functions

| Function | Input | Output | Logic |
|----------|-------|--------|-------|
| `getInventorySummary` | `{tenantId}` | `summary` | Total products, total stock value, low stock count, out of stock count. |
| `getInventoryReport` | `{tenantId, dateFrom, dateTo}` | `report` | Stock movements by type, top movers, slow movers. |
| `bulkAdjustStock` | `{adjustments: [{productId, change, reason}]}` | `results[]` | Loop through adjustments, apply each. |
| `setLowStockThreshold` | `{productId, threshold}` | `product` | Update low_stock_threshold. |

### Inventory Summary Response

```json
{
  "total_products": 150,
  "total_stock_units": 5430,
  "total_stock_value": 543000,
  "low_stock_count": 12,
  "out_of_stock_count": 3,
  "low_stock_products": [
    {"id": "uuid", "name": "Product A", "stock": 3, "threshold": 5}
  ]
}
```

### API Endpoints

| Method | Path | Auth | Function |
|--------|------|------|----------|
| GET | `/api/inventory/summary` | Protected | getInventorySummary |
| GET | `/api/inventory/report` | Protected | getInventoryReport |
| POST | `/api/inventory/bulk-adjust` | Protected | bulkAdjustStock |
| PATCH | `/api/products/:id/low-stock-threshold` | Protected | setLowStockThreshold |

---

## 6. Shipping Module

### Purpose
Manage shipping providers, create shipments, track deliveries.

### Database Tables
- `shipping_providers`
- `orders` (shipping fields)

### Functions

| Function | Input | Output | Logic |
|----------|-------|--------|-------|
| `addShippingProvider` | `{tenantId, name, code, apiKey, ...}` | `provider` | 1. Encrypt API credentials. 2. Insert provider. |
| `updateShippingProvider` | `{providerId, updates}` | `provider` | Update provider settings. |
| `deleteShippingProvider` | `{providerId}` | `void` | Soft delete or remove if no orders use it. |
| `listShippingProviders` | `{tenantId}` | `providers[]` | List all providers for tenant. |
| `createShipment` | `{orderId, providerId}` | `shipment` | 1. Get order details. 2. Call provider API. 3. Get tracking number. 4. Update order with tracking_number, shipping_provider. 5. Set status='shipped'. |
| `getTrackingInfo` | `{orderId}` | `tracking` | 1. Get order. 2. Call provider API for status. 3. Return tracking events. |
| `calculateShippingCost` | `{providerId, weight, destination}` | `cost` | Use provider's pricing formula. |

### Supported Providers (Phase 2)

| Provider | API | Features |
|----------|-----|----------|
| SMSA | REST | Create shipment, track, cancel |
| Aramex | REST | Create shipment, track, rates |
| DHL | REST | Create shipment, track |
| Manual | None | Manual tracking number entry |

### API Endpoints

| Method | Path | Auth | Function |
|--------|------|------|----------|
| POST | `/api/shipping/providers` | Protected (owner) | addShippingProvider |
| GET | `/api/shipping/providers` | Protected | listShippingProviders |
| PATCH | `/api/shipping/providers/:id` | Protected (owner) | updateShippingProvider |
| DELETE | `/api/shipping/providers/:id` | Protected (owner) | deleteShippingProvider |
| POST | `/api/orders/:id/ship` | Protected | createShipment |
| GET | `/api/orders/:id/tracking` | Protected | getTrackingInfo |
| POST | `/api/shipping/calculate` | Protected | calculateShippingCost |

---

## 7. Campaigns Module

### Purpose
Track marketing campaigns, calculate ROAS, attribute orders.

### Database Tables
- `campaigns`
- `orders` (campaign_id, utm_*)

### Functions

| Function | Input | Output | Logic |
|----------|-------|--------|-------|
| `createCampaign` | `{tenantId, name, platform, budget, ...}` | `campaign` | 1. Generate UTM parameters. 2. Insert campaign. |
| `updateCampaign` | `{campaignId, updates}` | `campaign` | Update campaign fields. Recalculate ROAS if budget changed. |
| `deleteCampaign` | `{campaignId}` | `void` | Soft delete. Keep for historical data. |
| `getCampaign` | `{campaignId}` | `campaign` | Fetch with calculated metrics. |
| `listCampaigns` | `{tenantId, status?, platform?, page, limit}` | `{campaigns, total}` | Paginated list with metrics. |
| `updateSpent` | `{campaignId, amount}` | `campaign` | Add to budget_spent. Recalculate ROAS. |
| `getCampaignOrders` | `{campaignId, page, limit}` | `{orders, total}` | Orders attributed to this campaign. |
| `attributeOrderToCampaign` | `{orderId, utmCampaign}` | `order` | 1. Find campaign by utm_campaign. 2. Update order.campaign_id. |

### ROAS Calculation

```
ROAS = Total Revenue from Campaign Orders / Budget Spent

Example:
- Budget Spent: 1000 SAR
- Orders: 25 (total revenue: 5000 SAR)
- ROAS = 5000 / 1000 = 5.0

Interpretation: Every 1 SAR spent returns 5 SAR in revenue.
```

### UTM Parameter Matching

```
Order comes with: ?utm_source=facebook&utm_medium=cpc&utm_campaign=winter_sale

1. Extract utm_campaign = "winter_sale"
2. Find campaign WHERE utm_campaign = "winter_sale" AND tenant_id = X
3. If found: set order.campaign_id = campaign.id
4. Campaign metrics auto-update via trigger
```

### API Endpoints

| Method | Path | Auth | Function |
|--------|------|------|----------|
| POST | `/api/campaigns` | Protected | createCampaign |
| GET | `/api/campaigns` | Protected | listCampaigns |
| GET | `/api/campaigns/:id` | Protected | getCampaign |
| PATCH | `/api/campaigns/:id` | Protected | updateCampaign |
| DELETE | `/api/campaigns/:id` | Protected | deleteCampaign |
| POST | `/api/campaigns/:id/update-spent` | Protected | updateSpent |
| GET | `/api/campaigns/:id/orders` | Protected | getCampaignOrders |

---

## 8. Accounting Module

### Purpose
Financial reporting, profit calculation, revenue tracking.

### Database Tables
- `orders` (for revenue)
- `products` (for cost)
- `campaigns` (for ad spend)

### Functions

| Function | Input | Output | Logic |
|----------|-------|--------|-------|
| `getRevenueReport` | `{tenantId, dateFrom, dateTo, groupBy}` | `report` | Sum order totals grouped by day/week/month. |
| `getProfitReport` | `{tenantId, dateFrom, dateTo}` | `report` | Revenue - COGS - Shipping - Ad Spend. |
| `getCOGS` | `{tenantId, dateFrom, dateTo}` | `cogs` | Sum(order_items.quantity * product.cost_price). |
| `getAdSpend` | `{tenantId, dateFrom, dateTo}` | `spend` | Sum(campaigns.budget_spent). |
| `getOrderValueMetrics` | `{tenantId, dateFrom, dateTo}` | `metrics` | AOV, median order value, order count. |
| `getProductProfitability` | `{tenantId, dateFrom, dateTo}` | `products[]` | Revenue, COGS, profit per product. |

### Profit Calculation

```
Gross Revenue = Sum of all order totals (excluding cancelled/returned)
COGS = Sum of (quantity × cost_price) for all order items
Shipping Costs = Sum of shipping_cost from orders
Ad Spend = Sum of budget_spent from campaigns

Gross Profit = Gross Revenue - COGS
Net Profit = Gross Profit - Shipping Costs - Ad Spend
Profit Margin = (Net Profit / Gross Revenue) × 100
```

### Report Response Structure

```json
{
  "period": {
    "from": "2025-12-01",
    "to": "2025-12-15"
  },
  "revenue": {
    "gross": 150000,
    "net": 135000,
    "refunds": 5000
  },
  "costs": {
    "cogs": 60000,
    "shipping": 15000,
    "ad_spend": 20000,
    "total": 95000
  },
  "profit": {
    "gross": 90000,
    "net": 55000,
    "margin": 36.67
  },
  "orders": {
    "total": 245,
    "completed": 220,
    "cancelled": 15,
    "returned": 10
  },
  "aov": 612
}
```

### API Endpoints

| Method | Path | Auth | Function |
|--------|------|------|----------|
| GET | `/api/accounting/revenue` | Protected | getRevenueReport |
| GET | `/api/accounting/profit` | Protected | getProfitReport |
| GET | `/api/accounting/cogs` | Protected | getCOGS |
| GET | `/api/accounting/ad-spend` | Protected | getAdSpend |
| GET | `/api/accounting/order-metrics` | Protected | getOrderValueMetrics |
| GET | `/api/accounting/product-profitability` | Protected | getProductProfitability |

---

## 9. AI Module

### Purpose
AI-powered features: landing page generation, assistant, analytics.

### Database Tables
- `landing_pages`
- `ai_conversations`
- `api_usage`

### Sub-modules

#### 9.1 AI Router

Determines which OpenAI model to use based on task.

| Task | Model | Max Tokens | Temperature |
|------|-------|------------|-------------|
| Landing page generation | gpt-4o | 2000 | 0.8 |
| Image analysis | gpt-4o (vision) | 1000 | 0.3 |
| Simple Q&A | gpt-4o-mini | 500 | 0.5 |
| Complex analytics | gpt-4o | 1500 | 0.3 |
| Conversation summary | gpt-4o-mini | 500 | 0.3 |

#### 9.2 Landing Page Generator

| Function | Input | Output | Logic |
|----------|-------|--------|-------|
| `generateLandingPage` | `{productId, imageUrl?, customPrompt?}` | `landingPage` | 1. Check usage limits. 2. Fetch product data. 3. If imageUrl: analyze with vision. 4. Build prompt. 5. Call GPT-4o. 6. Parse response. 7. Save to landing_pages. 8. Update api_usage. |
| `regenerateLandingPage` | `{landingPageId, feedback}` | `landingPage` | 1. Get existing content. 2. Build prompt with feedback. 3. Regenerate. 4. Update record. |
| `publishLandingPage` | `{landingPageId}` | `landingPage` | Set status='published', set published_at. |
| `getLandingPage` | `{landingPageId}` | `landingPage` | Fetch by ID. |
| `getLandingPageBySlug` | `{tenantSubdomain, slug}` | `landingPage` | Public access for viewing. Increment view_count. |

#### 9.3 AI Assistant

| Function | Input | Output | Logic |
|----------|-------|--------|-------|
| `sendMessage` | `{conversationId?, message}` | `{response, conversationId}` | 1. Get or create conversation. 2. Load context. 3. Build messages array. 4. Route to appropriate model. 5. Call OpenAI. 6. Save response. 7. Update tokens. |
| `getConversation` | `{conversationId}` | `conversation` | Fetch with messages. |
| `listConversations` | `{tenantId, userId, page, limit}` | `{conversations, total}` | Paginated list. |
| `archiveConversation` | `{conversationId}` | `void` | Set status='archived'. |
| `buildContext` | `{tenantId}` | `context` | Query DB for: order stats, product stats, campaign stats. Cache for 1 hour. |

### Context Building Query

```sql
SELECT 
  (SELECT COUNT(*) FROM orders WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '30 days') as orders_month,
  (SELECT COALESCE(SUM(total), 0) FROM orders WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '30 days' AND status NOT IN ('cancelled', 'returned')) as revenue_month,
  (SELECT COUNT(*) FROM products WHERE tenant_id = $1 AND status = 'active') as active_products,
  (SELECT COUNT(*) FROM campaigns WHERE tenant_id = $1 AND status = 'active') as active_campaigns;
```

### API Endpoints

| Method | Path | Auth | Function |
|--------|------|------|----------|
| POST | `/api/ai/landing-pages/generate` | Protected | generateLandingPage |
| POST | `/api/ai/landing-pages/:id/regenerate` | Protected | regenerateLandingPage |
| POST | `/api/ai/landing-pages/:id/publish` | Protected | publishLandingPage |
| GET | `/api/ai/landing-pages/:id` | Protected | getLandingPage |
| GET | `/p/:slug` | Public | getLandingPageBySlug |
| POST | `/api/ai/assistant/message` | Protected | sendMessage |
| GET | `/api/ai/assistant/conversations` | Protected | listConversations |
| GET | `/api/ai/assistant/conversations/:id` | Protected | getConversation |
| DELETE | `/api/ai/assistant/conversations/:id` | Protected | archiveConversation |

---

## 10. Notifications Module

### Purpose
Send and manage notifications across channels.

### Database Tables
- `notifications`

### Functions

| Function | Input | Output | Logic |
|----------|-------|--------|-------|
| `createNotification` | `{tenantId, userId?, type, title, body, data}` | `notification` | Insert notification. If userId null, notify all tenant users. |
| `markAsRead` | `{notificationId}` | `void` | Set is_read=true, read_at=NOW(). |
| `markAllAsRead` | `{userId}` | `void` | Update all unread for user. |
| `getUnreadCount` | `{userId}` | `count` | COUNT WHERE is_read=false. |
| `listNotifications` | `{userId, page, limit}` | `{notifications, total}` | Paginated list, newest first. |
| `sendWhatsAppNotification` | `{phone, template, data}` | `result` | Call WhatsApp Business API. |
| `sendEmailNotification` | `{email, subject, body}` | `result` | Call email service (Resend/SendGrid). |

### Notification Types

| Type | Trigger | Channels |
|------|---------|----------|
| `new_order` | Order created | In-app, WhatsApp (optional) |
| `order_status_changed` | Order status updated | In-app, WhatsApp to customer |
| `low_stock` | Stock below threshold | In-app, Email |
| `campaign_ended` | Campaign end_date passed | In-app |
| `usage_limit_warning` | 80% of limit reached | In-app, Email |
| `usage_limit_reached` | 100% of limit reached | In-app, Email |

### API Endpoints

| Method | Path | Auth | Function |
|--------|------|------|----------|
| GET | `/api/notifications` | Protected | listNotifications |
| GET | `/api/notifications/unread-count` | Protected | getUnreadCount |
| POST | `/api/notifications/:id/read` | Protected | markAsRead |
| POST | `/api/notifications/read-all` | Protected | markAllAsRead |

---

## Module Dependencies

```
tenants ← auth ← [all other modules]
                    ↓
products ← orders ← campaigns
    ↓         ↓
inventory  shipping
    ↓         ↓
    └────→ accounting ←────┘
              ↓
             ai ← notifications
```

---

## Shared Utilities

### Pagination

```typescript
interface PaginationParams {
  page: number;      // 1-indexed
  limit: number;     // max 100
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

### Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `UNAUTHORIZED` | 401 | Invalid or missing token |
| `FORBIDDEN` | 403 | Valid token but no permission |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `CONFLICT` | 409 | Duplicate resource |
| `LIMIT_EXCEEDED` | 429 | Usage limit reached |
| `INTERNAL_ERROR` | 500 | Server error |

### Tenant Context Middleware

```
Every protected request:
1. Extract JWT from Authorization header
2. Validate JWT signature
3. Extract tenant_id from JWT claims
4. Set PostgreSQL session variable: SET app.tenant_id = 'uuid'
5. Proceed to handler
6. RLS policies automatically filter by tenant_id
```
