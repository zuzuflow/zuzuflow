import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { GcpBigQueryConfig } from "@workflow/shared";

export interface GcpBigQueryActivityInput {
  config: GcpBigQueryConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    serviceAccountJson?: string;
    projectId?: string;
  };
}

export interface GcpBigQueryActivityOutput {
  result: unknown;
  ok: boolean;
}

/**
 * Google BigQuery — query (Standard or Legacy SQL) and insertRows.
 * Config.projectId overrides the credential's project_id when set.
 */
export async function gcpBigQueryActivity(
  input: GcpBigQueryActivityInput,
): Promise<GcpBigQueryActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  if (!resolvedCredentials?.serviceAccountJson) {
    throw ApplicationFailure.create({
      message: "BigQuery requires a serviceAccountJson in the credential.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  let serviceAccount: {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };
  try {
    serviceAccount = JSON.parse(
      resolvedCredentials.serviceAccountJson,
    ) as typeof serviceAccount;
  } catch {
    throw ApplicationFailure.create({
      message: "GCP serviceAccountJson is not valid JSON.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  const { BigQuery } = await import("@google-cloud/bigquery");
  const projectId =
    cfg.projectId ?? resolvedCredentials.projectId ?? serviceAccount.project_id;
  const bq = new BigQuery({
    projectId,
    credentials: {
      client_email: serviceAccount.client_email,
      private_key: serviceAccount.private_key,
    },
  });

  try {
    switch (cfg.operation) {
      case "query": {
        if (!cfg.query) {
          throw ApplicationFailure.create({
            message: "BigQuery query: `query` is required",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const sql = interpolateTemplate(cfg.query, context);
        const params = cfg.queryParameters
          ? (JSON.parse(interpolateTemplate(cfg.queryParameters, context)) as Record<
              string,
              unknown
            >)
          : undefined;
        const [rows] = await bq.query({
          query: sql,
          useLegacySql: cfg.useLegacySql ?? false,
          params,
          maxResults: cfg.maxResults ?? 100,
        });
        return { ok: true, result: { rows, count: rows.length } };
      }

      case "insertRows": {
        if (!cfg.datasetId || !cfg.tableId || !cfg.rows) {
          throw ApplicationFailure.create({
            message:
              "BigQuery insertRows: `datasetId`, `tableId`, and `rows` are required",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const rowsBody = JSON.parse(
          interpolateTemplate(cfg.rows, context),
        ) as Array<Record<string, unknown>>;
        await bq
          .dataset(cfg.datasetId)
          .table(cfg.tableId)
          .insert(rowsBody);
        return {
          ok: true,
          result: { inserted: rowsBody.length, table: `${cfg.datasetId}.${cfg.tableId}` },
        };
      }

      default:
        throw ApplicationFailure.create({
          message: `Unsupported BigQuery operation: ${(cfg as { operation?: string }).operation}`,
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
    }
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    throw ApplicationFailure.create({
      message: `BigQuery ${cfg.operation} failed: ${(err as Error).message}`,
      type: "UPSTREAM_ERROR",
      nonRetryable: false,
    });
  }
}
