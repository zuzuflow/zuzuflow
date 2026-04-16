import Redis from "ioredis";
import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { RedisConfig } from "@workflow/shared";

// =============================================================================
// redisActivity — performs a Redis key-value operation
// =============================================================================

export interface RedisActivityInput {
  config: RedisConfig;
  context: Record<string, unknown>;
  resolvedUrl?: string;
}

export interface RedisActivityOutput {
  result: unknown;
  ok: boolean;
}

export async function redisActivity(
  input: RedisActivityInput
): Promise<RedisActivityOutput> {
  const { config: cfg, context, resolvedUrl } = input;

  const url = resolvedUrl ?? cfg.url ?? "redis://localhost:6379";
  const client = new Redis(url, { lazyConnect: true, enableOfflineQueue: false });

  try {
    await client.connect();

    const key = interpolateTemplate(cfg.key, context);
    let result: unknown;

    switch (cfg.operation) {
      case "get":
        result = await client.get(key);
        break;
      case "set": {
        const value = interpolateTemplate(cfg.value ?? "", context);
        if (cfg.ttl != null && cfg.ttl > 0) {
          result = await client.set(key, value, "EX", cfg.ttl);
        } else {
          result = await client.set(key, value);
        }
        break;
      }
      case "del":
        result = await client.del(key);
        break;
      case "expire": {
        const ttl = cfg.ttl ?? 60;
        result = await client.expire(key, ttl);
        break;
      }
      case "exists":
        result = await client.exists(key);
        break;
      default:
        throw ApplicationFailure.create({
          message: `Unknown Redis operation: ${cfg.operation}`,
          type: "REDIS_UNSUPPORTED_OP",
          nonRetryable: true,
        });
    }

    return { result, ok: true };
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    throw ApplicationFailure.create({
      message: `Redis ${cfg.operation} failed: ${(err as Error).message}`,
      type: "REDIS_OPERATION_ERROR",
      nonRetryable: false,
    });
  } finally {
    client.disconnect();
  }
}
