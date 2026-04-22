import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { DropboxConfig } from "@workflow/shared";

// =============================================================================
// dropboxActivity — Dropbox API v2 (content + RPC endpoints)
//
// Credential: { accessToken } — Bearer token.
// =============================================================================

export interface DropboxActivityInput {
  config: DropboxConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    accessToken?: string;
  };
}

export interface DropboxActivityOutput {
  ok: boolean;
  result: unknown;
}

function mustString(
  label: string,
  raw: string | undefined,
  context: Record<string, unknown>,
): string {
  const val = raw ? interpolateTemplate(raw, context) : "";
  if (!val) {
    throw ApplicationFailure.create({
      message: `Dropbox: \`${label}\` is required`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  return val;
}

function normalizePath(p: string): string {
  return p.startsWith("/") ? p : `/${p}`;
}

function errorTypeFor(status: number): {
  type: string;
  nonRetryable: boolean;
} {
  if (status === 401 || status === 403)
    return { type: "AUTH_ERROR", nonRetryable: true };
  if (status === 429) return { type: "RATE_LIMITED", nonRetryable: false };
  if (status === 400 || status === 404 || status === 409)
    return { type: "VALIDATION_ERROR", nonRetryable: true };
  return { type: "UPSTREAM_ERROR", nonRetryable: false };
}

async function dropboxRpc(
  accessToken: string,
  path: string,
  body: unknown,
  operation: string,
): Promise<unknown> {
  const resp = await fetch(`https://api.dropboxapi.com${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  if (!resp.ok) {
    const { type, nonRetryable } = errorTypeFor(resp.status);
    throw ApplicationFailure.create({
      message: `Dropbox ${operation} failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
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

async function dropboxContentUpload(
  accessToken: string,
  dropboxApiArg: Record<string, unknown>,
  body: string,
  operation: string,
): Promise<unknown> {
  const resp = await fetch("https://content.dropboxapi.com/2/files/upload", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/octet-stream",
      "dropbox-api-arg": JSON.stringify(dropboxApiArg),
    },
    body,
  });
  const text = await resp.text();
  if (!resp.ok) {
    const { type, nonRetryable } = errorTypeFor(resp.status);
    throw ApplicationFailure.create({
      message: `Dropbox ${operation} failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
      type,
      nonRetryable,
      details: [{ status: resp.status, operation }],
    });
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function dropboxContentDownload(
  accessToken: string,
  dropboxApiArg: Record<string, unknown>,
  operation: string,
): Promise<{ metadata: unknown; body: string; bodyBase64: string }> {
  const resp = await fetch(
    "https://content.dropboxapi.com/2/files/download",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "dropbox-api-arg": JSON.stringify(dropboxApiArg),
      },
    },
  );
  if (!resp.ok) {
    const { type, nonRetryable } = errorTypeFor(resp.status);
    const text = await resp.text();
    throw ApplicationFailure.create({
      message: `Dropbox ${operation} failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
      type,
      nonRetryable,
      details: [{ status: resp.status, operation }],
    });
  }
  const metadataHeader = resp.headers.get("dropbox-api-result");
  const bodyBuf = Buffer.from(await resp.arrayBuffer());
  return {
    metadata: metadataHeader ? JSON.parse(metadataHeader) : null,
    body: bodyBuf.toString("utf8"),
    bodyBase64: bodyBuf.toString("base64"),
  };
}

export async function dropboxActivity(
  input: DropboxActivityInput,
): Promise<DropboxActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const accessToken = resolvedCredentials?.accessToken;
  if (!accessToken) {
    throw ApplicationFailure.create({
      message: "Dropbox credential is missing — supply `{ accessToken }`.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  switch (cfg.operation) {
    case "files.upload": {
      const path = normalizePath(mustString("path", cfg.path, context));
      const body = cfg.content ? interpolateTemplate(cfg.content, context) : "";
      const result = await dropboxContentUpload(
        accessToken,
        {
          path,
          mode: cfg.mode ?? "overwrite",
          autorename: false,
          mute: false,
        },
        body,
        "files.upload",
      );
      return { ok: true, result };
    }
    case "files.download": {
      const path = normalizePath(mustString("path", cfg.path, context));
      const result = await dropboxContentDownload(
        accessToken,
        { path },
        "files.download",
      );
      return { ok: true, result };
    }
    case "files.listFolder": {
      const folder = cfg.folderPath
        ? normalizePath(interpolateTemplate(cfg.folderPath, context))
        : "";
      const cursor = cfg.cursor
        ? interpolateTemplate(cfg.cursor, context)
        : undefined;
      const path = cursor ? "/2/files/list_folder/continue" : "/2/files/list_folder";
      const body = cursor
        ? { cursor }
        : {
            path: folder === "/" ? "" : folder,
            recursive: cfg.recursive ?? false,
            ...(cfg.limit
              ? { limit: Math.min(Math.max(cfg.limit, 1), 2000) }
              : {}),
          };
      const result = await dropboxRpc(
        accessToken,
        path,
        body,
        "files.listFolder",
      );
      return { ok: true, result };
    }
    case "files.delete": {
      const path = normalizePath(mustString("path", cfg.path, context));
      const result = await dropboxRpc(
        accessToken,
        "/2/files/delete_v2",
        { path },
        "files.delete",
      );
      return { ok: true, result };
    }
    case "sharing.createSharedLink": {
      const path = normalizePath(mustString("path", cfg.path, context));
      const settings: Record<string, unknown> = {};
      if (cfg.linkVisibility) {
        settings.requested_visibility = { ".tag": cfg.linkVisibility };
      }
      if (cfg.linkPassword) settings.link_password = cfg.linkPassword;
      const result = await dropboxRpc(
        accessToken,
        "/2/sharing/create_shared_link_with_settings",
        {
          path,
          ...(Object.keys(settings).length ? { settings } : {}),
        },
        "sharing.createSharedLink",
      );
      return { ok: true, result };
    }
    default:
      throw ApplicationFailure.create({
        message: `Unsupported Dropbox operation: ${(cfg as { operation?: string }).operation}`,
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
  }
}
