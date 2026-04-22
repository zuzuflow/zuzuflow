import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { LinearConfig } from "@workflow/shared";

// =============================================================================
// linearActivity — Linear GraphQL API
//
// Credential: { apiKey } — personal API key from linear.app/settings/api.
// Sent as Authorization: <apiKey> (NOT Bearer — Linear's convention).
// =============================================================================

export interface LinearActivityInput {
  config: LinearConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    apiKey?: string;
  };
}

export interface LinearActivityOutput {
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
      message: `Linear ${label}: invalid JSON — ${(err as Error).message}`,
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
      message: `Linear: \`${label}\` is required`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  return val;
}

async function linearGraphQL<T = unknown>(
  apiKey: string,
  query: string,
  variables: Record<string, unknown>,
  operation: string,
): Promise<T> {
  const resp = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw ApplicationFailure.create({
      message: `Linear ${operation} failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
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
  const body = JSON.parse(text) as {
    data?: T;
    errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
  };
  if (body.errors && body.errors.length > 0) {
    throw ApplicationFailure.create({
      message: `Linear ${operation} failed: ${body.errors
        .map((e) => e.message)
        .join("; ")}`,
      type: "UPSTREAM_ERROR",
      nonRetryable: false,
      details: [{ errors: body.errors, operation }],
    });
  }
  return body.data as T;
}

export async function linearActivity(
  input: LinearActivityInput,
): Promise<LinearActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const apiKey = resolvedCredentials?.apiKey;
  if (!apiKey) {
    throw ApplicationFailure.create({
      message: "Linear credential is missing — supply `{ apiKey }`.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  switch (cfg.operation) {
    case "issues.create": {
      const teamId = mustString("teamId", cfg.teamId, context);
      const title = mustString("title", cfg.title, context);
      const labelIds = splitCsv(cfg.labelIds, context);
      const variables: Record<string, unknown> = {
        input: {
          teamId,
          title,
          description: cfg.description
            ? interpolateTemplate(cfg.description, context)
            : undefined,
          priority: cfg.priority,
          stateId: cfg.stateId
            ? interpolateTemplate(cfg.stateId, context)
            : undefined,
          assigneeId: cfg.assigneeId
            ? interpolateTemplate(cfg.assigneeId, context)
            : undefined,
          labelIds,
        },
      };
      const data = await linearGraphQL<{
        issueCreate: { success: boolean; issue: unknown };
      }>(
        apiKey,
        `mutation IssueCreate($input: IssueCreateInput!) {
          issueCreate(input: $input) {
            success
            issue { id identifier title url state { id name } assignee { id name } createdAt }
          }
        }`,
        variables,
        "issues.create",
      );
      return { ok: true, result: data.issueCreate };
    }
    case "issues.get": {
      const id = mustString("issueId", cfg.issueId, context);
      const data = await linearGraphQL<{ issue: unknown }>(
        apiKey,
        `query IssueGet($id: String!) {
          issue(id: $id) {
            id identifier title description url priority state { id name type } assignee { id name } team { id name key } createdAt updatedAt
          }
        }`,
        { id },
        "issues.get",
      );
      return { ok: true, result: data.issue };
    }
    case "issues.update": {
      const id = mustString("issueId", cfg.issueId, context);
      const labelIds = splitCsv(cfg.labelIds, context);
      const variables: Record<string, unknown> = {
        id,
        input: {
          title: cfg.title ? interpolateTemplate(cfg.title, context) : undefined,
          description: cfg.description
            ? interpolateTemplate(cfg.description, context)
            : undefined,
          priority: cfg.priority,
          stateId: cfg.stateId
            ? interpolateTemplate(cfg.stateId, context)
            : undefined,
          assigneeId: cfg.assigneeId
            ? interpolateTemplate(cfg.assigneeId, context)
            : undefined,
          labelIds,
        },
      };
      const data = await linearGraphQL<{
        issueUpdate: { success: boolean; issue: unknown };
      }>(
        apiKey,
        `mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
          issueUpdate(id: $id, input: $input) {
            success
            issue { id identifier title url state { id name } updatedAt }
          }
        }`,
        variables,
        "issues.update",
      );
      return { ok: true, result: data.issueUpdate };
    }
    case "issues.list": {
      const filter = parseJson<Record<string, unknown>>(
        "filter",
        cfg.filter,
        context,
      );
      const first = Math.min(Math.max(cfg.first ?? 25, 1), 250);
      const data = await linearGraphQL<{
        issues: { nodes: unknown[]; pageInfo: unknown };
      }>(
        apiKey,
        `query IssuesList($filter: IssueFilter, $first: Int!) {
          issues(filter: $filter, first: $first) {
            nodes { id identifier title url state { id name } assignee { id name } priority createdAt }
            pageInfo { hasNextPage endCursor }
          }
        }`,
        { filter, first },
        "issues.list",
      );
      return { ok: true, result: data.issues };
    }
    case "issues.addComment": {
      const id = mustString("issueId", cfg.issueId, context);
      const body = mustString("comment", cfg.comment, context);
      const data = await linearGraphQL<{
        commentCreate: { success: boolean; comment: unknown };
      }>(
        apiKey,
        `mutation CommentCreate($input: CommentCreateInput!) {
          commentCreate(input: $input) {
            success
            comment { id body url createdAt }
          }
        }`,
        { input: { issueId: id, body } },
        "issues.addComment",
      );
      return { ok: true, result: data.commentCreate };
    }
    case "teams.list": {
      const data = await linearGraphQL<{
        teams: { nodes: unknown[] };
      }>(
        apiKey,
        `query TeamsList {
          teams(first: 100) { nodes { id name key description } }
        }`,
        {},
        "teams.list",
      );
      return { ok: true, result: data.teams };
    }
    default:
      throw ApplicationFailure.create({
        message: `Unsupported Linear operation: ${(cfg as { operation?: string }).operation}`,
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
  }
}
