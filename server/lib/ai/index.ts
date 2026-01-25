/**
 * AI Provider Module
 * 
 * This module provides a unified interface for AI operations.
 * All AI calls in the application should go through this module.
 * 
 * Usage:
 * ```typescript
 * import { generateText, generateJSON, invokeLLM, isAIAvailable } from "@/server/lib/ai";
 * 
 * // New API
 * const result = await generateText({
 *   messages: [{ role: "user", content: "Hello" }],
 * }, {
 *   featureKey: "my_feature",
 *   tenantId: "...",
 * });
 * 
 * // Legacy API (backward compatible)
 * const legacyResult = await invokeLLM({
 *   messages: [{ role: "user", content: "Hello" }],
 * });
 * ```
 */

// Main API
export {
  generateText,
  generateJSON,
  invokeLLM,
  isAIAvailable,
  getAIStatus,
  disableAI,
  enableAI,
  getUsageLogs,
} from "./provider";

// Types
export type {
  Message,
  GenerateTextParams,
  GenerateTextResult,
  GenerateJSONParams,
  GenerateJSONResult,
  AIUsageLog,
  JsonSchema,
  Role,
  TextContent,
  ImageContent,
  FileContent,
  MessageContent,
  Tool,
  ToolChoice,
  ToolCall,
  ResponseFormat,
  AIProviderType,
  RateLimitStatus,
} from "./types";

// Configuration
export {
  AI_ENV,
  MODEL_PRICING,
  RATE_LIMITS,
  calculateCost,
  isProviderConfigured,
  validateConfig,
} from "./config";
