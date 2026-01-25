/**
 * AI Provider Types
 * Shared types for the AI Adapter layer
 */

// ==================== Message Types ====================

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

// ==================== Tool Types ====================

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice = ToolChoicePrimitive | ToolChoiceByName | ToolChoiceExplicit;

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

// ==================== Schema Types ====================

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

// ==================== Request/Response Types ====================

export interface GenerateTextParams {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: ResponseFormat;
  outputSchema?: OutputSchema;
}

export interface GenerateTextResult {
  id: string;
  created: number;
  model: string;
  provider: string;
  content: string;
  toolCalls?: ToolCall[];
  finishReason: string | null;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface GenerateJSONParams<T = unknown> {
  prompt: string;
  systemPrompt?: string;
  schema: JsonSchema;
  maxTokens?: number;
  temperature?: number;
}

export interface GenerateJSONResult<T = unknown> {
  id: string;
  model: string;
  provider: string;
  data: T;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ==================== Provider Configuration ====================

export type AIProviderType = "gemini" | "openai" | "forge";

export interface AIProviderConfig {
  provider: AIProviderType;
  apiKey: string;
  apiUrl?: string;
  defaultModel?: string;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

// ==================== Usage & Logging ====================

export interface AIUsageLog {
  id?: string;
  provider: string;
  model: string;
  tenantId?: string;
  userId?: string;
  featureKey: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  status: "pending" | "completed" | "failed" | "rate_limited" | "killed";
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// ==================== Rate Limiting ====================

export interface RateLimitConfig {
  maxRequestsPerHour: number;
  maxTokensPerHour: number;
  maxCostPerHour: number;
  maxTokensPerRun: number;
  maxCostPerRun: number;
}

export interface RateLimitStatus {
  allowed: boolean;
  reason?: string;
  remainingRequests?: number;
  remainingTokens?: number;
  resetAt?: Date;
}

// ==================== Provider Interface ====================

export interface AIProvider {
  readonly name: AIProviderType;
  readonly isConfigured: boolean;
  
  generateText(params: GenerateTextParams): Promise<GenerateTextResult>;
  generateJSON<T = unknown>(params: GenerateJSONParams<T>): Promise<GenerateJSONResult<T>>;
}
