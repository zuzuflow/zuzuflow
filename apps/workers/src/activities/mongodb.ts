import { MongoClient } from "mongodb";
import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { MongodbConfig } from "@workflow/shared";

// =============================================================================
// mongodbActivity — performs a MongoDB operation
// =============================================================================

export interface MongodbActivityInput {
  config: MongodbConfig;
  context: Record<string, unknown>;
  resolvedUri?: string;
}

export interface MongodbActivityOutput {
  result: unknown;
  ok: boolean;
}

export async function mongodbActivity(
  input: MongodbActivityInput
): Promise<MongodbActivityOutput> {
  const { config: cfg, context, resolvedUri } = input;

  const uri = resolvedUri ?? cfg.uri ?? "";
  if (!uri) {
    throw ApplicationFailure.create({
      message: "MongoDB: no URI provided",
      type: "MONGO_CONFIG_ERROR",
      nonRetryable: true,
    });
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(cfg.database);
    const col = db.collection(cfg.collection);

    let result: unknown;

    switch (cfg.operation) {
      case "findOne": {
        const filter = cfg.filter ? JSON.parse(interpolateTemplate(cfg.filter, context)) : {};
        result = await col.findOne(filter);
        break;
      }
      case "find": {
        const filter = cfg.filter ? JSON.parse(interpolateTemplate(cfg.filter, context)) : {};
        result = await col.find(filter).toArray();
        break;
      }
      case "insertOne": {
        const doc = cfg.document
          ? JSON.parse(interpolateTemplate(cfg.document, context))
          : {};
        result = await col.insertOne(doc);
        break;
      }
      case "updateOne": {
        const filter = cfg.filter ? JSON.parse(interpolateTemplate(cfg.filter, context)) : {};
        const update = cfg.update
          ? JSON.parse(interpolateTemplate(cfg.update, context))
          : {};
        result = await col.updateOne(filter, update);
        break;
      }
      case "deleteOne": {
        const filter = cfg.filter ? JSON.parse(interpolateTemplate(cfg.filter, context)) : {};
        result = await col.deleteOne(filter);
        break;
      }
      default:
        throw ApplicationFailure.create({
          message: `Unknown MongoDB operation: ${cfg.operation}`,
          type: "MONGO_UNSUPPORTED_OP",
          nonRetryable: true,
        });
    }

    return { result, ok: true };
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    throw ApplicationFailure.create({
      message: `MongoDB ${cfg.operation} failed: ${(err as Error).message}`,
      type: "MONGO_OPERATION_ERROR",
      nonRetryable: false,
    });
  } finally {
    await client.close();
  }
}
