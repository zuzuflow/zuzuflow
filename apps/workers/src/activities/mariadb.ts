import mysql from "mysql2/promise";
import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { MariadbConfig } from "@workflow/shared";

// =============================================================================
// mariadbActivity — runs a parameterized MariaDB query (mysql2 is compatible)
// =============================================================================

export interface MariadbActivityInput {
  config: MariadbConfig;
  context: Record<string, unknown>;
  resolvedConnectionString?: string;
}

export interface MariadbActivityOutput {
  rows: unknown[];
  rowCount: number;
  affectedRows?: number;
}

export async function mariadbActivity(
  input: MariadbActivityInput
): Promise<MariadbActivityOutput> {
  const { config: cfg, context, resolvedConnectionString } = input;

  const connectionString =
    resolvedConnectionString ??
    cfg.connectionString ??
    "";

  if (!connectionString) {
    throw ApplicationFailure.create({
      message: "MariaDB: no connection string provided",
      type: "MARIADB_CONFIG_ERROR",
      nonRetryable: true,
    });
  }

  const query = interpolateTemplate(cfg.query, context);

  // Interpolate params array
  const params = (cfg.params ?? []).map((p) => interpolateTemplate(p, context));

  let connection: mysql.Connection | undefined;
  try {
    connection = await mysql.createConnection(connectionString);
    const [result] = await connection.execute(query, params);

    if (Array.isArray(result)) {
      return { rows: result, rowCount: result.length };
    }

    // INSERT / UPDATE / DELETE result
    const okPacket = result as mysql.ResultSetHeader;
    return {
      rows: [],
      rowCount: 0,
      affectedRows: okPacket.affectedRows,
    };
  } catch (err) {
    throw ApplicationFailure.create({
      message: `MariaDB query failed: ${(err as Error).message}`,
      type: "MARIADB_QUERY_ERROR",
      nonRetryable: false,
    });
  } finally {
    await connection?.end();
  }
}
