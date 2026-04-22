import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { OciObjectStorageConfig } from "@workflow/shared";

export interface OciObjectStorageActivityInput {
  config: OciObjectStorageConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    tenancy?: string;
    user?: string;
    fingerprint?: string;
    privateKey?: string;
    region?: string;
    namespace?: string;
  };
}

export interface OciObjectStorageActivityOutput {
  result: unknown;
  ok: boolean;
}

/**
 * OCI Object Storage — put / get / list / delete. The OCI SDKs want a
 * plain-text RSA private key; we build a SimpleAuthenticationDetailsProvider
 * from the credential fields rather than from a file on disk. Lazy-loads
 * oci-objectstorage + oci-common.
 */
export async function ociObjectStorageActivity(
  input: OciObjectStorageActivityInput,
): Promise<OciObjectStorageActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const { tenancy, user, fingerprint, privateKey, region, namespace } =
    resolvedCredentials ?? {};

  if (!tenancy || !user || !fingerprint || !privateKey || !region) {
    throw ApplicationFailure.create({
      message:
        "OCI Object Storage requires tenancy, user, fingerprint, privateKey, and region in the credential.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  const common = await import("oci-common");
  const os = await import("oci-objectstorage");

  const provider = new common.SimpleAuthenticationDetailsProvider(
    tenancy,
    user,
    fingerprint,
    privateKey,
    null,
    common.Region.fromRegionId(region),
  );
  const client = new os.ObjectStorageClient({ authenticationDetailsProvider: provider });
  const ns = cfg.namespace ?? namespace;
  if (!ns) {
    // Fetch the default namespace from the tenancy as a fallback.
    const resp = await client.getNamespace({});
    (cfg as OciObjectStorageConfig).namespace = resp.value;
  }
  const effectiveNs = (cfg.namespace ?? namespace) as string;
  const bucket = interpolateTemplate(cfg.bucket, context);

  try {
    switch (cfg.operation) {
      case "putObject": {
        if (!cfg.object) {
          throw ApplicationFailure.create({
            message: "OCI putObject: `object` is required",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const objectName = interpolateTemplate(cfg.object, context);
        const body = cfg.content
          ? interpolateTemplate(cfg.content, context)
          : "";
        const buf = Buffer.from(body, "utf8");
        const resp = await client.putObject({
          namespaceName: effectiveNs,
          bucketName: bucket,
          objectName,
          putObjectBody: buf,
          contentLength: buf.length,
          contentType: cfg.contentType ?? "application/octet-stream",
        });
        return {
          ok: true,
          result: {
            etag: resp.eTag,
            object: objectName,
            bucket,
            namespace: effectiveNs,
          },
        };
      }

      case "getObject": {
        if (!cfg.object) {
          throw ApplicationFailure.create({
            message: "OCI getObject: `object` is required",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const objectName = interpolateTemplate(cfg.object, context);
        const resp = await client.getObject({
          namespaceName: effectiveNs,
          bucketName: bucket,
          objectName,
        });
        // ReadableStream → Buffer
        const chunks: Buffer[] = [];
        const stream = resp.value as AsyncIterable<Buffer | string> | null;
        if (stream) {
          for await (const c of stream) {
            chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c as string));
          }
        }
        const buf = Buffer.concat(chunks);
        return {
          ok: true,
          result: {
            contentType: resp.contentType,
            contentLength: resp.contentLength,
            etag: resp.eTag,
            body: buf.toString("utf8"),
            bodyBase64: buf.toString("base64"),
          },
        };
      }

      case "listObjects": {
        const prefix = cfg.prefix
          ? interpolateTemplate(cfg.prefix, context)
          : undefined;
        const resp = await client.listObjects({
          namespaceName: effectiveNs,
          bucketName: bucket,
          prefix,
          limit: Math.min(Math.max(cfg.maxResults ?? 100, 1), 1000),
        });
        const items = (resp.listObjects.objects ?? []).map((o) => ({
          name: o.name,
          size: o.size,
          md5: o.md5,
          timeCreated: o.timeCreated?.toISOString?.(),
        }));
        return { ok: true, result: { items, count: items.length } };
      }

      case "deleteObject": {
        if (!cfg.object) {
          throw ApplicationFailure.create({
            message: "OCI deleteObject: `object` is required",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const objectName = interpolateTemplate(cfg.object, context);
        await client.deleteObject({
          namespaceName: effectiveNs,
          bucketName: bucket,
          objectName,
        });
        return { ok: true, result: { deleted: true, object: objectName } };
      }

      default:
        throw ApplicationFailure.create({
          message: `Unsupported OCI Object Storage operation: ${(cfg as { operation?: string }).operation}`,
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
    }
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    const status = (err as { statusCode?: number }).statusCode;
    throw ApplicationFailure.create({
      message: `OCI Object Storage ${cfg.operation} failed: ${(err as Error).message}`,
      type:
        status === 401 || status === 403
          ? "AUTH_ERROR"
          : status === 404
            ? "VALIDATION_ERROR"
            : "UPSTREAM_ERROR",
      nonRetryable: status === 401 || status === 403 || status === 404,
    });
  }
}
