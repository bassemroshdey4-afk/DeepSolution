-- ============================================================
-- DeepSolution FULL Schema - 48 Tables Complete
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- PART 1: Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PART 2: Enum Types (Safe Creation)
-- ============================================================
DO $$ BEGIN CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'past_due', 'canceled', 'expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'canceled', 'returned'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded', 'partially_refunded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE tenant_role AS ENUM ('owner', 'admin', 'member', 'viewer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE experiment_status AS ENUM ('draft', 'running', 'paused', 'completed', 'archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE decision_status AS ENUM ('pending', 'approved', 'rejected', 'implemented'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE profit_stage AS ENUM ('post_sale', 'post_shipping', 'post_collection', 'post_return_window', 'final'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE deployment_status AS ENUM ('pending', 'building', 'deploying', 'active', 'failed', 'rolled_back'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE generation_status AS ENUM ('pending', 'processing', 'completed', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- PART 3: TIER 1 - Base Tables (No FK Dependencies)
-- ============================================================

-- L1: Tenants (FIRST - all tables depend on this)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  logo_url TEXT,
  country VARCHAR(2),
  currency VARCHAR(3),
  language VARCHAR(5),
  timezone VARCHAR(50),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- L1: Profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255),
  name VARCHAR(255),
  avatar_url TEXT,
  default_tenant_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PART 4: TIER 2 - Junction Tables
-- ============================================================

-- L1: Tenant Users
CREATE TABLE IF NOT EXISTS tenant_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role tenant_role DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

-- Add FK to profiles after tenant_users exists
DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT fk_profiles_default_tenant FOREIGN KEY (default_tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- PART 5: TIER 3 - Tenant-Dependent Tables
-- ============================================================

-- L1: Tenant Cognitive Profile
CREATE TABLE IF NOT EXISTS tenant_cognitive_profile (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  business_type VARCHAR(100),
  target_audience TEXT,
  brand_voice TEXT,
  key_differentiators TEXT[],
  pain_points TEXT[],
  goals TEXT[],
  constraints JSONB DEFAULT '{}',
  learned_preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- L1: Tenant Domains
CREATE TABLE IF NOT EXISTS tenant_domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  domain VARCHAR(255) NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(255),
  ssl_status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(domain)
);

-- L1: Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan VARCHAR(50) NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'trial',
  trial_starts_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  trial_campaigns_limit INTEGER DEFAULT 1,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- L2: Products
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sku VARCHAR(100),
  barcode VARCHAR(100),
  price DECIMAL(15,2),
  cost DECIMAL(15,2),
  compare_at_price DECIMAL(15,2),
  quantity INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  weight DECIMAL(10,2),
  weight_unit VARCHAR(10) DEFAULT 'kg',
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  category VARCHAR(100),
  tags TEXT[],
  images JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- L2: Product Variants
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  price DECIMAL(15,2),
  cost DECIMAL(15,2),
  quantity INTEGER DEFAULT 0,
  options JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- L2: Product Intelligence
CREATE TABLE IF NOT EXISTS product_intelligence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  total_sold INTEGER DEFAULT 0,
  total_revenue DECIMAL(15,2) DEFAULT 0,
  avg_order_value DECIMAL(15,2),
  return_rate DECIMAL(5,2),
  profit_margin DECIMAL(5,2),
  best_selling_variant_id UUID,
  peak_sales_hour INTEGER,
  peak_sales_day INTEGER,
  customer_segments JSONB DEFAULT '[]',
  frequently_bought_with UUID[],
  ai_insights JSONB DEFAULT '{}',
  last_calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id)
);

-- L3: Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  objective VARCHAR(100),
  status VARCHAR(50) DEFAULT 'draft',
  budget DECIMAL(15,2),
  spent DECIMAL(15,2) DEFAULT 0,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  target_audience JSONB DEFAULT '{}',
  channels JSONB DEFAULT '[]',
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- L3: Campaign Intelligence
CREATE TABLE IF NOT EXISTS campaign_intelligence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue DECIMAL(15,2) DEFAULT 0,
  cost DECIMAL(15,2) DEFAULT 0,
  ctr DECIMAL(5,4),
  cvr DECIMAL(5,4),
  cpc DECIMAL(10,2),
  cpa DECIMAL(10,2),
  roas DECIMAL(10,2),
  best_performing_ad_id VARCHAR(255),
  best_performing_audience JSONB,
  ai_recommendations JSONB DEFAULT '[]',
  last_calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id)
);

-- L3: Campaign Learnings
CREATE TABLE IF NOT EXISTS campaign_learnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  learning_type VARCHAR(100),
  insight TEXT NOT NULL,
  confidence_score DECIMAL(3,2),
  supporting_data JSONB DEFAULT '{}',
  applied_to_campaigns UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- L4: Customer Segments
CREATE TABLE IF NOT EXISTS customer_segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  criteria JSONB NOT NULL,
  customer_count INTEGER DEFAULT 0,
  avg_order_value DECIMAL(15,2),
  total_revenue DECIMAL(15,2) DEFAULT 0,
  is_dynamic BOOLEAN DEFAULT TRUE,
  last_calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- L4: Customer Behavior Patterns
CREATE TABLE IF NOT EXISTS customer_behavior_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pattern_type VARCHAR(100) NOT NULL,
  pattern_name VARCHAR(255) NOT NULL,
  description TEXT,
  frequency INTEGER DEFAULT 0,
  avg_value DECIMAL(15,2),
  customer_ids UUID[],
  triggers JSONB DEFAULT '[]',
  recommended_actions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- L5: Operational Capacity
CREATE TABLE IF NOT EXISTS operational_capacity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  max_orders INTEGER,
  current_orders INTEGER DEFAULT 0,
  max_shipments INTEGER,
  current_shipments INTEGER DEFAULT 0,
  warehouse_capacity_pct DECIMAL(5,2),
  staff_available INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, date)
);

-- L5: Operational Metrics Daily
CREATE TABLE IF NOT EXISTS operational_metrics_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  orders_received INTEGER DEFAULT 0,
  orders_processed INTEGER DEFAULT 0,
  orders_shipped INTEGER DEFAULT 0,
  orders_delivered INTEGER DEFAULT 0,
  orders_returned INTEGER DEFAULT 0,
  avg_processing_time_hours DECIMAL(10,2),
  avg_shipping_time_hours DECIMAL(10,2),
  customer_satisfaction_score DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, date)
);
