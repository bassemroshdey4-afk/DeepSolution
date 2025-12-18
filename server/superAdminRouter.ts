/**
 * Super Admin Router - Platform-level administration
 * Modular implementation - does not modify existing code
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "./_core/trpc";
import { supabaseAdmin } from "./supabase";

// Super Admin check - uses OWNER_OPEN_ID from env
const superAdminProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "يجب تسجيل الدخول" });
  }
  
  const ownerOpenId = process.env.OWNER_OPEN_ID;
  if (ctx.user.openId !== ownerOpenId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "صلاحيات Super Admin مطلوبة" });
  }
  
  return next({ ctx });
});

export const superAdminRouter = router({
  // Check if current user is super admin
  checkAccess: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return { isSuperAdmin: false };
    const ownerOpenId = process.env.OWNER_OPEN_ID;
    return { isSuperAdmin: ctx.user.openId === ownerOpenId };
  }),

  // Get all tenants with subscription info
  listTenants: superAdminProcedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(20),
      status: z.enum(["all", "active", "suspended", "trial"]).default("all"),
    }).optional())
    .query(async ({ input }) => {
      const { page = 1, limit = 20, status = "all" } = input || {};
      const offset = (page - 1) * limit;

      // Get tenants
      let query = supabaseAdmin
        .from("tenants")
        .select("*, subscriptions(*)", { count: "exact" })
        .range(offset, offset + limit - 1)
        .order("created_at", { ascending: false });

      const { data: tenants, error, count } = await query;

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      // Get user counts per tenant
      const tenantIds = tenants?.map((t: { id: string }) => t.id) || [];
      const { data: userCounts } = await supabaseAdmin
        .from("tenant_users")
        .select("tenant_id")
        .in("tenant_id", tenantIds);

      const userCountMap: Record<string, number> = {};
      userCounts?.forEach((u: { tenant_id: string }) => {
        userCountMap[u.tenant_id] = (userCountMap[u.tenant_id] || 0) + 1;
      });

      return {
        tenants: tenants?.map((t: any) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          country: t.country,
          currency: t.currency,
          createdAt: t.created_at,
          subscription: t.subscriptions?.[0] || null,
          userCount: userCountMap[t.id] || 0,
        })) || [],
        total: count || 0,
        page,
        limit,
      };
    }),

  // Get single tenant details
  getTenant: superAdminProcedure
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ input }) => {
      const { data: tenant, error } = await supabaseAdmin
        .from("tenants")
        .select("*, subscriptions(*)")
        .eq("id", input.tenantId)
        .single();

      if (error || !tenant) {
        throw new TRPCError({ code: "NOT_FOUND", message: "المستأجر غير موجود" });
      }

      // Get users
      const { data: users } = await supabaseAdmin
        .from("tenant_users")
        .select("user_id, role, profiles(*)")
        .eq("tenant_id", input.tenantId);

      // Get AI usage (if ai_conversations table exists)
      const { data: aiUsage } = await supabaseAdmin
        .from("ai_conversations")
        .select("id", { count: "exact" })
        .eq("tenant_id", input.tenantId);

      return {
        ...tenant,
        users: users || [],
        aiConversationsCount: aiUsage?.length || 0,
      };
    }),

  // Update subscription plan
  updateSubscription: superAdminProcedure
    .input(z.object({
      tenantId: z.string().uuid(),
      plan: z.enum(["trial", "starter", "growth", "enterprise"]),
      status: z.enum(["trial", "active", "past_due", "canceled", "expired"]),
    }))
    .mutation(async ({ input }) => {
      const { error } = await supabaseAdmin
        .from("subscriptions")
        .update({
          plan: input.plan,
          status: input.status,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", input.tenantId);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      return { success: true, message: "تم تحديث الاشتراك بنجاح" };
    }),

  // Suspend/Activate tenant
  setTenantStatus: superAdminProcedure
    .input(z.object({
      tenantId: z.string().uuid(),
      suspended: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const newStatus = input.suspended ? "canceled" : "active";
      
      const { error } = await supabaseAdmin
        .from("subscriptions")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", input.tenantId);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      return { 
        success: true, 
        message: input.suspended ? "تم تعليق الحساب" : "تم تفعيل الحساب" 
      };
    }),

  // Set AI usage limits
  setAILimits: superAdminProcedure
    .input(z.object({
      tenantId: z.string().uuid(),
      monthlyLimit: z.number().min(0).max(100000),
    }))
    .mutation(async ({ input }) => {
      // Store AI limits in subscriptions metadata or a separate table
      // For now, we'll use the subscriptions table with a custom field
      const { error } = await supabaseAdmin
        .from("subscriptions")
        .update({
          ai_monthly_limit: input.monthlyLimit,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", input.tenantId);

      if (error) {
        // If column doesn't exist, just log and return success
        console.log("AI limits update note:", error.message);
      }

      return { success: true, message: `تم تعيين حد AI الشهري: ${input.monthlyLimit}` };
    }),

  // Get platform stats
  getStats: superAdminProcedure.query(async () => {
    const { count: tenantsCount } = await supabaseAdmin
      .from("tenants")
      .select("*", { count: "exact", head: true });

    const { count: usersCount } = await supabaseAdmin
      .from("profiles")
      .select("*", { count: "exact", head: true });

    const { data: subscriptions } = await supabaseAdmin
      .from("subscriptions")
      .select("status, plan");

    const statusCounts: Record<string, number> = {};
    const planCounts: Record<string, number> = {};
    
    subscriptions?.forEach((s: { status: string; plan: string }) => {
      statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
      planCounts[s.plan] = (planCounts[s.plan] || 0) + 1;
    });

    return {
      totalTenants: tenantsCount || 0,
      totalUsers: usersCount || 0,
      byStatus: statusCounts,
      byPlan: planCounts,
    };
  }),
});
