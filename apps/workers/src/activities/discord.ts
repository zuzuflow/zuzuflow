import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { DiscordConfig } from "@workflow/shared";

// =============================================================================
// discordActivity — Discord messaging
//
// Two auth paths:
//   - Webhook messages (sendWebhookMessage): credential `{ webhookUrl }`.
//   - Bot REST calls (sendChannelMessage / addReaction): credential
//     `{ botToken }` using the bot's token authorization.
// =============================================================================

export interface DiscordActivityInput {
  config: DiscordConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    webhookUrl?: string;
    botToken?: string;
  };
}

export interface DiscordActivityOutput {
  ok: boolean;
  result: unknown;
}

function parseJson(
  label: string,
  raw: string | undefined,
  context: Record<string, unknown>,
): unknown {
  if (!raw) return undefined;
  const interp = interpolateTemplate(raw, context);
  if (!interp.trim()) return undefined;
  try {
    return JSON.parse(interp);
  } catch (err) {
    throw ApplicationFailure.create({
      message: `Discord ${label}: invalid JSON — ${(err as Error).message}`,
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
      message: `Discord: \`${label}\` is required`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  return val;
}

async function discordFetch(
  url: string,
  init: RequestInit,
  operation: string,
): Promise<unknown> {
  const resp = await fetch(url, init);
  const text = await resp.text();
  if (!resp.ok) {
    throw ApplicationFailure.create({
      message: `Discord ${operation} failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
      type:
        resp.status === 401 || resp.status === 403
          ? "AUTH_ERROR"
          : resp.status === 429
            ? "RATE_LIMITED"
            : resp.status === 404 || resp.status === 400
              ? "VALIDATION_ERROR"
              : "UPSTREAM_ERROR",
      nonRetryable:
        resp.status === 401 ||
        resp.status === 403 ||
        resp.status === 404 ||
        resp.status === 400,
      details: [{ status: resp.status, operation }],
    });
  }
  if (!text) return { ok: true };
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function discordActivity(
  input: DiscordActivityInput,
): Promise<DiscordActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;

  switch (cfg.operation) {
    case "sendWebhookMessage": {
      const webhookUrl = resolvedCredentials?.webhookUrl;
      if (!webhookUrl) {
        throw ApplicationFailure.create({
          message:
            "Discord sendWebhookMessage: credential must provide `{ webhookUrl }`.",
          type: "AUTH_ERROR",
          nonRetryable: true,
        });
      }
      const content = cfg.content
        ? interpolateTemplate(cfg.content, context)
        : undefined;
      const username = cfg.username
        ? interpolateTemplate(cfg.username, context)
        : undefined;
      const avatarUrl = cfg.avatarUrl
        ? interpolateTemplate(cfg.avatarUrl, context)
        : undefined;
      const embeds = parseJson("embeds", cfg.embeds, context) as
        | unknown[]
        | undefined;
      if (!content && !embeds) {
        throw ApplicationFailure.create({
          message:
            "Discord sendWebhookMessage: either `content` or `embeds` is required.",
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
      }
      // The ?wait=true query returns the created message body.
      const sep = webhookUrl.includes("?") ? "&" : "?";
      const result = await discordFetch(
        `${webhookUrl}${sep}wait=true`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            content,
            username,
            avatar_url: avatarUrl,
            embeds,
            tts: cfg.tts,
          }),
        },
        "sendWebhookMessage",
      );
      return { ok: true, result };
    }

    case "sendChannelMessage": {
      const botToken = resolvedCredentials?.botToken;
      if (!botToken) {
        throw ApplicationFailure.create({
          message:
            "Discord sendChannelMessage: credential must provide `{ botToken }`.",
          type: "AUTH_ERROR",
          nonRetryable: true,
        });
      }
      const channelId = mustString("channelId", cfg.channelId, context);
      const content = cfg.content
        ? interpolateTemplate(cfg.content, context)
        : undefined;
      const embeds = parseJson("embeds", cfg.embeds, context) as
        | unknown[]
        | undefined;
      if (!content && !embeds) {
        throw ApplicationFailure.create({
          message:
            "Discord sendChannelMessage: either `content` or `embeds` is required.",
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
      }
      const result = await discordFetch(
        `https://discord.com/api/v10/channels/${encodeURIComponent(channelId)}/messages`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bot ${botToken}`,
          },
          body: JSON.stringify({ content, embeds, tts: cfg.tts }),
        },
        "sendChannelMessage",
      );
      return { ok: true, result };
    }

    case "addReaction": {
      const botToken = resolvedCredentials?.botToken;
      if (!botToken) {
        throw ApplicationFailure.create({
          message:
            "Discord addReaction: credential must provide `{ botToken }`.",
          type: "AUTH_ERROR",
          nonRetryable: true,
        });
      }
      const channelId = mustString("channelId", cfg.channelId, context);
      const messageId = mustString("messageId", cfg.messageId, context);
      const emoji = mustString("emoji", cfg.emoji, context);
      const result = await discordFetch(
        `https://discord.com/api/v10/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}/reactions/${encodeURIComponent(emoji)}/@me`,
        {
          method: "PUT",
          headers: { authorization: `Bot ${botToken}` },
        },
        "addReaction",
      );
      return { ok: true, result };
    }

    default:
      throw ApplicationFailure.create({
        message: `Unsupported Discord operation: ${(cfg as { operation?: string }).operation}`,
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
  }
}
