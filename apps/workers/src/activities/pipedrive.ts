import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { PipedriveConfig } from "@workflow/shared";

// =============================================================================
// pipedriveActivity — Pipedrive v1 REST
//
// Credential: { apiToken, companyDomain }. companyDomain = the subdomain
// part of <companyDomain>.pipedrive.com. Token is appended as ?api_token=
// per Pipedrive's convention.
// =============================================================================

export interface PipedriveActivityInput {
  config: PipedriveConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    apiToken?: string;
    companyDomain?: string;
  };
}

export interface PipedriveActivityOutput {
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
      message: `Pipedrive ${label}: invalid JSON — ${(err as Error).message}`,
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
      message: `Pipedrive: \`${label}\` is required`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  return val;
}

function errType(status: number): { type: string; nonRetryable: boolean } {
  if (status === 401 || status === 403)
    return { type: "AUTH_ERROR", nonRetryable: true };
  if (status === 429) return { type: "RATE_LIMITED", nonRetryable: false };
  if (status === 400 || status === 404 || status === 422)
    return { type: "VALIDATION_ERROR", nonRetryable: true };
  return { type: "UPSTREAM_ERROR", nonRetryable: false };
}

async function pdRequest(
  domain: string,
  apiToken: string,
  method: string,
  path: string,
  body: unknown,
  operation: string,
  extraParams?: Record<string, string>,
): Promise<unknown> {
  const params = new URLSearchParams({ api_token: apiToken, ...(extraParams ?? {}) });
  const url = `https://${domain}.pipedrive.com/api/v1${path}${path.includes("?") ? "&" : "?"}${params.toString()}`;
  const resp = await fetch(url, {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  if (!resp.ok) {
    const { type, nonRetryable } = errType(resp.status);
    throw ApplicationFailure.create({
      message: `Pipedrive ${operation} failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
      type,
      nonRetryable,
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

export async function pipedriveActivity(
  input: PipedriveActivityInput,
): Promise<PipedriveActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const apiToken = resolvedCredentials?.apiToken;
  const domain = resolvedCredentials?.companyDomain;
  if (!apiToken || !domain) {
    throw ApplicationFailure.create({
      message:
        "Pipedrive credential is missing — supply `{ apiToken, companyDomain }`.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  const body = parseJson<Record<string, unknown>>("body", cfg.body, context);

  switch (cfg.operation) {
    case "deals.create":
    case "persons.create":
    case "activities.create": {
      if (!body) {
        throw ApplicationFailure.create({
          message: `Pipedrive ${cfg.operation}: \`body\` JSON is required`,
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
      }
      const endpoint =
        cfg.operation === "deals.create"
          ? "/deals"
          : cfg.operation === "persons.create"
            ? "/persons"
            : "/activities";
      const result = await pdRequest(
        domain,
        apiToken,
        "POST",
        endpoint,
        body,
        cfg.operation,
      );
      return { ok: true, result };
    }
    case "deals.update":
    case "persons.update": {
      const id = mustString("objectId", cfg.objectId, context);
      if (!body) {
        throw ApplicationFailure.create({
          message: `Pipedrive ${cfg.operation}: \`body\` JSON is required`,
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
      }
      const endpoint = cfg.operation === "deals.update" ? "/deals" : "/persons";
      const result = await pdRequest(
        domain,
        apiToken,
        "PUT",
        `${endpoint}/${encodeURIComponent(id)}`,
        body,
        cfg.operation,
      );
      return { ok: true, result };
    }
    case "deals.get":
    case "persons.get": {
      const id = mustString("objectId", cfg.objectId, context);
      const endpoint = cfg.operation === "deals.get" ? "/deals" : "/persons";
      const result = await pdRequest(
        domain,
        apiToken,
        "GET",
        `${endpoint}/${encodeURIComponent(id)}`,
        undefined,
        cfg.operation,
      );
      return { ok: true, result };
    }
    case "deals.list": {
      const limit = Math.min(Math.max(cfg.limit ?? 100, 1), 500);
      const start = Math.max(cfg.start ?? 0, 0);
      const result = await pdRequest(
        domain,
        apiToken,
        "GET",
        "/deals",
        undefined,
        "deals.list",
        { limit: String(limit), start: String(start) },
      );
      return { ok: true, result };
    }
    case "persons.search": {
      const term = mustString("searchTerm", cfg.searchTerm, context);
      const fields = cfg.searchFields ?? "name,email,phone";
      const result = await pdRequest(
        domain,
        apiToken,
        "GET",
        "/persons/search",
        undefined,
        "persons.search",
        { term, fields, limit: String(cfg.limit ?? 100) },
      );
      return { ok: true, result };
    }
    default:
      throw ApplicationFailure.create({
        message: `Unsupported Pipedrive operation: ${(cfg as { operation?: string }).operation}`,
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
  }
}
