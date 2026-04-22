import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { GcpStorageConfig } from "@workflow/shared";

export interface GcpStorageActivityInput {
  config: GcpStorageConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    serviceAccountJson?: string;
    projectId?: string;
  };
}

export interface GcpStorageActivityOutput {
  result: unknown;
  ok: boolean;
}

/**
 * Google Cloud Storage — upload / download / list / delete. Takes a
 * service-account JSON in the credential and lazy-loads @google-cloud/storage.
 */
export async function gcpStorageActivity(
  input: GcpStorageActivityInput,
): Promise<GcpStorageActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  if (!resolvedCredentials?.serviceAccountJson) {
    throw ApplicationFailure.create({
      message: "GCP Storage requires a serviceAccountJson in the credential.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  let serviceAccount: { project_id?: string; client_email?: string; private_key?: string };
  try {
    serviceAccount = JSON.parse(resolvedCredentials.serviceAccountJson) as typeof serviceAccount;
  } catch {
    throw ApplicationFailure.create({
      message: "GCP serviceAccountJson is not valid JSON.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  const { Storage } = await import("@google-cloud/storage");
  const projectId =
    resolvedCredentials.projectId ?? serviceAccount.project_id;
  const storage = new Storage({
    projectId,
    credentials: {
      client_email: serviceAccount.client_email,
      private_key: serviceAccount.private_key,
    },
  });
  const bucketName = interpolateTemplate(cfg.bucket, context);
  const bucket = storage.bucket(bucketName);

  try {
    switch (cfg.operation) {
      case "uploadObject": {
        if (!cfg.object) {
          throw ApplicationFailure.create({
            message: "GCP uploadObject: `object` is required",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const obj = interpolateTemplate(cfg.object, context);
        const body = cfg.content ? interpolateTemplate(cfg.content, context) : "";
        const file = bucket.file(obj);
        await file.save(Buffer.from(body, "utf8"), {
          contentType: cfg.contentType ?? "application/octet-stream",
        });
        return {
          ok: true,
          result: {
            bucket: bucketName,
            object: obj,
            publicUrl: `https://storage.googleapis.com/${bucketName}/${encodeURIComponent(obj)}`,
          },
        };
      }

      case "downloadObject": {
        if (!cfg.object) {
          throw ApplicationFailure.create({
            message: "GCP downloadObject: `object` is required",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const obj = interpolateTemplate(cfg.object, context);
        const file = bucket.file(obj);
        const [buf] = await file.download();
        const [md] = await file.getMetadata();
        return {
          ok: true,
          result: {
            bucket: bucketName,
            object: obj,
            contentType: md.contentType,
            size: md.size,
            body: buf.toString("utf8"),
            bodyBase64: buf.toString("base64"),
          },
        };
      }

      case "listObjects": {
        const prefix = cfg.prefix
          ? interpolateTemplate(cfg.prefix, context)
          : undefined;
        const max = Math.min(Math.max(cfg.maxResults ?? 100, 1), 5000);
        const [files] = await bucket.getFiles({ prefix, maxResults: max });
        const items = files.map((f) => ({
          name: f.name,
          size: Number(f.metadata.size ?? 0),
          contentType: f.metadata.contentType,
          updated: f.metadata.updated,
        }));
        return { ok: true, result: { items, count: items.length } };
      }

      case "deleteObject": {
        if (!cfg.object) {
          throw ApplicationFailure.create({
            message: "GCP deleteObject: `object` is required",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const obj = interpolateTemplate(cfg.object, context);
        await bucket.file(obj).delete({ ignoreNotFound: true });
        return { ok: true, result: { deleted: true, object: obj } };
      }

      default:
        throw ApplicationFailure.create({
          message: `Unsupported GCP Storage operation: ${(cfg as { operation?: string }).operation}`,
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
    }
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    const code = (err as { code?: number }).code;
    throw ApplicationFailure.create({
      message: `GCP Storage ${cfg.operation} failed: ${(err as Error).message}`,
      type:
        code === 401 || code === 403
          ? "AUTH_ERROR"
          : code === 404
            ? "VALIDATION_ERROR"
            : "UPSTREAM_ERROR",
      nonRetryable: code === 401 || code === 403 || code === 404,
    });
  }
}
