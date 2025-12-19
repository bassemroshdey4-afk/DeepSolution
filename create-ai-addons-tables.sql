-- AI Add-ons Catalog
CREATE TABLE IF NOT EXISTS ai_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  name_ar VARCHAR(100),
  description TEXT,
  description_ar TEXT,
  pricing_type VARCHAR(20) NOT NULL DEFAULT 'fixed', -- fixed, per_use, tiered
  price_amount DECIMAL(10,2) NOT NULL DEFAULT 0, -- قابل للتكوين
  billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly', -- monthly, yearly, one_time
  usage_limit_default INT DEFAULT 100, -- الحد الافتراضي للاستخدام
  trial_enabled BOOLEAN DEFAULT true,
  trial_usage_limit INT DEFAULT 50, -- حد الاستخدام في الفترة التجريبية
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant AI Subscriptions
CREATE TABLE IF NOT EXISTS tenant_ai_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ai_addon_id UUID NOT NULL REFERENCES ai_addons(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, expired, cancelled, trial
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  usage_limit INT NOT NULL DEFAULT 100,
  usage_remaining INT NOT NULL DEFAULT 100,
  is_trial BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, ai_addon_id)
);

-- AI Usage Logs
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ai_addon_id UUID NOT NULL REFERENCES ai_addons(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES tenant_ai_subscriptions(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL, -- e.g., 'generate_landing_page', 'ai_chat', 'image_analysis'
  units_used INT NOT NULL DEFAULT 1,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenant_ai_subscriptions_tenant ON tenant_ai_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_ai_subscriptions_addon ON tenant_ai_subscriptions(ai_addon_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_tenant ON ai_usage_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_addon ON ai_usage_logs(ai_addon_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created ON ai_usage_logs(created_at);

-- Seed default AI Add-ons (prices are configurable - set to 0 for now)
INSERT INTO ai_addons (name, name_ar, description, description_ar, pricing_type, price_amount, billing_cycle, usage_limit_default, trial_enabled, trial_usage_limit)
VALUES 
  ('Landing Page Generator', 'مولد صفحات الهبوط', 'AI-powered landing page generation from product images', 'توليد صفحات هبوط بالذكاء الاصطناعي من صور المنتجات', 'fixed', 0, 'monthly', 50, true, 10),
  ('AI Assistant Pro', 'المساعد الذكي المتقدم', 'Advanced AI assistant with business insights', 'مساعد ذكي متقدم مع رؤى الأعمال', 'fixed', 0, 'monthly', 500, true, 100),
  ('Image Analysis', 'تحليل الصور', 'AI image analysis and optimization', 'تحليل وتحسين الصور بالذكاء الاصطناعي', 'per_use', 0, 'monthly', 100, true, 20),
  ('Campaign Optimizer', 'محسن الحملات', 'AI-driven campaign optimization suggestions', 'اقتراحات تحسين الحملات بالذكاء الاصطناعي', 'fixed', 0, 'monthly', 30, true, 5),
  ('Content Writer', 'كاتب المحتوى', 'AI content generation for products and ads', 'توليد محتوى بالذكاء الاصطناعي للمنتجات والإعلانات', 'fixed', 0, 'monthly', 200, true, 50)
ON CONFLICT DO NOTHING;
