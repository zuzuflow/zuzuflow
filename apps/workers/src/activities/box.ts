import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { BoxConfig } from "@workflow/shared";

// =============================================================================
// boxActivity — Box Content API v2.0
//
// Credential: { accessToken } — OAuth / JWT developer access token.
// =============================================================================

export interface BoxActivityInput {
  config: BoxConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    accessToken?: string;
  };
}

export interface BoxActivityOutput {
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
      message: `Box: \`${label}\` is required`,
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
  if (status === 400 || status === 404 || status === 409)
    return { type: "VALIDATION_ERROR", nonRetryable: true };
  return { type: "UPSTREAM_ERROR", nonRetryable: false };
}

async function boxApi(
  accessToken: string,
  method: string,
  url: string,
  body: unknown,
  operation: string,
): Promise<unknown> {
  const resp = await fetch(url, {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  if (!resp.ok) {
    const { type, nonRetryable } = errType(resp.status);
    throw ApplicationFailure.create({
      message: `Box ${operation} failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
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

export async function boxActivity(
  input: BoxActivityInput,
): Promise<BoxActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const accessToken = resolvedCredentials?.accessToken;
  if (!accessToken) {
    throw ApplicationFailure.create({
      message: "Box credential is missing — supply `{ accessToken }`.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  switch (cfg.operation) {
    case "files.upload": {
      const name = mustString("name", cfg.name, context);
      const parentId = cfg.folderId
        ? interpolateTemplate(cfg.folderId, context)
        : "0";
      const content = cfg.content ? interpolateTemplate(cfg.content, context) : "";
      // Use multipart/form-data per Box's upload spec.
      const form = new FormData();
      form.append(
        "attributes",
        JSON.stringify({ name, parent: { id: parentId } }),
      );
      form.append("file", new Blob([content]), name);
      const resp = await fetch("https://upload.box.com/api/2.0/files/content", {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}` },
        body: form,
      });
      const text = await resp.text();
      if (!resp.ok) {
        const { type, nonRetryable } = errType(resp.status);
        throw ApplicationFailure.create({
          message: `Box files.upload failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
          type,
          nonRetryable,
          details: [{ status: resp.status, operation: "files.upload" }],
        });
      }
      return { ok: true, result: text ? JSON.parse(text) : { ok: true } };
    }
    case "files.download": {
      const id = mustString("fileId", cfg.fileId, context);
      // Box returns 302 to a pre-signed URL. fetch follows redirects by default.
      const resp = await fetch(
        `https://api.box.com/2.0/files/${encodeURIComponent(id)}/content`,
        {
          method: "GET",
          headers: { authorization: `Bearer ${accessToken}` },
        },
      );
      if (!resp.ok) {
        const { type, nonRetryable } = errType(resp.status);
        const text = await resp.text();
        throw ApplicationFailure.create({
          message: `Box files.download failed: ${resp.status} ${resp.statusText} — ${text.slice(0, 500)}`,
          type,
          nonRetryable,
          details: [{ status: resp.status, operation: "files.download" }],
        });
      }
      const buf = Buffer.from(await resp.arrayBuffer());
      return {
        ok: true,
        result: {
          body: buf.toString("utf8"),
          bodyBase64: buf.toString("base64"),
          contentType: resp.headers.get("content-type"),
          contentLength: buf.length,
        },
      };
    }
    case "files.get": {
      const id = mustString("fileId", cfg.fileId, context);
      const result = await boxApi(
        accessToken,
        "GET",
        `https://api.box.com/2.0/files/${encodeURIComponent(id)}`,
        undefined,
        "files.get",
      );
      return { ok: true, result };
    }
    case "files.delete": {
      const id = mustString("fileId", cfg.fileId, context);
      await boxApi(
        accessToken,
        "DELETE",
        `https://api.box.com/2.0/files/${encodeURIComponent(id)}`,
        undefined,
        "files.delete",
      );
      return { ok: true, result: { deleted: true, fileId: id } };
    }
    case "folders.list": {
      const folderId = cfg.folderId
        ? interpolateTemplate(cfg.folderId, context)
        : "0";
      const limit = Math.min(Math.max(cfg.limit ?? 100, 1), 1000);
      const offset = Math.max(cfg.offset ?? 0, 0);
      const result = await boxApi(
        accessToken,
        "GET",
        `https://api.box.com/2.0/folders/${encodeURIComponent(folderId)}/items?limit=${limit}&offset=${offset}`,
        undefined,
        "folders.list",
      );
      return { ok: true, result };
    }
    case "files.createSharedLink": {
      const id = mustString("fileId", cfg.fileId, context);
      const shared_link: Record<string, unknown> = {
        access: cfg.linkAccess ?? "open",
      };
      if (cfg.linkPassword) shared_link.password = cfg.linkPassword;
      const result = await boxApi(
        accessToken,
        "PUT",
        `https://api.box.com/2.0/files/${encodeURIComponent(id)}`,
        { shared_link },
        "files.createSharedLink",
      );
      return { ok: true, result };
    }
    default:
      throw ApplicationFailure.create({
        message: `Unsupported Box operation: ${(cfg as { operation?: string }).operation}`,
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
  }
}
