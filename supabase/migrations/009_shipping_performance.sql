-- ============================================================================
-- DeepSolution: Shipping Performance & SLA System
-- Version: 2.4 - Shipping Intelligence with Auto-Routing
-- ============================================================================
--
-- PURPOSE:
-- Track shipping provider performance with SLA rules.
-- Enable AI to make intelligent shipping decisions.
-- Auto-disable underperforming providers.
-- Auto-reroute based on regional performance.
--
-- ============================================================================

-- ============================================================================
-- SHIPPING PROVIDERS (Extended)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.shipping_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Provider identification
  provider_code VARCHAR(50) NOT NULL,
  provider_name VARCHAR(100) NOT NULL,
  
  -- API configuration (encrypted in production)
  api_endpoint VARCHAR(500),
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  webhook_secret TEXT,
  
  -- Service details
  service_types VARCHAR(50)[] DEFAULT '{}', -- express, standard, economy, cod
  supported_regions VARCHAR(50)[] DEFAULT '{}', -- region codes
  
  -- Pricing
  base_rate INT DEFAULT 0,
  rate_per_kg INT DEFAULT 0,
  cod_fee_percentage DECIMAL(5,2) DEFAULT 0,
  
  -- SLA commitments
  promised_delivery_days INT DEFAULT 3,
  promised_cod_collection_days INT DEFAULT 7,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  auto_selection_enabled BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, provider_code)
);

CREATE INDEX idx_shipping_providers_tenant ON shipping_providers(tenant_id);
CREATE INDEX idx_shipping_providers_active ON shipping_providers(tenant_id, is_active);

ALTER TABLE shipping_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON shipping_providers FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- SHIPPING PERFORMANCE (Per provider, per period)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.shipping_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES shipping_providers(id) ON DELETE CASCADE,
  
  -- Period
  period_type VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Volume metrics
  total_shipments INT DEFAULT 0,
  total_deliveries INT DEFAULT 0,
  total_returns INT DEFAULT 0,
  total_lost INT DEFAULT 0,
  
  -- Delivery timing
  on_time_deliveries INT DEFAULT 0,
  delayed_deliveries INT DEFAULT 0,
  total_delay_days INT DEFAULT 0,
  max_delay_days INT DEFAULT 0,
  
  -- COD collection
  total_cod_orders INT DEFAULT 0,
  cod_collected INT DEFAULT 0,
  cod_pending INT DEFAULT 0,
  total_cod_delay_days INT DEFAULT 0,
  
  -- Returns
  return_requests INT DEFAULT 0,
  returns_completed INT DEFAULT 0,
  total_return_delay_days INT DEFAULT 0,
  
  -- Support & escalations
  support_tickets INT DEFAULT 0,
  escalations INT DEFAULT 0,
  complaints INT DEFAULT 0,
  
  -- Financial impact
  total_shipping_cost INT DEFAULT 0,
  refunds_due_to_shipping INT DEFAULT 0,
  compensation_paid INT DEFAULT 0,
  
  -- ============================================
  -- DERIVED METRICS (calculated)
  -- ============================================
  
  -- Delivery performance
  on_time_rate DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE WHEN total_deliveries > 0 
      THEN on_time_deliveries::DECIMAL / total_deliveries 
      ELSE NULL END
  ) STORED,
  
  delay_rate DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE WHEN total_deliveries > 0 
      THEN delayed_deliveries::DECIMAL / total_deliveries 
      ELSE NULL END
  ) STORED,
  
  lost_rate DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE WHEN total_shipments > 0 
      THEN total_lost::DECIMAL / total_shipments 
      ELSE NULL END
  ) STORED,
  
  return_rate DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE WHEN total_deliveries > 0 
      THEN total_returns::DECIMAL / total_deliveries 
      ELSE NULL END
  ) STORED,
  
  -- Average delays
  avg_delay_days DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN delayed_deliveries > 0 
      THEN total_delay_days::DECIMAL / delayed_deliveries 
      ELSE 0 END
  ) STORED,
  
  avg_cod_delay_days DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN cod_collected > 0 
      THEN total_cod_delay_days::DECIMAL / cod_collected 
      ELSE 0 END
  ) STORED,
  
  avg_return_delay_days DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN returns_completed > 0 
      THEN total_return_delay_days::DECIMAL / returns_completed 
      ELSE 0 END
  ) STORED,
  
  -- Support metrics
  escalation_rate DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE WHEN total_shipments > 0 
      THEN escalations::DECIMAL / total_shipments 
      ELSE NULL END
  ) STORED,
  
  complaint_rate DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE WHEN total_shipments > 0 
      THEN complaints::DECIMAL / total_shipments 
      ELSE NULL END
  ) STORED,
  
  -- COD performance
  cod_collection_rate DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE WHEN total_cod_orders > 0 
      THEN cod_collected::DECIMAL / total_cod_orders 
      ELSE NULL END
  ) STORED,
  
  -- Cash delay score (0-100, higher = faster cash)
  cash_delay_score DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN total_cod_orders = 0 THEN 100
      WHEN cod_collected = 0 THEN 0
      ELSE GREATEST(0, 100 - (total_cod_delay_days::DECIMAL / cod_collected * 10))
    END
  ) STORED,
  
  -- ============================================
  -- COMPOSITE SHIPPING SCORE (0-100)
  -- ============================================
  -- Weighted: on_time(40%) + lost(20%) + cod(20%) + escalation(10%) + returns(10%)
  
  shipping_score DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN total_shipments < 5 THEN NULL -- Not enough data
    ELSE
      GREATEST(0, LEAST(100,
        -- On-time rate (40% weight, 0-40 points)
        (CASE WHEN total_deliveries > 0 
          THEN (on_time_deliveries::DECIMAL / total_deliveries) * 40 
          ELSE 20 END) +
        
        -- Lost rate (20% weight, inverted: 0 lost = 20 points)
        (CASE WHEN total_shipments > 0 
          THEN (1 - LEAST(1, total_lost::DECIMAL / total_shipments * 10)) * 20 
          ELSE 10 END) +
        
        -- COD collection (20% weight)
        (CASE WHEN total_cod_orders > 0 
          THEN (cod_collected::DECIMAL / total_cod_orders) * 20 
          ELSE 20 END) +
        
        -- Escalation rate (10% weight, inverted)
        (CASE WHEN total_shipments > 0 
          THEN (1 - LEAST(1, escalations::DECIMAL / total_shipments * 20)) * 10 
          ELSE 5 END) +
        
        -- Return rate (10% weight, inverted)
        (CASE WHEN total_deliveries > 0 
          THEN (1 - LEAST(1, total_returns::DECIMAL / total_deliveries * 5)) * 10 
          ELSE 5 END)
      ))
    END
  ) STORED,
  
  -- Timestamps
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, provider_id, period_type, period_start)
);

CREATE INDEX idx_shipping_performance_tenant ON shipping_performance(tenant_id);
CREATE INDEX idx_shipping_performance_provider ON shipping_performance(provider_id);
CREATE INDEX idx_shipping_performance_period ON shipping_performance(tenant_id, period_type, period_start DESC);
CREATE INDEX idx_shipping_performance_score ON shipping_performance(tenant_id, shipping_score);

ALTER TABLE shipping_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON shipping_performance FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- SHIPPING PERFORMANCE BY REGION
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.shipping_performance_by_region (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES shipping_providers(id) ON DELETE CASCADE,
  
  -- Region
  region_code VARCHAR(50) NOT NULL,
  region_name VARCHAR(100),
  
  -- Period
  period_type VARCHAR(20) NOT NULL,
  period_start DATE NOT NULL,
  
  -- Metrics (same as shipping_performance but per region)
  total_shipments INT DEFAULT 0,
  total_deliveries INT DEFAULT 0,
  on_time_deliveries INT DEFAULT 0,
  delayed_deliveries INT DEFAULT 0,
  total_lost INT DEFAULT 0,
  escalations INT DEFAULT 0,
  
  -- Derived
  on_time_rate DECIMAL(5,4),
  lost_rate DECIMAL(5,4),
  shipping_score DECIMAL(5,2),
  
  -- Timestamps
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, provider_id, region_code, period_type, period_start)
);

CREATE INDEX idx_shipping_perf_region_tenant ON shipping_performance_by_region(tenant_id);
CREATE INDEX idx_shipping_perf_region_provider ON shipping_performance_by_region(provider_id, region_code);

ALTER TABLE shipping_performance_by_region ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON shipping_performance_by_region FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- SHIPPING PROVIDER STATUS (Flags & Actions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.shipping_provider_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES shipping_providers(id) ON DELETE CASCADE,
  
  -- Current status
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  -- active, warning, critical, disabled, suspended
  
  -- SLA flags
  is_on_time_critical BOOLEAN DEFAULT false, -- on_time_rate < 50%
  is_score_warning BOOLEAN DEFAULT false, -- shipping_score < 70
  is_score_critical BOOLEAN DEFAULT false, -- shipping_score < 50
  is_auto_selection_disabled BOOLEAN DEFAULT false,
  
  -- Consecutive failures
  consecutive_low_score_periods INT DEFAULT 0,
  consecutive_critical_periods INT DEFAULT 0,
  
  -- Regional flags
  disabled_regions VARCHAR(50)[] DEFAULT '{}',
  warning_regions VARCHAR(50)[] DEFAULT '{}',
  
  -- Last evaluation
  last_shipping_score DECIMAL(5,2),
  last_on_time_rate DECIMAL(5,4),
  last_evaluation_at TIMESTAMPTZ,
  last_evaluation_period VARCHAR(20),
  
  -- Actions taken
  auto_selection_disabled_at TIMESTAMPTZ,
  auto_selection_disabled_reason TEXT,
  manually_overridden BOOLEAN DEFAULT false,
  override_reason TEXT,
  override_by UUID REFERENCES auth.users(id),
  override_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, provider_id)
);

CREATE INDEX idx_shipping_provider_status_tenant ON shipping_provider_status(tenant_id);
CREATE INDEX idx_shipping_provider_status_status ON shipping_provider_status(tenant_id, status);

ALTER TABLE shipping_provider_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON shipping_provider_status FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- SLA RULES TABLE (Configurable per tenant)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.shipping_sla_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Rule identification
  rule_code VARCHAR(50) NOT NULL,
  rule_name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Thresholds
  metric VARCHAR(50) NOT NULL, -- on_time_rate, shipping_score, lost_rate, etc.
  operator VARCHAR(10) NOT NULL, -- '<', '<=', '>', '>=', '='
  threshold_value DECIMAL(10,4) NOT NULL,
  
  -- Consecutive periods required
  consecutive_periods INT DEFAULT 1,
  period_type VARCHAR(20) DEFAULT 'weekly',
  
  -- Action to take
  action VARCHAR(50) NOT NULL,
  -- warning, critical, disable_auto_selection, disable_region, suspend, notify
  
  -- Action parameters
  action_params JSONB DEFAULT '{}'::jsonb,
  -- { notify_channels: ['email', 'slack'], disable_regions: ['REGION_CODE'] }
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  priority INT DEFAULT 0, -- Higher = evaluated first
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, rule_code)
);

CREATE INDEX idx_shipping_sla_rules_tenant ON shipping_sla_rules(tenant_id);

ALTER TABLE shipping_sla_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON shipping_sla_rules FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- Insert default SLA rules (will be copied to each tenant on creation)
-- These are template rules, actual rules are per-tenant

-- ============================================================================
-- SLA VIOLATIONS LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.shipping_sla_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES shipping_providers(id) ON DELETE CASCADE,
  
  -- Rule that was violated
  rule_id UUID REFERENCES shipping_sla_rules(id),
  rule_code VARCHAR(50),
  
  -- Violation details
  metric VARCHAR(50) NOT NULL,
  threshold_value DECIMAL(10,4) NOT NULL,
  actual_value DECIMAL(10,4) NOT NULL,
  
  -- Period
  period_type VARCHAR(20),
  period_start DATE,
  
  -- Severity
  severity VARCHAR(20) NOT NULL, -- warning, critical
  
  -- Action taken
  action_taken VARCHAR(50),
  action_details JSONB DEFAULT '{}'::jsonb,
  
  -- Resolution
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,
  
  -- Timestamps
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shipping_sla_violations_tenant ON shipping_sla_violations(tenant_id);
CREATE INDEX idx_shipping_sla_violations_provider ON shipping_sla_violations(provider_id);
CREATE INDEX idx_shipping_sla_violations_unresolved ON shipping_sla_violations(tenant_id, resolved) WHERE resolved = false;

ALTER TABLE shipping_sla_violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON shipping_sla_violations FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() AND is_active = true)
);

-- ============================================================================
-- FUNCTION: Evaluate Provider SLA
-- ============================================================================

CREATE OR REPLACE FUNCTION evaluate_provider_sla(
  p_tenant_id UUID,
  p_provider_id UUID,
  p_period_type VARCHAR(20) DEFAULT 'weekly'
)
RETURNS JSONB AS $$
DECLARE
  v_performance RECORD;
  v_status RECORD;
  v_result JSONB;
  v_violations JSONB := '[]'::jsonb;
  v_actions JSONB := '[]'::jsonb;
BEGIN
  -- Get latest performance
  SELECT * INTO v_performance
  FROM shipping_performance
  WHERE tenant_id = p_tenant_id
    AND provider_id = p_provider_id
    AND period_type = p_period_type
  ORDER BY period_start DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'no_data', 'message', 'No performance data available');
  END IF;
  
  -- Get or create status record
  INSERT INTO shipping_provider_status (tenant_id, provider_id)
  VALUES (p_tenant_id, p_provider_id)
  ON CONFLICT (tenant_id, provider_id) DO NOTHING;
  
  SELECT * INTO v_status
  FROM shipping_provider_status
  WHERE tenant_id = p_tenant_id AND provider_id = p_provider_id;
  
  -- ============================================
  -- SLA RULE 1: Critical if on_time_rate < 50%
  -- ============================================
  IF v_performance.on_time_rate IS NOT NULL AND v_performance.on_time_rate < 0.50 THEN
    v_violations := v_violations || jsonb_build_object(
      'rule', 'on_time_critical',
      'metric', 'on_time_rate',
      'threshold', 0.50,
      'actual', v_performance.on_time_rate,
      'severity', 'critical'
    );
    
    UPDATE shipping_provider_status
    SET is_on_time_critical = true,
        status = 'critical',
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id AND provider_id = p_provider_id;
    
    -- Log violation
    INSERT INTO shipping_sla_violations (
      tenant_id, provider_id, rule_code, metric, 
      threshold_value, actual_value, period_type, period_start, severity, action_taken
    ) VALUES (
      p_tenant_id, p_provider_id, 'on_time_critical', 'on_time_rate',
      0.50, v_performance.on_time_rate, p_period_type, v_performance.period_start, 'critical', 'status_critical'
    );
  ELSE
    UPDATE shipping_provider_status
    SET is_on_time_critical = false,
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id AND provider_id = p_provider_id;
  END IF;
  
  -- ============================================
  -- SLA RULE 2: Warning if shipping_score < 70
  -- ============================================
  IF v_performance.shipping_score IS NOT NULL AND v_performance.shipping_score < 70 THEN
    v_violations := v_violations || jsonb_build_object(
      'rule', 'score_warning',
      'metric', 'shipping_score',
      'threshold', 70,
      'actual', v_performance.shipping_score,
      'severity', 'warning'
    );
    
    UPDATE shipping_provider_status
    SET is_score_warning = true,
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id AND provider_id = p_provider_id;
    
    -- Log violation
    INSERT INTO shipping_sla_violations (
      tenant_id, provider_id, rule_code, metric,
      threshold_value, actual_value, period_type, period_start, severity, action_taken
    ) VALUES (
      p_tenant_id, p_provider_id, 'score_warning', 'shipping_score',
      70, v_performance.shipping_score, p_period_type, v_performance.period_start, 'warning', 'status_warning'
    );
  ELSE
    UPDATE shipping_provider_status
    SET is_score_warning = false,
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id AND provider_id = p_provider_id;
  END IF;
  
  -- ============================================
  -- SLA RULE 3: Critical if shipping_score < 50
  -- ============================================
  IF v_performance.shipping_score IS NOT NULL AND v_performance.shipping_score < 50 THEN
    UPDATE shipping_provider_status
    SET is_score_critical = true,
        consecutive_low_score_periods = consecutive_low_score_periods + 1,
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id AND provider_id = p_provider_id;
    
    -- Check if 3 consecutive periods
    SELECT consecutive_low_score_periods INTO v_status.consecutive_low_score_periods
    FROM shipping_provider_status
    WHERE tenant_id = p_tenant_id AND provider_id = p_provider_id;
    
    IF v_status.consecutive_low_score_periods >= 3 THEN
      -- Disable auto-selection
      UPDATE shipping_provider_status
      SET is_auto_selection_disabled = true,
          auto_selection_disabled_at = NOW(),
          auto_selection_disabled_reason = 'shipping_score < 50 for 3 consecutive periods',
          status = 'disabled',
          updated_at = NOW()
      WHERE tenant_id = p_tenant_id AND provider_id = p_provider_id;
      
      UPDATE shipping_providers
      SET auto_selection_enabled = false,
          updated_at = NOW()
      WHERE id = p_provider_id;
      
      v_actions := v_actions || jsonb_build_object(
        'action', 'disable_auto_selection',
        'reason', 'shipping_score < 50 for 3 consecutive periods'
      );
      
      -- Log violation
      INSERT INTO shipping_sla_violations (
        tenant_id, provider_id, rule_code, metric,
        threshold_value, actual_value, period_type, period_start, severity, action_taken
      ) VALUES (
        p_tenant_id, p_provider_id, 'score_critical_3x', 'shipping_score',
        50, v_performance.shipping_score, p_period_type, v_performance.period_start, 'critical', 'disable_auto_selection'
      );
    END IF;
  ELSE
    -- Reset consecutive counter if score is good
    UPDATE shipping_provider_status
    SET is_score_critical = false,
        consecutive_low_score_periods = 0,
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id AND provider_id = p_provider_id;
  END IF;
  
  -- ============================================
  -- Update last evaluation
  -- ============================================
  UPDATE shipping_provider_status
  SET last_shipping_score = v_performance.shipping_score,
      last_on_time_rate = v_performance.on_time_rate,
      last_evaluation_at = NOW(),
      last_evaluation_period = p_period_type
  WHERE tenant_id = p_tenant_id AND provider_id = p_provider_id;
  
  -- Build result
  v_result := jsonb_build_object(
    'provider_id', p_provider_id,
    'period_type', p_period_type,
    'period_start', v_performance.period_start,
    'shipping_score', v_performance.shipping_score,
    'on_time_rate', v_performance.on_time_rate,
    'violations', v_violations,
    'actions_taken', v_actions,
    'evaluated_at', NOW()
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Get Best Provider for Region
-- ============================================================================

CREATE OR REPLACE FUNCTION get_best_shipping_provider(
  p_tenant_id UUID,
  p_region_code VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
  provider_id UUID,
  provider_code VARCHAR(50),
  provider_name VARCHAR(100),
  shipping_score DECIMAL(5,2),
  on_time_rate DECIMAL(5,4),
  is_recommended BOOLEAN,
  recommendation_reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.id AS provider_id,
    sp.provider_code,
    sp.provider_name,
    COALESCE(perf.shipping_score, 0) AS shipping_score,
    COALESCE(perf.on_time_rate, 0) AS on_time_rate,
    (
      sp.is_active 
      AND sp.auto_selection_enabled 
      AND COALESCE(status.is_auto_selection_disabled, false) = false
      AND (p_region_code IS NULL OR NOT (p_region_code = ANY(COALESCE(status.disabled_regions, '{}'))))
    ) AS is_recommended,
    CASE 
      WHEN NOT sp.is_active THEN 'Provider is inactive'
      WHEN NOT sp.auto_selection_enabled THEN 'Auto-selection disabled by admin'
      WHEN COALESCE(status.is_auto_selection_disabled, false) THEN status.auto_selection_disabled_reason
      WHEN p_region_code = ANY(COALESCE(status.disabled_regions, '{}')) THEN 'Disabled for this region'
      WHEN COALESCE(perf.shipping_score, 0) >= 80 THEN 'Excellent performance'
      WHEN COALESCE(perf.shipping_score, 0) >= 70 THEN 'Good performance'
      WHEN COALESCE(perf.shipping_score, 0) >= 50 THEN 'Acceptable performance'
      ELSE 'Low performance - consider alternatives'
    END AS recommendation_reason
  FROM shipping_providers sp
  LEFT JOIN LATERAL (
    SELECT shipping_score, on_time_rate
    FROM shipping_performance
    WHERE provider_id = sp.id AND period_type = 'weekly'
    ORDER BY period_start DESC
    LIMIT 1
  ) perf ON true
  LEFT JOIN shipping_provider_status status ON status.provider_id = sp.id
  WHERE sp.tenant_id = p_tenant_id
    AND sp.is_active = true
  ORDER BY 
    is_recommended DESC,
    COALESCE(perf.shipping_score, 0) DESC,
    COALESCE(perf.on_time_rate, 0) DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Check Regional Performance & Auto-Reroute
-- ============================================================================

CREATE OR REPLACE FUNCTION check_regional_performance(
  p_tenant_id UUID,
  p_provider_id UUID,
  p_region_code VARCHAR(50),
  p_failure_threshold DECIMAL(5,4) DEFAULT 0.30 -- 30% failure rate
)
RETURNS JSONB AS $$
DECLARE
  v_regional_perf RECORD;
  v_result JSONB;
BEGIN
  -- Get regional performance
  SELECT * INTO v_regional_perf
  FROM shipping_performance_by_region
  WHERE tenant_id = p_tenant_id
    AND provider_id = p_provider_id
    AND region_code = p_region_code
    AND period_type = 'weekly'
  ORDER BY period_start DESC
  LIMIT 1;
  
  IF NOT FOUND OR v_regional_perf.total_shipments < 5 THEN
    RETURN jsonb_build_object(
      'status', 'insufficient_data',
      'message', 'Not enough shipments in this region to evaluate'
    );
  END IF;
  
  -- Check if failure rate exceeds threshold
  IF (1 - COALESCE(v_regional_perf.on_time_rate, 0)) > p_failure_threshold THEN
    -- Disable provider for this region
    UPDATE shipping_provider_status
    SET disabled_regions = array_append(
          COALESCE(disabled_regions, '{}'), 
          p_region_code
        ),
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id 
      AND provider_id = p_provider_id
      AND NOT (p_region_code = ANY(COALESCE(disabled_regions, '{}')));
    
    -- Log violation
    INSERT INTO shipping_sla_violations (
      tenant_id, provider_id, rule_code, metric,
      threshold_value, actual_value, severity, action_taken, action_details
    ) VALUES (
      p_tenant_id, p_provider_id, 'regional_failure', 'failure_rate',
      p_failure_threshold, (1 - COALESCE(v_regional_perf.on_time_rate, 0)), 
      'critical', 'disable_region',
      jsonb_build_object('region', p_region_code)
    );
    
    RETURN jsonb_build_object(
      'status', 'region_disabled',
      'region', p_region_code,
      'failure_rate', (1 - COALESCE(v_regional_perf.on_time_rate, 0)),
      'threshold', p_failure_threshold,
      'action', 'Provider disabled for this region'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'status', 'ok',
    'region', p_region_code,
    'failure_rate', (1 - COALESCE(v_regional_perf.on_time_rate, 0)),
    'threshold', p_failure_threshold
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VIEW: AI Shipping Intelligence
-- ============================================================================

CREATE OR REPLACE VIEW ai_shipping_intelligence AS
SELECT 
  sp.tenant_id,
  sp.id AS provider_id,
  sp.provider_code,
  sp.provider_name,
  sp.is_active,
  sp.auto_selection_enabled,
  sp.promised_delivery_days,
  
  -- Latest performance
  perf.shipping_score,
  perf.on_time_rate,
  perf.lost_rate,
  perf.avg_delay_days,
  perf.cash_delay_score,
  perf.escalation_rate,
  perf.total_shipments AS recent_shipments,
  
  -- Status flags
  status.status AS current_status,
  status.is_on_time_critical,
  status.is_score_warning,
  status.is_score_critical,
  status.is_auto_selection_disabled,
  status.disabled_regions,
  status.consecutive_low_score_periods,
  
  -- Recommendation
  CASE 
    WHEN NOT sp.is_active THEN 'DO_NOT_USE'
    WHEN status.is_auto_selection_disabled THEN 'DO_NOT_USE'
    WHEN status.is_on_time_critical THEN 'AVOID'
    WHEN status.is_score_critical THEN 'AVOID'
    WHEN status.is_score_warning THEN 'USE_WITH_CAUTION'
    WHEN COALESCE(perf.shipping_score, 0) >= 80 THEN 'RECOMMENDED'
    WHEN COALESCE(perf.shipping_score, 0) >= 70 THEN 'ACCEPTABLE'
    ELSE 'USE_WITH_CAUTION'
  END AS ai_recommendation

FROM shipping_providers sp
LEFT JOIN LATERAL (
  SELECT *
  FROM shipping_performance
  WHERE provider_id = sp.id AND period_type = 'weekly'
  ORDER BY period_start DESC
  LIMIT 1
) perf ON true
LEFT JOIN shipping_provider_status status ON status.provider_id = sp.id;

-- ============================================================================
-- SUMMARY
-- ============================================================================
--
-- TABLES CREATED:
-- 1. shipping_providers - Provider configuration
-- 2. shipping_performance - Performance metrics per period
-- 3. shipping_performance_by_region - Regional performance
-- 4. shipping_provider_status - Status flags & actions
-- 5. shipping_sla_rules - Configurable SLA rules
-- 6. shipping_sla_violations - Violation log
--
-- FUNCTIONS CREATED:
-- 1. evaluate_provider_sla() - Evaluate provider against SLA rules
-- 2. get_best_shipping_provider() - Get recommended provider
-- 3. check_regional_performance() - Check & auto-reroute by region
--
-- VIEWS CREATED:
-- 1. ai_shipping_intelligence - For AI decision making
--
-- SLA RULES IMPLEMENTED:
-- 1. on_time_rate < 50% → CRITICAL status
-- 2. shipping_score < 70 → WARNING status
-- 3. shipping_score < 50 for 3 periods → DISABLE auto-selection
-- 4. Regional failure > threshold → DISABLE for region
--
-- DERIVED METRICS:
-- - on_time_rate, delay_rate, lost_rate, return_rate
-- - avg_delay_days, avg_cod_delay_days, avg_return_delay_days
-- - escalation_rate, complaint_rate, cod_collection_rate
-- - cash_delay_score (0-100)
-- - shipping_score (0-100, weighted composite)
--
-- ============================================================================
