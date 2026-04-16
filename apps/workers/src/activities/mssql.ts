import sql from "mssql";
import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { MssqlConfig } from "@workflow/shared";

// =============================================================================
// mssqlActivity — runs a parameterized MSSQL query
// =============================================================================

export interface MssqlActivityInput {
  config: MssqlConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    server?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
  };
}

export interface MssqlActivityOutput {
  rows: unknown[];
  rowCount: number;
  affectedRows?: number;
}

export async function mssqlActivity(
  input: MssqlActivityInput
): Promise<MssqlActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;

  const server = resolvedCredentials?.server ?? cfg.server;
  const database = resolvedCredentials?.database ?? cfg.database;
  const user = resolvedCredentials?.user ?? cfg.user;
  const password = resolvedCredentials?.password ?? cfg.password;
  const port = resolvedCredentials?.port ?? cfg.port ?? 1433;

  if (!server || !database) {
    throw ApplicationFailure.create({
      message: "MSSQL: server and database are required",
      type: "MSSQL_CONFIG_ERROR",
      nonRetryable: true,
    });
  }

  const query = interpolateTemplate(cfg.query, context);

  // Interpolate params array
  const params = (cfg.params ?? []).map((p) => interpolateTemplate(p, context));

  // Replace ? placeholders with @p0, @p1, etc.
  let paramIndex = 0;
  const parameterizedQuery = query.replace(/\?/g, () => `@p${paramIndex++}`);

  let pool: sql.ConnectionPool | undefined;
  try {
    pool = await sql.connect({
      server,
      port,
      database,
      user,
      password,
      options: {
        encrypt: cfg.encrypt ?? true,
        trustServerCertificate: cfg.trustServerCertificate ?? false,
      },
    });

    const request = pool.request();

    // Bind parameters
    params.forEach((param, idx) => {
      request.input(`p${idx}`, param);
    });

    const result = await request.query(parameterizedQuery);

    return {
      rows: result.recordset ?? [],
      rowCount: result.recordset?.length ?? 0,
      affectedRows: result.rowsAffected?.reduce((a: number, b: number) => a + b, 0),
    };
  } catch (err) {
    throw ApplicationFailure.create({
      message: `MSSQL query failed: ${(err as Error).message}`,
      type: "MSSQL_QUERY_ERROR",
      nonRetryable: false,
    });
  } finally {
    await pool?.close();
  }
}
