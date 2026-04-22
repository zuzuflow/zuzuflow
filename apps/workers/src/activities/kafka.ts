import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { KafkaConfig } from "@workflow/shared";

// =============================================================================
// kafkaActivity — Apache Kafka via kafkajs (lazy-imported)
//
// Credential shape:
//   { brokers, clientId?, ssl?, sasl?, saslMechanism?, username?, password? }
//   - brokers: CSV list "host1:9092,host2:9092"
//   - ssl: "true" enables TLS
//   - sasl: "true" enables SASL (requires saslMechanism + username + password)
//   - saslMechanism: "plain" | "scram-sha-256" | "scram-sha-512"
// =============================================================================

export interface KafkaActivityInput {
  config: KafkaConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    brokers?: string;
    clientId?: string;
    ssl?: string;
    sasl?: string;
    saslMechanism?: string;
    username?: string;
    password?: string;
  };
}

export interface KafkaActivityOutput {
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
      message: `Kafka ${label}: invalid JSON — ${(err as Error).message}`,
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
      message: `Kafka: \`${label}\` is required`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  return val;
}

export async function kafkaActivity(
  input: KafkaActivityInput,
): Promise<KafkaActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const brokersRaw = resolvedCredentials?.brokers;
  if (!brokersRaw) {
    throw ApplicationFailure.create({
      message:
        "Kafka credential is missing — supply `{ brokers }` (CSV list).",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }
  const brokers = brokersRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const { Kafka } = await import("kafkajs");

  const ssl = (resolvedCredentials?.ssl ?? "").toLowerCase() === "true";
  const saslEnabled =
    (resolvedCredentials?.sasl ?? "").toLowerCase() === "true" ||
    Boolean(
      resolvedCredentials?.saslMechanism &&
        resolvedCredentials?.username &&
        resolvedCredentials?.password,
    );
  // kafkajs types SASL as a discriminated union keyed by mechanism; at
  // runtime the shape is the same, so cast through a concrete branch.
  const sasl = saslEnabled
    ? ({
        mechanism: resolvedCredentials?.saslMechanism ?? "plain",
        username: resolvedCredentials?.username ?? "",
        password: resolvedCredentials?.password ?? "",
      } as unknown as {
        mechanism: "plain";
        username: string;
        password: string;
      })
    : undefined;

  const kafka = new Kafka({
    clientId: resolvedCredentials?.clientId ?? "zuzuflow",
    brokers,
    ssl,
    ...(sasl ? { sasl } : {}),
  });

  const topic = mustString("topic", cfg.topic, context);

  try {
    switch (cfg.operation) {
      case "produce": {
        const producer = kafka.producer();
        await producer.connect();
        try {
          const value = cfg.messageValue
            ? interpolateTemplate(cfg.messageValue, context)
            : "";
          const key = cfg.messageKey
            ? interpolateTemplate(cfg.messageKey, context)
            : undefined;
          const headersObj = parseJson<Record<string, string>>(
            "headers",
            cfg.headers,
            context,
          );
          const acks = cfg.acks ? Number(cfg.acks) : undefined;
          const result = await producer.send({
            topic,
            ...(typeof acks === "number" ? { acks } : {}),
            messages: [
              {
                ...(key ? { key } : {}),
                value,
                ...(typeof cfg.partition === "number"
                  ? { partition: cfg.partition }
                  : {}),
                ...(headersObj ? { headers: headersObj } : {}),
              },
            ],
          });
          return { ok: true, result };
        } finally {
          await producer.disconnect().catch(() => undefined);
        }
      }
      case "consume": {
        const groupId =
          cfg.groupId ?? `zuzuflow-consumer-${Math.random().toString(36).slice(2, 10)}`;
        const consumer = kafka.consumer({
          groupId,
          sessionTimeout: Math.min(Math.max(cfg.maxWaitMs ?? 30000, 6000), 300000),
        });
        const max = Math.min(Math.max(cfg.maxMessages ?? 10, 1), 1000);
        const maxWaitMs = Math.min(Math.max(cfg.maxWaitMs ?? 5000, 100), 60000);
        await consumer.connect();
        await consumer.subscribe({
          topic,
          fromBeginning: cfg.fromBeginning ?? false,
        });
        const messages: Array<{
          topic: string;
          partition: number;
          offset: string;
          key: string | null;
          value: string | null;
          headers: Record<string, string> | null;
          timestamp: string;
        }> = [];
        await new Promise<void>((resolve) => {
          const timer = setTimeout(() => {
            consumer.disconnect().catch(() => undefined);
            resolve();
          }, maxWaitMs);
          consumer
            .run({
              eachMessage: async ({ topic: t, partition, message }) => {
                messages.push({
                  topic: t,
                  partition,
                  offset: message.offset,
                  key: message.key ? message.key.toString("utf8") : null,
                  value: message.value ? message.value.toString("utf8") : null,
                  headers: message.headers
                    ? Object.fromEntries(
                        Object.entries(message.headers).map(([k, v]) => [
                          k,
                          Buffer.isBuffer(v) ? v.toString("utf8") : String(v ?? ""),
                        ]),
                      )
                    : null,
                  timestamp: message.timestamp,
                });
                if (messages.length >= max) {
                  clearTimeout(timer);
                  await consumer.disconnect().catch(() => undefined);
                  resolve();
                }
              },
            })
            .catch(() => {
              clearTimeout(timer);
              resolve();
            });
        });
        return {
          ok: true,
          result: { messages, count: messages.length, groupId },
        };
      }
      default:
        throw ApplicationFailure.create({
          message: `Unsupported Kafka operation: ${(cfg as { operation?: string }).operation}`,
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
    }
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    const e = err as { name?: string; message?: string; type?: string };
    const isAuth =
      e.type === "SASL_AUTHENTICATION_FAILED" ||
      e.name === "KafkaJSSASLAuthenticationError";
    throw ApplicationFailure.create({
      message: `Kafka ${cfg.operation} failed: ${e.message ?? String(err)}`,
      type: isAuth ? "AUTH_ERROR" : "UPSTREAM_ERROR",
      nonRetryable: isAuth,
      details: [{ name: e.name, operation: cfg.operation }],
    });
  }
}
