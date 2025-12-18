-- ============================================================
-- PATCH_03_rbac.sql
-- Purpose: Complete RBAC system with roles, permissions, and access control
-- Idempotent: Safe to run multiple times
-- ============================================================

-- ============================================================
-- STEP 1: Create RBAC Tables
-- ============================================================

-- 1.1 Permissions table - defines all available permissions
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  description TEXT,
  module TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1.2 Roles table - defines roles (system-wide or tenant-specific)
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- 1.3 Role-Permission mapping
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- 1.4 User-Role assignment (with optional store scope)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  scope_store_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id, role_id, scope_store_id)
);

-- 1.5 Optional: User-Store access for multi-store tenants
CREATE TABLE IF NOT EXISTS public.user_store_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id UUID NOT NULL,
  access_level TEXT DEFAULT 'full',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id, store_id)
);

-- ============================================================
-- STEP 2: Create Indexes for Performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_roles_tenant_id ON public.roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_roles_is_system ON public.roles(is_system);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON public.role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_tenant_id ON public.user_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_permissions_module ON public.permissions(module);
CREATE INDEX IF NOT EXISTS idx_permissions_key ON public.permissions(key);

-- ============================================================
-- STEP 3: Enable RLS on RBAC Tables
-- ============================================================

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_store_access ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 4: Create Helper Functions
-- ============================================================

-- 4.1 Check if user has a specific permission in a tenant
DROP FUNCTION IF EXISTS public.has_permission(UUID, UUID, TEXT);
CREATE OR REPLACE FUNCTION public.has_permission(
  p_user_id UUID,
  p_tenant_id UUID,
  p_permission_key TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_has_permission BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = p_user_id
      AND ur.tenant_id = p_tenant_id
      AND p.key = p_permission_key
  ) INTO v_has_permission;
  
  RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.2 Check if user is owner or admin of a tenant
DROP FUNCTION IF EXISTS public.is_tenant_admin(UUID, UUID);
CREATE OR REPLACE FUNCTION public.is_tenant_admin(
  p_user_id UUID,
  p_tenant_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_users tu
    WHERE tu.user_id = p_user_id
      AND tu.tenant_id = p_tenant_id
      AND tu.role IN ('owner', 'admin')
  ) INTO v_is_admin;
  
  RETURN v_is_admin;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.3 Get all permissions for a user in a tenant
DROP FUNCTION IF EXISTS public.get_user_permissions(UUID, UUID);
CREATE OR REPLACE FUNCTION public.get_user_permissions(
  p_user_id UUID,
  p_tenant_id UUID
) RETURNS TABLE(permission_key TEXT, module TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.key, p.module
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role_id = ur.role_id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = p_user_id
    AND ur.tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.4 Get user's roles in a tenant
DROP FUNCTION IF EXISTS public.get_user_roles(UUID, UUID);
CREATE OR REPLACE FUNCTION public.get_user_roles(
  p_user_id UUID,
  p_tenant_id UUID
) RETURNS TABLE(role_id UUID, role_name TEXT, scope_store_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT ur.role_id, r.name, ur.scope_store_id
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = p_user_id
    AND ur.tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 5: Create RLS Policies for RBAC Tables
-- ============================================================

-- 5.1 Permissions - readable by all authenticated users, writable by super admin only
DROP POLICY IF EXISTS permissions_select ON public.permissions;
CREATE POLICY permissions_select ON public.permissions
  FOR SELECT TO authenticated
  USING (true);

-- 5.2 Roles - system roles readable by all, tenant roles by tenant members
DROP POLICY IF EXISTS roles_select ON public.roles;
CREATE POLICY roles_select ON public.roles
  FOR SELECT TO authenticated
  USING (
    is_system = true
    OR tenant_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = roles.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS roles_insert ON public.roles;
CREATE POLICY roles_insert ON public.roles
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IS NOT NULL
    AND public.is_tenant_admin(auth.uid(), tenant_id)
  );

DROP POLICY IF EXISTS roles_update ON public.roles;
CREATE POLICY roles_update ON public.roles
  FOR UPDATE TO authenticated
  USING (
    tenant_id IS NOT NULL
    AND is_system = false
    AND public.is_tenant_admin(auth.uid(), tenant_id)
  );

DROP POLICY IF EXISTS roles_delete ON public.roles;
CREATE POLICY roles_delete ON public.roles
  FOR DELETE TO authenticated
  USING (
    tenant_id IS NOT NULL
    AND is_system = false
    AND public.is_tenant_admin(auth.uid(), tenant_id)
  );

-- 5.3 Role Permissions - manageable by tenant admins
DROP POLICY IF EXISTS role_permissions_select ON public.role_permissions;
CREATE POLICY role_permissions_select ON public.role_permissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = role_permissions.role_id
        AND (r.is_system = true OR r.tenant_id IS NULL OR EXISTS (
          SELECT 1 FROM public.tenant_users tu
          WHERE tu.tenant_id = r.tenant_id
            AND tu.user_id = auth.uid()
        ))
    )
  );

DROP POLICY IF EXISTS role_permissions_insert ON public.role_permissions;
CREATE POLICY role_permissions_insert ON public.role_permissions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = role_permissions.role_id
        AND r.tenant_id IS NOT NULL
        AND r.is_system = false
        AND public.is_tenant_admin(auth.uid(), r.tenant_id)
    )
  );

DROP POLICY IF EXISTS role_permissions_delete ON public.role_permissions;
CREATE POLICY role_permissions_delete ON public.role_permissions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.roles r
      WHERE r.id = role_permissions.role_id
        AND r.tenant_id IS NOT NULL
        AND r.is_system = false
        AND public.is_tenant_admin(auth.uid(), r.tenant_id)
    )
  );

-- 5.4 User Roles - manageable by tenant admins
DROP POLICY IF EXISTS user_roles_select ON public.user_roles;
CREATE POLICY user_roles_select ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_tenant_admin(auth.uid(), tenant_id)
  );

DROP POLICY IF EXISTS user_roles_insert ON public.user_roles;
CREATE POLICY user_roles_insert ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_tenant_admin(auth.uid(), tenant_id)
  );

DROP POLICY IF EXISTS user_roles_update ON public.user_roles;
CREATE POLICY user_roles_update ON public.user_roles
  FOR UPDATE TO authenticated
  USING (
    public.is_tenant_admin(auth.uid(), tenant_id)
  );

DROP POLICY IF EXISTS user_roles_delete ON public.user_roles;
CREATE POLICY user_roles_delete ON public.user_roles
  FOR DELETE TO authenticated
  USING (
    public.is_tenant_admin(auth.uid(), tenant_id)
  );

-- 5.5 User Store Access
DROP POLICY IF EXISTS user_store_access_select ON public.user_store_access;
CREATE POLICY user_store_access_select ON public.user_store_access
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_tenant_admin(auth.uid(), tenant_id)
  );

DROP POLICY IF EXISTS user_store_access_insert ON public.user_store_access;
CREATE POLICY user_store_access_insert ON public.user_store_access
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_tenant_admin(auth.uid(), tenant_id)
  );

DROP POLICY IF EXISTS user_store_access_update ON public.user_store_access;
CREATE POLICY user_store_access_update ON public.user_store_access
  FOR UPDATE TO authenticated
  USING (
    public.is_tenant_admin(auth.uid(), tenant_id)
  );

DROP POLICY IF EXISTS user_store_access_delete ON public.user_store_access;
CREATE POLICY user_store_access_delete ON public.user_store_access
  FOR DELETE TO authenticated
  USING (
    public.is_tenant_admin(auth.uid(), tenant_id)
  );

-- ============================================================
-- STEP 6: Seed Default Permissions
-- ============================================================

INSERT INTO public.permissions (key, description, module) VALUES
  -- Core
  ('tenant.manage', 'Manage tenant settings', 'core'),
  ('users.invite', 'Invite users to tenant', 'core'),
  ('users.roles.manage', 'Manage user roles', 'core'),
  ('stores.manage', 'Manage stores', 'core'),
  
  -- Products
  ('products.read', 'View products', 'products'),
  ('products.write', 'Create/edit products', 'products'),
  
  -- Orders
  ('orders.read', 'View orders', 'orders'),
  ('orders.write', 'Create/edit orders', 'orders'),
  ('orders.refund', 'Process refunds', 'orders'),
  ('orders.cancel', 'Cancel orders', 'orders'),
  
  -- Shipping/Fulfillment
  ('shipments.read', 'View shipments', 'shipping'),
  ('shipments.write', 'Create/edit shipments', 'shipping'),
  ('shipping_sla.manage', 'Manage shipping SLA rules', 'shipping'),
  ('returns.manage', 'Manage returns', 'shipping'),
  
  -- Support
  ('tickets.read', 'View support tickets', 'support'),
  ('tickets.write', 'Create/respond to tickets', 'support'),
  
  -- Marketing/Ads
  ('campaigns.read', 'View campaigns', 'marketing'),
  ('campaigns.write', 'Create/edit campaigns', 'marketing'),
  ('ads.manage_budget', 'Manage ad budgets', 'marketing'),
  ('insights.read', 'View marketing insights', 'marketing'),
  
  -- Finance
  ('finance.read', 'View financial data', 'finance'),
  ('finance.write', 'Create/edit financial records', 'finance'),
  ('unit_economics.read', 'View unit economics', 'finance'),
  
  -- AI/Generation
  ('ai.generate_ads', 'Generate AI ads', 'ai'),
  ('ai.generate_landing_pages', 'Generate AI landing pages', 'ai'),
  ('ai.read_insights', 'View AI insights', 'ai'),
  ('ai.write_insights', 'Create AI insights', 'ai')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- STEP 7: Seed Default System Roles
-- ============================================================

-- Create system roles (tenant_id = NULL, is_system = true)
INSERT INTO public.roles (tenant_id, name, description, is_system) VALUES
  (NULL, 'Owner', 'Full access to all features', true),
  (NULL, 'Admin', 'Administrative access', true),
  (NULL, 'CallCenter', 'Call center operations', true),
  (NULL, 'Operations', 'Operations and fulfillment', true),
  (NULL, 'Marketing', 'Marketing and campaigns', true),
  (NULL, 'Finance', 'Financial management', true),
  (NULL, 'Viewer', 'Read-only access', true)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- ============================================================
-- STEP 8: Assign Permissions to Default Roles
-- ============================================================

DO $$
DECLARE
  v_owner_id UUID;
  v_admin_id UUID;
  v_callcenter_id UUID;
  v_operations_id UUID;
  v_marketing_id UUID;
  v_finance_id UUID;
  v_viewer_id UUID;
BEGIN
  -- Get role IDs
  SELECT id INTO v_owner_id FROM public.roles WHERE name = 'Owner' AND is_system = true;
  SELECT id INTO v_admin_id FROM public.roles WHERE name = 'Admin' AND is_system = true;
  SELECT id INTO v_callcenter_id FROM public.roles WHERE name = 'CallCenter' AND is_system = true;
  SELECT id INTO v_operations_id FROM public.roles WHERE name = 'Operations' AND is_system = true;
  SELECT id INTO v_marketing_id FROM public.roles WHERE name = 'Marketing' AND is_system = true;
  SELECT id INTO v_finance_id FROM public.roles WHERE name = 'Finance' AND is_system = true;
  SELECT id INTO v_viewer_id FROM public.roles WHERE name = 'Viewer' AND is_system = true;

  -- Owner: ALL permissions
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_owner_id, id FROM public.permissions
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- Admin: ALL permissions except tenant.manage
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_admin_id, id FROM public.permissions WHERE key != 'tenant.manage'
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- CallCenter: orders.read, orders.write, tickets.read, tickets.write
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_callcenter_id, id FROM public.permissions 
  WHERE key IN ('orders.read', 'orders.write', 'tickets.read', 'tickets.write')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- Operations: orders, shipments, returns
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_operations_id, id FROM public.permissions 
  WHERE key IN ('orders.read', 'orders.write', 'orders.cancel', 'shipments.read', 'shipments.write', 'shipping_sla.manage', 'returns.manage')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- Marketing: campaigns, insights, AI
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_marketing_id, id FROM public.permissions 
  WHERE key IN ('campaigns.read', 'campaigns.write', 'ads.manage_budget', 'insights.read', 'ai.generate_ads', 'ai.generate_landing_pages', 'ai.read_insights')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- Finance: finance, unit_economics
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_finance_id, id FROM public.permissions 
  WHERE key IN ('finance.read', 'finance.write', 'unit_economics.read')
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  -- Viewer: all read permissions
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_viewer_id, id FROM public.permissions 
  WHERE key LIKE '%.read'
  ON CONFLICT (role_id, permission_id) DO NOTHING;

END $$;

-- ============================================================
-- STEP 9: Create Function to Assign Default Owner Role
-- ============================================================

DROP FUNCTION IF EXISTS public.assign_owner_role(UUID, UUID);
CREATE OR REPLACE FUNCTION public.assign_owner_role(
  p_tenant_id UUID,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_owner_role_id UUID;
BEGIN
  -- Get the system Owner role
  SELECT id INTO v_owner_role_id 
  FROM public.roles 
  WHERE name = 'Owner' AND is_system = true;

  -- Assign the role to the user
  INSERT INTO public.user_roles (tenant_id, user_id, role_id)
  VALUES (p_tenant_id, p_user_id, v_owner_role_id)
  ON CONFLICT (tenant_id, user_id, role_id, scope_store_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- VERIFICATION QUERIES (Run after patch to confirm)
-- ============================================================

-- Check tables exist:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' AND table_name IN ('permissions', 'roles', 'role_permissions', 'user_roles', 'user_store_access');

-- Check permissions count:
-- SELECT COUNT(*) as permission_count FROM public.permissions;

-- Check roles:
-- SELECT name, is_system FROM public.roles WHERE is_system = true;

-- Check role permissions:
-- SELECT r.name, COUNT(rp.id) as permission_count 
-- FROM public.roles r 
-- LEFT JOIN public.role_permissions rp ON rp.role_id = r.id 
-- WHERE r.is_system = true 
-- GROUP BY r.name;

-- Test has_permission function (replace UUIDs):
-- SELECT public.has_permission('user-uuid', 'tenant-uuid', 'orders.read');

-- Verify CallCenter cannot access finance:
-- SELECT public.has_permission('callcenter-user-uuid', 'tenant-uuid', 'finance.read');
-- Should return FALSE

-- ============================================================
-- HOW TO RUN:
-- 1. Open Supabase Dashboard -> SQL Editor
-- 2. Copy/Paste this entire file
-- 3. Click Run
-- ============================================================
