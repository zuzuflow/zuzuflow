import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { GithubConfig } from "@workflow/shared";

// =============================================================================
// githubActivity — GitHub REST via Octokit
//
// Uses `@octokit/rest` (lazy-imported). Expects a decrypted credential payload
// of `{ token: "ghp_..." | "github_pat_..." }`.
// =============================================================================

export interface GithubActivityInput {
  config: GithubConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    token?: string;
  };
}

export interface GithubActivityOutput {
  ok: boolean;
  result: unknown;
}

function parseJson(
  label: string,
  raw: string | undefined,
  context: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  const interp = interpolateTemplate(raw, context);
  if (!interp.trim()) return undefined;
  try {
    return JSON.parse(interp) as Record<string, unknown>;
  } catch (err) {
    throw ApplicationFailure.create({
      message: `GitHub ${label}: invalid JSON — ${(err as Error).message}`,
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
      message: `GitHub: \`${label}\` is required`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  return val;
}

export async function githubActivity(
  input: GithubActivityInput,
): Promise<GithubActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;

  const token = resolvedCredentials?.token;
  if (!token) {
    throw ApplicationFailure.create({
      message:
        "GitHub credential is missing — supply `{ token: \"ghp_...\" }` in the stored credential.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  const { Octokit } = await import("@octokit/rest");
  const octokit = new Octokit({ auth: token });

  try {
    switch (cfg.operation) {
      case "issues.create": {
        const owner = mustString("owner", cfg.owner, context);
        const repo = mustString("repo", cfg.repo, context);
        const title = mustString("title", cfg.title, context);
        const resp = await octokit.rest.issues.create({
          owner,
          repo,
          title,
          body: cfg.body ? interpolateTemplate(cfg.body, context) : undefined,
          labels: splitCsv(cfg.labels, context),
          assignees: splitCsv(cfg.assignees, context),
        });
        return { ok: true, result: resp.data as unknown };
      }

      case "issues.update": {
        const owner = mustString("owner", cfg.owner, context);
        const repo = mustString("repo", cfg.repo, context);
        const num = Number(mustString("number", cfg.number, context));
        const resp = await octokit.rest.issues.update({
          owner,
          repo,
          issue_number: num,
          title: cfg.title ? interpolateTemplate(cfg.title, context) : undefined,
          body: cfg.body ? interpolateTemplate(cfg.body, context) : undefined,
          state:
            cfg.state === "open" || cfg.state === "closed"
              ? cfg.state
              : undefined,
          labels: splitCsv(cfg.labels, context),
          assignees: splitCsv(cfg.assignees, context),
        });
        return { ok: true, result: resp.data as unknown };
      }

      case "issues.get": {
        const owner = mustString("owner", cfg.owner, context);
        const repo = mustString("repo", cfg.repo, context);
        const num = Number(mustString("number", cfg.number, context));
        const resp = await octokit.rest.issues.get({
          owner,
          repo,
          issue_number: num,
        });
        return { ok: true, result: resp.data as unknown };
      }

      case "issues.list": {
        const owner = mustString("owner", cfg.owner, context);
        const repo = mustString("repo", cfg.repo, context);
        const resp = await octokit.rest.issues.listForRepo({
          owner,
          repo,
          state: cfg.state ?? "open",
          per_page: 100,
        });
        return { ok: true, result: resp.data as unknown };
      }

      case "issues.createComment": {
        const owner = mustString("owner", cfg.owner, context);
        const repo = mustString("repo", cfg.repo, context);
        const num = Number(mustString("number", cfg.number, context));
        const body = mustString("body", cfg.body, context);
        const resp = await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: num,
          body,
        });
        return { ok: true, result: resp.data as unknown };
      }

      case "pulls.create": {
        const owner = mustString("owner", cfg.owner, context);
        const repo = mustString("repo", cfg.repo, context);
        const title = mustString("title", cfg.title, context);
        const head = mustString("head", cfg.head, context);
        const base = mustString("base", cfg.base, context);
        const resp = await octokit.rest.pulls.create({
          owner,
          repo,
          title,
          head,
          base,
          body: cfg.body ? interpolateTemplate(cfg.body, context) : undefined,
        });
        return { ok: true, result: resp.data as unknown };
      }

      case "pulls.merge": {
        const owner = mustString("owner", cfg.owner, context);
        const repo = mustString("repo", cfg.repo, context);
        const num = Number(mustString("number", cfg.number, context));
        const resp = await octokit.rest.pulls.merge({
          owner,
          repo,
          pull_number: num,
        });
        return { ok: true, result: resp.data as unknown };
      }

      case "pulls.list": {
        const owner = mustString("owner", cfg.owner, context);
        const repo = mustString("repo", cfg.repo, context);
        const resp = await octokit.rest.pulls.list({
          owner,
          repo,
          state: cfg.state ?? "open",
          per_page: 100,
        });
        return { ok: true, result: resp.data as unknown };
      }

      case "repos.get": {
        const owner = mustString("owner", cfg.owner, context);
        const repo = mustString("repo", cfg.repo, context);
        const resp = await octokit.rest.repos.get({ owner, repo });
        return { ok: true, result: resp.data as unknown };
      }

      case "repos.listForAuthenticatedUser": {
        const resp = await octokit.rest.repos.listForAuthenticatedUser({
          per_page: 100,
        });
        return { ok: true, result: resp.data as unknown };
      }

      case "repos.createDispatchEvent": {
        const owner = mustString("owner", cfg.owner, context);
        const repo = mustString("repo", cfg.repo, context);
        const eventType = mustString("eventType", cfg.eventType, context);
        const clientPayload = parseJson(
          "clientPayload",
          cfg.clientPayload,
          context,
        );
        await octokit.rest.repos.createDispatchEvent({
          owner,
          repo,
          event_type: eventType,
          client_payload: clientPayload,
        });
        return { ok: true, result: { dispatched: true, eventType } };
      }

      case "actions.createWorkflowDispatch": {
        const owner = mustString("owner", cfg.owner, context);
        const repo = mustString("repo", cfg.repo, context);
        const workflowId = mustString("workflowId", cfg.workflowId, context);
        const ref = mustString("ref", cfg.ref, context);
        const inputs = parseJson("inputs", cfg.inputs, context) as
          | Record<string, string>
          | undefined;
        await octokit.rest.actions.createWorkflowDispatch({
          owner,
          repo,
          workflow_id: workflowId,
          ref,
          inputs,
        });
        return {
          ok: true,
          result: { dispatched: true, workflowId, ref },
        };
      }

      default:
        throw ApplicationFailure.create({
          message: `Unsupported GitHub operation: ${(cfg as { operation?: string }).operation}`,
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
    }
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    const e = err as { status?: number; message?: string };
    const status = e.status ?? 0;
    const retriable = status === 0 || status === 429 || status >= 500;
    throw ApplicationFailure.create({
      message: `GitHub ${cfg.operation} failed: ${e.message ?? String(err)}`,
      type:
        status === 401 || status === 403
          ? "AUTH_ERROR"
          : status === 404 || status === 422
            ? "VALIDATION_ERROR"
            : status === 429
              ? "RATE_LIMITED"
              : "UPSTREAM_ERROR",
      nonRetryable: !retriable,
      details: [{ status, operation: cfg.operation }],
    });
  }
}
