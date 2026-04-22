import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { ClickhouseConfig } from "@workflow/shared";

// =============================================================================
// clickhouseActivity — ClickHouse via @clickhouse/client (lazy-imported)
//
// Credential: { url, username?, password?, database? }
// =============================================================================

export interface ClickhouseActivityInput {
  config: ClickhouseConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    url?: string;
    username?: string;
    password?: string;
    database?: string;
  };
}

export interface ClickhouseActivityOutput {
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
      message: `ClickHouse ${label}: invalid JSON — ${(err as Error).message}`,
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
      message: `ClickHouse: \`${label}\` is required`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  return val;
}

export async function clickhouseActivity(
  input: ClickhouseActivityInput,
): Promise<ClickhouseActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const url = resolvedCredentials?.url;
  if (!url) {
    throw ApplicationFailure.create({
      message: "ClickHouse credential is missing — supply `{ url }`.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  const { createClient } = await import("@clickhouse/client");
  const client = createClient({
    url,
    username: resolvedCredentials?.username,
    password: resolvedCredentials?.password,
    database: resolvedCredentials?.database,
  });

  try {
    switch (cfg.operation) {
      case "query": {
        const query = mustString("query", cfg.query, context);
        const queryParams = parseJson<Record<string, unknown>>(
          "queryParams",
          cfg.queryParams,
          context,
        );
        const format = cfg.format ?? "JSONEachRow";
        const maxRows = Math.min(
          Math.max(cfg.maxRows ?? 10000, 1),
          1_000_000,
        );
        const resultSet = await client.query({
          query,
          format,
          ...(queryParams ? { query_params: queryParams } : {}),
        });
        // For JSON-like formats, parse to array. For CSV/TSV/Native we return raw text.
        if (
          format === "JSON" ||
          format === "JSONEachRow" ||
          format === "JSONCompact"
        ) {
          const rows = (await resultSet.json()) as unknown[];
          return {
            ok: true,
            result: {
              rows: rows.slice(0, maxRows),
              rowCount: Array.isArray(rows) ? rows.length : 0,
              format,
            },
          };
        }
        const text = await resultSet.text();
        return { ok: true, result: { body: text, format } };
      }
      case "insert": {
        const table = mustString("table", cfg.table, context);
        const rows = parseJson<unknown[]>("rows", cfg.rows, context);
        if (!rows || !Array.isArray(rows) || rows.length === 0) {
          throw ApplicationFailure.create({
            message:
              "ClickHouse insert: `rows` must be a non-empty JSON array",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const resp = await client.insert({
          table,
          values: rows,
          format: "JSONEachRow",
        });
        return {
          ok: true,
          result: { inserted: rows.length, queryId: resp.query_id },
        };
      }
      case "command": {
        const query = mustString("query", cfg.query, context);
        const queryParams = parseJson<Record<string, unknown>>(
          "queryParams",
          cfg.queryParams,
          context,
        );
        const resp = await client.command({
          query,
          ...(queryParams ? { query_params: queryParams } : {}),
        });
        return { ok: true, result: { queryId: resp.query_id } };
      }
      default:
        throw ApplicationFailure.create({
          message: `Unsupported ClickHouse operation: ${(cfg as { operation?: string }).operation}`,
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
    }
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    const e = err as { code?: string; message?: string };
    const isAuth = /authentication|authorization|credentials/i.test(
      e.message ?? "",
    );
    throw ApplicationFailure.create({
      message: `ClickHouse ${cfg.operation} failed: ${e.message ?? String(err)}`,
      type: isAuth ? "AUTH_ERROR" : "UPSTREAM_ERROR",
      nonRetryable: isAuth,
      details: [{ code: e.code, operation: cfg.operation }],
    });
  } finally {
    await client.close().catch(() => undefined);
  }
}
