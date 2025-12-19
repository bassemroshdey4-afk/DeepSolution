# Marketing Decision Engine

This document defines the architecture for Block 2 of DeepSolution: the Marketing Decision Engine. This system transforms Product Intelligence into actionable marketing decisions through a structured, versioned pipeline.

## Overview

The Marketing Decision Engine is a four-component system that takes analyzed product data and produces optimized marketing outputs while learning from performance feedback.

| Component | Purpose | Input | Output |
|-----------|---------|-------|--------|
| Channel Intelligence | Determine suitable marketing channels | Product Intelligence | Channel recommendations with reasoning |
| Creative Logic | Design creative strategy before execution | Channel recommendations | Creative briefs (hooks, angles, visuals) |
| Ad Generation Engine | Produce ad creatives | Creative briefs | Versioned ad copies and assets |
| Performance Memory | Learn from results | Ad performance data | Insights and decision patterns |

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MARKETING DECISION ENGINE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐                                                        │
│  │ Product          │                                                        │
│  │ Intelligence     │ (Block 1)                                              │
│  │ [versioned]      │                                                        │
│  └────────┬─────────┘                                                        │
│           │                                                                  │
│           ▼                                                                  │
│  ┌──────────────────┐     ┌──────────────────┐                              │
│  │ 1. CHANNEL       │     │ Performance      │                              │
│  │    INTELLIGENCE  │◄────│ Memory Feedback  │                              │
│  │                  │     │                  │                              │
│  │ • Platform fit   │     └──────────────────┘                              │
│  │ • Budget alloc   │                                                        │
│  │ • Reasoning      │                                                        │
│  └────────┬─────────┘                                                        │
│           │                                                                  │
│           ▼                                                                  │
│  ┌──────────────────┐                                                        │
│  │ 2. CREATIVE      │                                                        │
│  │    LOGIC         │                                                        │
│  │                  │                                                        │
│  │ • Hooks          │                                                        │
│  │ • Angles         │                                                        │
│  │ • Visual style   │                                                        │
│  │ • CTAs           │                                                        │
│  └────────┬─────────┘                                                        │
│           │                                                                  │
│           ▼                                                                  │
│  ┌──────────────────┐                                                        │
│  │ 3. AD GENERATION │                                                        │
│  │    ENGINE        │                                                        │
│  │                  │                                                        │
│  │ • Ad copies      │                                                        │
│  │ • Variations     │                                                        │
│  │ • Audiences      │                                                        │
│  │ [versioned]      │                                                        │
│  └────────┬─────────┘                                                        │
│           │                                                                  │
│           ▼                                                                  │
│  ┌──────────────────┐                                                        │
│  │ 4. PERFORMANCE   │                                                        │
│  │    MEMORY        │                                                        │
│  │                  │                                                        │
│  │ • Results        │                                                        │
│  │ • Decisions      │                                                        │
│  │ • Learnings      │────────────────────────────────────┐                  │
│  └──────────────────┘                                    │                  │
│                                                          │                  │
│                                    Feedback Loop ────────┘                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component 1: Channel Intelligence

Channel Intelligence analyzes product characteristics and recommends the most suitable marketing channels with detailed reasoning.

### Purpose

This component answers the question: "Where should we market this product and why?"

### Input

| Field | Source | Description |
|-------|--------|-------------|
| `product_intelligence_id` | Block 1 | Reference to analyzed product |
| `product_intelligence_version` | Block 1 | Specific version used |
| `audience` | Product Intelligence | Target demographic |
| `visual_style.targetPlatformFit` | Product Intelligence | Platform fit scores |
| `price_sensitivity` | Product Intelligence | Price positioning |

### Output

| Field | Type | Description |
|-------|------|-------------|
| `recommended_channels` | Array | Ordered list of channels |
| `channel_scores` | Object | Score per channel (0-100) |
| `budget_allocation` | Object | Suggested % per channel |
| `reasoning` | Object | Explanation per channel |
| `confidence` | Number | Overall confidence (0-100) |

### Reasoning Structure

Each channel recommendation includes structured reasoning:

```typescript
{
  channel: "instagram",
  score: 85,
  budget_percentage: 35,
  reasoning: {
    audience_match: "High - 25-34 demographic active on platform",
    content_fit: "Visual product suits image-first platform",
    competition: "Medium - category has moderate ad density",
    cost_efficiency: "Good CPM for target demographic",
    historical_performance: "Similar products performed well"
  }
}
```

### Versioning

Channel recommendations are versioned and immutable. When product intelligence is updated or performance data suggests changes, a new version is created.

## Component 2: Creative Logic

Creative Logic designs the creative strategy before any ad copy is written. This ensures consistent messaging and intentional creative decisions.

### Purpose

This component answers: "What creative approach should we use for this product on these channels?"

### Input

| Field | Source | Description |
|-------|--------|-------------|
| `channel_recommendation_id` | Channel Intelligence | Reference to channel decision |
| `product_intelligence_id` | Block 1 | Product analysis |
| `pain_points` | Product Intelligence | Problems product solves |
| `usp` | Product Intelligence | Unique selling points |
| `keywords` | Product Intelligence | Keyword categories |

### Output: Creative Brief

| Field | Type | Description |
|-------|------|-------------|
| `hooks` | Array | Attention-grabbing opening lines |
| `angles` | Array | Different perspectives/approaches |
| `visual_direction` | Object | Image/video style guidance |
| `ctas` | Array | Call-to-action options |
| `tone` | String | Voice and tone guidance |
| `do_not_use` | Array | Phrases/approaches to avoid |

### Hook Types

| Type | Description | Example |
|------|-------------|---------|
| `problem` | Lead with pain point | "Tired of X?" |
| `solution` | Lead with benefit | "Finally, a way to..." |
| `curiosity` | Create intrigue | "The secret to..." |
| `social_proof` | Lead with validation | "Join 10,000+ who..." |
| `urgency` | Time-sensitive | "Limited time..." |
| `question` | Engage with question | "What if you could...?" |

### Angle Types

| Type | Description | Focus |
|------|-------------|-------|
| `emotional` | Connect emotionally | Feelings, aspirations |
| `rational` | Logic and facts | Features, specs, ROI |
| `social` | Community/belonging | Reviews, testimonials |
| `aspirational` | Future state | Transformation, goals |
| `fear` | Risk avoidance | Problems of not buying |

## Component 3: Ad Generation Engine

The Ad Generation Engine produces actual ad creatives based on the creative brief. All outputs are versioned for tracking and comparison.

### Purpose

This component answers: "What specific ads should we create?"

### Input

| Field | Source | Description |
|-------|--------|-------------|
| `creative_brief_id` | Creative Logic | Reference to creative strategy |
| `creative_brief_version` | Creative Logic | Specific version used |
| `channel` | Channel Intelligence | Target platform |
| `format` | Configuration | Ad format (image, video, carousel) |

### Output: Ad Creative

| Field | Type | Description |
|-------|------|-------------|
| `headline` | String | Primary headline |
| `body` | String | Ad body copy |
| `cta` | String | Call-to-action text |
| `hook_used` | String | Which hook from brief |
| `angle_used` | String | Which angle from brief |
| `visual_prompt` | String | Image generation prompt |
| `audience_targeting` | Object | Targeting parameters |

### Variations

Each ad creative can have multiple variations for A/B testing:

| Variation Type | What Changes |
|----------------|--------------|
| `headline` | Different headlines, same body |
| `hook` | Different opening hooks |
| `cta` | Different call-to-action |
| `audience` | Same ad, different targeting |
| `visual` | Same copy, different image |

### Versioning

Ad creatives follow the same versioning pattern as Product Intelligence:

- Every generation creates a new version
- Previous versions are never modified
- Each version links to its source creative_brief version
- Input hash prevents duplicate generation

## Component 4: Performance Memory

Performance Memory stores results and decisions, enabling the system to learn and improve over time.

### Purpose

This component answers: "What worked, what didn't, and what should we do differently?"

### Sub-components

#### 4.1 Performance Records

Raw performance data from ad platforms:

| Field | Type | Description |
|-------|------|-------------|
| `ad_creative_id` | UUID | Reference to ad |
| `platform` | String | Ad platform |
| `impressions` | Number | Total impressions |
| `clicks` | Number | Total clicks |
| `conversions` | Number | Total conversions |
| `spend` | Decimal | Amount spent |
| `ctr` | Decimal | Click-through rate |
| `cpc` | Decimal | Cost per click |
| `cpa` | Decimal | Cost per acquisition |
| `roas` | Decimal | Return on ad spend |

#### 4.2 Decision Log

Record of what was decided and why:

| Field | Type | Description |
|-------|------|-------------|
| `decision_type` | Enum | Type of decision |
| `entity_type` | String | What was decided on |
| `entity_id` | UUID | Reference to entity |
| `decision` | String | What was decided |
| `reasoning` | JSON | Why it was decided |
| `outcome` | JSON | Result of decision |

Decision types include: `channel_selection`, `budget_allocation`, `creative_direction`, `ad_pause`, `ad_scale`, `audience_change`.

#### 4.3 Learning Insights

Patterns and learnings extracted from performance data:

| Field | Type | Description |
|-------|------|-------------|
| `insight_type` | Enum | Category of insight |
| `scope` | Enum | tenant, product, category, platform |
| `pattern` | JSON | Detected pattern |
| `confidence` | Number | Confidence in pattern |
| `sample_size` | Number | Data points analyzed |
| `actionable` | Boolean | Can be acted upon |

Insight types include: `winning_hook`, `best_channel`, `optimal_budget`, `audience_insight`, `timing_pattern`, `creative_fatigue`.

## Database Schema

### Tables Overview

| Table | Component | Purpose |
|-------|-----------|---------|
| `channel_recommendations` | Channel Intelligence | Channel decisions |
| `channel_scores` | Channel Intelligence | Per-channel scoring |
| `creative_briefs` | Creative Logic | Creative strategy |
| `creative_elements` | Creative Logic | Individual elements |
| `ad_creatives` | Ad Generation | Generated ads |
| `ad_variations` | Ad Generation | A/B variants |
| `performance_records` | Performance Memory | Raw metrics |
| `decision_log` | Performance Memory | Decision history |
| `learning_insights` | Performance Memory | Extracted patterns |

### Key Relationships

```
product_intelligence (Block 1)
    │
    ├──► channel_recommendations
    │         │
    │         └──► channel_scores
    │
    └──► creative_briefs
              │
              ├──► creative_elements
              │
              └──► ad_creatives
                        │
                        ├──► ad_variations
                        │
                        └──► performance_records
                                   │
                                   └──► decision_log
                                            │
                                            └──► learning_insights
```

## Principles

### 1. AI as Analyzer, Not Decision-Maker

Consistent with Block 1, AI provides analysis and recommendations. Humans make final decisions on:

- Budget allocation
- Channel activation
- Creative approval
- Campaign launch

### 2. Versioned, Immutable Records

All components follow the versioning pattern:

- Every change creates a new version
- Previous versions are never modified
- Full audit trail maintained
- Easy rollback and comparison

### 3. Traceable Decisions

Every ad creative can be traced back to:

- The creative brief that guided it
- The channel recommendation that selected the platform
- The product intelligence that informed everything
- The performance data that validated or invalidated it

### 4. Learning Loop

Performance data feeds back into future decisions:

```
Product → Channel → Creative → Ad → Performance
    ▲                                    │
    └────────────────────────────────────┘
```

## Integration Points

### With Block 1 (Product Intelligence)

- Channel Intelligence reads from `product_intelligence`
- Creative Logic uses `audience`, `pain_points`, `usp`, `keywords`
- Changes in Product Intelligence trigger re-evaluation

### With n8n Automation

- Performance data sync via scheduled workflows
- Alert workflows for performance anomalies
- Budget adjustment recommendations

### With Future Blocks

- Landing Page Generation (Block 3) will use Creative Logic
- Campaign Management will orchestrate Ad Generation
- Reporting will aggregate Performance Memory

## API Structure

```typescript
// Channel Intelligence
channelIntelligence.analyze(productIntelligenceId)
channelIntelligence.get(productId)
channelIntelligence.getHistory(productId)

// Creative Logic
creativeLogic.generateBrief(channelRecommendationId)
creativeLogic.getBrief(productId, channel)
creativeLogic.updateElements(briefId, elements)

// Ad Generation
adGeneration.generate(creativeBriefId, format)
adGeneration.createVariation(adCreativeId, variationType)
adGeneration.get(adCreativeId)
adGeneration.getByProduct(productId)

// Performance Memory
performanceMemory.recordMetrics(adCreativeId, metrics)
performanceMemory.logDecision(decision)
performanceMemory.getInsights(scope, filters)
performanceMemory.getDecisionHistory(entityId)
```

---

**IMPORTANT**: This architecture document is the authoritative source for Marketing Decision Engine design. Implementation must follow this structure to ensure consistency and maintainability.
