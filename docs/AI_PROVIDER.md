# AI Provider Documentation

## Overview

Deep Solution uses a unified AI Provider Adapter layer that abstracts the underlying AI provider implementation. This allows the platform to switch between providers (Gemini, OpenAI, etc.) without changing business logic.

**Current Provider:** Google Gemini (gemini-2.0-flash)

**Feature Name:** Deep Intelligence

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Business Modules                          │
│  (aiPipeline, landingPage, marketing, contentWriter, etc.)  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   AI Provider Adapter                        │
│              server/lib/ai/provider.ts                       │
│  - generateText()                                            │
│  - generateJSON()                                            │
│  - invokeLLM() (legacy compatibility)                        │
│  - Rate limiting, logging, kill switch                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Gemini Provider                            │
│           server/lib/ai/gemini-provider.ts                   │
│  - API calls to Gemini/Forge                                 │
│  - Retry with exponential backoff                            │
│  - Response normalization                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Usage

### New API (Recommended)

```typescript
import { generateText, generateJSON } from "@/server/lib/ai";

// Text generation
const result = await generateText(
  {
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello!" },
    ],
    maxTokens: 1000,
  },
  {
    featureKey: "my_feature",
    tenantId: "tenant-123",
    userId: "user-456",
  }
);

console.log(result.content);
console.log(result.usage.totalTokens);

// JSON generation with schema
const jsonResult = await generateJSON<{ name: string; value: number }>(
  {
    prompt: "Generate a test object",
    schema: {
      name: "test_schema",
      schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          value: { type: "number" },
        },
        required: ["name", "value"],
      },
    },
  },
  {
    featureKey: "json_generation",
  }
);

console.log(jsonResult.data); // { name: "...", value: ... }
```

### Legacy API (Backward Compatible)

```typescript
import { invokeLLM } from "@/server/_core/llm";

const result = await invokeLLM({
  messages: [{ role: "user", content: "Hello" }],
  max_tokens: 1000,
});

console.log(result.choices[0].message.content);
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_PROVIDER` | Active provider (gemini/openai/forge) | `gemini` |
| `GEMINI_API_KEY` | Gemini API key | Uses `BUILT_IN_FORGE_API_KEY` |
| `GEMINI_API_URL` | Gemini API endpoint | Uses `BUILT_IN_FORGE_API_URL` |
| `AI_MODEL_TEXT` | Default text model | `gemini-2.0-flash` |
| `ENABLE_AI_CALLS` | Kill switch for all AI calls | `true` |
| `ENABLE_AI_LOGGING` | Enable usage logging | `true` |
| `AI_MAX_TOKENS_PER_RUN` | Max tokens per single run | `100000` |
| `AI_MAX_COST_PER_RUN` | Max cost per run (USD) | `5` |

---

## Model Pricing

Pricing is per 1 million tokens:

| Model | Input | Output | Notes |
|-------|-------|--------|-------|
| gemini-2.0-flash | $0.10 | $0.40 | **Default - Best value** |
| gemini-2.0-flash-lite | $0.075 | $0.30 | Ultra-low cost |
| gemini-1.5-flash | $0.075 | $0.30 | Fast, efficient |
| gemini-1.5-flash-8b | $0.0375 | $0.15 | Smallest model |
| gemini-1.5-pro | $1.25 | $5.00 | Highest quality |
| gemini-2.5-flash | $0.15 | $0.60 | Latest flash |
| gpt-4-turbo | $10.00 | $30.00 | Legacy reference |
| gpt-4o | $2.50 | $10.00 | Legacy reference |
| gpt-4o-mini | $0.15 | $0.60 | Legacy reference |

**Cost Savings:** Gemini 2.0 Flash is approximately **100x cheaper** than GPT-4 Turbo.

---

## Safety Guardrails

### Kill Switch

Disable all AI calls instantly:

```typescript
import { disableAI, enableAI, isAIAvailable } from "@/server/lib/ai";

// Check status
if (isAIAvailable()) {
  // AI is enabled and configured
}

// Emergency disable
disableAI();

// Re-enable
enableAI();
```

Or via environment variable:
```bash
ENABLE_AI_CALLS=false
```

### Rate Limiting

| Scope | Requests/Hour | Tokens/Hour | Cost/Hour |
|-------|---------------|-------------|-----------|
| Per User | 200 | 1,000,000 | $5 |
| Per Tenant | 1,000 | 5,000,000 | $25 |
| Global | 10,000 | 50,000,000 | $250 |
| Per Run | - | 100,000 | $2 |

### Usage Logging

Every AI call is logged with:
- Provider and model
- Tenant and user IDs
- Feature key
- Token usage (prompt, completion, total)
- Estimated cost
- Latency
- Status (completed, failed, rate_limited, killed)

Access logs:
```typescript
import { getUsageLogs } from "@/server/lib/ai";

const recentLogs = getUsageLogs(100);
```

---

## File Structure

```
server/lib/ai/
├── index.ts          # Main exports
├── provider.ts       # Adapter layer (main entry point)
├── gemini-provider.ts # Gemini implementation
├── config.ts         # Configuration and pricing
├── types.ts          # TypeScript types
└── provider.test.ts  # Unit tests

server/_core/
└── llm.ts            # Legacy compatibility layer
```

---

## Migration from OpenAI

### What Changed

1. **Provider:** OpenAI → Google Gemini
2. **Model:** gpt-4-turbo → gemini-2.0-flash
3. **Pricing:** ~100x cost reduction
4. **API:** Same interface, different backend

### What Stayed the Same

1. **Function signatures:** `invokeLLM()` works identically
2. **Message format:** Same system/user/assistant roles
3. **JSON Schema:** Same structured output support
4. **Tool calling:** Same function calling interface
5. **Business logic:** No changes required

### Removed Environment Variables

- `OPENAI_API_KEY` - No longer required (uses Forge)

### New Environment Variables

- `AI_PROVIDER` - Set to `gemini`
- `AI_MODEL_TEXT` - Default model selection

---

## Testing

Run AI provider tests:
```bash
pnpm vitest run server/lib/ai/provider.test.ts
```

Test coverage:
- ✅ generateText functionality
- ✅ generateJSON with schema
- ✅ Legacy invokeLLM compatibility
- ✅ Kill switch (enable/disable)
- ✅ Rate limiting
- ✅ Cost calculation
- ✅ Usage logging
- ✅ Provider selection

---

## Best Practices

1. **Always use context:** Pass `featureKey`, `tenantId`, `userId` for proper logging and rate limiting.

2. **Handle errors gracefully:** AI calls can fail; always wrap in try-catch.

3. **Use JSON schema for structured output:** Ensures consistent response format.

4. **Monitor costs:** Check usage logs regularly.

5. **Batch operations:** For bulk processing, use batch/scheduled jobs instead of real-time calls.

6. **Set appropriate maxTokens:** Don't request more tokens than needed.

---

## Troubleshooting

### AI calls returning errors

1. Check if AI is enabled: `isAIAvailable()`
2. Check rate limits in logs
3. Verify API key is configured

### High costs

1. Review usage logs by feature
2. Consider using smaller models (flash-lite, flash-8b)
3. Reduce maxTokens where possible

### Slow responses

1. Gemini Flash is optimized for speed
2. Check network latency
3. Consider reducing prompt size

---

## Support

For issues with the AI Provider layer, check:
1. This documentation
2. Unit tests in `provider.test.ts`
3. Usage logs for error details

---

*Last updated: January 2026*
*Provider: Google Gemini (gemini-2.0-flash)*
