import { Pool } from "pg";
import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { PostgresConfig } from "@workflow/shared";

// =============================================================================
// postgresQueryActivity — executes a parameterized query against PostgreSQL
// =============================================================================

// Simple connection pool cache keyed by connection string
const poolCache = new Map<string, Pool>();

function getPool(connectionString: string): Pool {
  if (!poolCache.has(connectionString)) {
    const pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    poolCache.set(connectionString, pool);
  }
  return poolCache.get(connectionString)!;
}

export interface PostgresActivityInput {
  config: PostgresConfig;
  /** nodeOutputs context for interpolation */
  context: Record<string, unknown>;
  /** Resolved connection string (if credential lookup was done externally) */
  resolvedConnectionString?: string;
}

export interface PostgresActivityOutput {
  rows: Record<string, unknown>[];
  rowCount: number;
}

export async function postgresQueryActivity(
  input: PostgresActivityInput
): Promise<PostgresActivityOutput> {
  const { config: cfg, context, resolvedConnectionString } = input;

  const connectionString =
    resolvedConnectionString ??
    cfg.connectionString ??
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw ApplicationFailure.create({
      message: "No PostgreSQL connection string available",
      type: "POSTGRES_CONFIGURATION_ERROR",
      nonRetryable: true,
    });
  }

  // Interpolate the query string itself
  const query = interpolateTemplate(cfg.query, context);

  // Interpolate each parameter value and attempt type coercion
  const params: unknown[] = (cfg.params ?? []).map((param) => {
    const interpolated = interpolateTemplate(param, context);
    // Try to parse as number/boolean; fall back to string
    if (interpolated === "true") return true;
    if (interpolated === "false") return false;
    const asNum = Number(interpolated);
    if (!isNaN(asNum) && interpolated.trim() !== "") return asNum;
    return interpolated;
  });

  const pool = getPool(connectionString);

  try {
    const result = await pool.query(query, params);
    return {
      rows: result.rows as Record<string, unknown>[],
      rowCount: result.rowCount ?? 0,
    };
  } catch (err) {
    const pgErr = err as NodeJS.ErrnoException & { code?: string };
    // Syntax errors and constraint violations are not retryable
    const nonRetryable =
      pgErr.code?.startsWith("42") || // Syntax errors
      pgErr.code?.startsWith("23"); // Integrity constraint violations

    throw ApplicationFailure.create({
      message: `PostgreSQL query failed: ${pgErr.message}`,
      type: "POSTGRES_QUERY_ERROR",
      nonRetryable: nonRetryable ?? false,
      details: [{ pgCode: pgErr.code, query }],
    });
  }
}
