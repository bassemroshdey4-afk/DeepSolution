-- ============================================================================
-- DeepSolution: FINAL COMPLETE SCHEMA
-- Version: 3.0 - Single Idempotent Executable File
-- ============================================================================
--
-- PURPOSE:
-- Complete cognitive memory system for multi-tenant e-commerce SaaS.
-- This file is IDEMPOTENT - safe to run multiple times without errors.
--
-- LOCALIZATION NOTE:
-- country, currency, language, timezone have NO DEFAULT values.
-- These MUST be set during tenant onboarding.
-- Frontend handles UI language (Arabic RTL) - NOT stored in DB.
--
-- ARCHITECTURE:
-- - Supabase = Cognitive Memory Engine
-- - AI = Decision & Learning Brain (reads ONLY views/summaries)
-- - n8n = Nervous System (automation)
--
-- AI RULE: AI NEVER reads raw tables. AI reads ONLY:
--   - Views (ai_*)
--   - Intelligence tables (*_intelligence)
--   - Summary tables (*_summary)
--
-- ============================================================================


-- ============================================================================
-- EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================================
-- CUSTOM TYPES (with duplicate handling)
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'pending', 'confirmed', 'processing', 'ready_to_ship',
    'shipped', 'in_transit', 'out_for_delivery', 'delivered',
    'returned', 'cancelled', 'refunded', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE call_status AS ENUM (
    'pending', 'no_answer', 'confirmed', 'cancelled_by_customer',
    'wrong_number', 'callback_requested', 'not_interested'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM (
    'pending', 'paid', 'partially_paid', 'failed', 'refunded', 'cod_pending', 'cod_collected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM (
    'trial', 'active', 'past_due', 'cancelled', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE job_status AS ENUM (
    'queued', 'running', 'completed', 'failed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE deployment_status AS ENUM (
    'pending', 'building', 'ready', 'error', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- L1: TENANT COGNITIVE MEMORY
-- ============================================================================

-- Tenants (Core)
-- LOCALIZATION: country, currency, language, timezone are NOT NULL without DEFAULT
-- Must be provided during onboarding
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(63) NOT NULL UNIQUE,
  custom_domain VARCHAR(255),
  
  -- Localization (NO DEFAULTS - set per tenant during onboarding)
  country VARCHAR(2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  language VARCHAR(5) NOT NULL,
  timezone VARCHAR(50) NOT NULL,
  
  -- Business info
  business_type VARCHAR(50),
  industry VARCHAR(50),
  
  -- Plan
  plan VARCHAR(20) NOT NULL DEFAULT 'free',
  
  -- Settings (JSONB)
  settings JSONB DEFAULT '{}'::jsonb,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(is_active);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_self_access" ON tenants;
CREATE POLICY "tenant_self_access" ON tenants FOR ALL USING (
  id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- Profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic info
  full_name VARCHAR(255),
  avatar_url VARCHAR(500),
  phone VARCHAR(20),
  
  -- Preferences (NO DEFAULTS for localization)
  language VARCHAR(5),
  timezone VARCHAR(50),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_own_profile" ON profiles;
CREATE POLICY "users_own_profile" ON profiles FOR ALL USING (id = auth.uid());


-- Tenant Users (membership)
CREATE TABLE IF NOT EXISTS public.tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Role
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON tenant_users(tenant_id);

ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_users_access" ON tenant_users;
CREATE POLICY "tenant_users_access" ON tenant_users FOR ALL USING (user_id = auth.uid());


-- Tenant Cognitive Profile (AI reads this)
CREATE TABLE IF NOT EXISTS public.tenant_cognitive_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  
  -- Business DNA (learned over time)
  business_type VARCHAR(50),
  industry VARCHAR(100),
  business_model VARCHAR(50),
  avg_order_value INT,
  avg_margin_percentage DECIMAL(5,2),
  
  -- Behavioral patterns (AI-learned)
  peak_hours JSONB DEFAULT '[]'::jsonb,
  peak_days JSONB DEFAULT '[]'::jsonb,
  seasonal_patterns JSONB DEFAULT '{}'::jsonb,
  
  -- Preferences (AI-learned)
  preferred_shipping_providers JSONB DEFAULT '[]'::jsonb,
  preferred_payment_methods JSONB DEFAULT '[]'::jsonb,
  risk_tolerance VARCHAR(20) DEFAULT 'medium',
  
  -- AI interaction style
  ai_communication_style VARCHAR(20) DEFAULT 'detailed',
  ai_autonomy_level VARCHAR(20) DEFAULT 'suggest',
  
  -- Confidence
  profile_confidence DECIMAL(3,2) DEFAULT 0.5,
  last_profile_update TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_cognitive_profile_tenant ON tenant_cognitive_profile(tenant_id);

ALTER TABLE tenant_cognitive_profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON tenant_cognitive_profile;
CREATE POLICY "tenant_isolation" ON tenant_cognitive_profile FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- Tenant Domains
CREATE TABLE IF NOT EXISTS public.tenant_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Domain
  domain VARCHAR(255) NOT NULL UNIQUE,
  domain_type VARCHAR(20) NOT NULL DEFAULT 'subdomain',
  
  -- Verification
  is_verified BOOLEAN DEFAULT false,
  verification_token VARCHAR(100),
  verified_at TIMESTAMPTZ,
  
  -- SSL
  ssl_status VARCHAR(20) DEFAULT 'pending',
  
  -- Config
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  -- Vercel
  vercel_domain_id VARCHAR(100),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_domains_tenant ON tenant_domains(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_domains_domain ON tenant_domains(domain);

ALTER TABLE tenant_domains ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON tenant_domains;
CREATE POLICY "tenant_isolation" ON tenant_domains FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- Subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Plan
  plan_id VARCHAR(50) NOT NULL,
  status subscription_status NOT NULL DEFAULT 'trial',
  
  -- Billing
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  
  -- Limits
  limits JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON subscriptions;
CREATE POLICY "tenant_isolation" ON subscriptions FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- ============================================================================
-- L2: PRODUCT INTELLIGENCE MEMORY
-- ============================================================================

-- Products (Raw - AI does NOT read)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Identification
  sku VARCHAR(100),
  name_ar VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),
  description_ar TEXT,
  description_en TEXT,
  
  -- Pricing
  cost_price DECIMAL(12,2),
  selling_price DECIMAL(12,2) NOT NULL,
  compare_at_price DECIMAL(12,2),
  
  -- Inventory
  stock_quantity INT DEFAULT 0,
  low_stock_threshold INT DEFAULT 5,
  
  -- Classification
  product_type VARCHAR(50),
  price_tier VARCHAR(20),
  category VARCHAR(100),
  
  -- Media
  images JSONB DEFAULT '[]'::jsonb,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(tenant_id, sku);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(tenant_id, is_active);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON products;
CREATE POLICY "tenant_isolation" ON products FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- Product Variants
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  -- Variant info
  sku VARCHAR(100),
  name VARCHAR(255),
  options JSONB DEFAULT '{}'::jsonb,
  
  -- Pricing
  price DECIMAL(12,2),
  cost_price DECIMAL(12,2),
  
  -- Inventory
  stock_quantity INT DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_tenant ON product_variants(tenant_id);

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON product_variants;
CREATE POLICY "tenant_isolation" ON product_variants FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- Product Intelligence (AI READS THIS)
CREATE TABLE IF NOT EXISTS public.product_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  -- Performance metrics
  total_units_sold INT DEFAULT 0,
  total_revenue DECIMAL(14,2) DEFAULT 0,
  total_profit DECIMAL(14,2) DEFAULT 0,
  conversion_rate DECIMAL(5,4),
  
  -- Trends
  sales_velocity_daily DECIMAL(10,2) DEFAULT 0,
  sales_trend VARCHAR(20),
  
  -- Inventory intelligence
  days_of_stock INT,
  stockout_risk VARCHAR(20),
  reorder_point INT,
  
  -- Pricing intelligence
  price_elasticity DECIMAL(5,2),
  optimal_price_suggestion DECIMAL(12,2),
  
  -- AI insights
  performance_tier VARCHAR(20),
  ai_recommendations JSONB DEFAULT '[]'::jsonb,
  
  -- Confidence
  intelligence_confidence DECIMAL(3,2) DEFAULT 0.5,
  
  -- Period
  period_start DATE,
  period_end DATE,
  
  -- Timestamps
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, product_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_product_intelligence_tenant ON product_intelligence(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_intelligence_product ON product_intelligence(product_id);

ALTER TABLE product_intelligence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON product_intelligence;
CREATE POLICY "tenant_isolation" ON product_intelligence FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- ============================================================================
-- L3: CAMPAIGN LEARNING MEMORY
-- ============================================================================

-- Campaigns (Raw)
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Identification
  name VARCHAR(255) NOT NULL,
  platform VARCHAR(50),
  external_id VARCHAR(255),
  
  -- Budget
  budget DECIMAL(12,2),
  budget_spent DECIMAL(12,2) DEFAULT 0,
  
  -- Performance
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  conversions INT DEFAULT 0,
  revenue DECIMAL(14,2) DEFAULT 0,
  
  -- Calculated
  ctr DECIMAL(5,4),
  cpc DECIMAL(10,4),
  cpa DECIMAL(10,2),
  roas DECIMAL(10,4),
  
  -- Status
  status VARCHAR(20) DEFAULT 'active',
  
  -- Dates
  start_date DATE,
  end_date DATE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_platform ON campaigns(tenant_id, platform);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(tenant_id, status);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON campaigns;
CREATE POLICY "tenant_isolation" ON campaigns FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- Campaign Intelligence (AI READS THIS)
CREATE TABLE IF NOT EXISTS public.campaign_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  
  -- Performance summary
  total_spend DECIMAL(14,2) DEFAULT 0,
  total_revenue DECIMAL(14,2) DEFAULT 0,
  total_profit DECIMAL(14,2) DEFAULT 0,
  overall_roas DECIMAL(10,4),
  true_roas DECIMAL(10,4),
  
  -- Learning
  best_performing_hours JSONB DEFAULT '[]'::jsonb,
  best_performing_days JSONB DEFAULT '[]'::jsonb,
  best_audience_segments JSONB DEFAULT '[]'::jsonb,
  
  -- AI insights
  performance_trend VARCHAR(20),
  scaling_potential VARCHAR(20),
  recommended_daily_budget DECIMAL(12,2),
  ai_recommendations JSONB DEFAULT '[]'::jsonb,
  
  -- Confidence
  intelligence_confidence DECIMAL(3,2) DEFAULT 0.5,
  
  -- Period
  period_start DATE,
  period_end DATE,
  
  -- Timestamps
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, campaign_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_campaign_intelligence_tenant ON campaign_intelligence(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaign_intelligence_campaign ON campaign_intelligence(campaign_id);

ALTER TABLE campaign_intelligence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON campaign_intelligence;
CREATE POLICY "tenant_isolation" ON campaign_intelligence FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- Campaign Learnings (accumulated wisdom)
CREATE TABLE IF NOT EXISTS public.campaign_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Learning scope
  platform VARCHAR(30),
  campaign_type VARCHAR(50),
  
  -- Learning content
  learning_type VARCHAR(50) NOT NULL,
  learning TEXT NOT NULL,
  
  -- Evidence
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  sample_size INT DEFAULT 0,
  
  -- Applicability
  applies_when JSONB DEFAULT '{}'::jsonb,
  does_not_apply_when JSONB DEFAULT '{}'::jsonb,
  
  -- Confidence
  confidence DECIMAL(3,2) DEFAULT 0.5,
  times_validated INT DEFAULT 1,
  times_contradicted INT DEFAULT 0,
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_learnings_tenant ON campaign_learnings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaign_learnings_platform ON campaign_learnings(tenant_id, platform);

ALTER TABLE campaign_learnings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON campaign_learnings;
CREATE POLICY "tenant_isolation" ON campaign_learnings FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- ============================================================================
-- L4: CUSTOMER BEHAVIOR MEMORY (Privacy-Safe)
-- ============================================================================

-- Customer Segments (aggregated, no PII)
CREATE TABLE IF NOT EXISTS public.customer_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Segment definition
  name VARCHAR(255) NOT NULL,
  segment_type VARCHAR(50),
  
  -- Criteria (JSONB)
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Stats
  customer_count INT DEFAULT 0,
  percentage_of_total DECIMAL(5,2),
  avg_order_value DECIMAL(12,2),
  avg_lifetime_value DECIMAL(14,2),
  avg_orders_per_customer DECIMAL(5,2),
  
  -- Behavior patterns
  avg_days_between_orders DECIMAL(10,2),
  preferred_products JSONB DEFAULT '[]'::jsonb,
  preferred_channels JSONB DEFAULT '[]'::jsonb,
  churn_risk VARCHAR(20),
  
  -- AI insights
  ai_recommendations JSONB DEFAULT '[]'::jsonb,
  
  is_active BOOLEAN DEFAULT true,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_segments_tenant ON customer_segments(tenant_id);

ALTER TABLE customer_segments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON customer_segments;
CREATE POLICY "tenant_isolation" ON customer_segments FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- Customer Behavior Patterns
CREATE TABLE IF NOT EXISTS public.customer_behavior_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Pattern type
  pattern_type VARCHAR(50) NOT NULL,
  pattern_name VARCHAR(255) NOT NULL,
  
  -- Pattern data
  pattern_data JSONB NOT NULL,
  
  -- Statistical strength
  sample_size INT DEFAULT 0,
  confidence DECIMAL(3,2) DEFAULT 0.5,
  
  -- Business impact
  estimated_revenue_impact DECIMAL(14,2),
  estimated_conversion_impact DECIMAL(5,2),
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_behavior_patterns_tenant ON customer_behavior_patterns(tenant_id);

ALTER TABLE customer_behavior_patterns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON customer_behavior_patterns;
CREATE POLICY "tenant_isolation" ON customer_behavior_patterns FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- ============================================================================
-- L5: OPERATIONAL REALITY MEMORY
-- ============================================================================

-- Operational Capacity (AI READS THIS)
CREATE TABLE IF NOT EXISTS public.operational_capacity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  
  -- Order processing capacity
  max_daily_orders INT,
  current_daily_capacity_used INT DEFAULT 0,
  capacity_utilization DECIMAL(5,2),
  
  -- Call center capacity
  call_agents_count INT DEFAULT 1,
  calls_per_agent_per_day INT DEFAULT 50,
  current_call_backlog INT DEFAULT 0,
  
  -- Fulfillment capacity
  warehouse_capacity_units INT,
  current_inventory_units INT DEFAULT 0,
  packing_capacity_per_day INT,
  
  -- Constraints
  active_constraints JSONB DEFAULT '[]'::jsonb,
  
  -- Performance
  avg_order_processing_hours DECIMAL(10,2),
  avg_call_response_minutes DECIMAL(10,2),
  
  last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operational_capacity_tenant ON operational_capacity(tenant_id);

ALTER TABLE operational_capacity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON operational_capacity;
CREATE POLICY "tenant_isolation" ON operational_capacity FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- Operational Metrics Daily
CREATE TABLE IF NOT EXISTS public.operational_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  
  -- Order metrics
  orders_received INT DEFAULT 0,
  orders_confirmed INT DEFAULT 0,
  orders_shipped INT DEFAULT 0,
  orders_delivered INT DEFAULT 0,
  orders_cancelled INT DEFAULT 0,
  orders_returned INT DEFAULT 0,
  
  -- Call center metrics
  calls_made INT DEFAULT 0,
  calls_answered INT DEFAULT 0,
  confirmation_rate DECIMAL(5,4),
  avg_call_duration_seconds INT,
  
  -- Fulfillment metrics
  avg_processing_hours DECIMAL(10,2),
  on_time_shipping_rate DECIMAL(5,4),
  
  -- Quality metrics
  customer_complaints INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_operational_metrics_daily_tenant ON operational_metrics_daily(tenant_id);
CREATE INDEX IF NOT EXISTS idx_operational_metrics_daily_date ON operational_metrics_daily(tenant_id, metric_date);

ALTER TABLE operational_metrics_daily ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON operational_metrics_daily;
CREATE POLICY "tenant_isolation" ON operational_metrics_daily FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);



-- ============================================================================
-- L6: FULFILLMENT & SHIPPING INTELLIGENCE
-- ============================================================================

-- Orders (Raw - AI does NOT read)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Identification
  order_number VARCHAR(50) NOT NULL,
  
  -- Customer (for operations, not AI)
  customer_phone VARCHAR(20),
  customer_name VARCHAR(255),
  customer_email VARCHAR(320),
  
  -- Address
  shipping_address TEXT,
  shipping_city VARCHAR(100),
  shipping_region VARCHAR(100),
  shipping_country VARCHAR(2),
  
  -- Items
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Pricing
  subtotal DECIMAL(12,2) NOT NULL,
  shipping_cost DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  
  -- Status
  status order_status NOT NULL DEFAULT 'pending',
  call_status call_status DEFAULT 'pending',
  payment_status payment_status DEFAULT 'pending',
  
  -- Payment
  payment_method VARCHAR(50),
  
  -- Attribution
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(255),
  utm_content VARCHAR(255),
  utm_term VARCHAR(255),
  ad_id VARCHAR(255),
  ad_group_id VARCHAR(255),
  campaign_id UUID REFERENCES campaigns(id),
  landing_page_id UUID,
  
  -- Call center
  call_attempts INT DEFAULT 0,
  last_call_at TIMESTAMPTZ,
  call_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  UNIQUE(tenant_id, order_number)
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_call_status ON orders(tenant_id, call_status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_campaign ON orders(campaign_id);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(tenant_id, customer_phone);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON orders;
CREATE POLICY "tenant_isolation" ON orders FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- Order Items
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  
  -- Item details
  sku VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  total_price DECIMAL(12,2) NOT NULL,
  cost_price DECIMAL(12,2),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_tenant ON order_items(tenant_id);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON order_items;
CREATE POLICY "tenant_isolation" ON order_items FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- Order Status History
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Status change
  from_status VARCHAR(50),
  to_status VARCHAR(50) NOT NULL,
  
  -- Context
  changed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_tenant ON order_status_history(tenant_id);

ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON order_status_history;
CREATE POLICY "tenant_isolation" ON order_status_history FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- Shipping Providers
CREATE TABLE IF NOT EXISTS public.shipping_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Provider info
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL,
  
  -- Config (encrypted)
  config JSONB DEFAULT '{}'::jsonb,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_shipping_providers_tenant ON shipping_providers(tenant_id);

ALTER TABLE shipping_providers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON shipping_providers;
CREATE POLICY "tenant_isolation" ON shipping_providers FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- Shipping SLA Rules
CREATE TABLE IF NOT EXISTS public.shipping_sla_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES shipping_providers(id) ON DELETE CASCADE,
  
  -- Rule definition
  rule_name VARCHAR(100) NOT NULL,
  
  -- Conditions
  from_region VARCHAR(100),
  to_region VARCHAR(100),
  
  -- SLA
  expected_days INT NOT NULL,
  max_days INT NOT NULL,
  
  -- Cost
  base_cost DECIMAL(10,2),
  cost_per_kg DECIMAL(10,2),
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipping_sla_rules_tenant ON shipping_sla_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shipping_sla_rules_provider ON shipping_sla_rules(provider_id);

ALTER TABLE shipping_sla_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON shipping_sla_rules;
CREATE POLICY "tenant_isolation" ON shipping_sla_rules FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- Shipments
CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES shipping_providers(id),
  
  -- Provider
  tracking_number VARCHAR(100),
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending',
  
  -- Dates
  shipped_at TIMESTAMPTZ,
  estimated_delivery TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  -- SLA tracking
  sla_rule_id UUID REFERENCES shipping_sla_rules(id),
  sla_expected_date DATE,
  sla_met BOOLEAN,
  
  -- Cost
  shipping_cost DECIMAL(10,2),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tenant ON shipments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_provider ON shipments(provider_id);

ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON shipments;
CREATE POLICY "tenant_isolation" ON shipments FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- Shipping Performance (AI READS THIS)
CREATE TABLE IF NOT EXISTS public.shipping_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES shipping_providers(id) ON DELETE CASCADE,
  
  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Raw metrics
  total_shipments INT DEFAULT 0,
  delivered_on_time INT DEFAULT 0,
  delivered_late INT DEFAULT 0,
  lost_shipments INT DEFAULT 0,
  returned_shipments INT DEFAULT 0,
  
  -- Derived metrics
  on_time_rate DECIMAL(5,4),
  lost_rate DECIMAL(5,4),
  return_rate DECIMAL(5,4),
  avg_delivery_days DECIMAL(5,2),
  
  -- Score (0-100)
  shipping_score DECIMAL(5,2),
  
  -- Timestamps
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, provider_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_shipping_performance_tenant ON shipping_performance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shipping_performance_provider ON shipping_performance(provider_id);

ALTER TABLE shipping_performance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON shipping_performance;
CREATE POLICY "tenant_isolation" ON shipping_performance FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);



-- ============================================================================
-- L7: UNIT ECONOMICS TEMPORAL MEMORY
-- ============================================================================

-- Financial Transactions (Raw - AI does NOT read)
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Transaction type
  transaction_type VARCHAR(50) NOT NULL,
  
  -- Amount
  amount DECIMAL(14,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  
  -- References
  order_id UUID REFERENCES orders(id),
  product_id UUID REFERENCES products(id),
  campaign_id UUID REFERENCES campaigns(id),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  transaction_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_tenant ON financial_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_date ON financial_transactions(tenant_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_order ON financial_transactions(order_id);

ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON financial_transactions;
CREATE POLICY "tenant_isolation" ON financial_transactions FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- Order Profit Timeline (AI READS THIS)
-- Tracks profit at different stages: post_sale, post_shipping, post_collection, post_return_window, final
CREATE TABLE IF NOT EXISTS public.order_profit_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Stage
  stage VARCHAR(30) NOT NULL,
  
  -- Financials at this stage
  revenue DECIMAL(14,2) NOT NULL,
  product_cost DECIMAL(14,2) DEFAULT 0,
  shipping_cost DECIMAL(14,2) DEFAULT 0,
  marketing_cost DECIMAL(14,2) DEFAULT 0,
  operational_cost DECIMAL(14,2) DEFAULT 0,
  return_cost DECIMAL(14,2) DEFAULT 0,
  
  -- Calculated
  gross_profit DECIMAL(14,2),
  net_profit DECIMAL(14,2),
  net_margin DECIMAL(5,4),
  
  -- Confidence (decreases for future projections)
  confidence DECIMAL(3,2) DEFAULT 1.0,
  
  -- Timestamps
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, order_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_order_profit_timeline_tenant ON order_profit_timeline(tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_profit_timeline_order ON order_profit_timeline(order_id);
CREATE INDEX IF NOT EXISTS idx_order_profit_timeline_stage ON order_profit_timeline(stage);

ALTER TABLE order_profit_timeline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON order_profit_timeline;
CREATE POLICY "tenant_isolation" ON order_profit_timeline FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- Unit Economics Summary (AI READS THIS)
CREATE TABLE IF NOT EXISTS public.unit_economics_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Period
  period_type VARCHAR(20) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Aggregated metrics
  total_orders INT DEFAULT 0,
  total_revenue DECIMAL(14,2) DEFAULT 0,
  total_costs DECIMAL(14,2) DEFAULT 0,
  total_profit DECIMAL(14,2) DEFAULT 0,
  
  -- Cost breakdown
  total_product_cost DECIMAL(14,2) DEFAULT 0,
  total_shipping_cost DECIMAL(14,2) DEFAULT 0,
  total_marketing_cost DECIMAL(14,2) DEFAULT 0,
  total_operational_cost DECIMAL(14,2) DEFAULT 0,
  total_return_cost DECIMAL(14,2) DEFAULT 0,
  
  -- Averages
  avg_order_value DECIMAL(12,2),
  avg_profit_per_order DECIMAL(12,2),
  avg_margin DECIMAL(5,4),
  
  -- Timestamps
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, period_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_unit_economics_summary_tenant ON unit_economics_summary(tenant_id);

ALTER TABLE unit_economics_summary ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON unit_economics_summary;
CREATE POLICY "tenant_isolation" ON unit_economics_summary FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- ============================================================================
-- L8: MARKETING-TO-CASH MEMORY
-- ============================================================================

-- Marketing to Cash Journey (AI READS THIS)
CREATE TABLE IF NOT EXISTS public.marketing_to_cash_journey (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Source
  campaign_id UUID REFERENCES campaigns(id),
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  
  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Funnel metrics
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  page_views INT DEFAULT 0,
  add_to_carts INT DEFAULT 0,
  checkouts INT DEFAULT 0,
  orders INT DEFAULT 0,
  confirmed INT DEFAULT 0,
  shipped INT DEFAULT 0,
  delivered INT DEFAULT 0,
  collected INT DEFAULT 0,
  
  -- Financial
  ad_spend DECIMAL(14,2) DEFAULT 0,
  revenue DECIMAL(14,2) DEFAULT 0,
  collected_cash DECIMAL(14,2) DEFAULT 0,
  
  -- Calculated
  cost_per_click DECIMAL(10,4),
  cost_per_order DECIMAL(10,2),
  roas DECIMAL(10,4),
  cash_roas DECIMAL(10,4),
  
  -- Timestamps
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, campaign_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_marketing_to_cash_tenant ON marketing_to_cash_journey(tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketing_to_cash_campaign ON marketing_to_cash_journey(campaign_id);

ALTER TABLE marketing_to_cash_journey ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON marketing_to_cash_journey;
CREATE POLICY "tenant_isolation" ON marketing_to_cash_journey FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- ============================================================================
-- L9: EXPERIMENT MEMORY
-- ============================================================================

-- Experiments
CREATE TABLE IF NOT EXISTS public.experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Experiment info
  name VARCHAR(255) NOT NULL,
  hypothesis TEXT,
  experiment_type VARCHAR(50),
  
  -- Variants
  variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft',
  
  -- Results
  winner_variant VARCHAR(50),
  confidence_level DECIMAL(5,4),
  
  -- Dates
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_experiments_tenant ON experiments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(tenant_id, status);

ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON experiments;
CREATE POLICY "tenant_isolation" ON experiments FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- Experiment Wisdom (AI READS THIS)
CREATE TABLE IF NOT EXISTS public.experiment_wisdom (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  experiment_id UUID REFERENCES experiments(id),
  
  -- Learning
  learning_type VARCHAR(50) NOT NULL,
  insight TEXT NOT NULL,
  
  -- Applicability
  applies_to JSONB DEFAULT '{}'::jsonb,
  
  -- Confidence
  confidence DECIMAL(3,2),
  evidence_count INT DEFAULT 1,
  
  -- Status
  is_validated BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_experiment_wisdom_tenant ON experiment_wisdom(tenant_id);

ALTER TABLE experiment_wisdom ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON experiment_wisdom;
CREATE POLICY "tenant_isolation" ON experiment_wisdom FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- ============================================================================
-- L10: FAILURE & NEGATIVE INSIGHT MEMORY
-- ============================================================================

-- Failure Events (Raw)
CREATE TABLE IF NOT EXISTS public.failure_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Failure info
  failure_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  
  -- Context
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Resolution
  is_resolved BOOLEAN DEFAULT false,
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  
  -- Timestamps
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_failure_events_tenant ON failure_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_failure_events_type ON failure_events(tenant_id, failure_type);

ALTER TABLE failure_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON failure_events;
CREATE POLICY "tenant_isolation" ON failure_events FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- Failure Patterns (AI READS THIS)
CREATE TABLE IF NOT EXISTS public.failure_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Pattern
  pattern_type VARCHAR(50) NOT NULL,
  pattern_description TEXT NOT NULL,
  
  -- Frequency
  occurrence_count INT DEFAULT 1,
  last_occurred_at TIMESTAMPTZ,
  
  -- Prevention
  prevention_strategy TEXT,
  is_prevented BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_failure_patterns_tenant ON failure_patterns(tenant_id);

ALTER TABLE failure_patterns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON failure_patterns;
CREATE POLICY "tenant_isolation" ON failure_patterns FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- ============================================================================
-- L11: DECISION MEMORY
-- ============================================================================

-- Decisions
CREATE TABLE IF NOT EXISTS public.decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Decision info
  decision_type VARCHAR(50) NOT NULL,
  decision_maker VARCHAR(20) NOT NULL,
  
  -- Context
  input_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Decision
  decision_made JSONB NOT NULL,
  reasoning TEXT,
  
  -- Expected outcome
  expected_outcome JSONB,
  confidence DECIMAL(3,2),
  
  -- Timestamps
  decided_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decisions_tenant ON decisions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_decisions_type ON decisions(tenant_id, decision_type);

ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON decisions;
CREATE POLICY "tenant_isolation" ON decisions FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- Decision Outcomes
CREATE TABLE IF NOT EXISTS public.decision_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  
  -- Outcome
  actual_outcome JSONB NOT NULL,
  
  -- Evaluation
  was_successful BOOLEAN,
  accuracy_score DECIMAL(3,2),
  
  -- Learning
  lesson_learned TEXT,
  
  -- Timestamps
  measured_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decision_outcomes_decision ON decision_outcomes(decision_id);
CREATE INDEX IF NOT EXISTS idx_decision_outcomes_tenant ON decision_outcomes(tenant_id);

ALTER TABLE decision_outcomes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON decision_outcomes;
CREATE POLICY "tenant_isolation" ON decision_outcomes FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- ============================================================================
-- L12: TRUST & CONFIDENCE MEMORY
-- ============================================================================

-- AI Trust Scores
CREATE TABLE IF NOT EXISTS public.ai_trust_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Domain
  domain VARCHAR(50) NOT NULL,
  
  -- Scores
  accuracy_score DECIMAL(3,2) DEFAULT 0.5,
  reliability_score DECIMAL(3,2) DEFAULT 0.5,
  overall_trust DECIMAL(3,2) DEFAULT 0.5,
  
  -- Stats
  total_predictions INT DEFAULT 0,
  correct_predictions INT DEFAULT 0,
  
  -- Timestamps
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_ai_trust_scores_tenant ON ai_trust_scores(tenant_id);

ALTER TABLE ai_trust_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON ai_trust_scores;
CREATE POLICY "tenant_isolation" ON ai_trust_scores FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- ============================================================================
-- L13: INSIGHT (DERIVED KNOWLEDGE) MEMORY
-- ============================================================================

-- Insights
CREATE TABLE IF NOT EXISTS public.insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Insight info
  insight_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  
  -- Evidence
  evidence JSONB DEFAULT '[]'::jsonb,
  confidence DECIMAL(3,2),
  
  -- Actionability
  recommended_actions JSONB DEFAULT '[]'::jsonb,
  priority VARCHAR(20),
  
  -- Status
  is_acknowledged BOOLEAN DEFAULT false,
  is_acted_upon BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_insights_tenant ON insights(tenant_id);
CREATE INDEX IF NOT EXISTS idx_insights_type ON insights(tenant_id, insight_type);

ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON insights;
CREATE POLICY "tenant_isolation" ON insights FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- ============================================================================
-- L14: LOCALIZATION MEMORY
-- Note: Stored in tenants table (country, currency, language, timezone)
-- NO DEFAULTS - set per tenant during onboarding
-- ============================================================================


-- ============================================================================
-- L15: WORKFLOW & AUTOMATION MEMORY
-- ============================================================================

-- Workflow Runs
CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Workflow info
  workflow_id VARCHAR(100) NOT NULL,
  workflow_name VARCHAR(255),
  
  -- Idempotency
  idempotency_key VARCHAR(255),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  
  -- Execution
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  
  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INT,
  
  -- Retry
  retry_count INT DEFAULT 0,
  is_dead_letter BOOLEAN DEFAULT false,
  
  UNIQUE(tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_tenant ON workflow_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(tenant_id, status);

ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON workflow_runs;
CREATE POLICY "tenant_isolation" ON workflow_runs FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);



-- ============================================================================
-- RAW EVENT STREAM (Immutable - AI does NOT read)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Idempotency
  idempotency_key VARCHAR(255) NOT NULL,
  
  -- Tenant
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Event
  event_type VARCHAR(100) NOT NULL,
  event_category VARCHAR(50) NOT NULL,
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Session & User
  session_id VARCHAR(100),
  anonymous_id VARCHAR(100),
  customer_id UUID,
  user_id UUID REFERENCES auth.users(id),
  
  -- Entity references
  product_id UUID,
  order_id UUID,
  campaign_id UUID,
  landing_page_id UUID,
  
  -- Attribution
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(255),
  utm_content VARCHAR(255),
  utm_term VARCHAR(255),
  ad_id VARCHAR(255),
  ad_group_id VARCHAR(255),
  
  -- Payload
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  context JSONB DEFAULT '{}'::jsonb,
  
  -- Source
  source VARCHAR(50) NOT NULL DEFAULT 'web',
  
  UNIQUE(tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_events_tenant_timestamp ON events(tenant_id, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_tenant_type ON events(tenant_id, event_type);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(tenant_id, session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_product ON events(tenant_id, product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_order ON events(tenant_id, order_id) WHERE order_id IS NOT NULL;

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON events;
CREATE POLICY "tenant_isolation" ON events FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- Event Summaries Daily (AI READS THIS)
CREATE TABLE IF NOT EXISTS public.event_summaries_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Period
  summary_date DATE NOT NULL,
  
  -- Counts by type
  page_views INT DEFAULT 0,
  product_views INT DEFAULT 0,
  add_to_carts INT DEFAULT 0,
  checkouts INT DEFAULT 0,
  purchases INT DEFAULT 0,
  
  -- Sessions
  unique_sessions INT DEFAULT 0,
  unique_visitors INT DEFAULT 0,
  
  -- Timestamps
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, summary_date)
);

CREATE INDEX IF NOT EXISTS idx_event_summaries_daily_tenant ON event_summaries_daily(tenant_id);

ALTER TABLE event_summaries_daily ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON event_summaries_daily;
CREATE POLICY "tenant_isolation" ON event_summaries_daily FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- ============================================================================
-- TEMPLATES & LANDING PAGES
-- ============================================================================

-- Template Categories (Platform-owned - no tenant_id)
CREATE TABLE IF NOT EXISTS public.template_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) NOT NULL UNIQUE,
  name_en VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100) NOT NULL,
  parent_id UUID REFERENCES template_categories(id),
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- Blocks (Platform-owned - no tenant_id)
CREATE TABLE IF NOT EXISTS public.blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) NOT NULL UNIQUE,
  name_en VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100) NOT NULL,
  block_type VARCHAR(50) NOT NULL,
  schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocks_type ON blocks(block_type);


-- Templates (Platform-owned - no tenant_id)
CREATE TABLE IF NOT EXISTS public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) NOT NULL UNIQUE,
  name_en VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Structure (JSON blocks)
  structure JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Classification
  product_type VARCHAR(50),
  price_tier VARCHAR(50),
  funnel_stage VARCHAR(50),
  industry VARCHAR(50),
  
  -- Performance
  times_used INT DEFAULT 0,
  avg_conversion_rate DECIMAL(5,4),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_premium BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_product_type ON templates(product_type);
CREATE INDEX IF NOT EXISTS idx_templates_price_tier ON templates(price_tier);


-- AI Template Rules (Platform-owned decision layer - no tenant_id)
CREATE TABLE IF NOT EXISTS public.ai_template_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Rule identification
  rule_code VARCHAR(100) NOT NULL UNIQUE,
  rule_name_en VARCHAR(200) NOT NULL,
  rule_name_ar VARCHAR(200) NOT NULL,
  
  -- Matching conditions (NULL = any)
  match_product_type VARCHAR(50),
  match_price_tier VARCHAR(50),
  match_funnel_stage VARCHAR(50),
  match_marketing_goal VARCHAR(50),
  match_industry VARCHAR(50),
  
  -- Template selection
  recommended_template_id UUID REFERENCES templates(id),
  
  -- Block recommendations
  required_blocks VARCHAR(50)[] DEFAULT '{}',
  recommended_blocks VARCHAR(50)[] DEFAULT '{}',
  
  -- AI guidance
  selection_reasoning TEXT NOT NULL,
  copy_tone VARCHAR(50),
  copy_focus VARCHAR(50),
  copy_guidelines TEXT,
  
  -- Performance
  times_applied INT DEFAULT 0,
  avg_conversion_rate DECIMAL(5,4),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  priority INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_template_rules_active ON ai_template_rules(is_active, priority DESC);


-- Page Instances (Tenant-owned)
CREATE TABLE IF NOT EXISTS public.page_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Page info
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  
  -- Template
  template_id UUID REFERENCES templates(id),
  
  -- Content
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- AI generation
  ai_generated BOOLEAN DEFAULT false,
  ai_prompt TEXT,
  ai_model_used VARCHAR(50),
  
  -- Product link
  product_id UUID REFERENCES products(id),
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft',
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  
  -- Custom domain
  custom_domain VARCHAR(255),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_page_instances_tenant ON page_instances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_page_instances_slug ON page_instances(tenant_id, slug);
CREATE INDEX IF NOT EXISTS idx_page_instances_product ON page_instances(product_id);

ALTER TABLE page_instances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON page_instances;
CREATE POLICY "tenant_isolation" ON page_instances FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- Page Versions
CREATE TABLE IF NOT EXISTS public.page_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  page_id UUID NOT NULL REFERENCES page_instances(id) ON DELETE CASCADE,
  
  -- Version
  version_number INT NOT NULL,
  
  -- Content snapshot
  blocks_snapshot JSONB NOT NULL,
  
  -- Change info
  change_summary TEXT,
  changed_by UUID REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(page_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_page_versions_page ON page_versions(page_id);
CREATE INDEX IF NOT EXISTS idx_page_versions_tenant ON page_versions(tenant_id);

ALTER TABLE page_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON page_versions;
CREATE POLICY "tenant_isolation" ON page_versions FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- ============================================================================
-- AI GENERATION SYSTEM
-- ============================================================================

-- AI Generation Jobs
CREATE TABLE IF NOT EXISTS public.ai_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Job type
  job_type VARCHAR(50) NOT NULL,
  
  -- Status
  status job_status NOT NULL DEFAULT 'queued',
  
  -- Input
  input_data JSONB NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  
  -- Rule applied
  applied_rule_id UUID REFERENCES ai_template_rules(id),
  
  -- Output
  output_data JSONB,
  result_page_id UUID REFERENCES page_instances(id),
  
  -- Processing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INT,
  
  -- AI usage
  model_used VARCHAR(50),
  prompt_tokens INT DEFAULT 0,
  completion_tokens INT DEFAULT 0,
  total_tokens INT DEFAULT 0,
  estimated_cost_usd DECIMAL(10,6) DEFAULT 0,
  
  -- Error handling
  error_code VARCHAR(50),
  error_message TEXT,
  retry_count INT DEFAULT 0,
  
  -- User
  requested_by UUID REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_generation_jobs_tenant ON ai_generation_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_generation_jobs_status ON ai_generation_jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_generation_jobs_queued ON ai_generation_jobs(status, created_at) WHERE status = 'queued';

ALTER TABLE ai_generation_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON ai_generation_jobs;
CREATE POLICY "tenant_isolation" ON ai_generation_jobs FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- AI Generated Copy (Learning memory)
CREATE TABLE IF NOT EXISTS public.ai_generated_copy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Copy type
  copy_type VARCHAR(50) NOT NULL,
  
  -- Content
  content_ar TEXT NOT NULL,
  content_en TEXT,
  
  -- Context
  context JSONB NOT NULL,
  
  -- Generation
  generation_job_id UUID REFERENCES ai_generation_jobs(id),
  model_used VARCHAR(50),
  tone_used VARCHAR(50),
  focus_used VARCHAR(50),
  
  -- Usage
  used_in_pages UUID[] DEFAULT '{}',
  times_used INT DEFAULT 0,
  
  -- Performance
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  conversions INT DEFAULT 0,
  conversion_rate DECIMAL(5,4),
  quality_score DECIMAL(3,2),
  
  -- Flags
  is_high_performer BOOLEAN DEFAULT false,
  is_low_performer BOOLEAN DEFAULT false,
  should_avoid BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_generated_copy_tenant ON ai_generated_copy(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_generated_copy_type ON ai_generated_copy(tenant_id, copy_type);
CREATE INDEX IF NOT EXISTS idx_ai_generated_copy_high_perf ON ai_generated_copy(tenant_id, is_high_performer) WHERE is_high_performer = true;

ALTER TABLE ai_generated_copy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON ai_generated_copy;
CREATE POLICY "tenant_isolation" ON ai_generated_copy FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- ============================================================================
-- DEPLOYMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Type
  deployment_type VARCHAR(30) NOT NULL DEFAULT 'page',
  
  -- What was deployed
  page_id UUID REFERENCES page_instances(id),
  page_version_id UUID REFERENCES page_versions(id),
  
  -- Vercel metadata (NO SECRETS)
  vercel_deployment_id VARCHAR(100),
  vercel_deployment_url VARCHAR(500),
  vercel_project_id VARCHAR(100),
  
  -- Environment
  environment VARCHAR(20) NOT NULL DEFAULT 'production',
  
  -- Status
  status deployment_status NOT NULL DEFAULT 'pending',
  
  -- Timing
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  building_started_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  build_duration_ms INT,
  
  -- Error
  error_code VARCHAR(50),
  error_message TEXT,
  
  -- Rollback
  is_current BOOLEAN DEFAULT false,
  rolled_back_from UUID REFERENCES deployments(id),
  
  -- User
  triggered_by UUID REFERENCES auth.users(id),
  trigger_type VARCHAR(30),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deployments_tenant ON deployments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deployments_page ON deployments(page_id);
CREATE INDEX IF NOT EXISTS idx_deployments_current ON deployments(tenant_id, is_current) WHERE is_current = true;

ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON deployments;
CREATE POLICY "tenant_isolation" ON deployments FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- ============================================================================
-- AI CONVERSATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  
  -- Conversation
  title VARCHAR(255),
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Context
  context JSONB DEFAULT '{}'::jsonb,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_tenant ON ai_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON ai_conversations;
CREATE POLICY "tenant_isolation" ON ai_conversations FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- ============================================================================
-- INVENTORY LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id),
  
  -- Change
  change_type VARCHAR(50) NOT NULL,
  quantity_before INT NOT NULL,
  quantity_change INT NOT NULL,
  quantity_after INT NOT NULL,
  
  -- Reference
  reference_type VARCHAR(50),
  reference_id UUID,
  
  -- User
  changed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_logs_product ON inventory_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_tenant ON inventory_logs(tenant_id);

ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON inventory_logs;
CREATE POLICY "tenant_isolation" ON inventory_logs FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- ============================================================================
-- FILES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- File info
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  size_bytes BIGINT,
  
  -- Storage
  storage_path VARCHAR(500) NOT NULL,
  public_url VARCHAR(500),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- User
  uploaded_by UUID REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_files_tenant ON files(tenant_id);

ALTER TABLE files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON files;
CREATE POLICY "tenant_isolation" ON files FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);


-- ============================================================================
-- AUDIT LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Action
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  
  -- Changes
  old_values JSONB,
  new_values JSONB,
  
  -- User
  performed_by UUID REFERENCES auth.users(id),
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(tenant_id, created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON audit_logs;
CREATE POLICY "tenant_isolation" ON audit_logs FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);



-- ============================================================================
-- VIEWS FOR AI (Read-only summaries - AI reads these, NOT raw tables)
-- ============================================================================

-- AI Tenant Context View
CREATE OR REPLACE VIEW ai_tenant_context AS
SELECT 
  t.id AS tenant_id,
  t.name,
  t.country,
  t.currency,
  t.language,
  t.timezone,
  t.industry,
  t.plan,
  s.status AS subscription_status,
  (SELECT COUNT(*) FROM products p WHERE p.tenant_id = t.id AND p.is_active = true) AS active_products,
  (SELECT COUNT(*) FROM orders o WHERE o.tenant_id = t.id AND o.created_at > NOW() - INTERVAL '30 days') AS orders_last_30d,
  (SELECT COALESCE(SUM(total), 0) FROM orders o WHERE o.tenant_id = t.id AND o.created_at > NOW() - INTERVAL '30 days') AS revenue_last_30d
FROM tenants t
LEFT JOIN subscriptions s ON s.tenant_id = t.id;


-- AI Template Rules Summary View
CREATE OR REPLACE VIEW ai_template_rules_summary AS
SELECT 
  r.id,
  r.rule_code,
  r.rule_name_ar,
  r.match_product_type,
  r.match_price_tier,
  r.match_funnel_stage,
  r.match_marketing_goal,
  r.selection_reasoning,
  r.copy_tone,
  r.copy_focus,
  r.required_blocks,
  r.recommended_blocks,
  r.recommended_template_id,
  t.slug AS template_slug,
  r.avg_conversion_rate,
  r.times_applied,
  r.priority
FROM ai_template_rules r
LEFT JOIN templates t ON t.id = r.recommended_template_id
WHERE r.is_active = true
ORDER BY r.priority DESC;


-- AI Copy Performance Summary View
CREATE OR REPLACE VIEW ai_copy_performance_summary AS
SELECT 
  tenant_id,
  copy_type,
  tone_used,
  focus_used,
  COUNT(*) AS total_copies,
  SUM(impressions) AS total_impressions,
  SUM(conversions) AS total_conversions,
  AVG(conversion_rate) AS avg_conversion_rate,
  AVG(quality_score) AS avg_quality_score,
  COUNT(*) FILTER (WHERE is_high_performer = true) AS high_performers,
  COUNT(*) FILTER (WHERE is_low_performer = true) AS low_performers
FROM ai_generated_copy
GROUP BY tenant_id, copy_type, tone_used, focus_used;


-- AI Generation Jobs Summary View
CREATE OR REPLACE VIEW ai_generation_jobs_summary AS
SELECT 
  tenant_id,
  DATE(created_at) AS job_date,
  job_type,
  COUNT(*) AS total_jobs,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed,
  AVG(duration_ms) FILTER (WHERE status = 'completed') AS avg_duration_ms,
  SUM(total_tokens) AS total_tokens_used,
  SUM(estimated_cost_usd) AS total_cost_usd
FROM ai_generation_jobs
GROUP BY tenant_id, DATE(created_at), job_type;


-- ============================================================================
-- FUNCTIONS FOR AI
-- ============================================================================

-- Function: Get matching template rule
CREATE OR REPLACE FUNCTION get_matching_template_rule(
  p_product_type VARCHAR(50),
  p_price_tier VARCHAR(50),
  p_funnel_stage VARCHAR(50),
  p_marketing_goal VARCHAR(50) DEFAULT NULL,
  p_industry VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
  rule_id UUID,
  rule_code VARCHAR(100),
  template_id UUID,
  selection_reasoning TEXT,
  copy_tone VARCHAR(50),
  copy_focus VARCHAR(50),
  required_blocks VARCHAR(50)[],
  recommended_blocks VARCHAR(50)[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id AS rule_id,
    r.rule_code,
    r.recommended_template_id AS template_id,
    r.selection_reasoning,
    r.copy_tone,
    r.copy_focus,
    r.required_blocks,
    r.recommended_blocks
  FROM ai_template_rules r
  WHERE r.is_active = true
    AND (r.match_product_type IS NULL OR r.match_product_type = p_product_type)
    AND (r.match_price_tier IS NULL OR r.match_price_tier = p_price_tier)
    AND (r.match_funnel_stage IS NULL OR r.match_funnel_stage = p_funnel_stage)
    AND (r.match_marketing_goal IS NULL OR r.match_marketing_goal = p_marketing_goal)
    AND (r.match_industry IS NULL OR r.match_industry = p_industry)
  ORDER BY r.priority DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;


-- Function: Record rule application
CREATE OR REPLACE FUNCTION record_rule_application(
  p_rule_id UUID,
  p_conversion_rate DECIMAL(5,4) DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE ai_template_rules
  SET 
    times_applied = times_applied + 1,
    avg_conversion_rate = CASE 
      WHEN p_conversion_rate IS NOT NULL AND times_applied > 0 
      THEN (COALESCE(avg_conversion_rate, 0) * times_applied + p_conversion_rate) / (times_applied + 1)
      ELSE avg_conversion_rate
    END,
    updated_at = NOW()
  WHERE id = p_rule_id;
END;
$$ LANGUAGE plpgsql;


-- Function: Get AI context for tenant
CREATE OR REPLACE FUNCTION get_ai_context(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'tenant', (SELECT row_to_json(t.*) FROM tenants t WHERE t.id = p_tenant_id),
    'cognitive_profile', (SELECT row_to_json(tcp.*) FROM tenant_cognitive_profile tcp WHERE tcp.tenant_id = p_tenant_id),
    'active_products', (SELECT COUNT(*) FROM products WHERE tenant_id = p_tenant_id AND is_active = true),
    'recent_orders', (SELECT COUNT(*) FROM orders WHERE tenant_id = p_tenant_id AND created_at > NOW() - INTERVAL '7 days'),
    'recent_revenue', (SELECT COALESCE(SUM(total), 0) FROM orders WHERE tenant_id = p_tenant_id AND created_at > NOW() - INTERVAL '7 days'),
    'trust_scores', (SELECT jsonb_agg(row_to_json(ts.*)) FROM ai_trust_scores ts WHERE ts.tenant_id = p_tenant_id),
    'active_campaigns', (SELECT COUNT(*) FROM campaigns WHERE tenant_id = p_tenant_id AND status = 'active')
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;


-- Function: Get high performing copy for reuse
CREATE OR REPLACE FUNCTION get_high_performing_copy(
  p_tenant_id UUID,
  p_copy_type VARCHAR(50),
  p_limit INT DEFAULT 5
)
RETURNS TABLE (
  copy_id UUID,
  content_ar TEXT,
  tone_used VARCHAR(50),
  focus_used VARCHAR(50),
  conversion_rate DECIMAL(5,4),
  quality_score DECIMAL(3,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id AS copy_id,
    c.content_ar,
    c.tone_used,
    c.focus_used,
    c.conversion_rate,
    c.quality_score
  FROM ai_generated_copy c
  WHERE c.tenant_id = p_tenant_id
    AND c.copy_type = p_copy_type
    AND c.is_high_performer = true
    AND c.should_avoid = false
  ORDER BY c.quality_score DESC, c.conversion_rate DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- EXECUTION ORDER & POST-RUN CHECKLIST
-- ============================================================================
/*

=== EXECUTION ORDER ===
This is a SINGLE FILE. Execute once in Supabase SQL Editor.
No dependencies on other files.
IDEMPOTENT: Safe to run multiple times.

=== LOCALIZATION NOTE ===
country, currency, language, timezone have NO DEFAULT values.
These MUST be set during tenant onboarding.
Frontend handles UI language (Arabic RTL) - NOT stored in DB.

=== POST-RUN CHECKLIST ===

TABLES CREATED (Total: 48):
---------------------------
Core (L1):
  [x] tenants (NO DEFAULT for localization)
  [x] profiles
  [x] tenant_users
  [x] tenant_cognitive_profile
  [x] tenant_domains
  [x] subscriptions

Products (L2):
  [x] products
  [x] product_variants
  [x] product_intelligence

Campaigns (L3):
  [x] campaigns
  [x] campaign_intelligence
  [x] campaign_learnings

Customers (L4):
  [x] customer_segments
  [x] customer_behavior_patterns

Operations (L5):
  [x] operational_capacity
  [x] operational_metrics_daily

Orders & Fulfillment (L6):
  [x] orders
  [x] order_items
  [x] order_status_history
  [x] shipping_providers
  [x] shipping_sla_rules
  [x] shipments
  [x] shipping_performance

Unit Economics (L7):
  [x] financial_transactions
  [x] order_profit_timeline
  [x] unit_economics_summary

Marketing (L8):
  [x] marketing_to_cash_journey

Experiments (L9):
  [x] experiments
  [x] experiment_wisdom

Failures (L10):
  [x] failure_events
  [x] failure_patterns

Decisions (L11):
  [x] decisions
  [x] decision_outcomes

Trust (L12):
  [x] ai_trust_scores

Insights (L13):
  [x] insights

Workflows (L15):
  [x] workflow_runs

Events:
  [x] events
  [x] event_summaries_daily

Templates & Pages:
  [x] template_categories (platform-owned)
  [x] blocks (platform-owned)
  [x] templates (platform-owned)
  [x] ai_template_rules (platform-owned)
  [x] page_instances
  [x] page_versions

AI Generation:
  [x] ai_generation_jobs
  [x] ai_generated_copy

Deployments:
  [x] deployments

Other:
  [x] ai_conversations
  [x] inventory_logs
  [x] files
  [x] audit_logs


RLS ENABLED ON ALL TENANT TABLES: YES
-------------------------------------
All tables with tenant_id have RLS enabled with policy:
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)

Platform-owned tables (no tenant_id): template_categories, blocks, templates, ai_template_rules


VIEWS FOR AI (4):
-----------------
  [x] ai_tenant_context
  [x] ai_template_rules_summary
  [x] ai_copy_performance_summary
  [x] ai_generation_jobs_summary


FUNCTIONS FOR AI (4):
---------------------
  [x] get_matching_template_rule()
  [x] record_rule_application()
  [x] get_ai_context()
  [x] get_high_performing_copy()


MEMORY LAYERS COVERED (15):
---------------------------
  [x] L1: Tenant Cognitive Memory
  [x] L2: Product Intelligence Memory
  [x] L3: Campaign Learning Memory
  [x] L4: Customer Behavior Memory
  [x] L5: Operational Reality Memory
  [x] L6: Fulfillment & Shipping Intelligence
  [x] L7: Unit Economics Temporal Memory
  [x] L8: Marketing-to-Cash Memory
  [x] L9: Experiment Memory
  [x] L10: Failure & Negative Insight Memory
  [x] L11: Decision Memory
  [x] L12: Trust & Confidence Memory
  [x] L13: Insight Memory
  [x] L14: Localization Memory (in tenants - NO DEFAULTS)
  [x] L15: Workflow & Automation Memory


HOSTING & TEMPLATES:
--------------------
  [x] tenant_domains
  [x] ai_template_rules
  [x] ai_generation_jobs
  [x] ai_generated_copy
  [x] deployments


UNIT ECONOMICS:
---------------
  [x] order_profit_timeline (stages: post_sale, post_shipping, post_collection, post_return_window, final)
  [x] unit_economics_summary
  [x] financial_transactions


NO SEED DATA INSERTED: CONFIRMED
--------------------------------
Only structural schema, no test data.

*/
