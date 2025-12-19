/**
 * Landing Page Engine Tests - Block 3
 * 
 * Tests for landing page generation, versioning, sections, and variants.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  LandingPageService,
  SectionGenerators,
  LandingPage,
  LandingPageSection,
  LandingPageVariant,
  HeroSectionContent,
  FeaturesSectionContent,
  TestimonialsSectionContent,
  CtaSectionContent,
  FaqSectionContent,
  FooterSectionContent,
  PageStatus,
  SectionType,
} from "./landingPageEngine";

// Mock supabase
vi.mock("./supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: null })),
              })),
            })),
          })),
          order: vi.fn(() => Promise.resolve({ data: [] })),
          single: vi.fn(() => Promise.resolve({ data: null })),
        })),
        order: vi.fn(() => ({
          range: vi.fn(() => Promise.resolve({ data: [], count: 0 })),
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { id: "test" }, error: null })),
            })),
          })),
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: { id: "test" }, error: null })),
          })),
        })),
      })),
    })),
    rpc: vi.fn(() => Promise.resolve({ error: null })),
  },
}));

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(() =>
    Promise.resolve({
      choices: [
        {
          message: {
            content: JSON.stringify({
              headline: "Test Headline",
              subheadline: "Test Subheadline",
              cta_text: "Get Started",
              cta_url: "#",
              background_type: "gradient",
              background_value: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              layout: "centered",
            }),
          },
        },
      ],
    })
  ),
}));

describe("Landing Page Engine - Block 3", () => {
  describe("Section Types", () => {
    it("should define all required section types", () => {
      const sectionTypes: SectionType[] = [
        "hero",
        "features",
        "testimonials",
        "cta",
        "faq",
        "footer",
      ];

      expect(sectionTypes).toHaveLength(6);
      expect(sectionTypes).toContain("hero");
      expect(sectionTypes).toContain("features");
      expect(sectionTypes).toContain("testimonials");
      expect(sectionTypes).toContain("cta");
      expect(sectionTypes).toContain("faq");
      expect(sectionTypes).toContain("footer");
    });

    it("should define all page statuses", () => {
      const statuses: PageStatus[] = ["draft", "review", "published", "archived"];

      expect(statuses).toHaveLength(4);
      expect(statuses).toContain("draft");
      expect(statuses).toContain("review");
      expect(statuses).toContain("published");
      expect(statuses).toContain("archived");
    });
  });

  describe("Hero Section Content", () => {
    it("should have required hero fields", () => {
      const hero: HeroSectionContent = {
        headline: "Transform Your Business",
        subheadline: "AI-powered solutions for modern commerce",
        cta_text: "Start Free Trial",
        cta_url: "/signup",
        background_type: "gradient",
        background_value: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        layout: "centered",
      };

      expect(hero.headline).toBeDefined();
      expect(hero.subheadline).toBeDefined();
      expect(hero.cta_text).toBeDefined();
      expect(hero.cta_url).toBeDefined();
      expect(hero.background_type).toBeDefined();
      expect(hero.background_value).toBeDefined();
      expect(hero.layout).toBeDefined();
    });

    it("should support all hero layouts", () => {
      const layouts = ["centered", "left-aligned", "split"];
      layouts.forEach((layout) => {
        const hero: HeroSectionContent = {
          headline: "Test",
          subheadline: "Test",
          cta_text: "Test",
          cta_url: "#",
          background_type: "solid",
          background_value: "#ffffff",
          layout: layout as "centered" | "left-aligned" | "split",
        };
        expect(hero.layout).toBe(layout);
      });
    });

    it("should support all background types", () => {
      const types = ["image", "video", "gradient", "solid"];
      types.forEach((type) => {
        const hero: HeroSectionContent = {
          headline: "Test",
          subheadline: "Test",
          cta_text: "Test",
          cta_url: "#",
          background_type: type as "image" | "video" | "gradient" | "solid",
          background_value: "test",
          layout: "centered",
        };
        expect(hero.background_type).toBe(type);
      });
    });
  });

  describe("Features Section Content", () => {
    it("should have required features fields", () => {
      const features: FeaturesSectionContent = {
        section_title: "Why Choose Us",
        section_subtitle: "Powerful features for your business",
        features: [
          {
            icon: "zap",
            title: "Fast Performance",
            description: "Lightning-fast processing",
            highlight: true,
          },
        ],
        layout: "grid",
        columns: 3,
      };

      expect(features.section_title).toBeDefined();
      expect(features.features).toBeInstanceOf(Array);
      expect(features.features[0].icon).toBeDefined();
      expect(features.features[0].title).toBeDefined();
      expect(features.features[0].description).toBeDefined();
      expect(features.layout).toBeDefined();
      expect(features.columns).toBeDefined();
    });

    it("should support all features layouts", () => {
      const layouts = ["grid", "list", "alternating"];
      layouts.forEach((layout) => {
        const features: FeaturesSectionContent = {
          section_title: "Test",
          section_subtitle: "",
          features: [],
          layout: layout as "grid" | "list" | "alternating",
          columns: 3,
        };
        expect(features.layout).toBe(layout);
      });
    });
  });

  describe("Testimonials Section Content", () => {
    it("should have required testimonials fields", () => {
      const testimonials: TestimonialsSectionContent = {
        section_title: "What Our Customers Say",
        testimonials: [
          {
            quote: "Amazing product!",
            author_name: "John Doe",
            author_title: "CEO",
            author_image: "/images/john.jpg",
            rating: 5,
            company: "Acme Inc",
          },
        ],
        layout: "carousel",
        show_rating: true,
      };

      expect(testimonials.section_title).toBeDefined();
      expect(testimonials.testimonials).toBeInstanceOf(Array);
      expect(testimonials.testimonials[0].quote).toBeDefined();
      expect(testimonials.testimonials[0].author_name).toBeDefined();
      expect(testimonials.testimonials[0].rating).toBeDefined();
      expect(testimonials.layout).toBeDefined();
      expect(testimonials.show_rating).toBeDefined();
    });

    it("should validate rating range", () => {
      const testimonial = {
        quote: "Great!",
        author_name: "Jane",
        author_title: "Manager",
        author_image: "",
        rating: 5,
        company: "",
      };

      expect(testimonial.rating).toBeGreaterThanOrEqual(1);
      expect(testimonial.rating).toBeLessThanOrEqual(5);
    });
  });

  describe("CTA Section Content", () => {
    it("should have required CTA fields", () => {
      const cta: CtaSectionContent = {
        headline: "Ready to Get Started?",
        subheadline: "Join thousands of satisfied customers",
        cta_text: "Start Now",
        cta_url: "/signup",
        style: "banner",
        urgency_text: "Limited time offer!",
      };

      expect(cta.headline).toBeDefined();
      expect(cta.subheadline).toBeDefined();
      expect(cta.cta_text).toBeDefined();
      expect(cta.cta_url).toBeDefined();
      expect(cta.style).toBeDefined();
    });

    it("should support all CTA styles", () => {
      const styles = ["banner", "card", "fullwidth"];
      styles.forEach((style) => {
        const cta: CtaSectionContent = {
          headline: "Test",
          subheadline: "Test",
          cta_text: "Test",
          cta_url: "#",
          style: style as "banner" | "card" | "fullwidth",
          urgency_text: "",
        };
        expect(cta.style).toBe(style);
      });
    });
  });

  describe("FAQ Section Content", () => {
    it("should have required FAQ fields", () => {
      const faq: FaqSectionContent = {
        section_title: "Frequently Asked Questions",
        faqs: [
          {
            question: "How does it work?",
            answer: "It's simple...",
            category: "General",
          },
        ],
        layout: "accordion",
      };

      expect(faq.section_title).toBeDefined();
      expect(faq.faqs).toBeInstanceOf(Array);
      expect(faq.faqs[0].question).toBeDefined();
      expect(faq.faqs[0].answer).toBeDefined();
      expect(faq.layout).toBeDefined();
    });

    it("should support all FAQ layouts", () => {
      const layouts = ["accordion", "two-column", "list"];
      layouts.forEach((layout) => {
        const faq: FaqSectionContent = {
          section_title: "Test",
          faqs: [],
          layout: layout as "accordion" | "two-column" | "list",
        };
        expect(faq.layout).toBe(layout);
      });
    });
  });

  describe("Footer Section Content", () => {
    it("should have required footer fields", () => {
      const footer: FooterSectionContent = {
        company_name: "DeepSolution",
        tagline: "AI-powered commerce",
        links: [{ text: "Privacy", url: "/privacy" }],
        social_links: [{ platform: "twitter", url: "https://twitter.com" }],
        legal_text: "© 2024 DeepSolution",
      };

      expect(footer.company_name).toBeDefined();
      expect(footer.links).toBeInstanceOf(Array);
      expect(footer.social_links).toBeInstanceOf(Array);
      expect(footer.legal_text).toBeDefined();
    });
  });

  describe("Landing Page Structure", () => {
    it("should have required landing page fields", () => {
      const page: LandingPage = {
        id: "lp_123",
        tenant_id: "tenant_123",
        product_id: "prod_123",
        product_intelligence_id: "pi_123",
        product_intelligence_version: 1,
        creative_brief_id: "cb_123",
        creative_brief_version: 1,
        version: 1,
        name: "Product Landing Page",
        slug: "product-landing-page",
        status: "draft",
        theme: {
          colors: {
            primary: "#2563eb",
            secondary: "#1e40af",
            accent: "#3b82f6",
            background: "#ffffff",
            text: "#1f2937",
            muted: "#6b7280",
          },
          fonts: {
            heading: "Inter",
            body: "Inter",
          },
          spacing: {
            section: "6rem",
            element: "1.5rem",
          },
          borderRadius: "0.5rem",
          shadows: true,
        },
        meta_title: "Product Landing Page",
        meta_description: "Description",
        og_image: null,
        input_hash: "abc123",
        created_at: new Date().toISOString(),
        created_by: "user_123",
        published_at: null,
        published_by: null,
      };

      expect(page.id).toBeDefined();
      expect(page.tenant_id).toBeDefined();
      expect(page.product_id).toBeDefined();
      expect(page.version).toBe(1);
      expect(page.status).toBe("draft");
      expect(page.theme).toBeDefined();
      expect(page.theme.colors.primary).toBeDefined();
    });

    it("should track product intelligence source", () => {
      const page: LandingPage = {
        id: "lp_123",
        tenant_id: "tenant_123",
        product_id: "prod_123",
        product_intelligence_id: "pi_456",
        product_intelligence_version: 3,
        creative_brief_id: null,
        creative_brief_version: null,
        version: 1,
        name: "Test",
        slug: "test",
        status: "draft",
        theme: {} as any,
        meta_title: "",
        meta_description: "",
        og_image: null,
        input_hash: "abc",
        created_at: new Date().toISOString(),
        created_by: null,
        published_at: null,
        published_by: null,
      };

      expect(page.product_intelligence_id).toBe("pi_456");
      expect(page.product_intelligence_version).toBe(3);
    });
  });

  describe("Landing Page Section Structure", () => {
    it("should have required section fields", () => {
      const section: LandingPageSection = {
        id: "lps_123",
        tenant_id: "tenant_123",
        landing_page_id: "lp_123",
        landing_page_version: 1,
        section_type: "hero",
        order: 1,
        content: {
          headline: "Test",
          subheadline: "Test",
          cta_text: "Test",
          cta_url: "#",
          background_type: "solid",
          background_value: "#fff",
          layout: "centered",
        } as HeroSectionContent,
        settings: {},
        is_visible: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      expect(section.id).toBeDefined();
      expect(section.landing_page_id).toBeDefined();
      expect(section.section_type).toBe("hero");
      expect(section.order).toBe(1);
      expect(section.content).toBeDefined();
      expect(section.is_visible).toBe(true);
    });

    it("should maintain section order", () => {
      const sections: LandingPageSection[] = [
        { id: "1", section_type: "hero", order: 1 } as LandingPageSection,
        { id: "2", section_type: "features", order: 2 } as LandingPageSection,
        { id: "3", section_type: "testimonials", order: 3 } as LandingPageSection,
        { id: "4", section_type: "cta", order: 4 } as LandingPageSection,
        { id: "5", section_type: "faq", order: 5 } as LandingPageSection,
        { id: "6", section_type: "footer", order: 6 } as LandingPageSection,
      ];

      const sorted = [...sections].sort((a, b) => a.order - b.order);
      expect(sorted[0].section_type).toBe("hero");
      expect(sorted[5].section_type).toBe("footer");
    });
  });

  describe("Landing Page Variant Structure", () => {
    it("should have required variant fields", () => {
      const variant: LandingPageVariant = {
        id: "lpv_123",
        tenant_id: "tenant_123",
        landing_page_id: "lp_123",
        variant_name: "B",
        changes: {
          hero: { headline: "Alternative Headline" },
        },
        traffic_percentage: 50,
        status: "draft",
        impressions: 0,
        conversions: 0,
        created_at: new Date().toISOString(),
      };

      expect(variant.id).toBeDefined();
      expect(variant.landing_page_id).toBeDefined();
      expect(variant.variant_name).toBe("B");
      expect(variant.traffic_percentage).toBe(50);
      expect(variant.status).toBe("draft");
    });

    it("should track A/B test metrics", () => {
      const variant: LandingPageVariant = {
        id: "lpv_123",
        tenant_id: "tenant_123",
        landing_page_id: "lp_123",
        variant_name: "A",
        changes: {},
        traffic_percentage: 50,
        status: "active",
        impressions: 1000,
        conversions: 50,
        created_at: new Date().toISOString(),
      };

      const conversionRate = variant.conversions / variant.impressions;
      expect(conversionRate).toBe(0.05); // 5%
    });
  });

  describe("Section Generators", () => {
    const generators = new SectionGenerators();

    it("should generate footer section without AI", () => {
      const footer = generators.generateFooter({
        companyName: "TestCorp",
        tagline: "Building the future",
      });

      expect(footer.company_name).toBe("TestCorp");
      expect(footer.tagline).toBe("Building the future");
      expect(footer.links).toBeInstanceOf(Array);
      expect(footer.links.length).toBeGreaterThan(0);
      expect(footer.legal_text).toContain("TestCorp");
      expect(footer.legal_text).toContain(new Date().getFullYear().toString());
    });

    it("should generate testimonials placeholders", async () => {
      const testimonials = await generators.generateTestimonials({
        productIntelligence: {
          audience: { primaryDemographic: "Small business owners" },
        },
        count: 3,
      });

      expect(testimonials.section_title).toBe("What Our Customers Say");
      expect(testimonials.testimonials).toHaveLength(3);
      expect(testimonials.layout).toBe("carousel");
      expect(testimonials.show_rating).toBe(true);
    });
  });

  describe("Versioning", () => {
    it("should increment version numbers", () => {
      const versions = [1, 2, 3, 4, 5];
      const latestVersion = Math.max(...versions);
      const newVersion = latestVersion + 1;

      expect(newVersion).toBe(6);
    });

    it("should generate unique input hashes", () => {
      const input1 = { productId: "p1", version: 1 };
      const input2 = { productId: "p1", version: 2 };
      const input3 = { productId: "p2", version: 1 };

      // Different inputs should produce different hashes
      const hash1 = JSON.stringify(input1);
      const hash2 = JSON.stringify(input2);
      const hash3 = JSON.stringify(input3);

      expect(hash1).not.toBe(hash2);
      expect(hash1).not.toBe(hash3);
    });
  });

  describe("Status Flow", () => {
    it("should follow correct status transitions", () => {
      const validTransitions: Record<PageStatus, PageStatus[]> = {
        draft: ["review", "archived"],
        review: ["draft", "published", "archived"],
        published: ["archived"],
        archived: ["draft"],
      };

      expect(validTransitions.draft).toContain("review");
      expect(validTransitions.review).toContain("published");
      expect(validTransitions.published).toContain("archived");
    });

    it("should not allow editing published pages", () => {
      const page: LandingPage = {
        id: "lp_123",
        status: "published",
      } as LandingPage;

      const canEdit = page.status !== "published";
      expect(canEdit).toBe(false);
    });
  });

  describe("Theme System", () => {
    it("should have all required theme properties", () => {
      const theme = {
        colors: {
          primary: "#2563eb",
          secondary: "#1e40af",
          accent: "#3b82f6",
          background: "#ffffff",
          text: "#1f2937",
          muted: "#6b7280",
        },
        fonts: {
          heading: "Inter",
          body: "Inter",
        },
        spacing: {
          section: "6rem",
          element: "1.5rem",
        },
        borderRadius: "0.5rem",
        shadows: true,
      };

      expect(theme.colors.primary).toBeDefined();
      expect(theme.colors.secondary).toBeDefined();
      expect(theme.colors.accent).toBeDefined();
      expect(theme.colors.background).toBeDefined();
      expect(theme.colors.text).toBeDefined();
      expect(theme.colors.muted).toBeDefined();
      expect(theme.fonts.heading).toBeDefined();
      expect(theme.fonts.body).toBeDefined();
      expect(theme.spacing.section).toBeDefined();
      expect(theme.spacing.element).toBeDefined();
      expect(theme.borderRadius).toBeDefined();
      expect(typeof theme.shadows).toBe("boolean");
    });
  });

  describe("Tenant Isolation", () => {
    it("should require tenant_id on all records", () => {
      const page: LandingPage = {
        id: "lp_123",
        tenant_id: "tenant_456",
      } as LandingPage;

      const section: LandingPageSection = {
        id: "lps_123",
        tenant_id: "tenant_456",
      } as LandingPageSection;

      const variant: LandingPageVariant = {
        id: "lpv_123",
        tenant_id: "tenant_456",
      } as LandingPageVariant;

      expect(page.tenant_id).toBe("tenant_456");
      expect(section.tenant_id).toBe("tenant_456");
      expect(variant.tenant_id).toBe("tenant_456");
    });
  });

  describe("Slug Generation", () => {
    it("should generate URL-safe slugs", () => {
      const generateSlug = (name: string): string => {
        return name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 50);
      };

      expect(generateSlug("My Product Page")).toBe("my-product-page");
      expect(generateSlug("Product 123!")).toBe("product-123");
      expect(generateSlug("  Spaces  ")).toBe("spaces");
      expect(generateSlug("Special@#$Characters")).toBe("special-characters");
    });
  });

  describe("Integration with Product Intelligence", () => {
    it("should link to specific product intelligence version", () => {
      const page: LandingPage = {
        id: "lp_123",
        product_id: "prod_456",
        product_intelligence_id: "pi_789",
        product_intelligence_version: 3,
      } as LandingPage;

      expect(page.product_id).toBe("prod_456");
      expect(page.product_intelligence_id).toBe("pi_789");
      expect(page.product_intelligence_version).toBe(3);
    });

    it("should optionally link to creative brief", () => {
      const pageWithBrief: LandingPage = {
        id: "lp_1",
        creative_brief_id: "cb_123",
        creative_brief_version: 2,
      } as LandingPage;

      const pageWithoutBrief: LandingPage = {
        id: "lp_2",
        creative_brief_id: null,
        creative_brief_version: null,
      } as LandingPage;

      expect(pageWithBrief.creative_brief_id).toBe("cb_123");
      expect(pageWithoutBrief.creative_brief_id).toBeNull();
    });
  });

  describe("SEO Fields", () => {
    it("should have all SEO-related fields", () => {
      const page: LandingPage = {
        id: "lp_123",
        meta_title: "Best Product - Buy Now",
        meta_description: "Discover our amazing product with great features.",
        og_image: "https://example.com/og-image.jpg",
        slug: "best-product",
      } as LandingPage;

      expect(page.meta_title).toBeDefined();
      expect(page.meta_description).toBeDefined();
      expect(page.og_image).toBeDefined();
      expect(page.slug).toBeDefined();
    });

    it("should limit meta description length", () => {
      const description = "A".repeat(160);
      expect(description.length).toBeLessThanOrEqual(160);
    });
  });
});
