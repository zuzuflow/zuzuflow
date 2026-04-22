import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { TelegramConfig } from "@workflow/shared";

// =============================================================================
// telegramActivity — Telegram Bot API
//
// Credential: { botToken } — e.g. 123456:AABBCC... from @BotFather.
// =============================================================================

export interface TelegramActivityInput {
  config: TelegramConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    botToken?: string;
  };
}

export interface TelegramActivityOutput {
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
      message: `Telegram ${label}: invalid JSON — ${(err as Error).message}`,
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
      message: `Telegram: \`${label}\` is required`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  return val;
}

async function tgCall(
  botToken: string,
  method: string,
  params: Record<string, unknown>,
  operation: string,
): Promise<unknown> {
  const resp = await fetch(
    `https://api.telegram.org/bot${botToken}/${method}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
    },
  );
  const text = await resp.text();
  const body = text
    ? (JSON.parse(text) as {
        ok: boolean;
        result?: unknown;
        description?: string;
        error_code?: number;
      })
    : { ok: false, description: "empty response" };
  if (!resp.ok || !body.ok) {
    const status = body.error_code ?? resp.status;
    throw ApplicationFailure.create({
      message: `Telegram ${operation} failed: ${status} — ${body.description ?? resp.statusText}`,
      type:
        status === 401 || status === 403
          ? "AUTH_ERROR"
          : status === 429
            ? "RATE_LIMITED"
            : status === 400 || status === 404
              ? "VALIDATION_ERROR"
              : "UPSTREAM_ERROR",
      nonRetryable:
        status === 401 ||
        status === 403 ||
        status === 400 ||
        status === 404,
      details: [{ status, operation, description: body.description }],
    });
  }
  return body.result;
}

export async function telegramActivity(
  input: TelegramActivityInput,
): Promise<TelegramActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const botToken = resolvedCredentials?.botToken;
  if (!botToken) {
    throw ApplicationFailure.create({
      message: "Telegram credential is missing — supply `{ botToken }`.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  const replyMarkup = parseJson<unknown>(
    "replyMarkup",
    cfg.replyMarkup,
    context,
  );

  switch (cfg.operation) {
    case "sendMessage": {
      const chatId = mustString("chatId", cfg.chatId, context);
      const text = mustString("text", cfg.text, context);
      const result = await tgCall(
        botToken,
        "sendMessage",
        {
          chat_id: chatId,
          text,
          parse_mode: cfg.parseMode,
          disable_notification: cfg.disableNotification,
          reply_markup: replyMarkup,
        },
        "sendMessage",
      );
      return { ok: true, result };
    }
    case "sendPhoto": {
      const chatId = mustString("chatId", cfg.chatId, context);
      const photo = mustString("photoUrl", cfg.photoUrl, context);
      const caption = cfg.caption
        ? interpolateTemplate(cfg.caption, context)
        : undefined;
      const result = await tgCall(
        botToken,
        "sendPhoto",
        {
          chat_id: chatId,
          photo,
          caption,
          parse_mode: cfg.parseMode,
          disable_notification: cfg.disableNotification,
          reply_markup: replyMarkup,
        },
        "sendPhoto",
      );
      return { ok: true, result };
    }
    case "sendDocument": {
      const chatId = mustString("chatId", cfg.chatId, context);
      const document = mustString("documentUrl", cfg.documentUrl, context);
      const caption = cfg.caption
        ? interpolateTemplate(cfg.caption, context)
        : undefined;
      const result = await tgCall(
        botToken,
        "sendDocument",
        {
          chat_id: chatId,
          document,
          caption,
          parse_mode: cfg.parseMode,
          disable_notification: cfg.disableNotification,
          reply_markup: replyMarkup,
        },
        "sendDocument",
      );
      return { ok: true, result };
    }
    case "editMessageText": {
      const chatId = mustString("chatId", cfg.chatId, context);
      const messageId = Number(mustString("messageId", cfg.messageId, context));
      const text = mustString("text", cfg.text, context);
      const result = await tgCall(
        botToken,
        "editMessageText",
        {
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: cfg.parseMode,
          reply_markup: replyMarkup,
        },
        "editMessageText",
      );
      return { ok: true, result };
    }
    case "answerCallbackQuery": {
      const callbackQueryId = mustString(
        "callbackQueryId",
        cfg.callbackQueryId,
        context,
      );
      const text = cfg.text ? interpolateTemplate(cfg.text, context) : undefined;
      const result = await tgCall(
        botToken,
        "answerCallbackQuery",
        {
          callback_query_id: callbackQueryId,
          text,
        },
        "answerCallbackQuery",
      );
      return { ok: true, result };
    }
    default:
      throw ApplicationFailure.create({
        message: `Unsupported Telegram operation: ${(cfg as { operation?: string }).operation}`,
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
  }
}
