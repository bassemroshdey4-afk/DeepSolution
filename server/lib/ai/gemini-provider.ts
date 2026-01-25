/**
 * Gemini AI Provider
 * Implementation of the AI Provider interface for Google Gemini
 */

import type {
  AIProvider,
  GenerateTextParams,
  GenerateTextResult,
  GenerateJSONParams,
  GenerateJSONResult,
  Message,
  MessageContent,
  TextContent,
  ImageContent,
  FileContent,
  Tool,
  ToolChoice,
  ToolChoiceExplicit,
  ResponseFormat,
  JsonSchema,
} from "./types";
import { getProviderConfig, AI_ENV } from "./config";

// ==================== Helper Functions ====================

const ensureArray = (value: MessageContent | MessageContent[]): MessageContent[] =>
  Array.isArray(value) ? value : [value];

const normalizeContentPart = (part: MessageContent): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  return part;
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map((part) => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return { role, name, tool_call_id, content };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return { role, name, content: contentParts[0].text };
  }

  return { role, name, content: contentParts };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error("tool_choice 'required' was provided but no tools were configured");
    }
    if (tools.length > 1) {
      throw new Error("tool_choice 'required' needs a single tool or specify the tool name explicitly");
    }
    return { type: "function", function: { name: tools[0].function.name } };
  }

  if ("name" in toolChoice) {
    return { type: "function", function: { name: toolChoice.name } };
  }

  return toolChoice;
};

const normalizeResponseFormat = (
  responseFormat?: ResponseFormat,
  outputSchema?: JsonSchema
): ResponseFormat | undefined => {
  if (responseFormat) {
    if (responseFormat.type === "json_schema" && !responseFormat.json_schema?.schema) {
      throw new Error("responseFormat json_schema requires a defined schema object");
    }
    return responseFormat;
  }

  if (outputSchema) {
    if (!outputSchema.name || !outputSchema.schema) {
      throw new Error("outputSchema requires both name and schema");
    }
    return {
      type: "json_schema",
      json_schema: {
        name: outputSchema.name,
        schema: outputSchema.schema,
        ...(typeof outputSchema.strict === "boolean" ? { strict: outputSchema.strict } : {}),
      },
    };
  }

  return undefined;
};

// ==================== Retry Logic ====================

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if error is retryable
      const isRetryable = 
        lastError.message.includes("429") || // Rate limit
        lastError.message.includes("503") || // Service unavailable
        lastError.message.includes("500") || // Server error
        lastError.message.includes("timeout");
      
      if (!isRetryable || attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff
      const waitTime = delayMs * Math.pow(2, attempt - 1);
      console.log(`[GeminiProvider] Retry ${attempt}/${maxRetries} after ${waitTime}ms: ${lastError.message}`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError || new Error("Unknown error in retry logic");
}

// ==================== Gemini Provider Class ====================

export class GeminiProvider implements AIProvider {
  readonly name = "gemini" as const;
  private config = getProviderConfig("gemini");
  
  get isConfigured(): boolean {
    return Boolean(this.config.apiKey && this.config.apiKey.length > 0);
  }
  
  private getApiUrl(): string {
    const baseUrl = this.config.apiUrl || "https://forge.manus.im";
    return `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`;
  }
  
  async generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
    if (!this.isConfigured) {
      throw new Error("Gemini API key is not configured");
    }
    
    const startTime = Date.now();
    const model = this.config.defaultModel || "gemini-2.0-flash";
    
    // Build request payload
    const payload: Record<string, unknown> = {
      model,
      messages: params.messages.map(normalizeMessage),
    };
    
    // Add tools if provided
    if (params.tools && params.tools.length > 0) {
      payload.tools = params.tools;
    }
    
    // Add tool choice
    const normalizedToolChoice = normalizeToolChoice(params.toolChoice, params.tools);
    if (normalizedToolChoice) {
      payload.tool_choice = normalizedToolChoice;
    }
    
    // Add max tokens
    payload.max_tokens = params.maxTokens || 32768;
    
    // Add temperature
    if (params.temperature !== undefined) {
      payload.temperature = params.temperature;
    }
    
    // Add response format
    const normalizedResponseFormat = normalizeResponseFormat(
      params.responseFormat,
      params.outputSchema
    );
    if (normalizedResponseFormat) {
      payload.response_format = normalizedResponseFormat;
    }
    
    // Add thinking budget for Gemini 2.5
    if (model.includes("2.5") || model.includes("2.0")) {
      payload.thinking = { budget_tokens: 128 };
    }
    
    // Make API call with retry
    const response = await withRetry(
      async () => {
        const res = await fetch(this.getApiUrl(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify(payload),
        });
        
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Gemini API error: ${res.status} ${res.statusText} – ${errorText}`);
        }
        
        return res.json();
      },
      this.config.maxRetries,
      this.config.retryDelayMs
    );
    
    const latencyMs = Date.now() - startTime;
    
    // Parse response
    const choice = response.choices?.[0];
    const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    
    return {
      id: response.id || `gemini-${Date.now()}`,
      created: response.created || Math.floor(Date.now() / 1000),
      model: response.model || model,
      provider: "gemini",
      content: typeof choice?.message?.content === "string" 
        ? choice.message.content 
        : JSON.stringify(choice?.message?.content || ""),
      toolCalls: choice?.message?.tool_calls,
      finishReason: choice?.finish_reason || null,
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
    };
  }
  
  async generateJSON<T = unknown>(params: GenerateJSONParams<T>): Promise<GenerateJSONResult<T>> {
    const messages: Message[] = [];
    
    // Add system prompt if provided
    if (params.systemPrompt) {
      messages.push({ role: "system", content: params.systemPrompt });
    }
    
    // Add user prompt
    messages.push({ role: "user", content: params.prompt });
    
    // Generate with JSON schema
    const result = await this.generateText({
      messages,
      maxTokens: params.maxTokens,
      temperature: params.temperature,
      outputSchema: params.schema,
    });
    
    // Parse JSON response
    let data: T;
    try {
      data = JSON.parse(result.content) as T;
    } catch (error) {
      throw new Error(`Failed to parse JSON response: ${result.content}`);
    }
    
    return {
      id: result.id,
      model: result.model,
      provider: "gemini",
      data,
      usage: result.usage,
    };
  }
}

// ==================== Singleton Instance ====================

let geminiProviderInstance: GeminiProvider | null = null;

export function getGeminiProvider(): GeminiProvider {
  if (!geminiProviderInstance) {
    geminiProviderInstance = new GeminiProvider();
  }
  return geminiProviderInstance;
}
