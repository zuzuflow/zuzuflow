import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { AiEmbedConfig } from "@workflow/shared";

// =============================================================================
// aiEmbedActivity — text → vector embeddings
//
// Providers:
//   - openai  (POST /v1/embeddings)
//   - cohere  (POST /v1/embed)
//   - huggingface (POST /models/{model}/feature-extraction)
// =============================================================================

export interface AiEmbedActivityInput {
  config: AiEmbedConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    apiKey?: string;
    apiToken?: string;
  };
}

export interface AiEmbedActivityOutput {
  ok: boolean;
  result: unknown;
}

function errType(status: number): { type: string; nonRetryable: boolean } {
  if (status === 401 || status === 403)
    return { type: "AUTH_ERROR", nonRetryable: true };
  if (status === 429) return { type: "RATE_LIMITED", nonRetryable: false };
  if (status === 400 || status === 404 || status === 422)
    return { type: "VALIDATION_ERROR", nonRetryable: true };
  return { type: "UPSTREAM_ERROR", nonRetryable: false };
}

function parseInputs(
  raw: string,
  context: Record<string, unknown>,
): string[] {
  const interp = interpolateTemplate(raw, context).trim();
  if (!interp) {
    throw ApplicationFailure.create({
      message: "AI Embed: `input` is required (JSON array of strings)",
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  try {
    const parsed = JSON.parse(interp);
    if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    if (typeof parsed === "string") return [parsed];
    throw new Error("expected array or string");
  } catch {
    // Allow plain text (one string) if not JSON.
    return [interp];
  }
}

async function callJson(
  url: string,
  init: RequestInit,
  operation: string,
): Promise<unknown> {
  const resp = await fetch(url, init);
  const text = await resp.text();
  if (!resp.ok) {
    const { type, nonRetryable } = errType(resp.status);
    throw ApplicationFailure.create({
      message: `AI Embed ${operation} failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
      type,
      nonRetryable,
      details: [{ status: resp.status, operation }],
    });
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function aiEmbedActivity(
  input: AiEmbedActivityInput,
): Promise<AiEmbedActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const key = resolvedCredentials?.apiKey ?? resolvedCredentials?.apiToken;
  if (!key) {
    throw ApplicationFailure.create({
      message:
        "AI Embed credential is missing — supply `{ apiKey }` (or `{ apiToken }` for Hugging Face).",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }
  const inputs = parseInputs(cfg.input, context);

  if (cfg.provider === "openai") {
    const result = (await callJson(
      "https://api.openai.com/v1/embeddings",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: cfg.model || "text-embedding-3-small",
          input: inputs,
          ...(cfg.dimensions ? { dimensions: cfg.dimensions } : {}),
          ...(cfg.encodingFormat
            ? { encoding_format: cfg.encodingFormat }
            : {}),
        }),
      },
      "openai.embeddings",
    )) as { data?: Array<{ embedding: number[]; index: number }> };
    return {
      ok: true,
      result: {
        vectors: result.data ?? [],
        count: result.data?.length ?? 0,
        provider: "openai",
      },
    };
  }

  if (cfg.provider === "cohere") {
    const result = (await callJson(
      "https://api.cohere.com/v2/embed",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: cfg.model || "embed-english-v3.0",
          texts: inputs,
          input_type: cfg.inputType ?? "search_document",
        }),
      },
      "cohere.embed",
    )) as { embeddings?: number[][] | { float?: number[][] } };
    const vectors = Array.isArray(result.embeddings)
      ? result.embeddings
      : (result.embeddings?.float ?? []);
    return {
      ok: true,
      result: {
        vectors: vectors.map((embedding, index) => ({ embedding, index })),
        count: vectors.length,
        provider: "cohere",
      },
    };
  }

  if (cfg.provider === "huggingface") {
    // HF feature-extraction returns number[] (single) or number[][] (batch).
    const result = (await callJson(
      `https://api-inference.huggingface.co/pipeline/feature-extraction/${encodeURIComponent(cfg.model)}`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ inputs }),
      },
      "huggingface.feature-extraction",
    )) as number[] | number[][];
    const vectors = Array.isArray(result[0])
      ? (result as number[][]).map((embedding, index) => ({
          embedding,
          index,
        }))
      : [{ embedding: result as number[], index: 0 }];
    return {
      ok: true,
      result: {
        vectors,
        count: vectors.length,
        provider: "huggingface",
      },
    };
  }

  throw ApplicationFailure.create({
    message: `Unsupported AI Embed provider: ${(cfg as { provider?: string }).provider}`,
    type: "VALIDATION_ERROR",
    nonRetryable: true,
  });
}
