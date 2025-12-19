/**
 * Landing Page Router - tRPC endpoints for Block 3
 * 
 * Provides API endpoints for generating, managing, and publishing landing pages.
 */

import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import { landingPageService, SectionContent } from "./landingPageEngine";
import { TRPCError } from "@trpc/server";

// ============================================
// INPUT SCHEMAS
// ============================================

const generateInputSchema = z.object({
  productId: z.string(),
  productIntelligenceId: z.string(),
  productIntelligenceVersion: z.number(),
  productIntelligence: z.object({
    usp: z.object({
      primary: z.string(),
      secondary: z.array(z.string()),
    }),
    audience: z.object({
      primaryDemographic: z.string(),
    }),
    painPoints: z.array(z.object({
      problem: z.string(),
    })),
    keywords: z.object({
      primary: z.array(z.string()),
    }),
  }),
  creativeBriefId: z.string().optional(),
  creativeBriefVersion: z.number().optional(),
  creativeBrief: z.object({
    hooks: z.array(z.object({
      text: z.string(),
      type: z.string(),
    })),
    ctas: z.array(z.string()),
  }).optional(),
  productName: z.string(),
  companyName: z.string(),
});

const updateSectionInputSchema = z.object({
  pageId: z.string(),
  sectionId: z.string(),
  content: z.record(z.string(), z.unknown()),
});

const createVariantInputSchema = z.object({
  pageId: z.string(),
  variantName: z.string(),
  changes: z.record(z.string(), z.unknown()),
  trafficPercentage: z.number().min(0).max(100).optional(),
});

// ============================================
// ROUTER
// ============================================

export const landingPageRouter = router({
  /**
   * Generate a new landing page from product intelligence
   */
  generate: protectedProcedure
    .input(generateInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.tenantId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Tenant ID required",
          });
        }
        try {
        const result = await landingPageService.generate({
          tenantId: ctx.user.tenantId,
          productId: input.productId,
          productIntelligenceId: input.productIntelligenceId,
          productIntelligenceVersion: input.productIntelligenceVersion,
          productIntelligence: input.productIntelligence,
          creativeBriefId: input.creativeBriefId,
          creativeBriefVersion: input.creativeBriefVersion,
          creativeBrief: input.creativeBrief,
          productName: input.productName,
          companyName: input.companyName,
          userId: ctx.user.id,
        });

        return result;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to generate landing page",
        });
      }
    }),

  /**
   * Get landing page by ID
   */
  get: protectedProcedure
    .input(z.object({ pageId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user.tenantId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Tenant ID required",
        });
      }
      const result = await landingPageService.get(ctx.user.tenantId, input.pageId);

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Landing page not found",
        });
      }

      return result;
    }),

  /**
   * Get latest landing page for a product
   */
  getByProduct: protectedProcedure
    .input(z.object({ productId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user.tenantId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Tenant ID required",
        });
      }
      return await landingPageService.getByProduct(ctx.user.tenantId, input.productId);
    }),

  /**
   * Get all versions of landing pages for a product
   */
  getHistory: protectedProcedure
    .input(z.object({ productId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user.tenantId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Tenant ID required",
        });
      }
      return await landingPageService.getHistory(ctx.user.tenantId, input.productId);
    }),

  /**
   * Update a section
   */
  updateSection: protectedProcedure
    .input(updateSectionInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.tenantId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Tenant ID required",
          });
        }
        try {
        const section = await landingPageService.updateSection({
          tenantId: ctx.user.tenantId,
          pageId: input.pageId,
          sectionId: input.sectionId,
          content: input.content as unknown as SectionContent,
          userId: ctx.user.id,
        });

        return section;
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Failed to update section",
        });
      }
    }),

  /**
   * Publish a landing page
   */
  publish: protectedProcedure
    .input(z.object({ pageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.tenantId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Tenant ID required",
          });
        }
        try {
        const page = await landingPageService.publish(
          ctx.user.tenantId,
          input.pageId,
          ctx.user.id
        );

        return page;
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Failed to publish page",
        });
      }
    }),

  /**
   * Unpublish a landing page
   */
  unpublish: protectedProcedure
    .input(z.object({ pageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.tenantId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Tenant ID required",
          });
        }
        try {
        const page = await landingPageService.unpublish(
          ctx.user.tenantId,
          input.pageId,
          ctx.user.id
        );

        return page;
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Failed to unpublish page",
        });
      }
    }),

  /**
   * Create a variant for A/B testing
   */
  createVariant: protectedProcedure
    .input(createVariantInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        if (!ctx.user.tenantId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Tenant ID required",
          });
        }
        const variant = await landingPageService.createVariant({
          tenantId: ctx.user.tenantId,
          pageId: input.pageId,
          variantName: input.variantName,
          changes: input.changes,
          trafficPercentage: input.trafficPercentage,
        });

        return variant;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to create variant",
        });
      }
    }),

  /**
   * Get variants for a landing page
   */
  getVariants: protectedProcedure
    .input(z.object({ pageId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.user.tenantId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Tenant ID required",
        });
      }
      return await landingPageService.getVariants(ctx.user.tenantId, input.pageId);
    }),

  /**
   * List all landing pages for tenant
   */
  list: protectedProcedure
    .input(z.object({
      status: z.enum(["draft", "review", "published", "archived"]).optional(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const { supabaseAdmin } = await import("./supabase");

      let query = supabaseAdmin
        .from("landing_pages")
        .select("*", { count: "exact" })
        .eq("tenant_id", ctx.user.tenantId)
        .order("created_at", { ascending: false })
        .range(input.offset, input.offset + input.limit - 1);

      if (input.status) {
        query = query.eq("status", input.status);
      }

      const { data, count, error } = await query;

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list landing pages",
        });
      }

      return {
        pages: data || [],
        total: count || 0,
      };
    }),
});
