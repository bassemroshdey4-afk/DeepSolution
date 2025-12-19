import { z } from "zod";
import { router, tenantProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  analyzeProduct,
  getProductIntelligence,
  getProductIntelligenceHistory,
  getProductIntelligenceVersion,
  compareIntelligenceVersions,
  analyzeProductsBatch,
} from "./productIntelligenceService";
import { supabaseAdmin } from "./supabase";

// ============================================
// Product Intelligence Router
// ============================================
// AI acts as ANALYZER only - provides structured data
// All outputs are versioned and auditable
// ============================================

export const productIntelligenceRouter = router({
  // ============================================
  // Analyze a product
  // ============================================
  analyze: tenantProcedure
    .input(
      z.object({
        productId: z.string(),
        forceReanalyze: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get product details
      const { data: product, error: productError } = await supabaseAdmin
        .from("products")
        .select("*")
        .eq("id", input.productId)
        .eq("tenant_id", ctx.tenantId)
        .single();

      if (productError || !product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Product not found",
        });
      }

      // Analyze product
      const intelligence = await analyzeProduct(
        {
          productId: product.id,
          tenantId: ctx.tenantId,
          name: product.name,
          description: product.description || undefined,
          imageUrls: product.image_url ? [product.image_url] : undefined,
          price: product.price,
          category: product.category || undefined,
        },
        {
          forceReanalyze: input.forceReanalyze,
          createdBy: ctx.user?.id,
        }
      );

      return intelligence;
    }),

  // ============================================
  // Analyze with custom input (for products not yet saved)
  // ============================================
  analyzeCustom: tenantProcedure
    .input(
      z.object({
        productId: z.string().optional(), // Optional - can be temporary ID
        name: z.string(),
        description: z.string().optional(),
        imageUrls: z.array(z.string()).optional(),
        price: z.number().optional(),
        category: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const productId = input.productId || `temp_${Date.now()}`;

      const intelligence = await analyzeProduct(
        {
          productId,
          tenantId: ctx.tenantId,
          name: input.name,
          description: input.description,
          imageUrls: input.imageUrls,
          price: input.price,
          category: input.category,
        },
        {
          createdBy: ctx.user?.id,
        }
      );

      return intelligence;
    }),

  // ============================================
  // Get latest intelligence for a product
  // ============================================
  get: tenantProcedure
    .input(z.object({ productId: z.string() }))
    .query(async ({ ctx, input }) => {
      const intelligence = await getProductIntelligence(input.productId, ctx.tenantId);
      return intelligence;
    }),

  // ============================================
  // Get intelligence history for a product
  // ============================================
  getHistory: tenantProcedure
    .input(
      z.object({
        productId: z.string(),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      const history = await getProductIntelligenceHistory(
        input.productId,
        ctx.tenantId,
        input.limit
      );
      return history;
    }),

  // ============================================
  // Get specific version
  // ============================================
  getVersion: tenantProcedure
    .input(
      z.object({
        productId: z.string(),
        version: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const intelligence = await getProductIntelligenceVersion(
        input.productId,
        ctx.tenantId,
        input.version
      );

      if (!intelligence) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Version ${input.version} not found`,
        });
      }

      return intelligence;
    }),

  // ============================================
  // Compare two versions
  // ============================================
  compareVersions: tenantProcedure
    .input(
      z.object({
        productId: z.string(),
        versionA: z.number(),
        versionB: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const comparison = await compareIntelligenceVersions(
        input.productId,
        ctx.tenantId,
        input.versionA,
        input.versionB
      );
      return comparison;
    }),

  // ============================================
  // Batch analyze multiple products
  // ============================================
  analyzeBatch: tenantProcedure
    .input(
      z.object({
        productIds: z.array(z.string()).min(1).max(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get all products
      const { data: products, error } = await supabaseAdmin
        .from("products")
        .select("*")
        .in("id", input.productIds)
        .eq("tenant_id", ctx.tenantId);

      if (error || !products || products.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No products found",
        });
      }

      // Prepare inputs
      const inputs = products.map((product) => ({
        productId: product.id,
        tenantId: ctx.tenantId,
        name: product.name,
        description: product.description || undefined,
        imageUrls: product.image_url ? [product.image_url] : undefined,
        price: product.price,
        category: product.category || undefined,
      }));

      // Batch analyze
      const result = await analyzeProductsBatch(inputs, {
        createdBy: ctx.user?.id,
      });

      return result;
    }),

  // ============================================
  // List all intelligence records for tenant
  // ============================================
  list: tenantProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        productId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.limit;

      let query = supabaseAdmin
        .from("product_intelligence")
        .select("*", { count: "exact" })
        .eq("tenant_id", ctx.tenantId)
        .order("created_at", { ascending: false });

      if (input.productId) {
        query = query.eq("product_id", input.productId);
      }

      const { data, error, count } = await query.range(offset, offset + input.limit - 1);

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      return {
        items: data || [],
        total: count || 0,
        page: input.page,
        limit: input.limit,
        totalPages: Math.ceil((count || 0) / input.limit),
      };
    }),

  // ============================================
  // Get aggregated insights across products
  // ============================================
  getAggregatedInsights: tenantProcedure.query(async ({ ctx }) => {
    // Get latest intelligence for all products
    const { data, error } = await supabaseAdmin
      .from("product_intelligence")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) {
      return {
        totalProducts: 0,
        averageConfidence: 0,
        topKeywords: [],
        audienceBreakdown: {},
        priceSensitivityDistribution: {},
      };
    }

    // Get unique products (latest version only)
    const latestByProduct = new Map<string, any>();
    for (const record of data) {
      if (!latestByProduct.has(record.product_id)) {
        latestByProduct.set(record.product_id, record);
      }
    }

    const latestRecords = Array.from(latestByProduct.values());

    // Aggregate keywords
    const keywordCounts = new Map<string, number>();
    for (const record of latestRecords) {
      const keywords = record.keywords?.primary || [];
      for (const keyword of keywords) {
        keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
      }
    }

    const topKeywords = Array.from(keywordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([keyword, count]) => ({ keyword, count }));

    // Audience breakdown
    const audienceBreakdown: Record<string, number> = {};
    for (const record of latestRecords) {
      const gender = record.audience?.gender || "unknown";
      audienceBreakdown[gender] = (audienceBreakdown[gender] || 0) + 1;
    }

    // Price sensitivity distribution
    const priceSensitivityDistribution: Record<string, number> = {};
    for (const record of latestRecords) {
      const level = record.price_sensitivity?.level || "unknown";
      priceSensitivityDistribution[level] = (priceSensitivityDistribution[level] || 0) + 1;
    }

    // Average confidence
    const totalConfidence = latestRecords.reduce((sum, r) => sum + (r.confidence || 0), 0);
    const averageConfidence = latestRecords.length > 0 ? totalConfidence / latestRecords.length : 0;

    return {
      totalProducts: latestRecords.length,
      averageConfidence: Math.round(averageConfidence),
      topKeywords,
      audienceBreakdown,
      priceSensitivityDistribution,
    };
  }),
});
