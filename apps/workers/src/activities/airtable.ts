import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { AirtableConfig } from "@workflow/shared";

// =============================================================================
// airtableActivity — Airtable REST v0
//
// Credential: `{ apiKey }` (legacy key or PAT). Bearer auth.
// =============================================================================

export interface AirtableActivityInput {
  config: AirtableConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    apiKey?: string;
  };
}

export interface AirtableActivityOutput {
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
      message: `Airtable ${label}: invalid JSON — ${(err as Error).message}`,
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
      message: `Airtable: \`${label}\` is required`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  return val;
}

async function airtableRequest(
  apiKey: string,
  method: string,
  path: string,
  body: unknown,
  operation: string,
): Promise<unknown> {
  const resp = await fetch(`https://api.airtable.com${path}`, {
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
      message: `Airtable ${operation} failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
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

export async function airtableActivity(
  input: AirtableActivityInput,
): Promise<AirtableActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;

  const apiKey = resolvedCredentials?.apiKey;
  if (!apiKey) {
    throw ApplicationFailure.create({
      message: "Airtable credential is missing — supply `{ apiKey }`.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  const baseId = mustString("baseId", cfg.baseId, context);
  const table = mustString("table", cfg.table, context);

  switch (cfg.operation) {
    case "records.list": {
      const params = new URLSearchParams();
      const maxRecords = Math.min(Math.max(cfg.maxRecords ?? 100, 1), 100);
      params.set("maxRecords", String(maxRecords));
      if (cfg.filterByFormula) {
        const interp = interpolateTemplate(cfg.filterByFormula, context);
        if (interp.trim()) params.set("filterByFormula", interp);
      }
      if (cfg.view) params.set("view", cfg.view);
      const result = await airtableRequest(
        apiKey,
        "GET",
        `/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}?${params.toString()}`,
        undefined,
        "records.list",
      );
      return { ok: true, result };
    }

    case "records.get": {
      const id = mustString("recordId", cfg.recordId, context);
      const result = await airtableRequest(
        apiKey,
        "GET",
        `/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}/${encodeURIComponent(id)}`,
        undefined,
        "records.get",
      );
      return { ok: true, result };
    }

    case "records.create": {
      const fields = parseJson<Record<string, unknown>>(
        "fields",
        cfg.fields,
        context,
      );
      if (!fields) {
        throw ApplicationFailure.create({
          message: "Airtable records.create: `fields` JSON is required",
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
      }
      const result = await airtableRequest(
        apiKey,
        "POST",
        `/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}`,
        { fields },
        "records.create",
      );
      return { ok: true, result };
    }

    case "records.update": {
      const id = mustString("recordId", cfg.recordId, context);
      const fields = parseJson<Record<string, unknown>>(
        "fields",
        cfg.fields,
        context,
      );
      if (!fields) {
        throw ApplicationFailure.create({
          message: "Airtable records.update: `fields` JSON is required",
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
      }
      const result = await airtableRequest(
        apiKey,
        "PATCH",
        `/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}/${encodeURIComponent(id)}`,
        { fields },
        "records.update",
      );
      return { ok: true, result };
    }

    case "records.delete": {
      const id = mustString("recordId", cfg.recordId, context);
      const result = await airtableRequest(
        apiKey,
        "DELETE",
        `/v0/${encodeURIComponent(baseId)}/${encodeURIComponent(table)}/${encodeURIComponent(id)}`,
        undefined,
        "records.delete",
      );
      return { ok: true, result };
    }

    default:
      throw ApplicationFailure.create({
        message: `Unsupported Airtable operation: ${(cfg as { operation?: string }).operation}`,
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
  }
}
