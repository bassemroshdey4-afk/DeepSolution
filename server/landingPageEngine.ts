/**
 * Landing Page Engine - Block 3
 * 
 * Generates high-converting landing pages from Product Intelligence + Creative Brief.
 * All outputs are versioned and immutable. AI generates content, humans publish.
 */

import crypto from "crypto";
import { supabaseAdmin } from "./supabase";
import { invokeLLM } from "./_core/llm";

// ============================================
// TYPES & INTERFACES
// ============================================

// Section types
export type SectionType = 
  | "hero"
  | "features"
  | "testimonials"
  | "cta"
  | "faq"
  | "footer";

// Page status
export type PageStatus = "draft" | "review" | "published" | "archived";

// Variant status
export type VariantStatus = "draft" | "active" | "winner" | "archived";

// Layout types
export type HeroLayout = "centered" | "left-aligned" | "split";
export type FeaturesLayout = "grid" | "list" | "alternating";
export type TestimonialsLayout = "carousel" | "grid" | "single";
export type CtaStyle = "banner" | "card" | "fullwidth";
export type FaqLayout = "accordion" | "two-column" | "list";
export type BackgroundType = "image" | "video" | "gradient" | "solid";

// ============================================
// SECTION CONTENT TYPES
// ============================================

export interface HeroSectionContent {
  headline: string;
  subheadline: string;
  cta_text: string;
  cta_url: string;
  background_type: BackgroundType;
  background_value: string;
  layout: HeroLayout;
}

export interface FeatureItem {
  icon: string;
  title: string;
  description: string;
  highlight: boolean;
}

export interface FeaturesSectionContent {
  section_title: string;
  section_subtitle: string;
  features: FeatureItem[];
  layout: FeaturesLayout;
  columns: number;
}

export interface Testimonial {
  quote: string;
  author_name: string;
  author_title: string;
  author_image: string;
  rating: number;
  company: string;
}

export interface TestimonialsSectionContent {
  section_title: string;
  testimonials: Testimonial[];
  layout: TestimonialsLayout;
  show_rating: boolean;
}

export interface CtaSectionContent {
  headline: string;
  subheadline: string;
  cta_text: string;
  cta_url: string;
  style: CtaStyle;
  urgency_text: string;
}

export interface FaqItem {
  question: string;
  answer: string;
  category: string;
}

export interface FaqSectionContent {
  section_title: string;
  faqs: FaqItem[];
  layout: FaqLayout;
}

export interface FooterSectionContent {
  company_name: string;
  tagline: string;
  links: Array<{ text: string; url: string }>;
  social_links: Array<{ platform: string; url: string }>;
  legal_text: string;
}

export type SectionContent = 
  | HeroSectionContent
  | FeaturesSectionContent
  | TestimonialsSectionContent
  | CtaSectionContent
  | FaqSectionContent
  | FooterSectionContent;

// ============================================
// THEME TYPES
// ============================================

export interface LandingPageTheme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    muted: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  spacing: {
    section: string;
    element: string;
  };
  borderRadius: string;
  shadows: boolean;
}

// ============================================
// MAIN TYPES
// ============================================

export interface LandingPage {
  id: string;
  tenant_id: string;
  product_id: string;
  product_intelligence_id: string;
  product_intelligence_version: number;
  creative_brief_id: string | null;
  creative_brief_version: number | null;
  version: number;
  name: string;
  slug: string;
  status: PageStatus;
  theme: LandingPageTheme;
  meta_title: string;
  meta_description: string;
  og_image: string | null;
  input_hash: string;
  created_at: string;
  created_by: string | null;
  published_at: string | null;
  published_by: string | null;
}

export interface LandingPageSection {
  id: string;
  tenant_id: string;
  landing_page_id: string;
  landing_page_version: number;
  section_type: SectionType;
  order: number;
  content: SectionContent;
  settings: Record<string, unknown>;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface LandingPageVariant {
  id: string;
  tenant_id: string;
  landing_page_id: string;
  variant_name: string;
  changes: Record<string, unknown>;
  traffic_percentage: number;
  status: VariantStatus;
  impressions: number;
  conversions: number;
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

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

const defaultTheme: LandingPageTheme = {
  colors: {
    primary: "#2563eb",
    secondary: "#1e40af",
    accent: "#3b82f6",
    background: "#ffffff",
    text: "#1f2937",
    muted: "#6b7280",
  },
  fonts: {
    heading: "Inter, sans-serif",
    body: "Inter, sans-serif",
  },
  spacing: {
    section: "6rem",
    element: "1.5rem",
  },
  borderRadius: "0.5rem",
  shadows: true,
};

// ============================================
// SECTION GENERATORS
// ============================================

export class SectionGenerators {
  /**
   * Generate hero section content
   */
  async generateHero(params: {
    productIntelligence: {
      usp: { primary: string; secondary: string[] };
      audience: { primaryDemographic: string };
      painPoints: Array<{ problem: string }>;
    };
    creativeBrief?: {
      hooks: Array<{ text: string; type: string }>;
      ctas: string[];
    };
  }): Promise<HeroSectionContent> {
    const { productIntelligence, creativeBrief } = params;

    const prompt = `Create a hero section for a landing page.

Product USP: ${productIntelligence.usp.primary}
Secondary USPs: ${productIntelligence.usp.secondary.join(", ")}
Target Audience: ${productIntelligence.audience.primaryDemographic}
Pain Points: ${productIntelligence.painPoints.map(p => p.problem).join(", ")}
${creativeBrief ? `Available Hooks: ${creativeBrief.hooks.map(h => h.text).join(", ")}` : ""}
${creativeBrief ? `CTAs: ${creativeBrief.ctas.join(", ")}` : ""}

Generate compelling hero section content.`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a landing page copywriter. Create compelling hero sections.
Output JSON only with this structure:
{
  "headline": "Attention-grabbing headline",
  "subheadline": "Supporting text",
  "cta_text": "Button text",
  "cta_url": "#",
  "background_type": "gradient",
  "background_value": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "layout": "centered"
}`,
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "hero_section",
          strict: true,
          schema: {
            type: "object",
            properties: {
              headline: { type: "string" },
              subheadline: { type: "string" },
              cta_text: { type: "string" },
              cta_url: { type: "string" },
              background_type: { type: "string" },
              background_value: { type: "string" },
              layout: { type: "string" },
            },
            required: ["headline", "subheadline", "cta_text", "cta_url", "background_type", "background_value", "layout"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("No response from AI");
    }

    return JSON.parse(content) as HeroSectionContent;
  }

  /**
   * Generate features section content
   */
  async generateFeatures(params: {
    productIntelligence: {
      usp: { primary: string; secondary: string[] };
      keywords: { primary: string[] };
    };
    maxFeatures?: number;
  }): Promise<FeaturesSectionContent> {
    const { productIntelligence, maxFeatures = 6 } = params;

    const prompt = `Create a features section for a landing page.

Primary USP: ${productIntelligence.usp.primary}
Secondary USPs: ${productIntelligence.usp.secondary.join(", ")}
Keywords: ${productIntelligence.keywords.primary.join(", ")}

Generate ${maxFeatures} compelling features.`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a landing page copywriter. Create compelling features sections.
Output JSON only.`,
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "features_section",
          strict: true,
          schema: {
            type: "object",
            properties: {
              section_title: { type: "string" },
              section_subtitle: { type: "string" },
              features: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    icon: { type: "string" },
                    title: { type: "string" },
                    description: { type: "string" },
                    highlight: { type: "boolean" },
                  },
                  required: ["icon", "title", "description", "highlight"],
                  additionalProperties: false,
                },
              },
              layout: { type: "string" },
              columns: { type: "number" },
            },
            required: ["section_title", "section_subtitle", "features", "layout", "columns"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("No response from AI");
    }

    return JSON.parse(content) as FeaturesSectionContent;
  }

  /**
   * Generate testimonials section (placeholder content)
   */
  async generateTestimonials(params: {
    productIntelligence: {
      audience: { primaryDemographic: string };
    };
    count?: number;
  }): Promise<TestimonialsSectionContent> {
    const { productIntelligence, count = 3 } = params;

    // Generate placeholder testimonials
    // In production, these would come from real customer data
    const placeholderTestimonials: Testimonial[] = Array.from({ length: count }, (_, i) => ({
      quote: `[Placeholder testimonial ${i + 1} - Replace with real customer feedback]`,
      author_name: `Customer ${i + 1}`,
      author_title: "Verified Buyer",
      author_image: "",
      rating: 5,
      company: "",
    }));

    return {
      section_title: "What Our Customers Say",
      testimonials: placeholderTestimonials,
      layout: "carousel",
      show_rating: true,
    };
  }

  /**
   * Generate CTA section content
   */
  async generateCta(params: {
    productIntelligence: {
      usp: { primary: string };
    };
    creativeBrief?: {
      ctas: string[];
    };
  }): Promise<CtaSectionContent> {
    const { productIntelligence, creativeBrief } = params;

    const prompt = `Create a CTA section for a landing page.

Product USP: ${productIntelligence.usp.primary}
${creativeBrief ? `Available CTAs: ${creativeBrief.ctas.join(", ")}` : ""}

Generate compelling CTA section content.`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a landing page copywriter. Create compelling CTA sections.
Output JSON only.`,
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "cta_section",
          strict: true,
          schema: {
            type: "object",
            properties: {
              headline: { type: "string" },
              subheadline: { type: "string" },
              cta_text: { type: "string" },
              cta_url: { type: "string" },
              style: { type: "string" },
              urgency_text: { type: "string" },
            },
            required: ["headline", "subheadline", "cta_text", "cta_url", "style", "urgency_text"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("No response from AI");
    }

    return JSON.parse(content) as CtaSectionContent;
  }

  /**
   * Generate FAQ section content
   */
  async generateFaq(params: {
    productIntelligence: {
      painPoints: Array<{ problem: string }>;
      usp: { primary: string };
    };
    maxQuestions?: number;
  }): Promise<FaqSectionContent> {
    const { productIntelligence, maxQuestions = 5 } = params;

    const prompt = `Create an FAQ section for a landing page.

Product USP: ${productIntelligence.usp.primary}
Pain Points: ${productIntelligence.painPoints.map(p => p.problem).join(", ")}

Generate ${maxQuestions} frequently asked questions with answers.`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a landing page copywriter. Create helpful FAQ sections.
Output JSON only.`,
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "faq_section",
          strict: true,
          schema: {
            type: "object",
            properties: {
              section_title: { type: "string" },
              faqs: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    question: { type: "string" },
                    answer: { type: "string" },
                    category: { type: "string" },
                  },
                  required: ["question", "answer", "category"],
                  additionalProperties: false,
                },
              },
              layout: { type: "string" },
            },
            required: ["section_title", "faqs", "layout"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== "string") {
      throw new Error("No response from AI");
    }

    return JSON.parse(content) as FaqSectionContent;
  }

  /**
   * Generate footer section content
   */
  generateFooter(params: {
    companyName: string;
    tagline?: string;
  }): FooterSectionContent {
    return {
      company_name: params.companyName,
      tagline: params.tagline || "",
      links: [
        { text: "Privacy Policy", url: "/privacy" },
        { text: "Terms of Service", url: "/terms" },
        { text: "Contact", url: "/contact" },
      ],
      social_links: [],
      legal_text: `© ${new Date().getFullYear()} ${params.companyName}. All rights reserved.`,
    };
  }
}

// ============================================
// LANDING PAGE SERVICE
// ============================================

export class LandingPageService {
  private sectionGenerators = new SectionGenerators();

  /**
   * Generate a new landing page from product intelligence
   */
  async generate(params: {
    tenantId: string;
    productId: string;
    productIntelligenceId: string;
    productIntelligenceVersion: number;
    productIntelligence: {
      usp: { primary: string; secondary: string[] };
      audience: { primaryDemographic: string };
      painPoints: Array<{ problem: string }>;
      keywords: { primary: string[] };
    };
    creativeBriefId?: string;
    creativeBriefVersion?: number;
    creativeBrief?: {
      hooks: Array<{ text: string; type: string }>;
      ctas: string[];
    };
    productName: string;
    companyName: string;
    userId?: string;
  }): Promise<{ page: LandingPage; sections: LandingPageSection[] }> {
    const {
      tenantId,
      productId,
      productIntelligenceId,
      productIntelligenceVersion,
      productIntelligence,
      creativeBriefId,
      creativeBriefVersion,
      creativeBrief,
      productName,
      companyName,
      userId,
    } = params;

    // Generate input hash
    const inputHash = generateInputHash({
      productIntelligenceId,
      productIntelligenceVersion,
      creativeBriefId,
      creativeBriefVersion,
    });

    // Get latest version
    const { data: latestVersion } = await supabaseAdmin
      .from("landing_pages")
      .select("version")
      .eq("tenant_id", tenantId)
      .eq("product_id", productId)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    const newVersion = (latestVersion?.version || 0) + 1;

    // Generate all sections
    const [heroContent, featuresContent, testimonialsContent, ctaContent, faqContent] = await Promise.all([
      this.sectionGenerators.generateHero({ productIntelligence, creativeBrief }),
      this.sectionGenerators.generateFeatures({ productIntelligence }),
      this.sectionGenerators.generateTestimonials({ productIntelligence }),
      this.sectionGenerators.generateCta({ productIntelligence, creativeBrief }),
      this.sectionGenerators.generateFaq({ productIntelligence }),
    ]);

    const footerContent = this.sectionGenerators.generateFooter({ companyName });

    // Create landing page
    const pageId = generateId("lp");
    const page: LandingPage = {
      id: pageId,
      tenant_id: tenantId,
      product_id: productId,
      product_intelligence_id: productIntelligenceId,
      product_intelligence_version: productIntelligenceVersion,
      creative_brief_id: creativeBriefId || null,
      creative_brief_version: creativeBriefVersion || null,
      version: newVersion,
      name: `${productName} Landing Page`,
      slug: generateSlug(productName),
      status: "draft",
      theme: defaultTheme,
      meta_title: heroContent.headline,
      meta_description: heroContent.subheadline,
      og_image: null,
      input_hash: inputHash,
      created_at: new Date().toISOString(),
      created_by: userId || null,
      published_at: null,
      published_by: null,
    };

    // Create sections
    const sections: LandingPageSection[] = [
      {
        id: generateId("lps"),
        tenant_id: tenantId,
        landing_page_id: pageId,
        landing_page_version: newVersion,
        section_type: "hero",
        order: 1,
        content: heroContent,
        settings: {},
        is_visible: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: generateId("lps"),
        tenant_id: tenantId,
        landing_page_id: pageId,
        landing_page_version: newVersion,
        section_type: "features",
        order: 2,
        content: featuresContent,
        settings: {},
        is_visible: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: generateId("lps"),
        tenant_id: tenantId,
        landing_page_id: pageId,
        landing_page_version: newVersion,
        section_type: "testimonials",
        order: 3,
        content: testimonialsContent,
        settings: {},
        is_visible: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: generateId("lps"),
        tenant_id: tenantId,
        landing_page_id: pageId,
        landing_page_version: newVersion,
        section_type: "cta",
        order: 4,
        content: ctaContent,
        settings: {},
        is_visible: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: generateId("lps"),
        tenant_id: tenantId,
        landing_page_id: pageId,
        landing_page_version: newVersion,
        section_type: "faq",
        order: 5,
        content: faqContent,
        settings: {},
        is_visible: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: generateId("lps"),
        tenant_id: tenantId,
        landing_page_id: pageId,
        landing_page_version: newVersion,
        section_type: "footer",
        order: 6,
        content: footerContent,
        settings: {},
        is_visible: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    // Save to database
    await supabaseAdmin.from("landing_pages").insert(page);
    await supabaseAdmin.from("landing_page_sections").insert(sections);

    return { page, sections };
  }

  /**
   * Get landing page by ID
   */
  async get(tenantId: string, pageId: string): Promise<{ page: LandingPage; sections: LandingPageSection[] } | null> {
    const { data: page } = await supabaseAdmin
      .from("landing_pages")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", pageId)
      .single();

    if (!page) return null;

    const { data: sections } = await supabaseAdmin
      .from("landing_page_sections")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("landing_page_id", pageId)
      .eq("landing_page_version", page.version)
      .order("order", { ascending: true });

    return {
      page: page as LandingPage,
      sections: (sections || []) as LandingPageSection[],
    };
  }

  /**
   * Get latest landing page for a product
   */
  async getByProduct(tenantId: string, productId: string): Promise<{ page: LandingPage; sections: LandingPageSection[] } | null> {
    const { data: page } = await supabaseAdmin
      .from("landing_pages")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("product_id", productId)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    if (!page) return null;

    const { data: sections } = await supabaseAdmin
      .from("landing_page_sections")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("landing_page_id", page.id)
      .eq("landing_page_version", page.version)
      .order("order", { ascending: true });

    return {
      page: page as LandingPage,
      sections: (sections || []) as LandingPageSection[],
    };
  }

  /**
   * Get all versions of landing pages for a product
   */
  async getHistory(tenantId: string, productId: string): Promise<LandingPage[]> {
    const { data } = await supabaseAdmin
      .from("landing_pages")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("product_id", productId)
      .order("version", { ascending: false });

    return (data || []) as LandingPage[];
  }

  /**
   * Update a section
   */
  async updateSection(params: {
    tenantId: string;
    pageId: string;
    sectionId: string;
    content: SectionContent;
    userId?: string;
  }): Promise<LandingPageSection> {
    const { tenantId, pageId, sectionId, content, userId } = params;

    // Get current page
    const { data: page } = await supabaseAdmin
      .from("landing_pages")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", pageId)
      .single();

    if (!page) {
      throw new Error("Landing page not found");
    }

    if (page.status === "published") {
      throw new Error("Cannot edit published page. Create a new version.");
    }

    // Update section
    const { data: section, error } = await supabaseAdmin
      .from("landing_page_sections")
      .update({
        content,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", sectionId)
      .select()
      .single();

    if (error || !section) {
      throw new Error("Failed to update section");
    }

    return section as LandingPageSection;
  }

  /**
   * Publish a landing page
   */
  async publish(tenantId: string, pageId: string, userId?: string): Promise<LandingPage> {
    const { data: page, error } = await supabaseAdmin
      .from("landing_pages")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        published_by: userId || null,
      })
      .eq("tenant_id", tenantId)
      .eq("id", pageId)
      .select()
      .single();

    if (error || !page) {
      throw new Error("Failed to publish page");
    }

    return page as LandingPage;
  }

  /**
   * Unpublish a landing page
   */
  async unpublish(tenantId: string, pageId: string, userId?: string): Promise<LandingPage> {
    const { data: page, error } = await supabaseAdmin
      .from("landing_pages")
      .update({
        status: "archived",
      })
      .eq("tenant_id", tenantId)
      .eq("id", pageId)
      .select()
      .single();

    if (error || !page) {
      throw new Error("Failed to unpublish page");
    }

    return page as LandingPage;
  }

  /**
   * Create a variant for A/B testing
   */
  async createVariant(params: {
    tenantId: string;
    pageId: string;
    variantName: string;
    changes: Record<string, unknown>;
    trafficPercentage?: number;
  }): Promise<LandingPageVariant> {
    const { tenantId, pageId, variantName, changes, trafficPercentage = 50 } = params;

    const variant: LandingPageVariant = {
      id: generateId("lpv"),
      tenant_id: tenantId,
      landing_page_id: pageId,
      variant_name: variantName,
      changes,
      traffic_percentage: trafficPercentage,
      status: "draft",
      impressions: 0,
      conversions: 0,
      created_at: new Date().toISOString(),
    };

    await supabaseAdmin.from("landing_page_variants").insert(variant);

    return variant;
  }

  /**
   * Get variants for a landing page
   */
  async getVariants(tenantId: string, pageId: string): Promise<LandingPageVariant[]> {
    const { data } = await supabaseAdmin
      .from("landing_page_variants")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("landing_page_id", pageId)
      .order("created_at", { ascending: false });

    return (data || []) as LandingPageVariant[];
  }

  /**
   * Record variant impression
   */
  async recordImpression(tenantId: string, variantId: string): Promise<void> {
    await supabaseAdmin.rpc("increment_variant_impressions", {
      p_tenant_id: tenantId,
      p_variant_id: variantId,
    });
  }

  /**
   * Record variant conversion
   */
  async recordConversion(tenantId: string, variantId: string): Promise<void> {
    await supabaseAdmin.rpc("increment_variant_conversions", {
      p_tenant_id: tenantId,
      p_variant_id: variantId,
    });
  }
}

// ============================================
// EXPORT
// ============================================

export const sectionGenerators = new SectionGenerators();
export const landingPageService = new LandingPageService();
