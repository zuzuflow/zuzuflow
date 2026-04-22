import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { ResendConfig } from "@workflow/shared";

// =============================================================================
// resendActivity — Resend transactional mail
//
// Credential: { apiKey } (`re_...`). Bearer auth.
// =============================================================================

export interface ResendActivityInput {
  config: ResendConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    apiKey?: string;
  };
}

export interface ResendActivityOutput {
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
      message: `Resend ${label}: invalid JSON — ${(err as Error).message}`,
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
      message: `Resend: \`${label}\` is required`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  return val;
}

async function resendFetch(
  apiKey: string,
  method: string,
  path: string,
  body: unknown,
  operation: string,
): Promise<unknown> {
  const resp = await fetch(`https://api.resend.com${path}`, {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw ApplicationFailure.create({
      message: `Resend ${operation} failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
      type:
        resp.status === 401 || resp.status === 403
          ? "AUTH_ERROR"
          : resp.status === 429
            ? "RATE_LIMITED"
            : resp.status === 400 ||
                resp.status === 404 ||
                resp.status === 422
              ? "VALIDATION_ERROR"
              : "UPSTREAM_ERROR",
      nonRetryable:
        resp.status === 401 ||
        resp.status === 403 ||
        resp.status === 400 ||
        resp.status === 404 ||
        resp.status === 422,
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

export async function resendActivity(
  input: ResendActivityInput,
): Promise<ResendActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const apiKey = resolvedCredentials?.apiKey;
  if (!apiKey) {
    throw ApplicationFailure.create({
      message: "Resend credential is missing — supply `{ apiKey }`.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  switch (cfg.operation) {
    case "emails.send": {
      const from = mustString("from", cfg.from, context);
      const to = splitCsv(cfg.to, context);
      if (!to || to.length === 0) {
        throw ApplicationFailure.create({
          message: "Resend: `to` must have at least one recipient",
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
      }
      const subject = mustString("subject", cfg.subject, context);
      const html = cfg.html ? interpolateTemplate(cfg.html, context) : undefined;
      const text = cfg.text ? interpolateTemplate(cfg.text, context) : undefined;
      if (!html && !text) {
        throw ApplicationFailure.create({
          message: "Resend: supply at least one of `html` or `text`",
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
      }
      const body: Record<string, unknown> = {
        from,
        to,
        subject,
        ...(html ? { html } : {}),
        ...(text ? { text } : {}),
      };
      const cc = splitCsv(cfg.cc, context);
      if (cc && cc.length) body.cc = cc;
      const bcc = splitCsv(cfg.bcc, context);
      if (bcc && bcc.length) body.bcc = bcc;
      if (cfg.replyTo)
        body.reply_to = interpolateTemplate(cfg.replyTo, context);
      const tags = parseJson<Array<{ name: string; value: string }>>(
        "tags",
        cfg.tags,
        context,
      );
      if (tags) body.tags = tags;
      const result = await resendFetch(
        apiKey,
        "POST",
        "/emails",
        body,
        "emails.send",
      );
      return { ok: true, result };
    }
    case "emails.get": {
      const id = mustString("emailId", cfg.emailId, context);
      const result = await resendFetch(
        apiKey,
        "GET",
        `/emails/${encodeURIComponent(id)}`,
        undefined,
        "emails.get",
      );
      return { ok: true, result };
    }
    default:
      throw ApplicationFailure.create({
        message: `Unsupported Resend operation: ${(cfg as { operation?: string }).operation}`,
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
  }
}
