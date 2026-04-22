import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { HubspotConfig } from "@workflow/shared";

// =============================================================================
// hubspotActivity — HubSpot CRM v3 REST
//
// Credential: `{ privateAppToken }` (Bearer) OR `{ apiKey }` (legacy, sent as
// ?hapikey=).
// =============================================================================

export interface HubspotActivityInput {
  config: HubspotConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    privateAppToken?: string;
    apiKey?: string;
  };
}

export interface HubspotActivityOutput {
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
      message: `HubSpot ${label}: invalid JSON — ${(err as Error).message}`,
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
      message: `HubSpot: \`${label}\` is required`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  return val;
}

async function hubspotRequest(
  token: string | undefined,
  apiKey: string | undefined,
  method: string,
  path: string,
  body: unknown,
  operation: string,
): Promise<unknown> {
  if (!token && !apiKey) {
    throw ApplicationFailure.create({
      message:
        "HubSpot credential is missing — supply `{ privateAppToken }` or `{ apiKey }`.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }
  let url = `https://api.hubapi.com${path}`;
  if (!token && apiKey) {
    url += `${path.includes("?") ? "&" : "?"}hapikey=${encodeURIComponent(apiKey)}`;
  }
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
  };
  if (token) headers.authorization = `Bearer ${token}`;
  const resp = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw ApplicationFailure.create({
      message: `HubSpot ${operation} failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
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

function objectType(op: string): "contacts" | "companies" | "deals" {
  if (op.startsWith("contacts")) return "contacts";
  if (op.startsWith("companies")) return "companies";
  return "deals";
}

export async function hubspotActivity(
  input: HubspotActivityInput,
): Promise<HubspotActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const token = resolvedCredentials?.privateAppToken;
  const apiKey = resolvedCredentials?.apiKey;

  const type = objectType(cfg.operation);
  const properties = parseJson<Record<string, unknown>>(
    "properties",
    cfg.properties,
    context,
  );
  const associations = parseJson<unknown[]>(
    "associations",
    cfg.associations,
    context,
  );

  switch (cfg.operation) {
    case "contacts.create":
    case "companies.create":
    case "deals.create": {
      if (!properties) {
        throw ApplicationFailure.create({
          message: `HubSpot ${cfg.operation}: \`properties\` JSON is required`,
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
      }
      const body: Record<string, unknown> = { properties };
      if (associations) body.associations = associations;
      const result = await hubspotRequest(
        token,
        apiKey,
        "POST",
        `/crm/v3/objects/${type}`,
        body,
        cfg.operation,
      );
      return { ok: true, result };
    }

    case "contacts.update":
    case "companies.update":
    case "deals.update": {
      const id = mustString("objectId", cfg.objectId, context);
      if (!properties) {
        throw ApplicationFailure.create({
          message: `HubSpot ${cfg.operation}: \`properties\` JSON is required`,
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
      }
      const result = await hubspotRequest(
        token,
        apiKey,
        "PATCH",
        `/crm/v3/objects/${type}/${encodeURIComponent(id)}`,
        { properties },
        cfg.operation,
      );
      return { ok: true, result };
    }

    case "contacts.get":
    case "companies.get":
    case "deals.get": {
      const id = mustString("objectId", cfg.objectId, context);
      const result = await hubspotRequest(
        token,
        apiKey,
        "GET",
        `/crm/v3/objects/${type}/${encodeURIComponent(id)}`,
        undefined,
        cfg.operation,
      );
      return { ok: true, result };
    }

    case "contacts.searchByEmail": {
      const email = mustString("email", cfg.email, context);
      const result = await hubspotRequest(
        token,
        apiKey,
        "POST",
        "/crm/v3/objects/contacts/search",
        {
          filterGroups: [
            {
              filters: [
                {
                  propertyName: "email",
                  operator: "EQ",
                  value: email,
                },
              ],
            },
          ],
          properties: ["email", "firstname", "lastname", "phone", "company"],
          limit: 10,
        },
        "contacts.searchByEmail",
      );
      return { ok: true, result };
    }

    default:
      throw ApplicationFailure.create({
        message: `Unsupported HubSpot operation: ${(cfg as { operation?: string }).operation}`,
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
  }
}
