import { supabaseAdmin, type Tables, type InsertTables, type UpdateTables } from "./supabase";

// ==================== Tenants ====================

export async function createTenant(data: {
  name: string;
  slug: string;
  country?: string;
  currency?: string;
  language?: string;
  timezone?: string;
}) {
  const { data: tenant, error } = await supabaseAdmin
    .from("tenants")
    .insert({
      name: data.name,
      slug: data.slug,
      country: data.country || null,
      currency: data.currency || null,
      language: data.language || null,
      timezone: data.timezone || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return tenant.id;
}

export async function getTenantById(tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .single();

  if (error) return undefined;
  return data;
}

export async function getTenantBySlug(slug: string) {
  const { data, error } = await supabaseAdmin
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) return undefined;
  return data;
}

export async function updateTenant(tenantId: string, data: UpdateTables<"tenants">) {
  const { error } = await supabaseAdmin
    .from("tenants")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", tenantId);

  if (error) throw new Error(error.message);
}

// ==================== Profiles ====================

export async function getOrCreateProfile(userId: string, email?: string, name?: string) {
  // Try to get existing profile
  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (existing) return existing;

  // Create new profile
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .insert({
      id: userId,
      email: email || null,
      name: name || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return profile;
}

export async function updateProfile(userId: string, data: UpdateTables<"profiles">) {
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) throw new Error(error.message);
}

// ==================== Tenant Users ====================

export async function addUserToTenant(tenantId: string, userId: string, role: "owner" | "admin" | "member" = "member") {
  const { error } = await supabaseAdmin
    .from("tenant_users")
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      role,
    });

  if (error && !error.message.includes("duplicate")) {
    throw new Error(error.message);
  }
}

export async function getUserTenants(userId: string) {
  // Get tenant_users first
  const { data: tenantUsers, error: tuError } = await supabaseAdmin
    .from("tenant_users")
    .select("tenant_id, role")
    .eq("user_id", userId);

  if (tuError || !tenantUsers || tenantUsers.length === 0) return [];

  // Get tenant details for each tenant_id
  const tenantIds = tenantUsers.map(tu => tu.tenant_id);
  const { data: tenants, error: tError } = await supabaseAdmin
    .from("tenants")
    .select("*")
    .in("id", tenantIds);

  if (tError) return [];

  // Combine the data
  return tenantUsers.map(tu => ({
    tenant_id: tu.tenant_id,
    role: tu.role,
    tenants: tenants?.find(t => t.id === tu.tenant_id) || null,
  }));
}

export async function getUserDefaultTenant(userId: string) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("default_tenant_id")
    .eq("id", userId)
    .single();

  if (profile?.default_tenant_id) {
    return getTenantById(profile.default_tenant_id);
  }

  // Get first tenant user belongs to
  const tenants = await getUserTenants(userId);
  if (tenants.length > 0) {
    return tenants[0].tenants as unknown as Tables<"tenants">;
  }

  return undefined;
}

// ==================== Subscriptions ====================

export async function startTenantTrial(tenantId: string) {
  const trialDays = 7;
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + trialDays);
  
  // Insert or update subscription record
  const { error: subError } = await supabaseAdmin
    .from("subscriptions")
    .upsert({
      tenant_id: tenantId,
      plan: "trial",
      status: "trial",
      trial_ends_at: trialEnd.toISOString(),
      current_period_start: new Date().toISOString(),
      current_period_end: trialEnd.toISOString(),
    }, { onConflict: "tenant_id" });

  if (subError) throw new Error(subError.message);
  
  // Note: tenants table doesn't have trial_ends_at or status columns
  // Trial info is stored in subscriptions table only
  
  return true;
}

export async function getTenantSubscription(tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) return undefined;
  return data;
}

export async function isTrialActive(tenantId: string) {
  const { data, error } = await supabaseAdmin.rpc("is_tenant_in_trial", {
    check_tenant_id: tenantId,
  });

  if (error) return false;
  return data;
}

// ==================== Products ====================

export async function getProductsByTenant(tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return data;
}

export async function getProductById(productId: string, tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("tenant_id", tenantId)
    .single();

  if (error) return undefined;
  return data;
}

export async function createProduct(data: InsertTables<"products">) {
  const { data: product, error } = await supabaseAdmin
    .from("products")
    .insert(data)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return product.id;
}

export async function updateProduct(productId: string, tenantId: string, data: UpdateTables<"products">) {
  const { error } = await supabaseAdmin
    .from("products")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", productId)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);
}

export async function deleteProduct(productId: string, tenantId: string) {
  const { error } = await supabaseAdmin
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);
}

// ==================== Orders ====================

export async function getOrdersByTenant(tenantId: string, limit = 100) {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return data;
}

export async function getOrderById(orderId: string, tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("tenant_id", tenantId)
    .single();

  if (error) return undefined;
  return data;
}

export async function getOrderWithItems(orderId: string, tenantId: string) {
  const order = await getOrderById(orderId, tenantId);
  if (!order) return undefined;

  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("*")
    .eq("order_id", orderId)
    .eq("tenant_id", tenantId);

  return { ...order, items: items || [] };
}

export async function createOrder(data: InsertTables<"orders">) {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .insert(data)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return order.id;
}

export async function createOrderItem(data: InsertTables<"order_items">) {
  const { data: item, error } = await supabaseAdmin
    .from("order_items")
    .insert(data)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return item.id;
}

export async function updateOrder(orderId: string, tenantId: string, data: UpdateTables<"orders">) {
  const { error } = await supabaseAdmin
    .from("orders")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);
}

// ==================== Campaigns ====================

export async function getCampaignsByTenant(tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from("campaigns")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return data;
}

export async function getCampaignById(campaignId: string, tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("tenant_id", tenantId)
    .single();

  if (error) return undefined;
  return data;
}

export async function createCampaign(data: InsertTables<"campaigns">) {
  const { data: campaign, error } = await supabaseAdmin
    .from("campaigns")
    .insert(data)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return campaign.id;
}

export async function updateCampaign(campaignId: string, tenantId: string, data: UpdateTables<"campaigns">) {
  const { error } = await supabaseAdmin
    .from("campaigns")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", campaignId)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);
}

export async function deleteCampaign(campaignId: string, tenantId: string) {
  const { error } = await supabaseAdmin
    .from("campaigns")
    .delete()
    .eq("id", campaignId)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);
}

// ==================== Events ====================

export async function trackEvent(data: InsertTables<"events">) {
  const { error } = await supabaseAdmin
    .from("events")
    .insert({
      ...data,
      occurred_at: data.occurred_at || new Date().toISOString(),
    });

  if (error) throw new Error(error.message);
}

export async function getEventsByTenant(tenantId: string, limit = 100) {
  const { data, error } = await supabaseAdmin
    .from("events")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return data;
}

// ==================== Stats ====================

export async function getTenantStats(tenantId: string) {
  const [products, orders, campaigns] = await Promise.all([
    supabaseAdmin.from("products").select("id", { count: "exact" }).eq("tenant_id", tenantId),
    supabaseAdmin.from("orders").select("id, total_amount", { count: "exact" }).eq("tenant_id", tenantId),
    supabaseAdmin.from("campaigns").select("id, spent, revenue", { count: "exact" }).eq("tenant_id", tenantId),
  ]);

  const totalRevenue = orders.data?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
  const totalSpent = campaigns.data?.reduce((sum, c) => sum + (c.spent || 0), 0) || 0;
  const campaignRevenue = campaigns.data?.reduce((sum, c) => sum + (c.revenue || 0), 0) || 0;

  return {
    productsCount: products.count || 0,
    ordersCount: orders.count || 0,
    campaignsCount: campaigns.count || 0,
    totalRevenue,
    totalSpent,
    roas: totalSpent > 0 ? campaignRevenue / totalSpent : 0,
  };
}


// ==================== Landing Pages ====================

export async function getLandingPagesByTenant(tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from("generated_content")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("content_type", "landing_page")
    .order("created_at", { ascending: false });

  if (error) return [];
  return data;
}

export async function getLandingPageById(pageId: string, tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from("generated_content")
    .select("*")
    .eq("id", pageId)
    .eq("tenant_id", tenantId)
    .eq("content_type", "landing_page")
    .single();

  if (error) return undefined;
  return data;
}

export async function createLandingPage(data: {
  tenantId: string;
  productId?: string;
  title: string;
  content: Record<string, unknown>;
  imageUrls?: string[];
  aiPrompt?: string;
  status?: string;
}) {
  const { data: page, error } = await supabaseAdmin
    .from("generated_content")
    .insert({
      tenant_id: data.tenantId,
      content_type: "landing_page",
      title: data.title,
      content: data.content,
      status: data.status || "draft",
      metadata: {
        product_id: data.productId,
        image_urls: data.imageUrls,
        ai_prompt: data.aiPrompt,
      },
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return page.id;
}

export async function updateLandingPage(pageId: string, tenantId: string, data: Record<string, unknown>) {
  const { error } = await supabaseAdmin
    .from("generated_content")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", pageId)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);
}

export async function deleteLandingPage(pageId: string, tenantId: string) {
  const { error } = await supabaseAdmin
    .from("generated_content")
    .delete()
    .eq("id", pageId)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);
}

// ==================== AI Conversations ====================

export async function getConversationsByTenant(tenantId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from("ai_generation_jobs")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("job_type", "conversation")
    .order("created_at", { ascending: false });

  if (error) return [];
  return data;
}

export async function getConversationById(conversationId: string, tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from("ai_generation_jobs")
    .select("*")
    .eq("id", conversationId)
    .eq("tenant_id", tenantId)
    .eq("job_type", "conversation")
    .single();

  if (error) return undefined;
  
  // Parse messages from output field
  return {
    ...data,
    messages: data.output?.messages || [],
  };
}

export async function createConversation(data: {
  tenantId: string;
  userId: string;
  title: string;
  messages: Array<{ role: string; content: string; timestamp: number }>;
}) {
  const { data: conversation, error } = await supabaseAdmin
    .from("ai_generation_jobs")
    .insert({
      tenant_id: data.tenantId,
      job_type: "conversation",
      status: "completed",
      input: { title: data.title, user_id: data.userId },
      output: { messages: data.messages },
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return conversation.id;
}

export async function updateConversation(
  conversationId: string,
  tenantId: string,
  data: { messages: Array<{ role: string; content: string; timestamp: number }> }
) {
  const { error } = await supabaseAdmin
    .from("ai_generation_jobs")
    .update({
      output: { messages: data.messages },
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(error.message);
}


// ==================== User Management ====================

export async function getUserByOpenId(openId: string) {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("open_id", openId)
    .single();

  if (error || !profile) return undefined;

  // Get user's default tenant using profile.id (not openId)
  const tenants = await getUserTenants(profile.id);
  const defaultTenant = tenants.length > 0 ? tenants[0] : null;

  return {
    id: profile.id,
    openId: profile.open_id, // Use open_id from profile, not profile.id
    name: profile.name,
    email: profile.email,
    avatarUrl: profile.avatar_url,
    tenantId: defaultTenant?.tenant_id || null,
    role: defaultTenant?.role || null,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
}

export async function upsertUser(data: {
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  lastSignedIn?: Date;
}) {
  // First check if user exists by open_id
  const { data: existingUser } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("open_id", data.openId)
    .single();

  if (existingUser) {
    // Update existing user
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        name: data.name || null,
        email: data.email || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingUser.id);

    if (error) throw new Error(error.message);
    return;
  }

  // Insert new user with auto-generated UUID
  const { error } = await supabaseAdmin
    .from("profiles")
    .insert({
      id: crypto.randomUUID(),
      open_id: data.openId,
      name: data.name || null,
      email: data.email || null,
    });

  if (error && !error.message.includes("duplicate")) {
    throw new Error(error.message);
  }
}


// ==================== RBAC Functions ====================

export async function hasPermission(userId: string, tenantId: string, permissionKey: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('has_permission', {
    p_user_id: userId,
    p_tenant_id: tenantId,
    p_permission_key: permissionKey
  });
  
  if (error) return false;
  return data === true;
}

export async function isTenantAdmin(userId: string, tenantId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('is_tenant_admin', {
    p_user_id: userId,
    p_tenant_id: tenantId
  });
  
  if (error) return false;
  return data === true;
}

export async function getUserPermissions(userId: string, tenantId: string) {
  const { data, error } = await supabaseAdmin.rpc('get_user_permissions', {
    p_user_id: userId,
    p_tenant_id: tenantId
  });
  
  if (error) return [];
  return data || [];
}

export async function getUserRolesInTenant(userId: string, tenantId: string) {
  const { data, error } = await supabaseAdmin.rpc('get_user_roles', {
    p_user_id: userId,
    p_tenant_id: tenantId
  });
  
  if (error) return [];
  return data || [];
}

export async function assignOwnerRole(tenantId: string, userId: string) {
  const { error } = await supabaseAdmin.rpc('assign_owner_role', {
    p_tenant_id: tenantId,
    p_user_id: userId
  });
  
  if (error) throw new Error(error.message);
}

export async function getAllPermissions() {
  const { data, error } = await supabaseAdmin
    .from('permissions')
    .select('*')
    .order('module', { ascending: true });
  
  if (error) throw new Error(error.message);
  return data;
}

export async function getSystemRoles() {
  const { data, error } = await supabaseAdmin
    .from('roles')
    .select('*, role_permissions(permission_id, permissions(key, description, module))')
    .eq('is_system', true);
  
  if (error) throw new Error(error.message);
  return data;
}

export async function getTenantRoles(tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from('roles')
    .select('*, role_permissions(permission_id, permissions(key, description, module))')
    .or(`tenant_id.eq.${tenantId},is_system.eq.true`);
  
  if (error) throw new Error(error.message);
  return data;
}

export async function createTenantRole(tenantId: string, name: string, description: string | null, permissionIds: string[]) {
  // Create role
  const { data: role, error: roleError } = await supabaseAdmin
    .from('roles')
    .insert({
      tenant_id: tenantId,
      name,
      description,
      is_system: false
    })
    .select()
    .single();
  
  if (roleError) throw new Error(roleError.message);
  
  // Assign permissions
  if (permissionIds.length > 0) {
    const rolePermissions = permissionIds.map(permissionId => ({
      role_id: role.id,
      permission_id: permissionId
    }));
    
    const { error: permError } = await supabaseAdmin
      .from('role_permissions')
      .insert(rolePermissions);
    
    if (permError) throw new Error(permError.message);
  }
  
  return role;
}

export async function assignRoleToUser(tenantId: string, userId: string, roleId: string, scopeStoreId?: string) {
  const { error } = await supabaseAdmin
    .from('user_roles')
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      role_id: roleId,
      scope_store_id: scopeStoreId || null
    });
  
  if (error && !error.message.includes('duplicate')) {
    throw new Error(error.message);
  }
}

export async function removeRoleFromUser(tenantId: string, userId: string, roleId: string) {
  const { error } = await supabaseAdmin
    .from('user_roles')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('role_id', roleId);
  
  if (error) throw new Error(error.message);
}

export async function getTenantUsers(tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from('tenant_users')
    .select(`
      *,
      profiles(id, name, email, avatar_url),
      user_roles(role_id, roles(name, is_system))
    `)
    .eq('tenant_id', tenantId);
  
  if (error) throw new Error(error.message);
  return data;
}


// ==================== Payment Methods ====================

export async function getPaymentMethods(tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from('payment_methods')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('display_order', { ascending: true });
  
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getPaymentMethodById(tenantId: string, methodId: string) {
  const { data, error } = await supabaseAdmin
    .from('payment_methods')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', methodId)
    .single();
  
  if (error) return null;
  return data;
}

export async function getEnabledPaymentMethods(tenantId: string) {
  const { data, error } = await supabaseAdmin
    .from('payment_methods')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_enabled', true)
    .order('display_order', { ascending: true });
  
  if (error) throw new Error(error.message);
  return data || [];
}

export async function createPaymentMethod(tenantId: string, data: {
  provider: string;
  name: string;
  name_ar?: string;
  description?: string;
  description_ar?: string;
  is_enabled?: boolean;
  is_default?: boolean;
  config?: Record<string, unknown>;
  supported_currencies?: string[];
  min_amount?: number;
  max_amount?: number;
  fee_type?: string;
  fee_percentage?: number;
  fee_fixed?: number;
  display_order?: number;
  icon_url?: string;
}) {
  const { data: method, error } = await supabaseAdmin
    .from('payment_methods')
    .insert({
      tenant_id: tenantId,
      ...data
    })
    .select()
    .single();
  
  if (error) throw new Error(error.message);
  return method;
}

export async function updatePaymentMethod(tenantId: string, methodId: string, data: {
  name?: string;
  name_ar?: string;
  description?: string;
  description_ar?: string;
  is_enabled?: boolean;
  is_default?: boolean;
  config?: Record<string, unknown>;
  supported_currencies?: string[];
  min_amount?: number;
  max_amount?: number;
  fee_type?: string;
  fee_percentage?: number;
  fee_fixed?: number;
  display_order?: number;
  icon_url?: string;
}) {
  const { error } = await supabaseAdmin
    .from('payment_methods')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', methodId);
  
  if (error) throw new Error(error.message);
}

export async function deletePaymentMethod(tenantId: string, methodId: string) {
  const { error } = await supabaseAdmin
    .from('payment_methods')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', methodId);
  
  if (error) throw new Error(error.message);
}

export async function setDefaultPaymentMethod(tenantId: string, methodId: string) {
  // First, unset all defaults
  await supabaseAdmin
    .from('payment_methods')
    .update({ is_default: false })
    .eq('tenant_id', tenantId);
  
  // Then set the new default
  const { error } = await supabaseAdmin
    .from('payment_methods')
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', methodId);
  
  if (error) throw new Error(error.message);
}

// ==================== Payment Transactions ====================

export async function createPaymentTransaction(tenantId: string, data: {
  order_id?: string;
  customer_id?: string;
  payment_method_id?: string;
  external_id?: string;
  amount: number;
  currency: string;
  fee_amount?: number;
  net_amount?: number;
  status?: string;
  type?: string;
  provider?: string;
  provider_response?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
}) {
  const { data: transaction, error } = await supabaseAdmin
    .from('payment_transactions')
    .insert({
      tenant_id: tenantId,
      ...data
    })
    .select()
    .single();
  
  if (error) throw new Error(error.message);
  return transaction;
}

export async function getPaymentTransactions(tenantId: string, filters?: {
  status?: string;
  order_id?: string;
  customer_id?: string;
  limit?: number;
  offset?: number;
}) {
  let query = supabaseAdmin
    .from('payment_transactions')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.order_id) query = query.eq('order_id', filters.order_id);
  if (filters?.customer_id) query = query.eq('customer_id', filters.customer_id);
  if (filters?.limit) query = query.limit(filters.limit);
  if (filters?.offset) query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
  
  const { data, error } = await query;
  
  if (error) throw new Error(error.message);
  return data || [];
}

export async function updatePaymentTransaction(tenantId: string, transactionId: string, data: {
  status?: string;
  external_id?: string;
  provider_response?: Record<string, unknown>;
  error_message?: string;
  error_code?: string;
  completed_at?: string;
}) {
  const { error } = await supabaseAdmin
    .from('payment_transactions')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('id', transactionId);
  
  if (error) throw new Error(error.message);
}

// ==================== Payment Proofs ====================

export async function createPaymentProof(tenantId: string, data: {
  transaction_id?: string;
  order_id?: string;
  customer_id?: string;
  proof_type: string;
  proof_url?: string;
  reference_number?: string;
  sender_phone?: string;
  sender_name?: string;
  amount_claimed?: number;
  currency?: string;
  notes?: string;
}) {
  const { data: proof, error } = await supabaseAdmin
    .from('payment_proofs')
    .insert({
      tenant_id: tenantId,
      ...data
    })
    .select()
    .single();
  
  if (error) throw new Error(error.message);
  return proof;
}

export async function getPaymentProofs(tenantId: string, filters?: {
  status?: string;
  order_id?: string;
  limit?: number;
  offset?: number;
}) {
  let query = supabaseAdmin
    .from('payment_proofs')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.order_id) query = query.eq('order_id', filters.order_id);
  if (filters?.limit) query = query.limit(filters.limit);
  if (filters?.offset) query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
  
  const { data, error } = await query;
  
  if (error) throw new Error(error.message);
  return data || [];
}

export async function reviewPaymentProof(tenantId: string, proofId: string, data: {
  status: 'approved' | 'rejected';
  reviewed_by: string;
  rejection_reason?: string;
}) {
  const { error } = await supabaseAdmin
    .from('payment_proofs')
    .update({
      status: data.status,
      reviewed_by: data.reviewed_by,
      reviewed_at: new Date().toISOString(),
      rejection_reason: data.rejection_reason || null,
      updated_at: new Date().toISOString()
    })
    .eq('tenant_id', tenantId)
    .eq('id', proofId);
  
  if (error) throw new Error(error.message);
}

// ==================== Webhook Events ====================

export async function createWebhookEvent(data: {
  tenant_id?: string;
  provider: string;
  event_type: string;
  event_id?: string;
  payload: Record<string, unknown>;
  headers?: Record<string, unknown>;
  signature?: string;
  is_verified?: boolean;
}) {
  const { data: event, error } = await supabaseAdmin
    .from('webhook_events')
    .insert(data)
    .select()
    .single();
  
  if (error) throw new Error(error.message);
  return event;
}

export async function markWebhookProcessed(eventId: string, error_message?: string) {
  const { error } = await supabaseAdmin
    .from('webhook_events')
    .update({
      is_processed: true,
      processed_at: new Date().toISOString(),
      error_message: error_message || null
    })
    .eq('id', eventId);
  
  if (error) throw new Error(error.message);
}

export async function getUnprocessedWebhooks(provider?: string, limit: number = 100) {
  let query = supabaseAdmin
    .from('webhook_events')
    .select('*')
    .eq('is_processed', false)
    .order('created_at', { ascending: true })
    .limit(limit);
  
  if (provider) query = query.eq('provider', provider);
  
  const { data, error } = await query;
  
  if (error) throw new Error(error.message);
  return data || [];
}
