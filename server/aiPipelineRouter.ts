import { z } from "zod";
import { router, tenantProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { supabaseAdmin } from "./supabase";
import { invokeLLM } from "./_core/llm";

// ============================================
// AI Pipeline Router - Golden Path
// ============================================
// Data persistence:
// - Product Intelligence → stored in ai_pipeline_outputs (type: 'intelligence')
// - Landing Page → stored in ai_pipeline_outputs (type: 'landing_page')
// - Meta Ads → stored in ai_pipeline_outputs (type: 'meta_ads') + campaigns table
// 
// All outputs are versioned and never overwritten.
// Each stage checks AI Add-on subscription and deducts usage.
// ============================================

// AI Add-on IDs (must match ai_addons table)
const AI_ADDON_IDS = {
  PRODUCT_INTELLIGENCE: "product-intelligence",
  LANDING_PAGE: "landing-page-generator", 
  META_ADS: "meta-ads-generator",
};

// ============================================
// Helper: Check addon subscription and usage
// ============================================
async function checkAndDeductUsage(
  tenantId: string,
  addonSlug: string,
  action: string,
  metadata: Record<string, unknown>
): Promise<{ subscriptionId: string; addonId: string }> {
  // 1. Find the addon by slug
  const { data: addon, error: addonError } = await supabaseAdmin
    .from("ai_addons")
    .select("id, name")
    .eq("slug", addonSlug)
    .single();

  if (addonError || !addon) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `الإضافة "${addonSlug}" غير موجودة في النظام`,
    });
  }

  // 2. Check subscription
  const { data: subscription, error: subError } = await supabaseAdmin
    .from("tenant_ai_subscriptions")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("ai_addon_id", addon.id)
    .in("status", ["active", "trial"])
    .single();

  if (subError || !subscription) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `يجب تفعيل إضافة "${addon.name}" لاستخدام هذه الميزة. اذهب إلى صفحة إضافات AI.`,
    });
  }

  // 3. Check expiry
  if (subscription.expires_at && new Date(subscription.expires_at) < new Date()) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `انتهت صلاحية اشتراك "${addon.name}". يرجى التجديد.`,
    });
  }

  // 4. Check usage remaining
  if (subscription.usage_remaining < 1) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `استنفدت حد استخدام "${addon.name}". يرجى الترقية أو شراء المزيد.`,
    });
  }

  // 5. Deduct usage
  const { error: updateError } = await supabaseAdmin
    .from("tenant_ai_subscriptions")
    .update({ 
      usage_remaining: subscription.usage_remaining - 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscription.id);

  if (updateError) {
    console.error("Error deducting usage:", updateError);
  }

  // 6. Log usage
  await supabaseAdmin.from("ai_usage_logs").insert({
    tenant_id: tenantId,
    ai_addon_id: addon.id,
    subscription_id: subscription.id,
    action,
    units_used: 1,
    metadata,
  });

  return { subscriptionId: subscription.id, addonId: addon.id };
}

// ============================================
// In-memory storage for pipeline outputs (fallback when table doesn't exist)
// In production, this should be persisted to a proper table
// ============================================
const pipelineOutputsCache = new Map<string, { content: unknown; version: number; metadata: Record<string, unknown>; createdAt: Date }[]>();

function getCacheKey(tenantId: string, productId: string, outputType: string): string {
  return `${tenantId}:${productId}:${outputType}`;
}

// ============================================
// Helper: Save pipeline output (versioned)
// ============================================
async function savePipelineOutput(
  tenantId: string,
  productId: string,
  outputType: "intelligence" | "landing_page" | "meta_ads",
  content: unknown,
  metadata: Record<string, unknown> = {}
): Promise<string> {
  // Try to save to ai_pipeline_outputs table first
  try {
    // Get current version count
    const { count } = await supabaseAdmin
      .from("ai_pipeline_outputs")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("product_id", productId)
      .eq("output_type", outputType);

    const version = (count || 0) + 1;

    // Insert new version
    const { data, error } = await supabaseAdmin
      .from("ai_pipeline_outputs")
      .insert({
        tenant_id: tenantId,
        product_id: productId,
        output_type: outputType,
        version,
        content,
        metadata,
      })
      .select()
      .single();

    if (!error && data) {
      return data.id;
    }
  } catch {
    // Table doesn't exist, use fallback
  }

  // Fallback: use in-memory cache
  const key = getCacheKey(tenantId, productId, outputType);
  const existing = pipelineOutputsCache.get(key) || [];
  const version = existing.length + 1;
  
  existing.push({
    content,
    version,
    metadata,
    createdAt: new Date(),
  });
  
  pipelineOutputsCache.set(key, existing);
  console.log(`[Pipeline] Saved ${outputType} v${version} for product ${productId} (in-memory)`);
  
  return `cache:${version}`;
}

// ============================================
// Helper: Get latest pipeline output
// ============================================
async function getLatestOutput(
  tenantId: string,
  productId: string,
  outputType: "intelligence" | "landing_page" | "meta_ads"
): Promise<{ content: unknown; version: number } | null> {
  // Try database first
  try {
    const { data, error } = await supabaseAdmin
      .from("ai_pipeline_outputs")
      .select("content, version")
      .eq("tenant_id", tenantId)
      .eq("product_id", productId)
      .eq("output_type", outputType)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    if (!error && data) {
      return { content: data.content, version: data.version };
    }
  } catch {
    // Table doesn't exist
  }

  // Fallback: check in-memory cache
  const key = getCacheKey(tenantId, productId, outputType);
  const cached = pipelineOutputsCache.get(key);
  
  if (cached && cached.length > 0) {
    const latest = cached[cached.length - 1];
    return { content: latest.content, version: latest.version };
  }

  return null;
}

export const aiPipelineRouter = router({
  // ============================================
  // Step 1: Analyze Product → Product Intelligence
  // ============================================
  analyzeProduct: tenantProcedure
    .input(z.object({
      productId: z.string().uuid(),
      language: z.enum(["ar", "en"]).optional().default("ar"),
      forceRegenerate: z.boolean().optional().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const { productId, language, forceRegenerate } = input;
      const tenantId = ctx.tenantId;

      // 1. Get product from Supabase
      const { data: product, error: productError } = await supabaseAdmin
        .from("products")
        .select("*")
        .eq("id", productId)
        .eq("tenant_id", tenantId)
        .single();

      if (productError || !product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "المنتج غير موجود" });
      }

      // 2. Check if we have existing intelligence (unless force regenerate)
      if (!forceRegenerate) {
        const existing = await getLatestOutput(tenantId, productId, "intelligence");
        if (existing) {
          return {
            productId,
            productName: product.name,
            intelligence: existing.content,
            version: existing.version,
            fromCache: true,
            tokensUsed: 0,
          };
        }
      }

      // 3. Check and deduct usage
      const { addonId } = await checkAndDeductUsage(
        tenantId,
        AI_ADDON_IDS.PRODUCT_INTELLIGENCE,
        "analyze_product",
        { product_id: productId, language }
      );

      // 4. Generate intelligence using LLM
      const isArabic = language === "ar";
      
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
2. subcategory (الفئة الفرعية)
3. targetAudience: { demographics, interests[], painPoints[] }
4. uniqueSellingPoints[] (3-5 نقاط)
5. pricingRange (budget/mid-range/premium/luxury)
6. toneOfVoice (professional/casual/playful/luxury/urgent/friendly)
7. visualStyle: { primaryColors[], style, imagery }
8. keywords[] (للإعلانات)
9. competitiveAdvantage`
        : `Analyze this product:
Name: ${product.name}
Description: ${product.description || "N/A"}
Price: ${product.price}

Create intelligence profile with:
1. category
2. subcategory
3. targetAudience: { demographics, interests[], painPoints[] }
4. uniqueSellingPoints[] (3-5 points)
5. pricingRange (budget/mid-range/premium/luxury)
6. toneOfVoice (professional/casual/playful/luxury/urgent/friendly)
7. visualStyle: { primaryColors[], style, imagery }
8. keywords[] (for ads)
9. competitiveAdvantage`;

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
                subcategory: { type: "string" },
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
              required: ["category", "subcategory", "targetAudience", "uniqueSellingPoints", "pricingRange", "toneOfVoice", "visualStyle", "keywords", "competitiveAdvantage"],
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

      // 5. Save output (versioned)
      await savePipelineOutput(tenantId, productId, "intelligence", intelligence, {
        tokens_used: result.usage?.total_tokens || 0,
        language,
      });

      // 6. Get version
      const saved = await getLatestOutput(tenantId, productId, "intelligence");

      return {
        productId,
        productName: product.name,
        intelligence,
        version: saved?.version || 1,
        fromCache: false,
        tokensUsed: result.usage?.total_tokens || 0,
      };
    }),

  // ============================================
  // Step 2: Generate Landing Page
  // ============================================
  generateLandingPage: tenantProcedure
    .input(z.object({
      productId: z.string().uuid(),
      language: z.enum(["ar", "en"]).optional().default("ar"),
      forceRegenerate: z.boolean().optional().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const { productId, language, forceRegenerate } = input;
      const tenantId = ctx.tenantId;

      // 1. Get product
      const { data: product } = await supabaseAdmin
        .from("products")
        .select("name, price, description, image_url")
        .eq("id", productId)
        .eq("tenant_id", tenantId)
        .single();

      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "المنتج غير موجود" });
      }

      // 2. Get product intelligence (required)
      const intelligenceOutput = await getLatestOutput(tenantId, productId, "intelligence");
      if (!intelligenceOutput) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "يجب تحليل المنتج أولاً (Product Intelligence)",
        });
      }
      const intelligence = intelligenceOutput.content as Record<string, unknown>;

      // 3. Check cache
      if (!forceRegenerate) {
        const existing = await getLatestOutput(tenantId, productId, "landing_page");
        if (existing) {
          return {
            productId,
            content: existing.content,
            version: existing.version,
            fromCache: true,
            tokensUsed: 0,
          };
        }
      }

      // 4. Check and deduct usage
      await checkAndDeductUsage(
        tenantId,
        AI_ADDON_IDS.LANDING_PAGE,
        "generate_landing_page",
        { product_id: productId, language }
      );

      // 5. Generate landing page
      const isArabic = language === "ar";
      const targetAudience = intelligence.targetAudience as Record<string, unknown> | undefined;
      const uniqueSellingPoints = intelligence.uniqueSellingPoints as string[] | undefined;

      const systemPrompt = isArabic
        ? `أنت خبير في تصميم صفحات الهبوط عالية التحويل. أنشئ محتوى صفحة هبوط كاملة. أجب بصيغة JSON فقط.`
        : `You are an expert in high-converting landing pages. Create complete landing page content. Respond in JSON only.`;

      const userPrompt = isArabic
        ? `بناءً على ذكاء المنتج التالي، أنشئ محتوى صفحة هبوط:

المنتج: ${product.name}
السعر: ${product.price}
الفئة: ${intelligence.category}
الجمهور: ${targetAudience?.demographics || ""}
نقاط البيع: ${uniqueSellingPoints?.join(", ") || ""}
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
Audience: ${targetAudience?.demographics || ""}
USPs: ${uniqueSellingPoints?.join(", ") || ""}
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

      // 6. Save output
      await savePipelineOutput(tenantId, productId, "landing_page", landingPageContent, {
        tokens_used: result.usage?.total_tokens || 0,
        language,
        intelligence_version: intelligenceOutput.version,
      });

      const saved = await getLatestOutput(tenantId, productId, "landing_page");

      return {
        productId,
        content: landingPageContent,
        version: saved?.version || 1,
        fromCache: false,
        tokensUsed: result.usage?.total_tokens || 0,
      };
    }),

  // ============================================
  // Step 3: Generate Meta Ads
  // ============================================
  generateMetaAds: tenantProcedure
    .input(z.object({
      productId: z.string().uuid(),
      language: z.enum(["ar", "en"]).optional().default("ar"),
      forceRegenerate: z.boolean().optional().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const { productId, language, forceRegenerate } = input;
      const tenantId = ctx.tenantId;

      // 1. Get product
      const { data: product } = await supabaseAdmin
        .from("products")
        .select("name, price, description, image_url")
        .eq("id", productId)
        .eq("tenant_id", tenantId)
        .single();

      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "المنتج غير موجود" });
      }

      // 2. Get product intelligence (required)
      const intelligenceOutput = await getLatestOutput(tenantId, productId, "intelligence");
      if (!intelligenceOutput) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "يجب تحليل المنتج أولاً (Product Intelligence)",
        });
      }
      const intelligence = intelligenceOutput.content as Record<string, unknown>;

      // 3. Check cache
      if (!forceRegenerate) {
        const existing = await getLatestOutput(tenantId, productId, "meta_ads");
        if (existing) {
          return {
            productId,
            content: existing.content,
            version: existing.version,
            fromCache: true,
            tokensUsed: 0,
          };
        }
      }

      // 4. Check and deduct usage
      await checkAndDeductUsage(
        tenantId,
        AI_ADDON_IDS.META_ADS,
        "generate_meta_ads",
        { product_id: productId, language }
      );

      // 5. Generate Meta ads
      const isArabic = language === "ar";
      const targetAudience = intelligence.targetAudience as Record<string, unknown> | undefined;
      const uniqueSellingPoints = intelligence.uniqueSellingPoints as string[] | undefined;
      const keywords = intelligence.keywords as string[] | undefined;

      const systemPrompt = isArabic
        ? `أنت خبير إعلانات Meta ومشتري وسائط محترف. أنشئ حملة إعلانية كاملة. أجب بصيغة JSON فقط.`
        : `You are a Meta ads expert and professional media buyer. Create a complete ad campaign. Respond in JSON only.`;

      const userPrompt = isArabic
        ? `بناءً على ذكاء المنتج، أنشئ حملة إعلانات Meta:

المنتج: ${product.name}
السعر: ${product.price}
الجمهور: ${targetAudience?.demographics || ""}
الاهتمامات: ${(targetAudience?.interests as string[])?.join(", ") || ""}
نقاط الألم: ${(targetAudience?.painPoints as string[])?.join(", ") || ""}
نقاط البيع: ${uniqueSellingPoints?.join(", ") || ""}
الكلمات المفتاحية: ${keywords?.join(", ") || ""}

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
Audience: ${targetAudience?.demographics || ""}
Interests: ${(targetAudience?.interests as string[])?.join(", ") || ""}
Pain Points: ${(targetAudience?.painPoints as string[])?.join(", ") || ""}
USPs: ${uniqueSellingPoints?.join(", ") || ""}
Keywords: ${keywords?.join(", ") || ""}

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

      // 6. Save to ai_pipeline_outputs
      await savePipelineOutput(tenantId, productId, "meta_ads", metaAdsContent, {
        tokens_used: result.usage?.total_tokens || 0,
        language,
        intelligence_version: intelligenceOutput.version,
      });

      // 7. Also save to campaigns table
      const { data: campaign } = await supabaseAdmin
        .from("campaigns")
        .insert({
          tenant_id: tenantId,
          name: `${product.name} - Meta Ads`,
          description: JSON.stringify(metaAdsContent),
          platform: "meta",
          status: "draft",
          budget: 0,
          spent: 0,
          revenue: 0,
          orders_count: 0,
        })
        .select()
        .single();

      const saved = await getLatestOutput(tenantId, productId, "meta_ads");

      return {
        productId,
        campaignId: campaign?.id,
        content: metaAdsContent,
        version: saved?.version || 1,
        fromCache: false,
        tokensUsed: result.usage?.total_tokens || 0,
      };
    }),

  // ============================================
  // Full Pipeline (all 3 steps) - Inline implementation to avoid circular reference
  // ============================================
  runFullPipeline: tenantProcedure
    .input(z.object({
      productId: z.string().uuid(),
      language: z.enum(["ar", "en"]).optional().default("ar"),
      forceRegenerate: z.boolean().optional().default(false),
    }))
    .mutation(async ({ ctx, input }): Promise<{
      productId: string;
      productName: string;
      intelligence: { data: unknown; version: number; fromCache: boolean };
      landingPage: { data: unknown; version: number; fromCache: boolean };
      metaAds: { data: unknown; version: number; campaignId?: string; fromCache: boolean };
      totalTokensUsed: number;
    }> => {
      const { productId, language, forceRegenerate } = input;
      const tenantId = ctx.tenantId;

      // Get product first
      const { data: product } = await supabaseAdmin
        .from("products")
        .select("*")
        .eq("id", productId)
        .eq("tenant_id", tenantId)
        .single();

      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "المنتج غير موجود" });
      }

      let totalTokens = 0;
      const isArabic = language === "ar";

      // ===== Step 1: Intelligence =====
      let intelligenceData: unknown;
      let intelligenceVersion = 0;
      let intelligenceFromCache = false;

      if (!forceRegenerate) {
        const existing = await getLatestOutput(tenantId, productId, "intelligence");
        if (existing) {
          intelligenceData = existing.content;
          intelligenceVersion = existing.version;
          intelligenceFromCache = true;
        }
      }

      if (!intelligenceData) {
        await checkAndDeductUsage(tenantId, AI_ADDON_IDS.PRODUCT_INTELLIGENCE, "analyze_product", { product_id: productId });
        
        const result = await invokeLLM({
          messages: [
            { role: "system", content: isArabic ? "أنت خبير تسويق. حلل المنتج وأنشئ ملف ذكاء. أجب بـ JSON فقط." : "You are a marketing expert. Analyze and create intelligence profile. JSON only." },
            { role: "user", content: `Product: ${product.name}\nDescription: ${product.description || "N/A"}\nPrice: ${product.price}` },
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
                  keywords: { type: "array", items: { type: "string" } },
                },
                required: ["category", "targetAudience", "uniqueSellingPoints", "keywords"],
                additionalProperties: false,
              },
            },
          },
        });
        
        const content = result.choices[0]?.message?.content;
        intelligenceData = JSON.parse(typeof content === "string" ? content : "{}");
        totalTokens += result.usage?.total_tokens || 0;
        
        await savePipelineOutput(tenantId, productId, "intelligence", intelligenceData, { tokens: totalTokens });
        const saved = await getLatestOutput(tenantId, productId, "intelligence");
        intelligenceVersion = saved?.version || 1;
      }

      const intel = intelligenceData as Record<string, unknown>;

      // ===== Step 2: Landing Page =====
      let landingData: unknown;
      let landingVersion = 0;
      let landingFromCache = false;

      if (!forceRegenerate) {
        const existing = await getLatestOutput(tenantId, productId, "landing_page");
        if (existing) {
          landingData = existing.content;
          landingVersion = existing.version;
          landingFromCache = true;
        }
      }

      if (!landingData) {
        await checkAndDeductUsage(tenantId, AI_ADDON_IDS.LANDING_PAGE, "generate_landing_page", { product_id: productId });
        
        const result = await invokeLLM({
          messages: [
            { role: "system", content: isArabic ? "أنت خبير صفحات هبوط. أنشئ محتوى صفحة. JSON فقط." : "Landing page expert. Create content. JSON only." },
            { role: "user", content: `Product: ${product.name}\nCategory: ${intel.category}\nUSPs: ${(intel.uniqueSellingPoints as string[])?.join(", ")}` },
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
        
        const content = result.choices[0]?.message?.content;
        landingData = JSON.parse(typeof content === "string" ? content : "{}");
        totalTokens += result.usage?.total_tokens || 0;
        
        await savePipelineOutput(tenantId, productId, "landing_page", landingData, { tokens: result.usage?.total_tokens });
        const saved = await getLatestOutput(tenantId, productId, "landing_page");
        landingVersion = saved?.version || 1;
      }

      // ===== Step 3: Meta Ads =====
      let adsData: unknown;
      let adsVersion = 0;
      let adsFromCache = false;
      let campaignId: string | undefined;

      if (!forceRegenerate) {
        const existing = await getLatestOutput(tenantId, productId, "meta_ads");
        if (existing) {
          adsData = existing.content;
          adsVersion = existing.version;
          adsFromCache = true;
        }
      }

      if (!adsData) {
        await checkAndDeductUsage(tenantId, AI_ADDON_IDS.META_ADS, "generate_meta_ads", { product_id: productId });
        
        const result = await invokeLLM({
          messages: [
            { role: "system", content: isArabic ? "أنت خبير إعلانات Meta. أنشئ حملة. JSON فقط." : "Meta ads expert. Create campaign. JSON only." },
            { role: "user", content: `Product: ${product.name}\nKeywords: ${(intel.keywords as string[])?.join(", ")}` },
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
                  hooks: { type: "array", items: { type: "string" } },
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
                },
                required: ["campaignObjective", "hooks", "adCopies"],
                additionalProperties: false,
              },
            },
          },
        });
        
        const content = result.choices[0]?.message?.content;
        adsData = JSON.parse(typeof content === "string" ? content : "{}");
        totalTokens += result.usage?.total_tokens || 0;
        
        await savePipelineOutput(tenantId, productId, "meta_ads", adsData, { tokens: result.usage?.total_tokens });
        const saved = await getLatestOutput(tenantId, productId, "meta_ads");
        adsVersion = saved?.version || 1;

        // Save to campaigns
        const { data: campaign } = await supabaseAdmin
          .from("campaigns")
          .insert({
            tenant_id: tenantId,
            name: `${product.name} - Meta Ads`,
            description: JSON.stringify(adsData),
            platform: "meta",
            status: "draft",
            budget: 0,
            spent: 0,
            revenue: 0,
            orders_count: 0,
          })
          .select()
          .single();
        campaignId = campaign?.id;
      }

      return {
        productId,
        productName: product.name,
        intelligence: { data: intelligenceData, version: intelligenceVersion, fromCache: intelligenceFromCache },
        landingPage: { data: landingData, version: landingVersion, fromCache: landingFromCache },
        metaAds: { data: adsData, version: adsVersion, campaignId, fromCache: adsFromCache },
        totalTokensUsed: totalTokens,
      };
    }),

  // ============================================
  // Get Pipeline Status for a Product
  // ============================================
  getProductPipelineStatus: tenantProcedure
    .input(z.object({ productId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { productId } = input;
      const tenantId = ctx.tenantId;

      const intelligence = await getLatestOutput(tenantId, productId, "intelligence");
      const landingPage = await getLatestOutput(tenantId, productId, "landing_page");
      const metaAds = await getLatestOutput(tenantId, productId, "meta_ads");

      return {
        productId,
        stages: {
          intelligence: intelligence ? { version: intelligence.version, ready: true } : { version: 0, ready: false },
          landingPage: landingPage ? { version: landingPage.version, ready: true } : { version: 0, ready: false },
          metaAds: metaAds ? { version: metaAds.version, ready: true } : { version: 0, ready: false },
        },
      };
    }),

  // ============================================
  // Get All Versions of an Output
  // ============================================
  getOutputVersions: tenantProcedure
    .input(z.object({
      productId: z.string().uuid(),
      outputType: z.enum(["intelligence", "landing_page", "meta_ads"]),
    }))
    .query(async ({ ctx, input }) => {
      const { productId, outputType } = input;
      const tenantId = ctx.tenantId;

      const { data, error } = await supabaseAdmin
        .from("ai_pipeline_outputs")
        .select("id, version, created_at, metadata")
        .eq("tenant_id", tenantId)
        .eq("product_id", productId)
        .eq("output_type", outputType)
        .order("version", { ascending: false });

      if (error) {
        return [];
      }

      return data || [];
    }),

  // ============================================
  // Get Specific Version Content
  // ============================================
  getOutputByVersion: tenantProcedure
    .input(z.object({
      productId: z.string().uuid(),
      outputType: z.enum(["intelligence", "landing_page", "meta_ads"]),
      version: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const { productId, outputType, version } = input;
      const tenantId = ctx.tenantId;

      const { data, error } = await supabaseAdmin
        .from("ai_pipeline_outputs")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("product_id", productId)
        .eq("output_type", outputType)
        .eq("version", version)
        .single();

      if (error || !data) {
        throw new TRPCError({ code: "NOT_FOUND", message: "الإصدار غير موجود" });
      }

      return data;
    }),

  // ============================================
  // Get Usage Stats
  // ============================================
  getUsageStats: tenantProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.tenantId;

    // Get all AI subscriptions
    const { data: subscriptions } = await supabaseAdmin
      .from("tenant_ai_subscriptions")
      .select(`
        *,
        ai_addons (name, slug)
      `)
      .eq("tenant_id", tenantId)
      .in("status", ["active", "trial"]);

    // Get recent usage
    const { data: recentUsage } = await supabaseAdmin
      .from("ai_usage_logs")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(10);

    return {
      subscriptions: subscriptions || [],
      recentUsage: recentUsage || [],
    };
  }),
});
