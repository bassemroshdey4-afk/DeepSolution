# AI System Architecture - DeepSolution

## Overview

All user-facing AI features use **OpenAI API**. Manus AI is reserved for heavy internal orchestration tasks only. This document defines the AI Router, memory system, cost controls, and localization handling.

---

## AI Responsibility Split

| AI Provider | Use Case | When |
|-------------|----------|------|
| **OpenAI API** | User-facing features | Landing page generation, AI assistant, content analysis |
| **Manus AI** | Internal orchestration | Complex multi-step workflows, system maintenance, batch operations |

This split ensures cost efficiency. OpenAI API is used for predictable, user-triggered operations. Manus is reserved for complex orchestration that requires reasoning across multiple systems.

---

## AI Router

### Purpose

The AI Router determines which OpenAI model to use based on task type, complexity, and cost constraints. Unlike simple keyword matching, it uses a **Router Prompt** to classify requests intelligently.

### Router Architecture

```
User Request
     │
     ▼
┌─────────────────┐
│  Router Prompt  │  ← GPT-4o-mini (fast, cheap)
│  Classification │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Model Selector │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
GPT-4o    GPT-4o-mini
(complex)  (simple)
```

### Router Prompt

The router uses a lightweight GPT-4o-mini call to classify requests before routing.

```
You are an AI request classifier. Analyze the user's request and classify it.

Request: {{user_message}}

Classify into ONE of these categories:
- SIMPLE_QA: Simple questions with direct answers (counts, statuses, lookups)
- COMPLEX_ANALYSIS: Analysis, comparisons, trends, recommendations
- CONTENT_GENERATION: Creating landing pages, marketing content
- IMAGE_ANALYSIS: Analyzing product images

Respond with ONLY the category name, nothing else.
```

**Router call parameters:**
- Model: `gpt-4o-mini`
- Max tokens: 10
- Temperature: 0
- Timeout: 2 seconds

### Model Selection Table

| Category | Model | Max Tokens | Temperature | Est. Cost |
|----------|-------|------------|-------------|-----------|
| SIMPLE_QA | gpt-4o-mini | 500 | 0.3 | $0.0003 |
| COMPLEX_ANALYSIS | gpt-4o | 1500 | 0.5 | $0.02 |
| CONTENT_GENERATION | gpt-4o | 2000 | 0.8 | $0.03 |
| IMAGE_ANALYSIS | gpt-4o (vision) | 1000 | 0.3 | $0.04 |

### Fallback Logic

If router classification fails (timeout, error), default to:
- Short messages (<50 chars): SIMPLE_QA
- Long messages (>200 chars): COMPLEX_ANALYSIS
- Contains image URL: IMAGE_ANALYSIS

---

## Token Budgets

### Per-Request Limits

| Request Type | Max Input Tokens | Max Output Tokens | Hard Limit |
|--------------|------------------|-------------------|------------|
| Router classification | 200 | 10 | Strict |
| Simple Q&A | 2000 | 500 | Strict |
| Complex analysis | 4000 | 1500 | Strict |
| Landing page generation | 3000 | 2000 | Strict |
| Image analysis | 2000 | 1000 | Strict |
| Conversation summary | 4000 | 500 | Strict |

### Context Window Management

When conversation history exceeds token budget:

```
1. Count tokens in messages array
2. If total > 3000 tokens:
   a. Keep system prompt (always)
   b. Keep last 5 messages (always)
   c. Summarize older messages
   d. Replace old messages with summary
3. Proceed with request
```

### Token Counting

Use `tiktoken` library with `cl100k_base` encoding for accurate counts before API calls.

---

## Caching Strategy

### Response Cache

Cache identical requests to reduce API calls.

| Cache Key | TTL | Use Case |
|-----------|-----|----------|
| `lp:{product_id}:{hash(prompt)}` | 24h | Landing page regeneration |
| `ctx:{tenant_id}` | 1h | Tenant context snapshot |
| `router:{hash(message)}` | 1h | Router classification |

### Cache Implementation

```
Cache storage: Redis or Supabase Edge Function KV

Before API call:
1. Generate cache key
2. Check cache
3. If hit: return cached response
4. If miss: proceed with API call, cache result

Skip cache if:
- Custom instructions provided
- Force refresh requested
- Request contains real-time data needs
```

### Context Cache

Tenant business context is expensive to query. Cache it.

```sql
-- Context query (run once per hour per tenant)
SELECT json_build_object(
  'tenant_name', t.name,
  'currency', t.currency,
  'language', t.language,
  'products_count', (SELECT COUNT(*) FROM products WHERE tenant_id = t.id AND status = 'active'),
  'orders_today', (SELECT COUNT(*) FROM orders WHERE tenant_id = t.id AND created_at >= CURRENT_DATE),
  'orders_month', (SELECT COUNT(*) FROM orders WHERE tenant_id = t.id AND created_at >= DATE_TRUNC('month', CURRENT_DATE)),
  'revenue_today', (SELECT COALESCE(SUM(total), 0) FROM orders WHERE tenant_id = t.id AND created_at >= CURRENT_DATE AND status NOT IN ('cancelled', 'returned')),
  'revenue_month', (SELECT COALESCE(SUM(total), 0) FROM orders WHERE tenant_id = t.id AND created_at >= DATE_TRUNC('month', CURRENT_DATE) AND status NOT IN ('cancelled', 'returned')),
  'low_stock_count', (SELECT COUNT(*) FROM products WHERE tenant_id = t.id AND stock_quantity <= low_stock_threshold AND stock_quantity > 0),
  'pending_calls', (SELECT COUNT(*) FROM orders WHERE tenant_id = t.id AND call_status = 'pending')
) as context
FROM tenants t
WHERE t.id = $1;
```

---

## Rate Limiting

### Per-Tenant Limits

| Plan | Landing Pages/Month | Assistant Messages/Day | Tokens/Month |
|------|---------------------|------------------------|--------------|
| Free | 5 | 20 | 50,000 |
| Basic | 30 | 100 | 300,000 |
| Pro | 150 | 500 | 1,500,000 |
| Enterprise | Custom | Custom | Custom |

### Rate Limit Enforcement

```
Before each AI request:
1. Get tenant subscription from cache/DB
2. Check current usage vs limits
3. If exceeded:
   - Return error with upgrade prompt
   - Log rate limit event
4. If within limits:
   - Proceed with request
   - Increment usage counter (async)
```

### Rate Limit Response

```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "لقد وصلت للحد الأقصى من الرسائل اليومية",
  "limit": 20,
  "used": 20,
  "reset_at": "2025-12-16T00:00:00Z",
  "upgrade_url": "/settings/billing"
}
```

---

## Localization

### Language-Aware AI

All AI outputs respect tenant's `language` setting.

| Tenant Language | System Prompt Language | Output Language |
|-----------------|------------------------|-----------------|
| ar | Arabic | Arabic |
| en | English | English |
| fr | French | French |

### System Prompt Template (Arabic)

```
أنت مساعد ذكي لمتجر "{{tenant_name}}" للتجارة الإلكترونية.

العملة: {{currency}}
المنطقة الزمنية: {{timezone}}

معلومات المتجر الحالية:
{{context_json}}

قواعد:
- أجب بالعربية الفصحى دائماً
- استخدم الأرقام العربية أو الهندية حسب السياق
- اعرض الأسعار بالعملة: {{currency}}
- كن مختصراً ومفيداً
- لا تخترع بيانات غير موجودة
```

### System Prompt Template (English)

```
You are an AI assistant for "{{tenant_name}}" e-commerce store.

Currency: {{currency}}
Timezone: {{timezone}}

Current store information:
{{context_json}}

Rules:
- Always respond in English
- Display prices in {{currency}}
- Be concise and helpful
- Do not invent data that doesn't exist
```

### Currency Formatting

```javascript
function formatCurrency(amount, currency, language) {
  // amount is in smallest unit (e.g., halalas)
  const value = amount / 100;
  
  return new Intl.NumberFormat(language, {
    style: 'currency',
    currency: currency
  }).format(value);
}

// Examples:
// formatCurrency(15000, 'SAR', 'ar') → "١٥٠٫٠٠ ر.س."
// formatCurrency(15000, 'SAR', 'en') → "SAR 150.00"
// formatCurrency(15000, 'USD', 'en') → "$150.00"
```

---

## Memory System

### Three-Level Memory Architecture

```
┌─────────────────────────────────────────┐
│           Level 3: Long-term            │
│     Conversation summaries (TEXT)       │
│     Stored in: ai_conversations.summary │
│     Lifespan: Permanent                 │
└─────────────────────────────────────────┘
                    ▲
┌─────────────────────────────────────────┐
│           Level 2: Context              │
│     Tenant business snapshot (JSONB)    │
│     Stored in: ai_conversations.context │
│     Refresh: Every 1 hour               │
└─────────────────────────────────────────┘
                    ▲
┌─────────────────────────────────────────┐
│           Level 1: Session              │
│     Last N messages (JSONB array)       │
│     Stored in: ai_conversations.messages│
│     Limit: 10 messages or 3000 tokens   │
└─────────────────────────────────────────┘
```

### Session Memory

```json
{
  "messages": [
    {
      "id": "msg_001",
      "role": "user",
      "content": "كم عدد الطلبات اليوم؟",
      "timestamp": "2025-12-15T10:30:00Z",
      "tokens": 15
    },
    {
      "id": "msg_002",
      "role": "assistant",
      "content": "لديك 15 طلب جديد اليوم، منها 8 مؤكدة و7 في انتظار الاتصال.",
      "timestamp": "2025-12-15T10:30:05Z",
      "tokens": 35,
      "model": "gpt-4o-mini"
    }
  ]
}
```

### Context Memory

```json
{
  "snapshot_at": "2025-12-15T10:00:00Z",
  "tenant": {
    "name": "متجر أحمد",
    "currency": "SAR",
    "language": "ar"
  },
  "metrics": {
    "products_active": 45,
    "products_low_stock": 5,
    "orders_today": 15,
    "orders_pending_call": 8,
    "revenue_today": 3500,
    "revenue_month": 72000
  },
  "top_products": [
    {"name": "منتج أ", "orders": 45},
    {"name": "منتج ب", "orders": 32}
  ]
}
```

### Summarization Trigger

When conversation exceeds 50 messages or 10,000 tokens:

```
1. Extract messages 1 to N-10
2. Send to GPT-4o-mini with summarization prompt
3. Store summary in ai_conversations.summary
4. Keep only last 10 messages
5. On next request, include summary in context
```

**Summarization Prompt:**

```
لخص هذه المحادثة بالعربية. اذكر:
- المواضيع الرئيسية التي نوقشت
- القرارات المتخذة
- البيانات المهمة المذكورة

اجعل الملخص أقل من 300 كلمة.
```

---

## Landing Page Generator

### Input

```typescript
interface LandingPageRequest {
  product_id: string;
  image_url?: string;
  custom_instructions?: string;
  language?: string;  // Override tenant language
}
```

### Generation Flow

```
1. Validate request
   ├── Check product exists
   ├── Check product belongs to tenant
   └── Check usage limits

2. Fetch context
   ├── Product data
   ├── Tenant settings (currency, language)
   └── Existing landing pages (avoid duplication)

3. Build prompt
   ├── Include product details
   ├── Include tenant branding
   └── Include custom instructions

4. If image_url provided:
   ├── Call GPT-4o Vision
   ├── Extract visual features
   └── Add to prompt

5. Generate content
   ├── Call GPT-4o
   ├── Parse JSON response
   └── Validate structure

6. Save to database
   ├── Generate unique slug
   ├── Store content
   └── Track token usage

7. Update usage counters
   └── Increment ai_landing_pages_used

8. Return landing page
```

### Generation Prompt (Arabic)

```
أنت خبير في كتابة المحتوى التسويقي بالعربية. أنشئ صفحة هبوط احترافية.

معلومات المنتج:
- الاسم: {{product.name}}
- الوصف: {{product.description}}
- السعر: {{formatted_price}}
- الفئة: {{product.category}}

{{#if image_analysis}}
تحليل الصورة:
{{image_analysis}}
{{/if}}

{{#if custom_instructions}}
تعليمات إضافية:
{{custom_instructions}}
{{/if}}

أنشئ المحتوى بتنسيق JSON التالي:

{
  "headline": "عنوان رئيسي جذاب (أقل من 10 كلمات)",
  "subheadline": "عنوان فرعي يوضح القيمة (أقل من 20 كلمة)",
  "description": "وصف مقنع يركز على الفوائد (50-100 كلمة)",
  "benefits": ["فائدة 1", "فائدة 2", "فائدة 3", "فائدة 4"],
  "cta_text": "نص زر الإجراء (2-4 كلمات)",
  "meta_title": "عنوان SEO (أقل من 60 حرف)",
  "meta_description": "وصف SEO (أقل من 160 حرف)"
}

قواعد:
- استخدم لغة عربية فصيحة وسليمة
- ركز على الفوائد لا الميزات
- استخدم أسلوب مقنع يدفع للشراء
- تجنب المبالغة والوعود الكاذبة
- أعد JSON فقط بدون أي نص إضافي
```

---

## AI Assistant

### Request Flow

```
1. Receive message
   └── {conversation_id?, message, tenant_id, user_id}

2. Load or create conversation
   ├── If conversation_id: load existing
   └── If not: create new conversation

3. Check rate limits
   └── If exceeded: return error

4. Load context
   ├── Check cache for tenant context
   ├── If stale (>1h): refresh from DB
   └── Include in system prompt

5. Classify request (Router)
   ├── Call GPT-4o-mini with router prompt
   └── Get category: SIMPLE_QA | COMPLEX_ANALYSIS | etc.

6. Select model based on category

7. Build messages array
   ├── System prompt (with context)
   ├── Summary (if exists)
   ├── Recent messages (last 10)
   └── New user message

8. Call OpenAI API
   ├── Model: selected model
   ├── Max tokens: per category limit
   └── Temperature: per category setting

9. Process response
   ├── Parse content
   ├── Calculate tokens used
   └── Format for display

10. Save to database
    ├── Append message to conversation
    ├── Update token counts
    └── Update last_message_at

11. Update usage counters (async)
    └── Increment ai_assistant_messages_used

12. Check summarization needed
    └── If messages > 50: queue summarization

13. Return response
```

### Data Access

When assistant needs specific data, it can request queries. The system executes pre-approved queries only.

| Intent Pattern | Query | Parameters |
|----------------|-------|------------|
| "orders today" | `SELECT COUNT(*) FROM orders WHERE tenant_id = $1 AND created_at >= CURRENT_DATE` | tenant_id |
| "revenue this month" | `SELECT SUM(total) FROM orders WHERE tenant_id = $1 AND created_at >= DATE_TRUNC('month', CURRENT_DATE) AND status NOT IN ('cancelled', 'returned')` | tenant_id |
| "low stock products" | `SELECT name, stock_quantity FROM products WHERE tenant_id = $1 AND stock_quantity <= low_stock_threshold ORDER BY stock_quantity LIMIT 10` | tenant_id |
| "top selling products" | `SELECT p.name, COUNT(oi.id) as orders FROM products p JOIN order_items oi ON oi.product_id = p.id JOIN orders o ON o.id = oi.order_id WHERE p.tenant_id = $1 AND o.created_at >= CURRENT_DATE - INTERVAL '30 days' GROUP BY p.id ORDER BY orders DESC LIMIT 5` | tenant_id |

---

## Cost Control

### Cost Tracking

Every AI request logs:

```sql
INSERT INTO ai_usage_logs (
  tenant_id,
  user_id,
  request_type,
  model,
  prompt_tokens,
  completion_tokens,
  estimated_cost_cents,
  cached,
  created_at
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW());
```

### Cost Estimation

```javascript
const PRICING = {
  'gpt-4o': {
    input: 2.50 / 1_000_000,   // $2.50 per 1M input tokens
    output: 10.00 / 1_000_000  // $10.00 per 1M output tokens
  },
  'gpt-4o-mini': {
    input: 0.15 / 1_000_000,   // $0.15 per 1M input tokens
    output: 0.60 / 1_000_000   // $0.60 per 1M output tokens
  }
};

function estimateCost(model, promptTokens, completionTokens) {
  const pricing = PRICING[model];
  const inputCost = promptTokens * pricing.input;
  const outputCost = completionTokens * pricing.output;
  return Math.ceil((inputCost + outputCost) * 100); // cents
}
```

### Monthly Cost Alerts

| Threshold | Action |
|-----------|--------|
| 50% of budget | Log warning |
| 80% of budget | Email owner |
| 100% of budget | Block requests, email owner |

---

## Error Handling

### OpenAI API Errors

| Error | HTTP Code | Action |
|-------|-----------|--------|
| Rate limit | 429 | Retry with exponential backoff (1s, 2s, 4s, max 3 retries) |
| Server error | 500-503 | Retry once after 2s |
| Context too long | 400 | Truncate context, retry |
| Invalid request | 400 | Log error, return user-friendly message |
| Auth error | 401 | Alert immediately, do not retry |

### Retry Logic

```javascript
async function callOpenAI(request, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await openai.chat.completions.create(request);
    } catch (error) {
      if (error.status === 429 && attempt < maxRetries) {
        await sleep(Math.pow(2, attempt) * 1000);
        continue;
      }
      if (error.status >= 500 && attempt < maxRetries) {
        await sleep(2000);
        continue;
      }
      throw error;
    }
  }
}
```

### User-Facing Error Messages

| Error Type | Arabic Message |
|------------|----------------|
| Rate limit | "الرجاء الانتظار قليلاً قبل إرسال رسالة أخرى" |
| Usage exceeded | "لقد وصلت للحد الأقصى من الاستخدام الشهري" |
| Server error | "حدث خطأ مؤقت، يرجى المحاولة مرة أخرى" |
| Content filter | "لا يمكن معالجة هذا الطلب" |

---

## Monitoring

### Metrics to Track

| Metric | Type | Alert Threshold |
|--------|------|-----------------|
| ai_requests_total | Counter | - |
| ai_requests_by_model | Counter | - |
| ai_tokens_total | Counter | - |
| ai_cost_total_cents | Counter | - |
| ai_latency_seconds | Histogram | p99 > 10s |
| ai_errors_total | Counter | rate > 5% |
| ai_cache_hit_ratio | Gauge | < 30% |

### Logging

Every AI request logs:

```json
{
  "timestamp": "2025-12-15T10:30:00Z",
  "tenant_id": "uuid",
  "user_id": "uuid",
  "request_type": "assistant",
  "category": "SIMPLE_QA",
  "model": "gpt-4o-mini",
  "prompt_tokens": 150,
  "completion_tokens": 45,
  "latency_ms": 850,
  "cached": false,
  "error": null
}
```

---

## Security

### Data Isolation

AI requests MUST only access data belonging to the authenticated tenant. All database queries include `tenant_id` filter.

### Content Filtering

OpenAI's content moderation is enabled. Additionally:
- No PII in logs (phone numbers, emails masked)
- No sensitive business data in cached responses
- Conversation history encrypted at rest

### API Key Security

- OpenAI API key stored in environment variables
- Never exposed to client
- Rotated quarterly
- Usage monitored for anomalies
