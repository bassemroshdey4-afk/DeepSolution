-- ============================================================================
-- DeepSolution: 01_schema.sql
-- Purpose: Create all tables in correct FK dependency order
-- Run Order: 2 of 3 (run AFTER 00_preflight.sql)
-- ============================================================================
--
-- LOCALIZATION NOTE:
-- country, currency, language, timezone are NULLABLE (no defaults).
-- Set per tenant during onboarding. Frontend handles UI language.
--
-- FK DEPENDENCY ORDER:
-- 1. tenants (no dependencies)
-- 2. profiles (depends on auth.users)
-- 3. tenant_users (depends on tenants, auth.users)
-- 4. All other tables (depend on tenants)
--
-- ============================================================================

SET search_path TO public, auth;

-- ============================================================================
-- CUSTOM TYPES (Idempotent with duplicate handling)
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
-- TIER 1: BASE TABLES (No FK dependencies on other custom tables)
-- ============================================================================

-- 1.1 Tenants (MUST be created FIRST - all other tables depend on this)
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(63) NOT NULL UNIQUE,
  custom_domain VARCHAR(255),
  
  -- Localization (NULLABLE - set per tenant during onboarding)
  country VARCHAR(2),
  currency VARCHAR(3),
  language VARCHAR(5),
  timezone VARCHAR(50),
  
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


-- 1.2 Profiles (depends on auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic info
  full_name VARCHAR(255),
  avatar_url VARCHAR(500),
  phone VARCHAR(20),
  
  -- Preferences (NULLABLE)
  language VARCHAR(5),
  timezone VARCHAR(50),
  
  -- Default tenant (optional)
  default_tenant_id UUID,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- TIER 2: TENANT-USER JUNCTION (Depends on tenants + auth.users)
-- ============================================================================

-- 2.1 Tenant Users (CRITICAL - must exist before any RLS policies work)
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
CREATE INDEX IF NOT EXISTS idx_tenant_users_active ON tenant_users(user_id, is_active);


-- ============================================================================
-- TIER 3: TENANT-OWNED TABLES (Depend on tenants)
-- ============================================================================

-- 3.1 Tenant Cognitive Profile
CREATE TABLE IF NOT EXISTS public.tenant_cognitive_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  
  -- Business DNA
  business_type VARCHAR(50),
  industry VARCHAR(100),
  business_model VARCHAR(50),
  avg_order_value INT,
  avg_margin_percentage DECIMAL(5,2),
  
  -- Behavioral patterns
  peak_hours JSONB DEFAULT '[]'::jsonb,
  peak_days JSONB DEFAULT '[]'::jsonb,
  seasonal_patterns JSONB DEFAULT '{}'::jsonb,
  
  -- Preferences
  preferred_shipping_providers JSONB DEFAULT '[]'::jsonb,
  preferred_payment_methods JSONB DEFAULT '[]'::jsonb,
  risk_tolerance VARCHAR(20) DEFAULT 'medium',
  
  -- AI interaction
  ai_communication_style VARCHAR(20) DEFAULT 'detailed',
  ai_autonomy_level VARCHAR(20) DEFAULT 'suggest',
  
  -- Confidence
  profile_confidence DECIMAL(3,2) DEFAULT 0.5,
  last_profile_update TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_cognitive_profile_tenant ON tenant_cognitive_profile(tenant_id);


-- 3.2 Tenant Domains
CREATE TABLE IF NOT EXISTS public.tenant_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  domain VARCHAR(255) NOT NULL UNIQUE,
  domain_type VARCHAR(20) NOT NULL DEFAULT 'subdomain',
  
  is_verified BOOLEAN DEFAULT false,
  verification_token VARCHAR(100),
  verified_at TIMESTAMPTZ,
  
  ssl_status VARCHAR(20) DEFAULT 'pending',
  
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  vercel_domain_id VARCHAR(100),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_domains_tenant ON tenant_domains(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_domains_domain ON tenant_domains(domain);


-- 3.3 Subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  plan_id VARCHAR(50) NOT NULL,
  status subscription_status NOT NULL DEFAULT 'trial',
  
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  
  limits JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);


-- 3.4 Products
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  sku VARCHAR(100),
  name_ar VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),
  description_ar TEXT,
  description_en TEXT,
  
  cost_price DECIMAL(12,2),
  selling_price DECIMAL(12,2) NOT NULL,
  compare_at_price DECIMAL(12,2),
  
  stock_quantity INT DEFAULT 0,
  low_stock_threshold INT DEFAULT 5,
  
  product_type VARCHAR(50),
  price_tier VARCHAR(20),
  category VARCHAR(100),
  
  images JSONB DEFAULT '[]'::jsonb,
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(tenant_id, sku);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(tenant_id, is_active);


-- 3.5 Product Variants
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  sku VARCHAR(100),
  name VARCHAR(255),
  options JSONB DEFAULT '{}'::jsonb,
  
  price DECIMAL(12,2),
  cost_price DECIMAL(12,2),
  
  stock_quantity INT DEFAULT 0,
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_tenant ON product_variants(tenant_id);


-- 3.6 Product Intelligence
CREATE TABLE IF NOT EXISTS public.product_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  total_units_sold INT DEFAULT 0,
  total_revenue DECIMAL(14,2) DEFAULT 0,
  total_profit DECIMAL(14,2) DEFAULT 0,
  conversion_rate DECIMAL(5,4),
  
  sales_velocity_daily DECIMAL(10,2) DEFAULT 0,
  sales_trend VARCHAR(20),
  
  days_of_stock INT,
  stockout_risk VARCHAR(20),
  reorder_point INT,
  
  price_elasticity DECIMAL(5,2),
  optimal_price_suggestion DECIMAL(12,2),
  
  performance_tier VARCHAR(20),
  ai_recommendations JSONB DEFAULT '[]'::jsonb,
  
  intelligence_confidence DECIMAL(3,2) DEFAULT 0.5,
  
  period_start DATE,
  period_end DATE,
  
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, product_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_product_intelligence_tenant ON product_intelligence(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_intelligence_product ON product_intelligence(product_id);


-- 3.7 Campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  platform VARCHAR(50),
  external_id VARCHAR(255),
  
  budget DECIMAL(12,2),
  budget_spent DECIMAL(12,2) DEFAULT 0,
  
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  conversions INT DEFAULT 0,
  revenue DECIMAL(14,2) DEFAULT 0,
  
  ctr DECIMAL(5,4),
  cpc DECIMAL(10,4),
  cpa DECIMAL(10,2),
  roas DECIMAL(10,4),
  
  status VARCHAR(20) DEFAULT 'active',
  
  start_date DATE,
  end_date DATE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_platform ON campaigns(tenant_id, platform);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(tenant_id, status);


-- 3.8 Campaign Intelligence
CREATE TABLE IF NOT EXISTS public.campaign_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  
  total_spend DECIMAL(14,2) DEFAULT 0,
  total_revenue DECIMAL(14,2) DEFAULT 0,
  total_profit DECIMAL(14,2) DEFAULT 0,
  overall_roas DECIMAL(10,4),
  true_roas DECIMAL(10,4),
  
  best_performing_hours JSONB DEFAULT '[]'::jsonb,
  best_performing_days JSONB DEFAULT '[]'::jsonb,
  best_audience_segments JSONB DEFAULT '[]'::jsonb,
  
  performance_trend VARCHAR(20),
  scaling_potential VARCHAR(20),
  recommended_daily_budget DECIMAL(12,2),
  ai_recommendations JSONB DEFAULT '[]'::jsonb,
  
  intelligence_confidence DECIMAL(3,2) DEFAULT 0.5,
  
  period_start DATE,
  period_end DATE,
  
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, campaign_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_campaign_intelligence_tenant ON campaign_intelligence(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaign_intelligence_campaign ON campaign_intelligence(campaign_id);


-- 3.9 Campaign Learnings
CREATE TABLE IF NOT EXISTS public.campaign_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  platform VARCHAR(30),
  campaign_type VARCHAR(50),
  
  learning_type VARCHAR(50) NOT NULL,
  learning TEXT NOT NULL,
  
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  sample_size INT DEFAULT 0,
  
  applies_when JSONB DEFAULT '{}'::jsonb,
  does_not_apply_when JSONB DEFAULT '{}'::jsonb,
  
  confidence DECIMAL(3,2) DEFAULT 0.5,
  times_validated INT DEFAULT 1,
  times_contradicted INT DEFAULT 0,
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_learnings_tenant ON campaign_learnings(tenant_id);


-- 3.10 Customer Segments
CREATE TABLE IF NOT EXISTS public.customer_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  segment_type VARCHAR(50),
  
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  customer_count INT DEFAULT 0,
  percentage_of_total DECIMAL(5,2),
  avg_order_value DECIMAL(12,2),
  avg_lifetime_value DECIMAL(14,2),
  avg_orders_per_customer DECIMAL(5,2),
  
  avg_days_between_orders DECIMAL(10,2),
  preferred_products JSONB DEFAULT '[]'::jsonb,
  preferred_channels JSONB DEFAULT '[]'::jsonb,
  churn_risk VARCHAR(20),
  
  ai_recommendations JSONB DEFAULT '[]'::jsonb,
  
  is_active BOOLEAN DEFAULT true,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_segments_tenant ON customer_segments(tenant_id);


-- 3.11 Customer Behavior Patterns
CREATE TABLE IF NOT EXISTS public.customer_behavior_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  pattern_type VARCHAR(50) NOT NULL,
  pattern_name VARCHAR(255) NOT NULL,
  
  pattern_data JSONB NOT NULL,
  
  sample_size INT DEFAULT 0,
  confidence DECIMAL(3,2) DEFAULT 0.5,
  
  estimated_revenue_impact DECIMAL(14,2),
  estimated_conversion_impact DECIMAL(5,2),
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_behavior_patterns_tenant ON customer_behavior_patterns(tenant_id);


-- 3.12 Operational Capacity
CREATE TABLE IF NOT EXISTS public.operational_capacity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  
  max_daily_orders INT,
  current_daily_capacity_used INT DEFAULT 0,
  capacity_utilization DECIMAL(5,2),
  
  call_agents_count INT DEFAULT 1,
  calls_per_agent_per_day INT DEFAULT 50,
  current_call_backlog INT DEFAULT 0,
  
  warehouse_capacity_units INT,
  current_inventory_units INT DEFAULT 0,
  packing_capacity_per_day INT,
  
  active_constraints JSONB DEFAULT '[]'::jsonb,
  
  avg_order_processing_hours DECIMAL(10,2),
  avg_call_response_minutes DECIMAL(10,2),
  
  last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operational_capacity_tenant ON operational_capacity(tenant_id);


-- 3.13 Operational Metrics Daily
CREATE TABLE IF NOT EXISTS public.operational_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  
  orders_received INT DEFAULT 0,
  orders_confirmed INT DEFAULT 0,
  orders_shipped INT DEFAULT 0,
  orders_delivered INT DEFAULT 0,
  orders_cancelled INT DEFAULT 0,
  orders_returned INT DEFAULT 0,
  
  calls_made INT DEFAULT 0,
  calls_answered INT DEFAULT 0,
  confirmation_rate DECIMAL(5,4),
  avg_call_duration_seconds INT,
  
  avg_processing_hours DECIMAL(10,2),
  on_time_shipping_rate DECIMAL(5,4),
  
  customer_complaints INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_operational_metrics_daily_tenant ON operational_metrics_daily(tenant_id);


-- 3.14 Shipping Providers
CREATE TABLE IF NOT EXISTS public.shipping_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL,
  
  config JSONB DEFAULT '{}'::jsonb,
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_shipping_providers_tenant ON shipping_providers(tenant_id);


-- 3.15 Shipping SLA Rules
CREATE TABLE IF NOT EXISTS public.shipping_sla_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES shipping_providers(id) ON DELETE CASCADE,
  
  rule_name VARCHAR(100) NOT NULL,
  
  from_region VARCHAR(100),
  to_region VARCHAR(100),
  
  expected_days INT NOT NULL,
  max_days INT NOT NULL,
  
  base_cost DECIMAL(10,2),
  cost_per_kg DECIMAL(10,2),
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipping_sla_rules_tenant ON shipping_sla_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shipping_sla_rules_provider ON shipping_sla_rules(provider_id);



-- ============================================================================
-- TIER 4: ORDERS & FULFILLMENT (Depend on tenants, campaigns, products)
-- ============================================================================

-- 4.1 Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  order_number VARCHAR(50) NOT NULL,
  
  customer_phone VARCHAR(20),
  customer_name VARCHAR(255),
  customer_email VARCHAR(320),
  
  shipping_address TEXT,
  shipping_city VARCHAR(100),
  shipping_region VARCHAR(100),
  shipping_country VARCHAR(2),
  
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  subtotal DECIMAL(12,2) NOT NULL,
  shipping_cost DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  
  status order_status NOT NULL DEFAULT 'pending',
  call_status call_status DEFAULT 'pending',
  payment_status payment_status DEFAULT 'pending',
  
  payment_method VARCHAR(50),
  
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(255),
  utm_content VARCHAR(255),
  utm_term VARCHAR(255),
  ad_id VARCHAR(255),
  ad_group_id VARCHAR(255),
  campaign_id UUID REFERENCES campaigns(id),
  landing_page_id UUID,
  
  call_attempts INT DEFAULT 0,
  last_call_at TIMESTAMPTZ,
  call_notes TEXT,
  
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


-- 4.2 Order Items
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  
  sku VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  total_price DECIMAL(12,2) NOT NULL,
  cost_price DECIMAL(12,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_tenant ON order_items(tenant_id);


-- 4.3 Order Status History
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  from_status VARCHAR(50),
  to_status VARCHAR(50) NOT NULL,
  
  changed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_tenant ON order_status_history(tenant_id);


-- 4.4 Shipments
CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES shipping_providers(id),
  
  tracking_number VARCHAR(100),
  
  status VARCHAR(50) DEFAULT 'pending',
  
  shipped_at TIMESTAMPTZ,
  estimated_delivery TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  sla_rule_id UUID REFERENCES shipping_sla_rules(id),
  sla_expected_date DATE,
  sla_met BOOLEAN,
  
  shipping_cost DECIMAL(10,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tenant ON shipments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_provider ON shipments(provider_id);


-- 4.5 Shipping Performance
CREATE TABLE IF NOT EXISTS public.shipping_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES shipping_providers(id) ON DELETE CASCADE,
  
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  total_shipments INT DEFAULT 0,
  delivered_on_time INT DEFAULT 0,
  delivered_late INT DEFAULT 0,
  lost_shipments INT DEFAULT 0,
  returned_shipments INT DEFAULT 0,
  
  on_time_rate DECIMAL(5,4),
  lost_rate DECIMAL(5,4),
  return_rate DECIMAL(5,4),
  avg_delivery_days DECIMAL(5,2),
  
  shipping_score DECIMAL(5,2),
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, provider_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_shipping_performance_tenant ON shipping_performance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shipping_performance_provider ON shipping_performance(provider_id);


-- ============================================================================
-- TIER 5: FINANCIAL & ECONOMICS TABLES
-- ============================================================================

-- 5.1 Financial Transactions
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  transaction_type VARCHAR(50) NOT NULL,
  
  amount DECIMAL(14,2) NOT NULL,
  currency VARCHAR(3),
  
  order_id UUID REFERENCES orders(id),
  product_id UUID REFERENCES products(id),
  campaign_id UUID REFERENCES campaigns(id),
  
  metadata JSONB DEFAULT '{}'::jsonb,
  
  transaction_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_tenant ON financial_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_date ON financial_transactions(tenant_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_order ON financial_transactions(order_id);


-- 5.2 Order Profit Timeline
CREATE TABLE IF NOT EXISTS public.order_profit_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  stage VARCHAR(30) NOT NULL,
  
  revenue DECIMAL(14,2) NOT NULL,
  product_cost DECIMAL(14,2) DEFAULT 0,
  shipping_cost DECIMAL(14,2) DEFAULT 0,
  marketing_cost DECIMAL(14,2) DEFAULT 0,
  operational_cost DECIMAL(14,2) DEFAULT 0,
  return_cost DECIMAL(14,2) DEFAULT 0,
  
  gross_profit DECIMAL(14,2),
  net_profit DECIMAL(14,2),
  net_margin DECIMAL(5,4),
  
  confidence DECIMAL(3,2) DEFAULT 1.0,
  
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, order_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_order_profit_timeline_tenant ON order_profit_timeline(tenant_id);
CREATE INDEX IF NOT EXISTS idx_order_profit_timeline_order ON order_profit_timeline(order_id);
CREATE INDEX IF NOT EXISTS idx_order_profit_timeline_stage ON order_profit_timeline(stage);


-- 5.3 Unit Economics Summary
CREATE TABLE IF NOT EXISTS public.unit_economics_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  period_type VARCHAR(20) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  total_orders INT DEFAULT 0,
  total_revenue DECIMAL(14,2) DEFAULT 0,
  total_costs DECIMAL(14,2) DEFAULT 0,
  total_profit DECIMAL(14,2) DEFAULT 0,
  
  total_product_cost DECIMAL(14,2) DEFAULT 0,
  total_shipping_cost DECIMAL(14,2) DEFAULT 0,
  total_marketing_cost DECIMAL(14,2) DEFAULT 0,
  total_operational_cost DECIMAL(14,2) DEFAULT 0,
  total_return_cost DECIMAL(14,2) DEFAULT 0,
  
  avg_order_value DECIMAL(12,2),
  avg_profit_per_order DECIMAL(12,2),
  avg_margin DECIMAL(5,4),
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, period_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_unit_economics_summary_tenant ON unit_economics_summary(tenant_id);


-- 5.4 Marketing to Cash Journey
CREATE TABLE IF NOT EXISTS public.marketing_to_cash_journey (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  campaign_id UUID REFERENCES campaigns(id),
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
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
  
  ad_spend DECIMAL(14,2) DEFAULT 0,
  revenue DECIMAL(14,2) DEFAULT 0,
  collected_cash DECIMAL(14,2) DEFAULT 0,
  
  cost_per_click DECIMAL(10,4),
  cost_per_order DECIMAL(10,2),
  roas DECIMAL(10,4),
  cash_roas DECIMAL(10,4),
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, campaign_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_marketing_to_cash_tenant ON marketing_to_cash_journey(tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketing_to_cash_campaign ON marketing_to_cash_journey(campaign_id);



-- ============================================================================
-- TIER 6: EXPERIMENTS, DECISIONS, TRUST, INSIGHTS
-- ============================================================================

-- 6.1 Experiments
CREATE TABLE IF NOT EXISTS public.experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  hypothesis TEXT,
  experiment_type VARCHAR(50),
  
  variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  status VARCHAR(20) DEFAULT 'draft',
  
  winner_variant VARCHAR(50),
  confidence_level DECIMAL(5,4),
  
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_experiments_tenant ON experiments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(tenant_id, status);


-- 6.2 Experiment Wisdom
CREATE TABLE IF NOT EXISTS public.experiment_wisdom (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  experiment_id UUID REFERENCES experiments(id),
  
  learning_type VARCHAR(50) NOT NULL,
  insight TEXT NOT NULL,
  
  applies_to JSONB DEFAULT '{}'::jsonb,
  
  confidence DECIMAL(3,2),
  evidence_count INT DEFAULT 1,
  
  is_validated BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_experiment_wisdom_tenant ON experiment_wisdom(tenant_id);


-- 6.3 Failure Events
CREATE TABLE IF NOT EXISTS public.failure_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  failure_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  is_resolved BOOLEAN DEFAULT false,
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_failure_events_tenant ON failure_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_failure_events_type ON failure_events(tenant_id, failure_type);


-- 6.4 Failure Patterns
CREATE TABLE IF NOT EXISTS public.failure_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  pattern_type VARCHAR(50) NOT NULL,
  pattern_description TEXT NOT NULL,
  
  occurrence_count INT DEFAULT 1,
  last_occurred_at TIMESTAMPTZ,
  
  prevention_strategy TEXT,
  is_prevented BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_failure_patterns_tenant ON failure_patterns(tenant_id);


-- 6.5 Decisions
CREATE TABLE IF NOT EXISTS public.decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  decision_type VARCHAR(50) NOT NULL,
  decision_maker VARCHAR(20) NOT NULL,
  
  input_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  decision_made JSONB NOT NULL,
  reasoning TEXT,
  
  expected_outcome JSONB,
  confidence DECIMAL(3,2),
  
  decided_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decisions_tenant ON decisions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_decisions_type ON decisions(tenant_id, decision_type);


-- 6.6 Decision Outcomes
CREATE TABLE IF NOT EXISTS public.decision_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  
  actual_outcome JSONB NOT NULL,
  
  was_successful BOOLEAN,
  accuracy_score DECIMAL(3,2),
  
  lesson_learned TEXT,
  
  measured_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decision_outcomes_decision ON decision_outcomes(decision_id);
CREATE INDEX IF NOT EXISTS idx_decision_outcomes_tenant ON decision_outcomes(tenant_id);


-- 6.7 AI Trust Scores
CREATE TABLE IF NOT EXISTS public.ai_trust_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  domain VARCHAR(50) NOT NULL,
  
  accuracy_score DECIMAL(3,2) DEFAULT 0.5,
  reliability_score DECIMAL(3,2) DEFAULT 0.5,
  overall_trust DECIMAL(3,2) DEFAULT 0.5,
  
  total_predictions INT DEFAULT 0,
  correct_predictions INT DEFAULT 0,
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_ai_trust_scores_tenant ON ai_trust_scores(tenant_id);


-- 6.8 Insights
CREATE TABLE IF NOT EXISTS public.insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  insight_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  
  evidence JSONB DEFAULT '[]'::jsonb,
  confidence DECIMAL(3,2),
  
  recommended_actions JSONB DEFAULT '[]'::jsonb,
  priority VARCHAR(20),
  
  is_acknowledged BOOLEAN DEFAULT false,
  is_acted_upon BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_insights_tenant ON insights(tenant_id);
CREATE INDEX IF NOT EXISTS idx_insights_type ON insights(tenant_id, insight_type);


-- 6.9 Workflow Runs
CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  workflow_id VARCHAR(100) NOT NULL,
  workflow_name VARCHAR(255),
  
  idempotency_key VARCHAR(255),
  
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INT,
  
  retry_count INT DEFAULT 0,
  is_dead_letter BOOLEAN DEFAULT false,
  
  UNIQUE(tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_tenant ON workflow_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(tenant_id, status);


-- ============================================================================
-- TIER 7: EVENTS (Immutable stream)
-- ============================================================================

-- 7.1 Events
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  idempotency_key VARCHAR(255) NOT NULL,
  
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  event_type VARCHAR(100) NOT NULL,
  event_category VARCHAR(50) NOT NULL,
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  session_id VARCHAR(100),
  anonymous_id VARCHAR(100),
  customer_id UUID,
  user_id UUID REFERENCES auth.users(id),
  
  product_id UUID,
  order_id UUID,
  campaign_id UUID,
  landing_page_id UUID,
  
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(255),
  utm_content VARCHAR(255),
  utm_term VARCHAR(255),
  ad_id VARCHAR(255),
  ad_group_id VARCHAR(255),
  
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  context JSONB DEFAULT '{}'::jsonb,
  
  source VARCHAR(50) NOT NULL DEFAULT 'web',
  
  UNIQUE(tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_events_tenant_timestamp ON events(tenant_id, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_tenant_type ON events(tenant_id, event_type);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(tenant_id, session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_product ON events(tenant_id, product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_order ON events(tenant_id, order_id) WHERE order_id IS NOT NULL;


-- 7.2 Event Summaries Daily
CREATE TABLE IF NOT EXISTS public.event_summaries_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  summary_date DATE NOT NULL,
  
  page_views INT DEFAULT 0,
  product_views INT DEFAULT 0,
  add_to_carts INT DEFAULT 0,
  checkouts INT DEFAULT 0,
  purchases INT DEFAULT 0,
  
  unique_sessions INT DEFAULT 0,
  unique_visitors INT DEFAULT 0,
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, summary_date)
);

CREATE INDEX IF NOT EXISTS idx_event_summaries_daily_tenant ON event_summaries_daily(tenant_id);



-- ============================================================================
-- TIER 8: TEMPLATES & LANDING PAGES
-- ============================================================================

-- 8.1 Template Categories (Platform-owned - no tenant_id)
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


-- 8.2 Blocks (Platform-owned - no tenant_id)
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


-- 8.3 Templates (Platform-owned - no tenant_id)
CREATE TABLE IF NOT EXISTS public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) NOT NULL UNIQUE,
  name_en VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100) NOT NULL,
  description TEXT,
  
  structure JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  product_type VARCHAR(50),
  price_tier VARCHAR(50),
  funnel_stage VARCHAR(50),
  industry VARCHAR(50),
  
  times_used INT DEFAULT 0,
  avg_conversion_rate DECIMAL(5,4),
  
  is_active BOOLEAN DEFAULT true,
  is_premium BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_product_type ON templates(product_type);
CREATE INDEX IF NOT EXISTS idx_templates_price_tier ON templates(price_tier);


-- 8.4 AI Template Rules (Platform-owned - no tenant_id)
CREATE TABLE IF NOT EXISTS public.ai_template_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  rule_code VARCHAR(100) NOT NULL UNIQUE,
  rule_name_en VARCHAR(200) NOT NULL,
  rule_name_ar VARCHAR(200) NOT NULL,
  
  match_product_type VARCHAR(50),
  match_price_tier VARCHAR(50),
  match_funnel_stage VARCHAR(50),
  match_marketing_goal VARCHAR(50),
  match_industry VARCHAR(50),
  
  recommended_template_id UUID REFERENCES templates(id),
  
  required_blocks VARCHAR(50)[] DEFAULT '{}',
  recommended_blocks VARCHAR(50)[] DEFAULT '{}',
  
  selection_reasoning TEXT NOT NULL,
  copy_tone VARCHAR(50),
  copy_focus VARCHAR(50),
  copy_guidelines TEXT,
  
  times_applied INT DEFAULT 0,
  avg_conversion_rate DECIMAL(5,4),
  
  is_active BOOLEAN DEFAULT true,
  priority INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_template_rules_active ON ai_template_rules(is_active, priority DESC);


-- 8.5 Page Instances (Tenant-owned)
CREATE TABLE IF NOT EXISTS public.page_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  
  template_id UUID REFERENCES templates(id),
  
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  ai_generated BOOLEAN DEFAULT false,
  ai_prompt TEXT,
  ai_model_used VARCHAR(50),
  
  product_id UUID REFERENCES products(id),
  
  status VARCHAR(20) DEFAULT 'draft',
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  
  custom_domain VARCHAR(255),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_page_instances_tenant ON page_instances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_page_instances_slug ON page_instances(tenant_id, slug);
CREATE INDEX IF NOT EXISTS idx_page_instances_product ON page_instances(product_id);


-- 8.6 Page Versions
CREATE TABLE IF NOT EXISTS public.page_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  page_id UUID NOT NULL REFERENCES page_instances(id) ON DELETE CASCADE,
  
  version_number INT NOT NULL,
  
  blocks_snapshot JSONB NOT NULL,
  
  change_summary TEXT,
  changed_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(page_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_page_versions_page ON page_versions(page_id);
CREATE INDEX IF NOT EXISTS idx_page_versions_tenant ON page_versions(tenant_id);


-- ============================================================================
-- TIER 9: AI GENERATION SYSTEM
-- ============================================================================

-- 9.1 AI Generation Jobs
CREATE TABLE IF NOT EXISTS public.ai_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  job_type VARCHAR(50) NOT NULL,
  
  status job_status NOT NULL DEFAULT 'queued',
  
  input_data JSONB NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  
  applied_rule_id UUID REFERENCES ai_template_rules(id),
  
  output_data JSONB,
  result_page_id UUID REFERENCES page_instances(id),
  
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INT,
  
  model_used VARCHAR(50),
  prompt_tokens INT DEFAULT 0,
  completion_tokens INT DEFAULT 0,
  total_tokens INT DEFAULT 0,
  estimated_cost_usd DECIMAL(10,6) DEFAULT 0,
  
  error_code VARCHAR(50),
  error_message TEXT,
  retry_count INT DEFAULT 0,
  
  requested_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_generation_jobs_tenant ON ai_generation_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_generation_jobs_status ON ai_generation_jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_generation_jobs_queued ON ai_generation_jobs(status, created_at) WHERE status = 'queued';


-- 9.2 AI Generated Copy
CREATE TABLE IF NOT EXISTS public.ai_generated_copy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  copy_type VARCHAR(50) NOT NULL,
  
  content_ar TEXT NOT NULL,
  content_en TEXT,
  
  context JSONB NOT NULL,
  
  generation_job_id UUID REFERENCES ai_generation_jobs(id),
  model_used VARCHAR(50),
  tone_used VARCHAR(50),
  focus_used VARCHAR(50),
  
  used_in_pages UUID[] DEFAULT '{}',
  times_used INT DEFAULT 0,
  
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  conversions INT DEFAULT 0,
  conversion_rate DECIMAL(5,4),
  quality_score DECIMAL(3,2),
  
  is_high_performer BOOLEAN DEFAULT false,
  is_low_performer BOOLEAN DEFAULT false,
  should_avoid BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_generated_copy_tenant ON ai_generated_copy(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_generated_copy_type ON ai_generated_copy(tenant_id, copy_type);
CREATE INDEX IF NOT EXISTS idx_ai_generated_copy_high_perf ON ai_generated_copy(tenant_id, is_high_performer) WHERE is_high_performer = true;


-- ============================================================================
-- TIER 10: DEPLOYMENTS
-- ============================================================================

-- 10.1 Deployments
CREATE TABLE IF NOT EXISTS public.deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  deployment_type VARCHAR(30) NOT NULL DEFAULT 'page',
  
  page_id UUID REFERENCES page_instances(id),
  page_version_id UUID REFERENCES page_versions(id),
  
  vercel_deployment_id VARCHAR(100),
  vercel_deployment_url VARCHAR(500),
  vercel_project_id VARCHAR(100),
  
  environment VARCHAR(20) NOT NULL DEFAULT 'production',
  
  status deployment_status NOT NULL DEFAULT 'pending',
  
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  building_started_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  build_duration_ms INT,
  
  error_code VARCHAR(50),
  error_message TEXT,
  
  is_current BOOLEAN DEFAULT false,
  rolled_back_from UUID REFERENCES deployments(id),
  
  triggered_by UUID REFERENCES auth.users(id),
  trigger_type VARCHAR(30),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deployments_tenant ON deployments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deployments_page ON deployments(page_id);
CREATE INDEX IF NOT EXISTS idx_deployments_current ON deployments(tenant_id, is_current) WHERE is_current = true;


-- ============================================================================
-- TIER 11: OTHER TABLES
-- ============================================================================

-- 11.1 AI Conversations
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  
  title VARCHAR(255),
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  context JSONB DEFAULT '{}'::jsonb,
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_tenant ON ai_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id);


-- 11.2 Inventory Logs
CREATE TABLE IF NOT EXISTS public.inventory_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id),
  
  change_type VARCHAR(50) NOT NULL,
  quantity_before INT NOT NULL,
  quantity_change INT NOT NULL,
  quantity_after INT NOT NULL,
  
  reference_type VARCHAR(50),
  reference_id UUID,
  
  changed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_logs_product ON inventory_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_tenant ON inventory_logs(tenant_id);


-- 11.3 Files
CREATE TABLE IF NOT EXISTS public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  size_bytes BIGINT,
  
  storage_path VARCHAR(500) NOT NULL,
  public_url VARCHAR(500),
  
  metadata JSONB DEFAULT '{}'::jsonb,
  
  uploaded_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_files_tenant ON files(tenant_id);


-- 11.4 Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  
  old_values JSONB,
  new_values JSONB,
  
  performed_by UUID REFERENCES auth.users(id),
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(tenant_id, created_at DESC);



-- ============================================================================
-- RLS POLICIES (All tenant-owned tables)
-- ============================================================================

-- Enable RLS on all tenant tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_cognitive_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_learnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_behavior_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_capacity ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_sla_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_profit_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_economics_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_to_cash_journey ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_wisdom ENABLE ROW LEVEL SECURITY;
ALTER TABLE failure_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE failure_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_trust_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_summaries_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generated_copy ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies (DROP IF EXISTS then CREATE)

-- Tenants
DROP POLICY IF EXISTS "tenant_self_access" ON tenants;
CREATE POLICY "tenant_self_access" ON tenants FOR ALL USING (
  id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Profiles
DROP POLICY IF EXISTS "users_own_profile" ON profiles;
CREATE POLICY "users_own_profile" ON profiles FOR ALL USING (id = auth.uid());

-- Tenant Users
DROP POLICY IF EXISTS "tenant_users_access" ON tenant_users;
CREATE POLICY "tenant_users_access" ON tenant_users FOR ALL USING (user_id = auth.uid());

-- Standard tenant isolation policy for all other tables
DO $$
DECLARE
  tbl TEXT;
  tables_with_tenant_id TEXT[] := ARRAY[
    'tenant_cognitive_profile', 'tenant_domains', 'subscriptions',
    'products', 'product_variants', 'product_intelligence',
    'campaigns', 'campaign_intelligence', 'campaign_learnings',
    'customer_segments', 'customer_behavior_patterns',
    'operational_capacity', 'operational_metrics_daily',
    'shipping_providers', 'shipping_sla_rules',
    'orders', 'order_items', 'order_status_history',
    'shipments', 'shipping_performance',
    'financial_transactions', 'order_profit_timeline', 'unit_economics_summary',
    'marketing_to_cash_journey',
    'experiments', 'experiment_wisdom',
    'failure_events', 'failure_patterns',
    'decisions', 'decision_outcomes',
    'ai_trust_scores', 'insights', 'workflow_runs',
    'events', 'event_summaries_daily',
    'page_instances', 'page_versions',
    'ai_generation_jobs', 'ai_generated_copy',
    'deployments', 'ai_conversations',
    'inventory_logs', 'files', 'audit_logs'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_with_tenant_id
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation" ON %I', tbl);
    EXECUTE format('
      CREATE POLICY "tenant_isolation" ON %I FOR ALL USING (
        tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
      )', tbl);
  END LOOP;
END $$;


-- ============================================================================
-- VIEWS FOR AI (Read-only summaries)
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
-- HOW TO RUN
-- ============================================================================
/*

EXECUTION ORDER:
================
1. Run preflight FIRST:     00_preflight.sql
2. Run this file SECOND:    01_schema.sql  
3. Run seed THIRD:          02_seed.sql

INSTRUCTIONS:
=============
1. Open Supabase Dashboard → SQL Editor
2. Paste this entire file
3. Click "Run"
4. Wait for completion (may take 30-60 seconds)
5. Check for any errors in the output

TABLES CREATED: 48
VIEWS CREATED: 4
FUNCTIONS CREATED: 4
RLS POLICIES: Applied to all tenant tables

*/
