import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { OneDriveConfig } from "@workflow/shared";

// =============================================================================
// onedriveActivity — Microsoft OneDrive via Graph API v1.0
//
// Credential: { accessToken } — OAuth bearer with Files.ReadWrite scope.
// =============================================================================

export interface OneDriveActivityInput {
  config: OneDriveConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    accessToken?: string;
  };
}

export interface OneDriveActivityOutput {
  ok: boolean;
  result: unknown;
}

function mustOneOf(
  labels: string[],
  values: Array<string | undefined>,
): string {
  const found = values.find((v) => v && v.trim());
  if (!found) {
    throw ApplicationFailure.create({
      message: `OneDrive: one of \`${labels.join(" | ")}\` is required`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  return found;
}

function normalizePath(p: string): string {
  return p.startsWith("/") ? p : `/${p}`;
}

function errType(status: number): { type: string; nonRetryable: boolean } {
  if (status === 401 || status === 403)
    return { type: "AUTH_ERROR", nonRetryable: true };
  if (status === 429) return { type: "RATE_LIMITED", nonRetryable: false };
  if (status === 400 || status === 404 || status === 409)
    return { type: "VALIDATION_ERROR", nonRetryable: true };
  return { type: "UPSTREAM_ERROR", nonRetryable: false };
}

async function graphFetch(
  accessToken: string,
  method: string,
  path: string,
  body: unknown,
  operation: string,
  contentType = "application/json",
): Promise<unknown> {
  const headers: Record<string, string> = {
    accept: "application/json",
    authorization: `Bearer ${accessToken}`,
  };
  if (body !== undefined) headers["content-type"] = contentType;
  const resp = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method,
    headers,
    body:
      body === undefined
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
  });
  const text = await resp.text();
  if (!resp.ok) {
    const { type, nonRetryable } = errType(resp.status);
    throw ApplicationFailure.create({
      message: `OneDrive ${operation} failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
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

function itemSelector(
  cfg: OneDriveConfig,
  context: Record<string, unknown>,
): string {
  if (cfg.itemId) {
    return `/me/drive/items/${encodeURIComponent(interpolateTemplate(cfg.itemId, context))}`;
  }
  if (cfg.path) {
    const p = normalizePath(interpolateTemplate(cfg.path, context));
    return `/me/drive/root:${p}`;
  }
  throw ApplicationFailure.create({
    message: "OneDrive: either `itemId` or `path` is required.",
    type: "VALIDATION_ERROR",
    nonRetryable: true,
  });
}

export async function onedriveActivity(
  input: OneDriveActivityInput,
): Promise<OneDriveActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const accessToken = resolvedCredentials?.accessToken;
  if (!accessToken) {
    throw ApplicationFailure.create({
      message: "OneDrive credential is missing — supply `{ accessToken }`.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  switch (cfg.operation) {
    case "files.list": {
      const parent = cfg.parentPath
        ? interpolateTemplate(cfg.parentPath, context)
        : "";
      const path = parent
        ? `/me/drive/root:${normalizePath(parent)}:/children`
        : `/me/drive/root/children`;
      const result = await graphFetch(
        accessToken,
        "GET",
        path,
        undefined,
        "files.list",
      );
      return { ok: true, result };
    }
    case "files.get": {
      const path = itemSelector(cfg, context);
      const result = await graphFetch(
        accessToken,
        "GET",
        path,
        undefined,
        "files.get",
      );
      return { ok: true, result };
    }
    case "files.upload": {
      const name = mustOneOf(
        ["name"],
        [cfg.name ? interpolateTemplate(cfg.name, context) : undefined],
      );
      const parent = cfg.parentPath
        ? interpolateTemplate(cfg.parentPath, context)
        : "";
      const uploadPath = parent
        ? `/me/drive/root:${normalizePath(parent)}/${encodeURIComponent(name)}:/content`
        : `/me/drive/root:/${encodeURIComponent(name)}:/content`;
      const content = cfg.content ? interpolateTemplate(cfg.content, context) : "";
      const result = await graphFetch(
        accessToken,
        "PUT",
        uploadPath,
        content,
        "files.upload",
        cfg.contentType ?? "text/plain",
      );
      return { ok: true, result };
    }
    case "files.delete": {
      const path = itemSelector(cfg, context);
      await graphFetch(
        accessToken,
        "DELETE",
        path,
        undefined,
        "files.delete",
      );
      return {
        ok: true,
        result: { deleted: true, itemId: cfg.itemId, path: cfg.path },
      };
    }
    case "files.createShareLink": {
      const path = `${itemSelector(cfg, context)}/createLink`;
      const result = await graphFetch(
        accessToken,
        "POST",
        path,
        {
          type: cfg.linkType ?? "view",
          scope: cfg.linkScope ?? "anonymous",
        },
        "files.createShareLink",
      );
      return { ok: true, result };
    }
    default:
      throw ApplicationFailure.create({
        message: `Unsupported OneDrive operation: ${(cfg as { operation?: string }).operation}`,
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
  }
}
