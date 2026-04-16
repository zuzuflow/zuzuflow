import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { S3BucketConfig } from "@workflow/shared";

// =============================================================================
// s3Activity — S3 bucket operations
// =============================================================================

export interface S3ActivityInput {
  config: S3BucketConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: { accessKeyId?: string; secretAccessKey?: string };
}

export interface S3ActivityOutput {
  result: unknown;
  ok: boolean;
}

export async function s3Activity(
  input: S3ActivityInput
): Promise<S3ActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;

  const clientOptions: ConstructorParameters<typeof S3Client>[0] = {
    region: cfg.region ?? "us-east-1",
  };

  if (cfg.endpoint) {
    clientOptions.endpoint = cfg.endpoint;
  }
  if (cfg.forcePathStyle) {
    clientOptions.forcePathStyle = cfg.forcePathStyle;
  }

  if (resolvedCredentials?.accessKeyId && resolvedCredentials?.secretAccessKey) {
    clientOptions.credentials = {
      accessKeyId: resolvedCredentials.accessKeyId,
      secretAccessKey: resolvedCredentials.secretAccessKey,
    };
  }

  const client = new S3Client(clientOptions);
  const bucket = interpolateTemplate(cfg.bucket, context);
  const key = interpolateTemplate(cfg.key, context);

  try {
    let result: unknown;

    switch (cfg.operation) {
      case "getObject": {
        const resp = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: key })
        );
        const body = await resp.Body?.transformToString();
        result = {
          body,
          contentType: resp.ContentType,
          contentLength: resp.ContentLength,
          lastModified: resp.LastModified,
        };
        break;
      }
      case "putObject": {
        const body = cfg.body ? interpolateTemplate(cfg.body, context) : "";
        const contentType = cfg.contentType ?? "application/octet-stream";
        const resp = await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
          })
        );
        result = { eTag: resp.ETag, versionId: resp.VersionId };
        break;
      }
      case "listObjects": {
        const prefix = cfg.prefix ? interpolateTemplate(cfg.prefix, context) : undefined;
        const resp = await client.send(
          new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix })
        );
        result = {
          objects: resp.Contents?.map((o) => ({
            key: o.Key,
            size: o.Size,
            lastModified: o.LastModified,
          })) ?? [],
          count: resp.KeyCount ?? 0,
          truncated: resp.IsTruncated,
        };
        break;
      }
      case "deleteObject": {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        result = { deleted: true, key };
        break;
      }
      default:
        throw ApplicationFailure.create({
          message: `Unknown S3 operation: ${cfg.operation}`,
          type: "S3_UNSUPPORTED_OP",
          nonRetryable: true,
        });
    }

    return { result, ok: true };
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    throw ApplicationFailure.create({
      message: `S3 ${cfg.operation} failed: ${(err as Error).message}`,
      type: "S3_OPERATION_ERROR",
      nonRetryable: false,
    });
  }
}
