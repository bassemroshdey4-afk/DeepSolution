# Database Schema - DeepSolution (Supabase PostgreSQL)

## Architecture Overview

This schema uses Supabase-native patterns for multi-tenant isolation. Authentication is handled by Supabase Auth (`auth.users`). User profiles extend auth data. Tenant membership is managed via `tenant_users` junction table.

---

## Tenant Isolation Strategy

### Pattern: auth.uid() + tenant_users membership

RLS policies use this pattern for all tenant-scoped tables:

```sql
-- Standard RLS policy for tenant isolation
CREATE POLICY "tenant_isolation" ON table_name
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);
```

### Why this pattern?

| Approach | Pros | Cons |
|----------|------|------|
| SET app.tenant_id | Simple | Requires custom middleware, not Supabase-native |
| JWT custom claims | Fast lookup | Requires token refresh on tenant switch |
| **tenant_users lookup** | Supabase-native, supports multi-tenant users | Slightly more complex query |

We use `tenant_users` lookup because it is Supabase-native, supports users belonging to multiple tenants, and works with Supabase Auth out of the box.

---

## Tables

### 1. tenants

Stores tenant (store/organization) information with localization settings.

```sql
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  subdomain VARCHAR(63) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  
  -- Localization (MANDATORY)
  country VARCHAR(2) NOT NULL DEFAULT 'SA',        -- ISO 3166-1 alpha-2
  currency VARCHAR(3) NOT NULL DEFAULT 'SAR',      -- ISO 4217
  language VARCHAR(5) NOT NULL DEFAULT 'ar',       -- ISO 639-1 (or ar-SA)
  timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Riyadh', -- IANA timezone
  
  -- Plan & Status
  plan VARCHAR(20) DEFAULT 'free' CHECK (plan IN ('free', 'basic', 'pro', 'enterprise')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'cancelled')),
  
  -- Settings (JSONB for flexibility)
  settings JSONB DEFAULT '{}'::jsonb,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX idx_tenants_status ON tenants(status);

-- No RLS on tenants table - accessed via tenant_users join
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_their_tenants" ON tenants
FOR SELECT USING (
  id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

CREATE POLICY "owners_can_update_tenant" ON tenants
FOR UPDATE USING (
  id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND role = 'owner'
      AND is_active = true
  )
);
```

**Localization fields explained:**

| Field | Purpose | Example | Affects |
|-------|---------|---------|---------|
| `country` | Store location | SA, AE, EG | Tax rules, shipping zones |
| `currency` | Monetary values | SAR, AED, USD | All prices, reports |
| `language` | UI & content | ar, en, fr | AI output, landing pages |
| `timezone` | Time display | Asia/Riyadh | Reports, schedules |

**settings JSONB structure:**

```json
{
  "logo_url": "https://...",
  "whatsapp_number": "+966...",
  "shipping_default_cost": 2500,
  "low_stock_threshold_default": 5,
  "notifications": {
    "email_enabled": true,
    "whatsapp_enabled": false
  }
}
```

---

### 2. profiles

Extends Supabase `auth.users` with application-specific data. Linked 1:1 with auth.users.

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Profile info
  full_name VARCHAR(255),
  avatar_url VARCHAR(500),
  phone VARCHAR(20),
  
  -- Preferences
  preferred_language VARCHAR(5) DEFAULT 'ar',
  preferred_timezone VARCHAR(50),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Users can only access their own profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_profile" ON profiles
FOR SELECT USING (id = auth.uid());

CREATE POLICY "users_can_update_own_profile" ON profiles
FOR UPDATE USING (id = auth.uid());

CREATE POLICY "users_can_insert_own_profile" ON profiles
FOR INSERT WITH CHECK (id = auth.uid());

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

### 3. tenant_users

Junction table linking users to tenants with roles. Enables multi-tenant membership.

```sql
CREATE TABLE public.tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Role within tenant
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Invitation tracking
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, user_id)
);

-- Indexes
CREATE INDEX idx_tenant_users_tenant ON tenant_users(tenant_id);
CREATE INDEX idx_tenant_users_user ON tenant_users(user_id);
CREATE INDEX idx_tenant_users_active ON tenant_users(user_id, is_active) WHERE is_active = true;

-- RLS
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_own_memberships" ON tenant_users
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "owners_can_manage_members" ON tenant_users
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND role = 'owner'
      AND is_active = true
  )
);
```

**Role permissions:**

| Role | View | Create | Edit | Delete | Manage Users | Billing |
|------|------|--------|------|--------|--------------|---------|
| owner | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| member | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| viewer | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |

---

### 4. subscriptions

Tracks tenant subscription status for billing.

```sql
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Plan info
  plan VARCHAR(20) NOT NULL DEFAULT 'free',
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'cancelled', 'trialing')),
  
  -- Billing period
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  
  -- Usage limits (based on plan)
  ai_landing_pages_limit INT DEFAULT 5,
  ai_assistant_messages_limit INT DEFAULT 50,
  team_members_limit INT DEFAULT 1,
  products_limit INT DEFAULT 50,
  
  -- Current usage (reset monthly)
  ai_landing_pages_used INT DEFAULT 0,
  ai_assistant_messages_used INT DEFAULT 0,
  ai_tokens_used INT DEFAULT 0,
  
  -- External billing reference (Stripe, etc.)
  external_subscription_id VARCHAR(255),
  external_customer_id VARCHAR(255),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id)
);

-- Index
CREATE INDEX idx_subscriptions_tenant ON subscriptions(tenant_id);

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON subscriptions
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);
```

---

### 5. products

Product catalog with variant support placeholder.

```sql
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Identity
  sku VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Pricing (stored in smallest currency unit, e.g., halalas)
  cost_price INT DEFAULT 0,
  selling_price INT NOT NULL,
  compare_at_price INT,  -- Original price for discounts
  
  -- Inventory
  track_inventory BOOLEAN DEFAULT true,
  stock_quantity INT DEFAULT 0,
  low_stock_threshold INT DEFAULT 5,
  
  -- Media
  image_url VARCHAR(500),
  images JSONB DEFAULT '[]'::jsonb,  -- Array of image URLs
  
  -- Organization
  category VARCHAR(100),
  tags JSONB DEFAULT '[]'::jsonb,
  
  -- Physical
  weight_grams INT DEFAULT 0,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  
  -- SEO
  meta_title VARCHAR(100),
  meta_description VARCHAR(200),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_products_tenant ON products(tenant_id);
CREATE INDEX idx_products_tenant_status ON products(tenant_id, status);
CREATE INDEX idx_products_tenant_sku ON products(tenant_id, sku);
CREATE INDEX idx_products_tenant_category ON products(tenant_id, category);

-- RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON products
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);
```

---

### 6. product_variants

Product variants (size, color, etc.) - Phase 2 implementation, schema ready.

```sql
CREATE TABLE public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  -- Variant identity
  sku VARCHAR(100),
  name VARCHAR(255) NOT NULL,  -- e.g., "Large / Red"
  
  -- Options (e.g., {"size": "L", "color": "Red"})
  options JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Pricing (overrides product if set)
  cost_price INT,
  selling_price INT,
  
  -- Inventory
  stock_quantity INT DEFAULT 0,
  
  -- Media
  image_url VARCHAR(500),
  
  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_product_variants_tenant ON product_variants(tenant_id);
CREATE INDEX idx_product_variants_product ON product_variants(product_id);

-- RLS
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON product_variants
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);
```

---

### 7. orders

Order records with denormalized customer info for speed.

```sql
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Order identity
  order_number VARCHAR(20) NOT NULL,
  
  -- Customer info (denormalized)
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_email VARCHAR(320),
  
  -- Shipping address
  shipping_address TEXT NOT NULL,
  shipping_city VARCHAR(100) NOT NULL,
  shipping_region VARCHAR(100),
  shipping_postal_code VARCHAR(20),
  shipping_country VARCHAR(2) DEFAULT 'SA',
  
  -- Pricing (in smallest currency unit)
  subtotal INT NOT NULL,
  shipping_cost INT DEFAULT 0,
  discount_amount INT DEFAULT 0,
  tax_amount INT DEFAULT 0,
  total INT NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'SAR',
  
  -- Status tracking
  status VARCHAR(30) DEFAULT 'new' CHECK (status IN (
    'new', 'confirmed', 'processing', 'ready_to_ship', 'shipped', 'delivered', 'cancelled', 'returned'
  )),
  
  -- Call center workflow
  call_status VARCHAR(30) DEFAULT 'pending' CHECK (call_status IN (
    'pending', 'called', 'confirmed', 'no_answer', 'callback_scheduled', 'rejected'
  )),
  call_attempts INT DEFAULT 0,
  next_call_at TIMESTAMPTZ,
  call_notes TEXT,
  
  -- Source tracking
  source VARCHAR(50) DEFAULT 'manual',
  source_reference VARCHAR(255),  -- WhatsApp message ID, etc.
  campaign_id UUID,  -- FK added after campaigns table
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  
  -- Timestamps
  confirmed_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- Notes
  internal_notes TEXT,
  customer_notes TEXT,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX idx_orders_tenant_number ON orders(tenant_id, order_number);
CREATE INDEX idx_orders_tenant ON orders(tenant_id);
CREATE INDEX idx_orders_tenant_status ON orders(tenant_id, status);
CREATE INDEX idx_orders_tenant_call_status ON orders(tenant_id, call_status);
CREATE INDEX idx_orders_tenant_created ON orders(tenant_id, created_at DESC);
CREATE INDEX idx_orders_customer_phone ON orders(tenant_id, customer_phone);
CREATE INDEX idx_orders_campaign ON orders(campaign_id) WHERE campaign_id IS NOT NULL;

-- RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON orders
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);
```

---

### 8. order_items

Individual line items in an order.

```sql
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Product reference
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  
  -- Snapshot at time of order (denormalized)
  sku VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  
  -- Quantity & pricing
  quantity INT NOT NULL DEFAULT 1,
  unit_price INT NOT NULL,
  total_price INT NOT NULL,
  
  -- Cost for profit calculation
  unit_cost INT DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_order_items_tenant ON order_items(tenant_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- RLS
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON order_items
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);
```

---

### 9. order_status_history

Audit trail for order status changes.

```sql
CREATE TABLE public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Status change
  status_type VARCHAR(20) NOT NULL CHECK (status_type IN ('order_status', 'call_status')),
  from_status VARCHAR(30),
  to_status VARCHAR(30) NOT NULL,
  
  -- Context
  notes TEXT,
  changed_by UUID REFERENCES auth.users(id),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_order_status_history_order ON order_status_history(order_id);
CREATE INDEX idx_order_status_history_tenant ON order_status_history(tenant_id);

-- RLS
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON order_status_history
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

-- Trigger to auto-log status changes
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO order_status_history (tenant_id, order_id, status_type, from_status, to_status)
    VALUES (NEW.tenant_id, NEW.id, 'order_status', OLD.status, NEW.status);
  END IF;
  
  IF OLD.call_status IS DISTINCT FROM NEW.call_status THEN
    INSERT INTO order_status_history (tenant_id, order_id, status_type, from_status, to_status)
    VALUES (NEW.tenant_id, NEW.id, 'call_status', OLD.call_status, NEW.call_status);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_log_order_status
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION log_order_status_change();
```

---

### 10. shipments

Shipment tracking (status-based, no provider integration in MVP).

```sql
CREATE TABLE public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Tracking
  tracking_number VARCHAR(100),
  provider_code VARCHAR(50),  -- 'smsa', 'aramex', 'manual', etc.
  provider_name VARCHAR(100),
  
  -- Status
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN (
    'pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned'
  )),
  
  -- Shipping details
  weight_grams INT,
  shipping_cost INT,
  
  -- Tracking events (JSONB array)
  tracking_events JSONB DEFAULT '[]'::jsonb,
  
  -- Timestamps
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_shipments_tenant ON shipments(tenant_id);
CREATE INDEX idx_shipments_order ON shipments(order_id);
CREATE INDEX idx_shipments_tracking ON shipments(tracking_number) WHERE tracking_number IS NOT NULL;

-- RLS
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON shipments
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);
```

**tracking_events JSONB structure:**

```json
[
  {
    "timestamp": "2025-12-15T10:30:00Z",
    "status": "picked_up",
    "location": "Riyadh",
    "description": "Package picked up from sender"
  },
  {
    "timestamp": "2025-12-16T08:00:00Z",
    "status": "in_transit",
    "location": "Jeddah Hub",
    "description": "Package in transit"
  }
]
```

---

### 11. campaigns

Marketing campaign tracking with ROAS calculation.

```sql
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Identity
  name VARCHAR(255) NOT NULL,
  platform VARCHAR(50) NOT NULL CHECK (platform IN (
    'facebook', 'instagram', 'google', 'tiktok', 'snapchat', 'twitter', 'whatsapp', 'other'
  )),
  
  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  
  -- Budget (in smallest currency unit)
  budget_total INT DEFAULT 0,
  budget_spent INT DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'SAR',
  
  -- Dates
  start_date DATE,
  end_date DATE,
  
  -- UTM for attribution
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100) NOT NULL,
  
  -- Calculated metrics (updated by trigger)
  total_orders INT DEFAULT 0,
  total_revenue INT DEFAULT 0,
  roas DECIMAL(10,4) DEFAULT 0,
  
  -- External reference
  external_campaign_id VARCHAR(255),
  
  -- Notes
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK to orders
ALTER TABLE orders ADD CONSTRAINT fk_orders_campaign 
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX idx_campaigns_tenant_status ON campaigns(tenant_id, status);
CREATE INDEX idx_campaigns_utm ON campaigns(tenant_id, utm_campaign);

-- RLS
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON campaigns
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

-- Trigger to update campaign metrics when order changes
CREATE OR REPLACE FUNCTION update_campaign_metrics()
RETURNS TRIGGER AS $$
DECLARE
  campaign_uuid UUID;
BEGIN
  campaign_uuid := COALESCE(NEW.campaign_id, OLD.campaign_id);
  
  IF campaign_uuid IS NOT NULL THEN
    UPDATE campaigns SET
      total_orders = (
        SELECT COUNT(*) FROM orders 
        WHERE campaign_id = campaign_uuid 
        AND status NOT IN ('cancelled', 'returned')
      ),
      total_revenue = (
        SELECT COALESCE(SUM(total), 0) FROM orders 
        WHERE campaign_id = campaign_uuid 
        AND status NOT IN ('cancelled', 'returned')
      ),
      roas = CASE 
        WHEN budget_spent > 0 THEN 
          (SELECT COALESCE(SUM(total), 0)::DECIMAL FROM orders 
           WHERE campaign_id = campaign_uuid 
           AND status NOT IN ('cancelled', 'returned')) / budget_spent
        ELSE 0
      END,
      updated_at = NOW()
    WHERE id = campaign_uuid;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_campaign_metrics
  AFTER INSERT OR UPDATE OR DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_campaign_metrics();
```

---

### 12. landing_pages

AI-generated landing pages.

```sql
CREATE TABLE public.landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  
  -- URL
  slug VARCHAR(100) NOT NULL,
  
  -- Content
  title VARCHAR(255) NOT NULL,
  content JSONB NOT NULL,
  
  -- Language (inherits from tenant but can override)
  language VARCHAR(5) NOT NULL DEFAULT 'ar',
  
  -- SEO
  meta_title VARCHAR(100),
  meta_description VARCHAR(200),
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  
  -- Analytics
  view_count INT DEFAULT 0,
  conversion_count INT DEFAULT 0,
  
  -- AI metadata
  ai_model VARCHAR(50),
  ai_prompt_tokens INT DEFAULT 0,
  ai_completion_tokens INT DEFAULT 0,
  generation_prompt TEXT,
  
  -- Timestamps
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX idx_landing_pages_tenant_slug ON landing_pages(tenant_id, slug);
CREATE INDEX idx_landing_pages_tenant ON landing_pages(tenant_id);
CREATE INDEX idx_landing_pages_product ON landing_pages(product_id);

-- RLS
ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON landing_pages
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

-- Public access for published pages (read-only)
CREATE POLICY "public_can_view_published" ON landing_pages
FOR SELECT USING (status = 'published');
```

**content JSONB structure:**

```json
{
  "headline": "عنوان جذاب",
  "subheadline": "عنوان فرعي",
  "description": "وصف المنتج",
  "benefits": ["فائدة 1", "فائدة 2", "فائدة 3"],
  "cta_text": "اطلب الآن",
  "cta_url": "/order",
  "testimonials": [],
  "faq": [],
  "custom_sections": []
}
```

---

### 13. ai_conversations

AI assistant conversation history with memory.

```sql
CREATE TABLE public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Conversation
  title VARCHAR(255),
  messages JSONB DEFAULT '[]'::jsonb,
  
  -- Context snapshot
  context JSONB DEFAULT '{}'::jsonb,
  
  -- Long-term memory
  summary TEXT,
  
  -- Token tracking
  total_prompt_tokens INT DEFAULT 0,
  total_completion_tokens INT DEFAULT 0,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  
  -- Timestamps
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ai_conversations_tenant ON ai_conversations(tenant_id);
CREATE INDEX idx_ai_conversations_user ON ai_conversations(user_id);
CREATE INDEX idx_ai_conversations_last_message ON ai_conversations(tenant_id, last_message_at DESC);

-- RLS
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_conversations" ON ai_conversations
FOR ALL USING (user_id = auth.uid());
```

---

### 14. files

File storage metadata (actual files in Supabase Storage).

```sql
CREATE TABLE public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- File info
  name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255),
  mime_type VARCHAR(100),
  size_bytes BIGINT,
  
  -- Storage
  storage_bucket VARCHAR(100) NOT NULL DEFAULT 'files',
  storage_path VARCHAR(500) NOT NULL,
  public_url VARCHAR(500),
  
  -- Organization
  folder VARCHAR(255),
  entity_type VARCHAR(50),  -- 'product', 'order', 'landing_page'
  entity_id UUID,
  
  -- Metadata
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_files_tenant ON files(tenant_id);
CREATE INDEX idx_files_entity ON files(entity_type, entity_id);

-- RLS
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON files
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);
```

---

### 15. audit_logs

Comprehensive audit trail for compliance and debugging.

```sql
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Action
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  
  -- Change details
  old_values JSONB,
  new_values JSONB,
  
  -- Request context
  ip_address INET,
  user_agent TEXT,
  request_id VARCHAR(100),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);

-- RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON audit_logs
FOR SELECT USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

-- Insert-only for system
CREATE POLICY "system_can_insert" ON audit_logs
FOR INSERT WITH CHECK (true);
```

---

### 16. inventory_logs

Stock movement tracking.

```sql
CREATE TABLE public.inventory_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  
  -- Change type
  change_type VARCHAR(30) NOT NULL CHECK (change_type IN (
    'order_confirmed', 'order_cancelled', 'order_returned',
    'manual_adjustment', 'restock', 'damage', 'transfer'
  )),
  
  -- Quantities
  quantity_before INT NOT NULL,
  quantity_change INT NOT NULL,
  quantity_after INT NOT NULL,
  
  -- Reference
  reference_type VARCHAR(30),
  reference_id UUID,
  
  -- Notes
  notes TEXT,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_inventory_logs_tenant ON inventory_logs(tenant_id);
CREATE INDEX idx_inventory_logs_product ON inventory_logs(product_id);
CREATE INDEX idx_inventory_logs_created ON inventory_logs(tenant_id, created_at DESC);

-- RLS
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON inventory_logs
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);
```

---

## Entity Relationship Diagram

```
auth.users (Supabase)
    │
    ├── profiles (1:1)
    │
    └── tenant_users (1:N)
            │
            └── tenants (N:1)
                    │
                    ├── subscriptions (1:1)
                    ├── products (1:N)
                    │       └── product_variants (1:N)
                    │       └── inventory_logs (1:N)
                    │       └── landing_pages (1:N)
                    ├── orders (1:N)
                    │       └── order_items (1:N)
                    │       └── order_status_history (1:N)
                    │       └── shipments (1:N)
                    ├── campaigns (1:N)
                    │       └── orders (1:N) via campaign_id
                    ├── ai_conversations (1:N)
                    ├── files (1:N)
                    └── audit_logs (1:N)
```

---

## Supabase Storage Buckets

| Bucket | Purpose | Public |
|--------|---------|--------|
| `products` | Product images | Yes |
| `landing-pages` | Landing page assets | Yes |
| `files` | General uploads | No |
| `avatars` | User avatars | Yes |

---

## Database Functions

### get_user_tenants()

Returns all tenants the current user belongs to.

```sql
CREATE OR REPLACE FUNCTION get_user_tenants()
RETURNS TABLE (
  tenant_id UUID,
  tenant_name VARCHAR,
  subdomain VARCHAR,
  role VARCHAR,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.name,
    t.subdomain,
    tu.role,
    tu.is_active
  FROM tenants t
  JOIN tenant_users tu ON tu.tenant_id = t.id
  WHERE tu.user_id = auth.uid()
  ORDER BY tu.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### generate_order_number()

Generates unique order number for tenant.

```sql
CREATE OR REPLACE FUNCTION generate_order_number(p_tenant_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  today_prefix VARCHAR;
  sequence_num INT;
  order_num VARCHAR;
BEGIN
  today_prefix := TO_CHAR(NOW(), 'YYMMDD');
  
  SELECT COUNT(*) + 1 INTO sequence_num
  FROM orders
  WHERE tenant_id = p_tenant_id
    AND created_at >= CURRENT_DATE
    AND created_at < CURRENT_DATE + INTERVAL '1 day';
  
  order_num := '#' || today_prefix || '-' || LPAD(sequence_num::TEXT, 3, '0');
  
  RETURN order_num;
END;
$$ LANGUAGE plpgsql;
```

---

## Summary

| Table | Purpose | RLS Pattern |
|-------|---------|-------------|
| tenants | Tenant/store info | tenant_users membership |
| profiles | User profile extension | Own profile only |
| tenant_users | User-tenant membership | Own memberships + owner manage |
| subscriptions | Billing & limits | tenant_users membership |
| products | Product catalog | tenant_users membership |
| product_variants | Product variants | tenant_users membership |
| orders | Order records | tenant_users membership |
| order_items | Order line items | tenant_users membership |
| order_status_history | Status audit trail | tenant_users membership |
| shipments | Shipping tracking | tenant_users membership |
| campaigns | Marketing campaigns | tenant_users membership |
| landing_pages | AI landing pages | tenant_users membership + public read |
| ai_conversations | AI chat history | Own conversations only |
| files | File metadata | tenant_users membership |
| audit_logs | Audit trail | tenant_users membership (read) |
| inventory_logs | Stock movements | tenant_users membership |
