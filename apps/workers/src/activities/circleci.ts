import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { CircleCIConfig } from "@workflow/shared";

// =============================================================================
// circleciActivity — CircleCI REST v2
//
// Credential: { token } — Personal API token sent via Circle-Token header.
// =============================================================================

export interface CircleCIActivityInput {
  config: CircleCIConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    token?: string;
  };
}

export interface CircleCIActivityOutput {
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
      message: `CircleCI ${label}: invalid JSON — ${(err as Error).message}`,
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
      message: `CircleCI: \`${label}\` is required`,
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

async function ccRequest(
  token: string,
  method: string,
  path: string,
  body: unknown,
  operation: string,
): Promise<unknown> {
  const resp = await fetch(`https://circleci.com/api/v2${path}`, {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "circle-token": token,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  if (!resp.ok) {
    const { type, nonRetryable } = errType(resp.status);
    throw ApplicationFailure.create({
      message: `CircleCI ${operation} failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
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

export async function circleciActivity(
  input: CircleCIActivityInput,
): Promise<CircleCIActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const token = resolvedCredentials?.token;
  if (!token) {
    throw ApplicationFailure.create({
      message: "CircleCI credential is missing — supply `{ token }`.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  switch (cfg.operation) {
    case "pipelines.trigger": {
      const slug = mustString("projectSlug", cfg.projectSlug, context);
      const body: Record<string, unknown> = {};
      if (cfg.branch) body.branch = interpolateTemplate(cfg.branch, context);
      else if (cfg.tag) body.tag = interpolateTemplate(cfg.tag, context);
      else body.branch = "main";
      const params = parseJson<Record<string, unknown>>(
        "parameters",
        cfg.parameters,
        context,
      );
      if (params) body.parameters = params;
      const result = await ccRequest(
        token,
        "POST",
        `/project/${slug.replace(/^\/+/, "")}/pipeline`,
        body,
        "pipelines.trigger",
      );
      return { ok: true, result };
    }
    case "pipelines.get": {
      const id = mustString("pipelineId", cfg.pipelineId, context);
      const result = await ccRequest(
        token,
        "GET",
        `/pipeline/${encodeURIComponent(id)}`,
        undefined,
        "pipelines.get",
      );
      return { ok: true, result };
    }
    case "pipelines.list": {
      const slug = mustString("projectSlug", cfg.projectSlug, context);
      const branchParam = cfg.branch
        ? `?branch=${encodeURIComponent(interpolateTemplate(cfg.branch, context))}`
        : "";
      const result = await ccRequest(
        token,
        "GET",
        `/project/${slug.replace(/^\/+/, "")}/pipeline${branchParam}`,
        undefined,
        "pipelines.list",
      );
      return { ok: true, result };
    }
    case "workflows.get": {
      const id = mustString("workflowId", cfg.workflowId, context);
      const result = await ccRequest(
        token,
        "GET",
        `/workflow/${encodeURIComponent(id)}`,
        undefined,
        "workflows.get",
      );
      return { ok: true, result };
    }
    case "workflows.cancel": {
      const id = mustString("workflowId", cfg.workflowId, context);
      const result = await ccRequest(
        token,
        "POST",
        `/workflow/${encodeURIComponent(id)}/cancel`,
        {},
        "workflows.cancel",
      );
      return { ok: true, result };
    }
    case "projects.get": {
      const slug = mustString("projectSlug", cfg.projectSlug, context);
      const result = await ccRequest(
        token,
        "GET",
        `/project/${slug.replace(/^\/+/, "")}`,
        undefined,
        "projects.get",
      );
      return { ok: true, result };
    }
    default:
      throw ApplicationFailure.create({
        message: `Unsupported CircleCI operation: ${(cfg as { operation?: string }).operation}`,
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
  }
}
