-- ============================================
-- LAYER 8B: UNIT ECONOMICS / COMPUTATIONAL MEMORY
-- ============================================
-- Purpose: Answer "Did we make or lose money, when, why, and how much?"
-- 
-- This layer provides:
-- 1. Raw financial events (all money in/out)
-- 2. Cost attribution logic and results
-- 3. Profit timeline tracking (5 lifecycle stages)
-- 4. Lifetime profit memory per entity
-- 5. AI-readable profit journey with evidence

-- ============================================
-- 1. RAW FINANCIAL EVENTS
-- ============================================
-- Every financial transaction, immutable, timestamped

CREATE TABLE public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Transaction identity
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
    -- Revenue
    'order_revenue',           -- Money from order
    'shipping_revenue',        -- Shipping charged to customer
    
    -- Direct costs
    'product_cost',            -- COGS
    'shipping_cost',           -- Actual shipping paid
    'packaging_cost',          -- Packaging materials
    'cod_fee',                 -- Cash on delivery fee
    'payment_gateway_fee',     -- Online payment fee
    
    -- Marketing costs
    'ad_spend',                -- Advertising spend
    'influencer_fee',          -- Influencer marketing
    'promotion_discount',      -- Discount given
    
    -- Operational costs
    'storage_cost',            -- Warehouse/storage
    'labor_cost',              -- Order processing labor
    'return_processing_cost',  -- Handling returns
    'customer_service_cost',   -- Support costs
    
    -- Adjustments
    'refund',                  -- Money returned to customer
    'chargeback',              -- Disputed transaction
    'write_off',               -- Inventory write-off
    'adjustment'               -- Manual adjustment
  )),
  
  -- Direction
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inflow', 'outflow')),
  
  -- Amount (always positive, direction determines sign)
  amount INT NOT NULL CHECK (amount >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'SAR',
  
  -- Exchange rate if different currency
  exchange_rate DECIMAL(10,6) DEFAULT 1.0,
  amount_in_base_currency INT NOT NULL,
  
  -- Linkages (at least one should be set)
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
  
  -- Source channel
  channel VARCHAR(50),  -- facebook, google, whatsapp, organic, etc.
  
  -- Timing
  transaction_date DATE NOT NULL,
  transaction_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Lifecycle stage when recorded
  lifecycle_stage VARCHAR(30) CHECK (lifecycle_stage IN (
    'pre_sale',        -- Before order confirmed
    'post_sale',       -- After order confirmed
    'post_shipping',   -- After shipped
    'post_collection', -- After payment collected (COD)
    'post_return_window', -- After return window closed
    'final'            -- All adjustments complete
  )),
  
  -- External reference
  external_reference VARCHAR(255),
  external_source VARCHAR(50),
  
  -- Metadata
  notes TEXT,
  recorded_by VARCHAR(50) DEFAULT 'system', -- system, manual, import, api
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Idempotency
  idempotency_key VARCHAR(255) UNIQUE
);

CREATE INDEX idx_fin_trans_tenant ON financial_transactions(tenant_id);
CREATE INDEX idx_fin_trans_tenant_date ON financial_transactions(tenant_id, transaction_date);
CREATE INDEX idx_fin_trans_order ON financial_transactions(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_fin_trans_product ON financial_transactions(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_fin_trans_campaign ON financial_transactions(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_fin_trans_type ON financial_transactions(tenant_id, transaction_type);
CREATE INDEX idx_fin_trans_lifecycle ON financial_transactions(tenant_id, lifecycle_stage);

ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON financial_transactions
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

-- ============================================
-- 2. COST ALLOCATION RULES
-- ============================================
-- Rules for distributing shared costs

CREATE TABLE public.cost_allocation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Rule identity
  rule_name VARCHAR(100) NOT NULL,
  cost_type VARCHAR(50) NOT NULL,
  
  -- Allocation method
  allocation_method VARCHAR(30) NOT NULL CHECK (allocation_method IN (
    'per_order',           -- Divide by number of orders
    'per_unit',            -- Divide by number of units
    'revenue_weighted',    -- Proportional to revenue
    'margin_weighted',     -- Proportional to margin
    'equal_split',         -- Equal across entities
    'custom_formula'       -- Custom JSONB formula
  )),
  
  -- Custom formula (if method = custom_formula)
  custom_formula JSONB,
  
  -- Scope
  applies_to_products UUID[],  -- NULL = all products
  applies_to_campaigns UUID[], -- NULL = all campaigns
  applies_to_channels VARCHAR[],
  
  -- Time scope
  period_type VARCHAR(20) CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly')),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  priority INT DEFAULT 0,  -- Higher = applied first
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cost_rules_tenant ON cost_allocation_rules(tenant_id);

ALTER TABLE cost_allocation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON cost_allocation_rules
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

-- ============================================
-- 3. COST ALLOCATION RESULTS
-- ============================================
-- Stored results of cost allocation (not just rules)

CREATE TABLE public.cost_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Source transaction
  source_transaction_id UUID NOT NULL REFERENCES financial_transactions(id) ON DELETE CASCADE,
  allocation_rule_id UUID REFERENCES cost_allocation_rules(id) ON DELETE SET NULL,
  
  -- Allocation target
  target_type VARCHAR(30) NOT NULL CHECK (target_type IN (
    'order', 'order_item', 'product', 'campaign', 'channel'
  )),
  target_id UUID,  -- ID of order/product/campaign
  target_channel VARCHAR(50),  -- If target_type = channel
  
  -- Allocated amount
  allocated_amount INT NOT NULL,
  allocation_percentage DECIMAL(10,6),
  
  -- Calculation details
  calculation_basis JSONB,  -- How it was calculated
  
  -- Period
  allocation_period DATE NOT NULL,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cost_alloc_tenant ON cost_allocations(tenant_id);
CREATE INDEX idx_cost_alloc_source ON cost_allocations(source_transaction_id);
CREATE INDEX idx_cost_alloc_target ON cost_allocations(target_type, target_id);
CREATE INDEX idx_cost_alloc_period ON cost_allocations(tenant_id, allocation_period);

ALTER TABLE cost_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON cost_allocations
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

-- ============================================
-- 4. ORDER PROFIT TIMELINE
-- ============================================
-- Profit snapshots at each lifecycle stage

CREATE TABLE public.order_profit_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Lifecycle stage
  lifecycle_stage VARCHAR(30) NOT NULL CHECK (lifecycle_stage IN (
    'post_sale',           -- Immediately after order confirmed
    'post_shipping',       -- After shipped
    'post_collection',     -- After payment collected
    'post_return_window',  -- After return window (typically 14-30 days)
    'final'                -- All adjustments complete
  )),
  
  -- Revenue at this stage
  gross_revenue INT NOT NULL DEFAULT 0,
  shipping_revenue INT NOT NULL DEFAULT 0,
  discounts INT NOT NULL DEFAULT 0,
  net_revenue INT NOT NULL DEFAULT 0,
  
  -- Costs at this stage
  product_cost INT NOT NULL DEFAULT 0,
  shipping_cost INT NOT NULL DEFAULT 0,
  packaging_cost INT NOT NULL DEFAULT 0,
  payment_fees INT NOT NULL DEFAULT 0,
  allocated_marketing_cost INT NOT NULL DEFAULT 0,
  allocated_operational_cost INT NOT NULL DEFAULT 0,
  return_cost INT NOT NULL DEFAULT 0,
  other_costs INT NOT NULL DEFAULT 0,
  total_costs INT NOT NULL DEFAULT 0,
  
  -- Profit metrics
  gross_profit INT NOT NULL DEFAULT 0,
  gross_margin DECIMAL(10,4) DEFAULT 0,
  net_profit INT NOT NULL DEFAULT 0,
  net_margin DECIMAL(10,4) DEFAULT 0,
  
  -- Contribution margin (revenue - variable costs only)
  contribution_margin INT NOT NULL DEFAULT 0,
  contribution_margin_percent DECIMAL(10,4) DEFAULT 0,
  
  -- Change from previous stage
  profit_change_from_previous INT DEFAULT 0,
  change_reasons JSONB DEFAULT '[]'::jsonb,
  
  -- Confidence
  confidence DECIMAL(3,2) DEFAULT 1.0,  -- 1.0 = all costs known, lower = estimates
  estimated_costs JSONB DEFAULT '{}'::jsonb,  -- Which costs are estimated
  
  -- Timestamps
  stage_reached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(order_id, lifecycle_stage)
);

CREATE INDEX idx_order_profit_tenant ON order_profit_timeline(tenant_id);
CREATE INDEX idx_order_profit_order ON order_profit_timeline(order_id);
CREATE INDEX idx_order_profit_stage ON order_profit_timeline(tenant_id, lifecycle_stage);
CREATE INDEX idx_order_profit_date ON order_profit_timeline(tenant_id, stage_reached_at);

ALTER TABLE order_profit_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON order_profit_timeline
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

-- ============================================
-- 5. PRODUCT LIFETIME PROFIT MEMORY
-- ============================================

CREATE TABLE public.product_profit_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  -- Period (NULL = lifetime)
  period_type VARCHAR(20) CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'lifetime')),
  period_start DATE,
  period_end DATE,
  
  -- Volume
  units_sold INT NOT NULL DEFAULT 0,
  units_returned INT NOT NULL DEFAULT 0,
  net_units INT NOT NULL DEFAULT 0,
  orders_count INT NOT NULL DEFAULT 0,
  
  -- Revenue
  gross_revenue INT NOT NULL DEFAULT 0,
  net_revenue INT NOT NULL DEFAULT 0,
  avg_selling_price INT DEFAULT 0,
  
  -- Costs
  total_product_cost INT NOT NULL DEFAULT 0,
  total_shipping_cost INT NOT NULL DEFAULT 0,
  total_marketing_cost INT NOT NULL DEFAULT 0,
  total_operational_cost INT NOT NULL DEFAULT 0,
  total_return_cost INT NOT NULL DEFAULT 0,
  total_costs INT NOT NULL DEFAULT 0,
  
  -- Profit
  gross_profit INT NOT NULL DEFAULT 0,
  gross_margin DECIMAL(10,4) DEFAULT 0,
  net_profit INT NOT NULL DEFAULT 0,
  net_margin DECIMAL(10,4) DEFAULT 0,
  profit_per_unit INT DEFAULT 0,
  
  -- Trends
  profit_trend VARCHAR(20) CHECK (profit_trend IN ('improving', 'stable', 'declining', 'volatile', 'unknown')),
  margin_trend VARCHAR(20) CHECK (margin_trend IN ('improving', 'stable', 'declining', 'volatile', 'unknown')),
  
  -- Volatility (standard deviation of profit)
  profit_volatility DECIMAL(10,4) DEFAULT 0,
  margin_volatility DECIMAL(10,4) DEFAULT 0,
  
  -- Confidence
  confidence DECIMAL(3,2) DEFAULT 1.0,
  data_completeness DECIMAL(3,2) DEFAULT 1.0,  -- % of orders with full cost data
  
  -- Metadata
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(product_id, period_type, period_start)
);

CREATE INDEX idx_product_profit_tenant ON product_profit_memory(tenant_id);
CREATE INDEX idx_product_profit_product ON product_profit_memory(product_id);
CREATE INDEX idx_product_profit_period ON product_profit_memory(tenant_id, period_type, period_start);

ALTER TABLE product_profit_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON product_profit_memory
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

-- ============================================
-- 6. CAMPAIGN LIFETIME PROFIT MEMORY
-- ============================================

CREATE TABLE public.campaign_profit_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  
  -- Period
  period_type VARCHAR(20) CHECK (period_type IN ('daily', 'weekly', 'monthly', 'lifetime')),
  period_start DATE,
  period_end DATE,
  
  -- Attribution
  orders_attributed INT NOT NULL DEFAULT 0,
  revenue_attributed INT NOT NULL DEFAULT 0,
  
  -- Costs
  ad_spend INT NOT NULL DEFAULT 0,
  attributed_product_cost INT NOT NULL DEFAULT 0,
  attributed_shipping_cost INT NOT NULL DEFAULT 0,
  attributed_operational_cost INT NOT NULL DEFAULT 0,
  total_costs INT NOT NULL DEFAULT 0,
  
  -- Profit
  gross_profit INT NOT NULL DEFAULT 0,
  net_profit INT NOT NULL DEFAULT 0,
  
  -- Efficiency metrics
  roas DECIMAL(10,4) DEFAULT 0,  -- Revenue / Ad Spend
  poas DECIMAL(10,4) DEFAULT 0,  -- Profit / Ad Spend (more important!)
  cpa INT DEFAULT 0,             -- Cost per Acquisition
  cpp INT DEFAULT 0,             -- Cost per Profit (ad spend to generate $1 profit)
  
  -- Breakeven analysis
  breakeven_orders INT DEFAULT 0,
  orders_to_breakeven INT DEFAULT 0,  -- How many more needed
  is_profitable BOOLEAN DEFAULT false,
  
  -- Trends
  profit_trend VARCHAR(20),
  roas_trend VARCHAR(20),
  
  -- Volatility
  daily_profit_volatility DECIMAL(10,4) DEFAULT 0,
  
  -- Confidence
  confidence DECIMAL(3,2) DEFAULT 1.0,
  attribution_confidence DECIMAL(3,2) DEFAULT 1.0,  -- How sure are we about attribution
  
  -- Metadata
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(campaign_id, period_type, period_start)
);

CREATE INDEX idx_campaign_profit_tenant ON campaign_profit_memory(tenant_id);
CREATE INDEX idx_campaign_profit_campaign ON campaign_profit_memory(campaign_id);
CREATE INDEX idx_campaign_profit_period ON campaign_profit_memory(tenant_id, period_type, period_start);

ALTER TABLE campaign_profit_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON campaign_profit_memory
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

-- ============================================
-- 7. CHANNEL LIFETIME PROFIT MEMORY
-- ============================================

CREATE TABLE public.channel_profit_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Channel
  channel VARCHAR(50) NOT NULL,  -- facebook, google, whatsapp, organic, etc.
  
  -- Period
  period_type VARCHAR(20) CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'lifetime')),
  period_start DATE,
  period_end DATE,
  
  -- Volume
  orders_count INT NOT NULL DEFAULT 0,
  units_sold INT NOT NULL DEFAULT 0,
  new_customers INT NOT NULL DEFAULT 0,
  repeat_customers INT NOT NULL DEFAULT 0,
  
  -- Revenue
  gross_revenue INT NOT NULL DEFAULT 0,
  net_revenue INT NOT NULL DEFAULT 0,
  
  -- Costs
  marketing_cost INT NOT NULL DEFAULT 0,
  attributed_costs INT NOT NULL DEFAULT 0,
  total_costs INT NOT NULL DEFAULT 0,
  
  -- Profit
  gross_profit INT NOT NULL DEFAULT 0,
  net_profit INT NOT NULL DEFAULT 0,
  profit_per_order INT DEFAULT 0,
  
  -- Efficiency
  roas DECIMAL(10,4) DEFAULT 0,
  poas DECIMAL(10,4) DEFAULT 0,
  cac INT DEFAULT 0,  -- Customer Acquisition Cost
  ltv_to_cac DECIMAL(10,4) DEFAULT 0,
  
  -- Trends
  profit_trend VARCHAR(20),
  volume_trend VARCHAR(20),
  
  -- Confidence
  confidence DECIMAL(3,2) DEFAULT 1.0,
  
  -- Metadata
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, channel, period_type, period_start)
);

CREATE INDEX idx_channel_profit_tenant ON channel_profit_memory(tenant_id);
CREATE INDEX idx_channel_profit_channel ON channel_profit_memory(tenant_id, channel);
CREATE INDEX idx_channel_profit_period ON channel_profit_memory(tenant_id, period_type, period_start);

ALTER TABLE channel_profit_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON channel_profit_memory
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

-- ============================================
-- 8. TENANT AGGREGATE PROFIT MEMORY
-- ============================================

CREATE TABLE public.tenant_profit_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Period
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Volume
  total_orders INT NOT NULL DEFAULT 0,
  total_units INT NOT NULL DEFAULT 0,
  cancelled_orders INT NOT NULL DEFAULT 0,
  returned_orders INT NOT NULL DEFAULT 0,
  
  -- Revenue
  gross_revenue INT NOT NULL DEFAULT 0,
  shipping_revenue INT NOT NULL DEFAULT 0,
  discounts_given INT NOT NULL DEFAULT 0,
  refunds_issued INT NOT NULL DEFAULT 0,
  net_revenue INT NOT NULL DEFAULT 0,
  
  -- Costs breakdown
  product_costs INT NOT NULL DEFAULT 0,
  shipping_costs INT NOT NULL DEFAULT 0,
  packaging_costs INT NOT NULL DEFAULT 0,
  payment_fees INT NOT NULL DEFAULT 0,
  marketing_costs INT NOT NULL DEFAULT 0,
  operational_costs INT NOT NULL DEFAULT 0,
  return_costs INT NOT NULL DEFAULT 0,
  other_costs INT NOT NULL DEFAULT 0,
  total_costs INT NOT NULL DEFAULT 0,
  
  -- Profit
  gross_profit INT NOT NULL DEFAULT 0,
  gross_margin DECIMAL(10,4) DEFAULT 0,
  operating_profit INT NOT NULL DEFAULT 0,
  operating_margin DECIMAL(10,4) DEFAULT 0,
  net_profit INT NOT NULL DEFAULT 0,
  net_margin DECIMAL(10,4) DEFAULT 0,
  
  -- Per-order metrics
  avg_order_value INT DEFAULT 0,
  avg_order_profit INT DEFAULT 0,
  avg_order_margin DECIMAL(10,4) DEFAULT 0,
  
  -- Cash flow
  cash_collected INT NOT NULL DEFAULT 0,  -- Actual cash received
  cash_pending INT NOT NULL DEFAULT 0,    -- COD not yet collected
  cash_flow_gap INT NOT NULL DEFAULT 0,   -- Revenue - Cash collected
  
  -- Trends (vs previous period)
  revenue_change_percent DECIMAL(10,4) DEFAULT 0,
  profit_change_percent DECIMAL(10,4) DEFAULT 0,
  margin_change_percent DECIMAL(10,4) DEFAULT 0,
  
  -- Volatility
  daily_profit_volatility DECIMAL(10,4) DEFAULT 0,
  
  -- Confidence
  confidence DECIMAL(3,2) DEFAULT 1.0,
  data_completeness DECIMAL(3,2) DEFAULT 1.0,
  
  -- Metadata
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, period_type, period_start)
);

CREATE INDEX idx_tenant_profit_tenant ON tenant_profit_memory(tenant_id);
CREATE INDEX idx_tenant_profit_period ON tenant_profit_memory(tenant_id, period_type, period_start);

ALTER TABLE tenant_profit_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON tenant_profit_memory
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

-- ============================================
-- 9. UNIT ECONOMICS INSIGHTS
-- ============================================
-- AI-generated insights about profitability

CREATE TABLE public.unit_economics_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Insight classification
  insight_type VARCHAR(50) NOT NULL CHECK (insight_type IN (
    'profitability_alert',      -- Margin dropping, losses detected
    'cost_anomaly',             -- Unusual cost detected
    'pricing_opportunity',      -- Can increase prices
    'cost_reduction',           -- Can reduce costs
    'channel_efficiency',       -- Channel performing well/poorly
    'product_economics',        -- Product-level insight
    'campaign_economics',       -- Campaign-level insight
    'cash_flow_warning',        -- Cash flow issues
    'trend_detection',          -- Significant trend detected
    'breakeven_analysis'        -- Breakeven insights
  )),
  
  -- Severity
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  
  -- Insight content
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  
  -- Quantified impact
  impact_type VARCHAR(30) CHECK (impact_type IN (
    'profit_increase', 'profit_decrease', 'cost_increase', 'cost_decrease',
    'revenue_increase', 'revenue_decrease', 'margin_change', 'cash_flow'
  )),
  impact_amount INT,  -- In smallest currency unit
  impact_percentage DECIMAL(10,4),
  impact_timeframe VARCHAR(30),  -- daily, weekly, monthly, yearly
  
  -- Entity reference
  entity_type VARCHAR(30) CHECK (entity_type IN ('tenant', 'product', 'campaign', 'channel', 'order')),
  entity_id UUID,
  entity_name VARCHAR(255),
  
  -- Evidence (CRITICAL for AI accountability)
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  /*
  Evidence structure:
  [
    {
      "type": "transaction|metric|comparison|trend",
      "source_table": "financial_transactions",
      "source_ids": ["uuid1", "uuid2"],
      "description": "Based on 15 transactions showing...",
      "data_points": {...}
    }
  ]
  */
  
  -- Confidence scoring
  confidence DECIMAL(3,2) NOT NULL DEFAULT 0.5,
  evidence_count INT NOT NULL DEFAULT 0,
  first_observed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_confirmed TIMESTAMPTZ DEFAULT NOW(),
  contradiction_count INT DEFAULT 0,
  
  -- Recommendation
  recommendation TEXT,
  recommended_action JSONB,
  /*
  Recommended action structure:
  {
    "action_type": "adjust_price|pause_campaign|investigate|...",
    "parameters": {...},
    "expected_impact": {...}
  }
  */
  
  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'dismissed', 'expired')),
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ  -- Some insights are time-sensitive
);

CREATE INDEX idx_ue_insights_tenant ON unit_economics_insights(tenant_id);
CREATE INDEX idx_ue_insights_type ON unit_economics_insights(tenant_id, insight_type);
CREATE INDEX idx_ue_insights_severity ON unit_economics_insights(tenant_id, severity);
CREATE INDEX idx_ue_insights_status ON unit_economics_insights(tenant_id, status);
CREATE INDEX idx_ue_insights_entity ON unit_economics_insights(entity_type, entity_id);
CREATE INDEX idx_ue_insights_active ON unit_economics_insights(tenant_id, status, severity) 
  WHERE status = 'active';

ALTER TABLE unit_economics_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON unit_economics_insights
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

-- ============================================
-- 10. PROFIT JOURNEY VIEW (for AI)
-- ============================================
-- Materialized view for AI to read full profit journey

CREATE OR REPLACE VIEW order_profit_journey AS
SELECT 
  o.id AS order_id,
  o.tenant_id,
  o.order_number,
  o.created_at AS order_date,
  o.status AS current_status,
  o.total AS order_total,
  o.campaign_id,
  o.source AS channel,
  
  -- Post-sale snapshot
  ps.net_profit AS profit_post_sale,
  ps.net_margin AS margin_post_sale,
  ps.confidence AS confidence_post_sale,
  
  -- Post-shipping snapshot
  psh.net_profit AS profit_post_shipping,
  psh.net_margin AS margin_post_shipping,
  psh.profit_change_from_previous AS profit_change_shipping,
  
  -- Post-collection snapshot
  pc.net_profit AS profit_post_collection,
  pc.net_margin AS margin_post_collection,
  pc.profit_change_from_previous AS profit_change_collection,
  
  -- Post-return-window snapshot
  pr.net_profit AS profit_post_return,
  pr.net_margin AS margin_post_return,
  pr.profit_change_from_previous AS profit_change_return,
  
  -- Final snapshot
  f.net_profit AS profit_final,
  f.net_margin AS margin_final,
  f.total_costs AS total_costs_final,
  f.confidence AS confidence_final,
  
  -- Journey summary
  COALESCE(f.net_profit, pr.net_profit, pc.net_profit, psh.net_profit, ps.net_profit) AS current_profit,
  COALESCE(f.net_margin, pr.net_margin, pc.net_margin, psh.net_margin, ps.net_margin) AS current_margin,
  
  -- Profit erosion (how much profit was lost through the journey)
  CASE 
    WHEN ps.net_profit IS NOT NULL AND f.net_profit IS NOT NULL 
    THEN ps.net_profit - f.net_profit 
    ELSE 0 
  END AS profit_erosion,
  
  -- Latest stage
  CASE 
    WHEN f.id IS NOT NULL THEN 'final'
    WHEN pr.id IS NOT NULL THEN 'post_return_window'
    WHEN pc.id IS NOT NULL THEN 'post_collection'
    WHEN psh.id IS NOT NULL THEN 'post_shipping'
    WHEN ps.id IS NOT NULL THEN 'post_sale'
    ELSE 'unknown'
  END AS latest_stage

FROM orders o
LEFT JOIN order_profit_timeline ps ON ps.order_id = o.id AND ps.lifecycle_stage = 'post_sale'
LEFT JOIN order_profit_timeline psh ON psh.order_id = o.id AND psh.lifecycle_stage = 'post_shipping'
LEFT JOIN order_profit_timeline pc ON pc.order_id = o.id AND pc.lifecycle_stage = 'post_collection'
LEFT JOIN order_profit_timeline pr ON pr.order_id = o.id AND pr.lifecycle_stage = 'post_return_window'
LEFT JOIN order_profit_timeline f ON f.order_id = o.id AND f.lifecycle_stage = 'final';

-- ============================================
-- 11. HELPER FUNCTIONS
-- ============================================

-- Calculate order profit at a specific stage
CREATE OR REPLACE FUNCTION calculate_order_profit(
  p_order_id UUID,
  p_stage VARCHAR(30)
)
RETURNS TABLE (
  gross_profit INT,
  net_profit INT,
  gross_margin DECIMAL,
  net_margin DECIMAL,
  confidence DECIMAL
) AS $$
DECLARE
  v_tenant_id UUID;
  v_revenue INT;
  v_product_cost INT;
  v_shipping_cost INT;
  v_marketing_cost INT;
  v_other_costs INT;
BEGIN
  -- Get tenant_id
  SELECT tenant_id INTO v_tenant_id FROM orders WHERE id = p_order_id;
  
  -- Calculate revenue
  SELECT COALESCE(SUM(
    CASE WHEN direction = 'inflow' THEN amount_in_base_currency 
         ELSE -amount_in_base_currency END
  ), 0) INTO v_revenue
  FROM financial_transactions
  WHERE order_id = p_order_id
    AND transaction_type IN ('order_revenue', 'shipping_revenue')
    AND (p_stage = 'final' OR created_at <= (
      SELECT stage_reached_at FROM order_profit_timeline 
      WHERE order_id = p_order_id AND lifecycle_stage = p_stage
    ));
  
  -- Calculate costs
  SELECT 
    COALESCE(SUM(CASE WHEN transaction_type = 'product_cost' THEN amount_in_base_currency ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type IN ('shipping_cost', 'packaging_cost') THEN amount_in_base_currency ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type = 'ad_spend' THEN amount_in_base_currency ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type NOT IN ('product_cost', 'shipping_cost', 'packaging_cost', 'ad_spend', 'order_revenue', 'shipping_revenue') AND direction = 'outflow' THEN amount_in_base_currency ELSE 0 END), 0)
  INTO v_product_cost, v_shipping_cost, v_marketing_cost, v_other_costs
  FROM financial_transactions
  WHERE order_id = p_order_id
    AND direction = 'outflow';
  
  RETURN QUERY SELECT
    (v_revenue - v_product_cost)::INT AS gross_profit,
    (v_revenue - v_product_cost - v_shipping_cost - v_marketing_cost - v_other_costs)::INT AS net_profit,
    CASE WHEN v_revenue > 0 THEN ((v_revenue - v_product_cost)::DECIMAL / v_revenue) ELSE 0 END AS gross_margin,
    CASE WHEN v_revenue > 0 THEN ((v_revenue - v_product_cost - v_shipping_cost - v_marketing_cost - v_other_costs)::DECIMAL / v_revenue) ELSE 0 END AS net_margin,
    1.0::DECIMAL AS confidence;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get AI context for unit economics
CREATE OR REPLACE FUNCTION get_unit_economics_context(
  p_tenant_id UUID,
  p_entity_type VARCHAR DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_context JSONB;
BEGIN
  SELECT jsonb_build_object(
    'tenant_summary', (
      SELECT jsonb_build_object(
        'period', period_type,
        'net_revenue', net_revenue,
        'net_profit', net_profit,
        'net_margin', net_margin,
        'avg_order_profit', avg_order_profit,
        'confidence', confidence
      )
      FROM tenant_profit_memory
      WHERE tenant_id = p_tenant_id
        AND period_type = 'monthly'
      ORDER BY period_start DESC
      LIMIT 1
    ),
    'active_insights', (
      SELECT jsonb_agg(jsonb_build_object(
        'type', insight_type,
        'severity', severity,
        'title', title,
        'impact_amount', impact_amount,
        'confidence', confidence
      ))
      FROM unit_economics_insights
      WHERE tenant_id = p_tenant_id
        AND status = 'active'
      ORDER BY severity DESC, confidence DESC
      LIMIT 5
    ),
    'top_profitable_products', (
      SELECT jsonb_agg(jsonb_build_object(
        'product_id', product_id,
        'net_profit', net_profit,
        'net_margin', net_margin,
        'units_sold', units_sold
      ))
      FROM product_profit_memory
      WHERE tenant_id = p_tenant_id
        AND period_type = 'monthly'
        AND period_start = date_trunc('month', CURRENT_DATE)::DATE
      ORDER BY net_profit DESC
      LIMIT 5
    ),
    'channel_performance', (
      SELECT jsonb_agg(jsonb_build_object(
        'channel', channel,
        'net_profit', net_profit,
        'poas', poas,
        'orders_count', orders_count
      ))
      FROM channel_profit_memory
      WHERE tenant_id = p_tenant_id
        AND period_type = 'monthly'
        AND period_start = date_trunc('month', CURRENT_DATE)::DATE
      ORDER BY net_profit DESC
    )
  ) INTO v_context;
  
  RETURN v_context;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 12. TRIGGERS FOR AUTO-CALCULATION
-- ============================================

-- Trigger to update order profit timeline when transaction added
CREATE OR REPLACE FUNCTION update_order_profit_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if order_id is set
  IF NEW.order_id IS NOT NULL THEN
    -- Recalculate profit for the order's current stage
    -- This is a simplified version - full implementation would be more complex
    PERFORM calculate_order_profit(NEW.order_id, 'post_sale');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_profit_on_transaction
  AFTER INSERT ON financial_transactions
  FOR EACH ROW EXECUTE FUNCTION update_order_profit_on_transaction();
