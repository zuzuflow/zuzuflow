import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { AiTranscribeConfig } from "@workflow/shared";

// =============================================================================
// aiTranscribeActivity — speech-to-text (OpenAI Whisper + AssemblyAI)
//
// Accepts either `audioUrl` (fetched server-side) or `audioBase64` (inline).
// For OpenAI: posts multipart/form-data to /v1/audio/transcriptions.
// For AssemblyAI: POST /v2/transcript with audio_url, poll until complete.
// =============================================================================

export interface AiTranscribeActivityInput {
  config: AiTranscribeConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    apiKey?: string;
  };
}

export interface AiTranscribeActivityOutput {
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

async function getAudioBlob(
  cfg: AiTranscribeConfig,
  context: Record<string, unknown>,
): Promise<{ data: Buffer; mime: string; filename: string }> {
  if (cfg.audioBase64) {
    const b64 = interpolateTemplate(cfg.audioBase64, context);
    return {
      data: Buffer.from(b64, "base64"),
      mime: cfg.audioMimeType ?? "audio/mpeg",
      filename: cfg.audioFilename ?? "audio.mp3",
    };
  }
  if (cfg.audioUrl) {
    const url = interpolateTemplate(cfg.audioUrl, context);
    const resp = await fetch(url);
    if (!resp.ok) {
      throw ApplicationFailure.create({
        message: `AI Transcribe: failed to fetch audio from ${url} (${resp.status})`,
        type: "UPSTREAM_ERROR",
        nonRetryable: false,
      });
    }
    return {
      data: Buffer.from(await resp.arrayBuffer()),
      mime:
        cfg.audioMimeType ??
        resp.headers.get("content-type") ??
        "audio/mpeg",
      filename: cfg.audioFilename ?? url.split("/").pop() ?? "audio.mp3",
    };
  }
  throw ApplicationFailure.create({
    message:
      "AI Transcribe: supply either `audioUrl` or `audioBase64` (+ audioMimeType).",
    type: "VALIDATION_ERROR",
    nonRetryable: true,
  });
}

export async function aiTranscribeActivity(
  input: AiTranscribeActivityInput,
): Promise<AiTranscribeActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const apiKey = resolvedCredentials?.apiKey;
  if (!apiKey) {
    throw ApplicationFailure.create({
      message: "AI Transcribe credential is missing — supply `{ apiKey }`.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  if (cfg.provider === "openai") {
    const audio = await getAudioBlob(cfg, context);
    const form = new FormData();
    form.append("file", new Blob([audio.data], { type: audio.mime }), audio.filename);
    form.append("model", cfg.model ?? "whisper-1");
    if (cfg.language)
      form.append("language", interpolateTemplate(cfg.language, context));
    if (cfg.prompt)
      form.append("prompt", interpolateTemplate(cfg.prompt, context));
    if (cfg.responseFormat) form.append("response_format", cfg.responseFormat);

    const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      body: form,
    });
    const text = await resp.text();
    if (!resp.ok) {
      const { type, nonRetryable } = errType(resp.status);
      throw ApplicationFailure.create({
        message: `AI Transcribe openai failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
        type,
        nonRetryable,
        details: [{ status: resp.status, provider: "openai" }],
      });
    }
    // response_format can be plain text or json — try JSON first.
    try {
      return { ok: true, result: JSON.parse(text) };
    } catch {
      return { ok: true, result: { text } };
    }
  }

  if (cfg.provider === "assemblyai") {
    if (!cfg.audioUrl) {
      throw ApplicationFailure.create({
        message:
          "AssemblyAI requires `audioUrl` — uploading base64 is not supported by this node.",
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
    }
    const audioUrl = interpolateTemplate(cfg.audioUrl, context);
    const createResp = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: apiKey,
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        language_code: cfg.language
          ? interpolateTemplate(cfg.language, context)
          : undefined,
        speaker_labels: cfg.speakerLabels ?? undefined,
      }),
    });
    const createText = await createResp.text();
    if (!createResp.ok) {
      const { type, nonRetryable } = errType(createResp.status);
      throw ApplicationFailure.create({
        message: `AssemblyAI create failed: ${createResp.status} — ${createText.slice(0, 500)}`,
        type,
        nonRetryable,
        details: [{ status: createResp.status, provider: "assemblyai" }],
      });
    }
    const created = JSON.parse(createText) as { id: string; status: string };
    const id = created.id;
    // Poll — up to 5 minutes.
    const deadline = Date.now() + 5 * 60 * 1000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      const pollResp = await fetch(
        `https://api.assemblyai.com/v2/transcript/${encodeURIComponent(id)}`,
        { headers: { authorization: apiKey } },
      );
      const pollText = await pollResp.text();
      if (!pollResp.ok) {
        const { type, nonRetryable } = errType(pollResp.status);
        throw ApplicationFailure.create({
          message: `AssemblyAI poll failed: ${pollResp.status} — ${pollText.slice(0, 500)}`,
          type,
          nonRetryable,
        });
      }
      const body = JSON.parse(pollText) as {
        status: string;
        error?: string;
      };
      if (body.status === "completed") return { ok: true, result: body };
      if (body.status === "error") {
        throw ApplicationFailure.create({
          message: `AssemblyAI transcript error: ${body.error ?? "unknown"}`,
          type: "UPSTREAM_ERROR",
          nonRetryable: false,
        });
      }
    }
    throw ApplicationFailure.create({
      message: "AssemblyAI transcript polling timed out after 5 minutes.",
      type: "UPSTREAM_ERROR",
      nonRetryable: false,
    });
  }

  throw ApplicationFailure.create({
    message: `Unsupported AI Transcribe provider: ${(cfg as { provider?: string }).provider}`,
    type: "VALIDATION_ERROR",
    nonRetryable: true,
  });
}
