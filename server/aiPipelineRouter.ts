import { z } from "zod";
import { router, tenantProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { supabaseAdmin } from "./supabase";
import { invokeLLM } from "./_core/llm";

// ============================================
// AI Pipeline Router - Works with existing Supabase tables
// ============================================
// Tables used:
// - products: source of product data, stores ai_intelligence in metadata
// - campaigns: stores generated ad content
// - ai_usage_logs: tracks AI usage
// - tenant_ai_subscriptions: checks addon activation
// ============================================

// Product Intelligence Add-on ID (from ai_addons table)
const PRODUCT_INTELLIGENCE_ADDON_ID = "a1b2c3d4-1111-2222-3333-444455556666";
const LANDING_PAGE_ADDON_ID = "b2c3d4e5-2222-3333-4444-555566667777";
const META_ADS_ADDON_ID = "c3d4e5f6-3333-4444-5555-666677778888";

// Helper: Check addon is active and has usage
async function checkAddonUsage(tenantId: string, addonId: string): Promise<{ subscriptionId: string; usageRemaining: number }> {
  const { data: sub, error } = await supabaseAdmin
    .from("tenant_ai_subscriptions")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("ai_addon_id", addonId)
    .in("status", ["active", "trial"])
    .single();

  if (error || !sub) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "يجب تفعيل الإضافة المطلوبة لاستخدام هذه الميزة",
    });
  }

  if (sub.expires_at && new Date(sub.expires_at) < new Date()) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "انتهت صلاحية الاشتراك. يرجى التجديد.",
    });
  }

  if (sub.usage_remaining < 1) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "استنفدت حد الاستخدام. يرجى الترقية.",
    });
  }

  return { subscriptionId: sub.id, usageRemaining: sub.usage_remaining };
}

// Helper: Deduct usage and log
async function recordAIUsage(
  tenantId: string,
  subscriptionId: string,
  addonId: string,
  action: string,
  tokensUsed: number,
  metadata: Record<string, unknown>
) {
  // Deduct usage
  await supabaseAdmin
    .from("tenant_ai_subscriptions")
    .update({ usage_remaining: 0 })
    .eq("id", subscriptionId);

  // Actually deduct - need to get current and subtract
  const { data: current } = await supabaseAdmin
    .from("tenant_ai_subscriptions")
    .select("usage_remaining")
    .eq("id", subscriptionId)
    .single();

  if (current) {
    await supabaseAdmin
      .from("tenant_ai_subscriptions")
      .update({ usage_remaining: current.usage_remaining - 1 })
      .eq("id", subscriptionId);
  }

  // Log usage
  await supabaseAdmin.from("ai_usage_logs").insert({
    tenant_id: tenantId,
    ai_addon_id: addonId,
    subscription_id: subscriptionId,
    action,
    units_used: 1,
    metadata: { ...metadata, tokens_used: tokensUsed },
  });
}

export const aiPipelineRouter = router({
  // ============================================
  // Step 1: Analyze Product from existing products table
  // ============================================
  analyzeProduct: tenantProcedure
    .input(z.object({
      productId: z.string().uuid(),
      language: z.enum(["ar", "en"]).optional().default("ar"),
    }))
    .mutation(async ({ ctx, input }) => {
      // 1. Get product from Supabase
      const { data: product, error: productError } = await supabaseAdmin
        .from("products")
        .select("*")
        .eq("id", input.productId)
        .eq("tenant_id", ctx.user.tenantId)
        .single();

      if (productError || !product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "المنتج غير موجود" });
      }

      // 2. Check addon usage (skip for now - use free tier)
      // const { subscriptionId, usageRemaining } = await checkAddonUsage(ctx.user.tenantId, PRODUCT_INTELLIGENCE_ADDON_ID);

      // 3. Generate intelligence using LLM
      const isArabic = input.language === "ar";
      
      const systemPrompt = isArabic
        ? `أنت خبير تسويق ومحلل منتجات. قم بتحليل المنتج وأنشئ ملف ذكاء منتج شامل. أجب بصيغة JSON فقط.`
        : `You are a marketing expert. Analyze the product and create a comprehensive intelligence profile. Respond in JSON only.`;

      const userPrompt = isArabic
        ? `حلل هذا المنتج:
الاسم: ${product.name}
الوصف: ${product.description || "غير متوفر"}
السعر: ${product.price}

أنشئ ملف ذكاء يتضمن:
1. category (الفئة)
2. targetAudience: { demographics, interests[], painPoints[] }
3. uniqueSellingPoints[] (3-5 نقاط)
4. pricingRange (budget/mid-range/premium/luxury)
5. toneOfVoice (professional/casual/playful/luxury/urgent/friendly)
6. visualStyle: { primaryColors[], style, imagery }
7. keywords[] (للإعلانات)
8. competitiveAdvantage`
        : `Analyze this product:
Name: ${product.name}
Description: ${product.description || "N/A"}
Price: ${product.price}

Create intelligence profile with:
1. category
2. targetAudience: { demographics, interests[], painPoints[] }
3. uniqueSellingPoints[] (3-5 points)
4. pricingRange (budget/mid-range/premium/luxury)
5. toneOfVoice (professional/casual/playful/luxury/urgent/friendly)
6. visualStyle: { primaryColors[], style, imagery }
7. keywords[] (for ads)
8. competitiveAdvantage`;

      const result = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "product_intelligence",
            strict: true,
            schema: {
              type: "object",
              properties: {
                category: { type: "string" },
                targetAudience: {
                  type: "object",
                  properties: {
                    demographics: { type: "string" },
                    interests: { type: "array", items: { type: "string" } },
                    painPoints: { type: "array", items: { type: "string" } },
                  },
                  required: ["demographics", "interests", "painPoints"],
                  additionalProperties: false,
                },
                uniqueSellingPoints: { type: "array", items: { type: "string" } },
                pricingRange: { type: "string" },
                toneOfVoice: { type: "string" },
                visualStyle: {
                  type: "object",
                  properties: {
                    primaryColors: { type: "array", items: { type: "string" } },
                    style: { type: "string" },
                    imagery: { type: "string" },
                  },
                  required: ["primaryColors", "style", "imagery"],
                  additionalProperties: false,
                },
                keywords: { type: "array", items: { type: "string" } },
                competitiveAdvantage: { type: "string" },
              },
              required: ["category", "targetAudience", "uniqueSellingPoints", "pricingRange", "toneOfVoice", "visualStyle", "keywords", "competitiveAdvantage"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = result.choices[0]?.message?.content;
      if (!content) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "فشل في توليد ذكاء المنتج" });
      }

      const intelligence = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));

      // 4. Save intelligence back to product (in a metadata field or separate column)
      // Since products table might not have ai_intelligence column, we'll store in description or create new approach
      // For now, we'll return and let the caller decide
      
      // Log usage
      await supabaseAdmin.from("ai_usage_logs").insert({
        tenant_id: ctx.user.tenantId,
        ai_addon_id: PRODUCT_INTELLIGENCE_ADDON_ID,
        action: "analyze_product",
        units_used: 1,
        metadata: {
          product_id: input.productId,
          tokens_used: result.usage?.total_tokens || 0,
        },
      });

      return {
        productId: input.productId,
        productName: product.name,
        intelligence,
        tokensUsed: result.usage?.total_tokens || 0,
      };
    }),

  // ============================================
  // Step 2: Generate Landing Page Content
  // ============================================
  generateLandingPage: tenantProcedure
    .input(z.object({
      productId: z.string().uuid(),
      intelligence: z.any(), // Product intelligence object
      language: z.enum(["ar", "en"]).optional().default("ar"),
    }))
    .mutation(async ({ ctx, input }) => {
      const { productId, intelligence, language } = input;
      const isArabic = language === "ar";

      // Get product name
      const { data: product } = await supabaseAdmin
        .from("products")
        .select("name, price, image_url")
        .eq("id", productId)
        .eq("tenant_id", ctx.user.tenantId)
        .single();

      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "المنتج غير موجود" });
      }

      const systemPrompt = isArabic
        ? `أنت خبير في تصميم صفحات الهبوط عالية التحويل. أنشئ محتوى صفحة هبوط كاملة. أجب بصيغة JSON فقط.`
        : `You are an expert in high-converting landing pages. Create complete landing page content. Respond in JSON only.`;

      const userPrompt = isArabic
        ? `بناءً على ذكاء المنتج التالي، أنشئ محتوى صفحة هبوط:

المنتج: ${product.name}
السعر: ${product.price}
الفئة: ${intelligence.category}
الجمهور: ${intelligence.targetAudience?.demographics}
نقاط البيع: ${intelligence.uniqueSellingPoints?.join(", ")}
نبرة الصوت: ${intelligence.toneOfVoice}

أنشئ:
1. headline (عنوان رئيسي جذاب)
2. subheadline
3. heroSection: { title, description, ctaText }
4. features[]: { title, description } (3-4 ميزات)
5. benefits[] (4-5 فوائد)
6. faq[]: { question, answer } (3-4 أسئلة)
7. finalCta: { title, description, buttonText }
8. designDirection: { primaryColor, secondaryColor, layoutStyle }`
        : `Based on this product intelligence, create landing page content:

Product: ${product.name}
Price: ${product.price}
Category: ${intelligence.category}
Audience: ${intelligence.targetAudience?.demographics}
USPs: ${intelligence.uniqueSellingPoints?.join(", ")}
Tone: ${intelligence.toneOfVoice}

Create:
1. headline
2. subheadline
3. heroSection: { title, description, ctaText }
4. features[]: { title, description } (3-4 features)
5. benefits[] (4-5 benefits)
6. faq[]: { question, answer } (3-4 FAQs)
7. finalCta: { title, description, buttonText }
8. designDirection: { primaryColor, secondaryColor, layoutStyle }`;

      const result = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "landing_page",
            strict: true,
            schema: {
              type: "object",
              properties: {
                headline: { type: "string" },
                subheadline: { type: "string" },
                heroSection: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    ctaText: { type: "string" },
                  },
                  required: ["title", "description", "ctaText"],
                  additionalProperties: false,
                },
                features: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      description: { type: "string" },
                    },
                    required: ["title", "description"],
                    additionalProperties: false,
                  },
                },
                benefits: { type: "array", items: { type: "string" } },
                faq: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question: { type: "string" },
                      answer: { type: "string" },
                    },
                    required: ["question", "answer"],
                    additionalProperties: false,
                  },
                },
                finalCta: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    buttonText: { type: "string" },
                  },
                  required: ["title", "description", "buttonText"],
                  additionalProperties: false,
                },
                designDirection: {
                  type: "object",
                  properties: {
                    primaryColor: { type: "string" },
                    secondaryColor: { type: "string" },
                    layoutStyle: { type: "string" },
                  },
                  required: ["primaryColor", "secondaryColor", "layoutStyle"],
                  additionalProperties: false,
                },
              },
              required: ["headline", "subheadline", "heroSection", "features", "benefits", "faq", "finalCta", "designDirection"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = result.choices[0]?.message?.content;
      if (!content) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "فشل في توليد صفحة الهبوط" });
      }

      const landingPageContent = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));

      // Log usage
      await supabaseAdmin.from("ai_usage_logs").insert({
        tenant_id: ctx.user.tenantId,
        ai_addon_id: LANDING_PAGE_ADDON_ID,
        action: "generate_landing_page",
        units_used: 1,
        metadata: {
          product_id: productId,
          tokens_used: result.usage?.total_tokens || 0,
        },
      });

      return {
        productId,
        content: landingPageContent,
        tokensUsed: result.usage?.total_tokens || 0,
      };
    }),

  // ============================================
  // Step 3: Generate Meta Ads
  // ============================================
  generateMetaAds: tenantProcedure
    .input(z.object({
      productId: z.string().uuid(),
      intelligence: z.any(),
      language: z.enum(["ar", "en"]).optional().default("ar"),
    }))
    .mutation(async ({ ctx, input }) => {
      const { productId, intelligence, language } = input;
      const isArabic = language === "ar";

      // Get product
      const { data: product } = await supabaseAdmin
        .from("products")
        .select("name, price, description, image_url")
        .eq("id", productId)
        .eq("tenant_id", ctx.user.tenantId)
        .single();

      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "المنتج غير موجود" });
      }

      const systemPrompt = isArabic
        ? `أنت خبير إعلانات Meta ومشتري وسائط محترف. أنشئ حملة إعلانية كاملة. أجب بصيغة JSON فقط.`
        : `You are a Meta ads expert and professional media buyer. Create a complete ad campaign. Respond in JSON only.`;

      const userPrompt = isArabic
        ? `بناءً على ذكاء المنتج، أنشئ حملة إعلانات Meta:

المنتج: ${product.name}
السعر: ${product.price}
الجمهور: ${intelligence.targetAudience?.demographics}
الاهتمامات: ${intelligence.targetAudience?.interests?.join(", ")}
نقاط الألم: ${intelligence.targetAudience?.painPoints?.join(", ")}
نقاط البيع: ${intelligence.uniqueSellingPoints?.join(", ")}
الكلمات المفتاحية: ${intelligence.keywords?.join(", ")}

أنشئ:
1. campaignObjective (awareness/traffic/engagement/leads/conversions)
2. adAngles[]: { angle, description, targetEmotion } (3 زوايا)
3. hooks[]: { text, type } (5 hooks - question/statement/statistic/story/urgency)
4. adCopies[]: { headline, primaryText, description, callToAction } (3 نسخ)
5. creativeBriefs[]: { format, concept, visualElements[] } (2 briefs - image/video)
6. audienceSuggestions[]: { name, interests[], demographics } (3 جماهير)`
        : `Based on product intelligence, create Meta ads campaign:

Product: ${product.name}
Price: ${product.price}
Audience: ${intelligence.targetAudience?.demographics}
Interests: ${intelligence.targetAudience?.interests?.join(", ")}
Pain Points: ${intelligence.targetAudience?.painPoints?.join(", ")}
USPs: ${intelligence.uniqueSellingPoints?.join(", ")}
Keywords: ${intelligence.keywords?.join(", ")}

Create:
1. campaignObjective (awareness/traffic/engagement/leads/conversions)
2. adAngles[]: { angle, description, targetEmotion } (3 angles)
3. hooks[]: { text, type } (5 hooks - question/statement/statistic/story/urgency)
4. adCopies[]: { headline, primaryText, description, callToAction } (3 copies)
5. creativeBriefs[]: { format, concept, visualElements[] } (2 briefs - image/video)
6. audienceSuggestions[]: { name, interests[], demographics } (3 audiences)`;

      const result = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "meta_ads",
            strict: true,
            schema: {
              type: "object",
              properties: {
                campaignObjective: { type: "string" },
                adAngles: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      angle: { type: "string" },
                      description: { type: "string" },
                      targetEmotion: { type: "string" },
                    },
                    required: ["angle", "description", "targetEmotion"],
                    additionalProperties: false,
                  },
                },
                hooks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      text: { type: "string" },
                      type: { type: "string" },
                    },
                    required: ["text", "type"],
                    additionalProperties: false,
                  },
                },
                adCopies: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      headline: { type: "string" },
                      primaryText: { type: "string" },
                      description: { type: "string" },
                      callToAction: { type: "string" },
                    },
                    required: ["headline", "primaryText", "description", "callToAction"],
                    additionalProperties: false,
                  },
                },
                creativeBriefs: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      format: { type: "string" },
                      concept: { type: "string" },
                      visualElements: { type: "array", items: { type: "string" } },
                    },
                    required: ["format", "concept", "visualElements"],
                    additionalProperties: false,
                  },
                },
                audienceSuggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      interests: { type: "array", items: { type: "string" } },
                      demographics: { type: "string" },
                    },
                    required: ["name", "interests", "demographics"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["campaignObjective", "adAngles", "hooks", "adCopies", "creativeBriefs", "audienceSuggestions"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = result.choices[0]?.message?.content;
      if (!content) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "فشل في توليد إعلانات Meta" });
      }

      const metaAdsContent = JSON.parse(typeof content === 'string' ? content : JSON.stringify(content));

      // Save to campaigns table
      const { data: campaign, error: campaignError } = await supabaseAdmin
        .from("campaigns")
        .insert({
          tenant_id: ctx.user.tenantId,
          name: `${product.name} - Meta Ads`,
          description: `AI-generated Meta ads campaign for ${product.name}`,
          platform: "meta",
          status: "draft",
          budget: 0,
          spent: 0,
          revenue: 0,
          orders_count: 0,
        })
        .select()
        .single();

      // Log usage
      await supabaseAdmin.from("ai_usage_logs").insert({
        tenant_id: ctx.user.tenantId,
        ai_addon_id: META_ADS_ADDON_ID,
        action: "generate_meta_ads",
        units_used: 1,
        metadata: {
          product_id: productId,
          campaign_id: campaign?.id,
          tokens_used: result.usage?.total_tokens || 0,
        },
      });

      return {
        productId,
        campaignId: campaign?.id,
        content: metaAdsContent,
        tokensUsed: result.usage?.total_tokens || 0,
      };
    }),

  // ============================================
  // Full Pipeline: Product → Intelligence → Landing → Ads
  // ============================================
  runFullPipeline: tenantProcedure
    .input(z.object({
      productId: z.string().uuid(),
      language: z.enum(["ar", "en"]).optional().default("ar"),
    }))
    .mutation(async ({ ctx, input }) => {
      const { productId, language } = input;

      // Step 1: Analyze Product
      const intelligenceResult = await supabaseAdmin
        .from("products")
        .select("*")
        .eq("id", productId)
        .eq("tenant_id", ctx.user.tenantId)
        .single();

      if (!intelligenceResult.data) {
        throw new TRPCError({ code: "NOT_FOUND", message: "المنتج غير موجود" });
      }

      // Generate intelligence
      const isArabic = language === "ar";
      const product = intelligenceResult.data;

      // Step 1: Product Intelligence
      const intelligencePrompt = isArabic
        ? `حلل هذا المنتج وأنشئ ملف ذكاء: ${product.name} - ${product.description || ""} - السعر: ${product.price}`
        : `Analyze this product and create intelligence profile: ${product.name} - ${product.description || ""} - Price: ${product.price}`;

      const intelligenceResponse = await invokeLLM({
        messages: [
          { role: "system", content: isArabic ? "أنت خبير تسويق. أجب بـ JSON فقط." : "You are a marketing expert. Respond in JSON only." },
          { role: "user", content: intelligencePrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "intelligence",
            strict: true,
            schema: {
              type: "object",
              properties: {
                category: { type: "string" },
                targetAudience: {
                  type: "object",
                  properties: {
                    demographics: { type: "string" },
                    interests: { type: "array", items: { type: "string" } },
                    painPoints: { type: "array", items: { type: "string" } },
                  },
                  required: ["demographics", "interests", "painPoints"],
                  additionalProperties: false,
                },
                uniqueSellingPoints: { type: "array", items: { type: "string" } },
                pricingRange: { type: "string" },
                toneOfVoice: { type: "string" },
                visualStyle: {
                  type: "object",
                  properties: {
                    primaryColors: { type: "array", items: { type: "string" } },
                    style: { type: "string" },
                    imagery: { type: "string" },
                  },
                  required: ["primaryColors", "style", "imagery"],
                  additionalProperties: false,
                },
                keywords: { type: "array", items: { type: "string" } },
                competitiveAdvantage: { type: "string" },
              },
              required: ["category", "targetAudience", "uniqueSellingPoints", "pricingRange", "toneOfVoice", "visualStyle", "keywords", "competitiveAdvantage"],
              additionalProperties: false,
            },
          },
        },
      });

      const intelligenceContent = intelligenceResponse.choices[0]?.message?.content;
      const intelligence = JSON.parse(typeof intelligenceContent === 'string' ? intelligenceContent : '{}');

      // Step 2: Landing Page
      const landingPrompt = isArabic
        ? `أنشئ محتوى صفحة هبوط للمنتج: ${product.name}. الجمهور: ${intelligence.targetAudience?.demographics}. نقاط البيع: ${intelligence.uniqueSellingPoints?.join(", ")}`
        : `Create landing page content for: ${product.name}. Audience: ${intelligence.targetAudience?.demographics}. USPs: ${intelligence.uniqueSellingPoints?.join(", ")}`;

      const landingResponse = await invokeLLM({
        messages: [
          { role: "system", content: isArabic ? "أنت خبير صفحات هبوط. أجب بـ JSON فقط." : "You are a landing page expert. Respond in JSON only." },
          { role: "user", content: landingPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "landing",
            strict: true,
            schema: {
              type: "object",
              properties: {
                headline: { type: "string" },
                subheadline: { type: "string" },
                ctaText: { type: "string" },
                features: { type: "array", items: { type: "string" } },
                benefits: { type: "array", items: { type: "string" } },
              },
              required: ["headline", "subheadline", "ctaText", "features", "benefits"],
              additionalProperties: false,
            },
          },
        },
      });

      const landingContent = landingResponse.choices[0]?.message?.content;
      const landingPage = JSON.parse(typeof landingContent === 'string' ? landingContent : '{}');

      // Step 3: Meta Ads
      const adsPrompt = isArabic
        ? `أنشئ 3 نسخ إعلانية Meta للمنتج: ${product.name}. الجمهور: ${intelligence.targetAudience?.demographics}. الكلمات: ${intelligence.keywords?.join(", ")}`
        : `Create 3 Meta ad copies for: ${product.name}. Audience: ${intelligence.targetAudience?.demographics}. Keywords: ${intelligence.keywords?.join(", ")}`;

      const adsResponse = await invokeLLM({
        messages: [
          { role: "system", content: isArabic ? "أنت خبير إعلانات Meta. أجب بـ JSON فقط." : "You are a Meta ads expert. Respond in JSON only." },
          { role: "user", content: adsPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "ads",
            strict: true,
            schema: {
              type: "object",
              properties: {
                campaignObjective: { type: "string" },
                adCopies: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      headline: { type: "string" },
                      primaryText: { type: "string" },
                      callToAction: { type: "string" },
                    },
                    required: ["headline", "primaryText", "callToAction"],
                    additionalProperties: false,
                  },
                },
                hooks: { type: "array", items: { type: "string" } },
              },
              required: ["campaignObjective", "adCopies", "hooks"],
              additionalProperties: false,
            },
          },
        },
      });

      const adsContent = adsResponse.choices[0]?.message?.content;
      const metaAds = JSON.parse(typeof adsContent === 'string' ? adsContent : '{}');

      // Save campaign to Supabase
      const { data: campaign } = await supabaseAdmin
        .from("campaigns")
        .insert({
          tenant_id: ctx.user.tenantId,
          name: `${product.name} - AI Campaign`,
          description: JSON.stringify({ intelligence, landingPage, metaAds }),
          platform: "meta",
          status: "draft",
          budget: 0,
          spent: 0,
          revenue: 0,
          orders_count: 0,
        })
        .select()
        .single();

      // Log all usage
      await supabaseAdmin.from("ai_usage_logs").insert({
        tenant_id: ctx.user.tenantId,
        ai_addon_id: PRODUCT_INTELLIGENCE_ADDON_ID,
        action: "full_pipeline",
        units_used: 3,
        metadata: {
          product_id: productId,
          campaign_id: campaign?.id,
          total_tokens: (intelligenceResponse.usage?.total_tokens || 0) + 
                       (landingResponse.usage?.total_tokens || 0) + 
                       (adsResponse.usage?.total_tokens || 0),
        },
      });

      return {
        productId,
        productName: product.name,
        campaignId: campaign?.id,
        intelligence,
        landingPage,
        metaAds,
        totalTokensUsed: (intelligenceResponse.usage?.total_tokens || 0) + 
                        (landingResponse.usage?.total_tokens || 0) + 
                        (adsResponse.usage?.total_tokens || 0),
      };
    }),
});
