// =============================================================================
// aiAgentActivity — agentic tool-calling loop for the AI Agent node
// =============================================================================

import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { AiAgentConfig } from "@workflow/shared";
import {
  buildInitialMessages,
  buildRequestBody,
  buildRequestConfig,
  parseToolCalls,
  parseTextContent,
  parseUsage,
  appendAssistantMessage,
  appendToolResult,
  type Message,
  type ToolCall,
} from "./aiAgentProviders";
import { executeTool } from "./aiAgentTools";

// =============================================================================
// Types
// =============================================================================

export interface AiAgentActivityInput {
  config: AiAgentConfig;
  context: Record<string, unknown>;
  resolvedApiKey?: string;
}

export interface AiAgentToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result: string;
}

export interface AiAgentActivityOutput {
  content: string;
  toolCalls: AiAgentToolCallRecord[];
  iterations: number;
  maxIterationsReached: boolean;
  model: string;
  provider: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

// =============================================================================
// Activity
// =============================================================================

export async function aiAgentActivity(
  input: AiAgentActivityInput,
): Promise<AiAgentActivityOutput> {
  const { config: cfg, context, resolvedApiKey } = input;

  const userPrompt = interpolateTemplate(cfg.prompt, context);
  const systemPrompt = cfg.systemPrompt
    ? interpolateTemplate(cfg.systemPrompt, context)
    : undefined;

  const apiKey = resolvedApiKey ?? "";
  const maxIterations = cfg.maxIterations ?? 10;
  const tools = cfg.tools ?? [];

  // For HuggingFace (no native tool support), inject tool descriptions into system prompt
  let effectiveSystemPrompt = systemPrompt;
  if (cfg.provider === "huggingface" && tools.length > 0) {
    const toolDesc = tools
      .map((t) => `- ${t.name}: ${t.description}`)
      .join("\n");
    effectiveSystemPrompt = `${systemPrompt ?? "You are a helpful assistant."}\n\nAvailable tools:\n${toolDesc}\n\nNote: Tool calling is not supported with this provider. Use the information above for context only.`;
  }

  const { messages: initialMessages, systemField } = buildInitialMessages(
    cfg.provider,
    effectiveSystemPrompt,
    userPrompt,
  );

  const { url: apiUrl, headers } = buildRequestConfig(
    cfg.provider,
    cfg.model,
    cfg.apiUrl,
    apiKey,
  );

  const messages: Message[] = [...initialMessages];
  const allToolCalls: AiAgentToolCallRecord[] = [];
  let lastTextContent = "";
  let lastUsage: AiAgentActivityOutput["usage"];
  let iterations = 0;

  // ---- Agentic loop ----
  for (iterations = 0; iterations < maxIterations; iterations++) {
    const body = buildRequestBody(cfg.provider, cfg.model, messages, tools, {
      maxTokens: cfg.maxTokens,
      temperature: cfg.temperature,
      systemField,
    });

    let res: Response;
    try {
      res = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw ApplicationFailure.create({
        message: `AI Agent network error: ${(err as Error).message}`,
        type: "AI_AGENT_NETWORK_ERROR",
        nonRetryable: false,
      });
    }

    if (!res.ok) {
      const errBody = await res.text();
      throw ApplicationFailure.create({
        message: `AI Agent API returned ${res.status}: ${errBody.slice(0, 500)}`,
        type: "AI_AGENT_API_ERROR",
        nonRetryable: res.status === 401 || res.status === 403,
      });
    }

    const json = (await res.json()) as Record<string, unknown>;

    // Parse tool calls and text from response
    const toolCalls: ToolCall[] = parseToolCalls(cfg.provider, json);
    const textContent = parseTextContent(cfg.provider, json);
    lastUsage = parseUsage(cfg.provider, json) ?? lastUsage;
    lastTextContent = textContent || lastTextContent;

    // No tool calls → agent is done
    if (toolCalls.length === 0) {
      break;
    }

    // Append the assistant message (with tool calls) to conversation
    appendAssistantMessage(cfg.provider, messages, json);

    // Execute each tool call and append results
    for (const tc of toolCalls) {
      const toolDef = tools.find((t) => t.name === tc.name);
      let result: string;
      if (!toolDef) {
        result = JSON.stringify({ error: `Unknown tool: ${tc.name}` });
      } else {
        result = await executeTool(toolDef, tc.args);
      }

      allToolCalls.push({ name: tc.name, args: tc.args, result });
      appendToolResult(cfg.provider, messages, tc, result);
    }
  }

  return {
    content: lastTextContent,
    toolCalls: allToolCalls,
    iterations: iterations + 1,
    maxIterationsReached: iterations >= maxIterations,
    model: cfg.model,
    provider: cfg.provider,
    usage: lastUsage,
  };
}
