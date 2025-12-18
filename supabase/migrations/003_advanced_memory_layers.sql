-- ============================================
-- ADVANCED COGNITIVE MEMORY LAYERS (11-16)
-- ============================================
-- World-class cognitive architecture for AI-powered decision making
-- 
-- Layer 11: Decision Memory
-- Layer 12: Timing & Opportunity Window Memory
-- Layer 13: Failure & Near-Failure Memory
-- Layer 14: Experimentation & A/B Wisdom Memory
-- Layer 15: Constraint & Reality Memory
-- Layer 16: Trust & Confidence Memory

-- ============================================
-- LAYER 11: DECISION MEMORY
-- ============================================
-- Every major decision (AI or human) with full lifecycle tracking

-- Decision registry
CREATE TABLE public.decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Decision identity
  decision_type VARCHAR(50) NOT NULL CHECK (decision_type IN (
    -- Strategic
    'pricing_change',
    'campaign_launch',
    'campaign_pause',
    'campaign_budget_change',
    'product_launch',
    'product_discontinue',
    'channel_expansion',
    'channel_exit',
    
    -- Operational
    'inventory_reorder',
    'shipping_provider_change',
    'promotion_launch',
    'discount_offer',
    
    -- Customer
    'order_approval',
    'order_cancellation',
    'refund_approval',
    'customer_escalation',
    
    -- AI-specific
    'ai_recommendation_accept',
    'ai_recommendation_reject',
    'ai_auto_action',
    
    -- Other
    'other'
  )),
  
  -- Decision maker
  decision_maker VARCHAR(30) NOT NULL CHECK (decision_maker IN (
    'human',           -- User made decision
    'ai_recommended',  -- AI recommended, human approved
    'ai_auto',         -- AI made automatically
    'system',          -- System rule triggered
    'external'         -- External system/API
  )),
  made_by_user_id UUID REFERENCES auth.users(id),
  ai_model_used VARCHAR(50),
  
  -- Decision content
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Context at decision time (CRITICAL for learning)
  context_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  /*
  Context structure:
  {
    "market_conditions": {...},
    "tenant_metrics": {...},
    "entity_state": {...},
    "recent_events": [...],
    "constraints_active": [...],
    "alternatives_considered": [...]
  }
  */
  
  -- Alternatives considered
  alternatives JSONB DEFAULT '[]'::jsonb,
  /*
  [
    {
      "option": "Increase price by 10%",
      "expected_outcome": {...},
      "rejection_reason": "Too aggressive"
    }
  ]
  */
  
  -- Expected outcome
  expected_outcome JSONB NOT NULL,
  /*
  {
    "metric": "revenue",
    "direction": "increase",
    "magnitude": 0.15,
    "timeframe_days": 30,
    "confidence": 0.7
  }
  */
  
  -- Reasoning
  reasoning TEXT NOT NULL,
  evidence_refs JSONB DEFAULT '[]'::jsonb,  -- Links to supporting data
  
  -- Entity affected
  entity_type VARCHAR(30),
  entity_id UUID,
  entity_name VARCHAR(255),
  
  -- Status
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Decision made, not yet executed
    'executed',     -- Action taken
    'monitoring',   -- Watching for outcome
    'evaluated',    -- Outcome measured
    'learned'       -- Lessons extracted
  )),
  
  -- Execution
  executed_at TIMESTAMPTZ,
  execution_details JSONB,
  
  -- Timestamps
  decision_made_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_decisions_tenant ON decisions(tenant_id);
CREATE INDEX idx_decisions_type ON decisions(tenant_id, decision_type);
CREATE INDEX idx_decisions_maker ON decisions(tenant_id, decision_maker);
CREATE INDEX idx_decisions_status ON decisions(tenant_id, status);
CREATE INDEX idx_decisions_entity ON decisions(entity_type, entity_id);
CREATE INDEX idx_decisions_date ON decisions(tenant_id, decision_made_at DESC);

ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON decisions
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

-- Decision outcomes (actual results)
CREATE TABLE public.decision_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  
  -- Measurement timing
  measurement_type VARCHAR(30) NOT NULL CHECK (measurement_type IN (
    'immediate',    -- Within 24 hours
    'short_term',   -- 1-7 days
    'medium_term',  -- 7-30 days
    'long_term',    -- 30+ days
    'final'         -- Conclusive measurement
  )),
  measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Actual outcome
  actual_outcome JSONB NOT NULL,
  /*
  {
    "metric": "revenue",
    "baseline_value": 10000,
    "actual_value": 11500,
    "change_absolute": 1500,
    "change_percent": 0.15
  }
  */
  
  -- Comparison to expected
  outcome_vs_expected VARCHAR(30) CHECK (outcome_vs_expected IN (
    'exceeded',         -- Better than expected
    'met',              -- As expected
    'partially_met',    -- Somewhat below
    'missed',           -- Significantly below
    'opposite'          -- Opposite effect
  )),
  variance_from_expected DECIMAL(10,4),
  
  -- Side effects (unintended consequences)
  side_effects JSONB DEFAULT '[]'::jsonb,
  /*
  [
    {
      "effect": "Customer complaints increased",
      "severity": "medium",
      "was_anticipated": false
    }
  ]
  */
  
  -- Confidence in measurement
  measurement_confidence DECIMAL(3,2) DEFAULT 1.0,
  attribution_confidence DECIMAL(3,2) DEFAULT 1.0,  -- How sure this outcome is due to decision
  
  -- Notes
  analysis_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_decision_outcomes_decision ON decision_outcomes(decision_id);
CREATE INDEX idx_decision_outcomes_tenant ON decision_outcomes(tenant_id);

ALTER TABLE decision_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON decision_outcomes
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

-- Decision lessons (extracted wisdom)
CREATE TABLE public.decision_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  
  -- Lesson content
  lesson_type VARCHAR(30) NOT NULL CHECK (lesson_type IN (
    'success_factor',    -- What made it work
    'failure_cause',     -- What caused failure
    'unexpected_effect', -- Surprising outcome
    'timing_insight',    -- About when to act
    'context_dependency',-- Works only in certain conditions
    'constraint_discovered', -- New constraint found
    'best_practice',     -- Reusable approach
    'anti_pattern'       -- What to avoid
  )),
  
  lesson TEXT NOT NULL,
  
  -- Applicability
  applies_to_decision_types VARCHAR[] NOT NULL,
  applies_to_conditions JSONB,  -- When this lesson is relevant
  
  -- Confidence
  confidence DECIMAL(3,2) DEFAULT 0.5,
  times_validated INT DEFAULT 1,
  times_contradicted INT DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  superseded_by UUID REFERENCES decision_lessons(id),
  
  -- Metadata
  extracted_at TIMESTAMPTZ DEFAULT NOW(),
  last_validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_decision_lessons_tenant ON decision_lessons(tenant_id);
CREATE INDEX idx_decision_lessons_type ON decision_lessons(tenant_id, lesson_type);
CREATE INDEX idx_decision_lessons_active ON decision_lessons(tenant_id, is_active) WHERE is_active = true;

ALTER TABLE decision_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON decision_lessons
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

-- ============================================
-- LAYER 12: TIMING & OPPORTUNITY WINDOW MEMORY
-- ============================================
-- Temporal patterns, seasonality, critical windows, tipping points

-- Temporal patterns
CREATE TABLE public.temporal_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Pattern identity
  pattern_type VARCHAR(50) NOT NULL CHECK (pattern_type IN (
    -- Cyclical
    'hourly_pattern',      -- Within day
    'daily_pattern',       -- Day of week
    'weekly_pattern',      -- Week of month
    'monthly_pattern',     -- Month of year
    'seasonal_pattern',    -- Season
    'annual_pattern',      -- Year over year
    
    -- Event-based
    'payday_effect',       -- Around paydays
    'holiday_effect',      -- Around holidays
    'ramadan_effect',      -- Ramadan patterns
    'weekend_effect',      -- Weekend vs weekday
    
    -- Business-specific
    'campaign_fatigue',    -- Ad performance decay
    'inventory_cycle',     -- Reorder patterns
    'customer_lifecycle',  -- Customer behavior over time
    
    -- Market
    'competitor_timing',   -- Competitor activity patterns
    'market_cycle'         -- Industry cycles
  )),
  
  -- What this pattern affects
  affects_metric VARCHAR(50) NOT NULL,  -- sales, traffic, conversion, etc.
  affects_entity_type VARCHAR(30),
  affects_entity_id UUID,
  
  -- Pattern definition
  pattern_data JSONB NOT NULL,
  /*
  For hourly_pattern:
  {
    "peak_hours": [10, 11, 20, 21],
    "low_hours": [3, 4, 5],
    "multipliers": {"10": 1.5, "3": 0.3, ...}
  }
  
  For seasonal_pattern:
  {
    "high_season": ["11", "12"],
    "low_season": ["06", "07"],
    "multipliers": {"11": 1.8, "06": 0.6, ...}
  }
  */
  
  -- Statistical strength
  confidence DECIMAL(3,2) NOT NULL DEFAULT 0.5,
  sample_size INT NOT NULL DEFAULT 0,
  r_squared DECIMAL(5,4),  -- Statistical fit
  
  -- Evidence
  first_observed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_confirmed TIMESTAMPTZ,
  observation_count INT DEFAULT 1,
  contradiction_count INT DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_temporal_patterns_tenant ON temporal_patterns(tenant_id);
CREATE INDEX idx_temporal_patterns_type ON temporal_patterns(tenant_id, pattern_type);
CREATE INDEX idx_temporal_patterns_metric ON temporal_patterns(tenant_id, affects_metric);

ALTER TABLE temporal_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON temporal_patterns
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

-- Opportunity windows
CREATE TABLE public.opportunity_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Window identity
  window_type VARCHAR(50) NOT NULL CHECK (window_type IN (
    'sales_peak',          -- High sales period
    'low_competition',     -- Competitors inactive
    'high_intent',         -- Customer intent high
    'price_sensitivity',   -- Price changes effective
    'launch_window',       -- Good time to launch
    'promotion_window',    -- Promotions effective
    'inventory_window',    -- Good time to restock
    'hiring_window',       -- Good time to scale ops
    'market_entry',        -- Good time for new market
    'custom'
  )),
  
  -- Description
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Timing
  window_start TIMESTAMPTZ,
  window_end TIMESTAMPTZ,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern JSONB,  -- Cron-like pattern for recurring
  /*
  {
    "type": "annual",
    "months": [11, 12],
    "days": null
  }
  */
  
  -- Opportunity details
  opportunity_score DECIMAL(3,2),  -- 0-1, how good is this window
  expected_impact JSONB,
  /*
  {
    "metric": "sales",
    "uplift_percent": 50,
    "confidence": 0.7
  }
  */
  
  -- Recommended actions
  recommended_actions JSONB DEFAULT '[]'::jsonb,
  
  -- Evidence
  based_on_patterns UUID[],  -- Links to temporal_patterns
  historical_performance JSONB,  -- Past performance in similar windows
  
  -- Status
  status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN (
    'upcoming',    -- Window not yet started
    'active',      -- Currently in window
    'passed',      -- Window ended
    'captured',    -- Opportunity was seized
    'missed'       -- Opportunity was missed
  )),
  
  -- Outcome (if captured or missed)
  outcome_notes TEXT,
  actual_impact JSONB,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_opportunity_windows_tenant ON opportunity_windows(tenant_id);
CREATE INDEX idx_opportunity_windows_type ON opportunity_windows(tenant_id, window_type);
CREATE INDEX idx_opportunity_windows_status ON opportunity_windows(tenant_id, status);
CREATE INDEX idx_opportunity_windows_dates ON opportunity_windows(tenant_id, window_start, window_end);

ALTER TABLE opportunity_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON opportunity_windows
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

-- Tipping points (critical thresholds)
CREATE TABLE public.tipping_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Tipping point identity
  tipping_point_type VARCHAR(50) NOT NULL CHECK (tipping_point_type IN (
    'inventory_critical',   -- Stock about to run out
    'budget_exhaustion',    -- Marketing budget depleting
    'margin_collapse',      -- Margins hitting floor
    'capacity_limit',       -- Operational capacity
    'cash_flow_crisis',     -- Cash running low
    'customer_churn_spike', -- Churn accelerating
    'competitor_threat',    -- Competitor gaining
    'market_saturation',    -- Market getting crowded
    'growth_inflection',    -- Growth rate changing
    'custom'
  )),
  
  -- What's being monitored
  monitored_metric VARCHAR(100) NOT NULL,
  entity_type VARCHAR(30),
  entity_id UUID,
  
  -- Threshold definition
  threshold_value DECIMAL(20,4) NOT NULL,
  threshold_direction VARCHAR(10) NOT NULL CHECK (threshold_direction IN ('above', 'below', 'equals')),
  current_value DECIMAL(20,4),
  
  -- Proximity
  distance_to_threshold DECIMAL(20,4),
  velocity DECIMAL(20,4),  -- Rate of change toward threshold
  estimated_time_to_threshold INTERVAL,
  
  -- Severity
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical', 'emergency')),
  
  -- Actions
  recommended_actions JSONB DEFAULT '[]'::jsonb,
  auto_action_enabled BOOLEAN DEFAULT false,
  auto_action_config JSONB,
  
  -- Status
  status VARCHAR(20) DEFAULT 'monitoring' CHECK (status IN (
    'monitoring',  -- Watching
    'approaching', -- Getting close
    'breached',    -- Threshold crossed
    'resolved',    -- Issue resolved
    'ignored'      -- Deliberately ignored
  )),
  
  -- History
  breach_history JSONB DEFAULT '[]'::jsonb,
  /*
  [
    {
      "breached_at": "2024-01-15T10:00:00Z",
      "value_at_breach": 5,
      "resolved_at": "2024-01-16T14:00:00Z",
      "resolution": "Restocked inventory"
    }
  ]
  */
  
  -- Metadata
  last_checked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tipping_points_tenant ON tipping_points(tenant_id);
CREATE INDEX idx_tipping_points_type ON tipping_points(tenant_id, tipping_point_type);
CREATE INDEX idx_tipping_points_status ON tipping_points(tenant_id, status);
CREATE INDEX idx_tipping_points_severity ON tipping_points(tenant_id, severity);

ALTER TABLE tipping_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON tipping_points
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

-- ============================================
-- LAYER 13: FAILURE & NEAR-FAILURE MEMORY
-- ============================================
-- Failures, near-misses, recovered incidents, prevention

-- Failure events
CREATE TABLE public.failure_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Failure identity
  failure_type VARCHAR(50) NOT NULL CHECK (failure_type IN (
    -- Operational
    'order_failure',        -- Order couldn't be fulfilled
    'delivery_failure',     -- Delivery failed
    'payment_failure',      -- Payment issue
    'inventory_stockout',   -- Ran out of stock
    'system_downtime',      -- System unavailable
    
    -- Financial
    'campaign_loss',        -- Campaign lost money
    'margin_negative',      -- Sold at loss
    'cash_flow_gap',        -- Cash shortage
    'bad_debt',             -- Uncollectable payment
    
    -- Customer
    'customer_complaint',   -- Serious complaint
    'customer_churn',       -- Lost customer
    'refund_abuse',         -- Fraudulent refund
    
    -- Strategic
    'launch_failure',       -- Product/campaign launch failed
    'market_exit',          -- Had to exit market
    'partnership_failure',  -- Partnership didn't work
    
    -- AI
    'ai_recommendation_failure', -- AI recommendation backfired
    'ai_prediction_miss',   -- AI prediction was wrong
    
    -- Other
    'other'
  )),
  
  -- Severity
  severity VARCHAR(20) NOT NULL CHECK (severity IN (
    'minor',      -- Small impact, easily fixed
    'moderate',   -- Noticeable impact
    'major',      -- Significant impact
    'critical',   -- Severe impact
    'catastrophic'-- Business-threatening
  )),
  
  -- Was it a near-miss?
  was_near_miss BOOLEAN DEFAULT false,
  near_miss_details TEXT,
  
  -- Description
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  
  -- Impact
  impact JSONB NOT NULL,
  /*
  {
    "financial_loss": 5000,
    "orders_affected": 15,
    "customers_affected": 12,
    "reputation_impact": "moderate",
    "recovery_time_hours": 24
  }
  */
  
  -- Entity affected
  entity_type VARCHAR(30),
  entity_id UUID,
  
  -- Timeline
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,  -- When failure actually began
  resolved_at TIMESTAMPTZ,
  
  -- Root cause analysis
  root_cause TEXT,
  root_cause_category VARCHAR(50) CHECK (root_cause_category IN (
    'human_error',
    'process_gap',
    'system_bug',
    'external_factor',
    'resource_constraint',
    'communication_failure',
    'data_quality',
    'vendor_failure',
    'market_change',
    'unknown'
  )),
  contributing_factors JSONB DEFAULT '[]'::jsonb,
  
  -- Prevention
  was_preventable BOOLEAN,
  prevention_measures JSONB DEFAULT '[]'::jsonb,
  /*
  [
    {
      "measure": "Add inventory alert at 10 units",
      "implemented": true,
      "implementation_date": "2024-01-20"
    }
  ]
  */
  
  -- Links
  related_decisions UUID[],  -- Decisions that led to this
  related_failures UUID[],   -- Related failure events
  
  -- Status
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN (
    'open',       -- Still investigating
    'analyzed',   -- Root cause found
    'mitigated',  -- Immediate fix applied
    'resolved',   -- Fully resolved
    'accepted'    -- Accepted as risk
  )),
  
  -- Metadata
  reported_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_failure_events_tenant ON failure_events(tenant_id);
CREATE INDEX idx_failure_events_type ON failure_events(tenant_id, failure_type);
CREATE INDEX idx_failure_events_severity ON failure_events(tenant_id, severity);
CREATE INDEX idx_failure_events_status ON failure_events(tenant_id, status);
CREATE INDEX idx_failure_events_date ON failure_events(tenant_id, detected_at DESC);

ALTER TABLE failure_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON failure_events
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

-- Failure patterns (learned from multiple failures)
CREATE TABLE public.failure_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Pattern identity
  pattern_name VARCHAR(255) NOT NULL,
  failure_types VARCHAR[] NOT NULL,  -- Types of failures this pattern covers
  
  -- Pattern description
  description TEXT NOT NULL,
  
  -- Detection signals (early warning signs)
  warning_signals JSONB NOT NULL,
  /*
  [
    {
      "signal": "Inventory below 20 units",
      "lead_time_hours": 48,
      "reliability": 0.8
    }
  ]
  */
  
  -- Conditions that trigger this pattern
  trigger_conditions JSONB NOT NULL,
  
  -- Prevention rules
  prevention_rules JSONB NOT NULL,
  /*
  [
    {
      "rule": "Reorder when inventory < 30",
      "priority": "high",
      "auto_enforce": true
    }
  ]
  */
  
  -- Statistics
  occurrences INT DEFAULT 1,
  last_occurrence TIMESTAMPTZ,
  prevented_count INT DEFAULT 0,  -- Times pattern was detected and prevented
  
  -- Confidence
  confidence DECIMAL(3,2) DEFAULT 0.5,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_failure_patterns_tenant ON failure_patterns(tenant_id);
CREATE INDEX idx_failure_patterns_active ON failure_patterns(tenant_id, is_active) WHERE is_active = true;

ALTER TABLE failure_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON failure_patterns
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

-- ============================================
-- LAYER 14: EXPERIMENTATION & A/B WISDOM MEMORY
-- ============================================
-- Hypotheses, experiments, results, accumulated wisdom

-- Experiments
CREATE TABLE public.experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Experiment identity
  experiment_type VARCHAR(50) NOT NULL CHECK (experiment_type IN (
    'pricing_test',
    'creative_test',
    'audience_test',
    'landing_page_test',
    'offer_test',
    'timing_test',
    'channel_test',
    'copy_test',
    'ux_test',
    'process_test',
    'other'
  )),
  
  -- Description
  name VARCHAR(255) NOT NULL,
  hypothesis TEXT NOT NULL,
  /*
  "Increasing price by 10% will not significantly reduce conversion rate
   because our customers are not price-sensitive for this product category"
  */
  
  -- Variants
  control_description TEXT NOT NULL,
  control_config JSONB,
  variants JSONB NOT NULL,
  /*
  [
    {
      "variant_id": "A",
      "description": "10% price increase",
      "config": {"price_multiplier": 1.1}
    },
    {
      "variant_id": "B",
      "description": "15% price increase",
      "config": {"price_multiplier": 1.15}
    }
  ]
  */
  
  -- Success metrics
  primary_metric VARCHAR(100) NOT NULL,
  secondary_metrics VARCHAR[] DEFAULT '{}',
  minimum_detectable_effect DECIMAL(10,4),  -- MDE
  
  -- Sample size
  target_sample_size INT,
  current_sample_size INT DEFAULT 0,
  
  -- Entity scope
  entity_type VARCHAR(30),
  entity_ids UUID[],
  
  -- Timeline
  planned_start TIMESTAMPTZ,
  planned_end TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
    'draft',      -- Being designed
    'ready',      -- Ready to run
    'running',    -- Currently active
    'paused',     -- Temporarily stopped
    'completed',  -- Finished running
    'analyzed',   -- Results analyzed
    'abandoned'   -- Stopped early
  )),
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_experiments_tenant ON experiments(tenant_id);
CREATE INDEX idx_experiments_type ON experiments(tenant_id, experiment_type);
CREATE INDEX idx_experiments_status ON experiments(tenant_id, status);

ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON experiments
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

-- Experiment results
CREATE TABLE public.experiment_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  
  -- Results per variant
  variant_id VARCHAR(50) NOT NULL,  -- 'control', 'A', 'B', etc.
  
  -- Sample
  sample_size INT NOT NULL,
  
  -- Primary metric results
  primary_metric_value DECIMAL(20,4) NOT NULL,
  primary_metric_variance DECIMAL(20,4),
  
  -- Secondary metrics
  secondary_metrics_values JSONB DEFAULT '{}'::jsonb,
  
  -- Statistical analysis
  vs_control_lift DECIMAL(10,4),  -- % change vs control
  vs_control_p_value DECIMAL(10,6),
  vs_control_confidence_interval JSONB,  -- {"lower": x, "upper": y}
  is_statistically_significant BOOLEAN,
  
  -- Metadata
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_experiment_results_experiment ON experiment_results(experiment_id);
CREATE INDEX idx_experiment_results_tenant ON experiment_results(tenant_id);

ALTER TABLE experiment_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON experiment_results
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

-- Experiment conclusions (wisdom)
CREATE TABLE public.experiment_conclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  
  -- Conclusion
  hypothesis_validated BOOLEAN,
  conclusion TEXT NOT NULL,
  
  -- Winner
  winning_variant VARCHAR(50),
  winning_config JSONB,
  
  -- Impact
  measured_impact JSONB,
  /*
  {
    "metric": "revenue",
    "lift_percent": 12,
    "confidence": 0.95,
    "monthly_value": 5000
  }
  */
  
  -- Applicability
  applies_to_conditions JSONB,  -- When this learning applies
  does_not_apply_to JSONB,      -- When it doesn't apply
  
  -- Repeatability
  repeatability_score DECIMAL(3,2),  -- How likely to repeat
  times_replicated INT DEFAULT 0,
  replication_results JSONB DEFAULT '[]'::jsonb,
  
  -- Confidence
  confidence DECIMAL(3,2) NOT NULL,
  
  -- Action taken
  was_implemented BOOLEAN DEFAULT false,
  implementation_date TIMESTAMPTZ,
  implementation_notes TEXT,
  
  -- Long-term tracking
  long_term_outcome JSONB,  -- Filled after implementation
  
  -- Metadata
  concluded_by UUID REFERENCES auth.users(id),
  concluded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_experiment_conclusions_tenant ON experiment_conclusions(tenant_id);
CREATE INDEX idx_experiment_conclusions_experiment ON experiment_conclusions(experiment_id);

ALTER TABLE experiment_conclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON experiment_conclusions
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

-- ============================================
-- LAYER 15: CONSTRAINT & REALITY MEMORY
-- ============================================
-- Operational, financial, and logistical constraints

-- Constraints
CREATE TABLE public.constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Constraint identity
  constraint_type VARCHAR(50) NOT NULL CHECK (constraint_type IN (
    -- Financial
    'budget_limit',         -- Maximum spend
    'cash_reserve',         -- Minimum cash
    'credit_limit',         -- Credit available
    'payment_terms',        -- Payment timing
    
    -- Operational
    'capacity_limit',       -- Max orders/day
    'storage_limit',        -- Warehouse space
    'shipping_limit',       -- Shipping capacity
    'processing_time',      -- Min processing time
    'operating_hours',      -- Business hours
    
    -- Inventory
    'min_stock_level',      -- Safety stock
    'max_stock_level',      -- Storage limit
    'lead_time',            -- Supplier lead time
    'moq',                  -- Minimum order quantity
    
    -- Market
    'price_floor',          -- Minimum price
    'price_ceiling',        -- Maximum price
    'market_size',          -- Addressable market
    'competition_intensity',
    
    -- Legal/Compliance
    'regulatory_limit',     -- Legal constraints
    'license_limit',        -- License restrictions
    'geographic_limit',     -- Where can operate
    
    -- Technical
    'api_rate_limit',       -- External API limits
    'system_capacity',      -- System limits
    
    -- Other
    'custom'
  )),
  
  -- Description
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Constraint value
  constraint_value JSONB NOT NULL,
  /*
  For budget_limit:
  {
    "amount": 50000,
    "currency": "SAR",
    "period": "monthly",
    "category": "marketing"
  }
  
  For capacity_limit:
  {
    "max_orders_per_day": 100,
    "max_units_per_day": 500
  }
  */
  
  -- Current state
  current_utilization DECIMAL(10,4),  -- 0-1, how much of constraint is used
  headroom JSONB,  -- How much capacity remains
  
  -- Flexibility
  is_hard_constraint BOOLEAN DEFAULT true,  -- Can it be exceeded?
  flexibility_notes TEXT,
  override_cost JSONB,  -- Cost to exceed constraint
  
  -- Entity scope
  applies_to_entity_type VARCHAR(30),
  applies_to_entity_ids UUID[],
  
  -- Time scope
  effective_from TIMESTAMPTZ DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  
  -- Source
  source VARCHAR(50) CHECK (source IN (
    'system_detected',  -- AI detected
    'user_defined',     -- User set
    'external',         -- From external system
    'learned'           -- Learned from failures
  )),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- History
  history JSONB DEFAULT '[]'::jsonb,  -- Past values
  
  -- Metadata
  last_checked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_constraints_tenant ON constraints(tenant_id);
CREATE INDEX idx_constraints_type ON constraints(tenant_id, constraint_type);
CREATE INDEX idx_constraints_active ON constraints(tenant_id, is_active) WHERE is_active = true;

ALTER TABLE constraints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON constraints
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

-- Constraint violations
CREATE TABLE public.constraint_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  constraint_id UUID NOT NULL REFERENCES constraints(id) ON DELETE CASCADE,
  
  -- Violation details
  violated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  violation_value JSONB NOT NULL,  -- What was the actual value
  violation_severity DECIMAL(10,4),  -- How much over/under
  
  -- Context
  context JSONB,  -- What was happening when violated
  
  -- Cause
  cause VARCHAR(50) CHECK (cause IN (
    'unexpected_demand',
    'system_error',
    'human_override',
    'external_factor',
    'data_lag',
    'unknown'
  )),
  cause_details TEXT,
  
  -- Impact
  impact JSONB,
  
  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolution TEXT,
  
  -- Prevention
  prevention_action TEXT,
  constraint_updated BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_constraint_violations_tenant ON constraint_violations(tenant_id);
CREATE INDEX idx_constraint_violations_constraint ON constraint_violations(constraint_id);
CREATE INDEX idx_constraint_violations_date ON constraint_violations(tenant_id, violated_at DESC);

ALTER TABLE constraint_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON constraint_violations
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

-- ============================================
-- LAYER 16: TRUST & CONFIDENCE MEMORY
-- ============================================
-- AI accuracy tracking and dynamic confidence adjustment

-- AI recommendations log
CREATE TABLE public.ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Recommendation identity
  recommendation_type VARCHAR(50) NOT NULL CHECK (recommendation_type IN (
    'pricing',
    'inventory',
    'marketing',
    'campaign',
    'product',
    'customer',
    'operational',
    'strategic',
    'content',
    'other'
  )),
  
  -- The recommendation
  recommendation TEXT NOT NULL,
  recommendation_data JSONB,
  
  -- AI context
  ai_model VARCHAR(50) NOT NULL,
  ai_confidence DECIMAL(3,2) NOT NULL,  -- AI's stated confidence
  reasoning TEXT,
  
  -- Context at recommendation time
  context_snapshot JSONB,
  
  -- User response
  user_response VARCHAR(30) CHECK (user_response IN (
    'accepted',
    'rejected',
    'modified',
    'ignored',
    'pending'
  )),
  user_response_at TIMESTAMPTZ,
  user_modification TEXT,
  rejection_reason TEXT,
  
  -- If accepted, was it executed?
  was_executed BOOLEAN DEFAULT false,
  executed_at TIMESTAMPTZ,
  
  -- Outcome (filled later)
  outcome_measured BOOLEAN DEFAULT false,
  outcome_data JSONB,
  /*
  {
    "metric": "revenue",
    "expected_change": 0.15,
    "actual_change": 0.12,
    "success": true
  }
  */
  outcome_success BOOLEAN,
  outcome_measured_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_recommendations_tenant ON ai_recommendations(tenant_id);
CREATE INDEX idx_ai_recommendations_type ON ai_recommendations(tenant_id, recommendation_type);
CREATE INDEX idx_ai_recommendations_response ON ai_recommendations(tenant_id, user_response);
CREATE INDEX idx_ai_recommendations_date ON ai_recommendations(tenant_id, created_at DESC);

ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON ai_recommendations
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

-- AI trust scores (aggregated accuracy)
CREATE TABLE public.ai_trust_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Scope
  recommendation_type VARCHAR(50) NOT NULL,
  
  -- Period
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'quarterly', 'all_time')),
  period_start DATE,
  period_end DATE,
  
  -- Volume
  total_recommendations INT NOT NULL DEFAULT 0,
  accepted_count INT NOT NULL DEFAULT 0,
  rejected_count INT NOT NULL DEFAULT 0,
  executed_count INT NOT NULL DEFAULT 0,
  measured_count INT NOT NULL DEFAULT 0,
  
  -- Accuracy
  success_count INT NOT NULL DEFAULT 0,
  failure_count INT NOT NULL DEFAULT 0,
  accuracy_rate DECIMAL(5,4),  -- success / measured
  
  -- Acceptance
  acceptance_rate DECIMAL(5,4),  -- accepted / total
  
  -- Calibration (was AI confidence accurate?)
  avg_ai_confidence DECIMAL(5,4),
  calibration_error DECIMAL(5,4),  -- |accuracy - avg_confidence|
  is_overconfident BOOLEAN,
  is_underconfident BOOLEAN,
  
  -- Trust score (composite)
  trust_score DECIMAL(3,2) NOT NULL DEFAULT 0.5,
  /*
  Calculated as weighted combination of:
  - Accuracy rate (40%)
  - Acceptance rate (20%)
  - Calibration (20%)
  - Trend (20%)
  */
  
  -- Trend
  trust_trend VARCHAR(20) CHECK (trust_trend IN ('improving', 'stable', 'declining')),
  trend_velocity DECIMAL(5,4),  -- Rate of change
  
  -- Metadata
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, recommendation_type, period_type, period_start)
);

CREATE INDEX idx_ai_trust_scores_tenant ON ai_trust_scores(tenant_id);
CREATE INDEX idx_ai_trust_scores_type ON ai_trust_scores(tenant_id, recommendation_type);

ALTER TABLE ai_trust_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON ai_trust_scores
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

-- AI behavior config (dynamic adjustment)
CREATE TABLE public.ai_behavior_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Scope
  recommendation_type VARCHAR(50) NOT NULL,
  
  -- Confidence thresholds
  auto_execute_threshold DECIMAL(3,2) DEFAULT 0.9,  -- Above this, AI can act alone
  suggest_threshold DECIMAL(3,2) DEFAULT 0.5,       -- Above this, AI suggests
  suppress_threshold DECIMAL(3,2) DEFAULT 0.3,      -- Below this, AI stays silent
  
  -- Escalation
  escalate_to_human_threshold DECIMAL(3,2) DEFAULT 0.7,
  require_approval_above_impact INT,  -- $ impact requiring approval
  
  -- Rate limits
  max_auto_actions_per_day INT DEFAULT 10,
  max_recommendations_per_day INT DEFAULT 50,
  
  -- Adjustments based on trust
  trust_based_adjustment BOOLEAN DEFAULT true,
  current_trust_score DECIMAL(3,2),
  adjusted_auto_threshold DECIMAL(3,2),  -- Actual threshold after trust adjustment
  
  -- User preferences
  user_prefers_conservative BOOLEAN DEFAULT false,
  user_prefers_explanations BOOLEAN DEFAULT true,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  last_adjusted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(tenant_id, recommendation_type)
);

CREATE INDEX idx_ai_behavior_config_tenant ON ai_behavior_config(tenant_id);

ALTER TABLE ai_behavior_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON ai_behavior_config
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);

-- ============================================
-- HELPER FUNCTIONS FOR ADVANCED LAYERS
-- ============================================

-- Get AI context with trust scores
CREATE OR REPLACE FUNCTION get_ai_decision_context(
  p_tenant_id UUID,
  p_recommendation_type VARCHAR
)
RETURNS JSONB AS $$
DECLARE
  v_context JSONB;
BEGIN
  SELECT jsonb_build_object(
    'trust_score', (
      SELECT trust_score FROM ai_trust_scores
      WHERE tenant_id = p_tenant_id
        AND recommendation_type = p_recommendation_type
        AND period_type = 'all_time'
      LIMIT 1
    ),
    'behavior_config', (
      SELECT jsonb_build_object(
        'auto_execute_threshold', adjusted_auto_threshold,
        'suggest_threshold', suggest_threshold,
        'max_auto_actions', max_auto_actions_per_day
      )
      FROM ai_behavior_config
      WHERE tenant_id = p_tenant_id
        AND recommendation_type = p_recommendation_type
      LIMIT 1
    ),
    'active_constraints', (
      SELECT jsonb_agg(jsonb_build_object(
        'type', constraint_type,
        'name', name,
        'value', constraint_value,
        'utilization', current_utilization
      ))
      FROM constraints
      WHERE tenant_id = p_tenant_id
        AND is_active = true
        AND current_utilization > 0.7
    ),
    'recent_failures', (
      SELECT jsonb_agg(jsonb_build_object(
        'type', failure_type,
        'title', title,
        'root_cause', root_cause_category,
        'detected_at', detected_at
      ))
      FROM failure_events
      WHERE tenant_id = p_tenant_id
        AND detected_at > NOW() - INTERVAL '30 days'
      ORDER BY detected_at DESC
      LIMIT 5
    ),
    'active_experiments', (
      SELECT jsonb_agg(jsonb_build_object(
        'name', name,
        'type', experiment_type,
        'status', status
      ))
      FROM experiments
      WHERE tenant_id = p_tenant_id
        AND status = 'running'
    ),
    'relevant_lessons', (
      SELECT jsonb_agg(jsonb_build_object(
        'lesson', lesson,
        'type', lesson_type,
        'confidence', confidence
      ))
      FROM decision_lessons
      WHERE tenant_id = p_tenant_id
        AND is_active = true
        AND p_recommendation_type = ANY(applies_to_decision_types)
      ORDER BY confidence DESC
      LIMIT 5
    )
  ) INTO v_context;
  
  RETURN v_context;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check constraints before AI action
CREATE OR REPLACE FUNCTION check_constraints_for_action(
  p_tenant_id UUID,
  p_action_type VARCHAR,
  p_action_params JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_violations JSONB := '[]'::jsonb;
  v_constraint RECORD;
BEGIN
  FOR v_constraint IN 
    SELECT * FROM constraints
    WHERE tenant_id = p_tenant_id
      AND is_active = true
  LOOP
    -- Check each constraint against action
    -- This is simplified - real implementation would be more complex
    IF v_constraint.current_utilization >= 1.0 THEN
      v_violations := v_violations || jsonb_build_array(jsonb_build_object(
        'constraint_id', v_constraint.id,
        'constraint_type', v_constraint.constraint_type,
        'message', 'Constraint at capacity: ' || v_constraint.name
      ));
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'can_proceed', jsonb_array_length(v_violations) = 0,
    'violations', v_violations
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update trust score after outcome
CREATE OR REPLACE FUNCTION update_ai_trust_after_outcome(
  p_recommendation_id UUID,
  p_was_successful BOOLEAN
)
RETURNS VOID AS $$
DECLARE
  v_tenant_id UUID;
  v_rec_type VARCHAR;
BEGIN
  -- Get recommendation details
  SELECT tenant_id, recommendation_type 
  INTO v_tenant_id, v_rec_type
  FROM ai_recommendations
  WHERE id = p_recommendation_id;
  
  -- Update recommendation
  UPDATE ai_recommendations
  SET outcome_measured = true,
      outcome_success = p_was_successful,
      outcome_measured_at = NOW()
  WHERE id = p_recommendation_id;
  
  -- Recalculate trust score (simplified)
  UPDATE ai_trust_scores
  SET measured_count = measured_count + 1,
      success_count = success_count + CASE WHEN p_was_successful THEN 1 ELSE 0 END,
      failure_count = failure_count + CASE WHEN p_was_successful THEN 0 ELSE 1 END,
      accuracy_rate = (success_count + CASE WHEN p_was_successful THEN 1 ELSE 0 END)::DECIMAL / 
                      (measured_count + 1),
      trust_score = GREATEST(0.1, LEAST(0.95,
        0.4 * ((success_count + CASE WHEN p_was_successful THEN 1 ELSE 0 END)::DECIMAL / 
               (measured_count + 1)) +
        0.3 * acceptance_rate +
        0.3 * (1 - ABS(calibration_error))
      )),
      updated_at = NOW()
  WHERE tenant_id = v_tenant_id
    AND recommendation_type = v_rec_type
    AND period_type = 'all_time';
  
  -- Adjust behavior config based on new trust
  UPDATE ai_behavior_config
  SET current_trust_score = (
        SELECT trust_score FROM ai_trust_scores
        WHERE tenant_id = v_tenant_id
          AND recommendation_type = v_rec_type
          AND period_type = 'all_time'
      ),
      adjusted_auto_threshold = CASE
        WHEN current_trust_score < 0.5 THEN 0.95  -- Low trust = high bar
        WHEN current_trust_score < 0.7 THEN 0.85
        ELSE auto_execute_threshold
      END,
      last_adjusted_at = NOW()
  WHERE tenant_id = v_tenant_id
    AND recommendation_type = v_rec_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
