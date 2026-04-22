import { ApplicationFailure } from "@temporalio/activity";
import crypto from "crypto";
import { interpolateTemplate } from "@workflow/shared";
import type { SquareConfig } from "@workflow/shared";

// =============================================================================
// squareActivity — Square Payments / Customers / Catalog
//
// Credential: { accessToken, environment? }. environment "sandbox" switches
// the host to connect.squareupsandbox.com.
// =============================================================================

export interface SquareActivityInput {
  config: SquareConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    accessToken?: string;
    environment?: string;
  };
}

export interface SquareActivityOutput {
  ok: boolean;
  result: unknown;
}

function mustString(
  label: string,
  raw: string | undefined,
  context: Record<string, unknown>,
): string {
  const val = raw ? interpolateTemplate(raw, context) : "";
  if (!val) {
    throw ApplicationFailure.create({
      message: `Square: \`${label}\` is required`,
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

async function squareRequest(
  host: string,
  token: string,
  method: string,
  path: string,
  body: unknown,
  operation: string,
): Promise<unknown> {
  const resp = await fetch(`${host}${path}`, {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      "square-version": "2024-10-17",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  if (!resp.ok) {
    const { type, nonRetryable } = errType(resp.status);
    throw ApplicationFailure.create({
      message: `Square ${operation} failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
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

export async function squareActivity(
  input: SquareActivityInput,
): Promise<SquareActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const token = resolvedCredentials?.accessToken;
  if (!token) {
    throw ApplicationFailure.create({
      message: "Square credential is missing — supply `{ accessToken }`.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }
  const env = (resolvedCredentials?.environment ?? "production").toLowerCase();
  const host =
    env === "sandbox"
      ? "https://connect.squareupsandbox.com"
      : "https://connect.squareup.com";

  const idempotencyKey = cfg.idempotencyKey
    ? interpolateTemplate(cfg.idempotencyKey, context)
    : crypto.randomUUID();

  switch (cfg.operation) {
    case "payments.create": {
      const amt = Number(
        interpolateTemplate(cfg.amountMinor ?? "0", context),
      );
      if (!Number.isFinite(amt) || amt <= 0) {
        throw ApplicationFailure.create({
          message:
            "Square payments.create: `amountMinor` must be a positive integer (smallest unit)",
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
      }
      const sourceId = mustString("sourceId", cfg.sourceId, context);
      const body: Record<string, unknown> = {
        source_id: sourceId,
        idempotency_key: idempotencyKey,
        amount_money: {
          amount: Math.round(amt),
          currency: (cfg.currency ?? "USD").toUpperCase(),
        },
        ...(cfg.note
          ? { note: interpolateTemplate(cfg.note, context) }
          : {}),
      };
      const result = await squareRequest(
        host,
        token,
        "POST",
        "/v2/payments",
        body,
        "payments.create",
      );
      return { ok: true, result };
    }
    case "payments.get": {
      const id = mustString("resourceId", cfg.resourceId, context);
      const result = await squareRequest(
        host,
        token,
        "GET",
        `/v2/payments/${encodeURIComponent(id)}`,
        undefined,
        "payments.get",
      );
      return { ok: true, result };
    }
    case "payments.list": {
      const limit = Math.min(Math.max(cfg.limit ?? 100, 1), 100);
      const result = await squareRequest(
        host,
        token,
        "GET",
        `/v2/payments?limit=${limit}`,
        undefined,
        "payments.list",
      );
      return { ok: true, result };
    }
    case "customers.create": {
      const body: Record<string, unknown> = {
        idempotency_key: idempotencyKey,
        ...(cfg.givenName
          ? { given_name: interpolateTemplate(cfg.givenName, context) }
          : {}),
        ...(cfg.familyName
          ? { family_name: interpolateTemplate(cfg.familyName, context) }
          : {}),
        ...(cfg.emailAddress
          ? { email_address: interpolateTemplate(cfg.emailAddress, context) }
          : {}),
        ...(cfg.phoneNumber
          ? { phone_number: interpolateTemplate(cfg.phoneNumber, context) }
          : {}),
      };
      const result = await squareRequest(
        host,
        token,
        "POST",
        "/v2/customers",
        body,
        "customers.create",
      );
      return { ok: true, result };
    }
    case "customers.list": {
      const limit = Math.min(Math.max(cfg.limit ?? 100, 1), 100);
      const result = await squareRequest(
        host,
        token,
        "GET",
        `/v2/customers?limit=${limit}`,
        undefined,
        "customers.list",
      );
      return { ok: true, result };
    }
    case "catalog.listItems": {
      const result = await squareRequest(
        host,
        token,
        "GET",
        `/v2/catalog/list?types=ITEM`,
        undefined,
        "catalog.listItems",
      );
      return { ok: true, result };
    }
    default:
      throw ApplicationFailure.create({
        message: `Unsupported Square operation: ${(cfg as { operation?: string }).operation}`,
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
  }
}
