import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { MsTeamsConfig } from "@workflow/shared";

// =============================================================================
// msTeamsActivity — Microsoft Teams via Incoming Webhook
//
// Credential: { webhookUrl } — a Teams channel connector URL.
// =============================================================================

export interface MsTeamsActivityInput {
  config: MsTeamsConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    webhookUrl?: string;
  };
}

export interface MsTeamsActivityOutput {
  ok: boolean;
  result: unknown;
}

function parseJson<T = unknown>(
  label: string,
  raw: string | undefined,
  context: Record<string, unknown>,
): T | undefined {
  if (!raw) return undefined;
  const interp = interpolateTemplate(raw, context);
  if (!interp.trim()) return undefined;
  try {
    return JSON.parse(interp) as T;
  } catch (err) {
    throw ApplicationFailure.create({
      message: `MS Teams ${label}: invalid JSON — ${(err as Error).message}`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
}

export async function msTeamsActivity(
  input: MsTeamsActivityInput,
): Promise<MsTeamsActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;

  const webhookUrl = resolvedCredentials?.webhookUrl;
  if (!webhookUrl) {
    throw ApplicationFailure.create({
      message: "MS Teams credential is missing — supply `{ webhookUrl }`.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  let payload: Record<string, unknown>;
  switch (cfg.operation) {
    case "sendWebhookMessage": {
      const message = cfg.message
        ? interpolateTemplate(cfg.message, context)
        : "";
      if (!message) {
        throw ApplicationFailure.create({
          message: "MS Teams sendWebhookMessage: `message` is required",
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
      }
      const title = cfg.title
        ? interpolateTemplate(cfg.title, context)
        : undefined;
      payload = {
        "@type": "MessageCard",
        "@context": "https://schema.org/extensions",
        themeColor: cfg.themeColor ?? "0076D7",
        ...(title ? { title } : {}),
        text: message,
      };
      break;
    }
    case "sendAdaptiveCard": {
      const card = parseJson<Record<string, unknown>>(
        "cardJson",
        cfg.cardJson,
        context,
      );
      if (!card) {
        throw ApplicationFailure.create({
          message: "MS Teams sendAdaptiveCard: `cardJson` is required",
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
      }
      payload = {
        type: "message",
        attachments: [
          {
            contentType: "application/vnd.microsoft.card.adaptive",
            content: card,
          },
        ],
      };
      break;
    }
    default:
      throw ApplicationFailure.create({
        message: `Unsupported MS Teams operation: ${(cfg as { operation?: string }).operation}`,
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
  }

  const resp = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw ApplicationFailure.create({
      message: `MS Teams ${cfg.operation} failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
      type:
        resp.status === 401 || resp.status === 403
          ? "AUTH_ERROR"
          : resp.status === 400 || resp.status === 404
            ? "VALIDATION_ERROR"
            : resp.status === 429
              ? "RATE_LIMITED"
              : "UPSTREAM_ERROR",
      nonRetryable:
        resp.status === 401 ||
        resp.status === 403 ||
        resp.status === 400 ||
        resp.status === 404,
      details: [{ status: resp.status, operation: cfg.operation }],
    });
  }
  return {
    ok: true,
    result: { delivered: true, body: text || null },
  };
}
