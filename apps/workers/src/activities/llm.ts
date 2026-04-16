import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { LlmPromptConfig } from "@workflow/shared";

// =============================================================================
// llmPromptActivity — calls an OpenAI-compatible or Ollama LLM endpoint
// =============================================================================

export interface LlmPromptActivityInput {
  config: LlmPromptConfig;
  context: Record<string, unknown>;
  resolvedApiKey?: string;
}

export interface LlmPromptActivityOutput {
  content: string;
  model: string;
  provider: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export async function llmPromptActivity(
  input: LlmPromptActivityInput
): Promise<LlmPromptActivityOutput> {
  const { config: cfg, context, resolvedApiKey } = input;

  const prompt = interpolateTemplate(cfg.prompt, context);
  const systemPrompt = cfg.systemPrompt
    ? interpolateTemplate(cfg.systemPrompt, context)
    : undefined;

  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  // Determine API URL, headers, and request body based on provider
  const apiKey = resolvedApiKey ?? cfg.credentialId ?? "";
  let apiUrl: string;
  let requestHeaders: Record<string, string> = { "Content-Type": "application/json" };
  let requestBody: Record<string, unknown>;

  if (cfg.provider === "ollama") {
    // ---- Ollama ----
    apiUrl = cfg.apiUrl ?? "http://localhost:11434/api/chat";
    requestBody = {
      model: cfg.model,
      messages,
      ...(cfg.maxTokens != null ? { max_tokens: cfg.maxTokens } : {}),
      ...(cfg.temperature != null ? { temperature: cfg.temperature } : {}),
    };
  } else if (cfg.provider === "anthropic") {
    // ---- Anthropic ----
    apiUrl = cfg.apiUrl ?? "https://api.anthropic.com/v1/messages";
    requestHeaders = {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    };
    requestBody = {
      model: cfg.model,
      max_tokens: cfg.maxTokens ?? 1024,
      messages: [{ role: "user", content: prompt }],
      ...(systemPrompt ? { system: systemPrompt } : {}),
      ...(cfg.temperature != null ? { temperature: cfg.temperature } : {}),
    };
  } else if (cfg.provider === "gemini") {
    // ---- Gemini ----
    apiUrl =
      cfg.apiUrl ??
      `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${apiKey}`;
    requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      ...(systemPrompt
        ? { systemInstruction: { parts: [{ text: systemPrompt }] } }
        : {}),
      ...(cfg.maxTokens != null || cfg.temperature != null
        ? {
            generationConfig: {
              ...(cfg.maxTokens != null ? { maxOutputTokens: cfg.maxTokens } : {}),
              ...(cfg.temperature != null ? { temperature: cfg.temperature } : {}),
            },
          }
        : {}),
    };
  } else if (cfg.provider === "huggingface") {
    // ---- HuggingFace Inference API ----
    apiUrl =
      cfg.apiUrl ?? `https://api-inference.huggingface.co/models/${cfg.model}`;
    if (apiKey) {
      requestHeaders["Authorization"] = `Bearer ${apiKey}`;
    }
    requestBody = {
      inputs: prompt,
      parameters: {
        ...(cfg.maxTokens != null ? { max_new_tokens: cfg.maxTokens } : {}),
        ...(cfg.temperature != null ? { temperature: cfg.temperature } : {}),
      },
    };
  } else {
    // ---- OpenAI-compatible (default) ----
    apiUrl = cfg.apiUrl ?? "https://api.openai.com/v1/chat/completions";
    if (apiKey) {
      requestHeaders["Authorization"] = `Bearer ${apiKey}`;
    }
    requestBody = {
      model: cfg.model,
      messages,
      ...(cfg.maxTokens != null ? { max_tokens: cfg.maxTokens } : {}),
      ...(cfg.temperature != null ? { temperature: cfg.temperature } : {}),
    };
  }

  let res: Response;
  try {
    res = await fetch(apiUrl, {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    throw ApplicationFailure.create({
      message: `LLM request network error: ${(err as Error).message}`,
      type: "LLM_NETWORK_ERROR",
      nonRetryable: false,
    });
  }

  if (!res.ok) {
    const errBody = await res.text();
    throw ApplicationFailure.create({
      message: `LLM API returned ${res.status}: ${errBody.slice(0, 500)}`,
      type: "LLM_API_ERROR",
      nonRetryable: res.status === 401 || res.status === 403,
    });
  }

  const json = (await res.json()) as Record<string, unknown>;

  // ---- Parse response per provider ----

  if (cfg.provider === "ollama") {
    const ollamaMsg = (json.message as { content?: string } | undefined)?.content ?? "";
    return {
      content: ollamaMsg,
      model: cfg.model,
      provider: cfg.provider,
    };
  }

  if (cfg.provider === "anthropic") {
    const contentArr = json.content as Array<{ text?: string }> | undefined;
    const text = contentArr?.[0]?.text ?? "";
    const anthropicUsage = json.usage as {
      input_tokens?: number;
      output_tokens?: number;
    } | undefined;
    return {
      content: text,
      model: cfg.model,
      provider: cfg.provider,
      ...(anthropicUsage
        ? {
            usage: {
              promptTokens: anthropicUsage.input_tokens,
              completionTokens: anthropicUsage.output_tokens,
              totalTokens:
                (anthropicUsage.input_tokens ?? 0) +
                (anthropicUsage.output_tokens ?? 0),
            },
          }
        : {}),
    };
  }

  if (cfg.provider === "gemini") {
    const candidates = json.candidates as Array<{
      content?: { parts?: Array<{ text?: string }> };
    }> | undefined;
    const text = candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const geminiUsage = json.usageMetadata as {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    } | undefined;
    return {
      content: text,
      model: cfg.model,
      provider: cfg.provider,
      ...(geminiUsage
        ? {
            usage: {
              promptTokens: geminiUsage.promptTokenCount,
              completionTokens: geminiUsage.candidatesTokenCount,
              totalTokens: geminiUsage.totalTokenCount,
            },
          }
        : {}),
    };
  }

  if (cfg.provider === "huggingface") {
    const hfResult = json as unknown;
    const arr = Array.isArray(hfResult) ? hfResult : [hfResult];
    const text = (arr[0] as { generated_text?: string })?.generated_text ?? "";
    return {
      content: text,
      model: cfg.model,
      provider: cfg.provider,
    };
  }

  // OpenAI-compatible response (default)
  const choices = json.choices as Array<{ message?: { content?: string } }> | undefined;
  const content = choices?.[0]?.message?.content ?? "";
  const usage = json.usage as {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | undefined;

  return {
    content,
    model: cfg.model,
    provider: cfg.provider,
    ...(usage
      ? {
          usage: {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
          },
        }
      : {}),
  };
}
