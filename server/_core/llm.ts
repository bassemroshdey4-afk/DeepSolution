/**
 * LLM Module - Legacy Compatibility Layer
 * 
 * This module maintains backward compatibility with existing code
 * while delegating all AI calls to the new AI Provider Adapter.
 * 
 * IMPORTANT: New code should import from "@/server/lib/ai" directly.
 * This file exists only for backward compatibility.
 */

import { generateText } from "../lib/ai/provider";
import type { Message as AIMessage, Tool as AITool, ToolChoice as AIToolChoice, JsonSchema as AIJsonSchema } from "../lib/ai/types";

// Re-export types for backward compatibility
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

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

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

/**
 * Invoke LLM - Legacy function
 * 
 * This function delegates to the new AI Provider Adapter.
 * It maintains the same interface for backward compatibility.
 */
export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const result = await generateText(
    {
      messages: params.messages as AIMessage[],
      tools: params.tools as AITool[],
      toolChoice: (params.toolChoice || params.tool_choice) as AIToolChoice,
      maxTokens: params.maxTokens || params.max_tokens,
      outputSchema: (params.outputSchema || params.output_schema) as AIJsonSchema,
      responseFormat: params.responseFormat || params.response_format,
    },
    {
      featureKey: "legacy_invokeLLM",
    }
  );
  
  // Convert to legacy format with proper typing
  const legacyResult: InvokeResult = {
    id: result.id,
    created: result.created,
    model: result.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant" as Role,
          content: result.content,
          tool_calls: result.toolCalls as ToolCall[],
        },
        finish_reason: result.finishReason,
      },
    ],
    usage: {
      prompt_tokens: result.usage.promptTokens,
      completion_tokens: result.usage.completionTokens,
      total_tokens: result.usage.totalTokens,
    },
  };
  
  return legacyResult;
}
