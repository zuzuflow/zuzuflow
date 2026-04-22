import { ApplicationFailure } from "@temporalio/activity";
import crypto from "crypto";
import { interpolateTemplate } from "@workflow/shared";
import type { MailchimpConfig } from "@workflow/shared";

// =============================================================================
// mailchimpActivity — Mailchimp Marketing API v3
//
// Credential: { apiKey } where apiKey carries the data-center suffix, e.g.
// "abc...-us21". Basic auth is used — username "anystring", password apiKey.
// =============================================================================

export interface MailchimpActivityInput {
  config: MailchimpConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    apiKey?: string;
  };
}

export interface MailchimpActivityOutput {
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
      message: `Mailchimp ${label}: invalid JSON — ${(err as Error).message}`,
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
      message: `Mailchimp: \`${label}\` is required`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  return val;
}

function md5Lower(s: string): string {
  return crypto.createHash("md5").update(s.toLowerCase()).digest("hex");
}

async function mcRequest(
  apiKey: string,
  method: string,
  path: string,
  body: unknown,
  operation: string,
): Promise<unknown> {
  const dash = apiKey.lastIndexOf("-");
  const dc = dash >= 0 ? apiKey.slice(dash + 1) : "";
  if (!dc) {
    throw ApplicationFailure.create({
      message:
        "Mailchimp: API key is missing the data-center suffix (expected e.g. `abc123-us21`).",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }
  const auth = Buffer.from(`anystring:${apiKey}`).toString("base64");
  const resp = await fetch(`https://${dc}.api.mailchimp.com/3.0${path}`, {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Basic ${auth}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw ApplicationFailure.create({
      message: `Mailchimp ${operation} failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
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
  if (!text) return { ok: true };
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function mailchimpActivity(
  input: MailchimpActivityInput,
): Promise<MailchimpActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const apiKey = resolvedCredentials?.apiKey;
  if (!apiKey) {
    throw ApplicationFailure.create({
      message:
        "Mailchimp credential is missing — supply `{ apiKey }` (must include `-<dc>` suffix).",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  const mergeFields = parseJson<Record<string, unknown>>(
    "mergeFields",
    cfg.mergeFields,
    context,
  );
  const tags = parseJson<string[]>("tags", cfg.tags, context);

  switch (cfg.operation) {
    case "lists.addMember": {
      const listId = mustString("listId", cfg.listId, context);
      const email = mustString("email", cfg.email, context);
      const body: Record<string, unknown> = {
        email_address: email,
        status: cfg.status ?? "subscribed",
      };
      if (mergeFields) body.merge_fields = mergeFields;
      if (tags) body.tags = tags;
      const result = await mcRequest(
        apiKey,
        "POST",
        `/lists/${encodeURIComponent(listId)}/members`,
        body,
        "lists.addMember",
      );
      return { ok: true, result };
    }
    case "lists.updateMember": {
      const listId = mustString("listId", cfg.listId, context);
      const email = mustString("email", cfg.email, context);
      const body: Record<string, unknown> = {};
      if (cfg.status) body.status = cfg.status;
      if (mergeFields) body.merge_fields = mergeFields;
      const result = await mcRequest(
        apiKey,
        "PATCH",
        `/lists/${encodeURIComponent(listId)}/members/${md5Lower(email)}`,
        body,
        "lists.updateMember",
      );
      return { ok: true, result };
    }
    case "lists.getMember": {
      const listId = mustString("listId", cfg.listId, context);
      const email = mustString("email", cfg.email, context);
      const result = await mcRequest(
        apiKey,
        "GET",
        `/lists/${encodeURIComponent(listId)}/members/${md5Lower(email)}`,
        undefined,
        "lists.getMember",
      );
      return { ok: true, result };
    }
    case "lists.deleteMember": {
      const listId = mustString("listId", cfg.listId, context);
      const email = mustString("email", cfg.email, context);
      const result = await mcRequest(
        apiKey,
        "DELETE",
        `/lists/${encodeURIComponent(listId)}/members/${md5Lower(email)}`,
        undefined,
        "lists.deleteMember",
      );
      return { ok: true, result };
    }
    case "lists.getMembers": {
      const listId = mustString("listId", cfg.listId, context);
      const count = Math.min(Math.max(cfg.count ?? 50, 1), 1000);
      const result = await mcRequest(
        apiKey,
        "GET",
        `/lists/${encodeURIComponent(listId)}/members?count=${count}`,
        undefined,
        "lists.getMembers",
      );
      return { ok: true, result };
    }
    case "campaigns.send": {
      const id = mustString("campaignId", cfg.campaignId, context);
      const result = await mcRequest(
        apiKey,
        "POST",
        `/campaigns/${encodeURIComponent(id)}/actions/send`,
        {},
        "campaigns.send",
      );
      return { ok: true, result };
    }
    case "campaigns.get": {
      const id = mustString("campaignId", cfg.campaignId, context);
      const result = await mcRequest(
        apiKey,
        "GET",
        `/campaigns/${encodeURIComponent(id)}`,
        undefined,
        "campaigns.get",
      );
      return { ok: true, result };
    }
    default:
      throw ApplicationFailure.create({
        message: `Unsupported Mailchimp operation: ${(cfg as { operation?: string }).operation}`,
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
  }
}
