import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate, interpolateObject } from "@workflow/shared";
import type { HttpRequestConfig } from "@workflow/shared";

// =============================================================================
// httpRequestActivity — performs an HTTP request with template interpolation
// =============================================================================

export interface HttpActivityInput {
  config: HttpRequestConfig;
  /** nodeOutputs context from the graph interpreter */
  context: Record<string, unknown>;
}

export interface HttpActivityOutput {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  ok: boolean;
}

export async function httpRequestActivity(
  input: HttpActivityInput
): Promise<HttpActivityOutput> {
  const { config: cfg, context } = input;

  // Interpolate URL and headers
  const url = interpolateTemplate(cfg.url, context);

  const headers: Record<string, string> = {};
  for (const h of cfg.headers ?? []) {
    headers[interpolateTemplate(h.key, context)] = interpolateTemplate(
      h.value,
      context
    );
  }

  // Interpolate query params
  const params: Record<string, string> = {};
  for (const qp of cfg.queryParams ?? []) {
    params[interpolateTemplate(qp.key, context)] = interpolateTemplate(
      qp.value,
      context
    );
  }

  // GraphQL mode: if graphqlQuery is set, compose the body as a GraphQL POST
  let data: unknown = undefined;
  if (cfg.graphqlQuery) {
    const interpolatedQuery = interpolateTemplate(cfg.graphqlQuery, context);
    const interpolatedVariables = cfg.graphqlVariables
      ? interpolateTemplate(cfg.graphqlVariables, context)
      : undefined;
    const interpolatedOpName = cfg.graphqlOperationName
      ? interpolateTemplate(cfg.graphqlOperationName, context)
      : undefined;

    // Force POST and JSON content type for GraphQL
    cfg.method = "POST";
    headers["Content-Type"] = "application/json";

    data = {
      query: interpolatedQuery,
      ...(interpolatedVariables
        ? { variables: JSON.parse(interpolatedVariables) }
        : {}),
      ...(interpolatedOpName ? { operationName: interpolatedOpName } : {}),
    };
  } else if (cfg.body) {
    // Interpolate body (standard mode)
    const interpolated = interpolateTemplate(cfg.body, context);
    try {
      data = JSON.parse(interpolated);
    } catch {
      // Not valid JSON after interpolation — send as raw string
      data = interpolated;
    }
  }

  const requestConfig: AxiosRequestConfig = {
    method: cfg.method,
    url,
    headers,
    params,
    data,
    timeout: cfg.timeoutMs ?? 30_000,
    // Never let axios throw on non-2xx so we can control the error ourselves
    validateStatus: () => true,
  };

  let response: AxiosResponse;
  try {
    response = await axios(requestConfig);
  } catch (err) {
    throw ApplicationFailure.create({
      message: `HTTP request failed: ${(err as Error).message}`,
      type: "HTTP_NETWORK_ERROR",
      nonRetryable: false,
    });
  }

  const ok = response.status >= 200 && response.status < 300;

  if (!ok && cfg.failOnError) {
    throw ApplicationFailure.create({
      message: `HTTP request to ${url} returned ${response.status}`,
      type: "HTTP_ERROR_STATUS",
      nonRetryable: response.status >= 400 && response.status < 500,
      details: [{ status: response.status, body: response.data }],
    });
  }

  // Flatten response headers
  const flatHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(response.headers)) {
    flatHeaders[key] = Array.isArray(value) ? value.join(", ") : String(value ?? "");
  }

  return {
    status: response.status,
    headers: flatHeaders,
    body: response.data,
    ok,
  };
}
