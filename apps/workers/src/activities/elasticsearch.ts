import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { ElasticsearchConfig } from "@workflow/shared";

// =============================================================================
// elasticsearchActivity — Elasticsearch via @elastic/elasticsearch
//
// Credential: { node, apiKey? | (username + password), ca? }
// =============================================================================

export interface ElasticsearchActivityInput {
  config: ElasticsearchConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    node?: string;
    apiKey?: string;
    username?: string;
    password?: string;
    ca?: string;
  };
}

export interface ElasticsearchActivityOutput {
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
      message: `Elasticsearch ${label}: invalid JSON — ${(err as Error).message}`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
}

function mustString(
  label: string,
  raw: string | undefined,
  context: Record<string, unknown>,
): string {
  const val = raw ? interpolateTemplate(raw, context) : "";
  if (!val) {
    throw ApplicationFailure.create({
      message: `Elasticsearch: \`${label}\` is required`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  return val;
}

export async function elasticsearchActivity(
  input: ElasticsearchActivityInput,
): Promise<ElasticsearchActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const node = resolvedCredentials?.node;
  if (!node) {
    throw ApplicationFailure.create({
      message: "Elasticsearch credential is missing — supply `{ node }`.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  const { Client } = await import("@elastic/elasticsearch");

  const auth = resolvedCredentials?.apiKey
    ? { apiKey: resolvedCredentials.apiKey }
    : resolvedCredentials?.username && resolvedCredentials?.password
      ? {
          username: resolvedCredentials.username,
          password: resolvedCredentials.password,
        }
      : undefined;

  const client = new Client({
    node,
    ...(auth ? { auth } : {}),
    ...(resolvedCredentials?.ca ? { tls: { ca: resolvedCredentials.ca } } : {}),
  });

  const index = mustString("index", cfg.index, context);

  try {
    switch (cfg.operation) {
      case "index": {
        const document = parseJson<Record<string, unknown>>(
          "document",
          cfg.document,
          context,
        );
        if (!document) {
          throw ApplicationFailure.create({
            message: "Elasticsearch index: `document` JSON is required",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const id = cfg.documentId
          ? interpolateTemplate(cfg.documentId, context)
          : undefined;
        const result = await client.index({
          index,
          ...(id ? { id } : {}),
          document,
          ...(cfg.refresh ? { refresh: cfg.refresh } : {}),
        });
        return { ok: true, result };
      }
      case "get": {
        const id = mustString("documentId", cfg.documentId, context);
        const result = await client.get({ index, id });
        return { ok: true, result };
      }
      case "update": {
        const id = mustString("documentId", cfg.documentId, context);
        const doc = parseJson<Record<string, unknown>>("doc", cfg.doc, context);
        const bodyObj = parseJson<Record<string, unknown>>(
          "body",
          cfg.body,
          context,
        );
        if (!doc && !bodyObj) {
          throw ApplicationFailure.create({
            message:
              "Elasticsearch update: supply either `doc` (partial) or `body` (full update payload)",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const result = await client.update({
          index,
          id,
          ...(doc ? { doc } : {}),
          ...(bodyObj ?? {}),
          ...(cfg.refresh ? { refresh: cfg.refresh } : {}),
        });
        return { ok: true, result };
      }
      case "delete": {
        const id = mustString("documentId", cfg.documentId, context);
        const result = await client.delete({
          index,
          id,
          ...(cfg.refresh ? { refresh: cfg.refresh } : {}),
        });
        return { ok: true, result };
      }
      case "search": {
        const bodyObj = parseJson<Record<string, unknown>>(
          "body",
          cfg.body,
          context,
        );
        const size = Math.min(Math.max(cfg.size ?? 10, 0), 10000);
        const from = Math.max(cfg.from ?? 0, 0);
        const result = await client.search({
          index,
          size,
          from,
          ...(bodyObj ?? {}),
        });
        return { ok: true, result };
      }
      case "bulk": {
        if (!cfg.operations) {
          throw ApplicationFailure.create({
            message:
              "Elasticsearch bulk: `operations` (newline-delimited JSON or JSON array) is required",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const raw = interpolateTemplate(cfg.operations, context).trim();
        let operations: unknown[];
        if (raw.startsWith("[")) {
          try {
            operations = JSON.parse(raw) as unknown[];
          } catch (err) {
            throw ApplicationFailure.create({
              message: `Elasticsearch bulk: invalid JSON array — ${(err as Error).message}`,
              type: "VALIDATION_ERROR",
              nonRetryable: true,
            });
          }
        } else {
          operations = raw
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line, i) => {
              try {
                return JSON.parse(line);
              } catch (err) {
                throw ApplicationFailure.create({
                  message: `Elasticsearch bulk: invalid NDJSON line ${i + 1} — ${(err as Error).message}`,
                  type: "VALIDATION_ERROR",
                  nonRetryable: true,
                });
              }
            });
        }
        const result = await client.bulk({
          index,
          operations,
          ...(cfg.refresh ? { refresh: cfg.refresh } : {}),
        });
        return { ok: true, result };
      }
      default:
        throw ApplicationFailure.create({
          message: `Unsupported Elasticsearch operation: ${(cfg as { operation?: string }).operation}`,
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
    }
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    const e = err as {
      meta?: { statusCode?: number };
      message?: string;
      name?: string;
    };
    const status = e.meta?.statusCode ?? 0;
    throw ApplicationFailure.create({
      message: `Elasticsearch ${cfg.operation} failed: ${e.message ?? String(err)}`,
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
      details: [{ status, name: e.name, operation: cfg.operation }],
    });
  } finally {
    await client.close().catch(() => undefined);
  }
}
