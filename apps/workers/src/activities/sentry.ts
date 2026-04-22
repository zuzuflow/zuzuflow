import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { SentryConfig } from "@workflow/shared";

// =============================================================================
// sentryActivity — Sentry Store API (events) + REST API (issues)
//
// Two credential shapes depending on the operation:
//   - events.captureMessage / events.captureException: { dsn } — the project
//     DSN URL (contains public key + project ID).
//   - issues.list / issues.resolve: { authToken, organizationSlug, projectSlug }
//     — internal integration / auth token for the REST API.
// =============================================================================

export interface SentryActivityInput {
  config: SentryConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    dsn?: string;
    authToken?: string;
    organizationSlug?: string;
    projectSlug?: string;
  };
}

export interface SentryActivityOutput {
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
      message: `Sentry ${label}: invalid JSON — ${(err as Error).message}`,
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
      message: `Sentry: \`${label}\` is required`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  return val;
}

interface ParsedDsn {
  host: string;
  projectId: string;
  publicKey: string;
  protocol: string;
  path: string;
}

function parseDsn(dsn: string): ParsedDsn {
  // e.g. "https://abc123@o0.ingest.sentry.io/1234567"
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
    if (!projectId) throw new Error("missing project ID in DSN path");
    return {
      host: u.host,
      projectId,
      publicKey: u.username,
      protocol: u.protocol.replace(/:$/, ""),
      path: u.pathname.replace(/\/\d+\/?$/, ""),
    };
  } catch (err) {
    throw ApplicationFailure.create({
      message: `Sentry: invalid DSN — ${(err as Error).message}`,
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }
}

async function sentryStoreEvent(
  dsn: string,
  payload: Record<string, unknown>,
  operation: string,
): Promise<unknown> {
  const parsed = parseDsn(dsn);
  const url = `${parsed.protocol}://${parsed.host}${parsed.path}/api/${parsed.projectId}/store/`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${parsed.publicKey}, sentry_client=zuzuflow/1.0`,
    },
    body: JSON.stringify(payload),
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw ApplicationFailure.create({
      message: `Sentry ${operation} failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
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
    return { raw: text };
  }
}

async function sentryApi(
  token: string,
  method: string,
  path: string,
  body: unknown,
  operation: string,
): Promise<unknown> {
  const resp = await fetch(`https://sentry.io/api/0${path}`, {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw ApplicationFailure.create({
      message: `Sentry ${operation} failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
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

export async function sentryActivity(
  input: SentryActivityInput,
): Promise<SentryActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;

  switch (cfg.operation) {
    case "events.captureMessage":
    case "events.captureException": {
      const dsn = resolvedCredentials?.dsn;
      if (!dsn) {
        throw ApplicationFailure.create({
          message: `Sentry ${cfg.operation}: credential must provide \`{ dsn }\`.`,
          type: "AUTH_ERROR",
          nonRetryable: true,
        });
      }
      const tags = parseJson<Record<string, string>>(
        "tags",
        cfg.tags,
        context,
      );
      const extra = parseJson<Record<string, unknown>>(
        "extra",
        cfg.extra,
        context,
      );
      const payload: Record<string, unknown> = {
        timestamp: Math.floor(Date.now() / 1000),
        platform: "node",
        level: cfg.level ?? "error",
        ...(cfg.environment
          ? { environment: interpolateTemplate(cfg.environment, context) }
          : {}),
        ...(cfg.release
          ? { release: interpolateTemplate(cfg.release, context) }
          : {}),
        ...(tags ? { tags } : {}),
        ...(extra ? { extra } : {}),
      };
      if (cfg.operation === "events.captureMessage") {
        payload.message = mustString("message", cfg.message, context);
      } else {
        const type = mustString(
          "exceptionType",
          cfg.exceptionType,
          context,
        );
        const value = mustString(
          "exceptionValue",
          cfg.exceptionValue,
          context,
        );
        payload.exception = { values: [{ type, value }] };
        if (cfg.message) {
          payload.message = interpolateTemplate(cfg.message, context);
        }
      }
      const result = await sentryStoreEvent(dsn, payload, cfg.operation);
      return { ok: true, result };
    }
    case "issues.list": {
      const token = resolvedCredentials?.authToken;
      const org = resolvedCredentials?.organizationSlug;
      const project = resolvedCredentials?.projectSlug;
      if (!token || !org || !project) {
        throw ApplicationFailure.create({
          message:
            "Sentry issues.list: credential must provide `{ authToken, organizationSlug, projectSlug }`.",
          type: "AUTH_ERROR",
          nonRetryable: true,
        });
      }
      const params = new URLSearchParams();
      const limit = Math.min(Math.max(cfg.limit ?? 25, 1), 100);
      params.set("limit", String(limit));
      if (cfg.query)
        params.set("query", interpolateTemplate(cfg.query, context));
      const result = await sentryApi(
        token,
        "GET",
        `/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/issues/?${params.toString()}`,
        undefined,
        "issues.list",
      );
      return { ok: true, result };
    }
    case "issues.resolve": {
      const token = resolvedCredentials?.authToken;
      const org = resolvedCredentials?.organizationSlug;
      if (!token || !org) {
        throw ApplicationFailure.create({
          message:
            "Sentry issues.resolve: credential must provide `{ authToken, organizationSlug }`.",
          type: "AUTH_ERROR",
          nonRetryable: true,
        });
      }
      const issueId = mustString("issueId", cfg.issueId, context);
      const result = await sentryApi(
        token,
        "PUT",
        `/organizations/${encodeURIComponent(org)}/issues/?id=${encodeURIComponent(issueId)}`,
        { status: "resolved" },
        "issues.resolve",
      );
      return { ok: true, result };
    }
    default:
      throw ApplicationFailure.create({
        message: `Unsupported Sentry operation: ${(cfg as { operation?: string }).operation}`,
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
  }
}
