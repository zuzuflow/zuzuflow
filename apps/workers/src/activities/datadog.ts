import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { DatadogConfig } from "@workflow/shared";

// =============================================================================
// datadogActivity — Datadog metrics / events / logs submission
//
// Credential: { apiKey, appKey?, site? }. site defaults to "datadoghq.com"
// (set to "datadoghq.eu", "us3.datadoghq.com", etc. for other DD sites).
// =============================================================================

export interface DatadogActivityInput {
  config: DatadogConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    apiKey?: string;
    appKey?: string;
    site?: string;
  };
}

export interface DatadogActivityOutput {
  ok: boolean;
  result: unknown;
}

function splitCsv(
  raw: string | undefined,
  context: Record<string, unknown>,
): string[] | undefined {
  if (!raw) return undefined;
  const interp = interpolateTemplate(raw, context);
  if (!interp.trim()) return undefined;
  return interp
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function mustString(
  label: string,
  raw: string | undefined,
  context: Record<string, unknown>,
): string {
  const val = raw ? interpolateTemplate(raw, context) : "";
  if (!val) {
    throw ApplicationFailure.create({
      message: `Datadog: \`${label}\` is required`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  return val;
}

async function ddFetch(
  url: string,
  init: RequestInit,
  operation: string,
): Promise<unknown> {
  const resp = await fetch(url, init);
  const text = await resp.text();
  if (!resp.ok) {
    throw ApplicationFailure.create({
      message: `Datadog ${operation} failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
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

export async function datadogActivity(
  input: DatadogActivityInput,
): Promise<DatadogActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const apiKey = resolvedCredentials?.apiKey;
  if (!apiKey) {
    throw ApplicationFailure.create({
      message: "Datadog credential is missing — supply `{ apiKey }`.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }
  const site = (resolvedCredentials?.site ?? "datadoghq.com").replace(
    /^https?:\/\//,
    "",
  );
  const tags = splitCsv(cfg.tags, context);

  switch (cfg.operation) {
    case "metrics.submit": {
      const metric = mustString("metricName", cfg.metricName, context);
      const valRaw = mustString("metricValue", cfg.metricValue, context);
      const value = Number(valRaw);
      if (!Number.isFinite(value)) {
        throw ApplicationFailure.create({
          message: `Datadog metrics.submit: \`metricValue\` must be a finite number (got "${valRaw}")`,
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
      }
      const now = Math.floor(Date.now() / 1000);
      // v2 series payload.
      const type =
        cfg.metricType === "count"
          ? 1
          : cfg.metricType === "rate"
            ? 2
            : cfg.metricType === "gauge"
              ? 3
              : 0;
      const result = await ddFetch(
        `https://api.${site}/api/v2/series`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "dd-api-key": apiKey,
          },
          body: JSON.stringify({
            series: [
              {
                metric,
                type,
                points: [{ timestamp: now, value }],
                tags,
              },
            ],
          }),
        },
        "metrics.submit",
      );
      return { ok: true, result };
    }
    case "events.post": {
      const title = mustString("title", cfg.title, context);
      const text = mustString("text", cfg.text, context);
      const result = await ddFetch(
        `https://api.${site}/api/v1/events`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "dd-api-key": apiKey,
          },
          body: JSON.stringify({
            title,
            text,
            alert_type: cfg.alertType ?? "info",
            tags,
            source_type_name: cfg.source,
          }),
        },
        "events.post",
      );
      return { ok: true, result };
    }
    case "logs.submit": {
      const text = mustString("text", cfg.text, context);
      const service = cfg.service
        ? interpolateTemplate(cfg.service, context)
        : "workflow";
      const host = cfg.host ? interpolateTemplate(cfg.host, context) : undefined;
      const result = await ddFetch(
        `https://http-intake.logs.${site}/api/v2/logs`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "dd-api-key": apiKey,
          },
          body: JSON.stringify([
            {
              message: text,
              ddsource: cfg.source ?? "zuzuflow",
              ddtags: tags ? tags.join(",") : undefined,
              service,
              status: cfg.logStatus ?? "info",
              ...(host ? { host } : {}),
              ...(cfg.title ? { title: interpolateTemplate(cfg.title, context) } : {}),
            },
          ]),
        },
        "logs.submit",
      );
      return { ok: true, result };
    }
    default:
      throw ApplicationFailure.create({
        message: `Unsupported Datadog operation: ${(cfg as { operation?: string }).operation}`,
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
  }
}
