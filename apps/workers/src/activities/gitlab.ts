import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { GitlabConfig } from "@workflow/shared";

// =============================================================================
// gitlabActivity — GitLab REST v4
//
// Credential: { baseUrl?, token }. baseUrl defaults to https://gitlab.com.
// Token is sent via PRIVATE-TOKEN header (Personal / Project Access Token).
// =============================================================================

export interface GitlabActivityInput {
  config: GitlabConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    baseUrl?: string;
    token?: string;
  };
}

export interface GitlabActivityOutput {
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
      message: `GitLab ${label}: invalid JSON — ${(err as Error).message}`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
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
      message: `GitLab: \`${label}\` is required`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  return val;
}

async function gitlabRequest(
  baseUrl: string,
  token: string,
  method: string,
  path: string,
  body: unknown,
  operation: string,
): Promise<unknown> {
  const resp = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "private-token": token,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw ApplicationFailure.create({
      message: `GitLab ${operation} failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
      type:
        resp.status === 401 || resp.status === 403
          ? "AUTH_ERROR"
          : resp.status === 429
            ? "RATE_LIMITED"
            : resp.status === 404 || resp.status === 400
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

export async function gitlabActivity(
  input: GitlabActivityInput,
): Promise<GitlabActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const token = resolvedCredentials?.token;
  if (!token) {
    throw ApplicationFailure.create({
      message:
        "GitLab credential is missing — supply `{ token }` (Personal / Project Access Token).",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }
  const baseUrl = resolvedCredentials?.baseUrl ?? "https://gitlab.com";

  const resolveProject = () => {
    const raw = mustString("projectId", cfg.projectId, context);
    // Numeric ID stays as-is; "owner/repo" must be URL-encoded.
    return /^\d+$/.test(raw) ? raw : encodeURIComponent(raw);
  };

  switch (cfg.operation) {
    case "issues.create": {
      const project = resolveProject();
      const title = mustString("title", cfg.title, context);
      const body: Record<string, unknown> = { title };
      if (cfg.description)
        body.description = interpolateTemplate(cfg.description, context);
      const labels = splitCsv(cfg.labels, context);
      if (labels) body.labels = labels.join(",");
      const assignees = splitCsv(cfg.assigneeIds, context);
      if (assignees) body.assignee_ids = assignees.map((s) => Number(s));
      const result = await gitlabRequest(
        baseUrl,
        token,
        "POST",
        `/api/v4/projects/${project}/issues`,
        body,
        "issues.create",
      );
      return { ok: true, result };
    }
    case "issues.get": {
      const project = resolveProject();
      const iid = mustString("iid", cfg.iid, context);
      const result = await gitlabRequest(
        baseUrl,
        token,
        "GET",
        `/api/v4/projects/${project}/issues/${iid}`,
        undefined,
        "issues.get",
      );
      return { ok: true, result };
    }
    case "issues.update": {
      const project = resolveProject();
      const iid = mustString("iid", cfg.iid, context);
      const body: Record<string, unknown> = {};
      if (cfg.title) body.title = interpolateTemplate(cfg.title, context);
      if (cfg.description)
        body.description = interpolateTemplate(cfg.description, context);
      if (cfg.state === "closed") body.state_event = "close";
      else if (cfg.state === "opened") body.state_event = "reopen";
      const labels = splitCsv(cfg.labels, context);
      if (labels) body.labels = labels.join(",");
      const assignees = splitCsv(cfg.assigneeIds, context);
      if (assignees) body.assignee_ids = assignees.map((s) => Number(s));
      const result = await gitlabRequest(
        baseUrl,
        token,
        "PUT",
        `/api/v4/projects/${project}/issues/${iid}`,
        body,
        "issues.update",
      );
      return { ok: true, result };
    }
    case "issues.list": {
      const project = resolveProject();
      const params = new URLSearchParams();
      if (cfg.state && cfg.state !== "merged")
        params.set("state", cfg.state === "all" ? "all" : cfg.state);
      const labels = splitCsv(cfg.labels, context);
      if (labels) params.set("labels", labels.join(","));
      params.set("per_page", "100");
      const result = await gitlabRequest(
        baseUrl,
        token,
        "GET",
        `/api/v4/projects/${project}/issues?${params.toString()}`,
        undefined,
        "issues.list",
      );
      return { ok: true, result };
    }
    case "issues.addComment": {
      const project = resolveProject();
      const iid = mustString("iid", cfg.iid, context);
      const comment = mustString("comment", cfg.comment, context);
      const result = await gitlabRequest(
        baseUrl,
        token,
        "POST",
        `/api/v4/projects/${project}/issues/${iid}/notes`,
        { body: comment },
        "issues.addComment",
      );
      return { ok: true, result };
    }
    case "mergeRequests.create": {
      const project = resolveProject();
      const title = mustString("title", cfg.title, context);
      const source = mustString("sourceBranch", cfg.sourceBranch, context);
      const target = mustString("targetBranch", cfg.targetBranch, context);
      const body: Record<string, unknown> = {
        title,
        source_branch: source,
        target_branch: target,
      };
      if (cfg.description)
        body.description = interpolateTemplate(cfg.description, context);
      const labels = splitCsv(cfg.labels, context);
      if (labels) body.labels = labels.join(",");
      const assignees = splitCsv(cfg.assigneeIds, context);
      if (assignees) body.assignee_ids = assignees.map((s) => Number(s));
      const result = await gitlabRequest(
        baseUrl,
        token,
        "POST",
        `/api/v4/projects/${project}/merge_requests`,
        body,
        "mergeRequests.create",
      );
      return { ok: true, result };
    }
    case "mergeRequests.merge": {
      const project = resolveProject();
      const iid = mustString("iid", cfg.iid, context);
      const result = await gitlabRequest(
        baseUrl,
        token,
        "PUT",
        `/api/v4/projects/${project}/merge_requests/${iid}/merge`,
        {},
        "mergeRequests.merge",
      );
      return { ok: true, result };
    }
    case "mergeRequests.list": {
      const project = resolveProject();
      const params = new URLSearchParams();
      if (cfg.state) params.set("state", cfg.state);
      params.set("per_page", "100");
      const result = await gitlabRequest(
        baseUrl,
        token,
        "GET",
        `/api/v4/projects/${project}/merge_requests?${params.toString()}`,
        undefined,
        "mergeRequests.list",
      );
      return { ok: true, result };
    }
    case "pipelines.trigger": {
      const project = resolveProject();
      const ref = mustString("ref", cfg.ref, context);
      const vars = parseJson<Record<string, string>>(
        "variables",
        cfg.variables,
        context,
      );
      const body: Record<string, unknown> = { ref };
      if (vars) {
        body.variables = Object.entries(vars).map(([key, value]) => ({
          key,
          value,
        }));
      }
      const result = await gitlabRequest(
        baseUrl,
        token,
        "POST",
        `/api/v4/projects/${project}/pipeline`,
        body,
        "pipelines.trigger",
      );
      return { ok: true, result };
    }
    case "projects.get": {
      const project = resolveProject();
      const result = await gitlabRequest(
        baseUrl,
        token,
        "GET",
        `/api/v4/projects/${project}`,
        undefined,
        "projects.get",
      );
      return { ok: true, result };
    }
    default:
      throw ApplicationFailure.create({
        message: `Unsupported GitLab operation: ${(cfg as { operation?: string }).operation}`,
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
  }
}
