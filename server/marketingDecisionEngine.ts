/**
 * Marketing Decision Engine - Block 2
 * 
 * Four-component system for marketing decisions:
 * 1. Channel Intelligence - product → suitable channels + reasoning
 * 2. Creative Logic - hooks, angles, visuals BEFORE ad writing
 * 3. Ad Generation Engine - versioned ad creatives
 * 4. Performance Memory - store results & decisions for learning
 */

import crypto from "crypto";
import { supabaseAdmin } from "./supabase";
import { invokeLLM } from "./_core/llm";

// ============================================
// TYPES & INTERFACES
// ============================================

// Supported marketing channels
export type MarketingChannel = 
  | "instagram"
  | "facebook"
  | "tiktok"
  | "snapchat"
  | "google_search"
  | "google_display"
  | "youtube"
  | "twitter"
  | "linkedin"
  | "pinterest";

// Hook types for creative strategy
export type HookType = 
  | "problem"      // Lead with pain point
  | "solution"     // Lead with benefit
  | "curiosity"    // Create intrigue
  | "social_proof" // Lead with validation
  | "urgency"      // Time-sensitive
  | "question";    // Engage with question

// Angle types for creative approach
export type AngleType = 
  | "emotional"    // Connect emotionally
  | "rational"     // Logic and facts
  | "social"       // Community/belonging
  | "aspirational" // Future state
  | "fear";        // Risk avoidance

// Ad formats
export type AdFormat = 
  | "image"
  | "video"
  | "carousel"
  | "story"
  | "reel"
  | "text";

// Decision types for logging
export type DecisionType = 
  | "channel_selection"
  | "budget_allocation"
  | "creative_direction"
  | "ad_pause"
  | "ad_scale"
  | "audience_change";

// Insight types for learning
export type InsightType = 
  | "winning_hook"
  | "best_channel"
  | "optimal_budget"
  | "audience_insight"
  | "timing_pattern"
  | "creative_fatigue";

// Insight scope
export type InsightScope = "tenant" | "product" | "category" | "platform";

// ============================================
// COMPONENT 1: CHANNEL INTELLIGENCE
// ============================================

export interface ChannelReasoning {
  audience_match: string;
  content_fit: string;
  competition: string;
  cost_efficiency: string;
  historical_performance: string;
}

export interface ChannelScore {
  channel: MarketingChannel;
  score: number; // 0-100
  budget_percentage: number;
  reasoning: ChannelReasoning;
  recommended: boolean;
}

export interface ChannelRecommendation {
  id: string;
  tenant_id: string;
  product_id: string;
  product_intelligence_id: string;
  product_intelligence_version: number;
  version: number;
  channel_scores: ChannelScore[];
  recommended_channels: MarketingChannel[];
  total_budget_suggestion: number | null;
  confidence: number;
  input_hash: string;
  analysis_source: "ai" | "manual" | "hybrid";
  created_at: string;
  created_by: string | null;
}

// ============================================
// COMPONENT 2: CREATIVE LOGIC
// ============================================

export interface Hook {
  id: string;
  type: HookType;
  text: string;
  target_emotion: string;
  best_for_channels: MarketingChannel[];
}

export interface Angle {
  id: string;
  type: AngleType;
  description: string;
  key_message: string;
  supporting_points: string[];
}

export interface VisualDirection {
  style: string;
  mood: string;
  colors: string[];
  imagery_type: string;
  do_not_use: string[];
}

export interface CreativeBrief {
  id: string;
  tenant_id: string;
  product_id: string;
  channel_recommendation_id: string;
  channel_recommendation_version: number;
  product_intelligence_id: string;
  product_intelligence_version: number;
  version: number;
  target_channel: MarketingChannel;
  hooks: Hook[];
  angles: Angle[];
  visual_direction: VisualDirection;
  ctas: string[];
  tone: string;
  do_not_use: string[];
  confidence: number;
  input_hash: string;
  analysis_source: "ai" | "manual" | "hybrid";
  created_at: string;
  created_by: string | null;
}

// ============================================
// COMPONENT 3: AD GENERATION ENGINE
// ============================================

export interface AudienceTargeting {
  age_range: { min: number; max: number };
  gender: "male" | "female" | "all";
  interests: string[];
  behaviors: string[];
  locations: string[];
  languages: string[];
  custom_audiences: string[];
  lookalike_sources: string[];
}

export interface AdCreative {
  id: string;
  tenant_id: string;
  product_id: string;
  creative_brief_id: string;
  creative_brief_version: number;
  version: number;
  channel: MarketingChannel;
  format: AdFormat;
  headline: string;
  body: string;
  cta: string;
  hook_used: HookType;
  angle_used: AngleType;
  visual_prompt: string;
  visual_url: string | null;
  audience_targeting: AudienceTargeting;
  confidence: number;
  input_hash: string;
  status: "draft" | "approved" | "active" | "paused" | "archived";
  created_at: string;
  created_by: string | null;
}

export type VariationType = "headline" | "hook" | "cta" | "audience" | "visual";

export interface AdVariation {
  id: string;
  tenant_id: string;
  parent_ad_id: string;
  variation_type: VariationType;
  variation_number: number;
  headline: string | null;
  body: string | null;
  cta: string | null;
  visual_prompt: string | null;
  visual_url: string | null;
  audience_targeting: AudienceTargeting | null;
  status: "draft" | "approved" | "active" | "paused" | "archived";
  created_at: string;
}

// ============================================
// COMPONENT 4: PERFORMANCE MEMORY
// ============================================

export interface PerformanceRecord {
  id: string;
  tenant_id: string;
  ad_creative_id: string;
  ad_variation_id: string | null;
  platform: MarketingChannel;
  platform_ad_id: string | null;
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpa: number | null;
  roas: number | null;
  created_at: string;
  updated_at: string;
}

export interface DecisionLog {
  id: string;
  tenant_id: string;
  decision_type: DecisionType;
  entity_type: string;
  entity_id: string;
  decision: string;
  reasoning: Record<string, unknown>;
  context: Record<string, unknown>;
  outcome: Record<string, unknown> | null;
  outcome_recorded_at: string | null;
  created_at: string;
  created_by: string | null;
}

export interface LearningInsight {
  id: string;
  tenant_id: string;
  insight_type: InsightType;
  scope: InsightScope;
  scope_id: string | null; // product_id, category, platform, etc.
  pattern: Record<string, unknown>;
  confidence: number;
  sample_size: number;
  actionable: boolean;
  action_suggestion: string | null;
  valid_from: string;
  valid_until: string | null;
  created_at: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateInputHash(input: Record<string, unknown>): string {
  const normalized = JSON.stringify(input, Object.keys(input).sort());
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

function generateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

// ============================================
// CHANNEL INTELLIGENCE SERVICE
// ============================================

export class ChannelIntelligenceService {
  /**
   * Analyze product and recommend marketing channels
   */
  async analyze(params: {
    tenantId: string;
    productId: string;
    productIntelligenceId: string;
    productIntelligenceVersion: number;
    productIntelligence: {
      audience: Record<string, unknown>;
      visualStyle: { targetPlatformFit: Record<MarketingChannel, number> };
      priceSensitivity: Record<string, unknown>;
      keywords: Record<string, unknown>;
    };
    userId?: string;
    forceReanalyze?: boolean;
  }): Promise<ChannelRecommendation> {
    const {
      tenantId,
      productId,
      productIntelligenceId,
      productIntelligenceVersion,
      productIntelligence,
      userId,
      forceReanalyze = false,
    } = params;

    // Generate input hash for deduplication
    const inputHash = generateInputHash({
      productIntelligenceId,
      productIntelligenceVersion,
      audience: productIntelligence.audience,
      platformFit: productIntelligence.visualStyle.targetPlatformFit,
    });

    // Check for existing analysis with same input
    if (!forceReanalyze) {
      const { data: existing } = await supabaseAdmin
        .from("channel_recommendations")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("product_id", productId)
        .eq("input_hash", inputHash)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      if (existing) {
        return existing as ChannelRecommendation;
      }
    }

    // Get latest version number
    const { data: latestVersion } = await supabaseAdmin
      .from("channel_recommendations")
      .select("version")
      .eq("tenant_id", tenantId)
      .eq("product_id", productId)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    const newVersion = (latestVersion?.version || 0) + 1;

    // Use AI to analyze channels
    const channelScores = await this.analyzeWithAI(productIntelligence);

    // Determine recommended channels (score >= 60)
    const recommendedChannels = channelScores
      .filter((c) => c.score >= 60)
      .sort((a, b) => b.score - a.score)
      .map((c) => c.channel);

    // Calculate confidence based on data quality
    const confidence = this.calculateConfidence(productIntelligence, channelScores);

    const recommendation: ChannelRecommendation = {
      id: generateId("chr"),
      tenant_id: tenantId,
      product_id: productId,
      product_intelligence_id: productIntelligenceId,
      product_intelligence_version: productIntelligenceVersion,
      version: newVersion,
      channel_scores: channelScores,
      recommended_channels: recommendedChannels,
      total_budget_suggestion: null,
      confidence,
      input_hash: inputHash,
      analysis_source: "ai",
      created_at: new Date().toISOString(),
      created_by: userId || null,
    };

    // Save to database
    await supabaseAdmin.from("channel_recommendations").insert(recommendation);

    return recommendation;
  }

  private async analyzeWithAI(
    productIntelligence: Record<string, unknown>
  ): Promise<ChannelScore[]> {
    const prompt = `Analyze this product intelligence and recommend marketing channels.

Product Intelligence:
${JSON.stringify(productIntelligence, null, 2)}

For each channel, provide:
1. Score (0-100) based on fit
2. Recommended budget percentage
3. Detailed reasoning

Channels to evaluate: instagram, facebook, tiktok, snapchat, google_search, google_display, youtube`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a marketing channel analyst. Analyze products and recommend the best marketing channels.
Output JSON only with this structure:
{
  "channels": [
    {
      "channel": "instagram",
      "score": 85,
      "budget_percentage": 30,
      "reasoning": {
        "audience_match": "explanation",
        "content_fit": "explanation",
        "competition": "explanation",
        "cost_efficiency": "explanation",
        "historical_performance": "explanation"
      },
      "recommended": true
    }
  ]
}`,
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "channel_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              channels: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    channel: { type: "string" },
                    score: { type: "number" },
                    budget_percentage: { type: "number" },
                    reasoning: {
                      type: "object",
                      properties: {
                        audience_match: { type: "string" },
                        content_fit: { type: "string" },
                        competition: { type: "string" },
                        cost_efficiency: { type: "string" },
                        historical_performance: { type: "string" },
                      },
                      required: [
                        "audience_match",
                        "content_fit",
                        "competition",
                        "cost_efficiency",
                        "historical_performance",
                      ],
                      additionalProperties: false,
                    },
                    recommended: { type: "boolean" },
                  },
                  required: ["channel", "score", "budget_percentage", "reasoning", "recommended"],
                  additionalProperties: false,
                },
              },
            },
            required: ["channels"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    return parsed.channels as ChannelScore[];
  }

  private calculateConfidence(
    productIntelligence: Record<string, unknown>,
    channelScores: ChannelScore[]
  ): number {
    let confidence = 70; // Base confidence

    // Increase confidence if we have good platform fit data
    if (productIntelligence.visualStyle) {
      confidence += 10;
    }

    // Increase confidence if audience data is detailed
    if (productIntelligence.audience) {
      confidence += 10;
    }

    // Decrease confidence if scores are too similar (uncertain)
    const scores = channelScores.map((c) => c.score);
    const variance =
      scores.reduce((sum, s) => sum + Math.pow(s - 50, 2), 0) / scores.length;
    if (variance < 100) {
      confidence -= 10;
    }

    return Math.min(100, Math.max(0, confidence));
  }

  /**
   * Get latest channel recommendation for a product
   */
  async get(tenantId: string, productId: string): Promise<ChannelRecommendation | null> {
    const { data } = await supabaseAdmin
      .from("channel_recommendations")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("product_id", productId)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    return data as ChannelRecommendation | null;
  }

  /**
   * Get all versions of channel recommendations for a product
   */
  async getHistory(
    tenantId: string,
    productId: string
  ): Promise<ChannelRecommendation[]> {
    const { data } = await supabaseAdmin
      .from("channel_recommendations")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("product_id", productId)
      .order("version", { ascending: false });

    return (data || []) as ChannelRecommendation[];
  }
}

// ============================================
// CREATIVE LOGIC SERVICE
// ============================================

export class CreativeLogicService {
  /**
   * Generate creative brief for a channel
   */
  async generateBrief(params: {
    tenantId: string;
    productId: string;
    channelRecommendationId: string;
    channelRecommendationVersion: number;
    productIntelligenceId: string;
    productIntelligenceVersion: number;
    targetChannel: MarketingChannel;
    productIntelligence: {
      painPoints: Array<{ problem: string; severity: string }>;
      usp: { primary: string; secondary: string[] };
      keywords: { primary: string[]; negative: string[] };
      visualStyle: Record<string, unknown>;
    };
    userId?: string;
    forceRegenerate?: boolean;
  }): Promise<CreativeBrief> {
    const {
      tenantId,
      productId,
      channelRecommendationId,
      channelRecommendationVersion,
      productIntelligenceId,
      productIntelligenceVersion,
      targetChannel,
      productIntelligence,
      userId,
      forceRegenerate = false,
    } = params;

    // Generate input hash
    const inputHash = generateInputHash({
      productIntelligenceId,
      productIntelligenceVersion,
      channelRecommendationId,
      targetChannel,
    });

    // Check for existing brief
    if (!forceRegenerate) {
      const { data: existing } = await supabaseAdmin
        .from("creative_briefs")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("product_id", productId)
        .eq("target_channel", targetChannel)
        .eq("input_hash", inputHash)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      if (existing) {
        return existing as CreativeBrief;
      }
    }

    // Get latest version
    const { data: latestVersion } = await supabaseAdmin
      .from("creative_briefs")
      .select("version")
      .eq("tenant_id", tenantId)
      .eq("product_id", productId)
      .eq("target_channel", targetChannel)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    const newVersion = (latestVersion?.version || 0) + 1;

    // Generate creative elements with AI
    const creativeElements = await this.generateWithAI(
      productIntelligence,
      targetChannel
    );

    const brief: CreativeBrief = {
      id: generateId("crb"),
      tenant_id: tenantId,
      product_id: productId,
      channel_recommendation_id: channelRecommendationId,
      channel_recommendation_version: channelRecommendationVersion,
      product_intelligence_id: productIntelligenceId,
      product_intelligence_version: productIntelligenceVersion,
      version: newVersion,
      target_channel: targetChannel,
      hooks: creativeElements.hooks,
      angles: creativeElements.angles,
      visual_direction: creativeElements.visual_direction,
      ctas: creativeElements.ctas,
      tone: creativeElements.tone,
      do_not_use: creativeElements.do_not_use,
      confidence: creativeElements.confidence,
      input_hash: inputHash,
      analysis_source: "ai",
      created_at: new Date().toISOString(),
      created_by: userId || null,
    };

    // Save to database
    await supabaseAdmin.from("creative_briefs").insert(brief);

    return brief;
  }

  private async generateWithAI(
    productIntelligence: Record<string, unknown>,
    channel: MarketingChannel
  ): Promise<{
    hooks: Hook[];
    angles: Angle[];
    visual_direction: VisualDirection;
    ctas: string[];
    tone: string;
    do_not_use: string[];
    confidence: number;
  }> {
    const prompt = `Create a creative brief for ${channel} ads based on this product intelligence:

${JSON.stringify(productIntelligence, null, 2)}

Generate:
1. 5 hooks (attention-grabbing opening lines) of different types
2. 3 angles (different creative approaches)
3. Visual direction (style, mood, colors)
4. 5 CTAs
5. Tone guidance
6. Things to avoid`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a creative strategist. Create compelling creative briefs for advertising.
Output JSON only.`,
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "creative_brief",
          strict: true,
          schema: {
            type: "object",
            properties: {
              hooks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    type: { type: "string" },
                    text: { type: "string" },
                    target_emotion: { type: "string" },
                    best_for_channels: { type: "array", items: { type: "string" } },
                  },
                  required: ["id", "type", "text", "target_emotion", "best_for_channels"],
                  additionalProperties: false,
                },
              },
              angles: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    type: { type: "string" },
                    description: { type: "string" },
                    key_message: { type: "string" },
                    supporting_points: { type: "array", items: { type: "string" } },
                  },
                  required: ["id", "type", "description", "key_message", "supporting_points"],
                  additionalProperties: false,
                },
              },
              visual_direction: {
                type: "object",
                properties: {
                  style: { type: "string" },
                  mood: { type: "string" },
                  colors: { type: "array", items: { type: "string" } },
                  imagery_type: { type: "string" },
                  do_not_use: { type: "array", items: { type: "string" } },
                },
                required: ["style", "mood", "colors", "imagery_type", "do_not_use"],
                additionalProperties: false,
              },
              ctas: { type: "array", items: { type: "string" } },
              tone: { type: "string" },
              do_not_use: { type: "array", items: { type: "string" } },
              confidence: { type: "number" },
            },
            required: [
              "hooks",
              "angles",
              "visual_direction",
              "ctas",
              "tone",
              "do_not_use",
              "confidence",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("No response from AI");
    }

    return JSON.parse(content);
  }

  /**
   * Get latest creative brief for a product and channel
   */
  async getBrief(
    tenantId: string,
    productId: string,
    channel: MarketingChannel
  ): Promise<CreativeBrief | null> {
    const { data } = await supabaseAdmin
      .from("creative_briefs")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("product_id", productId)
      .eq("target_channel", channel)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    return data as CreativeBrief | null;
  }
}

// ============================================
// AD GENERATION SERVICE
// ============================================

export class AdGenerationService {
  /**
   * Generate ad creative from a creative brief
   */
  async generate(params: {
    tenantId: string;
    productId: string;
    creativeBriefId: string;
    creativeBriefVersion: number;
    creativeBrief: CreativeBrief;
    format: AdFormat;
    userId?: string;
  }): Promise<AdCreative> {
    const {
      tenantId,
      productId,
      creativeBriefId,
      creativeBriefVersion,
      creativeBrief,
      format,
      userId,
    } = params;

    // Generate input hash
    const inputHash = generateInputHash({
      creativeBriefId,
      creativeBriefVersion,
      format,
    });

    // Get latest version
    const { data: latestVersion } = await supabaseAdmin
      .from("ad_creatives")
      .select("version")
      .eq("tenant_id", tenantId)
      .eq("product_id", productId)
      .eq("creative_brief_id", creativeBriefId)
      .eq("format", format)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    const newVersion = (latestVersion?.version || 0) + 1;

    // Generate ad with AI
    const adContent = await this.generateWithAI(creativeBrief, format);

    const adCreative: AdCreative = {
      id: generateId("adc"),
      tenant_id: tenantId,
      product_id: productId,
      creative_brief_id: creativeBriefId,
      creative_brief_version: creativeBriefVersion,
      version: newVersion,
      channel: creativeBrief.target_channel,
      format,
      headline: adContent.headline,
      body: adContent.body,
      cta: adContent.cta,
      hook_used: adContent.hook_used,
      angle_used: adContent.angle_used,
      visual_prompt: adContent.visual_prompt,
      visual_url: null,
      audience_targeting: adContent.audience_targeting,
      confidence: adContent.confidence,
      input_hash: inputHash,
      status: "draft",
      created_at: new Date().toISOString(),
      created_by: userId || null,
    };

    // Save to database
    await supabaseAdmin.from("ad_creatives").insert(adCreative);

    return adCreative;
  }

  private async generateWithAI(
    creativeBrief: CreativeBrief,
    format: AdFormat
  ): Promise<{
    headline: string;
    body: string;
    cta: string;
    hook_used: HookType;
    angle_used: AngleType;
    visual_prompt: string;
    audience_targeting: AudienceTargeting;
    confidence: number;
  }> {
    const prompt = `Create an ad for ${creativeBrief.target_channel} in ${format} format.

Creative Brief:
- Hooks: ${JSON.stringify(creativeBrief.hooks)}
- Angles: ${JSON.stringify(creativeBrief.angles)}
- Visual Direction: ${JSON.stringify(creativeBrief.visual_direction)}
- CTAs: ${creativeBrief.ctas.join(", ")}
- Tone: ${creativeBrief.tone}
- Avoid: ${creativeBrief.do_not_use.join(", ")}

Generate a complete ad with headline, body, CTA, and targeting.`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are an ad copywriter. Create compelling ads based on creative briefs.
Output JSON only.`,
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "ad_creative",
          strict: true,
          schema: {
            type: "object",
            properties: {
              headline: { type: "string" },
              body: { type: "string" },
              cta: { type: "string" },
              hook_used: { type: "string" },
              angle_used: { type: "string" },
              visual_prompt: { type: "string" },
              audience_targeting: {
                type: "object",
                properties: {
                  age_range: {
                    type: "object",
                    properties: {
                      min: { type: "number" },
                      max: { type: "number" },
                    },
                    required: ["min", "max"],
                    additionalProperties: false,
                  },
                  gender: { type: "string" },
                  interests: { type: "array", items: { type: "string" } },
                  behaviors: { type: "array", items: { type: "string" } },
                  locations: { type: "array", items: { type: "string" } },
                  languages: { type: "array", items: { type: "string" } },
                  custom_audiences: { type: "array", items: { type: "string" } },
                  lookalike_sources: { type: "array", items: { type: "string" } },
                },
                required: [
                  "age_range",
                  "gender",
                  "interests",
                  "behaviors",
                  "locations",
                  "languages",
                  "custom_audiences",
                  "lookalike_sources",
                ],
                additionalProperties: false,
              },
              confidence: { type: "number" },
            },
            required: [
              "headline",
              "body",
              "cta",
              "hook_used",
              "angle_used",
              "visual_prompt",
              "audience_targeting",
              "confidence",
            ],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("No response from AI");
    }

    return JSON.parse(content);
  }

  /**
   * Create a variation of an existing ad
   */
  async createVariation(params: {
    tenantId: string;
    parentAdId: string;
    variationType: VariationType;
    parentAd: AdCreative;
  }): Promise<AdVariation> {
    const { tenantId, parentAdId, variationType, parentAd } = params;

    // Get latest variation number
    const { data: latestVariation } = await supabaseAdmin
      .from("ad_variations")
      .select("variation_number")
      .eq("tenant_id", tenantId)
      .eq("parent_ad_id", parentAdId)
      .eq("variation_type", variationType)
      .order("variation_number", { ascending: false })
      .limit(1)
      .single();

    const variationNumber = (latestVariation?.variation_number || 0) + 1;

    // Generate variation based on type
    const variationContent = await this.generateVariation(
      parentAd,
      variationType
    );

    const variation: AdVariation = {
      id: generateId("adv"),
      tenant_id: tenantId,
      parent_ad_id: parentAdId,
      variation_type: variationType,
      variation_number: variationNumber,
      headline: variationContent.headline,
      body: variationContent.body,
      cta: variationContent.cta,
      visual_prompt: variationContent.visual_prompt,
      visual_url: null,
      audience_targeting: variationContent.audience_targeting,
      status: "draft",
      created_at: new Date().toISOString(),
    };

    await supabaseAdmin.from("ad_variations").insert(variation);

    return variation;
  }

  private async generateVariation(
    parentAd: AdCreative,
    variationType: VariationType
  ): Promise<{
    headline: string | null;
    body: string | null;
    cta: string | null;
    visual_prompt: string | null;
    audience_targeting: AudienceTargeting | null;
  }> {
    // For now, return modified version based on type
    // In production, this would use AI to generate variations
    switch (variationType) {
      case "headline":
        return {
          headline: `Alternative: ${parentAd.headline}`,
          body: null,
          cta: null,
          visual_prompt: null,
          audience_targeting: null,
        };
      case "cta":
        return {
          headline: null,
          body: null,
          cta: `Try Now - ${parentAd.cta}`,
          visual_prompt: null,
          audience_targeting: null,
        };
      default:
        return {
          headline: null,
          body: null,
          cta: null,
          visual_prompt: null,
          audience_targeting: null,
        };
    }
  }

  /**
   * Get ad creative by ID
   */
  async get(tenantId: string, adCreativeId: string): Promise<AdCreative | null> {
    const { data } = await supabaseAdmin
      .from("ad_creatives")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", adCreativeId)
      .single();

    return data as AdCreative | null;
  }

  /**
   * Get all ad creatives for a product
   */
  async getByProduct(tenantId: string, productId: string): Promise<AdCreative[]> {
    const { data } = await supabaseAdmin
      .from("ad_creatives")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    return (data || []) as AdCreative[];
  }
}

// ============================================
// PERFORMANCE MEMORY SERVICE
// ============================================

export class PerformanceMemoryService {
  /**
   * Record performance metrics for an ad
   */
  async recordMetrics(params: {
    tenantId: string;
    adCreativeId: string;
    adVariationId?: string;
    platform: MarketingChannel;
    platformAdId?: string;
    date: string;
    metrics: {
      impressions: number;
      clicks: number;
      conversions: number;
      spend: number;
      revenue: number;
    };
  }): Promise<PerformanceRecord> {
    const {
      tenantId,
      adCreativeId,
      adVariationId,
      platform,
      platformAdId,
      date,
      metrics,
    } = params;

    // Calculate derived metrics
    const ctr = metrics.impressions > 0 ? metrics.clicks / metrics.impressions : 0;
    const cpc = metrics.clicks > 0 ? metrics.spend / metrics.clicks : 0;
    const cpa = metrics.conversions > 0 ? metrics.spend / metrics.conversions : null;
    const roas = metrics.spend > 0 ? metrics.revenue / metrics.spend : null;

    const record: PerformanceRecord = {
      id: generateId("prf"),
      tenant_id: tenantId,
      ad_creative_id: adCreativeId,
      ad_variation_id: adVariationId || null,
      platform,
      platform_ad_id: platformAdId || null,
      date,
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      conversions: metrics.conversions,
      spend: metrics.spend,
      revenue: metrics.revenue,
      ctr,
      cpc,
      cpa,
      roas,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await supabaseAdmin.from("performance_records").insert(record);

    return record;
  }

  /**
   * Log a decision with reasoning
   */
  async logDecision(params: {
    tenantId: string;
    decisionType: DecisionType;
    entityType: string;
    entityId: string;
    decision: string;
    reasoning: Record<string, unknown>;
    context: Record<string, unknown>;
    userId?: string;
  }): Promise<DecisionLog> {
    const {
      tenantId,
      decisionType,
      entityType,
      entityId,
      decision,
      reasoning,
      context,
      userId,
    } = params;

    const log: DecisionLog = {
      id: generateId("dec"),
      tenant_id: tenantId,
      decision_type: decisionType,
      entity_type: entityType,
      entity_id: entityId,
      decision,
      reasoning,
      context,
      outcome: null,
      outcome_recorded_at: null,
      created_at: new Date().toISOString(),
      created_by: userId || null,
    };

    await supabaseAdmin.from("decision_log").insert(log);

    return log;
  }

  /**
   * Record outcome for a decision
   */
  async recordOutcome(
    tenantId: string,
    decisionId: string,
    outcome: Record<string, unknown>
  ): Promise<void> {
    await supabaseAdmin
      .from("decision_log")
      .update({
        outcome,
        outcome_recorded_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", decisionId);
  }

  /**
   * Extract and save learning insight
   */
  async saveInsight(params: {
    tenantId: string;
    insightType: InsightType;
    scope: InsightScope;
    scopeId?: string;
    pattern: Record<string, unknown>;
    confidence: number;
    sampleSize: number;
    actionable: boolean;
    actionSuggestion?: string;
  }): Promise<LearningInsight> {
    const {
      tenantId,
      insightType,
      scope,
      scopeId,
      pattern,
      confidence,
      sampleSize,
      actionable,
      actionSuggestion,
    } = params;

    const insight: LearningInsight = {
      id: generateId("ins"),
      tenant_id: tenantId,
      insight_type: insightType,
      scope,
      scope_id: scopeId || null,
      pattern,
      confidence,
      sample_size: sampleSize,
      actionable,
      action_suggestion: actionSuggestion || null,
      valid_from: new Date().toISOString(),
      valid_until: null,
      created_at: new Date().toISOString(),
    };

    await supabaseAdmin.from("learning_insights").insert(insight);

    return insight;
  }

  /**
   * Get insights for a scope
   */
  async getInsights(
    tenantId: string,
    scope: InsightScope,
    scopeId?: string
  ): Promise<LearningInsight[]> {
    let query = supabaseAdmin
      .from("learning_insights")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("scope", scope)
      .is("valid_until", null);

    if (scopeId) {
      query = query.eq("scope_id", scopeId);
    }

    const { data } = await query.order("confidence", { ascending: false });

    return (data || []) as LearningInsight[];
  }

  /**
   * Get decision history for an entity
   */
  async getDecisionHistory(
    tenantId: string,
    entityType: string,
    entityId: string
  ): Promise<DecisionLog[]> {
    const { data } = await supabaseAdmin
      .from("decision_log")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false });

    return (data || []) as DecisionLog[];
  }
}

// ============================================
// EXPORT SERVICES
// ============================================

export const channelIntelligenceService = new ChannelIntelligenceService();
export const creativeLogicService = new CreativeLogicService();
export const adGenerationService = new AdGenerationService();
export const performanceMemoryService = new PerformanceMemoryService();
