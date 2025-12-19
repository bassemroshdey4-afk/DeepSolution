import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { superAdminRouter } from "./superAdminRouter";
import { walletRouter } from "./walletRouter";
import { aiAddonsRouter } from "./aiAddonsRouter";
import { aiPipelineRouter } from "./aiPipelineRouter";
import { shippingRouter } from "./shippingRouter";
import { carrierPerformanceRouter } from "./carrierPerformanceRouter";
import { shippingIntegrationsRouter } from "./shippingIntegrationsRouter";
import { smartRoutingRouter } from "./smartRoutingRouter";
import { profitRouter, profitTruthRouter } from "./profitRouter";
import { inventoryRouter } from "./inventoryRouter";
import { auditLogRouter } from "./auditLogRouter";
import { n8nWorkflowsRouter } from "./n8nWorkflowsRouter";
import { productIntelligenceRouter } from "./productIntelligenceRouter";
import { landingPageRouter } from "./landingPageRouter";
import { n8nMarketingRouter } from "./n8nMarketingRouter";
import { publicProcedure, protectedProcedure, router, tenantProcedure } from "./_core/trpc";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";



export const appRouter = router({
  system: systemRouter,
  superAdmin: superAdminRouter,
  wallet: walletRouter,
  aiAddons: aiAddonsRouter,
  aiPipeline: aiPipelineRouter,
  shipping: shippingRouter,
  carrierPerformance: carrierPerformanceRouter,
  shippingIntegrations: shippingIntegrationsRouter,
  smartRouting: smartRoutingRouter,
  profit: profitRouter,
  profitTruth: profitTruthRouter,
  inventory: inventoryRouter,
  auditLog: auditLogRouter,
  n8nWorkflows: n8nWorkflowsRouter,
  productIntelligence: productIntelligenceRouter,
  landingPage: landingPageRouter,
  n8nMarketing: n8nMarketingRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // Onboarding - إنشاء مستأجر جديد مع Trial
  onboarding: router({
    createTenant: protectedProcedure
      .input(
        z.object({
          name: z.string().min(2, "يجب أن يكون الاسم حرفين على الأقل"),
          slug: z
            .string()
            .min(3, "يجب أن يكون النطاق 3 أحرف على الأقل")
            .regex(/^[a-z0-9-]+$/, "أحرف إنجليزية صغيرة وأرقام وشرطات فقط"),
          country: z.string().optional(),
          currency: z.string().optional(),
          language: z.string().optional(),
          timezone: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // التحقق من عدم وجود مستأجر بنفس الـ slug
        const existing = await db.getTenantBySlug(input.slug);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "هذا النطاق مستخدم بالفعل",
          });
        }

        // إنشاء المستأجر
        const tenantId = await db.createTenant({
          name: input.name,
          slug: input.slug,
          country: input.country,
          currency: input.currency,
          language: input.language,
          timezone: input.timezone,
        });

        // ربط المستخدم بالمستأجر كـ owner
        await db.addUserToTenant(tenantId, ctx.user.id, "owner");

        // تحديث الـ profile
        await db.updateProfile(ctx.user.id, { default_tenant_id: tenantId });

        // بدء الـ Trial
        await db.startTenantTrial(tenantId);

        return {
          tenantId,
          message: "تم إنشاء الحساب بنجاح مع فترة تجريبية 7 أيام",
        };
      }),

    // الحصول على حالة الـ Onboarding
    getStatus: protectedProcedure.query(async ({ ctx }) => {
      const tenants = await db.getUserTenants(ctx.user.id);
      const hasCompletedOnboarding = tenants.length > 0;

      return {
        hasCompletedOnboarding,
        tenantsCount: tenants.length,
        tenants: tenants.map((t) => ({
          id: t.tenant_id,
          role: t.role,
          tenant: t.tenants,
        })),
      };
    }),
  }),

  // إدارة المستأجرين
  tenant: router({
    getCurrent: tenantProcedure.query(async ({ ctx }) => {
      const tenant = await db.getTenantById(ctx.tenantId);
      if (!tenant) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "المستأجر غير موجود",
        });
      }
      return tenant;
    }),

    updateSettings: tenantProcedure
      .input(
        z.object({
          country: z.string().optional(),
          currency: z.string().optional(),
          language: z.string().optional(),
          timezone: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.updateTenant(ctx.tenantId, input);
        return { success: true };
      }),

    getStats: tenantProcedure.query(async ({ ctx }) => {
      return db.getTenantStats(ctx.tenantId);
    }),

    getSubscription: tenantProcedure.query(async ({ ctx }) => {
      const subscription = await db.getTenantSubscription(ctx.tenantId);
      const isTrialActive = await db.isTrialActive(ctx.tenantId);
      return { subscription, isTrialActive };
    }),
  }),

  // إدارة المنتجات
  products: router({
    list: tenantProcedure.query(async ({ ctx }) => {
      return db.getProductsByTenant(ctx.tenantId);
    }),

    get: tenantProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const product = await db.getProductById(input.id, ctx.tenantId);
        if (!product) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "المنتج غير موجود",
          });
        }
        return product;
      }),

    create: tenantProcedure
      .input(
        z.object({
          name: z.string().min(1, "اسم المنتج مطلوب"),
          description: z.string().optional(),
          price: z.number().min(0, "السعر يجب أن يكون موجباً"),
          cost: z.number().min(0).optional(),
          sku: z.string().optional(),
          barcode: z.string().optional(),
          image_url: z.string().optional(),
          stock: z.number().min(0).default(0),
          status: z.enum(["active", "draft", "archived"]).default("active"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const productId = await db.createProduct({
          tenant_id: ctx.tenantId,
          name: input.name,
          description: input.description || null,
          price: input.price,
          cost: input.cost || null,
          sku: input.sku || null,
          barcode: input.barcode || null,
          image_url: input.image_url || null,
          stock: input.stock,
          status: input.status,
        });
        return { productId };
      }),

    update: tenantProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          name: z.string().min(1).optional(),
          description: z.string().optional(),
          price: z.number().min(0).optional(),
          cost: z.number().min(0).optional(),
          sku: z.string().optional(),
          barcode: z.string().optional(),
          image_url: z.string().optional(),
          stock: z.number().min(0).optional(),
          status: z.enum(["active", "draft", "archived"]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateProduct(id, ctx.tenantId, data);
        return { success: true };
      }),

    delete: tenantProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteProduct(input.id, ctx.tenantId);
        return { success: true };
      }),
  }),

  // إدارة الطلبات
  orders: router({
    list: tenantProcedure
      .input(
        z
          .object({
            limit: z.number().min(1).max(200).default(100),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        return db.getOrdersByTenant(ctx.tenantId, input?.limit);
      }),

    get: tenantProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const order = await db.getOrderWithItems(input.id, ctx.tenantId);
        if (!order) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "الطلب غير موجود",
          });
        }
        return order;
      }),

    create: tenantProcedure
      .input(
        z.object({
          order_number: z.string(),
          customer_name: z.string().min(1, "اسم العميل مطلوب"),
          customer_phone: z.string().min(1, "رقم الهاتف مطلوب"),
          customer_email: z.string().email().optional(),
          customer_address: z.string().optional(),
          items: z.array(
            z.object({
              product_id: z.string().uuid().optional(),
              product_name: z.string(),
              quantity: z.number().min(1),
              unit_price: z.number().min(0),
            })
          ),
          campaign_id: z.string().uuid().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { items, ...orderData } = input;

        // حساب المبلغ الإجمالي
        const total_amount = items.reduce(
          (sum, item) => sum + item.unit_price * item.quantity,
          0
        );

        // حساب رسوم المنصة (قابلة للتكوين)
        // TODO: جلب الأسعار من جدول platform_pricing
        const PLATFORM_FEE_PERCENTAGE = 0; // 0% افتراضياً - قابل للتكوين
        const PLATFORM_FEE_FIXED = 0; // 0 افتراضياً - قابل للتكوين
        const platform_fee = (total_amount * PLATFORM_FEE_PERCENTAGE / 100) + PLATFORM_FEE_FIXED;

        // التحقق من رصيد المحفظة وخصم الرسوم (إذا كانت أكبر من 0)
        if (platform_fee > 0) {
          const { supabaseAdmin } = await import("./supabase");
          
          // الحصول على المحفظة
          const { data: wallet, error: walletError } = await supabaseAdmin
            .from("wallets")
            .select("*")
            .eq("tenant_id", ctx.tenantId)
            .single();

          if (walletError && walletError.code !== "PGRST116") {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "خطأ في الوصول للمحفظة",
            });
          }

          const currentBalance = wallet ? parseFloat(wallet.balance) : 0;

          // التحقق من الرصيد الكافي
          if (currentBalance < platform_fee) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `رصيد المحفظة غير كافي. المطلوب: ${platform_fee} - المتاح: ${currentBalance}`,
            });
          }

          // خصم الرسوم من المحفظة
          const balanceAfter = currentBalance - platform_fee;
          await supabaseAdmin
            .from("wallets")
            .update({ balance: balanceAfter, updated_at: new Date().toISOString() })
            .eq("id", wallet.id);

          // تسجيل المعاملة (سيتم ربطها بالطلب بعد إنشائه)
          await supabaseAdmin
            .from("wallet_transactions")
            .insert({
              wallet_id: wallet.id,
              tenant_id: ctx.tenantId,
              type: "debit",
              amount: platform_fee,
              balance_before: currentBalance,
              balance_after: balanceAfter,
              description: `رسوم طلب #${orderData.order_number}`,
              reference_type: "order",
              created_by: ctx.user.id,
            });
        }

        // إنشاء الطلب
        const orderId = await db.createOrder({
          ...orderData,
          total_amount,
          shipping_cost: 0,
          discount_amount: 0,
          status: "pending",
          payment_status: "pending",
          tenant_id: ctx.tenantId,
        });

        // إضافة عناصر الطلب
        for (const item of items) {
          await db.createOrderItem({
            ...item,
            order_id: orderId,
            total_price: item.unit_price * item.quantity,
            tenant_id: ctx.tenantId,
          });
        }

        return { orderId };
      }),

    updateStatus: tenantProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          status: z.enum([
            "pending",
            "confirmed",
            "processing",
            "shipped",
            "delivered",
            "cancelled",
            "returned",
          ]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.updateOrder(input.id, ctx.tenantId, { status: input.status });
        return { success: true };
      }),

    updateCallCenterStatus: tenantProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          call_center_status: z.enum(["pending", "contacted", "confirmed", "cancelled"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.updateOrder(input.id, ctx.tenantId, { 
          call_center_status: input.call_center_status 
        });
        return { success: true };
      }),
  }),

  // إدارة الحملات
  campaigns: router({
    list: tenantProcedure.query(async ({ ctx }) => {
      return db.getCampaignsByTenant(ctx.tenantId);
    }),

    get: tenantProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const campaign = await db.getCampaignById(input.id, ctx.tenantId);
        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "الحملة غير موجودة",
          });
        }
        return campaign;
      }),

    create: tenantProcedure
      .input(
        z.object({
          name: z.string().min(1, "اسم الحملة مطلوب"),
          description: z.string().optional(),
          platform: z.string(),
          budget: z.number().min(0, "الميزانية يجب أن تكون موجبة"),
          start_date: z.string().optional(),
          end_date: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const campaignId = await db.createCampaign({
          ...input,
          spent: 0,
          revenue: 0,
          orders_count: 0,
          status: "draft",
          tenant_id: ctx.tenantId,
        });
        return { campaignId };
      }),

    update: tenantProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          name: z.string().optional(),
          description: z.string().optional(),
          platform: z.string().optional(),
          budget: z.number().min(0).optional(),
          spent: z.number().min(0).optional(),
          revenue: z.number().min(0).optional(),
          status: z.enum(["draft", "active", "paused", "completed"]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateCampaign(id, ctx.tenantId, data);
        return { success: true };
      }),

    delete: tenantProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteCampaign(input.id, ctx.tenantId);
        return { success: true };
      }),

    calculateROAS: tenantProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const campaign = await db.getCampaignById(input.id, ctx.tenantId);
        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "الحملة غير موجودة",
          });
        }
        const spent = campaign.spent || 0;
        const revenue = campaign.revenue || 0;
        const roas = spent > 0 ? Math.round((revenue / spent) * 100) : 0;
        return { roas };
      }),
  }),

  // Events Ingestion API
  events: router({
    track: tenantProcedure
      .input(
        z.object({
          event_name: z.string().min(1, "اسم الحدث مطلوب"),
          event_type: z.enum(["page_view", "click", "purchase", "add_to_cart", "form_submit", "custom"]).default("custom"),
          store_id: z.string().uuid().optional(),
          session_id: z.string().optional(),
          user_id: z.string().uuid().optional(),
          product_id: z.string().uuid().optional(),
          order_id: z.string().uuid().optional(),
          source: z.string().optional(),
          utm_source: z.string().optional(),
          utm_campaign: z.string().optional(),
          utm_content: z.string().optional(),
          utm_term: z.string().optional(),
          ad_platform: z.string().optional(),
          ad_account_id: z.string().optional(),
          campaign_platform_id: z.string().optional(),
          ad_id: z.string().optional(),
          event_data: z.record(z.string(), z.unknown()).optional(),
          occurred_at: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.trackEvent({
          tenant_id: ctx.tenantId,
          event_name: input.event_name || null,
          event_type: input.event_type,
          store_id: input.store_id || null,
          session_id: input.session_id || null,
          user_id: input.user_id || null,
          product_id: input.product_id || null,
          order_id: input.order_id || null,
          source: input.source || null,
          utm_source: input.utm_source || null,
          utm_campaign: input.utm_campaign || null,
          utm_content: input.utm_content || null,
          utm_term: input.utm_term || null,
          ad_platform: input.ad_platform || null,
          ad_account_id: input.ad_account_id || null,
          campaign_platform_id: input.campaign_platform_id || null,
          ad_id: input.ad_id || null,
          event_data: input.event_data || null,
          occurred_at: input.occurred_at || new Date().toISOString(),
        });
        return { success: true };
      }),

    list: tenantProcedure
      .input(
        z
          .object({
            limit: z.number().min(1).max(1000).default(100),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        return db.getEventsByTenant(ctx.tenantId, input?.limit);
      }),
  }),

  // المساعد الذكي
  ai: router({
    chat: tenantProcedure
      .input(
        z.object({
          message: z.string().min(1),
          conversationId: z.string().uuid().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // الحصول على المحادثة الحالية أو إنشاء جديدة
        let conversation;
        if (input.conversationId) {
          conversation = await db.getConversationById(
            input.conversationId,
            ctx.tenantId
          );
          if (!conversation) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "المحادثة غير موجودة",
            });
          }
        } else {
          // إنشاء محادثة جديدة
          const conversationId = await db.createConversation({
            tenantId: ctx.tenantId,
            userId: ctx.user.id,
            title: input.message.substring(0, 50),
            messages: [],
          });
          conversation = await db.getConversationById(
            conversationId,
            ctx.tenantId
          );
        }

        if (!conversation) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "حدث خطأ في إنشاء المحادثة",
          });
        }

        // جمع السياق من قاعدة البيانات
        const stats = await db.getTenantStats(ctx.tenantId);

        const contextInfo = `معلومات المتجر:
- عدد المنتجات: ${stats?.productsCount || 0}
- عدد الطلبات: ${stats?.ordersCount || 0}
- عدد الحملات: ${stats?.campaignsCount || 0}
- إجمالي الإيرادات: ${stats?.totalRevenue || 0}`;

        // إضافة رسالة المستخدم
        const messages = [
          ...(conversation.messages || []),
          {
            role: "user" as const,
            content: input.message,
            timestamp: Date.now(),
          },
        ];

        // استدعاء الذكاء الاصطناعي
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `أنت مساعد ذكي متخصص في التجارة الإلكترونية والتسويق. لديك وصول لبيانات المتجر التالية:

${contextInfo}

أجب بالعربية بشكل احترافي ومفيد. قدم تحليلات وتوصيات عملية.`,
            },
            ...messages.slice(-10).map((msg) => ({
              role: msg.role,
              content: msg.content,
            })),
          ],
        });

        const aiMessage = {
          role: "assistant" as const,
          content:
            typeof response.choices[0].message.content === "string"
              ? response.choices[0].message.content
              : JSON.stringify(response.choices[0].message.content),
          timestamp: Date.now(),
        };

        // حفظ المحادثة
        const updatedMessages = [...messages, aiMessage];
        await db.updateConversation(conversation.id, ctx.tenantId, {
          messages: updatedMessages,
        });

        return {
          conversationId: conversation.id,
          message: aiMessage.content,
        };
      }),

    getConversations: tenantProcedure.query(async ({ ctx }) => {
      return db.getConversationsByTenant(ctx.tenantId, ctx.user.id);
    }),

    getConversation: tenantProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const conversation = await db.getConversationById(
          input.id,
          ctx.tenantId
        );
        if (!conversation) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "المحادثة غير موجودة",
          });
        }
        return conversation;
      }),
  }),

  // صفحات الهبوط
  landingPages: router({
    list: tenantProcedure.query(async ({ ctx }) => {
      return db.getLandingPagesByTenant(ctx.tenantId);
    }),

    get: tenantProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const page = await db.getLandingPageById(input.id, ctx.tenantId);
        if (!page) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "صفحة الهبوط غير موجودة",
          });
        }
        return page;
      }),

    generate: tenantProcedure
      .input(
        z.object({
          productId: z.string().uuid().optional(),
          productName: z.string().min(1, "اسم المنتج مطلوب"),
          productDescription: z.string(),
          imageUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const prompt = `أنت خبير في كتابة صفحات الهبوط للتجارة الإلكترونية.
بناءً على المعلومات التالية، قم بإنشاء صفحة هبوط احترافية بالعربية:

اسم المنتج: ${input.productName}
الوصف: ${input.productDescription}

أرجع JSON بالشكل التالي:
{
  "headline": "عنوان جذاب وقوي",
  "description": "وصف مقنع للمنتج",
  "features": ["ميزة 1", "ميزة 2", "ميزة 3", "ميزة 4", "ميزة 5"],
  "cta": "نص زر الدعوة لاتخاذ إجراء"
}`;

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "أنت خبير في التسويق وكتابة المحتوى للتجارة الإلكترونية.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "landing_page_content",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  headline: { type: "string" },
                  description: { type: "string" },
                  features: {
                    type: "array",
                    items: { type: "string" },
                  },
                  cta: { type: "string" },
                },
                required: ["headline", "description", "features", "cta"],
                additionalProperties: false,
              },
            },
          },
        });

        const contentStr =
          typeof response.choices[0].message.content === "string"
            ? response.choices[0].message.content
            : JSON.stringify(response.choices[0].message.content);
        const content = JSON.parse(contentStr);

        const pageId = await db.createLandingPage({
          tenantId: ctx.tenantId,
          productId: input.productId,
          title: content.headline,
          content,
          imageUrls: input.imageUrl ? [input.imageUrl] : [],
          aiPrompt: input.productDescription,
          status: "draft",
        });

        return { pageId, content };
      }),

    publish: tenantProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        await db.updateLandingPage(input.id, ctx.tenantId, {
          status: "published",
        });
        return { success: true };
      }),

    delete: tenantProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteLandingPage(input.id, ctx.tenantId);
        return { success: true };
      }),
  }),

  // ==================== Payment Methods ====================
  paymentMethods: router({
    list: tenantProcedure.query(async ({ ctx }) => {
      return db.getPaymentMethods(ctx.tenantId);
    }),

    listEnabled: tenantProcedure.query(async ({ ctx }) => {
      return db.getEnabledPaymentMethods(ctx.tenantId);
    }),

    get: tenantProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const method = await db.getPaymentMethodById(ctx.tenantId, input.id);
        if (!method) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "طريقة الدفع غير موجودة",
          });
        }
        return method;
      }),

    create: tenantProcedure
      .input(
        z.object({
          provider: z.string().min(1, "مزود الدفع مطلوب"),
          name: z.string().min(1, "اسم طريقة الدفع مطلوب"),
          name_ar: z.string().optional(),
          description: z.string().optional(),
          description_ar: z.string().optional(),
          is_enabled: z.boolean().default(false),
          is_default: z.boolean().default(false),
          config: z.record(z.string(), z.unknown()).optional(),
          supported_currencies: z.array(z.string()).optional(),
          min_amount: z.number().min(0).optional(),
          max_amount: z.number().min(0).optional(),
          fee_type: z.enum(["percentage", "fixed", "mixed"]).optional(),
          fee_percentage: z.number().min(0).max(100).optional(),
          fee_fixed: z.number().min(0).optional(),
          display_order: z.number().min(0).optional(),
          icon_url: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const method = await db.createPaymentMethod(ctx.tenantId, input);
        return { id: method.id, message: "تم إنشاء طريقة الدفع بنجاح" };
      }),

    update: tenantProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          name: z.string().optional(),
          name_ar: z.string().optional(),
          description: z.string().optional(),
          description_ar: z.string().optional(),
          is_enabled: z.boolean().optional(),
          is_default: z.boolean().optional(),
          config: z.record(z.string(), z.unknown()).optional(),
          supported_currencies: z.array(z.string()).optional(),
          min_amount: z.number().min(0).optional(),
          max_amount: z.number().min(0).optional(),
          fee_type: z.enum(["percentage", "fixed", "mixed"]).optional(),
          fee_percentage: z.number().min(0).max(100).optional(),
          fee_fixed: z.number().min(0).optional(),
          display_order: z.number().min(0).optional(),
          icon_url: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updatePaymentMethod(ctx.tenantId, id, data);
        return { success: true, message: "تم تحديث طريقة الدفع بنجاح" };
      }),

    delete: tenantProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        await db.deletePaymentMethod(ctx.tenantId, input.id);
        return { success: true, message: "تم حذف طريقة الدفع بنجاح" };
      }),

    setDefault: tenantProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        await db.setDefaultPaymentMethod(ctx.tenantId, input.id);
        return { success: true, message: "تم تعيين طريقة الدفع الافتراضية" };
      }),

    toggle: tenantProcedure
      .input(z.object({ id: z.string().uuid(), is_enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        await db.updatePaymentMethod(ctx.tenantId, input.id, { is_enabled: input.is_enabled });
        return { success: true, message: input.is_enabled ? "تم تفعيل طريقة الدفع" : "تم تعطيل طريقة الدفع" };
      }),
  }),

  // ==================== Payment Transactions ====================
  paymentTransactions: router({
    list: tenantProcedure
      .input(
        z.object({
          status: z.string().optional(),
          order_id: z.string().uuid().optional(),
          customer_id: z.string().uuid().optional(),
          limit: z.number().min(1).max(200).default(50),
          offset: z.number().min(0).default(0),
        }).optional()
      )
      .query(async ({ ctx, input }) => {
        return db.getPaymentTransactions(ctx.tenantId, input);
      }),

    create: tenantProcedure
      .input(
        z.object({
          order_id: z.string().uuid().optional(),
          customer_id: z.string().uuid().optional(),
          payment_method_id: z.string().uuid().optional(),
          amount: z.number().min(0.01, "المبلغ يجب أن يكون أكبر من صفر"),
          currency: z.string().default("USD"),
          type: z.enum(["payment", "refund", "partial_refund"]).default("payment"),
          metadata: z.record(z.string(), z.unknown()).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const transaction = await db.createPaymentTransaction(ctx.tenantId, {
          ...input,
          status: "pending",
        });
        return { id: transaction.id, message: "تم إنشاء المعاملة بنجاح" };
      }),

    updateStatus: tenantProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          status: z.enum(["pending", "processing", "completed", "failed", "cancelled", "refunded"]),
          error_message: z.string().optional(),
          error_code: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        if (data.status === "completed") {
          (data as any).completed_at = new Date().toISOString();
        }
        await db.updatePaymentTransaction(ctx.tenantId, id, data);
        return { success: true, message: "تم تحديث حالة المعاملة" };
      }),
  }),

  // ==================== Payment Proofs (Vodafone Cash, etc.) ====================
  paymentProofs: router({
    list: tenantProcedure
      .input(
        z.object({
          status: z.string().optional(),
          order_id: z.string().uuid().optional(),
          limit: z.number().min(1).max(200).default(50),
          offset: z.number().min(0).default(0),
        }).optional()
      )
      .query(async ({ ctx, input }) => {
        return db.getPaymentProofs(ctx.tenantId, input);
      }),

    create: tenantProcedure
      .input(
        z.object({
          order_id: z.string().uuid().optional(),
          customer_id: z.string().uuid().optional(),
          proof_type: z.enum(["vodafone_cash", "instapay", "bank_transfer", "other"]),
          proof_url: z.string().optional(),
          reference_number: z.string().optional(),
          sender_phone: z.string().optional(),
          sender_name: z.string().optional(),
          amount_claimed: z.number().min(0).optional(),
          currency: z.string().default("EGP"),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const proof = await db.createPaymentProof(ctx.tenantId, input);
        return { id: proof.id, message: "تم رفع إثبات الدفع بنجاح" };
      }),

    review: tenantProcedure
      .input(
        z.object({
          id: z.string().uuid(),
          status: z.enum(["approved", "rejected"]),
          rejection_reason: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.reviewPaymentProof(ctx.tenantId, input.id, {
          status: input.status,
          reviewed_by: ctx.user.id,
          rejection_reason: input.rejection_reason,
        });
        return { 
          success: true, 
          message: input.status === "approved" ? "تم قبول إثبات الدفع" : "تم رفض إثبات الدفع" 
        };
      }),
  }),

  // ==================== Webhook Events ====================
  webhooks: router({
    // This would typically be a public endpoint for payment providers
    // For now, we'll create a stub that can be extended later
    listUnprocessed: tenantProcedure
      .input(z.object({ provider: z.string().optional(), limit: z.number().default(100) }).optional())
      .query(async ({ input }) => {
        return db.getUnprocessedWebhooks(input?.provider, input?.limit);
      }),
  }),
});

export type AppRouter = typeof appRouter;
