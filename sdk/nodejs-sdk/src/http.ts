// =============================================================================
// Shared HTTP helper — every resource method routes through `request()`.
//
// - Prepends `${baseUrl}/api/env/${envSlug}` so callers only pass the
//   in-env suffix (e.g. "/workflows").
// - Encodes `query` from an object; array values are joined with commas
//   (matches the backend: `?tags=a,b`, `?tagsAll=a,b`).
// - Attaches `Authorization: Bearer ${token}` to every call.
// - Parses JSON and throws `HttpError` on non-2xx.
// =============================================================================

import { HttpError } from "./errors";

export interface HttpConfig {
  baseUrl: string;
  envSlug: string;
  token: string;
  fetchImpl: typeof fetch;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue | undefined>;
  /**
   * Per-call override for the env-slug path prefix. Lets a single client
   * target a different environment for one request (e.g. triggering a
   * workflow in "prod" from a client configured with "dev"). When omitted,
   * `cfg.envSlug` is used.
   */
  envSlug?: string;
}

type QueryValue = string | number | boolean | string[] | null;

function encodeQuery(query: Record<string, QueryValue | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      params.append(key, value.join(","));
    } else {
      params.append(key, String(value));
    }
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function envScopedPath(envSlug: string, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `/api/env/${encodeURIComponent(envSlug)}${normalized}`;
}

export async function request<T>(
  cfg: HttpConfig,
  path: string,
  opts: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, query, envSlug } = opts;
  const qs = query ? encodeQuery(query) : "";
  const url = `${cfg.baseUrl}${envScopedPath(envSlug ?? cfg.envSlug, path)}${qs}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.token}`,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await cfg.fetchImpl(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  if (!res.ok) {
    // Try to extract a structured `{ error, details? }` body; fall back to text.
    let parsedBody: unknown;
    let message = `HTTP ${res.status}`;
    try {
      const text = await res.text();
      try {
        parsedBody = JSON.parse(text);
        const err = (parsedBody as { error?: string })?.error;
        if (err) message = err;
      } catch {
        parsedBody = text;
        if (text) message = text;
      }
    } catch {
      /* ignore read error */
    }
    throw new HttpError(res.status, `${method} ${path} → ${res.status}: ${message}`, parsedBody);
  }

  // 2xx with a JSON body
  try {
    return (await res.json()) as T;
  } catch {
    return undefined as unknown as T;
  }
}
