import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { PaypalConfig } from "@workflow/shared";

// =============================================================================
// paypalActivity — PayPal REST v2 (Orders / Payments)
//
// Credential: { clientId, clientSecret, environment? }. environment "sandbox"
// switches the host to api.sandbox.paypal.com. The activity fetches an access
// token on each invocation (client-credentials grant) — fine for low volume;
// move to a token cache if you hit rate-limits.
// =============================================================================

export interface PaypalActivityInput {
  config: PaypalConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    clientId?: string;
    clientSecret?: string;
    environment?: string;
  };
}

export interface PaypalActivityOutput {
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
      message: `PayPal ${label}: invalid JSON — ${(err as Error).message}`,
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
      message: `PayPal: \`${label}\` is required`,
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

async function getAccessToken(
  host: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const resp = await fetch(`${host}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${auth}`,
    },
    body: "grant_type=client_credentials",
  });
  const text = await resp.text();
  if (!resp.ok) {
    const { type, nonRetryable } = errType(resp.status);
    throw ApplicationFailure.create({
      message: `PayPal oauth2 failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
      type,
      nonRetryable,
      details: [{ status: resp.status, operation: "oauth2" }],
    });
  }
  const body = JSON.parse(text) as { access_token?: string };
  if (!body.access_token) {
    throw ApplicationFailure.create({
      message: "PayPal oauth2: response missing access_token",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }
  return body.access_token;
}

async function paypalRequest(
  host: string,
  token: string,
  method: string,
  path: string,
  body: unknown,
  operation: string,
  idempotencyKey?: string,
): Promise<unknown> {
  const headers: Record<string, string> = {
    accept: "application/json",
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
  };
  if (idempotencyKey) headers["paypal-request-id"] = idempotencyKey;
  const resp = await fetch(`${host}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  if (!resp.ok) {
    const { type, nonRetryable } = errType(resp.status);
    throw ApplicationFailure.create({
      message: `PayPal ${operation} failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
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

export async function paypalActivity(
  input: PaypalActivityInput,
): Promise<PaypalActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const clientId = resolvedCredentials?.clientId;
  const clientSecret = resolvedCredentials?.clientSecret;
  if (!clientId || !clientSecret) {
    throw ApplicationFailure.create({
      message:
        "PayPal credential is missing — supply `{ clientId, clientSecret, environment? }`.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }
  const env = (resolvedCredentials?.environment ?? "live").toLowerCase();
  const host =
    env === "sandbox"
      ? "https://api-m.sandbox.paypal.com"
      : "https://api-m.paypal.com";
  const token = await getAccessToken(host, clientId, clientSecret);
  const idempotencyKey = cfg.idempotencyKey
    ? interpolateTemplate(cfg.idempotencyKey, context)
    : undefined;
  const extra = parseJson<Record<string, unknown>>(
    "extraParams",
    cfg.extraParams,
    context,
  );

  switch (cfg.operation) {
    case "orders.create": {
      const amount = mustString("amount", cfg.amount, context);
      const currency = (cfg.currency ?? "USD").toUpperCase();
      const body: Record<string, unknown> = {
        intent: cfg.intent ?? "CAPTURE",
        purchase_units: [
          {
            amount: { currency_code: currency, value: amount },
            ...(cfg.description
              ? { description: interpolateTemplate(cfg.description, context) }
              : {}),
          },
        ],
        ...(extra ?? {}),
      };
      const result = await paypalRequest(
        host,
        token,
        "POST",
        "/v2/checkout/orders",
        body,
        "orders.create",
        idempotencyKey,
      );
      return { ok: true, result };
    }
    case "orders.get": {
      const id = mustString("resourceId", cfg.resourceId, context);
      const result = await paypalRequest(
        host,
        token,
        "GET",
        `/v2/checkout/orders/${encodeURIComponent(id)}`,
        undefined,
        "orders.get",
      );
      return { ok: true, result };
    }
    case "orders.capture": {
      const id = mustString("resourceId", cfg.resourceId, context);
      const result = await paypalRequest(
        host,
        token,
        "POST",
        `/v2/checkout/orders/${encodeURIComponent(id)}/capture`,
        {},
        "orders.capture",
        idempotencyKey,
      );
      return { ok: true, result };
    }
    case "payments.captureAuthorization": {
      const id = mustString("resourceId", cfg.resourceId, context);
      const body: Record<string, unknown> = {};
      if (cfg.amount) {
        body.amount = {
          currency_code: (cfg.currency ?? "USD").toUpperCase(),
          value: interpolateTemplate(cfg.amount, context),
        };
      }
      const result = await paypalRequest(
        host,
        token,
        "POST",
        `/v2/payments/authorizations/${encodeURIComponent(id)}/capture`,
        body,
        "payments.captureAuthorization",
        idempotencyKey,
      );
      return { ok: true, result };
    }
    case "payments.refund": {
      const id = mustString("resourceId", cfg.resourceId, context);
      const body: Record<string, unknown> = {};
      if (cfg.amount) {
        body.amount = {
          currency_code: (cfg.currency ?? "USD").toUpperCase(),
          value: interpolateTemplate(cfg.amount, context),
        };
      }
      const result = await paypalRequest(
        host,
        token,
        "POST",
        `/v2/payments/captures/${encodeURIComponent(id)}/refund`,
        body,
        "payments.refund",
        idempotencyKey,
      );
      return { ok: true, result };
    }
    default:
      throw ApplicationFailure.create({
        message: `Unsupported PayPal operation: ${(cfg as { operation?: string }).operation}`,
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
  }
}
