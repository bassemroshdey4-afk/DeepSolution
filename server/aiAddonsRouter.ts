import { z } from "zod";
import { router, publicProcedure, tenantProcedure } from "./_core/trpc";
import { supabaseAdmin } from "./supabase";
import { TRPCError } from "@trpc/server";

// Super Admin check
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

export const aiAddonsRouter = router({
  // قائمة الإضافات المتاحة
  list: publicProcedure.query(async () => {
    const { data, error } = await supabaseAdmin
      .from("ai_addons")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    }
    return data;
  }),

  // الحصول على اشتراكات المستأجر
  getMySubscriptions: tenantProcedure.query(async ({ ctx }) => {
    const { data, error } = await supabaseAdmin
      .from("tenant_ai_subscriptions")
      .select(`
        *,
        ai_addon:ai_addons(*)
      `)
      .eq("tenant_id", ctx.user.tenantId);

    if (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    }
    return data;
  }),

  // تفعيل إضافة (مع خصم من المحفظة)
  activate: tenantProcedure
    .input(z.object({
      addonId: z.string().uuid(),
      useTrial: z.boolean().optional().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const { addonId, useTrial } = input;

      // التحقق من وجود الإضافة
      const { data: addon, error: addonError } = await supabaseAdmin
        .from("ai_addons")
        .select("*")
        .eq("id", addonId)
        .eq("is_active", true)
        .single();

      if (addonError || !addon) {
        throw new TRPCError({ code: "NOT_FOUND", message: "الإضافة غير موجودة" });
      }

      // التحقق من عدم وجود اشتراك نشط
      const { data: existingSub } = await supabaseAdmin
        .from("tenant_ai_subscriptions")
        .select("*")
        .eq("tenant_id", ctx.user.tenantId)
        .eq("ai_addon_id", addonId)
        .in("status", ["active", "trial"])
        .single();

      if (existingSub) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "لديك اشتراك نشط بالفعل في هذه الإضافة" });
      }

      // تحديد نوع الاشتراك والحدود
      let status = "active";
      let usageLimit = addon.usage_limit_default;
      let priceToCharge = parseFloat(addon.price_amount);

      if (useTrial && addon.trial_enabled) {
        status = "trial";
        usageLimit = addon.trial_usage_limit;
        priceToCharge = 0; // الفترة التجريبية مجانية
      }

      // خصم من المحفظة إذا كان هناك رسوم
      if (priceToCharge > 0) {
        const { data: wallet, error: walletError } = await supabaseAdmin
          .from("wallets")
          .select("*")
          .eq("tenant_id", ctx.user.tenantId)
          .single();

        if (walletError) {
          throw new TRPCError({ code: "NOT_FOUND", message: "المحفظة غير موجودة" });
        }

        const currentBalance = parseFloat(wallet.balance);
        if (currentBalance < priceToCharge) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `رصيد المحفظة غير كافي. المطلوب: ${priceToCharge} - المتاح: ${currentBalance}`,
          });
        }

        // خصم الرسوم
        const balanceAfter = currentBalance - priceToCharge;
        await supabaseAdmin
          .from("wallets")
          .update({ balance: balanceAfter, updated_at: new Date().toISOString() })
          .eq("id", wallet.id);

        // تسجيل المعاملة
        await supabaseAdmin.from("wallet_transactions").insert({
          wallet_id: wallet.id,
          tenant_id: ctx.user.tenantId,
          type: "debit",
          amount: priceToCharge,
          balance_before: currentBalance,
          balance_after: balanceAfter,
          description: `تفعيل إضافة: ${addon.name_ar || addon.name}`,
          reference_type: "ai_addon",
          reference_id: addonId,
          created_by: ctx.user.id,
        });
      }

      // حساب تاريخ الانتهاء
      const expiresAt = new Date();
      if (addon.billing_cycle === "monthly") {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      } else if (addon.billing_cycle === "yearly") {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      }

      // إنشاء الاشتراك
      const { data: subscription, error: subError } = await supabaseAdmin
        .from("tenant_ai_subscriptions")
        .insert({
          tenant_id: ctx.user.tenantId,
          ai_addon_id: addonId,
          status,
          expires_at: expiresAt.toISOString(),
          usage_limit: usageLimit,
          usage_remaining: usageLimit,
          is_trial: useTrial && addon.trial_enabled,
        })
        .select()
        .single();

      if (subError) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: subError.message });
      }

      return { subscription, charged: priceToCharge };
    }),

  // تجديد الاشتراك
  renew: tenantProcedure
    .input(z.object({ subscriptionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { subscriptionId } = input;

      // الحصول على الاشتراك
      const { data: sub, error: subError } = await supabaseAdmin
        .from("tenant_ai_subscriptions")
        .select("*, ai_addon:ai_addons(*)")
        .eq("id", subscriptionId)
        .eq("tenant_id", ctx.user.tenantId)
        .single();

      if (subError || !sub) {
        throw new TRPCError({ code: "NOT_FOUND", message: "الاشتراك غير موجود" });
      }

      const addon = sub.ai_addon;
      const priceToCharge = parseFloat(addon.price_amount);

      // خصم من المحفظة
      if (priceToCharge > 0) {
        const { data: wallet } = await supabaseAdmin
          .from("wallets")
          .select("*")
          .eq("tenant_id", ctx.user.tenantId)
          .single();

        if (!wallet) {
          throw new TRPCError({ code: "NOT_FOUND", message: "المحفظة غير موجودة" });
        }

        const currentBalance = parseFloat(wallet.balance);
        if (currentBalance < priceToCharge) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `رصيد المحفظة غير كافي. المطلوب: ${priceToCharge} - المتاح: ${currentBalance}`,
          });
        }

        const balanceAfter = currentBalance - priceToCharge;
        await supabaseAdmin
          .from("wallets")
          .update({ balance: balanceAfter, updated_at: new Date().toISOString() })
          .eq("id", wallet.id);

        await supabaseAdmin.from("wallet_transactions").insert({
          wallet_id: wallet.id,
          tenant_id: ctx.user.tenantId,
          type: "debit",
          amount: priceToCharge,
          balance_before: currentBalance,
          balance_after: balanceAfter,
          description: `تجديد إضافة: ${addon.name_ar || addon.name}`,
          reference_type: "ai_addon",
          reference_id: addon.id,
          created_by: ctx.user.id,
        });
      }

      // تحديث الاشتراك
      const newExpiresAt = new Date();
      if (addon.billing_cycle === "monthly") {
        newExpiresAt.setMonth(newExpiresAt.getMonth() + 1);
      } else if (addon.billing_cycle === "yearly") {
        newExpiresAt.setFullYear(newExpiresAt.getFullYear() + 1);
      }

      const { data: updated, error: updateError } = await supabaseAdmin
        .from("tenant_ai_subscriptions")
        .update({
          status: "active",
          expires_at: newExpiresAt.toISOString(),
          usage_remaining: addon.usage_limit_default,
          usage_limit: addon.usage_limit_default,
          is_trial: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscriptionId)
        .select()
        .single();

      if (updateError) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: updateError.message });
      }

      return { subscription: updated, charged: priceToCharge };
    }),

  // تسجيل استخدام (مع التحقق من الحدود)
  recordUsage: tenantProcedure
    .input(z.object({
      addonId: z.string().uuid(),
      action: z.string(),
      unitsUsed: z.number().int().positive().default(1),
      metadata: z.record(z.string(), z.any()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { addonId, action, unitsUsed, metadata } = input;

      // الحصول على الاشتراك النشط
      const { data: sub, error: subError } = await supabaseAdmin
        .from("tenant_ai_subscriptions")
        .select("*")
        .eq("tenant_id", ctx.user.tenantId)
        .eq("ai_addon_id", addonId)
        .in("status", ["active", "trial"])
        .single();

      if (subError || !sub) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "ليس لديك اشتراك نشط في هذه الإضافة",
        });
      }

      // التحقق من انتهاء الصلاحية
      if (sub.expires_at && new Date(sub.expires_at) < new Date()) {
        await supabaseAdmin
          .from("tenant_ai_subscriptions")
          .update({ status: "expired" })
          .eq("id", sub.id);

        throw new TRPCError({
          code: "FORBIDDEN",
          message: "انتهت صلاحية اشتراكك. يرجى التجديد.",
        });
      }

      // التحقق من الاستخدام المتبقي
      if (sub.usage_remaining < unitsUsed) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `استنفدت حد الاستخدام. المتبقي: ${sub.usage_remaining}`,
        });
      }

      // خصم الاستخدام
      const newUsageRemaining = sub.usage_remaining - unitsUsed;
      await supabaseAdmin
        .from("tenant_ai_subscriptions")
        .update({ usage_remaining: newUsageRemaining, updated_at: new Date().toISOString() })
        .eq("id", sub.id);

      // تسجيل الاستخدام
      await supabaseAdmin.from("ai_usage_logs").insert({
        tenant_id: ctx.user.tenantId,
        ai_addon_id: addonId,
        subscription_id: sub.id,
        action,
        units_used: unitsUsed,
        metadata: metadata || {},
      });

      return { success: true, usageRemaining: newUsageRemaining };
    }),

  // Super Admin: تفعيل بدون رسوم
  adminActivate: superAdminProcedure
    .input(z.object({
      tenantId: z.string().uuid(),
      addonId: z.string().uuid(),
      usageLimit: z.number().int().positive().optional(),
      expiresInDays: z.number().int().positive().optional().default(30),
    }))
    .mutation(async ({ input }) => {
      const { tenantId, addonId, usageLimit, expiresInDays } = input;

      const { data: addon } = await supabaseAdmin
        .from("ai_addons")
        .select("*")
        .eq("id", addonId)
        .single();

      if (!addon) {
        throw new TRPCError({ code: "NOT_FOUND", message: "الإضافة غير موجودة" });
      }

      const limit = usageLimit || addon.usage_limit_default;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      const { data, error } = await supabaseAdmin
        .from("tenant_ai_subscriptions")
        .upsert({
          tenant_id: tenantId,
          ai_addon_id: addonId,
          status: "active",
          expires_at: expiresAt.toISOString(),
          usage_limit: limit,
          usage_remaining: limit,
          is_trial: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: "tenant_id,ai_addon_id" })
        .select()
        .single();

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return data;
    }),

  // Super Admin: تعديل الاستخدام المتبقي
  adminAdjustUsage: superAdminProcedure
    .input(z.object({
      subscriptionId: z.string().uuid(),
      newUsageRemaining: z.number().int().min(0),
    }))
    .mutation(async ({ input }) => {
      const { subscriptionId, newUsageRemaining } = input;

      const { data, error } = await supabaseAdmin
        .from("tenant_ai_subscriptions")
        .update({ usage_remaining: newUsageRemaining, updated_at: new Date().toISOString() })
        .eq("id", subscriptionId)
        .select()
        .single();

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return data;
    }),

  // Super Admin: تمديد الصلاحية
  adminExtendExpiry: superAdminProcedure
    .input(z.object({
      subscriptionId: z.string().uuid(),
      extraDays: z.number().int().positive(),
    }))
    .mutation(async ({ input }) => {
      const { subscriptionId, extraDays } = input;

      const { data: sub } = await supabaseAdmin
        .from("tenant_ai_subscriptions")
        .select("*")
        .eq("id", subscriptionId)
        .single();

      if (!sub) {
        throw new TRPCError({ code: "NOT_FOUND", message: "الاشتراك غير موجود" });
      }

      const currentExpiry = sub.expires_at ? new Date(sub.expires_at) : new Date();
      currentExpiry.setDate(currentExpiry.getDate() + extraDays);

      const { data, error } = await supabaseAdmin
        .from("tenant_ai_subscriptions")
        .update({
          expires_at: currentExpiry.toISOString(),
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscriptionId)
        .select()
        .single();

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      return data;
    }),

  // توليد محتوى بالذكاء الاصطناعي (Content Writer)
  generateContent: tenantProcedure
    .input(z.object({
      contentType: z.enum(["product_description", "ad_copy", "social_post", "email", "landing_page_text", "blog_intro"]),
      productName: z.string().optional(),
      productDescription: z.string().optional(),
      targetAudience: z.string().optional(),
      tone: z.enum(["professional", "casual", "persuasive", "friendly", "luxury"]).optional().default("professional"),
      language: z.enum(["ar", "en"]).optional().default("ar"),
      additionalContext: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const CONTENT_WRITER_ADDON_ID = "5d45af19-1d08-43f0-8545-8e48104538a4";
      
      // 1. التحقق من تفعيل الإضافة
      const { data: sub, error: subError } = await supabaseAdmin
        .from("tenant_ai_subscriptions")
        .select("*")
        .eq("tenant_id", ctx.user.tenantId)
        .eq("ai_addon_id", CONTENT_WRITER_ADDON_ID)
        .in("status", ["active", "trial"])
        .single();

      if (subError || !sub) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "يجب تفعيل إضافة 'كاتب المحتوى' لاستخدام هذه الميزة",
        });
      }

      // 2. التحقق من انتهاء الصلاحية
      if (sub.expires_at && new Date(sub.expires_at) < new Date()) {
        await supabaseAdmin
          .from("tenant_ai_subscriptions")
          .update({ status: "expired" })
          .eq("id", sub.id);
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "انتهت صلاحية اشتراكك. يرجى التجديد.",
        });
      }

      // 3. التحقق من الاستخدام المتبقي
      if (sub.usage_remaining < 1) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "استنفدت حد الاستخدام. يرجى الترقية أو التجديد.",
        });
      }

      // 4. بناء الـ prompt حسب نوع المحتوى
      const { contentType, productName, productDescription, targetAudience, tone, language, additionalContext } = input;
      
      const contentTypeLabels: Record<string, { ar: string; en: string }> = {
        product_description: { ar: "وصف منتج", en: "product description" },
        ad_copy: { ar: "نص إعلاني", en: "ad copy" },
        social_post: { ar: "منشور سوشيال ميديا", en: "social media post" },
        email: { ar: "بريد إلكتروني تسويقي", en: "marketing email" },
        landing_page_text: { ar: "نص صفحة هبوط", en: "landing page text" },
        blog_intro: { ar: "مقدمة مقال", en: "blog introduction" },
      };

      const toneLabels: Record<string, { ar: string; en: string }> = {
        professional: { ar: "احترافي", en: "professional" },
        casual: { ar: "عفوي", en: "casual" },
        persuasive: { ar: "مقنع", en: "persuasive" },
        friendly: { ar: "ودي", en: "friendly" },
        luxury: { ar: "فاخر", en: "luxury" },
      };

      const isArabic = language === "ar";
      const contentLabel = contentTypeLabels[contentType]?.[language] || contentType;
      const toneLabel = toneLabels[tone]?.[language] || tone;

      let systemPrompt = isArabic
        ? `أنت كاتب محتوى محترف للتجارة الإلكترونية. اكتب باللغة العربية الفصحى السهلة. استخدم أسلوب ${toneLabel}.`
        : `You are a professional e-commerce content writer. Write in clear, engaging English. Use a ${toneLabel} tone.`;

      let userPrompt = isArabic
        ? `اكتب ${contentLabel}`
        : `Write a ${contentLabel}`;

      if (productName) {
        userPrompt += isArabic ? ` للمنتج: "${productName}"` : ` for the product: "${productName}"`;
      }
      if (productDescription) {
        userPrompt += isArabic ? `\nوصف المنتج: ${productDescription}` : `\nProduct description: ${productDescription}`;
      }
      if (targetAudience) {
        userPrompt += isArabic ? `\nالجمهور المستهدف: ${targetAudience}` : `\nTarget audience: ${targetAudience}`;
      }
      if (additionalContext) {
        userPrompt += isArabic ? `\nمعلومات إضافية: ${additionalContext}` : `\nAdditional context: ${additionalContext}`;
      }

      // 5. استدعاء OpenAI
      const { invokeLLM } = await import("./_core/llm");
      
      const startTime = Date.now();
      const result = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        maxTokens: 1000,
      });
      const endTime = Date.now();

      const generatedContent = result.choices[0]?.message?.content || "";
      const tokensUsed = result.usage?.total_tokens || 0;

      // 6. خصم الاستخدام
      const newUsageRemaining = sub.usage_remaining - 1;
      await supabaseAdmin
        .from("tenant_ai_subscriptions")
        .update({ usage_remaining: newUsageRemaining, updated_at: new Date().toISOString() })
        .eq("id", sub.id);

      // 7. تسجيل الاستخدام
      await supabaseAdmin.from("ai_usage_logs").insert({
        tenant_id: ctx.user.tenantId,
        ai_addon_id: CONTENT_WRITER_ADDON_ID,
        subscription_id: sub.id,
        action: `generate_${contentType}`,
        units_used: 1,
        metadata: {
          content_type: contentType,
          language,
          tone,
          tokens_used: tokensUsed,
          response_time_ms: endTime - startTime,
          product_name: productName,
        },
      });

      return {
        content: generatedContent,
        contentType,
        language,
        tokensUsed,
        usageRemaining: newUsageRemaining,
      };
    }),

  // إحصائيات الاستخدام
  getUsageStats: tenantProcedure
    .input(z.object({ addonId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data: logs, error } = await supabaseAdmin
        .from("ai_usage_logs")
        .select("*")
        .eq("tenant_id", ctx.user.tenantId)
        .eq("ai_addon_id", input.addonId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      }

      const totalUsed = logs.reduce((sum, log) => sum + log.units_used, 0);
      return { logs, totalUsed };
    }),
});
