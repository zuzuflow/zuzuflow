import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { AiTtsConfig } from "@workflow/shared";

// =============================================================================
// aiTtsActivity — text-to-speech (OpenAI TTS + ElevenLabs)
//
// Returns { audioBase64, contentType } — downstream nodes can upload the audio
// to S3/Blob/Drive or POST to Twilio/WhatsApp media endpoints.
// =============================================================================

export interface AiTtsActivityInput {
  config: AiTtsConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    apiKey?: string;
  };
}

export interface AiTtsActivityOutput {
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

export async function aiTtsActivity(
  input: AiTtsActivityInput,
): Promise<AiTtsActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const apiKey = resolvedCredentials?.apiKey;
  if (!apiKey) {
    throw ApplicationFailure.create({
      message: "AI TTS credential is missing — supply `{ apiKey }`.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }
  const text = interpolateTemplate(cfg.text, context);
  if (!text.trim()) {
    throw ApplicationFailure.create({
      message: "AI TTS: `text` is required",
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }

  if (cfg.provider === "openai") {
    const body: Record<string, unknown> = {
      model: cfg.model ?? "tts-1",
      input: text,
      voice: cfg.voice ?? "alloy",
      ...(cfg.format ? { response_format: cfg.format } : {}),
      ...(typeof cfg.speed === "number" ? { speed: cfg.speed } : {}),
    };
    const resp = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        accept: "audio/mpeg",
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      const { type, nonRetryable } = errType(resp.status);
      throw ApplicationFailure.create({
        message: `AI TTS openai failed: ${resp.status} ${resp.statusText} — ${errText.slice(0, 500)}`,
        type,
        nonRetryable,
        details: [{ status: resp.status, provider: "openai" }],
      });
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    return {
      ok: true,
      result: {
        contentType: resp.headers.get("content-type") ?? `audio/${cfg.format ?? "mpeg"}`,
        audioBase64: buf.toString("base64"),
        byteLength: buf.length,
        provider: "openai",
      },
    };
  }

  if (cfg.provider === "elevenlabs") {
    const voiceId = cfg.voice;
    if (!voiceId) {
      throw ApplicationFailure.create({
        message: "AI TTS elevenlabs: `voice` (ElevenLabs voice ID) is required",
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
    }
    const outputFormat = cfg.format ?? "mp3_44100_128";
    const body: Record<string, unknown> = {
      text,
      model_id: cfg.model ?? "eleven_multilingual_v2",
      voice_settings: {
        stability: cfg.stability ?? 0.5,
        similarity_boost: cfg.similarityBoost ?? 0.75,
      },
    };
    const resp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`,
      {
        method: "POST",
        headers: {
          accept: "audio/mpeg",
          "content-type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify(body),
      },
    );
    if (!resp.ok) {
      const errText = await resp.text();
      const { type, nonRetryable } = errType(resp.status);
      throw ApplicationFailure.create({
        message: `AI TTS elevenlabs failed: ${resp.status} ${resp.statusText} — ${errText.slice(0, 500)}`,
        type,
        nonRetryable,
        details: [{ status: resp.status, provider: "elevenlabs" }],
      });
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    return {
      ok: true,
      result: {
        contentType: resp.headers.get("content-type") ?? "audio/mpeg",
        audioBase64: buf.toString("base64"),
        byteLength: buf.length,
        provider: "elevenlabs",
        voiceId,
        format: outputFormat,
      },
    };
  }

  throw ApplicationFailure.create({
    message: `Unsupported AI TTS provider: ${(cfg as { provider?: string }).provider}`,
    type: "VALIDATION_ERROR",
    nonRetryable: true,
  });
}
