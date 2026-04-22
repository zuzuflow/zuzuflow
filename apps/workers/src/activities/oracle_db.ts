import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { OracleDbConfig } from "@workflow/shared";

export interface OracleDbActivityInput {
  config: OracleDbConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    user?: string;
    password?: string;
    connectString?: string;
    walletLocation?: string;
    walletPassword?: string;
  };
}

export interface OracleDbActivityOutput {
  result: unknown;
  ok: boolean;
}

/**
 * Oracle Database — parameterised query with :bind placeholders. Uses
 * node-oracledb's Thin client by default (no Instant Client needed).
 * Wallet-based auth (ATP / ADB) supplies walletLocation + walletPassword
 * via the credential.
 */
export async function oracleDbActivity(
  input: OracleDbActivityInput,
): Promise<OracleDbActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const { user, password, connectString, walletLocation, walletPassword } =
    resolvedCredentials ?? {};

  if (!user || !password) {
    throw ApplicationFailure.create({
      message: "Oracle DB requires `user` and `password` in the credential.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }
  const cs = cfg.connectString
    ? interpolateTemplate(cfg.connectString, context)
    : connectString;
  if (!cs) {
    throw ApplicationFailure.create({
      message:
        "Oracle DB requires a connect string either in the node config or the credential.",
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }

  const oracledb = (await import("oracledb")).default;
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

  const binds = cfg.binds
    ? (JSON.parse(interpolateTemplate(cfg.binds, context)) as
        | Record<string, unknown>
        | unknown[])
    : {};

  let conn;
  try {
    conn = await oracledb.getConnection({
      user,
      password,
      connectString: cs,
      ...(walletLocation ? { walletLocation } : {}),
      ...(walletPassword ? { walletPassword } : {}),
    });
    const result = await conn.execute(
      interpolateTemplate(cfg.query, context),
      binds as never,
      {
        autoCommit: cfg.autoCommit ?? true,
        maxRows: cfg.maxRows ?? 1000,
      },
    );
    return {
      ok: true,
      result: {
        rows: result.rows ?? [],
        rowsAffected: result.rowsAffected ?? 0,
        outBinds: result.outBinds,
      },
    };
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    const errNum = (err as { errorNum?: number }).errorNum;
    // ORA-01017 = invalid username/password
    // ORA-12154 = TNS: could not resolve the connect identifier
    throw ApplicationFailure.create({
      message: `Oracle DB query failed: ${(err as Error).message}`,
      type:
        errNum === 1017
          ? "AUTH_ERROR"
          : errNum === 12154 || errNum === 12541
            ? "VALIDATION_ERROR"
            : "UPSTREAM_ERROR",
      nonRetryable: errNum === 1017 || errNum === 12154 || errNum === 12541,
    });
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch {
        /* best-effort */
      }
    }
  }
}
