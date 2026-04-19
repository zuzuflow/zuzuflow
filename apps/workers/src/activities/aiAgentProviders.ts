// =============================================================================
// Provider-specific tool-calling format/parse helpers for the AI Agent node
// =============================================================================

import type { LlmProvider, AiAgentToolDef } from "@workflow/shared";

// -----------------------------------------------------------------------------
// Generic tool-call representation used internally
// -----------------------------------------------------------------------------

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface Message {
  role: string;
  content: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // provider-specific extras (tool_calls, tool_call_id, etc.)
}

// -----------------------------------------------------------------------------
// Build the auto-generated JSON Schema per built-in tool kind
// -----------------------------------------------------------------------------

function schemaForTool(tool: AiAgentToolDef): Record<string, unknown> {
  switch (tool.kind) {
    case "http_request":
      return {
        type: "object",
        properties: {
          url: { type: "string", description: "The full URL to request" },
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "DELETE"],
            description: "HTTP method",
          },
          headers: {
            type: "object",
            description: "Optional HTTP headers",
            additionalProperties: { type: "string" },
          },
          body: {
            type: "string",
            description: "Optional request body (JSON string)",
          },
        },
        required: ["url", "method"],
      };
    case "js_code":
      return {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "JavaScript code to execute. Must return a value.",
          },
        },
        required: ["code"],
      };
    case "json_extract":
      return {
        type: "object",
        properties: {
          json: {
            type: "string",
            description: "The JSON string to extract data from",
          },
          path: {
            type: "string",
            description:
              "Dot-notation path to extract, e.g. 'data.items[0].name'",
          },
        },
        required: ["json", "path"],
      };
    default:
      return { type: "object", properties: {} };
  }
}

// =============================================================================
// Format tools for provider request payload
// =============================================================================

export function formatToolsForProvider(
  provider: LlmProvider,
  tools: AiAgentToolDef[],
): unknown {
  if (tools.length === 0) return undefined;

  if (provider === "anthropic") {
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: schemaForTool(t),
    }));
  }

  if (provider === "gemini") {
    return [
      {
        functionDeclarations: tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: schemaForTool(t),
        })),
      },
    ];
  }

  // OpenAI / Ollama — both use OpenAI-compatible format
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: schemaForTool(t),
    },
  }));
}

// =============================================================================
// Build initial messages (system + user) per provider
// =============================================================================

export function buildInitialMessages(
  provider: LlmProvider,
  systemPrompt: string | undefined,
  userPrompt: string,
): { messages: Message[]; systemField?: unknown } {
  if (provider === "anthropic") {
    // Anthropic uses a top-level `system` field, not a message
    return {
      messages: [{ role: "user", content: userPrompt }],
      systemField: systemPrompt || undefined,
    };
  }

  if (provider === "gemini") {
    // Gemini uses `contents` (built from messages) + `systemInstruction`
    return {
      messages: [{ role: "user", content: userPrompt }],
      systemField: systemPrompt
        ? { parts: [{ text: systemPrompt }] }
        : undefined,
    };
  }

  // OpenAI / Ollama / HuggingFace
  const msgs: Message[] = [];
  if (systemPrompt) msgs.push({ role: "system", content: systemPrompt });
  msgs.push({ role: "user", content: userPrompt });
  return { messages: msgs };
}

// =============================================================================
// Build full request body for a given provider
// =============================================================================

export function buildRequestBody(
  provider: LlmProvider,
  model: string,
  messages: Message[],
  tools: AiAgentToolDef[],
  opts: { maxTokens?: number; temperature?: number; systemField?: unknown },
): Record<string, unknown> {
  const formattedTools = formatToolsForProvider(provider, tools);

  if (provider === "anthropic") {
    return {
      model,
      max_tokens: opts.maxTokens ?? 1024,
      messages,
      ...(opts.systemField ? { system: opts.systemField } : {}),
      ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
      ...(formattedTools ? { tools: formattedTools } : {}),
    };
  }

  if (provider === "gemini") {
    return {
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : m.role,
        parts: m.parts ?? [{ text: m.content ?? "" }],
      })),
      ...(opts.systemField ? { systemInstruction: opts.systemField } : {}),
      ...(formattedTools ? { tools: formattedTools } : {}),
      ...(opts.maxTokens != null || opts.temperature != null
        ? {
            generationConfig: {
              ...(opts.maxTokens != null
                ? { maxOutputTokens: opts.maxTokens }
                : {}),
              ...(opts.temperature != null
                ? { temperature: opts.temperature }
                : {}),
            },
          }
        : {}),
    };
  }

  if (provider === "huggingface") {
    // HuggingFace doesn't support tool calling natively — inject into prompt
    return {
      inputs: messages[messages.length - 1]?.content ?? "",
      parameters: {
        ...(opts.maxTokens != null ? { max_new_tokens: opts.maxTokens } : {}),
        ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
      },
    };
  }

  // OpenAI / Ollama
  return {
    model,
    messages,
    ...(opts.maxTokens != null ? { max_tokens: opts.maxTokens } : {}),
    ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
    ...(formattedTools ? { tools: formattedTools } : {}),
  };
}

// =============================================================================
// Build request URL and headers
// =============================================================================

export function buildRequestConfig(
  provider: LlmProvider,
  model: string,
  apiUrl: string | undefined,
  apiKey: string,
): { url: string; headers: Record<string, string> } {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (provider === "ollama") {
    return { url: apiUrl ?? "http://localhost:11434/api/chat", headers };
  }

  if (provider === "anthropic") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    return { url: apiUrl ?? "https://api.anthropic.com/v1/messages", headers };
  }

  if (provider === "gemini") {
    return {
      url:
        apiUrl ??
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      headers,
    };
  }

  if (provider === "huggingface") {
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    return {
      url: apiUrl ?? `https://api-inference.huggingface.co/models/${model}`,
      headers,
    };
  }

  // OpenAI (default)
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  return {
    url: apiUrl ?? "https://api.openai.com/v1/chat/completions",
    headers,
  };
}

// =============================================================================
// Parse tool calls from provider response JSON
// =============================================================================

export function parseToolCalls(
  provider: LlmProvider,
  json: Record<string, unknown>,
): ToolCall[] {
  if (provider === "anthropic") {
    const content = json.content as
      | Array<{
          type: string;
          id?: string;
          name?: string;
          input?: Record<string, unknown>;
        }>
      | undefined;
    if (!content) return [];
    return content
      .filter((block) => block.type === "tool_use")
      .map((block) => ({
        id: block.id ?? "",
        name: block.name ?? "",
        args: block.input ?? {},
      }));
  }

  if (provider === "gemini") {
    const candidates = json.candidates as
      | Array<{
          content?: {
            parts?: Array<{
              functionCall?: { name: string; args: Record<string, unknown> };
            }>;
          };
        }>
      | undefined;
    const parts = candidates?.[0]?.content?.parts ?? [];
    return parts
      .filter((p) => p.functionCall)
      .map((p, i) => ({
        id: `gemini-tc-${i}`,
        name: p.functionCall!.name,
        args: p.functionCall!.args ?? {},
      }));
  }

  // OpenAI / Ollama
  const choices = json.choices as
    | Array<{
        message?: {
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
      }>
    | undefined;
  const toolCalls = choices?.[0]?.message?.tool_calls;
  if (!toolCalls || toolCalls.length === 0) return [];
  return toolCalls.map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    args: safeParse(tc.function.arguments),
  }));
}

// =============================================================================
// Parse text content from provider response
// =============================================================================

export function parseTextContent(
  provider: LlmProvider,
  json: Record<string, unknown>,
): string {
  if (provider === "anthropic") {
    const content = json.content as
      | Array<{ type: string; text?: string }>
      | undefined;
    return content?.find((b) => b.type === "text")?.text ?? "";
  }

  if (provider === "gemini") {
    const candidates = json.candidates as
      | Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>
      | undefined;
    return candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }

  if (provider === "huggingface") {
    const arr = Array.isArray(json) ? json : [json];
    return (arr[0] as { generated_text?: string })?.generated_text ?? "";
  }

  // OpenAI / Ollama
  const choices = json.choices as
    | Array<{ message?: { content?: string } }>
    | undefined;
  return choices?.[0]?.message?.content ?? "";
}

// =============================================================================
// Parse usage stats from provider response
// =============================================================================

export function parseUsage(
  provider: LlmProvider,
  json: Record<string, unknown>,
):
  | { promptTokens?: number; completionTokens?: number; totalTokens?: number }
  | undefined {
  if (provider === "anthropic") {
    const u = json.usage as
      | { input_tokens?: number; output_tokens?: number }
      | undefined;
    if (!u) return undefined;
    return {
      promptTokens: u.input_tokens,
      completionTokens: u.output_tokens,
      totalTokens: (u.input_tokens ?? 0) + (u.output_tokens ?? 0),
    };
  }

  if (provider === "gemini") {
    const u = json.usageMetadata as
      | {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        }
      | undefined;
    if (!u) return undefined;
    return {
      promptTokens: u.promptTokenCount,
      completionTokens: u.candidatesTokenCount,
      totalTokens: u.totalTokenCount,
    };
  }

  // OpenAI
  const u = json.usage as
    | {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      }
    | undefined;
  if (!u) return undefined;
  return {
    promptTokens: u.prompt_tokens,
    completionTokens: u.completion_tokens,
    totalTokens: u.total_tokens,
  };
}

// =============================================================================
// Append assistant message (with tool calls) to conversation
// =============================================================================

export function appendAssistantMessage(
  provider: LlmProvider,
  messages: Message[],
  json: Record<string, unknown>,
): void {
  if (provider === "anthropic") {
    // Anthropic: assistant message is the full content array
    messages.push({
      role: "assistant",
      content: json.content as string | null,
    });
  } else if (provider === "gemini") {
    // Gemini: push the model's response as-is
    const candidates = json.candidates as
      | Array<{ content?: unknown }>
      | undefined;
    const modelContent = candidates?.[0]?.content;
    if (modelContent) {
      messages.push({
        role: "model",
        content: null,
        ...(modelContent as Record<string, unknown>),
      });
    }
  } else {
    // OpenAI / Ollama: push the assistant message including tool_calls
    const choices = json.choices as Array<{ message?: Message }> | undefined;
    const msg = choices?.[0]?.message;
    if (msg) messages.push(msg);
  }
}

// =============================================================================
// Append tool result to conversation
// =============================================================================

export function appendToolResult(
  provider: LlmProvider,
  messages: Message[],
  toolCall: ToolCall,
  result: string,
): void {
  if (provider === "anthropic") {
    messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: toolCall.id,
          content: result,
        },
      ] as unknown as string,
    });
  } else if (provider === "gemini") {
    messages.push({
      role: "function",
      content: null,
      parts: [
        { functionResponse: { name: toolCall.name, response: { result } } },
      ],
    });
  } else {
    // OpenAI / Ollama
    messages.push({
      role: "tool",
      content: result,
      tool_call_id: toolCall.id,
    });
  }
}

// =============================================================================
// Helpers
// =============================================================================

function safeParse(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { raw };
  }
}
