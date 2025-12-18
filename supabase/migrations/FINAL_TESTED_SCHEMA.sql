-- ============================================================
-- DeepSolution FINAL TESTED Schema
-- Tested and verified for Supabase SQL Editor
-- Copy entire file -> Paste -> Run
-- ============================================================

-- STEP 1: Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- STEP 2: Custom Types (Safe - won't error if exists)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'past_due', 'canceled', 'expired');
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'canceled', 'returned');
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded', 'partially_refunded');
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_role') THEN
    CREATE TYPE tenant_role AS ENUM ('owner', 'admin', 'member', 'viewer');
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'experiment_status') THEN
    CREATE TYPE experiment_status AS ENUM ('draft', 'running', 'paused', 'completed', 'archived');
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'decision_status') THEN
    CREATE TYPE decision_status AS ENUM ('pending', 'approved', 'rejected', 'implemented');
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'profit_stage') THEN
    CREATE TYPE profit_stage AS ENUM ('post_sale', 'post_shipping', 'post_collection', 'post_return_window', 'final');
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deployment_status') THEN
    CREATE TYPE deployment_status AS ENUM ('pending', 'building', 'deploying', 'active', 'failed', 'rolled_back');
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'generation_status') THEN
    CREATE TYPE generation_status AS ENUM ('pending', 'processing', 'completed', 'failed');
  END IF;
END $$;

-- ============================================================
-- STEP 3: Core Tables (Order matters - FK dependencies)
-- ============================================================

-- Table 1: tenants (BASE - no dependencies)
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

-- Table 2: profiles (depends on auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255),
  name VARCHAR(255),
  avatar_url TEXT,
  default_tenant_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 3: tenant_users (depends on tenants + auth.users)
CREATE TABLE IF NOT EXISTS tenant_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role tenant_role DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

-- Table 4: tenant_cognitive_profile
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

-- Table 5: tenant_domains
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

-- Table 6: subscriptions
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

-- Table 7: products
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

-- Table 8: product_variants
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

-- Table 9: product_intelligence
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

-- Table 10: campaigns
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

-- Table 11: campaign_intelligence
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

-- Table 12: campaign_learnings
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

-- Table 13: customer_segments
CREATE TABLE IF NOT EXISTS customer_segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  criteria JSONB NOT NULL DEFAULT '{}',
  customer_count INTEGER DEFAULT 0,
  avg_order_value DECIMAL(15,2),
  total_revenue DECIMAL(15,2) DEFAULT 0,
  is_dynamic BOOLEAN DEFAULT TRUE,
  last_calculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 14: customer_behavior_patterns
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

-- Table 15: operational_capacity
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

-- Table 16: operational_metrics_daily
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

-- Table 17: orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_number VARCHAR(50),
  customer_name VARCHAR(255),
  customer_phone VARCHAR(50),
  customer_email VARCHAR(255),
  customer_id UUID,
  shipping_address JSONB DEFAULT '{}',
  billing_address JSONB DEFAULT '{}',
  status order_status DEFAULT 'pending',
  payment_status payment_status DEFAULT 'pending',
  payment_method VARCHAR(50),
  subtotal DECIMAL(15,2) DEFAULT 0,
  shipping_cost DECIMAL(15,2) DEFAULT 0,
  tax DECIMAL(15,2) DEFAULT 0,
  discount DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) DEFAULT 0,
  currency VARCHAR(3),
  notes TEXT,
  internal_notes TEXT,
  source VARCHAR(50),
  campaign_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 18: order_items
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID,
  variant_id UUID,
  product_name VARCHAR(255) NOT NULL,
  variant_name VARCHAR(255),
  sku VARCHAR(100),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL,
  discount DECIMAL(15,2) DEFAULT 0,
  total_price DECIMAL(15,2) NOT NULL,
  cost DECIMAL(15,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 19: order_status_history
CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_status VARCHAR(50),
  to_status VARCHAR(50) NOT NULL,
  changed_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 20: shipping_providers
CREATE TABLE IF NOT EXISTS shipping_providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  api_key_encrypted TEXT,
  api_endpoint VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  supported_countries TEXT[],
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, code)
);

-- Table 21: shipping_sla_rules
CREATE TABLE IF NOT EXISTS shipping_sla_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES shipping_providers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  origin_region VARCHAR(100),
  destination_region VARCHAR(100),
  expected_days_min INTEGER,
  expected_days_max INTEGER,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 22: shipments
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES shipping_providers(id),
  tracking_number VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  shipped_at TIMESTAMPTZ,
  estimated_delivery TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  shipping_cost DECIMAL(15,2),
  weight DECIMAL(10,2),
  dimensions JSONB DEFAULT '{}',
  tracking_url TEXT,
  tracking_events JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 23: shipping_performance
CREATE TABLE IF NOT EXISTS shipping_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES shipping_providers(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_shipments INTEGER DEFAULT 0,
  on_time_deliveries INTEGER DEFAULT 0,
  late_deliveries INTEGER DEFAULT 0,
  lost_shipments INTEGER DEFAULT 0,
  damaged_shipments INTEGER DEFAULT 0,
  avg_delivery_days DECIMAL(5,2),
  sla_compliance_rate DECIMAL(5,2),
  customer_rating DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, provider_id, period_start)
);

-- Table 24: financial_transactions
CREATE TABLE IF NOT EXISTS financial_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3),
  payment_method VARCHAR(50),
  payment_gateway VARCHAR(50),
  gateway_transaction_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  fees DECIMAL(15,2) DEFAULT 0,
  net_amount DECIMAL(15,2),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 25: order_profit_timeline
CREATE TABLE IF NOT EXISTS order_profit_timeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stage profit_stage NOT NULL,
  revenue DECIMAL(15,2) DEFAULT 0,
  product_cost DECIMAL(15,2) DEFAULT 0,
  shipping_cost DECIMAL(15,2) DEFAULT 0,
  payment_fees DECIMAL(15,2) DEFAULT 0,
  marketing_cost DECIMAL(15,2) DEFAULT 0,
  return_cost DECIMAL(15,2) DEFAULT 0,
  other_costs DECIMAL(15,2) DEFAULT 0,
  gross_profit DECIMAL(15,2) DEFAULT 0,
  net_profit DECIMAL(15,2) DEFAULT 0,
  profit_margin DECIMAL(5,2),
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(order_id, stage)
);

-- Table 26: unit_economics_summary
CREATE TABLE IF NOT EXISTS unit_economics_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period_type VARCHAR(20) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_orders INTEGER DEFAULT 0,
  total_revenue DECIMAL(15,2) DEFAULT 0,
  total_cost DECIMAL(15,2) DEFAULT 0,
  total_profit DECIMAL(15,2) DEFAULT 0,
  avg_order_value DECIMAL(15,2),
  avg_profit_per_order DECIMAL(15,2),
  profit_margin DECIMAL(5,2),
  cac DECIMAL(15,2),
  ltv DECIMAL(15,2),
  ltv_cac_ratio DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, period_type, period_start)
);

-- Table 27: marketing_to_cash_journey
CREATE TABLE IF NOT EXISTS marketing_to_cash_journey (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  customer_id UUID,
  touchpoints JSONB DEFAULT '[]',
  first_touch_at TIMESTAMPTZ,
  last_touch_at TIMESTAMPTZ,
  conversion_at TIMESTAMPTZ,
  cash_collected_at TIMESTAMPTZ,
  total_marketing_cost DECIMAL(15,2) DEFAULT 0,
  order_value DECIMAL(15,2),
  cash_collected DECIMAL(15,2),
  days_to_conversion INTEGER,
  days_to_cash INTEGER,
  attribution_model VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 28: experiments
CREATE TABLE IF NOT EXISTS experiments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  hypothesis TEXT,
  description TEXT,
  status experiment_status DEFAULT 'draft',
  type VARCHAR(50),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  control_group JSONB DEFAULT '{}',
  variant_groups JSONB DEFAULT '[]',
  success_metrics JSONB DEFAULT '[]',
  results JSONB DEFAULT '{}',
  winner VARCHAR(50),
  confidence_level DECIMAL(5,2),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 29: experiment_wisdom
CREATE TABLE IF NOT EXISTS experiment_wisdom (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  insight TEXT NOT NULL,
  category VARCHAR(100),
  impact_score DECIMAL(3,2),
  applicable_contexts JSONB DEFAULT '[]',
  times_applied INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 30: failure_events
CREATE TABLE IF NOT EXISTS failure_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium',
  description TEXT,
  context JSONB DEFAULT '{}',
  root_cause TEXT,
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  prevented_future INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 31: failure_patterns
CREATE TABLE IF NOT EXISTS failure_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pattern_name VARCHAR(255) NOT NULL,
  description TEXT,
  indicators JSONB DEFAULT '[]',
  frequency INTEGER DEFAULT 0,
  avg_impact DECIMAL(15,2),
  prevention_strategies JSONB DEFAULT '[]',
  detection_query TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 32: decisions
CREATE TABLE IF NOT EXISTS decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  status decision_status DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  proposed_by UUID,
  approved_by UUID,
  data_sources JSONB DEFAULT '[]',
  expected_impact JSONB DEFAULT '{}',
  actual_impact JSONB DEFAULT '{}',
  decision_date TIMESTAMPTZ,
  implementation_date TIMESTAMPTZ,
  review_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 33: decision_outcomes
CREATE TABLE IF NOT EXISTS decision_outcomes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_name VARCHAR(255) NOT NULL,
  baseline_value DECIMAL(15,2),
  target_value DECIMAL(15,2),
  actual_value DECIMAL(15,2),
  measured_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 34: trust_scores
CREATE TABLE IF NOT EXISTS trust_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  score DECIMAL(5,2) NOT NULL,
  factors JSONB DEFAULT '{}',
  history JSONB DEFAULT '[]',
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, entity_type, entity_id)
);

-- Table 35: events
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  actor_id UUID,
  actor_type VARCHAR(50),
  data JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 36: event_subscriptions
CREATE TABLE IF NOT EXISTS event_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  webhook_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  filters JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 37: templates
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  type VARCHAR(50) NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  variables JSONB DEFAULT '[]',
  is_system BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INTEGER DEFAULT 0,
  avg_performance_score DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 38: template_rules
CREATE TABLE IF NOT EXISTS template_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  template_id UUID REFERENCES templates(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}',
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  times_matched INTEGER DEFAULT 0,
  times_successful INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 39: generated_content
CREATE TABLE IF NOT EXISTS generated_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  input_data JSONB DEFAULT '{}',
  output_content TEXT,
  output_metadata JSONB DEFAULT '{}',
  model_used VARCHAR(100),
  tokens_used INTEGER,
  generation_time_ms INTEGER,
  quality_score DECIMAL(5,2),
  feedback VARCHAR(20),
  feedback_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 40: ai_generation_jobs
CREATE TABLE IF NOT EXISTS ai_generation_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_type VARCHAR(100) NOT NULL,
  status generation_status DEFAULT 'pending',
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 41: copy_performance
CREATE TABLE IF NOT EXISTS copy_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  content_id UUID REFERENCES generated_content(id) ON DELETE SET NULL,
  content_type VARCHAR(50),
  content_text TEXT,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  ctr DECIMAL(5,4),
  cvr DECIMAL(5,4),
  revenue DECIMAL(15,2) DEFAULT 0,
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 42: deployments
CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version VARCHAR(50) NOT NULL,
  status deployment_status DEFAULT 'pending',
  environment VARCHAR(50) DEFAULT 'production',
  changes JSONB DEFAULT '[]',
  deployed_by UUID,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  rollback_to UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 43: deployment_configs
CREATE TABLE IF NOT EXISTS deployment_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key VARCHAR(255) NOT NULL,
  value JSONB NOT NULL,
  environment VARCHAR(50) DEFAULT 'production',
  is_secret BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, key, environment)
);

-- Table 44: audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 45: notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 46: scheduled_tasks
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  task_type VARCHAR(100) NOT NULL,
  schedule VARCHAR(100),
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  last_status VARCHAR(50),
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 47: api_keys
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(10) NOT NULL,
  permissions JSONB DEFAULT '[]',
  rate_limit INTEGER DEFAULT 1000,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 48: integrations
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider VARCHAR(100) NOT NULL,
  name VARCHAR(255),
  credentials_encrypted TEXT,
  settings JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'active',
  last_sync_at TIMESTAMPTZ,
  sync_errors JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, provider)
);

-- ============================================================
-- STEP 4: Enable RLS on all tables
-- ============================================================
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
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_sla_rules ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE trust_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE copy_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 5: RLS Policies (Core tables only - extend as needed)
-- ============================================================

-- Profiles
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Tenant Users
DROP POLICY IF EXISTS "tenant_users_select" ON tenant_users;
CREATE POLICY "tenant_users_select" ON tenant_users FOR SELECT USING (auth.uid() = user_id);

-- Tenants
DROP POLICY IF EXISTS "tenants_select" ON tenants;
CREATE POLICY "tenants_select" ON tenants FOR SELECT USING (
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = tenants.id AND tenant_users.user_id = auth.uid())
);

-- Generic tenant-based policy for all other tables
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'subscriptions', 'products', 'product_variants', 'product_intelligence',
    'campaigns', 'campaign_intelligence', 'campaign_learnings',
    'customer_segments', 'customer_behavior_patterns',
    'operational_capacity', 'operational_metrics_daily',
    'orders', 'order_items', 'order_status_history',
    'shipping_providers', 'shipping_sla_rules', 'shipments', 'shipping_performance',
    'financial_transactions', 'order_profit_timeline', 'unit_economics_summary',
    'marketing_to_cash_journey', 'experiments', 'experiment_wisdom',
    'failure_events', 'failure_patterns', 'decisions', 'decision_outcomes',
    'trust_scores', 'events', 'event_subscriptions',
    'generated_content', 'ai_generation_jobs', 'copy_performance',
    'deployments', 'deployment_configs', 'audit_logs', 'notifications',
    'scheduled_tasks', 'api_keys', 'integrations',
    'tenant_cognitive_profile', 'tenant_domains'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_tenant_access" ON %I', tbl, tbl);
    EXECUTE format('
      CREATE POLICY "%s_tenant_access" ON %I FOR ALL USING (
        EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = %I.tenant_id AND tenant_users.user_id = auth.uid())
      )', tbl, tbl, tbl);
  END LOOP;
END $$;

-- Templates (can be system-wide or tenant-specific)
DROP POLICY IF EXISTS "templates_access" ON templates;
CREATE POLICY "templates_access" ON templates FOR SELECT USING (
  is_system = TRUE OR tenant_id IS NULL OR
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = templates.tenant_id AND tenant_users.user_id = auth.uid())
);

-- Template Rules
DROP POLICY IF EXISTS "template_rules_access" ON template_rules;
CREATE POLICY "template_rules_access" ON template_rules FOR SELECT USING (
  tenant_id IS NULL OR
  EXISTS (SELECT 1 FROM tenant_users WHERE tenant_users.tenant_id = template_rules.tenant_id AND tenant_users.user_id = auth.uid())
);

-- ============================================================
-- STEP 6: Trial Functions
-- ============================================================

CREATE OR REPLACE FUNCTION is_tenant_in_trial(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_status subscription_status;
  v_trial_ends TIMESTAMPTZ;
BEGIN
  SELECT status, trial_ends_at INTO v_status, v_trial_ends
  FROM subscriptions WHERE tenant_id = p_tenant_id;
  
  IF v_status = 'trial' AND v_trial_ends > NOW() THEN
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION start_tenant_trial(p_tenant_id UUID)
RETURNS UUID AS $$
DECLARE
  v_sub_id UUID;
BEGIN
  INSERT INTO subscriptions (tenant_id, plan, status, trial_starts_at, trial_ends_at, trial_campaigns_limit)
  VALUES (p_tenant_id, 'trial', 'trial', NOW(), NOW() + INTERVAL '7 days', 1)
  ON CONFLICT (tenant_id) DO UPDATE SET
    status = 'trial',
    trial_starts_at = NOW(),
    trial_ends_at = NOW() + INTERVAL '7 days',
    trial_campaigns_limit = 1,
    updated_at = NOW()
  RETURNING id INTO v_sub_id;
  
  RETURN v_sub_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION expire_trial_subscriptions()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE subscriptions
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'trial' AND trial_ends_at < NOW();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 7: Trial Campaign Limit Trigger
-- ============================================================

CREATE OR REPLACE FUNCTION check_trial_campaign_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_status subscription_status;
  v_trial_ends TIMESTAMPTZ;
  v_campaign_limit INTEGER;
  v_current_count INTEGER;
BEGIN
  SELECT status, trial_ends_at, trial_campaigns_limit
  INTO v_status, v_trial_ends, v_campaign_limit
  FROM subscriptions WHERE tenant_id = NEW.tenant_id;
  
  IF v_status = 'trial' AND v_trial_ends > NOW() THEN
    SELECT COUNT(*) INTO v_current_count
    FROM campaigns WHERE tenant_id = NEW.tenant_id;
    
    IF v_current_count >= COALESCE(v_campaign_limit, 1) THEN
      RAISE EXCEPTION 'Trial limit reached: You can only create % campaign(s) during your trial period. Please upgrade to create more campaigns.', v_campaign_limit;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_trial_campaign_limit ON campaigns;
CREATE TRIGGER enforce_trial_campaign_limit
  BEFORE INSERT ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION check_trial_campaign_limit();

-- ============================================================
-- STEP 8: Performance Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(tenant_id, sku);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(tenant_id, customer_email);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_order ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_events_tenant ON events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(tenant_id, event_type);
CREATE INDEX IF NOT EXISTS idx_events_entity ON events(tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(tenant_id, user_id, is_read);

-- ============================================================
-- DONE! Run verification query below separately:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' AND table_type = 'BASE TABLE' 
-- ORDER BY table_name;
-- Expected: 48 tables
-- ============================================================
