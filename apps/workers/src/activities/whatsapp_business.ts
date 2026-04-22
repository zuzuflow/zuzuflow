import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { WhatsappConfig } from "@workflow/shared";

// =============================================================================
// whatsappActivity — WhatsApp Business Cloud API (Meta Graph v20.0+)
//
// Credential: { accessToken, phoneNumberId }. Bearer auth. phoneNumberId is
// the sending phone number's Meta-assigned ID.
// =============================================================================

export interface WhatsappActivityInput {
  config: WhatsappConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    accessToken?: string;
    phoneNumberId?: string;
  };
}

export interface WhatsappActivityOutput {
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
      message: `WhatsApp ${label}: invalid JSON — ${(err as Error).message}`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
}

function mustString(
  label: string,
  raw: string | undefined,
  context: Record<string, unknown>,
): string {
  const val = raw ? interpolateTemplate(raw, context) : "";
  if (!val) {
    throw ApplicationFailure.create({
      message: `WhatsApp: \`${label}\` is required`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  return val;
}

async function waFetch(
  accessToken: string,
  path: string,
  body: unknown,
  operation: string,
): Promise<unknown> {
  const resp = await fetch(`https://graph.facebook.com/v20.0${path}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw ApplicationFailure.create({
      message: `WhatsApp ${operation} failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
      type:
        resp.status === 401 || resp.status === 403
          ? "AUTH_ERROR"
          : resp.status === 429
            ? "RATE_LIMITED"
            : resp.status === 400 || resp.status === 404
              ? "VALIDATION_ERROR"
              : "UPSTREAM_ERROR",
      nonRetryable:
        resp.status === 401 ||
        resp.status === 403 ||
        resp.status === 400 ||
        resp.status === 404,
      details: [{ status: resp.status, operation }],
    });
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function whatsappActivity(
  input: WhatsappActivityInput,
): Promise<WhatsappActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const accessToken = resolvedCredentials?.accessToken;
  const phoneNumberId = resolvedCredentials?.phoneNumberId;
  if (!accessToken || !phoneNumberId) {
    throw ApplicationFailure.create({
      message:
        "WhatsApp credential is missing — supply `{ accessToken, phoneNumberId }`.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }
  const path = `/${encodeURIComponent(phoneNumberId)}/messages`;

  switch (cfg.operation) {
    case "messages.sendText": {
      const to = mustString("to", cfg.to, context);
      const text = mustString("text", cfg.text, context);
      const result = await waFetch(
        accessToken,
        path,
        {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: {
            body: text,
            ...(typeof cfg.previewUrl === "boolean"
              ? { preview_url: cfg.previewUrl }
              : {}),
          },
        },
        "messages.sendText",
      );
      return { ok: true, result };
    }
    case "messages.sendTemplate": {
      const to = mustString("to", cfg.to, context);
      const name = mustString("templateName", cfg.templateName, context);
      const language = cfg.templateLanguage ?? "en_US";
      const components = parseJson<unknown[]>(
        "templateComponents",
        cfg.templateComponents,
        context,
      );
      const result = await waFetch(
        accessToken,
        path,
        {
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name,
            language: { code: language },
            ...(components ? { components } : {}),
          },
        },
        "messages.sendTemplate",
      );
      return { ok: true, result };
    }
    case "messages.sendMedia": {
      const to = mustString("to", cfg.to, context);
      const type = cfg.mediaType ?? "image";
      const url = mustString("mediaUrl", cfg.mediaUrl, context);
      const caption = cfg.caption
        ? interpolateTemplate(cfg.caption, context)
        : undefined;
      const filename = cfg.filename
        ? interpolateTemplate(cfg.filename, context)
        : undefined;
      const mediaObj: Record<string, unknown> = { link: url };
      if (caption && (type === "image" || type === "video" || type === "document"))
        mediaObj.caption = caption;
      if (filename && type === "document") mediaObj.filename = filename;
      const result = await waFetch(
        accessToken,
        path,
        {
          messaging_product: "whatsapp",
          to,
          type,
          [type]: mediaObj,
        },
        "messages.sendMedia",
      );
      return { ok: true, result };
    }
    case "messages.markAsRead": {
      const messageId = mustString("messageId", cfg.messageId, context);
      const result = await waFetch(
        accessToken,
        path,
        {
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId,
        },
        "messages.markAsRead",
      );
      return { ok: true, result };
    }
    default:
      throw ApplicationFailure.create({
        message: `Unsupported WhatsApp operation: ${(cfg as { operation?: string }).operation}`,
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
  }
}
