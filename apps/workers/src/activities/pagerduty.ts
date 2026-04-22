import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { PagerDutyConfig } from "@workflow/shared";

// =============================================================================
// pagerdutyActivity — PagerDuty Events API v2 + REST API
//
// Credential shapes:
//   - Events API (trigger/ack/resolve): { routingKey }
//   - REST API   (incidents.*):          { apiToken }
// =============================================================================

export interface PagerDutyActivityInput {
  config: PagerDutyConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    routingKey?: string;
    apiToken?: string;
  };
}

export interface PagerDutyActivityOutput {
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
      message: `PagerDuty ${label}: invalid JSON — ${(err as Error).message}`,
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
      message: `PagerDuty: \`${label}\` is required`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  return val;
}

async function pdFetch(
  url: string,
  init: RequestInit,
  operation: string,
): Promise<unknown> {
  const resp = await fetch(url, init);
  const text = await resp.text();
  if (!resp.ok) {
    throw ApplicationFailure.create({
      message: `PagerDuty ${operation} failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
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

export async function pagerdutyActivity(
  input: PagerDutyActivityInput,
): Promise<PagerDutyActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const { routingKey, apiToken } = resolvedCredentials ?? {};

  switch (cfg.operation) {
    case "events.trigger": {
      if (!routingKey) {
        throw ApplicationFailure.create({
          message:
            "PagerDuty events.trigger: credential must provide `{ routingKey }`.",
          type: "AUTH_ERROR",
          nonRetryable: true,
        });
      }
      const summary = mustString("summary", cfg.summary, context);
      const source = cfg.source
        ? interpolateTemplate(cfg.source, context)
        : "workflow";
      const severity = cfg.severity ?? "error";
      const dedupKey = cfg.dedupKey
        ? interpolateTemplate(cfg.dedupKey, context)
        : undefined;
      const customDetails = parseJson<Record<string, unknown>>(
        "customDetails",
        cfg.customDetails,
        context,
      );
      const result = await pdFetch(
        "https://events.pagerduty.com/v2/enqueue",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            routing_key: routingKey,
            event_action: "trigger",
            ...(dedupKey ? { dedup_key: dedupKey } : {}),
            payload: {
              summary,
              source,
              severity,
              ...(customDetails ? { custom_details: customDetails } : {}),
            },
          }),
        },
        "events.trigger",
      );
      return { ok: true, result };
    }

    case "events.acknowledge":
    case "events.resolve": {
      if (!routingKey) {
        throw ApplicationFailure.create({
          message: `PagerDuty ${cfg.operation}: credential must provide \`{ routingKey }\`.`,
          type: "AUTH_ERROR",
          nonRetryable: true,
        });
      }
      const dedupKey = mustString("dedupKey", cfg.dedupKey, context);
      const action =
        cfg.operation === "events.acknowledge" ? "acknowledge" : "resolve";
      const result = await pdFetch(
        "https://events.pagerduty.com/v2/enqueue",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            routing_key: routingKey,
            event_action: action,
            dedup_key: dedupKey,
          }),
        },
        cfg.operation,
      );
      return { ok: true, result };
    }

    case "incidents.create": {
      if (!apiToken) {
        throw ApplicationFailure.create({
          message:
            "PagerDuty incidents.create: credential must provide `{ apiToken }`.",
          type: "AUTH_ERROR",
          nonRetryable: true,
        });
      }
      const title = mustString("summary", cfg.summary, context);
      const serviceId = mustString("serviceId", cfg.serviceId, context);
      const userEmail = mustString("userEmail", cfg.userEmail, context);
      const epId = cfg.escalationPolicyId
        ? interpolateTemplate(cfg.escalationPolicyId, context)
        : undefined;
      const body = {
        incident: {
          type: "incident",
          title,
          service: { id: serviceId, type: "service_reference" },
          ...(epId
            ? {
                escalation_policy: {
                  id: epId,
                  type: "escalation_policy_reference",
                },
              }
            : {}),
        },
      };
      const result = await pdFetch(
        "https://api.pagerduty.com/incidents",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/vnd.pagerduty+json;version=2",
            authorization: `Token token=${apiToken}`,
            from: userEmail,
          },
          body: JSON.stringify(body),
        },
        "incidents.create",
      );
      return { ok: true, result };
    }

    case "incidents.list": {
      if (!apiToken) {
        throw ApplicationFailure.create({
          message:
            "PagerDuty incidents.list: credential must provide `{ apiToken }`.",
          type: "AUTH_ERROR",
          nonRetryable: true,
        });
      }
      const params = new URLSearchParams();
      const limit = Math.min(Math.max(cfg.limit ?? 25, 1), 100);
      params.set("limit", String(limit));
      if (cfg.statusFilter)
        params.set("statuses[]", cfg.statusFilter);
      const result = await pdFetch(
        `https://api.pagerduty.com/incidents?${params.toString()}`,
        {
          method: "GET",
          headers: {
            accept: "application/vnd.pagerduty+json;version=2",
            authorization: `Token token=${apiToken}`,
          },
        },
        "incidents.list",
      );
      return { ok: true, result };
    }

    default:
      throw ApplicationFailure.create({
        message: `Unsupported PagerDuty operation: ${(cfg as { operation?: string }).operation}`,
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
  }
}
