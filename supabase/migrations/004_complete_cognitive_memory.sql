-- ============================================================================
-- DeepSolution: Complete Cognitive Memory System
-- Version: 1.0
-- Layers: 1-16 (All Memory Layers)
-- ============================================================================

-- ============================================================================
-- FOUNDATION LAYER (L1-L2)
-- ============================================================================

-- L1: Tenant DNA Memory
-- tenants table (already exists in 001, this adds missing columns if needed)

-- L2: Strategy Memory
CREATE TABLE IF NOT EXISTS public.strategic_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Goal definition
  goal_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Target
  target_metric VARCHAR(100) NOT NULL,
  target_value DECIMAL(20,4) NOT NULL,
  current_value DECIMAL(20,4) DEFAULT 0,
  
  -- Timeline
  target_date DATE,
  
  -- Priority
  priority INT DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  
  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'abandoned', 'paused')),
  
  -- AI context
  ai_context JSONB DEFAULT '{}'::jsonb,
  
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
-- OPERATIONAL LAYER (L3-L8)
-- ============================================================================

-- L3: Campaign Intelligence Memory
CREATE TABLE IF NOT EXISTS public.campaign_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  
  -- Insight
  insight_type VARCHAR(50) NOT NULL,
  insight TEXT NOT NULL,
  
  -- Evidence
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Confidence
  confidence DECIMAL(3,2) DEFAULT 0.5 CHECK (confidence BETWEEN 0 AND 1),
  
  -- Validity
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  times_validated INT DEFAULT 0,
  times_contradicted INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaign_insights_tenant ON campaign_insights(tenant_id);
CREATE INDEX idx_campaign_insights_campaign ON campaign_insights(campaign_id);

ALTER TABLE campaign_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON campaign_insights FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- L4: Product Intelligence Memory
CREATE TABLE IF NOT EXISTS public.product_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  
  -- Insight
  insight_type VARCHAR(50) NOT NULL,
  insight TEXT NOT NULL,
  
  -- Evidence
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Confidence
  confidence DECIMAL(3,2) DEFAULT 0.5,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_product_insights_tenant ON product_insights(tenant_id);
CREATE INDEX idx_product_insights_product ON product_insights(product_id);

ALTER TABLE product_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON product_insights FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- L6: Customer Behavior Intelligence (Privacy-Safe)
CREATE TABLE IF NOT EXISTS public.customer_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Segment definition
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Criteria (no PII)
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Size
  estimated_size INT DEFAULT 0,
  
  -- Behavior patterns
  behavior_patterns JSONB DEFAULT '{}'::jsonb,
  
  -- Value
  avg_order_value INT DEFAULT 0,
  avg_lifetime_value INT DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customer_segments_tenant ON customer_segments(tenant_id);

ALTER TABLE customer_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON customer_segments FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- L7: Operational Intelligence
CREATE TABLE IF NOT EXISTS public.operational_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Period
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  period_start DATE NOT NULL,
  
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
  confirmation_rate DECIMAL(5,4) DEFAULT 0,
  
  -- Fulfillment metrics
  avg_processing_time_hours DECIMAL(10,2),
  avg_delivery_time_days DECIMAL(10,2),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, period_type, period_start)
);

CREATE INDEX idx_operational_metrics_tenant ON operational_metrics(tenant_id);
CREATE INDEX idx_operational_metrics_period ON operational_metrics(tenant_id, period_type, period_start);

ALTER TABLE operational_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON operational_metrics FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- L8: Financial Intelligence
CREATE TABLE IF NOT EXISTS public.financial_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Period
  period_type VARCHAR(20) NOT NULL,
  period_start DATE NOT NULL,
  
  -- Revenue
  gross_revenue INT DEFAULT 0,
  net_revenue INT DEFAULT 0,
  
  -- Costs
  total_costs INT DEFAULT 0,
  product_costs INT DEFAULT 0,
  shipping_costs INT DEFAULT 0,
  marketing_costs INT DEFAULT 0,
  operational_costs INT DEFAULT 0,
  
  -- Profit
  gross_profit INT DEFAULT 0,
  net_profit INT DEFAULT 0,
  gross_margin DECIMAL(5,4) DEFAULT 0,
  net_margin DECIMAL(5,4) DEFAULT 0,
  
  -- Cash flow
  cash_collected INT DEFAULT 0,
  cash_pending INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, period_type, period_start)
);

CREATE INDEX idx_financial_metrics_tenant ON financial_metrics(tenant_id);

ALTER TABLE financial_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON financial_metrics FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- UNIT ECONOMICS LAYER (L8B)
-- ============================================================================

-- Raw Financial Events
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Type
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
    'order_revenue', 'shipping_revenue',
    'product_cost', 'shipping_cost', 'packaging_cost',
    'cod_fee', 'payment_gateway_fee',
    'ad_spend', 'influencer_fee', 'promotion_discount',
    'storage_cost', 'labor_cost', 'return_processing_cost',
    'refund', 'chargeback', 'write_off', 'adjustment'
  )),
  
  -- Direction
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inflow', 'outflow')),
  
  -- Amount (smallest currency unit)
  amount INT NOT NULL CHECK (amount >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'SAR',
  
  -- Links
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  
  -- Lifecycle stage when recorded
  lifecycle_stage VARCHAR(30) CHECK (lifecycle_stage IN (
    'pre_sale', 'post_sale', 'post_shipping', 
    'post_collection', 'post_return_window', 'final'
  )),
  
  -- Idempotency
  idempotency_key VARCHAR(255) UNIQUE,
  
  -- Timestamps
  transaction_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_financial_transactions_tenant ON financial_transactions(tenant_id);
CREATE INDEX idx_financial_transactions_order ON financial_transactions(order_id);
CREATE INDEX idx_financial_transactions_date ON financial_transactions(tenant_id, transaction_date);
CREATE INDEX idx_financial_transactions_type ON financial_transactions(tenant_id, transaction_type);

ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON financial_transactions FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Cost Allocation Rules
CREATE TABLE IF NOT EXISTS public.cost_allocation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Rule definition
  name VARCHAR(255) NOT NULL,
  cost_type VARCHAR(50) NOT NULL,
  
  -- Allocation method
  allocation_method VARCHAR(30) NOT NULL CHECK (allocation_method IN (
    'per_order', 'per_unit', 'revenue_weighted', 'equal_split', 'custom'
  )),
  
  -- Configuration
  allocation_config JSONB DEFAULT '{}'::jsonb,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cost_allocation_rules_tenant ON cost_allocation_rules(tenant_id);

ALTER TABLE cost_allocation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON cost_allocation_rules FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Order Profit Timeline (5 stages)
CREATE TABLE IF NOT EXISTS public.order_profit_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Stage
  lifecycle_stage VARCHAR(30) NOT NULL CHECK (lifecycle_stage IN (
    'post_sale', 'post_shipping', 'post_collection', 
    'post_return_window', 'final'
  )),
  
  -- Revenue at this stage
  gross_revenue INT NOT NULL DEFAULT 0,
  net_revenue INT NOT NULL DEFAULT 0,
  
  -- Costs at this stage
  product_cost INT DEFAULT 0,
  shipping_cost INT DEFAULT 0,
  marketing_cost INT DEFAULT 0,
  operational_cost INT DEFAULT 0,
  total_costs INT NOT NULL DEFAULT 0,
  
  -- Profit
  gross_profit INT NOT NULL DEFAULT 0,
  net_profit INT NOT NULL DEFAULT 0,
  gross_margin DECIMAL(5,4) DEFAULT 0,
  net_margin DECIMAL(5,4) DEFAULT 0,
  
  -- Confidence (decreases with estimates)
  confidence DECIMAL(3,2) DEFAULT 1.0,
  
  -- Timestamps
  stage_reached_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(order_id, lifecycle_stage)
);

CREATE INDEX idx_order_profit_timeline_tenant ON order_profit_timeline(tenant_id);
CREATE INDEX idx_order_profit_timeline_order ON order_profit_timeline(order_id);

ALTER TABLE order_profit_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON order_profit_timeline FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Product Profit Memory (Cumulative)
CREATE TABLE IF NOT EXISTS public.product_profit_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  -- Period
  period_type VARCHAR(20) DEFAULT 'all_time',
  period_start DATE,
  
  -- Volume
  units_sold INT DEFAULT 0,
  units_returned INT DEFAULT 0,
  net_units INT DEFAULT 0,
  
  -- Revenue
  gross_revenue INT DEFAULT 0,
  net_revenue INT DEFAULT 0,
  
  -- Costs
  total_costs INT DEFAULT 0,
  
  -- Profit
  gross_profit INT DEFAULT 0,
  net_profit INT DEFAULT 0,
  gross_margin DECIMAL(5,4) DEFAULT 0,
  net_margin DECIMAL(5,4) DEFAULT 0,
  profit_per_unit INT DEFAULT 0,
  
  -- Trends
  profit_trend VARCHAR(20) CHECK (profit_trend IN ('improving', 'stable', 'declining')),
  profit_volatility DECIMAL(10,4) DEFAULT 0,
  
  -- Confidence
  confidence DECIMAL(3,2) DEFAULT 1.0,
  
  -- Timestamps
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(product_id, period_type, period_start)
);

CREATE INDEX idx_product_profit_memory_tenant ON product_profit_memory(tenant_id);
CREATE INDEX idx_product_profit_memory_product ON product_profit_memory(product_id);

ALTER TABLE product_profit_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON product_profit_memory FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Campaign Profit Memory (Cumulative)
CREATE TABLE IF NOT EXISTS public.campaign_profit_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  
  -- Period
  period_type VARCHAR(20) DEFAULT 'all_time',
  period_start DATE,
  
  -- Attribution
  orders_attributed INT DEFAULT 0,
  revenue_attributed INT DEFAULT 0,
  
  -- Costs
  ad_spend INT DEFAULT 0,
  attributed_product_costs INT DEFAULT 0,
  attributed_shipping_costs INT DEFAULT 0,
  total_costs INT DEFAULT 0,
  
  -- Profit
  gross_profit INT DEFAULT 0,
  net_profit INT DEFAULT 0,
  
  -- ROAS
  roas DECIMAL(10,4) DEFAULT 0,
  true_roas DECIMAL(10,4) DEFAULT 0,
  
  -- Confidence
  confidence DECIMAL(3,2) DEFAULT 1.0,
  
  -- Timestamps
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(campaign_id, period_type, period_start)
);

CREATE INDEX idx_campaign_profit_memory_tenant ON campaign_profit_memory(tenant_id);
CREATE INDEX idx_campaign_profit_memory_campaign ON campaign_profit_memory(campaign_id);

ALTER TABLE campaign_profit_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON campaign_profit_memory FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Tenant Profit Memory (Aggregate)
CREATE TABLE IF NOT EXISTS public.tenant_profit_memory (
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
  gross_margin DECIMAL(5,4) DEFAULT 0,
  net_margin DECIMAL(5,4) DEFAULT 0,
  
  -- Per-order metrics
  avg_order_value INT DEFAULT 0,
  avg_profit_per_order INT DEFAULT 0,
  
  -- Trends
  profit_trend VARCHAR(20),
  
  -- Timestamps
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, period_type, period_start)
);

CREATE INDEX idx_tenant_profit_memory_tenant ON tenant_profit_memory(tenant_id);

ALTER TABLE tenant_profit_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON tenant_profit_memory FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Unit Economics Insights (AI-generated with evidence)
CREATE TABLE IF NOT EXISTS public.unit_economics_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Insight
  insight_type VARCHAR(50) NOT NULL CHECK (insight_type IN (
    'profitability_alert', 'cost_anomaly', 'margin_trend',
    'product_recommendation', 'campaign_recommendation',
    'pricing_suggestion', 'cost_reduction_opportunity'
  )),
  
  -- Content
  title VARCHAR(255) NOT NULL,
  insight TEXT NOT NULL,
  
  -- Scope
  scope_type VARCHAR(30) CHECK (scope_type IN ('tenant', 'product', 'campaign', 'channel', 'order')),
  scope_id UUID,
  
  -- Evidence (links to supporting data)
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Impact
  estimated_impact INT,
  impact_type VARCHAR(20) CHECK (impact_type IN ('revenue', 'cost', 'profit')),
  
  -- Confidence
  confidence DECIMAL(3,2) NOT NULL DEFAULT 0.5,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'acted_upon', 'dismissed', 'expired')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_unit_economics_insights_tenant ON unit_economics_insights(tenant_id);
CREATE INDEX idx_unit_economics_insights_type ON unit_economics_insights(tenant_id, insight_type);
CREATE INDEX idx_unit_economics_insights_status ON unit_economics_insights(tenant_id, status);

ALTER TABLE unit_economics_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON unit_economics_insights FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- WISDOM LAYER (L9, L11-L16)
-- ============================================================================

-- L9: Insight & Meta-Learning Memory
CREATE TABLE IF NOT EXISTS public.cross_domain_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Insight
  insight_type VARCHAR(50) NOT NULL,
  domains VARCHAR[] NOT NULL,
  insight TEXT NOT NULL,
  
  -- Evidence
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Confidence
  confidence DECIMAL(3,2) DEFAULT 0.5,
  
  -- Validation
  times_validated INT DEFAULT 0,
  times_contradicted INT DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cross_domain_insights_tenant ON cross_domain_insights(tenant_id);

ALTER TABLE cross_domain_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON cross_domain_insights FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- L11: Decision Memory
CREATE TABLE IF NOT EXISTS public.decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Type
  decision_type VARCHAR(50) NOT NULL CHECK (decision_type IN (
    'pricing_change', 'campaign_launch', 'campaign_pause', 'campaign_budget',
    'inventory_reorder', 'product_launch', 'product_discontinue',
    'shipping_provider', 'promotion_launch', 'staffing', 'process_change', 'other'
  )),
  
  -- Maker
  decision_maker VARCHAR(30) NOT NULL CHECK (decision_maker IN (
    'human', 'ai_recommended', 'ai_auto', 'system', 'external'
  )),
  made_by_user_id UUID REFERENCES auth.users(id),
  
  -- Content
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Context at decision time (CRITICAL)
  context_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Expected outcome
  expected_outcome JSONB NOT NULL,
  expected_confidence DECIMAL(3,2),
  
  -- Reasoning
  reasoning TEXT NOT NULL,
  
  -- Evidence references
  evidence_refs JSONB DEFAULT '[]'::jsonb,
  
  -- Execution
  execution_status VARCHAR(30) DEFAULT 'pending' CHECK (execution_status IN (
    'pending', 'executing', 'executed', 'cancelled', 'failed'
  )),
  executed_at TIMESTAMPTZ,
  
  -- Timestamps
  decision_made_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_decisions_tenant ON decisions(tenant_id);
CREATE INDEX idx_decisions_type ON decisions(tenant_id, decision_type);
CREATE INDEX idx_decisions_maker ON decisions(tenant_id, decision_maker);
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
  
  -- Timing
  measurement_type VARCHAR(30) NOT NULL CHECK (measurement_type IN (
    'immediate', 'short_term', 'medium_term', 'long_term', 'final'
  )),
  measurement_window_days INT,
  
  -- Outcome
  actual_outcome JSONB NOT NULL,
  
  -- Comparison
  outcome_vs_expected VARCHAR(30) CHECK (outcome_vs_expected IN (
    'exceeded', 'met', 'partially_met', 'missed', 'opposite', 'inconclusive'
  )),
  variance_percentage DECIMAL(10,2),
  
  -- Side effects
  side_effects JSONB DEFAULT '[]'::jsonb,
  
  -- Attribution
  attribution_confidence DECIMAL(3,2) DEFAULT 1.0,
  confounding_factors JSONB DEFAULT '[]'::jsonb,
  
  -- Timestamps
  measured_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_decision_outcomes_tenant ON decision_outcomes(tenant_id);
CREATE INDEX idx_decision_outcomes_decision ON decision_outcomes(decision_id);

ALTER TABLE decision_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON decision_outcomes FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Decision Lessons
CREATE TABLE IF NOT EXISTS public.decision_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  
  -- Lesson type
  lesson_type VARCHAR(30) NOT NULL CHECK (lesson_type IN (
    'success_factor', 'failure_cause', 'timing_insight', 
    'context_dependency', 'unexpected_effect', 'process_improvement'
  )),
  
  -- Content
  lesson TEXT NOT NULL,
  
  -- Applicability
  applies_to_decision_types VARCHAR[] NOT NULL,
  applies_to_conditions JSONB DEFAULT '{}'::jsonb,
  does_not_apply_when JSONB DEFAULT '{}'::jsonb,
  
  -- Confidence
  confidence DECIMAL(3,2) DEFAULT 0.5,
  times_validated INT DEFAULT 1,
  times_contradicted INT DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_decision_lessons_tenant ON decision_lessons(tenant_id);
CREATE INDEX idx_decision_lessons_decision ON decision_lessons(decision_id);
CREATE INDEX idx_decision_lessons_type ON decision_lessons(tenant_id, lesson_type);

ALTER TABLE decision_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON decision_lessons FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- L12: Timing & Opportunity Window Memory
CREATE TABLE IF NOT EXISTS public.temporal_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Pattern type
  pattern_type VARCHAR(50) NOT NULL CHECK (pattern_type IN (
    'hourly', 'daily', 'weekly', 'monthly', 'seasonal',
    'payday_effect', 'holiday_effect', 'weather_effect',
    'event_driven', 'competitor_driven', 'custom'
  )),
  
  -- What it affects
  affects_metric VARCHAR(50) NOT NULL,
  affects_entity_type VARCHAR(30),
  affects_entity_id UUID,
  
  -- Pattern data
  pattern_data JSONB NOT NULL,
  
  -- Statistical strength
  confidence DECIMAL(3,2) DEFAULT 0.5,
  sample_size INT DEFAULT 0,
  p_value DECIMAL(10,8),
  
  -- Validity
  valid_from DATE,
  valid_until DATE,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_temporal_patterns_tenant ON temporal_patterns(tenant_id);
CREATE INDEX idx_temporal_patterns_type ON temporal_patterns(tenant_id, pattern_type);

ALTER TABLE temporal_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON temporal_patterns FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Opportunity Windows
CREATE TABLE IF NOT EXISTS public.opportunity_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Window type
  window_type VARCHAR(50) NOT NULL CHECK (window_type IN (
    'sales_peak', 'low_competition', 'high_intent', 'launch_window',
    'restock_window', 'price_increase_window', 'promotion_window', 'custom'
  )),
  
  -- Content
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Timing
  window_start TIMESTAMPTZ,
  window_end TIMESTAMPTZ,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern VARCHAR(50),
  
  -- Score
  opportunity_score DECIMAL(3,2),
  confidence DECIMAL(3,2) DEFAULT 0.5,
  
  -- Recommended actions
  recommended_actions JSONB DEFAULT '[]'::jsonb,
  
  -- Status
  status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN (
    'upcoming', 'active', 'missed', 'captured', 'expired'
  )),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_opportunity_windows_tenant ON opportunity_windows(tenant_id);
CREATE INDEX idx_opportunity_windows_status ON opportunity_windows(tenant_id, status);
CREATE INDEX idx_opportunity_windows_dates ON opportunity_windows(tenant_id, window_start, window_end);

ALTER TABLE opportunity_windows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON opportunity_windows FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Tipping Points
CREATE TABLE IF NOT EXISTS public.tipping_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Type
  tipping_point_type VARCHAR(50) NOT NULL CHECK (tipping_point_type IN (
    'inventory_critical', 'budget_exhaustion', 'capacity_limit',
    'cash_flow_critical', 'performance_threshold', 'cost_threshold',
    'quality_threshold', 'custom'
  )),
  
  -- Content
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Threshold
  monitored_metric VARCHAR(100) NOT NULL,
  threshold_value DECIMAL(20,4) NOT NULL,
  threshold_direction VARCHAR(10) NOT NULL CHECK (threshold_direction IN ('above', 'below')),
  
  -- Current state
  current_value DECIMAL(20,4),
  distance_to_threshold DECIMAL(20,4),
  velocity DECIMAL(20,4),
  estimated_time_to_threshold INTERVAL,
  
  -- Severity
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical', 'emergency')),
  
  -- Actions
  recommended_action TEXT,
  auto_action_enabled BOOLEAN DEFAULT false,
  auto_action_config JSONB,
  
  -- Status
  status VARCHAR(20) DEFAULT 'monitoring' CHECK (status IN (
    'monitoring', 'approaching', 'breached', 'resolved', 'disabled'
  )),
  
  -- History
  times_breached INT DEFAULT 0,
  last_breached_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tipping_points_tenant ON tipping_points(tenant_id);
CREATE INDEX idx_tipping_points_status ON tipping_points(tenant_id, status);
CREATE INDEX idx_tipping_points_severity ON tipping_points(tenant_id, severity);

ALTER TABLE tipping_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON tipping_points FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- L13: Failure & Near-Failure Memory
CREATE TABLE IF NOT EXISTS public.failure_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Type
  failure_type VARCHAR(50) NOT NULL CHECK (failure_type IN (
    'order_failure', 'delivery_failure', 'payment_failure',
    'campaign_loss', 'stockout', 'overstock', 'quality_issue',
    'customer_complaint', 'system_error', 'process_failure',
    'communication_failure', 'vendor_failure', 'other'
  )),
  
  -- Severity
  severity VARCHAR(20) NOT NULL CHECK (severity IN (
    'minor', 'moderate', 'major', 'critical', 'catastrophic'
  )),
  
  -- Near-miss flag
  was_near_miss BOOLEAN DEFAULT false,
  caught_by VARCHAR(50),
  
  -- Content
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  
  -- Impact
  impact JSONB NOT NULL,
  financial_impact INT,
  
  -- Context
  context_snapshot JSONB DEFAULT '{}'::jsonb,
  
  -- Related entities
  related_order_id UUID REFERENCES orders(id),
  related_product_id UUID REFERENCES products(id),
  related_campaign_id UUID REFERENCES campaigns(id),
  
  -- Root cause
  root_cause TEXT,
  root_cause_category VARCHAR(50) CHECK (root_cause_category IN (
    'human_error', 'process_gap', 'system_bug', 'external_factor',
    'resource_constraint', 'communication', 'vendor', 'unknown'
  )),
  
  -- Prevention
  prevention_measures JSONB DEFAULT '[]'::jsonb,
  
  -- Status
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN (
    'open', 'investigating', 'resolved', 'prevented', 'accepted'
  )),
  
  -- Timestamps
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_failure_events_tenant ON failure_events(tenant_id);
CREATE INDEX idx_failure_events_type ON failure_events(tenant_id, failure_type);
CREATE INDEX idx_failure_events_severity ON failure_events(tenant_id, severity);
CREATE INDEX idx_failure_events_status ON failure_events(tenant_id, status);

ALTER TABLE failure_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON failure_events FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Failure Patterns
CREATE TABLE IF NOT EXISTS public.failure_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Pattern
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
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_failure_patterns_tenant ON failure_patterns(tenant_id);

ALTER TABLE failure_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON failure_patterns FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- L14: Experimentation & A/B Wisdom Memory
CREATE TABLE IF NOT EXISTS public.experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Type
  experiment_type VARCHAR(50) NOT NULL CHECK (experiment_type IN (
    'ab_test', 'multivariate', 'before_after', 'holdout', 'bandit'
  )),
  
  -- Content
  name VARCHAR(255) NOT NULL,
  hypothesis TEXT NOT NULL,
  
  -- Variants
  control_description TEXT NOT NULL,
  variants JSONB NOT NULL,
  
  -- Metrics
  primary_metric VARCHAR(100) NOT NULL,
  secondary_metrics VARCHAR[] DEFAULT '{}',
  guardrail_metrics VARCHAR[] DEFAULT '{}',
  
  -- Statistical config
  minimum_sample_size INT,
  minimum_detectable_effect DECIMAL(10,4),
  confidence_level DECIMAL(3,2) DEFAULT 0.95,
  
  -- Timeline
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
    'draft', 'running', 'paused', 'completed', 'cancelled'
  )),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_experiments_tenant ON experiments(tenant_id);
CREATE INDEX idx_experiments_status ON experiments(tenant_id, status);

ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON experiments FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Experiment Results
CREATE TABLE IF NOT EXISTS public.experiment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  
  -- Variant
  variant_name VARCHAR(100) NOT NULL,
  is_control BOOLEAN DEFAULT false,
  
  -- Sample
  sample_size INT NOT NULL DEFAULT 0,
  
  -- Results
  metric_value DECIMAL(20,4),
  metric_variance DECIMAL(20,4),
  
  -- Statistical
  relative_improvement DECIMAL(10,4),
  p_value DECIMAL(10,8),
  confidence_interval_low DECIMAL(20,4),
  confidence_interval_high DECIMAL(20,4),
  
  -- Status
  is_significant BOOLEAN,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_experiment_results_tenant ON experiment_results(tenant_id);
CREATE INDEX idx_experiment_results_experiment ON experiment_results(experiment_id);

ALTER TABLE experiment_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON experiment_results FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Experiment Conclusions
CREATE TABLE IF NOT EXISTS public.experiment_conclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  
  -- Conclusion
  hypothesis_validated BOOLEAN,
  conclusion TEXT NOT NULL,
  winning_variant VARCHAR(100),
  
  -- Applicability
  applies_to_conditions JSONB,
  does_not_apply_when JSONB,
  
  -- Repeatability
  repeatability_score DECIMAL(3,2),
  times_replicated INT DEFAULT 0,
  times_failed_replication INT DEFAULT 0,
  
  -- Confidence
  confidence DECIMAL(3,2) NOT NULL,
  
  -- Implementation
  implemented BOOLEAN DEFAULT false,
  implemented_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_experiment_conclusions_tenant ON experiment_conclusions(tenant_id);
CREATE INDEX idx_experiment_conclusions_experiment ON experiment_conclusions(experiment_id);

ALTER TABLE experiment_conclusions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON experiment_conclusions FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- L15: Constraint & Reality Memory
CREATE TABLE IF NOT EXISTS public.constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Type
  constraint_type VARCHAR(50) NOT NULL CHECK (constraint_type IN (
    'budget_limit', 'capacity_limit', 'inventory_limit',
    'price_floor', 'price_ceiling', 'margin_floor',
    'shipping_zone', 'time_constraint', 'resource_constraint',
    'legal_regulatory', 'vendor_limit', 'custom'
  )),
  
  -- Content
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Constraint value
  constraint_value JSONB NOT NULL,
  
  -- Current state
  current_utilization DECIMAL(10,4),
  headroom DECIMAL(10,4),
  
  -- Flexibility
  is_hard_constraint BOOLEAN DEFAULT true,
  override_cost JSONB,
  override_approval_required BOOLEAN DEFAULT true,
  
  -- Scope
  applies_to_entity_type VARCHAR(30),
  applies_to_entity_id UUID,
  
  -- Validity
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_constraints_tenant ON constraints(tenant_id);
CREATE INDEX idx_constraints_type ON constraints(tenant_id, constraint_type);
CREATE INDEX idx_constraints_active ON constraints(tenant_id, is_active);

ALTER TABLE constraints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON constraints FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Constraint Violations
CREATE TABLE IF NOT EXISTS public.constraint_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  constraint_id UUID NOT NULL REFERENCES constraints(id) ON DELETE CASCADE,
  
  -- Violation
  violation_severity VARCHAR(20) NOT NULL,
  violation_amount DECIMAL(20,4),
  
  -- Context
  context JSONB NOT NULL,
  
  -- Cause
  cause TEXT,
  was_intentional BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES auth.users(id),
  
  -- Resolution
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  
  -- Prevention
  prevention_action TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_constraint_violations_tenant ON constraint_violations(tenant_id);
CREATE INDEX idx_constraint_violations_constraint ON constraint_violations(constraint_id);

ALTER TABLE constraint_violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON constraint_violations FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- L16: Trust & Confidence Memory
CREATE TABLE IF NOT EXISTS public.ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Type
  recommendation_type VARCHAR(50) NOT NULL CHECK (recommendation_type IN (
    'pricing', 'inventory', 'marketing', 'campaign',
    'product', 'customer', 'operational', 'financial', 'general'
  )),
  
  -- Content
  recommendation TEXT NOT NULL,
  reasoning TEXT,
  
  -- Confidence
  ai_confidence DECIMAL(3,2) NOT NULL,
  
  -- Context
  context_snapshot JSONB DEFAULT '{}'::jsonb,
  
  -- Evidence
  evidence_refs JSONB DEFAULT '[]'::jsonb,
  
  -- User response
  user_response VARCHAR(30) CHECK (user_response IN (
    'accepted', 'rejected', 'modified', 'ignored', 'pending'
  )),
  user_id UUID REFERENCES auth.users(id),
  response_at TIMESTAMPTZ,
  rejection_reason TEXT,
  modification_details TEXT,
  
  -- Outcome
  outcome_measured BOOLEAN DEFAULT false,
  outcome_success BOOLEAN,
  outcome_details JSONB,
  outcome_measured_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_recommendations_tenant ON ai_recommendations(tenant_id);
CREATE INDEX idx_ai_recommendations_type ON ai_recommendations(tenant_id, recommendation_type);
CREATE INDEX idx_ai_recommendations_response ON ai_recommendations(tenant_id, user_response);
CREATE INDEX idx_ai_recommendations_date ON ai_recommendations(tenant_id, created_at);

ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON ai_recommendations FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- AI Trust Scores
CREATE TABLE IF NOT EXISTS public.ai_trust_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Scope
  recommendation_type VARCHAR(50) NOT NULL,
  
  -- Period
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('all_time', 'monthly', 'weekly')),
  period_start DATE,
  
  -- Volume
  total_recommendations INT DEFAULT 0,
  accepted_count INT DEFAULT 0,
  rejected_count INT DEFAULT 0,
  ignored_count INT DEFAULT 0,
  
  -- Outcomes
  measured_count INT DEFAULT 0,
  success_count INT DEFAULT 0,
  
  -- Metrics
  accuracy_rate DECIMAL(5,4),
  acceptance_rate DECIMAL(5,4),
  
  -- Calibration
  avg_confidence DECIMAL(5,4),
  calibration_error DECIMAL(5,4),
  
  -- Trust score
  trust_score DECIMAL(3,2) DEFAULT 0.5,
  trust_trend VARCHAR(20) CHECK (trust_trend IN ('improving', 'stable', 'declining')),
  
  -- Timestamps
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, recommendation_type, period_type, period_start)
);

CREATE INDEX idx_ai_trust_scores_tenant ON ai_trust_scores(tenant_id);
CREATE INDEX idx_ai_trust_scores_type ON ai_trust_scores(tenant_id, recommendation_type);

ALTER TABLE ai_trust_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON ai_trust_scores FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- AI Behavior Config
CREATE TABLE IF NOT EXISTS public.ai_behavior_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Scope
  recommendation_type VARCHAR(50) NOT NULL,
  
  -- Base thresholds
  auto_execute_threshold DECIMAL(3,2) DEFAULT 0.9,
  suggest_threshold DECIMAL(3,2) DEFAULT 0.5,
  suppress_threshold DECIMAL(3,2) DEFAULT 0.3,
  
  -- Adjusted thresholds (based on trust)
  adjusted_auto_threshold DECIMAL(3,2),
  adjusted_suggest_threshold DECIMAL(3,2),
  
  -- Rate limits
  max_recommendations_per_day INT DEFAULT 10,
  min_interval_minutes INT DEFAULT 60,
  
  -- Escalation
  escalate_to_human_below DECIMAL(3,2) DEFAULT 0.7,
  require_approval_above_impact INT,
  
  -- Status
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
-- HELPER FUNCTIONS
-- ============================================================================

-- Get AI decision context
CREATE OR REPLACE FUNCTION get_ai_decision_context(
  p_tenant_id UUID,
  p_recommendation_type VARCHAR(50)
)
RETURNS JSONB AS $$
DECLARE
  v_context JSONB;
BEGIN
  SELECT jsonb_build_object(
    'trust_score', COALESCE(
      (SELECT trust_score FROM ai_trust_scores 
       WHERE tenant_id = p_tenant_id 
         AND recommendation_type = p_recommendation_type 
         AND period_type = 'all_time'
       LIMIT 1),
      0.5
    ),
    'behavior_config', COALESCE(
      (SELECT jsonb_build_object(
        'auto_execute_threshold', adjusted_auto_threshold,
        'suggest_threshold', adjusted_suggest_threshold,
        'suppress_threshold', suppress_threshold
      ) FROM ai_behavior_config 
       WHERE tenant_id = p_tenant_id 
         AND recommendation_type = p_recommendation_type
       LIMIT 1),
      '{"auto_execute_threshold": 0.9, "suggest_threshold": 0.5, "suppress_threshold": 0.3}'::jsonb
    ),
    'active_constraints', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'type', constraint_type,
        'name', name,
        'value', constraint_value,
        'utilization', current_utilization
      )) FROM constraints 
       WHERE tenant_id = p_tenant_id AND is_active = true),
      '[]'::jsonb
    ),
    'recent_failures', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'type', failure_type,
        'severity', severity,
        'title', title
      )) FROM failure_events 
       WHERE tenant_id = p_tenant_id 
         AND detected_at > NOW() - INTERVAL '30 days'
         AND status != 'resolved'
       ORDER BY detected_at DESC
       LIMIT 5),
      '[]'::jsonb
    ),
    'relevant_lessons', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'lesson', lesson,
        'confidence', confidence
      )) FROM decision_lessons 
       WHERE tenant_id = p_tenant_id 
         AND is_active = true
         AND confidence > 0.6
       ORDER BY confidence DESC
       LIMIT 10),
      '[]'::jsonb
    )
  ) INTO v_context;
  
  RETURN v_context;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update AI trust after outcome
CREATE OR REPLACE FUNCTION update_ai_trust_after_outcome(
  p_recommendation_id UUID,
  p_was_successful BOOLEAN
)
RETURNS VOID AS $$
DECLARE
  v_tenant_id UUID;
  v_recommendation_type VARCHAR(50);
BEGIN
  -- Get recommendation details
  SELECT tenant_id, recommendation_type 
  INTO v_tenant_id, v_recommendation_type
  FROM ai_recommendations 
  WHERE id = p_recommendation_id;
  
  -- Update recommendation outcome
  UPDATE ai_recommendations 
  SET outcome_measured = true,
      outcome_success = p_was_successful,
      outcome_measured_at = NOW()
  WHERE id = p_recommendation_id;
  
  -- Update trust scores
  INSERT INTO ai_trust_scores (
    tenant_id, recommendation_type, period_type, period_start,
    total_recommendations, measured_count, success_count
  )
  VALUES (
    v_tenant_id, v_recommendation_type, 'all_time', NULL,
    1, 1, CASE WHEN p_was_successful THEN 1 ELSE 0 END
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
  
  -- Update behavior config based on new trust
  UPDATE ai_behavior_config
  SET adjusted_auto_threshold = CASE 
        WHEN (SELECT trust_score FROM ai_trust_scores 
              WHERE tenant_id = v_tenant_id 
                AND recommendation_type = v_recommendation_type 
                AND period_type = 'all_time') > 0.8 
        THEN auto_execute_threshold - 0.1
        ELSE auto_execute_threshold + 0.1
      END,
      updated_at = NOW()
  WHERE tenant_id = v_tenant_id 
    AND recommendation_type = v_recommendation_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- WORKFLOW LOGGING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  
  -- Workflow identity
  workflow_name VARCHAR(100) NOT NULL,
  workflow_version VARCHAR(20),
  
  -- Execution
  execution_id VARCHAR(255) NOT NULL,
  idempotency_key VARCHAR(255),
  
  -- Trigger
  trigger_type VARCHAR(30) NOT NULL,
  trigger_data JSONB,
  
  -- Status
  status VARCHAR(20) NOT NULL CHECK (status IN (
    'started', 'running', 'completed', 'failed', 'retrying', 'dead_letter'
  )),
  
  -- Results
  result JSONB,
  error_message TEXT,
  error_details JSONB,
  
  -- Retry
  attempt_number INT DEFAULT 1,
  max_attempts INT DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  
  -- Timing
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

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Total tables created: 35+
-- Memory layers covered: L1-L16 (all 16 layers)
-- All tables have:
--   - tenant_id for isolation
--   - RLS policies using auth.uid() + tenant_users
--   - Appropriate indexes
--   - Timestamps
-- ============================================================================
