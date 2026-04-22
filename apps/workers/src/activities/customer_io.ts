import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { CustomerIoConfig } from "@workflow/shared";

// =============================================================================
// customerIoActivity — Customer.io Track API + App API
//
// Credential:
//   - Track API (identify/track/delete): { siteId, apiKey, region? }
//     region "eu" routes to track-eu.customer.io. Basic auth.
//   - App API (sendTransactional): { appApiKey, region? }
//     region "eu" routes to api-eu.customer.io. Bearer auth.
// =============================================================================

export interface CustomerIoActivityInput {
  config: CustomerIoConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    siteId?: string;
    apiKey?: string;
    appApiKey?: string;
    region?: string;
  };
}

export interface CustomerIoActivityOutput {
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
      message: `Customer.io ${label}: invalid JSON — ${(err as Error).message}`,
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
      message: `Customer.io: \`${label}\` is required`,
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
  if (status === 400 || status === 404)
    return { type: "VALIDATION_ERROR", nonRetryable: true };
  return { type: "UPSTREAM_ERROR", nonRetryable: false };
}

async function cioFetch(
  url: string,
  init: RequestInit,
  operation: string,
): Promise<unknown> {
  const resp = await fetch(url, init);
  const text = await resp.text();
  if (!resp.ok) {
    const { type, nonRetryable } = errType(resp.status);
    throw ApplicationFailure.create({
      message: `Customer.io ${operation} failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
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

export async function customerIoActivity(
  input: CustomerIoActivityInput,
): Promise<CustomerIoActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const region = (resolvedCredentials?.region ?? "us").toLowerCase();
  const trackHost =
    region === "eu"
      ? "https://track-eu.customer.io"
      : "https://track.customer.io";
  const appHost =
    region === "eu" ? "https://api-eu.customer.io" : "https://api.customer.io";

  const data = parseJson<Record<string, unknown>>("data", cfg.data, context);
  const attributes = parseJson<Record<string, unknown>>(
    "attributes",
    cfg.attributes,
    context,
  );

  switch (cfg.operation) {
    case "identify": {
      const siteId = resolvedCredentials?.siteId;
      const apiKey = resolvedCredentials?.apiKey;
      if (!siteId || !apiKey) {
        throw ApplicationFailure.create({
          message:
            "Customer.io identify: credential must provide `{ siteId, apiKey }`.",
          type: "AUTH_ERROR",
          nonRetryable: true,
        });
      }
      const customerId = mustString("customerId", cfg.customerId, context);
      const auth = Buffer.from(`${siteId}:${apiKey}`).toString("base64");
      const result = await cioFetch(
        `${trackHost}/api/v1/customers/${encodeURIComponent(customerId)}`,
        {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            authorization: `Basic ${auth}`,
          },
          body: JSON.stringify(attributes ?? {}),
        },
        "identify",
      );
      return { ok: true, result };
    }
    case "track": {
      const siteId = resolvedCredentials?.siteId;
      const apiKey = resolvedCredentials?.apiKey;
      if (!siteId || !apiKey) {
        throw ApplicationFailure.create({
          message:
            "Customer.io track: credential must provide `{ siteId, apiKey }`.",
          type: "AUTH_ERROR",
          nonRetryable: true,
        });
      }
      const customerId = mustString("customerId", cfg.customerId, context);
      const eventName = mustString("eventName", cfg.eventName, context);
      const auth = Buffer.from(`${siteId}:${apiKey}`).toString("base64");
      const result = await cioFetch(
        `${trackHost}/api/v1/customers/${encodeURIComponent(customerId)}/events`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Basic ${auth}`,
          },
          body: JSON.stringify({
            name: eventName,
            ...(data ? { data } : {}),
          }),
        },
        "track",
      );
      return { ok: true, result };
    }
    case "deleteCustomer": {
      const siteId = resolvedCredentials?.siteId;
      const apiKey = resolvedCredentials?.apiKey;
      if (!siteId || !apiKey) {
        throw ApplicationFailure.create({
          message:
            "Customer.io deleteCustomer: credential must provide `{ siteId, apiKey }`.",
          type: "AUTH_ERROR",
          nonRetryable: true,
        });
      }
      const customerId = mustString("customerId", cfg.customerId, context);
      const auth = Buffer.from(`${siteId}:${apiKey}`).toString("base64");
      const result = await cioFetch(
        `${trackHost}/api/v1/customers/${encodeURIComponent(customerId)}`,
        {
          method: "DELETE",
          headers: { authorization: `Basic ${auth}` },
        },
        "deleteCustomer",
      );
      return { ok: true, result };
    }
    case "sendTransactional": {
      const appApiKey = resolvedCredentials?.appApiKey;
      if (!appApiKey) {
        throw ApplicationFailure.create({
          message:
            "Customer.io sendTransactional: credential must provide `{ appApiKey }`.",
          type: "AUTH_ERROR",
          nonRetryable: true,
        });
      }
      const transactionalId = mustString(
        "transactionalId",
        cfg.transactionalId,
        context,
      );
      const body: Record<string, unknown> = {
        transactional_message_id: transactionalId,
      };
      if (cfg.to) body.to = interpolateTemplate(cfg.to, context);
      if (cfg.identifierType && cfg.identifierValue) {
        body.identifiers = {
          [cfg.identifierType]: interpolateTemplate(cfg.identifierValue, context),
        };
      }
      if (data) body.message_data = data;
      const result = await cioFetch(
        `${appHost}/v1/send/email`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${appApiKey}`,
          },
          body: JSON.stringify(body),
        },
        "sendTransactional",
      );
      return { ok: true, result };
    }
    default:
      throw ApplicationFailure.create({
        message: `Unsupported Customer.io operation: ${(cfg as { operation?: string }).operation}`,
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
  }
}
