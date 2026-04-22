import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { AzureCosmosConfig } from "@workflow/shared";

export interface AzureCosmosActivityInput {
  config: AzureCosmosConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    connectionString?: string;
    cosmosEndpoint?: string;
    cosmosKey?: string;
  };
}

export interface AzureCosmosActivityOutput {
  result: unknown;
  ok: boolean;
}

/**
 * Azure Cosmos DB — multi-model NoSQL. Supports either a full connection
 * string or an endpoint + primary key pair. Lazy-loads @azure/cosmos.
 */
export async function azureCosmosActivity(
  input: AzureCosmosActivityInput,
): Promise<AzureCosmosActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;

  const { CosmosClient } = await import("@azure/cosmos");
  let client: InstanceType<typeof CosmosClient>;
  if (resolvedCredentials?.connectionString) {
    client = new CosmosClient(resolvedCredentials.connectionString);
  } else if (
    resolvedCredentials?.cosmosEndpoint &&
    resolvedCredentials?.cosmosKey
  ) {
    client = new CosmosClient({
      endpoint: resolvedCredentials.cosmosEndpoint,
      key: resolvedCredentials.cosmosKey,
    });
  } else {
    throw ApplicationFailure.create({
      message:
        "Azure Cosmos DB requires a connection string OR a cosmosEndpoint + cosmosKey pair in the credential.",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }

  const dbId = interpolateTemplate(cfg.databaseId, context);
  const containerId = interpolateTemplate(cfg.containerId, context);
  const container = client.database(dbId).container(containerId);
  const pk = cfg.partitionKey
    ? interpolateTemplate(cfg.partitionKey, context)
    : undefined;

  try {
    switch (cfg.operation) {
      case "query": {
        // Cosmos's SqlParameter.value is typed as JSONValue; we cast after
        // parse to bridge the runtime vs TS gap.
        const querySpec = {
          query: interpolateTemplate(cfg.query ?? "SELECT * FROM c", context),
          parameters: cfg.queryParameters
            ? (JSON.parse(
                interpolateTemplate(cfg.queryParameters, context),
              ) as Array<{ name: string; value: string | number | boolean | null }>)
            : undefined,
        };
        const { resources } = await container.items
          .query(querySpec, {
            maxItemCount: cfg.maxItems ?? 100,
            partitionKey: pk,
          })
          .fetchAll();
        return { ok: true, result: { items: resources, count: resources.length } };
      }

      case "upsertItem": {
        const body = cfg.item
          ? (JSON.parse(interpolateTemplate(cfg.item, context)) as Record<
              string,
              unknown
            >)
          : {};
        const { resource } = await container.items.upsert(body);
        return { ok: true, result: resource };
      }

      case "readItem": {
        if (!cfg.itemId) {
          throw ApplicationFailure.create({
            message: "Azure Cosmos readItem: `itemId` is required",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const id = interpolateTemplate(cfg.itemId, context);
        const { resource } = await container
          .item(id, pk)
          .read();
        return { ok: true, result: resource };
      }

      case "deleteItem": {
        if (!cfg.itemId) {
          throw ApplicationFailure.create({
            message: "Azure Cosmos deleteItem: `itemId` is required",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const id = interpolateTemplate(cfg.itemId, context);
        await container.item(id, pk).delete();
        return { ok: true, result: { deleted: true, id } };
      }

      default:
        throw ApplicationFailure.create({
          message: `Unsupported Azure Cosmos operation: ${(cfg as { operation?: string }).operation}`,
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
    }
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    const code = (err as { code?: number | string }).code;
    throw ApplicationFailure.create({
      message: `Azure Cosmos ${cfg.operation} failed: ${(err as Error).message}`,
      type:
        code === 401 || code === 403
          ? "AUTH_ERROR"
          : code === 404
            ? "VALIDATION_ERROR"
            : "UPSTREAM_ERROR",
      nonRetryable: code === 401 || code === 403 || code === 404,
    });
  }
}
