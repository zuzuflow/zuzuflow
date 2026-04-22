import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { SendgridConfig } from "@workflow/shared";

// =============================================================================
// sendgridActivity — SendGrid transactional mail
//
// Uses `@sendgrid/mail` SDK directly (lazy import). Credential: { apiKey }
// with an "SG." prefix. This is a first-class node; the legacy path wrapped
// via Twilio remains for backwards compat on the twilio_email kind.
// =============================================================================

export interface SendgridActivityInput {
  config: SendgridConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    apiKey?: string;
  };
}

export interface SendgridActivityOutput {
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
      message: `SendGrid ${label}: invalid JSON — ${(err as Error).message}`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
}

function splitCsv(
  raw: string | undefined,
  context: Record<string, unknown>,
): string[] | undefined {
  if (!raw) return undefined;
  const interp = interpolateTemplate(raw, context);
  if (!interp.trim()) return undefined;
  return interp
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function mustString(
  label: string,
  raw: string | undefined,
  context: Record<string, unknown>,
): string {
  const val = raw ? interpolateTemplate(raw, context) : "";
  if (!val) {
    throw ApplicationFailure.create({
      message: `SendGrid: \`${label}\` is required`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  return val;
}

export async function sendgridActivity(
  input: SendgridActivityInput,
): Promise<SendgridActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;

  const apiKey = resolvedCredentials?.apiKey;
  if (!apiKey) {
    throw ApplicationFailure.create({
      message:
        "SendGrid credential is missing — supply `{ apiKey }` (SG.-prefixed).",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  if (cfg.operation !== "mail.send") {
    throw ApplicationFailure.create({
      message: `Unsupported SendGrid operation: ${(cfg as { operation?: string }).operation}`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }

  const { default: sgMail } = await import("@sendgrid/mail");
  sgMail.setApiKey(apiKey);

  const fromEmail = mustString("from", cfg.from, context);
  const fromName = cfg.fromName
    ? interpolateTemplate(cfg.fromName, context)
    : undefined;
  const subject = mustString("subject", cfg.subject, context);
  const to = splitCsv(cfg.to, context);
  if (!to || to.length === 0) {
    throw ApplicationFailure.create({
      message: "SendGrid: `to` must have at least one recipient",
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  const cc = splitCsv(cfg.cc, context);
  const bcc = splitCsv(cfg.bcc, context);
  const replyTo = cfg.replyTo
    ? interpolateTemplate(cfg.replyTo, context)
    : undefined;
  const text = cfg.text ? interpolateTemplate(cfg.text, context) : undefined;
  const html = cfg.html ? interpolateTemplate(cfg.html, context) : undefined;
  const dynamicTemplateData = parseJson<Record<string, unknown>>(
    "dynamicTemplateData",
    cfg.dynamicTemplateData,
    context,
  );
  const categories = splitCsv(cfg.categories, context);
  const sendAt = cfg.sendAt
    ? Number(interpolateTemplate(cfg.sendAt, context))
    : undefined;

  if (!cfg.templateId && !text && !html) {
    throw ApplicationFailure.create({
      message:
        "SendGrid: supply at least one of `text`, `html`, or `templateId`.",
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }

  // Minimal mail-data shape (matches @sendgrid/mail's expected MailDataRequired
  // at runtime; we cast via `as never` because the SDK's types are strict about
  // at-least-one-of content, which our conditional above guarantees).
  const msg = {
    to: to.length === 1 ? to[0] : to,
    from: fromName ? { email: fromEmail, name: fromName } : fromEmail,
    subject,
    ...(text ? { text } : {}),
    ...(html ? { html } : {}),
    ...(cc && cc.length ? { cc } : {}),
    ...(bcc && bcc.length ? { bcc } : {}),
    ...(replyTo ? { replyTo } : {}),
    ...(cfg.templateId ? { templateId: cfg.templateId } : {}),
    ...(dynamicTemplateData ? { dynamicTemplateData } : {}),
    ...(categories && categories.length ? { categories } : {}),
    ...(sendAt && Number.isFinite(sendAt) ? { sendAt: Math.floor(sendAt) } : {}),
  };

  try {
    const [resp] = await sgMail.send(msg as never);
    return {
      ok: true,
      result: {
        statusCode: resp.statusCode,
        messageId: resp.headers?.["x-message-id"],
        headers: resp.headers,
      },
    };
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    const e = err as {
      code?: number;
      response?: { body?: unknown; status?: number; statusCode?: number };
      message?: string;
    };
    const status = e.code ?? e.response?.statusCode ?? e.response?.status ?? 0;
    throw ApplicationFailure.create({
      message: `SendGrid mail.send failed: ${e.message ?? String(err)}`,
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
      details: [{ status, body: e.response?.body }],
    });
  }
}
