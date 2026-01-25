-- =====================================================
-- DeepSolution Multi-Tenant Auth Schema
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. TENANTS TABLE
-- Each tenant represents a workspace/company
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT UNIQUE, -- Optional custom domain
    logo_url TEXT,
    settings JSONB DEFAULT '{}',
    subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'suspended', 'cancelled')),
    trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PROFILES TABLE
-- User profiles linked to Supabase Auth
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    default_tenant_id UUID REFERENCES public.tenants(id),
    locale TEXT DEFAULT 'ar',
    timezone TEXT DEFAULT 'Africa/Cairo',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TENANT_USERS TABLE
-- Junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS public.tenant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    invited_by UUID REFERENCES public.profiles(id),
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

-- 4. ADD tenant_id TO EXISTING TABLES
-- Products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON public.products(tenant_id);

-- Orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant ON public.orders(tenant_id);

-- Inventory
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS idx_inventory_tenant ON public.inventory(tenant_id);

-- Shipments
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS idx_shipments_tenant ON public.shipments(tenant_id);

-- Campaigns
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON public.campaigns(tenant_id);

-- AI Usage Logs
ALTER TABLE public.ai_usage_logs ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_tenant ON public.ai_usage_logs(tenant_id);

-- =====================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to get user's tenant IDs
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids()
RETURNS UUID[] AS $$
BEGIN
    RETURN ARRAY(
        SELECT tenant_id 
        FROM public.tenant_users 
        WHERE user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user belongs to tenant
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(check_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.tenant_users 
        WHERE user_id = auth.uid() 
        AND tenant_id = check_tenant_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 6. RLS POLICIES
-- =====================================================

-- TENANTS: Users can only see tenants they belong to
DROP POLICY IF EXISTS "Users can view their tenants" ON public.tenants;
CREATE POLICY "Users can view their tenants" ON public.tenants
    FOR SELECT USING (id = ANY(public.get_user_tenant_ids()));

DROP POLICY IF EXISTS "Users can create tenants" ON public.tenants;
CREATE POLICY "Users can create tenants" ON public.tenants
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Owners can update their tenants" ON public.tenants;
CREATE POLICY "Owners can update their tenants" ON public.tenants
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users 
            WHERE tenant_id = tenants.id 
            AND user_id = auth.uid() 
            AND role = 'owner'
        )
    );

-- PROFILES: Users can only see and edit their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (id = auth.uid());

-- TENANT_USERS: Users can see members of their tenants
DROP POLICY IF EXISTS "Users can view tenant members" ON public.tenant_users;
CREATE POLICY "Users can view tenant members" ON public.tenant_users
    FOR SELECT USING (tenant_id = ANY(public.get_user_tenant_ids()));

DROP POLICY IF EXISTS "Users can join tenants" ON public.tenant_users;
CREATE POLICY "Users can join tenants" ON public.tenant_users
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- PRODUCTS: Tenant isolation
DROP POLICY IF EXISTS "Tenant isolation for products" ON public.products;
CREATE POLICY "Tenant isolation for products" ON public.products
    FOR ALL USING (public.user_belongs_to_tenant(tenant_id));

-- ORDERS: Tenant isolation
DROP POLICY IF EXISTS "Tenant isolation for orders" ON public.orders;
CREATE POLICY "Tenant isolation for orders" ON public.orders
    FOR ALL USING (public.user_belongs_to_tenant(tenant_id));

-- INVENTORY: Tenant isolation
DROP POLICY IF EXISTS "Tenant isolation for inventory" ON public.inventory;
CREATE POLICY "Tenant isolation for inventory" ON public.inventory
    FOR ALL USING (public.user_belongs_to_tenant(tenant_id));

-- SHIPMENTS: Tenant isolation
DROP POLICY IF EXISTS "Tenant isolation for shipments" ON public.shipments;
CREATE POLICY "Tenant isolation for shipments" ON public.shipments
    FOR ALL USING (public.user_belongs_to_tenant(tenant_id));

-- CAMPAIGNS: Tenant isolation
DROP POLICY IF EXISTS "Tenant isolation for campaigns" ON public.campaigns;
CREATE POLICY "Tenant isolation for campaigns" ON public.campaigns
    FOR ALL USING (public.user_belongs_to_tenant(tenant_id));

-- AI_USAGE_LOGS: Tenant isolation
DROP POLICY IF EXISTS "Tenant isolation for ai_usage_logs" ON public.ai_usage_logs;
CREATE POLICY "Tenant isolation for ai_usage_logs" ON public.ai_usage_logs
    FOR ALL USING (public.user_belongs_to_tenant(tenant_id));

-- =====================================================
-- 7. TRIGGER: Auto-create profile on signup
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 8. INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_profiles_default_tenant ON public.profiles(default_tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user ON public.tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON public.tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON public.tenants(domain);

-- =====================================================
-- DONE! Run this script in Supabase SQL Editor
-- =====================================================
