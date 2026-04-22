import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { SnowflakeConfig } from "@workflow/shared";

// =============================================================================
// snowflakeActivity — Snowflake via snowflake-sdk (lazy-imported)
//
// Credential shape:
//   { account, username, password? | privateKey?, database?, schema?,
//     warehouse?, role? }
// Account is the Snowflake account locator (e.g. "xy12345.us-east-1").
// =============================================================================

export interface SnowflakeActivityInput {
  config: SnowflakeConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    account?: string;
    username?: string;
    password?: string;
    privateKey?: string;
    database?: string;
    schema?: string;
    warehouse?: string;
    role?: string;
  };
}

export interface SnowflakeActivityOutput {
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
      message: `Snowflake ${label}: invalid JSON — ${(err as Error).message}`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
}

export async function snowflakeActivity(
  input: SnowflakeActivityInput,
): Promise<SnowflakeActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const { account, username, password, privateKey } =
    resolvedCredentials ?? {};
  if (!account || !username || (!password && !privateKey)) {
    throw ApplicationFailure.create({
      message:
        "Snowflake credential is missing — supply `{ account, username, password }` or `{ account, username, privateKey }`.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  const snowflake = await import("snowflake-sdk");

  const connection = snowflake.createConnection({
    account,
    username,
    ...(password ? { password } : {}),
    ...(privateKey ? { privateKey, authenticator: "SNOWFLAKE_JWT" } : {}),
    database: cfg.database
      ? interpolateTemplate(cfg.database, context)
      : resolvedCredentials?.database,
    schema: cfg.schema
      ? interpolateTemplate(cfg.schema, context)
      : resolvedCredentials?.schema,
    warehouse: cfg.warehouse
      ? interpolateTemplate(cfg.warehouse, context)
      : resolvedCredentials?.warehouse,
    role: cfg.role
      ? interpolateTemplate(cfg.role, context)
      : resolvedCredentials?.role,
    clientSessionKeepAlive: false,
  });

  try {
    await new Promise<void>((resolve, reject) => {
      connection.connect((err) => (err ? reject(err) : resolve()));
    });

    const sql = interpolateTemplate(cfg.sql, context);
    if (!sql.trim()) {
      throw ApplicationFailure.create({
        message: "Snowflake: `sql` is required",
        type: "VALIDATION_ERROR",
        nonRetryable: true,
      });
    }
    const binds = parseJson<unknown[]>("binds", cfg.binds, context);
    const maxRows = Math.min(Math.max(cfg.maxRows ?? 10000, 1), 1_000_000);

    const rows = await new Promise<unknown[]>((resolve, reject) => {
      connection.execute({
        sqlText: sql,
        binds: binds as Parameters<typeof connection.execute>[0]["binds"],
        complete: (err, _stmt, out) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(((out ?? []) as unknown[]).slice(0, maxRows));
        },
      });
    });

    if (cfg.operation === "execute") {
      // For DML/DDL we just return rowCount if available.
      return {
        ok: true,
        result: {
          rows,
          rowCount: Array.isArray(rows) ? rows.length : 0,
        },
      };
    }
    return {
      ok: true,
      result: {
        rows,
        rowCount: Array.isArray(rows) ? rows.length : 0,
      },
    };
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    const e = err as { code?: string | number; message?: string };
    const code = String(e.code ?? "");
    const isAuth =
      code === "390100" || code === "390101" || code === "390114";
    const isValidation =
      code === "000904" || code === "002003" || code === "002038";
    throw ApplicationFailure.create({
      message: `Snowflake ${cfg.operation} failed: ${e.message ?? String(err)}`,
      type: isAuth
        ? "AUTH_ERROR"
        : isValidation
          ? "VALIDATION_ERROR"
          : "UPSTREAM_ERROR",
      nonRetryable: isAuth || isValidation,
      details: [{ code, operation: cfg.operation }],
    });
  } finally {
    try {
      await new Promise<void>((resolve) => {
        connection.destroy(() => resolve());
      });
    } catch {
      // ignore destroy errors
    }
  }
}
