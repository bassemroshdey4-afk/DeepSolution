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
