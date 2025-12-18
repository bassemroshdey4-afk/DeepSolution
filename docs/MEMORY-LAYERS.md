# DeepSolution Cognitive Memory System

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COGNITIVE MEMORY SYSTEM                              │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        LAYER 9: META-LEARNING                        │    │
│  │              Cross-tenant patterns, system-wide insights             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    ▲                                         │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐              │
│  │   LAYER 8    │   LAYER 7    │   LAYER 6    │   LAYER 5    │              │
│  │  Financial   │ Operational  │  Customer    │  Logistics   │              │
│  │ Intelligence │ Intelligence │  Behavior    │ Intelligence │              │
│  └──────────────┴──────────────┴──────────────┴──────────────┘              │
│                                    ▲                                         │
│  ┌──────────────────────────┬──────────────────────────┐                    │
│  │        LAYER 4           │        LAYER 3           │                    │
│  │  Product Intelligence    │  Campaign Intelligence   │                    │
│  └──────────────────────────┴──────────────────────────┘                    │
│                                    ▲                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      LAYER 2: STRATEGY MEMORY                        │    │
│  │              Business goals, KPIs, decision frameworks               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    ▲                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      LAYER 1: TENANT DNA                             │    │
│  │              Identity, preferences, constraints, history             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    ▲                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      RAW EVENT FOUNDATION                            │    │
│  │              All events, actions, interactions (immutable)           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  tenant_id isolation via RLS on ALL tables                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Principles

### 1. Event-Sourced Foundation

All data originates from immutable events. Events are never deleted, only appended. This provides complete audit trail and enables time-travel queries.

```
Event → Raw Storage → Profile Aggregation → Insight Generation → Memory Update
```

### 2. Three-Tier Data Model

| Tier | Purpose | Mutability | Retention |
|------|---------|------------|-----------|
| **Raw Events** | Immutable facts | Append-only | Forever |
| **Profiles** | Aggregated state | Updated on events | Forever |
| **Insights** | AI-learned patterns | Evolves with confidence | Versioned |

### 3. Confidence Scoring

Every AI-generated insight includes:

| Field | Type | Description |
|-------|------|-------------|
| `confidence` | 0.0-1.0 | How certain is this insight |
| `evidence_count` | INT | Number of supporting events |
| `evidence_refs` | UUID[] | Links to source events |
| `first_observed` | TIMESTAMP | When pattern first detected |
| `last_confirmed` | TIMESTAMP | Last time pattern held true |
| `contradiction_count` | INT | Times pattern was violated |

### 4. Learning Loop

```
Observe Event → Match Against Insights → 
  IF confirms → Increase confidence
  IF contradicts → Decrease confidence, log contradiction
  IF new pattern → Generate hypothesis (low confidence)
```

---

## Layer 1: Tenant DNA Memory

### Purpose

Stores the fundamental identity, preferences, constraints, and historical context of each tenant. This is the "personality" that shapes all AI interactions.

### Tables

#### `tenant_dna`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK to tenants |
| `business_type` | VARCHAR | e-commerce, dropshipping, manufacturer |
| `industry` | VARCHAR | fashion, electronics, food, etc. |
| `target_market` | JSONB | Demographics, geography |
| `brand_voice` | JSONB | Tone, style, keywords |
| `communication_preferences` | JSONB | Channels, timing, frequency |
| `constraints` | JSONB | Budget limits, forbidden actions |
| `goals` | JSONB | Short/long term objectives |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

#### `tenant_dna_history`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK to tenants |
| `dna_snapshot` | JSONB | Full DNA at point in time |
| `change_reason` | TEXT | Why DNA was updated |
| `changed_by` | UUID | User or 'system' |
| `created_at` | TIMESTAMPTZ | |

### AI Read Pattern

```sql
-- Get current tenant DNA for AI context
SELECT * FROM tenant_dna WHERE tenant_id = $1;

-- Get DNA evolution for trend analysis
SELECT * FROM tenant_dna_history 
WHERE tenant_id = $1 
ORDER BY created_at DESC LIMIT 10;
```

### AI Write Pattern

```sql
-- AI suggests DNA update based on observed patterns
INSERT INTO tenant_dna_suggestions (
  tenant_id, field, current_value, suggested_value, 
  reasoning, confidence, evidence_refs
) VALUES ($1, $2, $3, $4, $5, $6, $7);
```

### Mistake Prevention

The `tenant_dna_mistakes` table tracks when AI recommendations based on DNA assumptions failed:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK |
| `assumption` | TEXT | What AI assumed |
| `action_taken` | TEXT | What AI did |
| `outcome` | TEXT | What happened |
| `lesson_learned` | TEXT | AI-generated lesson |
| `created_at` | TIMESTAMPTZ | |

---

## Layer 2: Strategy Memory

### Purpose

Captures business strategy, KPIs, decision frameworks, and strategic preferences. Guides AI in making decisions aligned with business goals.

### Tables

#### `strategy_goals`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK |
| `goal_type` | VARCHAR | revenue, growth, efficiency, brand |
| `title` | VARCHAR | Goal name |
| `description` | TEXT | Detailed description |
| `target_metric` | VARCHAR | KPI to measure |
| `target_value` | DECIMAL | Target number |
| `current_value` | DECIMAL | Current progress |
| `deadline` | DATE | Target date |
| `priority` | INT | 1-10 scale |
| `status` | VARCHAR | active, achieved, abandoned |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

#### `strategy_decisions`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK |
| `decision_type` | VARCHAR | pricing, marketing, inventory, etc. |
| `context` | JSONB | Situation when decision was made |
| `options_considered` | JSONB | What alternatives existed |
| `decision_made` | TEXT | What was chosen |
| `reasoning` | TEXT | Why this choice |
| `outcome` | JSONB | What happened (filled later) |
| `outcome_rating` | INT | 1-5 success rating |
| `lessons` | TEXT | What was learned |
| `made_by` | VARCHAR | user, ai_suggested, ai_auto |
| `created_at` | TIMESTAMPTZ | |
| `evaluated_at` | TIMESTAMPTZ | |

#### `strategy_frameworks`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK |
| `framework_type` | VARCHAR | pricing, promotion, inventory |
| `rules` | JSONB | Decision rules |
| `conditions` | JSONB | When to apply |
| `priority` | INT | If multiple match |
| `is_active` | BOOLEAN | |
| `created_at` | TIMESTAMPTZ | |

### AI Read Pattern

```sql
-- Get active goals for decision context
SELECT * FROM strategy_goals 
WHERE tenant_id = $1 AND status = 'active'
ORDER BY priority DESC;

-- Get relevant past decisions for similar situations
SELECT * FROM strategy_decisions
WHERE tenant_id = $1 
  AND decision_type = $2
  AND outcome_rating >= 4
ORDER BY created_at DESC LIMIT 5;
```

### AI Write Pattern

```sql
-- Log AI decision for future learning
INSERT INTO strategy_decisions (
  tenant_id, decision_type, context, options_considered,
  decision_made, reasoning, made_by
) VALUES ($1, $2, $3, $4, $5, $6, 'ai_auto');
```

### Mistake Prevention

```sql
-- Before making decision, check for similar failed decisions
SELECT * FROM strategy_decisions
WHERE tenant_id = $1
  AND decision_type = $2
  AND outcome_rating <= 2
  AND context @> $3  -- Similar context
ORDER BY created_at DESC;
```

---

## Layer 3: Campaign Intelligence Memory

### Purpose

Stores learned patterns about marketing campaigns, what works, what doesn't, audience insights, and optimization strategies.

### Tables

#### `campaign_events`

Raw immutable events:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK |
| `campaign_id` | UUID | FK to campaigns |
| `event_type` | VARCHAR | impression, click, conversion, spend |
| `event_data` | JSONB | Event details |
| `source` | VARCHAR | facebook, google, manual |
| `created_at` | TIMESTAMPTZ | Immutable |

#### `campaign_profiles`

Aggregated state per campaign:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK |
| `campaign_id` | UUID | FK |
| `total_impressions` | BIGINT | |
| `total_clicks` | BIGINT | |
| `total_conversions` | INT | |
| `total_spend` | INT | In smallest currency unit |
| `total_revenue` | INT | |
| `ctr` | DECIMAL | Click-through rate |
| `cvr` | DECIMAL | Conversion rate |
| `cpa` | DECIMAL | Cost per acquisition |
| `roas` | DECIMAL | Return on ad spend |
| `best_performing_hour` | INT | 0-23 |
| `best_performing_day` | INT | 0-6 |
| `top_audiences` | JSONB | Best performing segments |
| `updated_at` | TIMESTAMPTZ | |

#### `campaign_insights`

AI-learned patterns:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK |
| `insight_type` | VARCHAR | audience, timing, creative, budget |
| `insight` | TEXT | Human-readable insight |
| `pattern` | JSONB | Machine-readable pattern |
| `confidence` | DECIMAL | 0.0-1.0 |
| `evidence_count` | INT | Supporting data points |
| `evidence_refs` | UUID[] | Links to events |
| `first_observed` | TIMESTAMPTZ | |
| `last_confirmed` | TIMESTAMPTZ | |
| `contradiction_count` | INT | |
| `is_active` | BOOLEAN | Still valid |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### AI Read Pattern

```sql
-- Get campaign insights for optimization
SELECT * FROM campaign_insights
WHERE tenant_id = $1
  AND insight_type = $2
  AND confidence >= 0.7
  AND is_active = true
ORDER BY confidence DESC, evidence_count DESC;

-- Get historical performance for similar campaigns
SELECT * FROM campaign_profiles cp
JOIN campaigns c ON c.id = cp.campaign_id
WHERE cp.tenant_id = $1
  AND c.platform = $2
  AND cp.roas > 1.5
ORDER BY cp.roas DESC LIMIT 5;
```

### AI Write Pattern

```sql
-- Record new insight
INSERT INTO campaign_insights (
  tenant_id, insight_type, insight, pattern,
  confidence, evidence_count, evidence_refs
) VALUES ($1, $2, $3, $4, 0.5, 1, ARRAY[$5]);

-- Update confidence when pattern confirmed
UPDATE campaign_insights
SET confidence = LEAST(confidence + 0.05, 1.0),
    evidence_count = evidence_count + 1,
    evidence_refs = array_append(evidence_refs, $2),
    last_confirmed = NOW()
WHERE id = $1;

-- Decrease confidence when contradicted
UPDATE campaign_insights
SET confidence = GREATEST(confidence - 0.1, 0.0),
    contradiction_count = contradiction_count + 1
WHERE id = $1;
```

### Mistake Prevention

```sql
-- Track campaign mistakes
CREATE TABLE campaign_mistakes (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  campaign_id UUID,
  mistake_type VARCHAR NOT NULL,
  description TEXT NOT NULL,
  impact JSONB,
  root_cause TEXT,
  prevention_rule JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Before launching campaign, check for similar mistakes
SELECT * FROM campaign_mistakes
WHERE tenant_id = $1
  AND mistake_type = $2
ORDER BY created_at DESC;
```

---

## Layer 4: Product Intelligence Memory

### Purpose

Learns about product performance, pricing optimization, demand patterns, and product relationships.

### Tables

#### `product_events`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK |
| `product_id` | UUID | FK |
| `event_type` | VARCHAR | view, cart_add, purchase, return, review |
| `event_data` | JSONB | Details |
| `source` | VARCHAR | website, landing_page, whatsapp |
| `created_at` | TIMESTAMPTZ | |

#### `product_profiles`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK |
| `product_id` | UUID | FK |
| `total_views` | INT | |
| `total_cart_adds` | INT | |
| `total_purchases` | INT | |
| `total_returns` | INT | |
| `total_revenue` | INT | |
| `avg_rating` | DECIMAL | |
| `view_to_cart_rate` | DECIMAL | |
| `cart_to_purchase_rate` | DECIMAL | |
| `return_rate` | DECIMAL | |
| `best_selling_days` | INT[] | Days of week |
| `best_selling_hours` | INT[] | Hours of day |
| `common_bundles` | UUID[] | Products bought together |
| `price_elasticity` | DECIMAL | How price affects demand |
| `updated_at` | TIMESTAMPTZ | |

#### `product_insights`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK |
| `product_id` | UUID | NULL for category-level |
| `insight_type` | VARCHAR | pricing, demand, bundling, seasonal |
| `insight` | TEXT | |
| `pattern` | JSONB | |
| `confidence` | DECIMAL | |
| `evidence_count` | INT | |
| `evidence_refs` | UUID[] | |
| `recommendation` | JSONB | Suggested action |
| `is_active` | BOOLEAN | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

#### `product_price_history`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK |
| `product_id` | UUID | FK |
| `price` | INT | |
| `cost` | INT | |
| `margin_percent` | DECIMAL | |
| `sales_velocity` | DECIMAL | Units/day at this price |
| `started_at` | TIMESTAMPTZ | |
| `ended_at` | TIMESTAMPTZ | |

### AI Read Pattern

```sql
-- Get product intelligence for pricing decision
SELECT 
  pp.*,
  (SELECT json_agg(pi.*) FROM product_insights pi 
   WHERE pi.product_id = pp.product_id AND pi.is_active)
FROM product_profiles pp
WHERE pp.product_id = $1;

-- Get price elasticity data
SELECT * FROM product_price_history
WHERE product_id = $1
ORDER BY started_at DESC;
```

### AI Write Pattern

```sql
-- Detect and store bundling pattern
INSERT INTO product_insights (
  tenant_id, product_id, insight_type, insight, pattern,
  confidence, evidence_count, recommendation
) VALUES (
  $1, $2, 'bundling',
  'Products X and Y are frequently purchased together',
  '{"product_ids": ["uuid1", "uuid2"], "co_purchase_rate": 0.35}',
  0.7, 50,
  '{"action": "create_bundle", "discount": 10}'
);
```

---

## Layer 5: Logistics & Fulfillment Intelligence

### Purpose

Learns about shipping patterns, delivery success factors, carrier performance, and fulfillment optimization.

### Tables

#### `fulfillment_events`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK |
| `order_id` | UUID | FK |
| `shipment_id` | UUID | FK |
| `event_type` | VARCHAR | created, picked, shipped, delivered, failed, returned |
| `event_data` | JSONB | |
| `created_at` | TIMESTAMPTZ | |

#### `fulfillment_profiles`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK |
| `period` | VARCHAR | daily, weekly, monthly |
| `period_start` | DATE | |
| `total_orders` | INT | |
| `total_shipped` | INT | |
| `total_delivered` | INT | |
| `total_failed` | INT | |
| `total_returned` | INT | |
| `avg_processing_hours` | DECIMAL | Order to ship |
| `avg_delivery_days` | DECIMAL | Ship to deliver |
| `delivery_success_rate` | DECIMAL | |
| `by_region` | JSONB | Stats per region |
| `by_carrier` | JSONB | Stats per carrier |
| `updated_at` | TIMESTAMPTZ | |

#### `fulfillment_insights`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK |
| `insight_type` | VARCHAR | carrier, region, timing, packaging |
| `insight` | TEXT | |
| `pattern` | JSONB | |
| `confidence` | DECIMAL | |
| `evidence_count` | INT | |
| `recommendation` | JSONB | |
| `is_active` | BOOLEAN | |
| `created_at` | TIMESTAMPTZ | |

### AI Read Pattern

```sql
-- Get carrier performance for routing decision
SELECT * FROM fulfillment_profiles
WHERE tenant_id = $1
  AND period = 'monthly'
ORDER BY period_start DESC LIMIT 3;

-- Get region-specific insights
SELECT * FROM fulfillment_insights
WHERE tenant_id = $1
  AND pattern->>'region' = $2
  AND confidence >= 0.6;
```

### Mistake Prevention

```sql
-- Track delivery failures for pattern learning
CREATE TABLE fulfillment_failures (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  order_id UUID,
  failure_type VARCHAR NOT NULL,
  failure_reason TEXT,
  region VARCHAR,
  carrier VARCHAR,
  was_preventable BOOLEAN,
  prevention_insight TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Layer 6: Customer Behavior Intelligence

### Purpose

Privacy-safe aggregated patterns about customer behavior, preferences, and segments. No PII stored in insights.

### Tables

#### `customer_events`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK |
| `customer_hash` | VARCHAR | Hashed identifier |
| `event_type` | VARCHAR | order, return, inquiry, complaint |
| `event_data` | JSONB | Anonymized data |
| `created_at` | TIMESTAMPTZ | |

#### `customer_segments`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK |
| `segment_name` | VARCHAR | vip, at_risk, new, dormant |
| `segment_rules` | JSONB | How to identify |
| `customer_count` | INT | |
| `avg_order_value` | INT | |
| `avg_orders_per_year` | DECIMAL | |
| `avg_lifetime_value` | INT | |
| `churn_risk` | DECIMAL | |
| `best_channels` | JSONB | |
| `best_products` | UUID[] | |
| `updated_at` | TIMESTAMPTZ | |

#### `behavior_insights`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK |
| `insight_type` | VARCHAR | segment, timing, channel, product_affinity |
| `insight` | TEXT | |
| `pattern` | JSONB | |
| `confidence` | DECIMAL | |
| `evidence_count` | INT | |
| `applies_to_segment` | VARCHAR | |
| `recommendation` | JSONB | |
| `is_active` | BOOLEAN | |
| `created_at` | TIMESTAMPTZ | |

### Privacy Safeguards

1. **No PII in insights** - Only aggregated patterns
2. **Customer hashing** - Phone/email hashed before storage
3. **Minimum threshold** - Insights require 10+ data points
4. **Anonymization** - Individual behavior not stored

### AI Read Pattern

```sql
-- Get segment insights for targeting
SELECT * FROM customer_segments
WHERE tenant_id = $1
ORDER BY avg_lifetime_value DESC;

-- Get behavior patterns for personalization
SELECT * FROM behavior_insights
WHERE tenant_id = $1
  AND applies_to_segment = $2
  AND confidence >= 0.7;
```

---

## Layer 7: Operational Intelligence

### Purpose

Learns about operational patterns, bottlenecks, efficiency opportunities, and process optimization.

### Tables

#### `operation_events`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK |
| `operation_type` | VARCHAR | order_processing, call_center, inventory |
| `event_type` | VARCHAR | started, completed, delayed, failed |
| `duration_seconds` | INT | |
| `event_data` | JSONB | |
| `created_at` | TIMESTAMPTZ | |

#### `operation_metrics`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK |
| `metric_date` | DATE | |
| `orders_received` | INT | |
| `orders_processed` | INT | |
| `orders_shipped` | INT | |
| `calls_made` | INT | |
| `calls_successful` | INT | |
| `avg_processing_time` | INT | Seconds |
| `avg_call_duration` | INT | Seconds |
| `call_confirmation_rate` | DECIMAL | |
| `inventory_turnover` | DECIMAL | |
| `stockout_incidents` | INT | |
| `updated_at` | TIMESTAMPTZ | |

#### `operation_insights`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK |
| `insight_type` | VARCHAR | bottleneck, efficiency, capacity |
| `insight` | TEXT | |
| `pattern` | JSONB | |
| `impact_estimate` | JSONB | Time/money saved if fixed |
| `confidence` | DECIMAL | |
| `recommendation` | JSONB | |
| `is_active` | BOOLEAN | |
| `created_at` | TIMESTAMPTZ | |

### AI Read Pattern

```sql
-- Get operational bottlenecks
SELECT * FROM operation_insights
WHERE tenant_id = $1
  AND insight_type = 'bottleneck'
  AND confidence >= 0.6
ORDER BY (impact_estimate->>'hours_saved')::int DESC;
```

---

## Layer 8: Financial Intelligence

### Purpose

Learns about financial patterns, profitability drivers, cash flow optimization, and pricing strategies.

### Tables

#### `financial_events`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK |
| `event_type` | VARCHAR | revenue, cost, refund, fee |
| `amount` | INT | In smallest currency unit |
| `currency` | VARCHAR | |
| `category` | VARCHAR | product, shipping, marketing, platform |
| `reference_type` | VARCHAR | order, campaign, subscription |
| `reference_id` | UUID | |
| `event_data` | JSONB | |
| `created_at` | TIMESTAMPTZ | |

#### `financial_profiles`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK |
| `period` | VARCHAR | daily, weekly, monthly |
| `period_start` | DATE | |
| `gross_revenue` | INT | |
| `net_revenue` | INT | After refunds |
| `total_costs` | INT | |
| `product_costs` | INT | |
| `shipping_costs` | INT | |
| `marketing_costs` | INT | |
| `platform_fees` | INT | |
| `gross_profit` | INT | |
| `gross_margin` | DECIMAL | |
| `net_profit` | INT | |
| `net_margin` | DECIMAL | |
| `avg_order_value` | INT | |
| `avg_order_profit` | INT | |
| `customer_acquisition_cost` | INT | |
| `lifetime_value_estimate` | INT | |
| `updated_at` | TIMESTAMPTZ | |

#### `financial_insights`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK |
| `insight_type` | VARCHAR | profitability, pricing, cost, cashflow |
| `insight` | TEXT | |
| `pattern` | JSONB | |
| `impact_estimate` | JSONB | Potential savings/gains |
| `confidence` | DECIMAL | |
| `recommendation` | JSONB | |
| `is_active` | BOOLEAN | |
| `created_at` | TIMESTAMPTZ | |

### AI Read Pattern

```sql
-- Get profitability insights
SELECT * FROM financial_insights
WHERE tenant_id = $1
  AND insight_type = 'profitability'
  AND confidence >= 0.7
ORDER BY (impact_estimate->>'monthly_impact')::int DESC;

-- Get margin trends
SELECT * FROM financial_profiles
WHERE tenant_id = $1
  AND period = 'monthly'
ORDER BY period_start DESC LIMIT 12;
```

---

## Layer 9: Insight & Meta-Learning Memory

### Purpose

Cross-tenant anonymized patterns, system-wide learnings, and meta-insights about what works across the platform.

### Tables

#### `meta_patterns`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `pattern_type` | VARCHAR | industry, region, season, universal |
| `pattern_name` | VARCHAR | |
| `description` | TEXT | |
| `pattern_data` | JSONB | |
| `applies_to` | JSONB | Conditions for applicability |
| `success_rate` | DECIMAL | |
| `sample_size` | INT | Number of tenants |
| `confidence` | DECIMAL | |
| `is_active` | BOOLEAN | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Note:** This table has NO tenant_id - it's system-wide.

#### `tenant_pattern_applications`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK |
| `pattern_id` | UUID | FK to meta_patterns |
| `applied_at` | TIMESTAMPTZ | |
| `outcome` | VARCHAR | success, partial, failure |
| `outcome_data` | JSONB | |
| `feedback` | TEXT | |
| `evaluated_at` | TIMESTAMPTZ | |

#### `system_learnings`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `learning_type` | VARCHAR | model_performance, feature_effectiveness |
| `learning` | TEXT | |
| `data` | JSONB | |
| `created_at` | TIMESTAMPTZ | |

### AI Read Pattern

```sql
-- Get applicable meta-patterns for tenant
SELECT mp.* FROM meta_patterns mp
WHERE mp.is_active = true
  AND mp.confidence >= 0.7
  AND (
    mp.applies_to->>'industry' = $industry
    OR mp.applies_to->>'region' = $region
    OR mp.pattern_type = 'universal'
  )
ORDER BY mp.success_rate DESC;
```

### Privacy Safeguards

1. **No tenant data in meta_patterns** - Only aggregated patterns
2. **Minimum sample size** - Patterns require 10+ tenants
3. **Opt-out available** - Tenants can exclude from meta-learning

---

## Cross-Layer Integration

### Event Flow

```
User Action
    │
    ▼
┌─────────────────┐
│  Raw Event      │ ← Immutable, timestamped
│  (Layer 0)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Profile Update │ ← Aggregated state
│  (Per Layer)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Insight Check  │ ← Does this confirm/contradict?
│  (Per Layer)    │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
Confirm    Contradict
    │         │
    ▼         ▼
Increase   Decrease
Confidence Confidence
    │         │
    └────┬────┘
         │
         ▼
┌─────────────────┐
│  New Pattern?   │ ← Generate hypothesis
│  Detection      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Meta-Learning  │ ← Cross-tenant patterns
│  (Layer 9)      │
└─────────────────┘
```

### AI Context Building

When AI needs to respond, it builds context from multiple layers:

```sql
-- Build AI context for tenant
WITH tenant_context AS (
  SELECT 
    td.* AS dna,
    (SELECT json_agg(sg.*) FROM strategy_goals sg 
     WHERE sg.tenant_id = $1 AND sg.status = 'active') AS goals,
    (SELECT json_agg(ci.*) FROM campaign_insights ci 
     WHERE ci.tenant_id = $1 AND ci.is_active LIMIT 5) AS campaign_insights,
    (SELECT json_agg(pi.*) FROM product_insights pi 
     WHERE pi.tenant_id = $1 AND pi.is_active LIMIT 5) AS product_insights,
    (SELECT json_agg(fi.*) FROM financial_insights fi 
     WHERE fi.tenant_id = $1 AND fi.is_active LIMIT 3) AS financial_insights
  FROM tenant_dna td
  WHERE td.tenant_id = $1
)
SELECT * FROM tenant_context;
```

---

## RLS Policy Template

All tables with `tenant_id` use this pattern:

```sql
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON {table_name}
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);
```

---

## Summary Table

| Layer | Primary Table | Profile Table | Insight Table | Event Table |
|-------|---------------|---------------|---------------|-------------|
| 1. Tenant DNA | tenant_dna | tenant_dna_history | tenant_dna_suggestions | - |
| 2. Strategy | strategy_goals | strategy_decisions | strategy_frameworks | - |
| 3. Campaign | campaigns | campaign_profiles | campaign_insights | campaign_events |
| 4. Product | products | product_profiles | product_insights | product_events |
| 5. Logistics | shipments | fulfillment_profiles | fulfillment_insights | fulfillment_events |
| 6. Customer | - | customer_segments | behavior_insights | customer_events |
| 7. Operations | - | operation_metrics | operation_insights | operation_events |
| 8. Financial | - | financial_profiles | financial_insights | financial_events |
| 9. Meta-Learning | meta_patterns | - | system_learnings | - |


---

## Layer 8B: Unit Economics / Computational Memory

### Purpose

This is the **financial truth layer**. It answers the critical question: **"Did we actually make or lose money, when, why, and how much?"**

Unlike Layer 8 (Financial Intelligence) which focuses on patterns and insights, this layer provides **exact calculations** with full audit trail.

### Core Principles

1. **Every penny tracked** - All money in and out is recorded as immutable events
2. **Full attribution** - Every cost is linked to orders, products, and campaigns
3. **Lifecycle tracking** - Profit changes through 5 stages of order lifecycle
4. **Evidence-based insights** - AI insights must cite specific transactions

### Tables Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        UNIT ECONOMICS MEMORY                                 │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │              FINANCIAL_TRANSACTIONS (Raw Events)                     │    │
│  │              Every financial event, immutable                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                    ┌───────────────┼───────────────┐                        │
│                    ▼               ▼               ▼                        │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐            │
│  │ COST_ALLOCATION  │ │ ORDER_PROFIT     │ │ COST_ALLOCATION  │            │
│  │ _RULES           │ │ _TIMELINE        │ │ _RESULTS         │            │
│  │ (How to split)   │ │ (5 stages)       │ │ (Applied splits) │            │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘            │
│                                    │                                         │
│                    ┌───────────────┼───────────────┐                        │
│                    ▼               ▼               ▼                        │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐            │
│  │ PRODUCT_PROFIT   │ │ CAMPAIGN_PROFIT  │ │ CHANNEL_PROFIT   │            │
│  │ _MEMORY          │ │ _MEMORY          │ │ _MEMORY          │            │
│  │ (Per product)    │ │ (Per campaign)   │ │ (Per channel)    │            │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘            │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │              TENANT_PROFIT_MEMORY (Aggregate)                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │              UNIT_ECONOMICS_INSIGHTS (AI Insights)                   │    │
│  │              With evidence linking to transactions                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1. Raw Financial Events

#### `financial_transactions`

Every financial transaction is recorded here. This is the **source of truth**.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK |
| `transaction_type` | VARCHAR | Type of transaction (see below) |
| `direction` | VARCHAR | 'inflow' or 'outflow' |
| `amount` | INT | Amount (always positive) |
| `currency` | VARCHAR | ISO 4217 |
| `amount_in_base_currency` | INT | Converted to tenant's base currency |
| `order_id` | UUID | Link to order |
| `product_id` | UUID | Link to product |
| `campaign_id` | UUID | Link to campaign |
| `lifecycle_stage` | VARCHAR | When in order lifecycle |
| `idempotency_key` | VARCHAR | Prevent duplicates |

**Transaction Types:**

| Category | Types |
|----------|-------|
| Revenue | `order_revenue`, `shipping_revenue` |
| Direct Costs | `product_cost`, `shipping_cost`, `packaging_cost`, `cod_fee`, `payment_gateway_fee` |
| Marketing | `ad_spend`, `influencer_fee`, `promotion_discount` |
| Operational | `storage_cost`, `labor_cost`, `return_processing_cost`, `customer_service_cost` |
| Adjustments | `refund`, `chargeback`, `write_off`, `adjustment` |

### 2. Cost Allocation

#### `cost_allocation_rules`

Defines how to split shared costs:

| Method | Description |
|--------|-------------|
| `per_order` | Divide equally by number of orders |
| `per_unit` | Divide by number of units sold |
| `revenue_weighted` | Proportional to revenue |
| `margin_weighted` | Proportional to margin |
| `equal_split` | Equal across all entities |
| `custom_formula` | Custom JSONB formula |

#### `cost_allocations`

Stores the **results** of allocation, not just rules:

```sql
-- Example: $1000 ad spend allocated to 100 orders
INSERT INTO cost_allocations (
  source_transaction_id,  -- The $1000 ad spend
  target_type, 'order',
  target_id, 'order-uuid',
  allocated_amount, 10,  -- $10 per order
  allocation_percentage, 0.01
);
```

### 3. Order Profit Timeline

#### `order_profit_timeline`

Tracks profit at **5 lifecycle stages**:

| Stage | When | What Changes |
|-------|------|--------------|
| `post_sale` | Order confirmed | Initial revenue - COGS |
| `post_shipping` | Order shipped | + Shipping costs |
| `post_collection` | Payment received (COD) | + Payment fees, - Bad debt |
| `post_return_window` | 14-30 days after delivery | + Returns, refunds |
| `final` | All adjustments complete | Final true profit |

**Example Profit Journey:**

```
Order #12345 - $100 sale

post_sale:       Revenue $100, COGS $40 → Profit $60 (60%)
post_shipping:   + Shipping $15        → Profit $45 (45%)
post_collection: + COD fee $5          → Profit $40 (40%)
post_return:     (no return)           → Profit $40 (40%)
final:           + Allocated marketing → Profit $32 (32%)

Profit Erosion: $60 → $32 = $28 lost through lifecycle
```

### 4. Lifetime Profit Memory

#### `product_profit_memory`

Cumulative profit per product:

| Field | Description |
|-------|-------------|
| `units_sold` | Total units |
| `net_profit` | Total profit |
| `profit_per_unit` | Profit per unit |
| `profit_trend` | improving/stable/declining/volatile |
| `profit_volatility` | Standard deviation |
| `confidence` | Data completeness |

#### `campaign_profit_memory`

Cumulative profit per campaign:

| Field | Description |
|-------|-------------|
| `ad_spend` | Total spent |
| `net_profit` | Total profit |
| `roas` | Revenue / Ad Spend |
| `poas` | **Profit / Ad Spend** (more important!) |
| `breakeven_orders` | Orders needed to break even |
| `is_profitable` | Boolean |

#### `channel_profit_memory`

Cumulative profit per channel (Facebook, Google, WhatsApp, etc.):

| Field | Description |
|-------|-------------|
| `marketing_cost` | Total marketing spend |
| `net_profit` | Total profit |
| `cac` | Customer Acquisition Cost |
| `ltv_to_cac` | Lifetime Value / CAC ratio |

### 5. AI Integration

#### Reading Profit Journey

AI uses the `order_profit_journey` view:

```sql
SELECT * FROM order_profit_journey
WHERE tenant_id = $1
  AND order_date >= NOW() - INTERVAL '30 days'
ORDER BY profit_erosion DESC;
```

This shows:
- Current profit at each stage
- Profit erosion through lifecycle
- Latest stage reached

#### AI Context Function

```sql
SELECT get_unit_economics_context($tenant_id);
```

Returns:
```json
{
  "tenant_summary": {
    "net_profit": 50000,
    "net_margin": 0.32,
    "avg_order_profit": 45
  },
  "active_insights": [...],
  "top_profitable_products": [...],
  "channel_performance": [...]
}
```

#### Writing Insights

AI stores insights with **evidence**:

```sql
INSERT INTO unit_economics_insights (
  tenant_id,
  insight_type, 'profitability_alert',
  severity, 'warning',
  title, 'Product X margin dropped 15% this month',
  description, 'Shipping costs increased...',
  impact_amount, -5000,
  entity_type, 'product',
  entity_id, 'product-uuid',
  evidence, '[
    {
      "type": "transaction",
      "source_table": "financial_transactions",
      "source_ids": ["tx1", "tx2", "tx3"],
      "description": "15 shipping transactions averaging $12 vs $8 last month"
    }
  ]',
  confidence, 0.85,
  evidence_count, 15,
  recommendation, 'Consider negotiating with shipping provider or adjusting product price'
);
```

### 6. Mistake Prevention

The system prevents repeated mistakes by:

1. **Tracking insight outcomes:**
```sql
-- When insight is resolved
UPDATE unit_economics_insights
SET status = 'resolved',
    resolution_notes = 'Switched to cheaper shipping provider, margin restored'
WHERE id = $1;
```

2. **Learning from contradictions:**
```sql
-- If insight was wrong
UPDATE unit_economics_insights
SET contradiction_count = contradiction_count + 1,
    confidence = GREATEST(confidence - 0.1, 0.1)
WHERE id = $1;
```

3. **Checking before recommending:**
```sql
-- Before AI recommends price increase
SELECT * FROM unit_economics_insights
WHERE tenant_id = $1
  AND insight_type = 'pricing_opportunity'
  AND status = 'dismissed'
  AND entity_id = $product_id;
-- If found, AI knows this was tried and rejected
```

### Key Metrics Explained

| Metric | Formula | Why It Matters |
|--------|---------|----------------|
| **ROAS** | Revenue / Ad Spend | Traditional metric, but misleading |
| **POAS** | Profit / Ad Spend | **True efficiency** - includes all costs |
| **Profit Erosion** | Post-sale profit - Final profit | Shows where money leaks |
| **Confidence** | % of orders with full cost data | Data quality indicator |
| **Volatility** | Std dev of daily profit | Risk indicator |

### RLS Policy

All tables use standard tenant isolation:

```sql
CREATE POLICY "tenant_isolation" ON {table}
FOR ALL USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM tenant_users 
    WHERE user_id = auth.uid() 
      AND is_active = true
  )
);
```
