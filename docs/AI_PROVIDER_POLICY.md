# AI Provider Policy

This document establishes the official AI provider policy for DeepSolution. All AI-related development must follow these guidelines to ensure consistency, cost control, and maintainability.

## Official AI Provider

**OpenAI is the only authorized AI provider for DeepSolution.**

| Aspect | Policy |
|--------|--------|
| Provider | OpenAI only |
| Models | GPT-4o, GPT-4o-mini |
| Vision | GPT-4o with vision |
| Embeddings | text-embedding-3-small |
| Alternative Providers | Not permitted |

## Rationale

The decision to use OpenAI exclusively is based on several factors. First, OpenAI provides a single, well-documented API that simplifies development and maintenance. Second, the team has established expertise with OpenAI's models and their behavior. Third, billing and usage tracking are centralized in one dashboard. Finally, this approach prevents vendor fragmentation that could lead to inconsistent AI behavior across features.

## API Key Management

### Key Hierarchy

| Key Type | Purpose | Storage |
|----------|---------|---------|
| Production Key | Live application | Vercel env vars |
| Development Key | Local development | `.env.local` (gitignored) |
| Test Key | CI/CD testing | GitHub Secrets |

### Key Rotation Schedule

API keys should be rotated according to the following schedule:

| Frequency | Trigger |
|-----------|---------|
| Quarterly | Routine rotation |
| Immediately | After any security incident |
| Immediately | After team member departure |
| Immediately | After key exposure |

### Rotation Process

1. Generate new key in OpenAI Dashboard
2. Update Vercel environment variables
3. Trigger redeployment
4. Verify application functionality
5. Revoke old key in OpenAI Dashboard
6. Document rotation in security log

## Usage Guidelines

### Approved Use Cases

| Use Case | Model | Max Tokens |
|----------|-------|------------|
| Product Intelligence | GPT-4o | 4,096 |
| Content Writing | GPT-4o | 2,048 |
| Ad Copy Generation | GPT-4o-mini | 1,024 |
| Price Optimization | GPT-4o-mini | 512 |
| Image Analysis | GPT-4o (vision) | 1,024 |

### Prohibited Use Cases

The following uses of AI are explicitly prohibited within DeepSolution:

1. **Decision-making**: AI must analyze and provide data, not make business decisions
2. **Customer communication**: AI cannot send messages to customers without human review
3. **Financial transactions**: AI cannot authorize payments or transfers
4. **Data deletion**: AI cannot delete customer or business data

### Token Limits

To control costs and prevent runaway usage, the following limits are enforced:

| Scope | Daily Limit | Monthly Limit |
|-------|-------------|---------------|
| Per Tenant | 100,000 tokens | 2,000,000 tokens |
| Per Request | 8,000 tokens | N/A |
| Platform Total | 10,000,000 tokens | 200,000,000 tokens |

## Billing and Cost Control

### Cost Allocation

AI costs are tracked and allocated per tenant using the `ai_usage_logs` table:

```sql
SELECT 
  tenant_id,
  SUM(tokens_used) as total_tokens,
  SUM(cost_usd) as total_cost
FROM ai_usage_logs
WHERE created_at >= DATE_TRUNC('month', NOW())
GROUP BY tenant_id;
```

### Pricing Model

| Model | Input (per 1K tokens) | Output (per 1K tokens) |
|-------|----------------------|------------------------|
| GPT-4o | $0.005 | $0.015 |
| GPT-4o-mini | $0.00015 | $0.0006 |
| text-embedding-3-small | $0.00002 | N/A |

### Budget Alerts

Configure alerts in OpenAI Dashboard for:

| Alert Type | Threshold |
|------------|-----------|
| Daily spend | $100 |
| Monthly spend | $2,000 |
| Unusual activity | 200% of average |

## Implementation Standards

### LLM Helper Usage

All AI calls must use the centralized helper function:

```typescript
import { invokeLLM } from "./server/_core/llm";

const response = await invokeLLM({
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: userPrompt },
  ],
});
```

### Structured Outputs

For predictable responses, always use JSON schema:

```typescript
const response = await invokeLLM({
  messages: [...],
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "analysis_result",
      strict: true,
      schema: {
        type: "object",
        properties: {
          // Define expected structure
        },
        required: [...],
        additionalProperties: false,
      },
    },
  },
});
```

### Error Handling

All AI calls must implement proper error handling:

```typescript
try {
  const response = await invokeLLM({ messages });
  // Process response
} catch (error) {
  if (error.code === 'rate_limit_exceeded') {
    // Implement exponential backoff
  } else if (error.code === 'context_length_exceeded') {
    // Reduce input or use summarization
  } else {
    // Log error and notify
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
  }
}
```

## Audit and Logging

### Required Logging

Every AI call must log the following:

| Field | Description |
|-------|-------------|
| `tenant_id` | Tenant making the request |
| `user_id` | User who triggered the call |
| `model` | Model used |
| `tokens_input` | Input token count |
| `tokens_output` | Output token count |
| `cost_usd` | Calculated cost |
| `duration_ms` | Request duration |
| `feature` | Feature that made the call |

### Audit Trail

AI usage is tracked in the `ai_usage_logs` table:

```sql
CREATE TABLE ai_usage_logs (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID,
  feature VARCHAR(100) NOT NULL,
  model VARCHAR(50) NOT NULL,
  tokens_input INTEGER NOT NULL,
  tokens_output INTEGER NOT NULL,
  cost_usd DECIMAL(10, 6) NOT NULL,
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Compliance

### Data Privacy

When using AI, the following data privacy rules apply:

1. **No PII in prompts**: Never include customer personal information in AI prompts
2. **Data minimization**: Only include necessary context in prompts
3. **No data retention**: OpenAI API does not retain data (verify in settings)
4. **Regional compliance**: Ensure AI usage complies with GDPR/local regulations

### Content Policy

AI-generated content must be reviewed for:

| Check | Responsibility |
|-------|----------------|
| Accuracy | Human review before publishing |
| Brand alignment | Marketing team approval |
| Legal compliance | Legal review for claims |
| Cultural sensitivity | Regional team review |

## Prohibited Alternatives

The following AI providers are explicitly prohibited:

| Provider | Reason |
|----------|--------|
| Anthropic Claude | Vendor fragmentation |
| Google Gemini | Vendor fragmentation |
| AWS Bedrock | Vendor fragmentation |
| Local LLMs | Security and consistency concerns |
| Fine-tuned models | Maintenance overhead |

If a compelling use case for an alternative provider arises, it must be approved through the architecture review process and documented in this policy.

## Exception Process

To request an exception to this policy:

1. Document the use case and why OpenAI cannot meet the requirement
2. Submit to architecture review
3. If approved, document the exception in this file
4. Implement with clear isolation from main codebase

### Current Exceptions

None.

---

**IMPORTANT**: This policy is binding for all AI-related development. Violations should be reported to the architecture team for review.
