import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { AzureBlobConfig } from "@workflow/shared";

// =============================================================================
// azureBlobActivity — Azure Blob Storage operations
//
// The @azure/storage-blob SDK is heavy (~15 MB installed). Loaded lazily on
// first use so workflows that never touch Azure don't pay the cost on
// worker boot. Follows the same convention the AWS v3 clients use.
// =============================================================================

export interface AzureBlobActivityInput {
  config: AzureBlobConfig;
  context: Record<string, unknown>;
  /**
   * Decrypted credential payload. Accepts any of:
   *   - { connectionString }           — fastest path, carries everything.
   *   - { accountName, accountKey }    — shared-key auth.
   *   - { accountName, sasToken }      — SAS token auth.
   * The activity picks the first shape that resolves.
   */
  resolvedCredentials?: {
    connectionString?: string;
    accountName?: string;
    accountKey?: string;
    sasToken?: string;
  };
}

export interface AzureBlobActivityOutput {
  result: unknown;
  ok: boolean;
}

async function getBlobServiceClient(
  creds: AzureBlobActivityInput["resolvedCredentials"],
): Promise<
  InstanceType<
    typeof import("@azure/storage-blob").BlobServiceClient
  >
> {
  const {
    BlobServiceClient,
    StorageSharedKeyCredential,
  } = await import("@azure/storage-blob");

  if (creds?.connectionString) {
    return BlobServiceClient.fromConnectionString(creds.connectionString);
  }
  if (creds?.accountName && creds.accountKey) {
    const sharedKey = new StorageSharedKeyCredential(
      creds.accountName,
      creds.accountKey,
    );
    return new BlobServiceClient(
      `https://${creds.accountName}.blob.core.windows.net`,
      sharedKey,
    );
  }
  if (creds?.accountName && creds.sasToken) {
    const token = creds.sasToken.startsWith("?")
      ? creds.sasToken
      : `?${creds.sasToken}`;
    return new BlobServiceClient(
      `https://${creds.accountName}.blob.core.windows.net${token}`,
    );
  }
  throw ApplicationFailure.create({
    message:
      "Azure Blob credential is missing — supply a connectionString, (accountName + accountKey), or (accountName + sasToken).",
    type: "AUTH_ERROR",
    nonRetryable: true,
  });
}

export async function azureBlobActivity(
  input: AzureBlobActivityInput,
): Promise<AzureBlobActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;

  const service = await getBlobServiceClient(resolvedCredentials);
  const container = interpolateTemplate(cfg.container, context);
  if (!container) {
    throw ApplicationFailure.create({
      message: "Azure Blob: `container` is required",
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  const containerClient = service.getContainerClient(container);

  try {
    switch (cfg.operation) {
      case "uploadBlob": {
        const blobName = cfg.blob
          ? interpolateTemplate(cfg.blob, context)
          : "";
        if (!blobName) {
          throw ApplicationFailure.create({
            message: "Azure Blob uploadBlob: `blob` is required",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const body = cfg.content
          ? interpolateTemplate(cfg.content, context)
          : "";
        const blockClient = containerClient.getBlockBlobClient(blobName);
        const resp = await blockClient.upload(body, Buffer.byteLength(body), {
          blobHTTPHeaders: cfg.contentType
            ? { blobContentType: cfg.contentType }
            : undefined,
        });
        return {
          ok: true,
          result: {
            url: blockClient.url,
            etag: resp.etag,
            lastModified: resp.lastModified?.toISOString(),
            versionId: resp.versionId,
            contentMD5: resp.contentMD5
              ? Buffer.from(resp.contentMD5).toString("base64")
              : undefined,
          },
        };
      }

      case "downloadBlob": {
        const blobName = cfg.blob
          ? interpolateTemplate(cfg.blob, context)
          : "";
        if (!blobName) {
          throw ApplicationFailure.create({
            message: "Azure Blob downloadBlob: `blob` is required",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const blobClient = containerClient.getBlobClient(blobName);
        const resp = await blobClient.download();
        // Read the whole stream into a string — matches the S3 activity's
        // getObject behaviour. Binary content is base64-encodable upstream.
        const chunks: Buffer[] = [];
        const stream = resp.readableStreamBody;
        if (stream) {
          for await (const chunk of stream as AsyncIterable<Buffer | string>) {
            chunks.push(
              Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string),
            );
          }
        }
        const bodyBuf = Buffer.concat(chunks);
        return {
          ok: true,
          result: {
            url: blobClient.url,
            contentType: resp.contentType,
            contentLength: resp.contentLength,
            etag: resp.etag,
            lastModified: resp.lastModified?.toISOString(),
            body: bodyBuf.toString("utf8"),
            bodyBase64: bodyBuf.toString("base64"),
          },
        };
      }

      case "listBlobs": {
        const prefix = cfg.prefix
          ? interpolateTemplate(cfg.prefix, context)
          : undefined;
        const max = Math.min(Math.max(cfg.maxResults ?? 100, 1), 5000);
        const items: Array<{
          name: string;
          lastModified?: string;
          contentLength?: number;
          etag?: string;
        }> = [];
        for await (const b of containerClient.listBlobsFlat({ prefix })) {
          items.push({
            name: b.name,
            lastModified: b.properties.lastModified?.toISOString(),
            contentLength: b.properties.contentLength,
            etag: b.properties.etag,
          });
          if (items.length >= max) break;
        }
        return { ok: true, result: { items, count: items.length } };
      }

      case "deleteBlob": {
        const blobName = cfg.blob
          ? interpolateTemplate(cfg.blob, context)
          : "";
        if (!blobName) {
          throw ApplicationFailure.create({
            message: "Azure Blob deleteBlob: `blob` is required",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const blobClient = containerClient.getBlobClient(blobName);
        const resp = await blobClient.deleteIfExists();
        return {
          ok: true,
          result: { deleted: resp.succeeded, requestId: resp.requestId },
        };
      }

      case "getBlobProperties": {
        const blobName = cfg.blob
          ? interpolateTemplate(cfg.blob, context)
          : "";
        if (!blobName) {
          throw ApplicationFailure.create({
            message: "Azure Blob getBlobProperties: `blob` is required",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const blobClient = containerClient.getBlobClient(blobName);
        const resp = await blobClient.getProperties();
        return {
          ok: true,
          result: {
            contentType: resp.contentType,
            contentLength: resp.contentLength,
            etag: resp.etag,
            lastModified: resp.lastModified?.toISOString(),
            metadata: resp.metadata,
          },
        };
      }

      default:
        throw ApplicationFailure.create({
          message: `Unsupported Azure Blob operation: ${(cfg as { operation?: string }).operation}`,
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
    }
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    const msg = (err as Error).message ?? String(err);
    const code = (err as { code?: string }).code;
    // Surface Azure-SDK error codes cleanly for retry policies.
    throw ApplicationFailure.create({
      message: `Azure Blob ${cfg.operation} failed: ${msg}`,
      type:
        code === "AuthenticationFailed" ||
        code === "AuthorizationFailed" ||
        code === "InvalidAuthenticationInfo"
          ? "AUTH_ERROR"
          : code === "ContainerNotFound" ||
              code === "BlobNotFound"
            ? "VALIDATION_ERROR"
            : "UPSTREAM_ERROR",
      nonRetryable:
        code === "AuthenticationFailed" ||
        code === "AuthorizationFailed" ||
        code === "InvalidAuthenticationInfo" ||
        code === "ContainerNotFound" ||
        code === "BlobNotFound",
      details: [{ code, operation: cfg.operation }],
    });
  }
}
