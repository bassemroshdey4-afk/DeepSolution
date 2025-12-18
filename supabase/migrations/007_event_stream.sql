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
