import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { AiImageConfig } from "@workflow/shared";

// =============================================================================
// aiImageActivity — image generation (OpenAI DALL·E + Stability AI)
// =============================================================================

export interface AiImageActivityInput {
  config: AiImageConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    apiKey?: string;
  };
}

export interface AiImageActivityOutput {
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
      message: `AI Image ${operation} failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
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

export async function aiImageActivity(
  input: AiImageActivityInput,
): Promise<AiImageActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const apiKey = resolvedCredentials?.apiKey;
  if (!apiKey) {
    throw ApplicationFailure.create({
      message: "AI Image credential is missing — supply `{ apiKey }`.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }
  const prompt = interpolateTemplate(cfg.prompt, context);
  if (!prompt.trim()) {
    throw ApplicationFailure.create({
      message: "AI Image: `prompt` is required",
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }

  if (cfg.provider === "openai") {
    const body: Record<string, unknown> = {
      model: cfg.model || "dall-e-3",
      prompt,
      n: cfg.n ?? 1,
      size: cfg.size ?? "1024x1024",
      ...(cfg.quality ? { quality: cfg.quality } : {}),
      ...(cfg.style ? { style: cfg.style } : {}),
      ...(cfg.responseFormat ? { response_format: cfg.responseFormat } : {}),
    };
    const result = await callJson(
      "https://api.openai.com/v1/images/generations",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      },
      "openai.generate",
    );
    return { ok: true, result };
  }

  if (cfg.provider === "stability") {
    const model = cfg.model || "stable-diffusion-xl-1024-v1-0";
    const [w, h] = (cfg.size ?? "1024x1024").split("x").map((s) => Number(s.trim()));
    const body: Record<string, unknown> = {
      text_prompts: [
        { text: prompt, weight: 1 },
        ...(cfg.negativePrompt
          ? [
              {
                text: interpolateTemplate(cfg.negativePrompt, context),
                weight: -1,
              },
            ]
          : []),
      ],
      cfg_scale: cfg.cfgScale ?? 7,
      steps: cfg.steps ?? 30,
      samples: cfg.n ?? 1,
      ...(Number.isFinite(w) && Number.isFinite(h) ? { width: w, height: h } : {}),
      ...(typeof cfg.seed === "number" ? { seed: cfg.seed } : {}),
    };
    const result = await callJson(
      `https://api.stability.ai/v1/generation/${encodeURIComponent(model)}/text-to-image`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      },
      "stability.generate",
    );
    return { ok: true, result };
  }

  throw ApplicationFailure.create({
    message: `Unsupported AI Image provider: ${(cfg as { provider?: string }).provider}`,
    type: "VALIDATION_ERROR",
    nonRetryable: true,
  });
}
