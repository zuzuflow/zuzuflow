import { google } from "googleapis";
import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { GoogleDriveConfig } from "@workflow/shared";

// =============================================================================
// googleDriveActivity — Google Drive REST v3
//
// Credential:
//   - Service account: { serviceAccountJson } (reuses the gcp credential shape)
//     plus optional { impersonateUser } for domain-wide delegation.
//   - OAuth: { accessToken } — short-lived token from your own OAuth flow.
// =============================================================================

export interface GoogleDriveActivityInput {
  config: GoogleDriveConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    serviceAccountJson?: string;
    accessToken?: string;
  };
}

export interface GoogleDriveActivityOutput {
  ok: boolean;
  result: unknown;
}

const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.file",
];

function mustString(
  label: string,
  raw: string | undefined,
  context: Record<string, unknown>,
): string {
  const val = raw ? interpolateTemplate(raw, context) : "";
  if (!val) {
    throw ApplicationFailure.create({
      message: `Google Drive: \`${label}\` is required`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  return val;
}

async function buildDriveClient(
  cfg: GoogleDriveConfig,
  resolved: GoogleDriveActivityInput["resolvedCredentials"],
  context: Record<string, unknown>,
): Promise<ReturnType<typeof google.drive>> {
  if (resolved?.serviceAccountJson) {
    let sa: { client_email: string; private_key: string };
    try {
      sa = JSON.parse(resolved.serviceAccountJson);
    } catch {
      throw ApplicationFailure.create({
        message: "Google Drive: invalid service account JSON",
        type: "AUTH_ERROR",
        nonRetryable: true,
      });
    }
    const subject = cfg.impersonateUser
      ? interpolateTemplate(cfg.impersonateUser, context)
      : undefined;
    const jwt = new google.auth.JWT({
      email: sa.client_email,
      key: sa.private_key,
      scopes: DRIVE_SCOPES,
      ...(subject ? { subject } : {}),
    });
    return google.drive({ version: "v3", auth: jwt });
  }
  if (resolved?.accessToken) {
    const oauth = new google.auth.OAuth2();
    oauth.setCredentials({ access_token: resolved.accessToken });
    return google.drive({ version: "v3", auth: oauth });
  }
  throw ApplicationFailure.create({
    message:
      "Google Drive credential is missing — supply `{ serviceAccountJson }` (+ optional impersonateUser) or `{ accessToken }`.",
    type: "AUTH_ERROR",
    nonRetryable: true,
  });
}

export async function googleDriveActivity(
  input: GoogleDriveActivityInput,
): Promise<GoogleDriveActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const drive = await buildDriveClient(cfg, resolvedCredentials, context);

  try {
    switch (cfg.operation) {
      case "files.list": {
        const q = cfg.query ? interpolateTemplate(cfg.query, context) : undefined;
        const pageSize = Math.min(Math.max(cfg.pageSize ?? 100, 1), 1000);
        const resp = await drive.files.list({
          q,
          pageSize,
          fields:
            "nextPageToken, files(id, name, mimeType, modifiedTime, size, parents, webViewLink)",
        });
        return { ok: true, result: resp.data };
      }
      case "files.get": {
        const id = mustString("fileId", cfg.fileId, context);
        const resp = await drive.files.get({
          fileId: id,
          fields:
            "id, name, mimeType, size, parents, modifiedTime, webViewLink, webContentLink",
        });
        return { ok: true, result: resp.data };
      }
      case "files.upload": {
        const name = mustString("name", cfg.name, context);
        const mimeType = cfg.mimeType ?? "text/plain";
        const content = cfg.content
          ? interpolateTemplate(cfg.content, context)
          : "";
        const parents = cfg.parents
          ? interpolateTemplate(cfg.parents, context)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined;
        const resp = await drive.files.create({
          requestBody: { name, ...(parents ? { parents } : {}) },
          media: { mimeType, body: content },
          fields: "id, name, mimeType, size, webViewLink, webContentLink",
        });
        return { ok: true, result: resp.data };
      }
      case "files.delete": {
        const id = mustString("fileId", cfg.fileId, context);
        await drive.files.delete({ fileId: id });
        return { ok: true, result: { deleted: true, fileId: id } };
      }
      case "files.share": {
        const id = mustString("fileId", cfg.fileId, context);
        const shareType = cfg.shareType ?? "user";
        const shareRole = cfg.shareRole ?? "reader";
        const shareEmail = cfg.shareEmail
          ? interpolateTemplate(cfg.shareEmail, context)
          : undefined;
        if (
          (shareType === "user" || shareType === "group") &&
          !shareEmail
        ) {
          throw ApplicationFailure.create({
            message:
              "Google Drive files.share: `shareEmail` is required for user/group targets",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const resp = await drive.permissions.create({
          fileId: id,
          requestBody: {
            type: shareType,
            role: shareRole,
            ...(shareEmail ? { emailAddress: shareEmail } : {}),
          },
          fields: "id, type, role, emailAddress",
        });
        return { ok: true, result: resp.data };
      }
      default:
        throw ApplicationFailure.create({
          message: `Unsupported Google Drive operation: ${(cfg as { operation?: string }).operation}`,
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
    }
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    const e = err as { code?: number; errors?: unknown[]; message?: string };
    const status = e.code ?? 0;
    throw ApplicationFailure.create({
      message: `Google Drive ${cfg.operation} failed: ${e.message ?? String(err)}`,
      type:
        status === 401 || status === 403
          ? "AUTH_ERROR"
          : status === 429
            ? "RATE_LIMITED"
            : status === 400 || status === 404
              ? "VALIDATION_ERROR"
              : "UPSTREAM_ERROR",
      nonRetryable:
        status === 401 ||
        status === 403 ||
        status === 400 ||
        status === 404,
      details: [{ status, operation: cfg.operation, errors: e.errors }],
    });
  }
}
