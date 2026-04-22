import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { ShopifyConfig } from "@workflow/shared";

// =============================================================================
// shopifyActivity — Shopify Admin REST
//
// Credential: { shopDomain, accessToken } — shopDomain like
// "mystore.myshopify.com" (no https://). Uses X-Shopify-Access-Token.
// =============================================================================

export interface ShopifyActivityInput {
  config: ShopifyConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    shopDomain?: string;
    accessToken?: string;
  };
}

export interface ShopifyActivityOutput {
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
      message: `Shopify ${label}: invalid JSON — ${(err as Error).message}`,
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
      message: `Shopify: \`${label}\` is required`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  return val;
}

async function shopifyRequest(
  shopDomain: string,
  accessToken: string,
  apiVersion: string,
  method: string,
  path: string,
  body: unknown,
  operation: string,
): Promise<unknown> {
  const url = `https://${shopDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}/admin/api/${apiVersion}${path}`;
  const resp = await fetch(url, {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-shopify-access-token": accessToken,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw ApplicationFailure.create({
      message: `Shopify ${operation} failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
      type:
        resp.status === 401 || resp.status === 403
          ? "AUTH_ERROR"
          : resp.status === 429
            ? "RATE_LIMITED"
            : resp.status === 400 || resp.status === 404 || resp.status === 422
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

function buildQuery(
  cfg: ShopifyConfig,
  context: Record<string, unknown>,
): string {
  const params = new URLSearchParams();
  const q = parseJson<Record<string, unknown>>("queryParams", cfg.queryParams, context);
  if (q) {
    for (const [k, v] of Object.entries(q)) {
      params.set(k, String(v));
    }
  }
  if (cfg.limit) params.set("limit", String(Math.min(Math.max(cfg.limit, 1), 250)));
  const s = params.toString();
  return s ? `?${s}` : "";
}

export async function shopifyActivity(
  input: ShopifyActivityInput,
): Promise<ShopifyActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const shopDomain = resolvedCredentials?.shopDomain;
  const accessToken = resolvedCredentials?.accessToken;
  if (!shopDomain || !accessToken) {
    throw ApplicationFailure.create({
      message:
        "Shopify credential is missing — supply `{ shopDomain, accessToken }`.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }
  const apiVersion = cfg.apiVersion ?? "2024-10";

  switch (cfg.operation) {
    case "orders.list": {
      const result = await shopifyRequest(
        shopDomain,
        accessToken,
        apiVersion,
        "GET",
        `/orders.json${buildQuery(cfg, context)}`,
        undefined,
        "orders.list",
      );
      return { ok: true, result };
    }
    case "orders.get": {
      const id = mustString("objectId", cfg.objectId, context);
      const result = await shopifyRequest(
        shopDomain,
        accessToken,
        apiVersion,
        "GET",
        `/orders/${encodeURIComponent(id)}.json`,
        undefined,
        "orders.get",
      );
      return { ok: true, result };
    }
    case "orders.cancel": {
      const id = mustString("objectId", cfg.objectId, context);
      const result = await shopifyRequest(
        shopDomain,
        accessToken,
        apiVersion,
        "POST",
        `/orders/${encodeURIComponent(id)}/cancel.json`,
        {},
        "orders.cancel",
      );
      return { ok: true, result };
    }
    case "products.list": {
      const result = await shopifyRequest(
        shopDomain,
        accessToken,
        apiVersion,
        "GET",
        `/products.json${buildQuery(cfg, context)}`,
        undefined,
        "products.list",
      );
      return { ok: true, result };
    }
    case "products.get": {
      const id = mustString("objectId", cfg.objectId, context);
      const result = await shopifyRequest(
        shopDomain,
        accessToken,
        apiVersion,
        "GET",
        `/products/${encodeURIComponent(id)}.json`,
        undefined,
        "products.get",
      );
      return { ok: true, result };
    }
    case "products.create": {
      const body = parseJson<Record<string, unknown>>("body", cfg.body, context);
      if (!body) {
        throw ApplicationFailure.create({
          message:
            "Shopify products.create: `body` must be a JSON object (e.g. `{\"title\":\"...\"}`).",
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
      }
      const result = await shopifyRequest(
        shopDomain,
        accessToken,
        apiVersion,
        "POST",
        `/products.json`,
        { product: body },
        "products.create",
      );
      return { ok: true, result };
    }
    case "products.update": {
      const id = mustString("objectId", cfg.objectId, context);
      const body = parseJson<Record<string, unknown>>("body", cfg.body, context);
      if (!body) {
        throw ApplicationFailure.create({
          message: "Shopify products.update: `body` JSON is required",
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
      }
      const result = await shopifyRequest(
        shopDomain,
        accessToken,
        apiVersion,
        "PUT",
        `/products/${encodeURIComponent(id)}.json`,
        { product: { id: Number(id), ...body } },
        "products.update",
      );
      return { ok: true, result };
    }
    case "customers.list": {
      const result = await shopifyRequest(
        shopDomain,
        accessToken,
        apiVersion,
        "GET",
        `/customers.json${buildQuery(cfg, context)}`,
        undefined,
        "customers.list",
      );
      return { ok: true, result };
    }
    case "customers.get": {
      const id = mustString("objectId", cfg.objectId, context);
      const result = await shopifyRequest(
        shopDomain,
        accessToken,
        apiVersion,
        "GET",
        `/customers/${encodeURIComponent(id)}.json`,
        undefined,
        "customers.get",
      );
      return { ok: true, result };
    }
    case "inventory.adjust": {
      const itemId = mustString("inventoryItemId", cfg.inventoryItemId, context);
      const locId = mustString("locationId", cfg.locationId, context);
      const adjust = Number(interpolateTemplate(cfg.adjustBy ?? "0", context));
      if (!Number.isFinite(adjust) || adjust === 0) {
        throw ApplicationFailure.create({
          message:
            "Shopify inventory.adjust: `adjustBy` must be a non-zero number",
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
      }
      const result = await shopifyRequest(
        shopDomain,
        accessToken,
        apiVersion,
        "POST",
        `/inventory_levels/adjust.json`,
        {
          inventory_item_id: Number(itemId),
          location_id: Number(locId),
          available_adjustment: Math.round(adjust),
        },
        "inventory.adjust",
      );
      return { ok: true, result };
    }
    default:
      throw ApplicationFailure.create({
        message: `Unsupported Shopify operation: ${(cfg as { operation?: string }).operation}`,
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
  }
}
