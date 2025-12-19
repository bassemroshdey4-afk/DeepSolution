# Product Intelligence - Single Source of Truth

## Overview

Product Intelligence is the structured data layer that powers all AI and decision-making in DeepSolution. It provides versioned, auditable analysis of products that serves as the foundation for ads, campaigns, and recommendations.

## Core Principles

### 1. Versioned, Immutable Records

Every analysis creates a new version. **No existing version is ever overwritten.**

```
product_intelligence
├── product_id: "prod_123"
├── version: 1  ← Never modified
├── version: 2  ← New analysis
├── version: 3  ← Latest
```

### 2. AI as Analyzer, Not Decision-Maker

AI provides structured analysis data. **Humans and downstream systems make decisions.**

| AI Provides | AI Does NOT Provide |
|-------------|---------------------|
| Audience demographics | "Target this audience" |
| Price sensitivity level | "Set price to X" |
| Competitor analysis | "Beat competitor Y" |
| Platform fit scores | "Use Instagram only" |

### 3. Single Source of Truth

All downstream logic **must reference Product Intelligence versions**, not raw product data.

```typescript
// ❌ WRONG: Using raw product
const keywords = product.description.split(' ');

// ✅ CORRECT: Using analyzed intelligence
const intelligence = await getProductIntelligence(productId, tenantId);
const keywords = intelligence.keywords.primary;
```

## Data Structure

### Structured Output Fields

| Field | Type | Description |
|-------|------|-------------|
| `audience` | Object | Target demographic profile |
| `painPoints` | Array | Problems the product solves |
| `priceSensitivity` | Object | Price elasticity analysis |
| `usp` | Object | Unique selling propositions |
| `visualStyle` | Object | Visual characteristics + platform fit |
| `keywords` | Object | Primary, secondary, long-tail, negative |
| `competitors` | Array | Competitive landscape |
| `confidence` | Number | Analysis confidence (0-100) |

### Metadata

| Field | Description |
|-------|-------------|
| `version` | Auto-incrementing per product |
| `inputHash` | SHA-256 hash of inputs (for deduplication) |
| `analysisSource` | "ai" \| "manual" \| "hybrid" |
| `createdAt` | Timestamp |
| `createdBy` | User ID who triggered analysis |

## Usage Guidelines

### Creating New Analysis

```typescript
// Analyze a product
const intelligence = await analyzeProduct({
  productId: "prod_123",
  tenantId: "tenant_456",
  name: "Product Name",
  description: "Product description",
  imageUrls: ["https://..."],
  price: 199,
});
```

### Referencing in Downstream Systems

```typescript
// Ad Campaign Creation
const campaign = {
  productIntelligenceId: intelligence.id,
  productIntelligenceVersion: intelligence.version,
  targetAudience: intelligence.audience,
  keywords: intelligence.keywords.primary,
};

// Landing Page Generation
const landingPage = {
  productIntelligenceVersion: intelligence.version,
  headline: intelligence.usp.primary,
  painPoints: intelligence.painPoints,
};
```

### Version Comparison

```typescript
// Compare two versions to see what changed
const comparison = await compareIntelligenceVersions(
  productId,
  tenantId,
  versionA: 1,
  versionB: 3
);

// Returns: { versionA, versionB, changes: { field: { before, after } } }
```

## Audit Trail

Every Product Intelligence operation is logged:

| Event | Logged Data |
|-------|-------------|
| `PRODUCT_INTELLIGENCE_CREATED` | productId, version, confidence, inputHash |

## Tenant Isolation

All queries are scoped by `tenant_id`. Row Level Security (RLS) ensures:
- Tenant A cannot access Tenant B's intelligence
- All operations require `tenant_id`
- Cross-tenant queries are blocked at database level

## Best Practices

1. **Always use latest version** unless comparing historical data
2. **Reference version numbers** in downstream records for traceability
3. **Force reanalyze** only when product significantly changes
4. **Check confidence score** before using low-confidence analysis
5. **Use input hash** to avoid redundant analysis of unchanged products

## API Reference

| Endpoint | Description |
|----------|-------------|
| `productIntelligence.analyze` | Analyze a product (creates new version) |
| `productIntelligence.get` | Get latest intelligence for product |
| `productIntelligence.getHistory` | Get all versions for product |
| `productIntelligence.getVersion` | Get specific version |
| `productIntelligence.compareVersions` | Compare two versions |
| `productIntelligence.analyzeBatch` | Analyze multiple products |
| `productIntelligence.getAggregatedInsights` | Cross-product analytics |

---

**IMPORTANT**: This document defines the contract for Product Intelligence. Any changes to the versioning or immutability guarantees require architectural review.
