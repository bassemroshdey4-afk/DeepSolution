-- ============================================================================
-- DeepSolution: Complete Cognitive Memory System
-- Version: 2.0 - 15 Memory Layers with AI Separation
-- ============================================================================
-- 
-- ARCHITECTURE PRINCIPLE:
-- Raw Data → Aggregation → Insight → Decision → Outcome → Learning
-- AI NEVER reads raw tables directly. AI reads ONLY:
--   - Materialized Views
--   - Feature Tables
--   - Summary Tables
--
-- ============================================================================

-- ============================================================================
-- LAYER 1: TENANT COGNITIVE MEMORY
-- Purpose: Store tenant identity, context, and learned preferences
-- ============================================================================

-- Core tenant table (if not exists)
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  subdomain VARCHAR(63) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  
  -- Localization (Layer 14)
  country VARCHAR(2) NOT NULL DEFAULT 'SA',
  currency VARCHAR(3) NOT NULL DEFAULT 'SAR',
  language VARCHAR(5) NOT NULL DEFAULT 'ar',
  timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Riyadh',
  
  -- Plan
  plan VARCHAR(20) DEFAULT 'free',
  status VARCHAR(20) DEFAULT 'active',
  
  -- Settings
  settings JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant Cognitive Profile (AI reads this, not raw data)
CREATE TABLE IF NOT EXISTS public.tenant_cognitive_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  
  -- Business DNA (learned over time)
  business_type VARCHAR(50),
  industry VARCHAR(100),
  business_model VARCHAR(50), -- dropship, inventory, hybrid
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
  
  -- Confidence in profile
  profile_confidence DECIMAL(3,2) DEFAULT 0.5,
  last_profile_update TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tenant_cognitive_profile_tenant ON tenant_cognitive_profile(tenant_id);

ALTER TABLE tenant_cognitive_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON tenant_cognitive_profile FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- LAYER 2: PRODUCT INTELLIGENCE MEMORY
-- Purpose: Store product performance patterns and AI-derived insights
-- ============================================================================

-- Products (raw data - AI does NOT read directly)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  sku VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  cost_price INT DEFAULT 0,
  selling_price INT NOT NULL,
  compare_at_price INT,
  
  track_inventory BOOLEAN DEFAULT true,
  stock_quantity INT DEFAULT 0,
  low_stock_threshold INT DEFAULT 5,
  
  image_url VARCHAR(500),
  images JSONB DEFAULT '[]'::jsonb,
  category VARCHAR(100),
  tags JSONB DEFAULT '[]'::jsonb,
  
  status VARCHAR(20) DEFAULT 'active',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_tenant ON products(tenant_id);
CREATE INDEX idx_products_tenant_status ON products(tenant_id, status);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON products FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Product Intelligence (AI READS THIS)
CREATE TABLE IF NOT EXISTS public.product_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE UNIQUE,
  
  -- Performance metrics (aggregated)
  total_units_sold INT DEFAULT 0,
  total_revenue INT DEFAULT 0,
  total_profit INT DEFAULT 0,
  avg_margin_percentage DECIMAL(5,2),
  
  -- Time-series performance
  sales_velocity_daily DECIMAL(10,2) DEFAULT 0,
  sales_trend VARCHAR(20), -- increasing, stable, declining
  
  -- Inventory intelligence
  days_of_stock INT,
  stockout_risk VARCHAR(20), -- low, medium, high, critical
  reorder_point INT,
  optimal_reorder_quantity INT,
  
  -- Pricing intelligence
  price_elasticity DECIMAL(5,2),
  optimal_price_suggestion INT,
  discount_effectiveness DECIMAL(5,2),
  
  -- Customer patterns
  repeat_purchase_rate DECIMAL(5,2),
  return_rate DECIMAL(5,2),
  avg_rating DECIMAL(3,2),
  
  -- AI confidence
  intelligence_confidence DECIMAL(3,2) DEFAULT 0.5,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_product_intelligence_tenant ON product_intelligence(tenant_id);
CREATE INDEX idx_product_intelligence_product ON product_intelligence(product_id);

ALTER TABLE product_intelligence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON product_intelligence FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- LAYER 3: CAMPAIGN LEARNING MEMORY
-- Purpose: Store campaign performance and learned optimization patterns
-- ============================================================================

-- Campaigns (raw data)
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  platform VARCHAR(30) NOT NULL,
  external_id VARCHAR(255),
  
  budget INT DEFAULT 0,
  budget_spent INT DEFAULT 0,
  
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  conversions INT DEFAULT 0,
  revenue INT DEFAULT 0,
  
  status VARCHAR(20) DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaigns_tenant ON campaigns(tenant_id);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON campaigns FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Campaign Intelligence (AI READS THIS)
CREATE TABLE IF NOT EXISTS public.campaign_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE UNIQUE,
  
  -- Performance metrics (calculated)
  ctr DECIMAL(10,4) DEFAULT 0,
  cpc INT DEFAULT 0,
  cpa INT DEFAULT 0,
  roas DECIMAL(10,4) DEFAULT 0,
  true_roas DECIMAL(10,4) DEFAULT 0, -- after all costs
  
  -- Profitability
  gross_profit INT DEFAULT 0,
  net_profit INT DEFAULT 0,
  profit_per_conversion INT DEFAULT 0,
  
  -- Learning
  best_performing_hours JSONB DEFAULT '[]'::jsonb,
  best_performing_days JSONB DEFAULT '[]'::jsonb,
  best_audience_segments JSONB DEFAULT '[]'::jsonb,
  
  -- Optimization suggestions
  budget_efficiency_score DECIMAL(3,2),
  scaling_potential VARCHAR(20), -- high, medium, low, saturated
  recommended_daily_budget INT,
  
  -- AI confidence
  intelligence_confidence DECIMAL(3,2) DEFAULT 0.5,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaign_intelligence_tenant ON campaign_intelligence(tenant_id);
CREATE INDEX idx_campaign_intelligence_campaign ON campaign_intelligence(campaign_id);

ALTER TABLE campaign_intelligence ENABLE ROW LEVEL SECURITY;
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

CREATE INDEX idx_campaign_learnings_tenant ON campaign_learnings(tenant_id);
CREATE INDEX idx_campaign_learnings_platform ON campaign_learnings(tenant_id, platform);

ALTER TABLE campaign_learnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON campaign_learnings FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- LAYER 4: CUSTOMER BEHAVIOR MEMORY (Privacy-Safe)
-- Purpose: Store aggregated customer patterns without PII
-- ============================================================================

-- Customer Segments (AI READS THIS - no PII)
CREATE TABLE IF NOT EXISTS public.customer_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Segment definition
  name VARCHAR(255) NOT NULL,
  segment_type VARCHAR(50) NOT NULL, -- rfm, behavioral, demographic
  
  -- Criteria (no PII)
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Size
  customer_count INT DEFAULT 0,
  percentage_of_total DECIMAL(5,2),
  
  -- Value metrics
  avg_order_value INT DEFAULT 0,
  avg_lifetime_value INT DEFAULT 0,
  avg_orders_per_customer DECIMAL(5,2),
  
  -- Behavior patterns
  avg_days_between_orders DECIMAL(10,2),
  preferred_products JSONB DEFAULT '[]'::jsonb,
  preferred_channels JSONB DEFAULT '[]'::jsonb,
  peak_purchase_hours JSONB DEFAULT '[]'::jsonb,
  
  -- Churn risk
  churn_risk VARCHAR(20), -- low, medium, high
  
  -- AI recommendations
  recommended_actions JSONB DEFAULT '[]'::jsonb,
  
  is_active BOOLEAN DEFAULT true,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customer_segments_tenant ON customer_segments(tenant_id);

ALTER TABLE customer_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON customer_segments FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Customer Behavior Patterns (aggregated, no PII)
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
  estimated_revenue_impact INT,
  estimated_conversion_impact DECIMAL(5,2),
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customer_behavior_patterns_tenant ON customer_behavior_patterns(tenant_id);

ALTER TABLE customer_behavior_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON customer_behavior_patterns FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- LAYER 5: OPERATIONAL REALITY MEMORY
-- Purpose: Store operational capacity, constraints, and performance
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

CREATE INDEX idx_operational_capacity_tenant ON operational_capacity(tenant_id);

ALTER TABLE operational_capacity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON operational_capacity FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Operational Metrics (time-series, AI reads aggregated)
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

CREATE INDEX idx_operational_metrics_daily_tenant ON operational_metrics_daily(tenant_id);
CREATE INDEX idx_operational_metrics_daily_date ON operational_metrics_daily(tenant_id, metric_date);

ALTER TABLE operational_metrics_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON operational_metrics_daily FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- LAYER 6: FULFILLMENT & SHIPPING INTELLIGENCE MEMORY
-- Purpose: Store shipping performance and delivery patterns
-- ============================================================================

-- Orders (raw data - AI does NOT read directly)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  order_number VARCHAR(20) NOT NULL,
  
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_email VARCHAR(320),
  
  shipping_address TEXT NOT NULL,
  shipping_city VARCHAR(100) NOT NULL,
  shipping_region VARCHAR(100),
  shipping_country VARCHAR(2) DEFAULT 'SA',
  
  subtotal INT NOT NULL,
  shipping_cost INT DEFAULT 0,
  discount_amount INT DEFAULT 0,
  total INT NOT NULL,
  currency VARCHAR(3) DEFAULT 'SAR',
  
  status VARCHAR(30) DEFAULT 'new',
  call_status VARCHAR(30) DEFAULT 'pending',
  call_attempts INT DEFAULT 0,
  
  source VARCHAR(50) DEFAULT 'manual',
  campaign_id UUID REFERENCES campaigns(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

CREATE INDEX idx_orders_tenant ON orders(tenant_id);
CREATE INDEX idx_orders_tenant_status ON orders(tenant_id, status);
CREATE INDEX idx_orders_tenant_created ON orders(tenant_id, created_at);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON orders FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Shipments (raw data)
CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  provider VARCHAR(50),
  tracking_number VARCHAR(100),
  
  status VARCHAR(30) DEFAULT 'pending',
  
  shipped_at TIMESTAMPTZ,
  estimated_delivery TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  shipping_cost INT DEFAULT 0,
  
  tracking_history JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shipments_tenant ON shipments(tenant_id);
CREATE INDEX idx_shipments_order ON shipments(order_id);

ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON shipments FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Shipping Intelligence (AI READS THIS)
CREATE TABLE IF NOT EXISTS public.shipping_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Scope
  provider VARCHAR(50),
  region VARCHAR(100),
  city VARCHAR(100),
  
  -- Performance metrics
  total_shipments INT DEFAULT 0,
  delivered_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  returned_count INT DEFAULT 0,
  
  -- Timing
  avg_delivery_days DECIMAL(5,2),
  on_time_rate DECIMAL(5,4),
  
  -- Cost
  avg_shipping_cost INT,
  cost_per_successful_delivery INT,
  
  -- Reliability
  reliability_score DECIMAL(3,2),
  
  -- Recommendations
  recommended_for_cod BOOLEAN,
  recommended_for_express BOOLEAN,
  
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, provider, region, city)
);

CREATE INDEX idx_shipping_intelligence_tenant ON shipping_intelligence(tenant_id);

ALTER TABLE shipping_intelligence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON shipping_intelligence FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- LAYER 7: UNIT ECONOMICS TEMPORAL MEMORY
-- Purpose: Track real profit over time at every lifecycle stage
-- ============================================================================

-- Financial Transactions (raw events - AI does NOT read directly)
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  transaction_type VARCHAR(50) NOT NULL,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inflow', 'outflow')),
  
  amount INT NOT NULL CHECK (amount >= 0),
  currency VARCHAR(3) DEFAULT 'SAR',
  
  order_id UUID REFERENCES orders(id),
  product_id UUID REFERENCES products(id),
  campaign_id UUID REFERENCES campaigns(id),
  
  lifecycle_stage VARCHAR(30),
  
  idempotency_key VARCHAR(255) UNIQUE,
  transaction_date DATE NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_financial_transactions_tenant ON financial_transactions(tenant_id);
CREATE INDEX idx_financial_transactions_date ON financial_transactions(tenant_id, transaction_date);
CREATE INDEX idx_financial_transactions_order ON financial_transactions(order_id);

ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON financial_transactions FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Order Profit Timeline (AI READS THIS)
CREATE TABLE IF NOT EXISTS public.order_profit_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  lifecycle_stage VARCHAR(30) NOT NULL,
  
  gross_revenue INT DEFAULT 0,
  net_revenue INT DEFAULT 0,
  
  product_cost INT DEFAULT 0,
  shipping_cost INT DEFAULT 0,
  marketing_cost INT DEFAULT 0,
  operational_cost INT DEFAULT 0,
  total_costs INT DEFAULT 0,
  
  gross_profit INT DEFAULT 0,
  net_profit INT DEFAULT 0,
  net_margin DECIMAL(5,4),
  
  confidence DECIMAL(3,2) DEFAULT 1.0,
  
  stage_reached_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(order_id, lifecycle_stage)
);

CREATE INDEX idx_order_profit_timeline_tenant ON order_profit_timeline(tenant_id);
CREATE INDEX idx_order_profit_timeline_order ON order_profit_timeline(order_id);

ALTER TABLE order_profit_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON order_profit_timeline FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Unit Economics Summary (AI READS THIS - aggregated)
CREATE TABLE IF NOT EXISTS public.unit_economics_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Period
  period_type VARCHAR(20) NOT NULL,
  period_start DATE NOT NULL,
  
  -- Volume
  total_orders INT DEFAULT 0,
  delivered_orders INT DEFAULT 0,
  returned_orders INT DEFAULT 0,
  
  -- Revenue
  gross_revenue INT DEFAULT 0,
  net_revenue INT DEFAULT 0,
  
  -- Costs breakdown
  product_costs INT DEFAULT 0,
  shipping_costs INT DEFAULT 0,
  marketing_costs INT DEFAULT 0,
  operational_costs INT DEFAULT 0,
  total_costs INT DEFAULT 0,
  
  -- Profit
  gross_profit INT DEFAULT 0,
  net_profit INT DEFAULT 0,
  gross_margin DECIMAL(5,4),
  net_margin DECIMAL(5,4),
  
  -- Per-unit metrics
  avg_order_value INT,
  avg_profit_per_order INT,
  customer_acquisition_cost INT,
  
  -- Trends
  profit_trend VARCHAR(20),
  margin_trend VARCHAR(20),
  
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, period_type, period_start)
);

CREATE INDEX idx_unit_economics_summary_tenant ON unit_economics_summary(tenant_id);
CREATE INDEX idx_unit_economics_summary_period ON unit_economics_summary(tenant_id, period_type, period_start);

ALTER TABLE unit_economics_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON unit_economics_summary FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- LAYER 8: MARKETING-TO-CASH MEMORY
-- Purpose: Track full journey from ad spend to cash collection
-- ============================================================================

-- Marketing to Cash Journey (AI READS THIS)
CREATE TABLE IF NOT EXISTS public.marketing_to_cash_journey (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Attribution
  campaign_id UUID REFERENCES campaigns(id),
  channel VARCHAR(50),
  
  -- Period
  period_type VARCHAR(20) NOT NULL,
  period_start DATE NOT NULL,
  
  -- Funnel metrics
  ad_spend INT DEFAULT 0,
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  landing_page_views INT DEFAULT 0,
  orders_created INT DEFAULT 0,
  orders_confirmed INT DEFAULT 0,
  orders_shipped INT DEFAULT 0,
  orders_delivered INT DEFAULT 0,
  
  -- Revenue stages
  expected_revenue INT DEFAULT 0,
  confirmed_revenue INT DEFAULT 0,
  shipped_revenue INT DEFAULT 0,
  collected_revenue INT DEFAULT 0,
  
  -- Costs
  total_costs INT DEFAULT 0,
  
  -- Profit stages
  expected_profit INT DEFAULT 0,
  realized_profit INT DEFAULT 0,
  
  -- Conversion rates
  click_to_order_rate DECIMAL(5,4),
  order_to_confirm_rate DECIMAL(5,4),
  confirm_to_deliver_rate DECIMAL(5,4),
  deliver_to_collect_rate DECIMAL(5,4),
  
  -- Time metrics
  avg_days_to_confirm DECIMAL(5,2),
  avg_days_to_deliver DECIMAL(5,2),
  avg_days_to_collect DECIMAL(5,2),
  
  -- ROI
  expected_roas DECIMAL(10,4),
  realized_roas DECIMAL(10,4),
  
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, campaign_id, channel, period_type, period_start)
);

CREATE INDEX idx_marketing_to_cash_journey_tenant ON marketing_to_cash_journey(tenant_id);
CREATE INDEX idx_marketing_to_cash_journey_campaign ON marketing_to_cash_journey(campaign_id);

ALTER TABLE marketing_to_cash_journey ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON marketing_to_cash_journey FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- LAYER 9: EXPERIMENT MEMORY
-- Purpose: Store experiments, results, and validated learnings
-- ============================================================================

-- Experiments (raw data)
CREATE TABLE IF NOT EXISTS public.experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  experiment_type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  hypothesis TEXT NOT NULL,
  
  control_description TEXT NOT NULL,
  variants JSONB NOT NULL,
  
  primary_metric VARCHAR(100) NOT NULL,
  secondary_metrics VARCHAR[] DEFAULT '{}',
  
  minimum_sample_size INT,
  confidence_level DECIMAL(3,2) DEFAULT 0.95,
  
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  
  status VARCHAR(20) DEFAULT 'draft',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_experiments_tenant ON experiments(tenant_id);
CREATE INDEX idx_experiments_status ON experiments(tenant_id, status);

ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON experiments FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Experiment Wisdom (AI READS THIS - validated learnings)
CREATE TABLE IF NOT EXISTS public.experiment_wisdom (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  experiment_id UUID REFERENCES experiments(id),
  
  -- Learning
  learning_type VARCHAR(50) NOT NULL,
  learning TEXT NOT NULL,
  
  -- Validation
  hypothesis_validated BOOLEAN,
  effect_size DECIMAL(10,4),
  statistical_significance DECIMAL(5,4),
  
  -- Applicability
  applies_to VARCHAR(100),
  applies_when JSONB DEFAULT '{}'::jsonb,
  does_not_apply_when JSONB DEFAULT '{}'::jsonb,
  
  -- Repeatability
  times_replicated INT DEFAULT 0,
  times_failed_replication INT DEFAULT 0,
  repeatability_score DECIMAL(3,2),
  
  -- Confidence
  confidence DECIMAL(3,2) NOT NULL,
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_experiment_wisdom_tenant ON experiment_wisdom(tenant_id);

ALTER TABLE experiment_wisdom ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON experiment_wisdom FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- LAYER 10: FAILURE & NEGATIVE INSIGHT MEMORY
-- Purpose: Store failures, near-misses, and prevention rules
-- ============================================================================

-- Failure Events (raw data)
CREATE TABLE IF NOT EXISTS public.failure_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  failure_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  was_near_miss BOOLEAN DEFAULT false,
  
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  
  impact JSONB NOT NULL,
  financial_impact INT,
  
  context_snapshot JSONB DEFAULT '{}'::jsonb,
  
  related_order_id UUID REFERENCES orders(id),
  related_product_id UUID REFERENCES products(id),
  related_campaign_id UUID REFERENCES campaigns(id),
  
  root_cause TEXT,
  root_cause_category VARCHAR(50),
  
  prevention_measures JSONB DEFAULT '[]'::jsonb,
  
  status VARCHAR(20) DEFAULT 'open',
  
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_failure_events_tenant ON failure_events(tenant_id);
CREATE INDEX idx_failure_events_type ON failure_events(tenant_id, failure_type);
CREATE INDEX idx_failure_events_severity ON failure_events(tenant_id, severity);

ALTER TABLE failure_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON failure_events FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Failure Patterns (AI READS THIS - learned prevention)
CREATE TABLE IF NOT EXISTS public.failure_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  pattern_name VARCHAR(255) NOT NULL,
  failure_types VARCHAR[] NOT NULL,
  
  -- Detection
  warning_signals JSONB NOT NULL,
  trigger_conditions JSONB NOT NULL,
  typical_timeline TEXT,
  
  -- Prevention
  prevention_rules JSONB NOT NULL,
  recommended_monitoring JSONB DEFAULT '[]'::jsonb,
  
  -- Stats
  occurrences INT DEFAULT 1,
  prevented_count INT DEFAULT 0,
  last_occurrence TIMESTAMPTZ,
  
  -- Confidence
  confidence DECIMAL(3,2) DEFAULT 0.5,
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_failure_patterns_tenant ON failure_patterns(tenant_id);

ALTER TABLE failure_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON failure_patterns FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- LAYER 11: DECISION MEMORY
-- Purpose: Store every decision with context, outcome, and lessons
-- ============================================================================

-- Decisions (AI READS AND WRITES)
CREATE TABLE IF NOT EXISTS public.decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  decision_type VARCHAR(50) NOT NULL,
  decision_maker VARCHAR(30) NOT NULL,
  made_by_user_id UUID REFERENCES auth.users(id),
  
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Context at decision time (CRITICAL)
  context_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Expected outcome
  expected_outcome JSONB NOT NULL,
  expected_confidence DECIMAL(3,2),
  
  -- Reasoning
  reasoning TEXT NOT NULL,
  evidence_refs JSONB DEFAULT '[]'::jsonb,
  
  -- Execution
  execution_status VARCHAR(30) DEFAULT 'pending',
  executed_at TIMESTAMPTZ,
  
  decision_made_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_decisions_tenant ON decisions(tenant_id);
CREATE INDEX idx_decisions_type ON decisions(tenant_id, decision_type);
CREATE INDEX idx_decisions_date ON decisions(tenant_id, decision_made_at);

ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON decisions FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Decision Outcomes
CREATE TABLE IF NOT EXISTS public.decision_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  
  measurement_type VARCHAR(30) NOT NULL,
  measurement_window_days INT,
  
  actual_outcome JSONB NOT NULL,
  outcome_vs_expected VARCHAR(30),
  variance_percentage DECIMAL(10,2),
  
  side_effects JSONB DEFAULT '[]'::jsonb,
  
  attribution_confidence DECIMAL(3,2) DEFAULT 1.0,
  
  measured_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_decision_outcomes_tenant ON decision_outcomes(tenant_id);
CREATE INDEX idx_decision_outcomes_decision ON decision_outcomes(decision_id);

ALTER TABLE decision_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON decision_outcomes FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Decision Lessons (AI READS THIS)
CREATE TABLE IF NOT EXISTS public.decision_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  
  lesson_type VARCHAR(30) NOT NULL,
  lesson TEXT NOT NULL,
  
  applies_to_decision_types VARCHAR[] NOT NULL,
  applies_to_conditions JSONB DEFAULT '{}'::jsonb,
  does_not_apply_when JSONB DEFAULT '{}'::jsonb,
  
  confidence DECIMAL(3,2) DEFAULT 0.5,
  times_validated INT DEFAULT 1,
  times_contradicted INT DEFAULT 0,
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_decision_lessons_tenant ON decision_lessons(tenant_id);
CREATE INDEX idx_decision_lessons_type ON decision_lessons(tenant_id, lesson_type);

ALTER TABLE decision_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON decision_lessons FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- LAYER 12: TRUST & CONFIDENCE MEMORY
-- Purpose: Track AI accuracy and adjust behavior dynamically
-- ============================================================================

-- AI Recommendations (raw data)
CREATE TABLE IF NOT EXISTS public.ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  recommendation_type VARCHAR(50) NOT NULL,
  recommendation TEXT NOT NULL,
  reasoning TEXT,
  
  ai_confidence DECIMAL(3,2) NOT NULL,
  
  context_snapshot JSONB DEFAULT '{}'::jsonb,
  evidence_refs JSONB DEFAULT '[]'::jsonb,
  
  user_response VARCHAR(30),
  user_id UUID REFERENCES auth.users(id),
  response_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  outcome_measured BOOLEAN DEFAULT false,
  outcome_success BOOLEAN,
  outcome_details JSONB,
  outcome_measured_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_recommendations_tenant ON ai_recommendations(tenant_id);
CREATE INDEX idx_ai_recommendations_type ON ai_recommendations(tenant_id, recommendation_type);

ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON ai_recommendations FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- AI Trust Scores (AI READS THIS)
CREATE TABLE IF NOT EXISTS public.ai_trust_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  recommendation_type VARCHAR(50) NOT NULL,
  
  period_type VARCHAR(20) NOT NULL,
  period_start DATE,
  
  total_recommendations INT DEFAULT 0,
  accepted_count INT DEFAULT 0,
  rejected_count INT DEFAULT 0,
  
  measured_count INT DEFAULT 0,
  success_count INT DEFAULT 0,
  
  accuracy_rate DECIMAL(5,4),
  acceptance_rate DECIMAL(5,4),
  
  avg_confidence DECIMAL(5,4),
  calibration_error DECIMAL(5,4),
  
  trust_score DECIMAL(3,2) DEFAULT 0.5,
  trust_trend VARCHAR(20),
  
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, recommendation_type, period_type, period_start)
);

CREATE INDEX idx_ai_trust_scores_tenant ON ai_trust_scores(tenant_id);

ALTER TABLE ai_trust_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON ai_trust_scores FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- AI Behavior Config (AI READS THIS)
CREATE TABLE IF NOT EXISTS public.ai_behavior_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  recommendation_type VARCHAR(50) NOT NULL,
  
  auto_execute_threshold DECIMAL(3,2) DEFAULT 0.9,
  suggest_threshold DECIMAL(3,2) DEFAULT 0.5,
  suppress_threshold DECIMAL(3,2) DEFAULT 0.3,
  
  adjusted_auto_threshold DECIMAL(3,2),
  adjusted_suggest_threshold DECIMAL(3,2),
  
  max_recommendations_per_day INT DEFAULT 10,
  min_interval_minutes INT DEFAULT 60,
  
  escalate_to_human_below DECIMAL(3,2) DEFAULT 0.7,
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, recommendation_type)
);

CREATE INDEX idx_ai_behavior_config_tenant ON ai_behavior_config(tenant_id);

ALTER TABLE ai_behavior_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON ai_behavior_config FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- LAYER 13: INSIGHT (DERIVED KNOWLEDGE) MEMORY
-- Purpose: Store cross-domain insights and meta-learnings
-- ============================================================================

-- Insights (AI READS AND WRITES)
CREATE TABLE IF NOT EXISTS public.insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Insight type
  insight_type VARCHAR(50) NOT NULL,
  insight_category VARCHAR(50) NOT NULL,
  
  -- Content
  title VARCHAR(255) NOT NULL,
  insight TEXT NOT NULL,
  
  -- Scope
  domains VARCHAR[] NOT NULL,
  scope_type VARCHAR(30),
  scope_id UUID,
  
  -- Evidence
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  supporting_data JSONB DEFAULT '{}'::jsonb,
  
  -- Impact
  estimated_impact INT,
  impact_type VARCHAR(20),
  
  -- Confidence
  confidence DECIMAL(3,2) NOT NULL DEFAULT 0.5,
  times_validated INT DEFAULT 0,
  times_contradicted INT DEFAULT 0,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active',
  
  -- Timestamps
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_insights_tenant ON insights(tenant_id);
CREATE INDEX idx_insights_type ON insights(tenant_id, insight_type);
CREATE INDEX idx_insights_category ON insights(tenant_id, insight_category);
CREATE INDEX idx_insights_status ON insights(tenant_id, status);

ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON insights FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- LAYER 14: LOCALIZATION MEMORY
-- Purpose: Store locale-specific patterns and preferences
-- ============================================================================

-- Localization is embedded in tenants table (country, currency, language, timezone)
-- This table stores learned locale-specific patterns

CREATE TABLE IF NOT EXISTS public.locale_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Locale scope
  country VARCHAR(2),
  region VARCHAR(100),
  city VARCHAR(100),
  
  -- Pattern type
  pattern_type VARCHAR(50) NOT NULL,
  
  -- Pattern data
  pattern_data JSONB NOT NULL,
  
  -- Examples
  -- payment_preferences: {"cod_rate": 0.85, "card_rate": 0.15}
  -- delivery_expectations: {"avg_days": 3, "acceptable_max": 5}
  -- shopping_hours: {"peak_start": 20, "peak_end": 23}
  -- seasonal_events: [{"name": "Ramadan", "impact": 1.5}]
  
  -- Confidence
  confidence DECIMAL(3,2) DEFAULT 0.5,
  sample_size INT DEFAULT 0,
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_locale_patterns_tenant ON locale_patterns(tenant_id);
CREATE INDEX idx_locale_patterns_country ON locale_patterns(tenant_id, country);

ALTER TABLE locale_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON locale_patterns FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- LAYER 15: WORKFLOW & AUTOMATION MEMORY
-- Purpose: Store workflow runs, errors, and automation learnings
-- ============================================================================

-- Workflow Runs (raw data)
CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  
  workflow_name VARCHAR(100) NOT NULL,
  workflow_version VARCHAR(20),
  
  execution_id VARCHAR(255) NOT NULL,
  idempotency_key VARCHAR(255),
  
  trigger_type VARCHAR(30) NOT NULL,
  trigger_data JSONB,
  
  status VARCHAR(20) NOT NULL,
  
  result JSONB,
  error_message TEXT,
  error_details JSONB,
  
  attempt_number INT DEFAULT 1,
  max_attempts INT DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflow_runs_tenant ON workflow_runs(tenant_id);
CREATE INDEX idx_workflow_runs_workflow ON workflow_runs(workflow_name);
CREATE INDEX idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX idx_workflow_runs_idempotency ON workflow_runs(idempotency_key);

ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON workflow_runs FOR ALL USING (
  tenant_id IS NULL OR tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Workflow Intelligence (AI READS THIS)
CREATE TABLE IF NOT EXISTS public.workflow_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  
  workflow_name VARCHAR(100) NOT NULL,
  
  -- Performance
  total_runs INT DEFAULT 0,
  success_count INT DEFAULT 0,
  failure_count INT DEFAULT 0,
  success_rate DECIMAL(5,4),
  
  -- Timing
  avg_duration_ms INT,
  p95_duration_ms INT,
  
  -- Errors
  common_errors JSONB DEFAULT '[]'::jsonb,
  
  -- Optimization
  recommended_retry_strategy JSONB,
  recommended_timeout_ms INT,
  
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, workflow_name)
);

CREATE INDEX idx_workflow_intelligence_tenant ON workflow_intelligence(tenant_id);

ALTER TABLE workflow_intelligence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON workflow_intelligence FOR ALL USING (
  tenant_id IS NULL OR tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true
  )
);

-- ============================================================================
-- MATERIALIZED VIEWS FOR AI
-- AI reads ONLY from these views, never from raw tables
-- ============================================================================

-- AI Context View (comprehensive context for AI decisions)
CREATE OR REPLACE VIEW ai_tenant_context AS
SELECT 
  t.id AS tenant_id,
  t.name,
  t.country,
  t.currency,
  t.language,
  t.timezone,
  t.plan,
  tcp.business_type,
  tcp.industry,
  tcp.avg_order_value,
  tcp.avg_margin_percentage,
  tcp.risk_tolerance,
  tcp.ai_autonomy_level,
  tcp.profile_confidence,
  oc.max_daily_orders,
  oc.capacity_utilization,
  oc.current_call_backlog
FROM tenants t
LEFT JOIN tenant_cognitive_profile tcp ON t.id = tcp.tenant_id
LEFT JOIN operational_capacity oc ON t.id = oc.tenant_id;

-- AI Product Summary View
CREATE OR REPLACE VIEW ai_product_summary AS
SELECT 
  p.tenant_id,
  p.id AS product_id,
  p.name,
  p.sku,
  p.selling_price,
  p.stock_quantity,
  pi.total_units_sold,
  pi.total_profit,
  pi.avg_margin_percentage,
  pi.sales_velocity_daily,
  pi.sales_trend,
  pi.stockout_risk,
  pi.reorder_point,
  pi.intelligence_confidence
FROM products p
LEFT JOIN product_intelligence pi ON p.id = pi.product_id
WHERE p.status = 'active';

-- AI Campaign Summary View
CREATE OR REPLACE VIEW ai_campaign_summary AS
SELECT 
  c.tenant_id,
  c.id AS campaign_id,
  c.name,
  c.platform,
  c.budget,
  c.budget_spent,
  ci.ctr,
  ci.cpc,
  ci.cpa,
  ci.roas,
  ci.true_roas,
  ci.net_profit,
  ci.scaling_potential,
  ci.intelligence_confidence
FROM campaigns c
LEFT JOIN campaign_intelligence ci ON c.id = ci.campaign_id
WHERE c.status = 'active';

-- AI Decision Context Function
CREATE OR REPLACE FUNCTION get_ai_context(p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_context JSONB;
BEGIN
  SELECT jsonb_build_object(
    'tenant', (SELECT row_to_json(t) FROM ai_tenant_context t WHERE tenant_id = p_tenant_id),
    'trust_scores', COALESCE(
      (SELECT jsonb_object_agg(recommendation_type, trust_score) 
       FROM ai_trust_scores 
       WHERE tenant_id = p_tenant_id AND period_type = 'all_time'),
      '{}'::jsonb
    ),
    'active_constraints', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'type', constraint_type,
        'name', name,
        'utilization', current_utilization
      )) FROM constraints 
       WHERE tenant_id = p_tenant_id AND is_active = true),
      '[]'::jsonb
    ),
    'recent_failures', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'type', failure_type,
        'severity', severity,
        'title', title,
        'detected_at', detected_at
      )) FROM failure_events 
       WHERE tenant_id = p_tenant_id 
         AND detected_at > NOW() - INTERVAL '30 days'
         AND status != 'resolved'
       ORDER BY detected_at DESC LIMIT 5),
      '[]'::jsonb
    ),
    'active_lessons', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'lesson', lesson,
        'type', lesson_type,
        'confidence', confidence
      )) FROM decision_lessons 
       WHERE tenant_id = p_tenant_id 
         AND is_active = true 
         AND confidence > 0.6
       ORDER BY confidence DESC LIMIT 10),
      '[]'::jsonb
    ),
    'active_insights', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'title', title,
        'insight', insight,
        'confidence', confidence
      )) FROM insights 
       WHERE tenant_id = p_tenant_id 
         AND status = 'active'
         AND confidence > 0.6
       ORDER BY confidence DESC LIMIT 10),
      '[]'::jsonb
    )
  ) INTO v_context;
  
  RETURN v_context;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Update AI trust after outcome
CREATE OR REPLACE FUNCTION update_ai_trust(
  p_recommendation_id UUID,
  p_was_successful BOOLEAN
)
RETURNS VOID AS $$
DECLARE
  v_tenant_id UUID;
  v_recommendation_type VARCHAR(50);
BEGIN
  SELECT tenant_id, recommendation_type 
  INTO v_tenant_id, v_recommendation_type
  FROM ai_recommendations 
  WHERE id = p_recommendation_id;
  
  UPDATE ai_recommendations 
  SET outcome_measured = true,
      outcome_success = p_was_successful,
      outcome_measured_at = NOW()
  WHERE id = p_recommendation_id;
  
  INSERT INTO ai_trust_scores (
    tenant_id, recommendation_type, period_type,
    total_recommendations, measured_count, success_count, trust_score
  )
  VALUES (
    v_tenant_id, v_recommendation_type, 'all_time',
    1, 1, CASE WHEN p_was_successful THEN 1 ELSE 0 END, 0.5
  )
  ON CONFLICT (tenant_id, recommendation_type, period_type, period_start)
  DO UPDATE SET
    measured_count = ai_trust_scores.measured_count + 1,
    success_count = ai_trust_scores.success_count + CASE WHEN p_was_successful THEN 1 ELSE 0 END,
    accuracy_rate = (ai_trust_scores.success_count + CASE WHEN p_was_successful THEN 1 ELSE 0 END)::DECIMAL 
                    / (ai_trust_scores.measured_count + 1),
    trust_score = LEAST(1.0, GREATEST(0.0,
      ai_trust_scores.trust_score + CASE WHEN p_was_successful THEN 0.02 ELSE -0.05 END
    )),
    last_updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- 
-- 15 MEMORY LAYERS IMPLEMENTED:
-- 
-- Layer 1:  Tenant Cognitive Memory        ✓ tenants, tenant_cognitive_profile
-- Layer 2:  Product Intelligence Memory    ✓ products, product_intelligence
-- Layer 3:  Campaign Learning Memory       ✓ campaigns, campaign_intelligence, campaign_learnings
-- Layer 4:  Customer Behavior Memory       ✓ customer_segments, customer_behavior_patterns
-- Layer 5:  Operational Reality Memory     ✓ operational_capacity, operational_metrics_daily
-- Layer 6:  Fulfillment & Shipping         ✓ orders, shipments, shipping_intelligence
-- Layer 7:  Unit Economics Temporal        ✓ financial_transactions, order_profit_timeline, unit_economics_summary
-- Layer 8:  Marketing-to-Cash Memory       ✓ marketing_to_cash_journey
-- Layer 9:  Experiment Memory              ✓ experiments, experiment_wisdom
-- Layer 10: Failure & Negative Insight     ✓ failure_events, failure_patterns
-- Layer 11: Decision Memory                ✓ decisions, decision_outcomes, decision_lessons
-- Layer 12: Trust & Confidence Memory      ✓ ai_recommendations, ai_trust_scores, ai_behavior_config
-- Layer 13: Insight (Derived Knowledge)    ✓ insights
-- Layer 14: Localization Memory            ✓ locale_patterns (+ tenants.country/currency/language/timezone)
-- Layer 15: Workflow & Automation          ✓ workflow_runs, workflow_intelligence
-- 
-- AI SEPARATION:
-- - AI reads ONLY from: *_intelligence, *_summary, *_wisdom, *_patterns, ai_* tables
-- - AI does NOT read from: orders, products, campaigns, financial_transactions (raw)
-- - Views: ai_tenant_context, ai_product_summary, ai_campaign_summary
-- - Function: get_ai_context(tenant_id) returns complete AI decision context
-- 
-- REQUIREMENTS MET:
-- ✓ Real profit over time is measurable (order_profit_timeline, unit_economics_summary)
-- ✓ Decisions are traceable to outcomes (decisions → decision_outcomes → decision_lessons)
-- ✓ Failures are preserved (failure_events, failure_patterns)
-- ✓ AI never works statelessly (get_ai_context provides full context)
-- 
-- ============================================================================
-- ============================================================================
-- DeepSolution: Missing Core Tables
-- Version: 2.1 - Complete foundation tables
-- ============================================================================

-- ============================================================================
-- PROFILES (linked to auth.users)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic info
  full_name VARCHAR(255),
  avatar_url VARCHAR(500),
  phone VARCHAR(20),
  
  -- Preferences
  language VARCHAR(5) DEFAULT 'ar',
  timezone VARCHAR(50) DEFAULT 'Asia/Riyadh',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- No tenant_id - profiles are user-level, not tenant-level
-- RLS based on auth.uid()
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

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END;
$$;

-- ============================================================================
-- TENANT_USERS (membership table for RLS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Role within tenant
  role VARCHAR(20) NOT NULL DEFAULT 'member' 
    CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Invitation
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint
  UNIQUE(tenant_id, user_id)
);

CREATE INDEX idx_tenant_users_tenant ON tenant_users(tenant_id);
CREATE INDEX idx_tenant_users_user ON tenant_users(user_id);
CREATE INDEX idx_tenant_users_active ON tenant_users(user_id, is_active);

-- RLS for tenant_users
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;

-- Users can see their own memberships
CREATE POLICY "users_can_view_own_memberships" ON tenant_users
  FOR SELECT USING (user_id = auth.uid());

-- Admins/owners can manage tenant members
CREATE POLICY "admins_can_manage_members" ON tenant_users
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users 
      WHERE user_id = auth.uid() 
        AND is_active = true 
        AND role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- SUBSCRIPTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  
  -- Plan info
  plan VARCHAR(20) NOT NULL DEFAULT 'free',
  status VARCHAR(20) NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'past_due', 'cancelled', 'trialing')),
  
  -- Billing
  billing_cycle VARCHAR(20) DEFAULT 'monthly',
  price_per_cycle INT DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'SAR',
  
  -- Dates
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ DEFAULT NOW(),
  current_period_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- Usage limits
  max_products INT DEFAULT 50,
  max_orders_per_month INT DEFAULT 100,
  max_team_members INT DEFAULT 1,
  max_ai_requests_per_month INT DEFAULT 100,
  
  -- Current usage
  current_products INT DEFAULT 0,
  current_orders_this_month INT DEFAULT 0,
  current_ai_requests_this_month INT DEFAULT 0,
  
  -- External
  external_subscription_id VARCHAR(255),
  external_customer_id VARCHAR(255),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_tenant ON subscriptions(tenant_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON subscriptions FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- ORDER_ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  
  -- Product snapshot (in case product changes/deleted)
  product_name VARCHAR(255) NOT NULL,
  product_sku VARCHAR(100),
  
  -- Pricing
  unit_price INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  discount_amount INT DEFAULT 0,
  total_price INT NOT NULL,
  
  -- Cost (for profit calculation)
  unit_cost INT DEFAULT 0,
  total_cost INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_items_tenant ON order_items(tenant_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON order_items FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- ORDER_STATUS_HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Status change
  from_status VARCHAR(30),
  to_status VARCHAR(30) NOT NULL,
  
  -- Call status change (if applicable)
  from_call_status VARCHAR(30),
  to_call_status VARCHAR(30),
  
  -- Who/what made the change
  changed_by_user_id UUID REFERENCES auth.users(id),
  changed_by_system VARCHAR(50), -- 'n8n', 'api', 'manual'
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_status_history_tenant ON order_status_history(tenant_id);
CREATE INDEX idx_order_status_history_order ON order_status_history(order_id);
CREATE INDEX idx_order_status_history_date ON order_status_history(tenant_id, changed_at);

ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON order_status_history FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- CONSTRAINTS (for Layer 15 - Constraint & Reality Memory)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Constraint definition
  constraint_type VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Limits
  limit_value DECIMAL(15,2) NOT NULL,
  limit_unit VARCHAR(30) NOT NULL,
  
  -- Current state
  current_value DECIMAL(15,2) DEFAULT 0,
  current_utilization DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE WHEN limit_value > 0 THEN current_value / limit_value ELSE 0 END
  ) STORED,
  
  -- Thresholds
  warning_threshold DECIMAL(5,4) DEFAULT 0.8,
  critical_threshold DECIMAL(5,4) DEFAULT 0.95,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_hard_limit BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_constraints_tenant ON constraints(tenant_id);
CREATE INDEX idx_constraints_type ON constraints(tenant_id, constraint_type);

ALTER TABLE constraints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON constraints FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Constraint Violations (track when limits exceeded)
CREATE TABLE IF NOT EXISTS public.constraint_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  constraint_id UUID NOT NULL REFERENCES constraints(id) ON DELETE CASCADE,
  
  -- Violation details
  violation_type VARCHAR(30) NOT NULL, -- 'warning', 'critical', 'exceeded'
  value_at_violation DECIMAL(15,2) NOT NULL,
  limit_at_violation DECIMAL(15,2) NOT NULL,
  
  -- Context
  context JSONB DEFAULT '{}'::jsonb,
  
  -- Resolution
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  -- Timestamps
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_constraint_violations_tenant ON constraint_violations(tenant_id);
CREATE INDEX idx_constraint_violations_constraint ON constraint_violations(constraint_id);

ALTER TABLE constraint_violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON constraint_violations FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- PRODUCT_VARIANTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  -- Variant info
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),
  
  -- Options (e.g., size, color)
  options JSONB DEFAULT '{}'::jsonb,
  
  -- Pricing
  cost_price INT DEFAULT 0,
  selling_price INT NOT NULL,
  
  -- Inventory
  stock_quantity INT DEFAULT 0,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_product_variants_tenant ON product_variants(tenant_id);
CREATE INDEX idx_product_variants_product ON product_variants(product_id);

ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON product_variants FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- INVENTORY_LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  
  -- Change details
  change_type VARCHAR(30) NOT NULL,
  quantity_before INT NOT NULL,
  quantity_change INT NOT NULL,
  quantity_after INT NOT NULL,
  
  -- Reference
  reference_type VARCHAR(30),
  reference_id UUID,
  
  -- Notes
  notes TEXT,
  
  -- Who made the change
  changed_by_user_id UUID REFERENCES auth.users(id),
  changed_by_system VARCHAR(50),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_logs_tenant ON inventory_logs(tenant_id);
CREATE INDEX idx_inventory_logs_product ON inventory_logs(product_id);
CREATE INDEX idx_inventory_logs_date ON inventory_logs(tenant_id, created_at);

ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON inventory_logs FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- FILES (for file storage metadata)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- File info
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255),
  mime_type VARCHAR(100),
  size_bytes BIGINT,
  
  -- Storage
  storage_path VARCHAR(500) NOT NULL,
  storage_bucket VARCHAR(100) NOT NULL,
  public_url VARCHAR(500),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Ownership
  uploaded_by UUID REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_files_tenant ON files(tenant_id);
CREATE INDEX idx_files_uploaded_by ON files(uploaded_by);

ALTER TABLE files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON files FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- AUDIT_LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  
  -- Action info
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  
  -- Actor
  actor_type VARCHAR(20) NOT NULL, -- 'user', 'system', 'api', 'n8n'
  actor_id UUID,
  actor_name VARCHAR(255),
  
  -- Changes
  old_values JSONB,
  new_values JSONB,
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_date ON audit_logs(tenant_id, created_at);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON audit_logs FOR ALL USING (
  tenant_id IS NULL OR tenant_id IN (
    SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true
  )
);

-- ============================================================================
-- LANDING_PAGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Page info
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  
  -- Content (AI-generated)
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  html_content TEXT,
  
  -- Product association
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  
  -- SEO
  meta_title VARCHAR(255),
  meta_description TEXT,
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  
  -- Analytics
  views INT DEFAULT 0,
  conversions INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique slug per tenant
  UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_landing_pages_tenant ON landing_pages(tenant_id);
CREATE INDEX idx_landing_pages_product ON landing_pages(product_id);
CREATE INDEX idx_landing_pages_slug ON landing_pages(tenant_id, slug);

ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON landing_pages FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- AI_CONVERSATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Conversation
  title VARCHAR(255),
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Context (what AI knows about this conversation)
  context JSONB DEFAULT '{}'::jsonb,
  
  -- Token usage
  total_tokens_used INT DEFAULT 0,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_conversations_tenant ON ai_conversations(tenant_id);
CREATE INDEX idx_ai_conversations_user ON ai_conversations(user_id);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON ai_conversations FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- STRATEGIC_GOALS (for Strategy Memory)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.strategic_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Goal definition
  name VARCHAR(255) NOT NULL,
  description TEXT,
  goal_type VARCHAR(50) NOT NULL,
  
  -- Target
  target_metric VARCHAR(100) NOT NULL,
  target_value DECIMAL(15,2) NOT NULL,
  target_unit VARCHAR(30),
  
  -- Current progress
  current_value DECIMAL(15,2) DEFAULT 0,
  progress_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN target_value > 0 THEN LEAST(100, (current_value / target_value) * 100) ELSE 0 END
  ) STORED,
  
  -- Timeline
  start_date DATE,
  target_date DATE,
  
  -- Priority
  priority INT DEFAULT 5,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_strategic_goals_tenant ON strategic_goals(tenant_id);
CREATE INDEX idx_strategic_goals_status ON strategic_goals(tenant_id, status);

ALTER TABLE strategic_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON strategic_goals FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- 
-- Added tables:
-- - profiles (user profiles, linked to auth.users)
-- - tenant_users (membership for RLS)
-- - subscriptions (billing and limits)
-- - order_items (order line items)
-- - order_status_history (status changes)
-- - constraints (operational constraints)
-- - constraint_violations (limit breaches)
-- - product_variants (product variations)
-- - inventory_logs (stock changes)
-- - files (file metadata)
-- - audit_logs (activity tracking)
-- - landing_pages (AI-generated pages)
-- - ai_conversations (chat history)
-- - strategic_goals (business goals)
-- 
-- ============================================================================
-- ============================================================================
-- DeepSolution: Raw Immutable Event Stream
-- Version: 2.2 - Event-Driven Architecture Foundation
-- ============================================================================
--
-- PURPOSE:
-- Single source of truth for ALL commerce & behavioral events.
-- This table is IMMUTABLE - events are never updated or deleted.
-- AI reads ONLY derived summaries, NEVER this raw table.
--
-- ============================================================================

-- ============================================================================
-- RAW EVENT STREAM (Immutable)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.events (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Idempotency (CRITICAL - prevents duplicate events)
  idempotency_key VARCHAR(255) NOT NULL,
  
  -- Multi-tenant isolation
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Event identification
  event_type VARCHAR(100) NOT NULL,
  event_category VARCHAR(50) NOT NULL,
  event_version VARCHAR(10) DEFAULT '1.0',
  
  -- Timestamp (immutable, server-side)
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Session & User tracking
  session_id VARCHAR(100),
  anonymous_id VARCHAR(100),
  customer_id UUID,
  user_id UUID REFERENCES auth.users(id),
  
  -- Entity references
  product_id UUID,
  variant_id UUID,
  order_id UUID,
  campaign_id UUID,
  landing_page_id UUID,
  
  -- Marketing attribution
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(255),
  utm_term VARCHAR(255),
  utm_content VARCHAR(255),
  ad_id VARCHAR(255),
  ad_group_id VARCHAR(255),
  ad_creative_id VARCHAR(255),
  referrer VARCHAR(500),
  
  -- Device & Location
  device_type VARCHAR(20),
  device_os VARCHAR(50),
  browser VARCHAR(50),
  ip_address INET,
  country VARCHAR(2),
  region VARCHAR(100),
  city VARCHAR(100),
  
  -- Event payload (flexible schema per event type)
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Context (page, screen, app info)
  context JSONB DEFAULT '{}'::jsonb,
  
  -- Source system
  source VARCHAR(50) NOT NULL DEFAULT 'web',
  source_version VARCHAR(20),
  
  -- Processing status
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT events_idempotency_unique UNIQUE (tenant_id, idempotency_key)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Primary access patterns
CREATE INDEX idx_events_tenant_timestamp ON events(tenant_id, event_timestamp DESC);
CREATE INDEX idx_events_tenant_type ON events(tenant_id, event_type, event_timestamp DESC);
CREATE INDEX idx_events_tenant_category ON events(tenant_id, event_category, event_timestamp DESC);

-- Entity lookups
CREATE INDEX idx_events_session ON events(tenant_id, session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_events_customer ON events(tenant_id, customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_events_product ON events(tenant_id, product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_events_order ON events(tenant_id, order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_events_campaign ON events(tenant_id, campaign_id) WHERE campaign_id IS NOT NULL;

-- Attribution analysis
CREATE INDEX idx_events_utm_source ON events(tenant_id, utm_source) WHERE utm_source IS NOT NULL;
CREATE INDEX idx_events_utm_campaign ON events(tenant_id, utm_campaign) WHERE utm_campaign IS NOT NULL;

-- Processing queue
CREATE INDEX idx_events_unprocessed ON events(tenant_id, event_type, processed) WHERE processed = false;

-- Time-based partitioning hint (for future optimization)
CREATE INDEX idx_events_timestamp_only ON events(event_timestamp DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY "tenant_isolation" ON events FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id FROM tenant_users 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- ============================================================================
-- EVENT TYPES REFERENCE
-- ============================================================================

COMMENT ON TABLE events IS 'Immutable event stream for all commerce & behavioral events. AI reads ONLY derived summaries.';

COMMENT ON COLUMN events.event_type IS '
Standard event types:
-- Discovery & Browsing
  page_view, product_view, category_view, search, landing_page_view
  
-- Engagement
  product_click, add_to_wishlist, share_product, review_submit
  
-- Cart & Checkout
  add_to_cart, remove_from_cart, cart_view, checkout_start, checkout_step
  
-- Orders
  order_created, order_confirmed, order_cancelled, order_updated
  
-- Payments
  payment_initiated, payment_success, payment_failed, payment_refunded
  
-- Fulfillment
  order_shipped, order_delivered, order_returned, shipment_update
  
-- Call Center
  call_attempted, call_answered, call_confirmed, call_rejected, call_no_answer
  
-- Support
  support_ticket_created, support_ticket_resolved, complaint_filed
  
-- Marketing
  campaign_impression, campaign_click, email_sent, email_opened, sms_sent
  
-- AI Interactions
  ai_chat_message, ai_recommendation_shown, ai_recommendation_clicked
  
-- System
  user_signup, user_login, user_logout, settings_changed
';

COMMENT ON COLUMN events.event_category IS '
Categories: discovery, engagement, cart, checkout, order, payment, fulfillment, call_center, support, marketing, ai, system
';

-- ============================================================================
-- EVENT SUMMARIES (AI READS THESE)
-- ============================================================================

-- Daily event aggregates per tenant
CREATE TABLE IF NOT EXISTS public.event_summaries_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  summary_date DATE NOT NULL,
  
  -- Discovery metrics
  page_views INT DEFAULT 0,
  unique_visitors INT DEFAULT 0,
  product_views INT DEFAULT 0,
  unique_products_viewed INT DEFAULT 0,
  searches INT DEFAULT 0,
  
  -- Engagement metrics
  add_to_cart_count INT DEFAULT 0,
  add_to_cart_value INT DEFAULT 0,
  remove_from_cart_count INT DEFAULT 0,
  wishlist_adds INT DEFAULT 0,
  
  -- Checkout metrics
  checkout_starts INT DEFAULT 0,
  checkout_completions INT DEFAULT 0,
  checkout_abandonment_rate DECIMAL(5,4),
  
  -- Order metrics
  orders_created INT DEFAULT 0,
  orders_confirmed INT DEFAULT 0,
  orders_cancelled INT DEFAULT 0,
  orders_value INT DEFAULT 0,
  
  -- Payment metrics
  payments_initiated INT DEFAULT 0,
  payments_successful INT DEFAULT 0,
  payments_failed INT DEFAULT 0,
  refunds_count INT DEFAULT 0,
  refunds_value INT DEFAULT 0,
  
  -- Fulfillment metrics
  orders_shipped INT DEFAULT 0,
  orders_delivered INT DEFAULT 0,
  orders_returned INT DEFAULT 0,
  
  -- Call center metrics
  calls_attempted INT DEFAULT 0,
  calls_answered INT DEFAULT 0,
  calls_confirmed INT DEFAULT 0,
  confirmation_rate DECIMAL(5,4),
  
  -- Marketing metrics
  campaign_impressions INT DEFAULT 0,
  campaign_clicks INT DEFAULT 0,
  campaign_ctr DECIMAL(5,4),
  
  -- AI metrics
  ai_conversations INT DEFAULT 0,
  ai_recommendations_shown INT DEFAULT 0,
  ai_recommendations_clicked INT DEFAULT 0,
  
  -- Conversion funnel
  visitor_to_cart_rate DECIMAL(5,4),
  cart_to_checkout_rate DECIMAL(5,4),
  checkout_to_order_rate DECIMAL(5,4),
  overall_conversion_rate DECIMAL(5,4),
  
  -- Timestamps
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, summary_date)
);

CREATE INDEX idx_event_summaries_daily_tenant ON event_summaries_daily(tenant_id);
CREATE INDEX idx_event_summaries_daily_date ON event_summaries_daily(tenant_id, summary_date DESC);

ALTER TABLE event_summaries_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON event_summaries_daily FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- SESSION SUMMARIES (AI READS THESE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.session_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  session_id VARCHAR(100) NOT NULL,
  
  -- Session timing
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INT,
  
  -- User identification
  anonymous_id VARCHAR(100),
  customer_id UUID,
  is_returning_visitor BOOLEAN DEFAULT false,
  
  -- Attribution
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(255),
  landing_page VARCHAR(500),
  referrer VARCHAR(500),
  
  -- Device
  device_type VARCHAR(20),
  country VARCHAR(2),
  
  -- Engagement
  page_views INT DEFAULT 0,
  product_views INT DEFAULT 0,
  products_viewed UUID[] DEFAULT '{}',
  
  -- Actions
  added_to_cart BOOLEAN DEFAULT false,
  cart_value INT DEFAULT 0,
  started_checkout BOOLEAN DEFAULT false,
  completed_order BOOLEAN DEFAULT false,
  order_id UUID,
  order_value INT DEFAULT 0,
  
  -- Outcome
  session_outcome VARCHAR(30), -- 'bounce', 'browse', 'cart', 'checkout', 'purchase'
  
  -- Timestamps
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, session_id)
);

CREATE INDEX idx_session_summaries_tenant ON session_summaries(tenant_id);
CREATE INDEX idx_session_summaries_date ON session_summaries(tenant_id, started_at DESC);
CREATE INDEX idx_session_summaries_outcome ON session_summaries(tenant_id, session_outcome);

ALTER TABLE session_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON session_summaries FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- PRODUCT EVENT SUMMARIES (AI READS THESE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.product_event_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  period_type VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly', 'all_time'
  period_start DATE,
  
  -- Views
  views INT DEFAULT 0,
  unique_viewers INT DEFAULT 0,
  
  -- Engagement
  add_to_cart_count INT DEFAULT 0,
  add_to_cart_rate DECIMAL(5,4),
  wishlist_adds INT DEFAULT 0,
  
  -- Purchases
  purchases INT DEFAULT 0,
  purchase_rate DECIMAL(5,4), -- purchases / views
  revenue INT DEFAULT 0,
  
  -- Returns
  returns INT DEFAULT 0,
  return_rate DECIMAL(5,4),
  
  -- Attribution
  top_utm_sources JSONB DEFAULT '[]'::jsonb,
  top_campaigns JSONB DEFAULT '[]'::jsonb,
  
  -- Timestamps
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, product_id, period_type, period_start)
);

CREATE INDEX idx_product_event_summaries_tenant ON product_event_summaries(tenant_id);
CREATE INDEX idx_product_event_summaries_product ON product_event_summaries(product_id);

ALTER TABLE product_event_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON product_event_summaries FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- CAMPAIGN EVENT SUMMARIES (AI READS THESE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.campaign_event_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Attribution grouping
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(255),
  campaign_id UUID REFERENCES campaigns(id),
  
  period_type VARCHAR(20) NOT NULL,
  period_start DATE,
  
  -- Traffic
  sessions INT DEFAULT 0,
  unique_visitors INT DEFAULT 0,
  page_views INT DEFAULT 0,
  
  -- Engagement
  product_views INT DEFAULT 0,
  add_to_cart_count INT DEFAULT 0,
  
  -- Conversions
  orders INT DEFAULT 0,
  revenue INT DEFAULT 0,
  
  -- Funnel rates
  session_to_cart_rate DECIMAL(5,4),
  cart_to_order_rate DECIMAL(5,4),
  overall_conversion_rate DECIMAL(5,4),
  
  -- Cost & ROI (if campaign_id linked)
  ad_spend INT DEFAULT 0,
  cpa INT DEFAULT 0,
  roas DECIMAL(10,4),
  
  -- Timestamps
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, utm_source, utm_medium, utm_campaign, period_type, period_start)
);

CREATE INDEX idx_campaign_event_summaries_tenant ON campaign_event_summaries(tenant_id);
CREATE INDEX idx_campaign_event_summaries_campaign ON campaign_event_summaries(campaign_id);

ALTER TABLE campaign_event_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON campaign_event_summaries FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- CUSTOMER JOURNEY SUMMARIES (AI READS THESE - Privacy Safe)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.customer_journey_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Anonymized customer reference
  customer_hash VARCHAR(64) NOT NULL, -- hashed customer_id for privacy
  
  -- Lifecycle
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  first_order_at TIMESTAMPTZ,
  last_order_at TIMESTAMPTZ,
  
  -- Engagement totals
  total_sessions INT DEFAULT 0,
  total_page_views INT DEFAULT 0,
  total_product_views INT DEFAULT 0,
  
  -- Purchase behavior
  total_orders INT DEFAULT 0,
  total_revenue INT DEFAULT 0,
  avg_order_value INT DEFAULT 0,
  
  -- Returns
  total_returns INT DEFAULT 0,
  return_rate DECIMAL(5,4),
  
  -- RFM scores (Recency, Frequency, Monetary)
  recency_days INT,
  frequency_score INT,
  monetary_score INT,
  rfm_segment VARCHAR(30),
  
  -- Predicted values
  predicted_ltv INT,
  churn_risk DECIMAL(3,2),
  
  -- Attribution (first touch)
  first_utm_source VARCHAR(100),
  first_utm_campaign VARCHAR(255),
  
  -- Timestamps
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, customer_hash)
);

CREATE INDEX idx_customer_journey_summaries_tenant ON customer_journey_summaries(tenant_id);
CREATE INDEX idx_customer_journey_summaries_segment ON customer_journey_summaries(tenant_id, rfm_segment);

ALTER TABLE customer_journey_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON customer_journey_summaries FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- FUNNEL ANALYSIS VIEW (AI READS THIS)
-- ============================================================================

CREATE OR REPLACE VIEW ai_funnel_analysis AS
SELECT 
  tenant_id,
  summary_date,
  unique_visitors,
  product_views,
  add_to_cart_count,
  checkout_starts,
  orders_created,
  orders_confirmed,
  orders_delivered,
  
  -- Funnel rates
  CASE WHEN unique_visitors > 0 
    THEN product_views::DECIMAL / unique_visitors 
    ELSE 0 END AS view_rate,
  
  CASE WHEN product_views > 0 
    THEN add_to_cart_count::DECIMAL / product_views 
    ELSE 0 END AS add_to_cart_rate,
  
  CASE WHEN add_to_cart_count > 0 
    THEN checkout_starts::DECIMAL / add_to_cart_count 
    ELSE 0 END AS checkout_rate,
  
  CASE WHEN checkout_starts > 0 
    THEN orders_created::DECIMAL / checkout_starts 
    ELSE 0 END AS order_rate,
  
  CASE WHEN orders_created > 0 
    THEN orders_confirmed::DECIMAL / orders_created 
    ELSE 0 END AS confirmation_rate,
  
  CASE WHEN orders_confirmed > 0 
    THEN orders_delivered::DECIMAL / orders_confirmed 
    ELSE 0 END AS delivery_rate,
  
  -- Overall conversion
  CASE WHEN unique_visitors > 0 
    THEN orders_delivered::DECIMAL / unique_visitors 
    ELSE 0 END AS overall_conversion_rate

FROM event_summaries_daily;

-- ============================================================================
-- HELPER FUNCTION: Record Event
-- ============================================================================

CREATE OR REPLACE FUNCTION record_event(
  p_tenant_id UUID,
  p_event_type VARCHAR(100),
  p_event_category VARCHAR(50),
  p_idempotency_key VARCHAR(255),
  p_properties JSONB DEFAULT '{}'::jsonb,
  p_session_id VARCHAR(100) DEFAULT NULL,
  p_customer_id UUID DEFAULT NULL,
  p_product_id UUID DEFAULT NULL,
  p_order_id UUID DEFAULT NULL,
  p_campaign_id UUID DEFAULT NULL,
  p_utm_source VARCHAR(100) DEFAULT NULL,
  p_utm_medium VARCHAR(100) DEFAULT NULL,
  p_utm_campaign VARCHAR(255) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO events (
    tenant_id, event_type, event_category, idempotency_key,
    properties, session_id, customer_id, product_id, order_id, campaign_id,
    utm_source, utm_medium, utm_campaign
  )
  VALUES (
    p_tenant_id, p_event_type, p_event_category, p_idempotency_key,
    p_properties, p_session_id, p_customer_id, p_product_id, p_order_id, p_campaign_id,
    p_utm_source, p_utm_medium, p_utm_campaign
  )
  ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SUMMARY
-- ============================================================================
--
-- TABLES CREATED:
-- 1. events (RAW - AI NEVER READS)
--    - Immutable event stream
--    - All commerce & behavioral events
--    - Idempotency key for deduplication
--    - Full attribution tracking (UTM, ad IDs)
--    - Session, customer, product, order references
--
-- 2. event_summaries_daily (AI READS)
--    - Daily aggregates per tenant
--    - All funnel metrics
--
-- 3. session_summaries (AI READS)
--    - Per-session aggregates
--    - Session outcome classification
--
-- 4. product_event_summaries (AI READS)
--    - Per-product performance
--    - View-to-purchase funnel
--
-- 5. campaign_event_summaries (AI READS)
--    - Per-campaign/UTM performance
--    - Attribution analysis
--
-- 6. customer_journey_summaries (AI READS - Privacy Safe)
--    - Anonymized customer journeys
--    - RFM segmentation
--    - LTV prediction inputs
--
-- VIEW CREATED:
-- - ai_funnel_analysis (AI READS)
--
-- FUNCTION CREATED:
-- - record_event() for safe event insertion with idempotency
--
-- ============================================================================
-- ============================================================================
-- DeepSolution: Intelligent Templates System
-- Version: 2.3 - Platform-Owned Templates & Blocks
-- ============================================================================
--
-- ARCHITECTURE:
-- - Templates are PLATFORM-OWNED (not tenant-owned)
-- - Templates are JSON-structured (not static HTML)
-- - Templates are categorized for AI selection
-- - Blocks are reusable components within templates
-- - Page Instances are tenant-specific pages built from templates
-- - Versions track all changes for rollback
-- - Performance metadata enables AI optimization
--
-- ============================================================================

-- ============================================================================
-- TEMPLATE CATEGORIES (Platform-owned reference data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.template_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Category identification
  slug VARCHAR(50) NOT NULL UNIQUE,
  name_en VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Hierarchy
  parent_id UUID REFERENCES template_categories(id),
  level INT DEFAULT 0,
  path VARCHAR(500), -- e.g., 'ecommerce/fashion/luxury'
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default categories
INSERT INTO template_categories (slug, name_en, name_ar, path, level) VALUES
-- Product Types
('physical-product', 'Physical Product', 'منتج مادي', 'product-type/physical', 1),
('digital-product', 'Digital Product', 'منتج رقمي', 'product-type/digital', 1),
('service', 'Service', 'خدمة', 'product-type/service', 1),
('subscription', 'Subscription', 'اشتراك', 'product-type/subscription', 1),

-- Funnel Stages
('awareness', 'Awareness', 'الوعي', 'funnel/awareness', 1),
('consideration', 'Consideration', 'الاعتبار', 'funnel/consideration', 1),
('decision', 'Decision', 'القرار', 'funnel/decision', 1),
('retention', 'Retention', 'الاحتفاظ', 'funnel/retention', 1),

-- Price Tiers
('budget', 'Budget', 'اقتصادي', 'price-tier/budget', 1),
('mid-range', 'Mid-Range', 'متوسط', 'price-tier/mid-range', 1),
('premium', 'Premium', 'فاخر', 'price-tier/premium', 1),
('luxury', 'Luxury', 'فخم', 'price-tier/luxury', 1),

-- Marketing Styles
('urgency', 'Urgency/Scarcity', 'الاستعجال والندرة', 'style/urgency', 1),
('social-proof', 'Social Proof', 'الدليل الاجتماعي', 'style/social-proof', 1),
('storytelling', 'Storytelling', 'السرد القصصي', 'style/storytelling', 1),
('comparison', 'Comparison', 'المقارنة', 'style/comparison', 1),
('benefits-focused', 'Benefits Focused', 'التركيز على الفوائد', 'style/benefits', 1),
('problem-solution', 'Problem-Solution', 'المشكلة والحل', 'style/problem-solution', 1),

-- Industries
('fashion', 'Fashion & Apparel', 'الأزياء والملابس', 'industry/fashion', 1),
('electronics', 'Electronics', 'الإلكترونيات', 'industry/electronics', 1),
('beauty', 'Beauty & Cosmetics', 'الجمال ومستحضرات التجميل', 'industry/beauty', 1),
('food', 'Food & Beverages', 'الأغذية والمشروبات', 'industry/food', 1),
('health', 'Health & Wellness', 'الصحة والعافية', 'industry/health', 1),
('home', 'Home & Living', 'المنزل والمعيشة', 'industry/home', 1)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- BLOCKS (Platform-owned reusable components)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Block identification
  slug VARCHAR(100) NOT NULL UNIQUE,
  name_en VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Block type
  block_type VARCHAR(50) NOT NULL,
  -- Types: hero, features, testimonials, pricing, cta, faq, gallery, 
  --        countdown, social_proof, comparison, benefits, story, form,
  --        video, stats, team, logos, footer, header, navigation
  
  -- Structure (JSON Schema)
  schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Defines: required fields, field types, validation rules
  
  -- Default content (JSON)
  default_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Styling options
  style_variants JSONB DEFAULT '[]'::jsonb,
  -- Array of: { id, name, css_classes, preview_image }
  
  -- AI metadata
  ai_description TEXT, -- For AI to understand block purpose
  ai_use_cases TEXT[], -- When AI should use this block
  ai_placement_hints JSONB DEFAULT '{}'::jsonb,
  -- { preferred_position: 'top'|'middle'|'bottom', max_per_page: 1, requires: ['hero'] }
  
  -- Compatibility
  compatible_categories UUID[] DEFAULT '{}',
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_premium BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blocks_type ON blocks(block_type);
CREATE INDEX idx_blocks_active ON blocks(is_active);

-- Insert default blocks
INSERT INTO blocks (slug, name_en, name_ar, block_type, schema, default_content, ai_description, ai_use_cases) VALUES
('hero-product', 'Product Hero', 'بطل المنتج', 'hero', 
  '{"fields": {"headline": {"type": "string", "required": true, "max_length": 80}, "subheadline": {"type": "string", "max_length": 150}, "product_image": {"type": "image", "required": true}, "cta_text": {"type": "string", "required": true}, "cta_url": {"type": "url"}, "price": {"type": "number"}, "original_price": {"type": "number"}, "badge": {"type": "string"}}}',
  '{"headline": "", "subheadline": "", "cta_text": "اطلب الآن", "badge": "عرض محدود"}',
  'Main hero section for product landing pages. First thing visitors see.',
  ARRAY['product_launch', 'promotion', 'new_arrival']),

('features-grid', 'Features Grid', 'شبكة المميزات', 'features',
  '{"fields": {"title": {"type": "string"}, "features": {"type": "array", "items": {"icon": "string", "title": "string", "description": "string"}, "min": 3, "max": 6}}}',
  '{"title": "لماذا تختارنا؟", "features": []}',
  'Grid of product features or benefits with icons.',
  ARRAY['feature_highlight', 'benefits_explanation']),

('testimonials-carousel', 'Testimonials Carousel', 'آراء العملاء', 'testimonials',
  '{"fields": {"title": {"type": "string"}, "testimonials": {"type": "array", "items": {"name": "string", "role": "string", "content": "string", "avatar": "image", "rating": "number"}, "min": 3}}}',
  '{"title": "ماذا يقول عملاؤنا", "testimonials": []}',
  'Customer testimonials carousel for social proof.',
  ARRAY['social_proof', 'trust_building']),

('countdown-timer', 'Countdown Timer', 'العد التنازلي', 'countdown',
  '{"fields": {"title": {"type": "string"}, "end_date": {"type": "datetime", "required": true}, "message_after": {"type": "string"}}}',
  '{"title": "العرض ينتهي خلال", "message_after": "انتهى العرض"}',
  'Urgency-creating countdown timer for limited offers.',
  ARRAY['urgency', 'limited_offer', 'flash_sale']),

('pricing-table', 'Pricing Table', 'جدول الأسعار', 'pricing',
  '{"fields": {"title": {"type": "string"}, "plans": {"type": "array", "items": {"name": "string", "price": "number", "period": "string", "features": "array", "is_popular": "boolean", "cta_text": "string"}}}}',
  '{"title": "اختر خطتك", "plans": []}',
  'Pricing comparison table for multiple plans or packages.',
  ARRAY['pricing_display', 'plan_comparison']),

('faq-accordion', 'FAQ Accordion', 'الأسئلة الشائعة', 'faq',
  '{"fields": {"title": {"type": "string"}, "questions": {"type": "array", "items": {"question": "string", "answer": "string"}}}}',
  '{"title": "الأسئلة الشائعة", "questions": []}',
  'Expandable FAQ section to address common concerns.',
  ARRAY['objection_handling', 'information']),

('cta-banner', 'CTA Banner', 'بانر الدعوة للعمل', 'cta',
  '{"fields": {"headline": {"type": "string", "required": true}, "subheadline": {"type": "string"}, "cta_text": {"type": "string", "required": true}, "cta_url": {"type": "url"}, "background_color": {"type": "color"}}}',
  '{"headline": "لا تفوت الفرصة", "cta_text": "اطلب الآن"}',
  'Call-to-action banner to drive conversions.',
  ARRAY['conversion', 'final_push']),

('social-proof-bar', 'Social Proof Bar', 'شريط الدليل الاجتماعي', 'social_proof',
  '{"fields": {"items": {"type": "array", "items": {"icon": "string", "value": "string", "label": "string"}}}}',
  '{"items": [{"icon": "users", "value": "+10,000", "label": "عميل سعيد"}, {"icon": "star", "value": "4.9", "label": "تقييم"}]}',
  'Compact bar showing social proof metrics.',
  ARRAY['trust_building', 'credibility']),

('product-gallery', 'Product Gallery', 'معرض المنتج', 'gallery',
  '{"fields": {"images": {"type": "array", "items": {"url": "image", "alt": "string"}, "min": 1, "max": 10}, "layout": {"type": "enum", "values": ["grid", "carousel", "masonry"]}}}',
  '{"images": [], "layout": "carousel"}',
  'Product image gallery with multiple views.',
  ARRAY['product_showcase', 'visual_detail']),

('video-section', 'Video Section', 'قسم الفيديو', 'video',
  '{"fields": {"title": {"type": "string"}, "video_url": {"type": "url", "required": true}, "thumbnail": {"type": "image"}, "autoplay": {"type": "boolean"}}}',
  '{"title": "", "autoplay": false}',
  'Embedded video section for product demos or testimonials.',
  ARRAY['demonstration', 'explanation', 'testimonial_video'])
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- TEMPLATES (Platform-owned page templates)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Template identification
  slug VARCHAR(100) NOT NULL UNIQUE,
  name_en VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Template type
  template_type VARCHAR(50) NOT NULL DEFAULT 'landing_page',
  -- Types: landing_page, product_page, collection_page, checkout, thank_you
  
  -- Categorization (for AI selection)
  product_types VARCHAR(50)[] DEFAULT '{}', -- physical, digital, service, subscription
  funnel_stages VARCHAR(50)[] DEFAULT '{}', -- awareness, consideration, decision, retention
  price_tiers VARCHAR(50)[] DEFAULT '{}', -- budget, mid-range, premium, luxury
  marketing_styles VARCHAR(50)[] DEFAULT '{}', -- urgency, social-proof, storytelling, etc.
  industries VARCHAR(50)[] DEFAULT '{}', -- fashion, electronics, beauty, etc.
  
  -- Structure (ordered list of block slots)
  structure JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Array of: { slot_id, block_type, required, default_block_id, ai_instructions }
  
  -- Default blocks configuration
  default_blocks JSONB DEFAULT '[]'::jsonb,
  -- Array of: { slot_id, block_id, content_overrides }
  
  -- Styling
  base_styles JSONB DEFAULT '{}'::jsonb,
  -- { color_scheme, typography, spacing, animations }
  
  color_schemes JSONB DEFAULT '[]'::jsonb,
  -- Array of predefined color schemes
  
  -- AI metadata
  ai_description TEXT,
  ai_best_for TEXT[], -- Scenarios where this template excels
  ai_avoid_for TEXT[], -- Scenarios to avoid this template
  ai_conversion_factors JSONB DEFAULT '{}'::jsonb,
  -- { urgency_level, trust_elements, emotional_appeal, information_density }
  
  -- Performance benchmarks (aggregated from instances)
  avg_conversion_rate DECIMAL(5,4),
  avg_bounce_rate DECIMAL(5,4),
  avg_time_on_page INT, -- seconds
  total_instances INT DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_premium BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  
  -- Preview
  preview_image_url VARCHAR(500),
  preview_url VARCHAR(500),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_templates_type ON templates(template_type);
CREATE INDEX idx_templates_active ON templates(is_active);
CREATE INDEX idx_templates_product_types ON templates USING GIN(product_types);
CREATE INDEX idx_templates_funnel_stages ON templates USING GIN(funnel_stages);
CREATE INDEX idx_templates_industries ON templates USING GIN(industries);

-- ============================================================================
-- PAGE INSTANCES (Tenant-owned pages built from templates)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.page_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Page identification
  slug VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  
  -- Template reference
  template_id UUID REFERENCES templates(id),
  template_version INT DEFAULT 1,
  
  -- Page type
  page_type VARCHAR(50) NOT NULL DEFAULT 'landing_page',
  
  -- Content (filled blocks)
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Array of: { slot_id, block_id, content, style_variant, visibility }
  
  -- Styling overrides
  style_overrides JSONB DEFAULT '{}'::jsonb,
  custom_css TEXT,
  
  -- SEO
  meta_title VARCHAR(255),
  meta_description TEXT,
  og_image_url VARCHAR(500),
  canonical_url VARCHAR(500),
  
  -- Product association
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  
  -- Publishing
  status VARCHAR(20) DEFAULT 'draft',
  -- draft, published, scheduled, archived
  published_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  
  -- Domain/URL
  custom_domain VARCHAR(255),
  subdomain_path VARCHAR(100),
  full_url VARCHAR(500),
  
  -- A/B Testing
  is_variant BOOLEAN DEFAULT false,
  parent_page_id UUID REFERENCES page_instances(id),
  variant_name VARCHAR(50),
  traffic_percentage INT DEFAULT 100,
  
  -- AI generation metadata
  ai_generated BOOLEAN DEFAULT false,
  ai_prompt TEXT,
  ai_model_used VARCHAR(50),
  ai_generation_params JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique slug per tenant
  UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_page_instances_tenant ON page_instances(tenant_id);
CREATE INDEX idx_page_instances_template ON page_instances(template_id);
CREATE INDEX idx_page_instances_product ON page_instances(product_id);
CREATE INDEX idx_page_instances_status ON page_instances(tenant_id, status);
CREATE INDEX idx_page_instances_slug ON page_instances(tenant_id, slug);

ALTER TABLE page_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON page_instances FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- PAGE VERSIONS (Version history for rollback)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.page_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  page_id UUID NOT NULL REFERENCES page_instances(id) ON DELETE CASCADE,
  
  -- Version info
  version_number INT NOT NULL,
  version_name VARCHAR(100),
  
  -- Snapshot of page state
  blocks_snapshot JSONB NOT NULL,
  style_snapshot JSONB,
  meta_snapshot JSONB,
  
  -- Change tracking
  changed_by UUID REFERENCES auth.users(id),
  change_type VARCHAR(30), -- 'manual', 'ai_generated', 'ai_optimized', 'restored'
  change_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(page_id, version_number)
);

CREATE INDEX idx_page_versions_page ON page_versions(page_id);
CREATE INDEX idx_page_versions_tenant ON page_versions(tenant_id);

ALTER TABLE page_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON page_versions FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- PAGE PERFORMANCE (Performance metadata for AI optimization)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.page_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  page_id UUID NOT NULL REFERENCES page_instances(id) ON DELETE CASCADE,
  
  -- Time period
  period_type VARCHAR(20) NOT NULL, -- 'hourly', 'daily', 'weekly', 'monthly'
  period_start TIMESTAMPTZ NOT NULL,
  
  -- Traffic metrics
  views INT DEFAULT 0,
  unique_visitors INT DEFAULT 0,
  
  -- Engagement metrics
  avg_time_on_page INT DEFAULT 0, -- seconds
  scroll_depth_avg DECIMAL(5,2), -- percentage
  bounce_rate DECIMAL(5,4),
  
  -- Conversion metrics
  cta_clicks INT DEFAULT 0,
  cta_click_rate DECIMAL(5,4),
  form_submissions INT DEFAULT 0,
  orders INT DEFAULT 0,
  conversion_rate DECIMAL(5,4),
  revenue INT DEFAULT 0,
  
  -- Block-level performance
  block_interactions JSONB DEFAULT '{}'::jsonb,
  -- { block_slot_id: { views, clicks, time_visible, scroll_to_rate } }
  
  -- Traffic sources
  traffic_sources JSONB DEFAULT '{}'::jsonb,
  -- { direct: 10, organic: 20, paid: 50, social: 20 }
  
  -- Device breakdown
  device_breakdown JSONB DEFAULT '{}'::jsonb,
  -- { mobile: 60, desktop: 35, tablet: 5 }
  
  -- Timestamps
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(page_id, period_type, period_start)
);

CREATE INDEX idx_page_performance_page ON page_performance(page_id);
CREATE INDEX idx_page_performance_tenant ON page_performance(tenant_id);
CREATE INDEX idx_page_performance_period ON page_performance(page_id, period_type, period_start DESC);

ALTER TABLE page_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON page_performance FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- TEMPLATE PERFORMANCE (Aggregated performance across all instances)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.template_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  
  -- Time period
  period_type VARCHAR(20) NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  
  -- Aggregate metrics
  total_instances INT DEFAULT 0,
  active_instances INT DEFAULT 0,
  total_views INT DEFAULT 0,
  total_conversions INT DEFAULT 0,
  
  -- Average metrics
  avg_conversion_rate DECIMAL(5,4),
  avg_bounce_rate DECIMAL(5,4),
  avg_time_on_page INT,
  
  -- Performance by category
  performance_by_industry JSONB DEFAULT '{}'::jsonb,
  performance_by_price_tier JSONB DEFAULT '{}'::jsonb,
  performance_by_funnel_stage JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(template_id, period_type, period_start)
);

CREATE INDEX idx_template_performance_template ON template_performance(template_id);

-- ============================================================================
-- AI TEMPLATE SELECTION MEMORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_template_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Selection context
  product_id UUID REFERENCES products(id),
  campaign_id UUID REFERENCES campaigns(id),
  
  -- Input parameters (what AI considered)
  selection_context JSONB NOT NULL,
  -- { product_type, price_tier, target_audience, marketing_goal, industry }
  
  -- AI reasoning
  templates_considered UUID[] DEFAULT '{}',
  selection_reasoning TEXT,
  confidence_score DECIMAL(3,2),
  
  -- Selected template
  selected_template_id UUID REFERENCES templates(id),
  
  -- Resulting page
  page_id UUID REFERENCES page_instances(id),
  
  -- Outcome (for learning)
  outcome_measured BOOLEAN DEFAULT false,
  outcome_conversion_rate DECIMAL(5,4),
  outcome_vs_average DECIMAL(5,4), -- positive = better than avg
  
  -- Timestamps
  selected_at TIMESTAMPTZ DEFAULT NOW(),
  outcome_measured_at TIMESTAMPTZ
);

CREATE INDEX idx_ai_template_selections_tenant ON ai_template_selections(tenant_id);
CREATE INDEX idx_ai_template_selections_template ON ai_template_selections(selected_template_id);

ALTER TABLE ai_template_selections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON ai_template_selections FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- VIEW: AI Template Recommendations
-- ============================================================================

CREATE OR REPLACE VIEW ai_template_recommendations AS
SELECT 
  t.id AS template_id,
  t.slug,
  t.name_en,
  t.name_ar,
  t.template_type,
  t.product_types,
  t.funnel_stages,
  t.price_tiers,
  t.marketing_styles,
  t.industries,
  t.ai_description,
  t.ai_best_for,
  t.ai_avoid_for,
  t.avg_conversion_rate,
  t.avg_bounce_rate,
  t.total_instances,
  t.is_premium,
  
  -- Recent performance
  COALESCE(
    (SELECT avg_conversion_rate 
     FROM template_performance tp 
     WHERE tp.template_id = t.id 
       AND tp.period_type = 'monthly' 
     ORDER BY period_start DESC 
     LIMIT 1),
    t.avg_conversion_rate
  ) AS recent_conversion_rate

FROM templates t
WHERE t.is_active = true;

-- ============================================================================
-- FUNCTION: Get Best Template for Context
-- ============================================================================

CREATE OR REPLACE FUNCTION get_best_templates(
  p_product_type VARCHAR(50),
  p_price_tier VARCHAR(50),
  p_funnel_stage VARCHAR(50),
  p_industry VARCHAR(50) DEFAULT NULL,
  p_limit INT DEFAULT 5
)
RETURNS TABLE (
  template_id UUID,
  slug VARCHAR(100),
  name_ar VARCHAR(100),
  match_score DECIMAL(5,2),
  conversion_rate DECIMAL(5,4),
  reasoning TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id AS template_id,
    t.slug,
    t.name_ar,
    (
      CASE WHEN p_product_type = ANY(t.product_types) THEN 25 ELSE 0 END +
      CASE WHEN p_price_tier = ANY(t.price_tiers) THEN 25 ELSE 0 END +
      CASE WHEN p_funnel_stage = ANY(t.funnel_stages) THEN 25 ELSE 0 END +
      CASE WHEN p_industry IS NULL OR p_industry = ANY(t.industries) THEN 25 ELSE 10 END
    )::DECIMAL(5,2) AS match_score,
    COALESCE(t.avg_conversion_rate, 0) AS conversion_rate,
    t.ai_description AS reasoning
  FROM templates t
  WHERE t.is_active = true
    AND t.template_type = 'landing_page'
  ORDER BY 
    match_score DESC,
    t.avg_conversion_rate DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SUMMARY
-- ============================================================================
--
-- TABLES CREATED:
-- 1. template_categories - Categorization for AI selection
-- 2. blocks - Reusable page components (platform-owned)
-- 3. templates - Page templates (platform-owned)
-- 4. page_instances - Tenant-specific pages (tenant-owned)
-- 5. page_versions - Version history for rollback
-- 6. page_performance - Performance metrics per page
-- 7. template_performance - Aggregated template performance
-- 8. ai_template_selections - AI selection memory for learning
--
-- VIEWS CREATED:
-- - ai_template_recommendations - For AI to select templates
--
-- FUNCTIONS CREATED:
-- - get_best_templates() - Returns best matching templates for context
--
-- KEY FEATURES:
-- - Templates are JSON-structured (not static HTML)
-- - Categorized by: product_type, funnel_stage, price_tier, marketing_style, industry
-- - Blocks are reusable components with JSON schema
-- - Performance tracking at page and template level
-- - AI selection memory for continuous learning
-- - Version history for rollback
-- - A/B testing support
--
-- ============================================================================
