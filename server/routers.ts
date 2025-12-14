import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";

// Middleware للتحقق من وجود tenant_id
const tenantProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user.tenantId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "يجب أن تكون مرتبطاً بمستأجر للوصول لهذه الميزة",
    });
  }
  return next({
    ctx: {
      ...ctx,
      tenantId: ctx.user.tenantId,
    },
  });
});

import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // إدارة المستأجرين
  tenant: router({
    // إنشاء مستأجر جديد (متاح للمستخدمين المصادقين فقط)
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(2, "يجب أن يكون الاسم حرفين على الأقل"),
          domain: z
            .string()
            .min(3, "يجب أن يكون النطاق 3 أحرف على الأقل")
            .regex(/^[a-z0-9-]+$/, "يجب أن يحتوي النطاق على أحرف إنجليزية صغيرة وأرقام وشرطات فقط"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // التحقق من عدم وجود مستأجر بنفس النطاق
        const existing = await db.getTenantByDomain(input.domain);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "هذا النطاق مستخدم بالفعل",
          });
        }

        // إنشاء المستأجر
        const tenantId = await db.createTenant({
          name: input.name,
          domain: input.domain,
          plan: "free",
          status: "trial",
        });

        // ربط المستخدم الحالي بالمستأجر كـ owner
        await db.updateUserTenant(ctx.user.id, tenantId);

        return {
          tenantId,
          message: "تم إنشاء الحساب بنجاح",
        };
      }),

    // الحصول على معلومات المستأجر الحالي
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

    // تحديث إعدادات المستأجر
    updateSettings: tenantProcedure
      .input(
        z.object({
          settings: z.object({
            currency: z.string().optional(),
            timezone: z.string().optional(),
            language: z.string().optional(),
          }),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.updateTenant(ctx.tenantId, {
          settings: input.settings,
        });
        return { success: true };
      }),

    // الحصول على إحصائيات المستأجر
    getStats: tenantProcedure.query(async ({ ctx }) => {
      return db.getTenantStats(ctx.tenantId);
    }),
  }),

  // إدارة المنتجات
  products: router({
    list: tenantProcedure.query(async ({ ctx }) => {
      return db.getProductsByTenant(ctx.tenantId);
    }),

    get: tenantProcedure
      .input(z.object({ id: z.number() }))
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
          imageUrl: z.string().optional(),
          stock: z.number().min(0).default(0),
          status: z.enum(["active", "draft", "archived"]).default("active"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const productId = await db.createProduct({
          ...input,
          tenantId: ctx.tenantId,
        });
        return { productId };
      }),

    update: tenantProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          description: z.string().optional(),
          price: z.number().min(0).optional(),
          cost: z.number().min(0).optional(),
          sku: z.string().optional(),
          barcode: z.string().optional(),
          imageUrl: z.string().optional(),
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
      .input(z.object({ id: z.number() }))
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
      .input(z.object({ id: z.number() }))
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
          orderNumber: z.string(),
          customerName: z.string().min(1, "اسم العميل مطلوب"),
          customerPhone: z.string().min(1, "رقم الهاتف مطلوب"),
          customerAddress: z.string().optional(),
          items: z.array(
            z.object({
              productId: z.number(),
              quantity: z.number().min(1),
              price: z.number().min(0),
            })
          ),
          campaignId: z.number().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { items, ...orderData } = input;

        // حساب المبلغ الإجمالي
        const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

        // إنشاء الطلب
        const orderId = await db.createOrder({
          ...orderData,
          totalAmount,
          tenantId: ctx.tenantId,
        });

        // إضافة عناصر الطلب
        for (const item of items) {
          await db.createOrderItem({
            ...item,
            orderId,
            tenantId: ctx.tenantId,
          });
        }

        return { orderId };
      }),

    updateStatus: tenantProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["new", "confirmed", "processing", "shipped", "delivered", "cancelled"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.updateOrder(input.id, ctx.tenantId, { status: input.status });
        return { success: true };
      }),

    updateCallCenterStatus: tenantProcedure
      .input(
        z.object({
          id: z.number(),
          callCenterStatus: z.enum(["pending", "contacted", "callback", "no_answer", "confirmed"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.updateOrder(input.id, ctx.tenantId, { callCenterStatus: input.callCenterStatus });
        return { success: true };
      }),

    updateShippingStatus: tenantProcedure
      .input(
        z.object({
          id: z.number(),
          shippingStatus: z.enum(["pending", "in_transit", "delivered", "returned"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.updateOrder(input.id, ctx.tenantId, { shippingStatus: input.shippingStatus });
        return { success: true };
      }),
  }),

  // إدارة الحملات
  campaigns: router({
    list: tenantProcedure.query(async ({ ctx }) => {
      return db.getCampaignsByTenant(ctx.tenantId);
    }),

    get: tenantProcedure
      .input(z.object({ id: z.number() }))
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
          platform: z.enum(["facebook", "google", "tiktok", "snapchat", "instagram", "other"]),
          budget: z.number().min(0, "الميزانية يجب أن تكون موجبة"),
          startDate: z.date(),
          endDate: z.date().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const campaignId = await db.createCampaign({
          ...input,
          tenantId: ctx.tenantId,
        });
        return { campaignId };
      }),

    update: tenantProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          description: z.string().optional(),
          budget: z.number().min(0).optional(),
          spent: z.number().min(0).optional(),
          status: z.enum(["active", "paused", "completed"]).optional(),
          endDate: z.date().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateCampaign(id, ctx.tenantId, data);
        return { success: true };
      }),

    // حساب ROAS للحملة
    calculateROAS: tenantProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const campaign = await db.getCampaignById(input.id, ctx.tenantId);
        if (!campaign) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "الحملة غير موجودة",
          });
        }

        // الحصول على جميع الطلبات المرتبطة بالحملة
        const orders = await db.getOrdersByCampaign(input.id, ctx.tenantId);

        // حساب الإيرادات من الطلبات المكتملة
        const revenue = orders
          .filter((order) => order.status === "delivered")
          .reduce((sum, order) => sum + order.totalAmount, 0);

        // حساب ROAS (كنسبة مئوية)
        const roas = campaign.spent > 0 ? Math.round((revenue / campaign.spent) * 100) : 0;

        // تحديث الحملة
        await db.updateCampaign(input.id, ctx.tenantId, {
          revenue,
          roas,
        });

        return {
          revenue,
          spent: campaign.spent,
          roas,
        };
      }),

    delete: tenantProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteCampaign(input.id, ctx.tenantId);
        return { success: true };
      }),
  }),

  // مولد صفحات الهبوط بالذكاء الاصطناعي
  landingPages: router({
    list: tenantProcedure.query(async ({ ctx }) => {
      return db.getLandingPagesByTenant(ctx.tenantId);
    }),

    get: tenantProcedure
      .input(z.object({ id: z.number() }))
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
          productId: z.number().optional(),
          productName: z.string().min(1, "اسم المنتج مطلوب"),
          productDescription: z.string(),
          imageUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // إنشاء prompt للذكاء الاصطناعي
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
              content: "أنت خبير في التسويق وكتابة المحتوى للتجارة الإلكترونية.",
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

        const contentStr = typeof response.choices[0].message.content === "string" 
          ? response.choices[0].message.content 
          : JSON.stringify(response.choices[0].message.content);
        const content = JSON.parse(contentStr);

        // حفظ صفحة الهبوط
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
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.updateLandingPage(input.id, ctx.tenantId, { status: "published" });
        return { success: true };
      }),

    delete: tenantProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteLandingPage(input.id, ctx.tenantId);
        return { success: true };
      }),
  }),

  // المساعد الذكي
  ai: router({
    chat: tenantProcedure
      .input(
        z.object({
          message: z.string().min(1),
          conversationId: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // الحصول على المحادثة الحالية أو إنشاء جديدة
        let conversation;
        if (input.conversationId) {
          conversation = await db.getConversationById(input.conversationId, ctx.tenantId);
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
          conversation = await db.getConversationById(conversationId, ctx.tenantId);
        }

        if (!conversation) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "حدث خطأ في إنشاء المحادثة",
          });
        }

        // جمع السياق من قاعدة البيانات
        const stats = await db.getTenantStats(ctx.tenantId);
        const recentOrders = await db.getOrdersByTenant(ctx.tenantId, 5);
        const activeCampaigns = await db.getCampaignsByTenant(ctx.tenantId);

        const contextInfo = `معلومات المتجر:
- عدد المنتجات: ${stats?.productsCount || 0}
- عدد الطلبات: ${stats?.ordersCount || 0}
- عدد الحملات: ${stats?.campaignsCount || 0}
- إجمالي الإيرادات: ${((stats?.totalRevenue || 0) / 100).toFixed(2)} ر.س`;

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
          content: typeof response.choices[0].message.content === "string" 
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
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const conversation = await db.getConversationById(input.id, ctx.tenantId);
        if (!conversation) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "المحادثة غير موجودة",
          });
        }
        return conversation;
      }),
  }),
});

export type AppRouter = typeof appRouter;
