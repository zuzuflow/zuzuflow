import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { JiraConfig } from "@workflow/shared";

// =============================================================================
// jiraActivity — Jira Cloud REST v3
//
// Credential: { baseUrl, email, apiToken } — uses Basic auth with
// email:apiToken base64-encoded.
// =============================================================================

export interface JiraActivityInput {
  config: JiraConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    baseUrl?: string;
    email?: string;
    apiToken?: string;
  };
}

export interface JiraActivityOutput {
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
      message: `Jira ${label}: invalid JSON — ${(err as Error).message}`,
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
      message: `Jira: \`${label}\` is required`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  return val;
}

async function jiraRequest(
  baseUrl: string,
  email: string,
  apiToken: string,
  method: string,
  path: string,
  body: unknown,
  operation: string,
): Promise<unknown> {
  const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const resp = await fetch(url, {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Basic ${auth}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw ApplicationFailure.create({
      message: `Jira ${operation} failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
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
        resp.status === 404 ||
        resp.status === 400,
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

export async function jiraActivity(
  input: JiraActivityInput,
): Promise<JiraActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;

  const { baseUrl, email, apiToken } = resolvedCredentials ?? {};
  if (!baseUrl || !email || !apiToken) {
    throw ApplicationFailure.create({
      message:
        "Jira credential is missing — supply `{ baseUrl, email, apiToken }`.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  switch (cfg.operation) {
    case "issues.create": {
      const projectKey = mustString("projectKey", cfg.projectKey, context);
      const issueType = mustString("issueType", cfg.issueType, context);
      const summary = mustString("summary", cfg.summary, context);
      const description = cfg.description
        ? interpolateTemplate(cfg.description, context)
        : undefined;
      const labels = splitCsv(cfg.labels, context);
      const assignee = cfg.assigneeAccountId
        ? {
            accountId: interpolateTemplate(cfg.assigneeAccountId, context),
          }
        : undefined;
      const extra = parseJson<Record<string, unknown>>(
        "extraFields",
        cfg.extraFields,
        context,
      );
      const fields: Record<string, unknown> = {
        project: { key: projectKey },
        issuetype: { name: issueType },
        summary,
        ...(description
          ? {
              description: {
                type: "doc",
                version: 1,
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: description }],
                  },
                ],
              },
            }
          : {}),
        ...(labels ? { labels } : {}),
        ...(assignee ? { assignee } : {}),
        ...(extra ?? {}),
      };
      const result = await jiraRequest(
        baseUrl,
        email,
        apiToken,
        "POST",
        "/rest/api/3/issue",
        { fields },
        "issues.create",
      );
      return { ok: true, result };
    }

    case "issues.get": {
      const key = mustString("issueKey", cfg.issueKey, context);
      const result = await jiraRequest(
        baseUrl,
        email,
        apiToken,
        "GET",
        `/rest/api/3/issue/${encodeURIComponent(key)}`,
        undefined,
        "issues.get",
      );
      return { ok: true, result };
    }

    case "issues.update": {
      const key = mustString("issueKey", cfg.issueKey, context);
      const fields: Record<string, unknown> = {};
      if (cfg.summary) fields.summary = interpolateTemplate(cfg.summary, context);
      if (cfg.assigneeAccountId)
        fields.assignee = {
          accountId: interpolateTemplate(cfg.assigneeAccountId, context),
        };
      const labels = splitCsv(cfg.labels, context);
      if (labels) fields.labels = labels;
      const extra = parseJson<Record<string, unknown>>(
        "extraFields",
        cfg.extraFields,
        context,
      );
      Object.assign(fields, extra ?? {});
      await jiraRequest(
        baseUrl,
        email,
        apiToken,
        "PUT",
        `/rest/api/3/issue/${encodeURIComponent(key)}`,
        { fields },
        "issues.update",
      );
      return { ok: true, result: { updated: true, issueKey: key } };
    }

    case "issues.transition": {
      const key = mustString("issueKey", cfg.issueKey, context);
      const transitionId = mustString(
        "transitionId",
        cfg.transitionId,
        context,
      );
      await jiraRequest(
        baseUrl,
        email,
        apiToken,
        "POST",
        `/rest/api/3/issue/${encodeURIComponent(key)}/transitions`,
        { transition: { id: transitionId } },
        "issues.transition",
      );
      return { ok: true, result: { transitioned: true, issueKey: key } };
    }

    case "issues.addComment": {
      const key = mustString("issueKey", cfg.issueKey, context);
      const comment = mustString("comment", cfg.comment, context);
      const result = await jiraRequest(
        baseUrl,
        email,
        apiToken,
        "POST",
        `/rest/api/3/issue/${encodeURIComponent(key)}/comment`,
        {
          body: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: comment }],
              },
            ],
          },
        },
        "issues.addComment",
      );
      return { ok: true, result };
    }

    case "issues.search": {
      const jql = mustString("jql", cfg.jql, context);
      const maxResults = Math.min(Math.max(cfg.maxResults ?? 50, 1), 100);
      const fields = cfg.fields
        ? interpolateTemplate(cfg.fields, context).split(",").map((s) => s.trim())
        : ["*all"];
      const result = await jiraRequest(
        baseUrl,
        email,
        apiToken,
        "POST",
        "/rest/api/3/search",
        { jql, maxResults, fields },
        "issues.search",
      );
      return { ok: true, result };
    }

    default:
      throw ApplicationFailure.create({
        message: `Unsupported Jira operation: ${(cfg as { operation?: string }).operation}`,
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
  }
}
