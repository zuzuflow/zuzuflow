import axios from "axios";
import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { AzureFunctionsConfig } from "@workflow/shared";

export interface AzureFunctionsActivityInput {
  config: AzureFunctionsConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: { functionKey?: string };
}

export interface AzureFunctionsActivityOutput {
  result: unknown;
  ok: boolean;
}

/**
 * Azure Functions invocation — an auth'd HTTP request to the function URL.
 * When a credential with `functionKey` is attached, the key is appended as
 * `?code=<key>` (or `&code=<key>` if the URL already carries a querystring).
 * For anonymous functions or function URLs already embedding the code, leave
 * the credential empty.
 */
export async function azureFunctionsActivity(
  input: AzureFunctionsActivityInput,
): Promise<AzureFunctionsActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const baseUrl = interpolateTemplate(cfg.functionUrl, context);
  if (!baseUrl) {
    throw ApplicationFailure.create({
      message: "Azure Functions: `functionUrl` is required",
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }

  let url = baseUrl;
  const functionKey = resolvedCredentials?.functionKey;
  if (functionKey && !/[?&]code=/.test(url)) {
    url += (url.includes("?") ? "&" : "?") + `code=${encodeURIComponent(functionKey)}`;
  }

  const headers: Record<string, string> = {};
  for (const h of cfg.headers ?? []) {
    headers[interpolateTemplate(h.key, context)] = interpolateTemplate(
      h.value,
      context,
    );
  }

  let data: unknown = undefined;
  if (cfg.body) {
    const raw = interpolateTemplate(cfg.body, context);
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }

  try {
    const resp = await axios({
      method: cfg.method ?? "POST",
      url,
      headers,
      data,
      timeout: cfg.timeoutMs ?? 30_000,
      validateStatus: () => true,
    });
    const ok = resp.status >= 200 && resp.status < 300;
    if (!ok) {
      throw ApplicationFailure.create({
        message: `Azure Functions returned ${resp.status}`,
        type: "UPSTREAM_ERROR",
        nonRetryable: resp.status >= 400 && resp.status < 500,
        details: [{ status: resp.status, body: resp.data }],
      });
    }
    return {
      ok: true,
      result: {
        status: resp.status,
        headers: resp.headers as unknown,
        body: resp.data,
      },
    };
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    throw ApplicationFailure.create({
      message: `Azure Functions invocation failed: ${(err as Error).message}`,
      type: "UPSTREAM_ERROR",
      nonRetryable: false,
    });
  }
}
