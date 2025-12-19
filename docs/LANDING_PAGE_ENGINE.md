# Landing Page Engine

This document defines the architecture for Block 3 of DeepSolution: the Landing Page Engine. This system generates high-converting landing pages from Product Intelligence and Creative Briefs.

## Overview

The Landing Page Engine transforms analyzed product data and creative strategy into structured landing page content. Pages are generated as versioned, editable records that humans can review and publish.

| Component | Purpose | Input | Output |
|-----------|---------|-------|--------|
| Page Generator | Create landing page structure | Product Intelligence + Creative Brief | Landing page with sections |
| Section Generators | Create individual sections | Product data + Creative elements | Hero, Features, Testimonials, CTA, FAQ |
| Variant System | A/B testing support | Base landing page | Page variants for testing |
| Publishing | Control page visibility | Landing page | Published/unpublished state |

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LANDING PAGE ENGINE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐     ┌──────────────────┐                              │
│  │ Product          │     │ Creative         │                              │
│  │ Intelligence     │     │ Brief            │                              │
│  │ (Block 1)        │     │ (Block 2)        │                              │
│  └────────┬─────────┘     └────────┬─────────┘                              │
│           │                        │                                         │
│           └───────────┬────────────┘                                         │
│                       │                                                      │
│                       ▼                                                      │
│           ┌──────────────────────┐                                          │
│           │   PAGE GENERATOR     │                                          │
│           │                      │                                          │
│           │ • Structure          │                                          │
│           │ • Theme              │                                          │
│           │ • Layout             │                                          │
│           └──────────┬───────────┘                                          │
│                      │                                                       │
│     ┌────────────────┼────────────────┐                                     │
│     │                │                │                                     │
│     ▼                ▼                ▼                                     │
│ ┌────────┐     ┌────────┐      ┌────────┐                                  │
│ │ HERO   │     │FEATURES│      │  CTA   │                                  │
│ │Section │     │Section │      │Section │                                  │
│ └────────┘     └────────┘      └────────┘                                  │
│     │                │                │                                     │
│     ▼                ▼                ▼                                     │
│ ┌────────┐     ┌────────┐      ┌────────┐                                  │
│ │TESTIM. │     │  FAQ   │      │ FOOTER │                                  │
│ │Section │     │Section │      │Section │                                  │
│ └────────┘     └────────┘      └────────┘                                  │
│                      │                                                       │
│                      ▼                                                       │
│           ┌──────────────────────┐                                          │
│           │   LANDING PAGE       │                                          │
│           │   [versioned]        │                                          │
│           │                      │                                          │
│           │ • Draft              │                                          │
│           │ • Review             │                                          │
│           │ • Published          │                                          │
│           └──────────────────────┘                                          │
│                      │                                                       │
│                      ▼                                                       │
│           ┌──────────────────────┐                                          │
│           │   VARIANT SYSTEM     │                                          │
│           │                      │                                          │
│           │ • A/B Testing        │                                          │
│           │ • Traffic Split      │                                          │
│           │ • Performance Track  │                                          │
│           └──────────────────────┘                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Section Types

The Landing Page Engine supports six core section types, each with specific content structure.

### 1. Hero Section

The hero section is the first thing visitors see. It captures attention and communicates the core value proposition.

| Field | Type | Description |
|-------|------|-------------|
| `headline` | String | Primary attention-grabbing headline |
| `subheadline` | String | Supporting text that expands on headline |
| `cta_text` | String | Call-to-action button text |
| `cta_url` | String | Button destination URL |
| `background_type` | Enum | image, video, gradient, solid |
| `background_value` | String | URL or color value |
| `layout` | Enum | centered, left-aligned, split |

### 2. Features Section

Highlights product features and benefits in a scannable format.

| Field | Type | Description |
|-------|------|-------------|
| `section_title` | String | Section heading |
| `section_subtitle` | String | Optional supporting text |
| `features` | Array | List of feature items |
| `layout` | Enum | grid, list, alternating |
| `columns` | Number | Grid columns (2, 3, or 4) |

Each feature item contains:

| Field | Type | Description |
|-------|------|-------------|
| `icon` | String | Icon identifier or URL |
| `title` | String | Feature name |
| `description` | String | Feature explanation |
| `highlight` | Boolean | Whether to emphasize this feature |

### 3. Testimonials Section

Social proof through customer testimonials.

| Field | Type | Description |
|-------|------|-------------|
| `section_title` | String | Section heading |
| `testimonials` | Array | List of testimonials |
| `layout` | Enum | carousel, grid, single |
| `show_rating` | Boolean | Display star ratings |

Each testimonial contains:

| Field | Type | Description |
|-------|------|-------------|
| `quote` | String | Customer testimonial text |
| `author_name` | String | Customer name |
| `author_title` | String | Job title or description |
| `author_image` | String | Profile image URL |
| `rating` | Number | Star rating (1-5) |
| `company` | String | Company name (optional) |

### 4. CTA Section

Secondary call-to-action to capture visitors who scroll past the hero.

| Field | Type | Description |
|-------|------|-------------|
| `headline` | String | Compelling action headline |
| `subheadline` | String | Supporting urgency text |
| `cta_text` | String | Button text |
| `cta_url` | String | Button destination |
| `style` | Enum | banner, card, fullwidth |
| `urgency_text` | String | Optional urgency message |

### 5. FAQ Section

Addresses common questions and objections.

| Field | Type | Description |
|-------|------|-------------|
| `section_title` | String | Section heading |
| `faqs` | Array | List of Q&A pairs |
| `layout` | Enum | accordion, two-column, list |

Each FAQ contains:

| Field | Type | Description |
|-------|------|-------------|
| `question` | String | The question |
| `answer` | String | The answer (supports markdown) |
| `category` | String | Optional grouping category |

### 6. Footer Section

Page footer with links and legal information.

| Field | Type | Description |
|-------|------|-------------|
| `company_name` | String | Business name |
| `tagline` | String | Company tagline |
| `links` | Array | Footer navigation links |
| `social_links` | Array | Social media links |
| `legal_text` | String | Copyright and legal notices |

## Database Schema

### landing_pages Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Tenant reference (RLS) |
| `product_id` | UUID | Product reference |
| `product_intelligence_id` | UUID | Source product intelligence |
| `product_intelligence_version` | Integer | Version used |
| `creative_brief_id` | UUID | Source creative brief |
| `creative_brief_version` | Integer | Version used |
| `version` | Integer | Page version number |
| `name` | String | Internal page name |
| `slug` | String | URL slug |
| `status` | Enum | draft, review, published, archived |
| `theme` | JSON | Visual theme settings |
| `meta_title` | String | SEO title |
| `meta_description` | String | SEO description |
| `og_image` | String | Social share image |
| `input_hash` | String | Deduplication hash |
| `created_at` | Timestamp | Creation time |
| `created_by` | UUID | Creator user |
| `published_at` | Timestamp | Publication time |
| `published_by` | UUID | Publisher user |

### landing_page_sections Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Tenant reference (RLS) |
| `landing_page_id` | UUID | Parent page reference |
| `landing_page_version` | Integer | Page version |
| `section_type` | Enum | hero, features, testimonials, cta, faq, footer |
| `order` | Integer | Display order |
| `content` | JSON | Section-specific content |
| `settings` | JSON | Section-specific settings |
| `is_visible` | Boolean | Whether section is shown |
| `created_at` | Timestamp | Creation time |
| `updated_at` | Timestamp | Last update time |

### landing_page_variants Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Tenant reference (RLS) |
| `landing_page_id` | UUID | Base page reference |
| `variant_name` | String | Variant identifier (A, B, C) |
| `changes` | JSON | Differences from base |
| `traffic_percentage` | Integer | Traffic allocation (0-100) |
| `status` | Enum | draft, active, winner, archived |
| `impressions` | Integer | View count |
| `conversions` | Integer | Conversion count |
| `created_at` | Timestamp | Creation time |

## Service API

### LandingPageService

```typescript
class LandingPageService {
  // Generate new landing page from product
  async generate(params: {
    tenantId: string;
    productId: string;
    productIntelligenceId: string;
    productIntelligenceVersion: number;
    creativeBriefId?: string;
    creativeBriefVersion?: number;
    userId?: string;
  }): Promise<LandingPage>;

  // Get landing page by ID
  async get(tenantId: string, pageId: string): Promise<LandingPage | null>;

  // Get landing page by product
  async getByProduct(tenantId: string, productId: string): Promise<LandingPage | null>;

  // Get all versions
  async getHistory(tenantId: string, productId: string): Promise<LandingPage[]>;

  // Update section
  async updateSection(params: {
    tenantId: string;
    pageId: string;
    sectionId: string;
    content: SectionContent;
    userId?: string;
  }): Promise<LandingPageSection>;

  // Publish page
  async publish(tenantId: string, pageId: string, userId?: string): Promise<LandingPage>;

  // Unpublish page
  async unpublish(tenantId: string, pageId: string, userId?: string): Promise<LandingPage>;

  // Create variant
  async createVariant(params: {
    tenantId: string;
    pageId: string;
    variantName: string;
    changes: VariantChanges;
  }): Promise<LandingPageVariant>;
}
```

### Section Generators

Each section type has a dedicated generator that uses AI to create content:

```typescript
// Hero section generator
async generateHeroSection(params: {
  productIntelligence: ProductIntelligence;
  creativeBrief?: CreativeBrief;
  hook?: Hook;
}): Promise<HeroSectionContent>;

// Features section generator
async generateFeaturesSection(params: {
  productIntelligence: ProductIntelligence;
  maxFeatures?: number;
}): Promise<FeaturesSectionContent>;

// Testimonials section generator (placeholder)
async generateTestimonialsSection(params: {
  productIntelligence: ProductIntelligence;
  count?: number;
}): Promise<TestimonialsSectionContent>;

// CTA section generator
async generateCtaSection(params: {
  productIntelligence: ProductIntelligence;
  creativeBrief?: CreativeBrief;
}): Promise<CtaSectionContent>;

// FAQ section generator
async generateFaqSection(params: {
  productIntelligence: ProductIntelligence;
  maxQuestions?: number;
}): Promise<FaqSectionContent>;
```

## Principles

### 1. AI as Content Generator, Not Publisher

AI generates landing page content, but humans control:
- Review and editing of generated content
- Publishing decisions
- A/B test configuration
- Traffic allocation

### 2. Versioned, Immutable Records

Following the pattern from Blocks 1 and 2:
- Every change creates a new version
- Previous versions are never modified
- Full audit trail maintained
- Easy rollback and comparison

### 3. Traceable Generation

Every landing page can be traced back to:
- The product intelligence that informed it
- The creative brief that guided messaging
- The specific hooks and angles used
- The user who published it

### 4. Section-Based Architecture

Pages are composed of independent sections:
- Each section can be edited individually
- Sections can be reordered
- Sections can be hidden without deletion
- New section types can be added

## Integration Points

### With Block 1 (Product Intelligence)

- Uses `audience`, `pain_points`, `usp`, `keywords` for content
- Links to specific product intelligence version
- Re-generation available when intelligence updates

### With Block 2 (Marketing Decision Engine)

- Uses creative brief for messaging strategy
- Uses hooks and angles for hero section
- Uses visual direction for theme

### With Future Blocks

- Performance tracking feeds into Performance Memory
- A/B test results inform Creative Logic
- Conversion data improves recommendations

## Theme System

Landing pages support customizable themes:

```typescript
interface LandingPageTheme {
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
```

## Status Flow

```
draft → review → published
  ↑       │         │
  │       ↓         │
  └─── archived ←───┘
```

| Status | Description | Editable | Visible |
|--------|-------------|----------|---------|
| `draft` | Work in progress | Yes | No |
| `review` | Pending approval | Yes | No |
| `published` | Live and visible | No* | Yes |
| `archived` | Retired version | No | No |

*Published pages require creating a new version to edit.

---

**IMPORTANT**: This architecture document is the authoritative source for Landing Page Engine design. Implementation must follow this structure to ensure consistency and maintainability.
