import { log, ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import * as amqplib from "amqplib";
import type {
  RabbitMQConfig,
  RabbitMQQueueOptions,
  RabbitMQExchangeOptions,
  RabbitMQMessageProperties,
} from "@workflow/shared";

// =============================================================================
// RabbitMQ activity — consume / publish_queue / publish_exchange
//
// Uses amqplib (dynamically required). If not installed, operations stub.
// Install: pnpm add amqplib && pnpm add -D @types/amqplib
//
// Consumer reconnection:
//   When the AMQP connection drops during a consume, the activity automatically
//   reconnects with exponential backoff (1 s → 2 s → 4 s … capped at 30 s)
//   and re-registers the consumer on the new channel.  The overall deadline
//   (timeoutMs) is always respected — if the clock runs out before a message
//   arrives, the activity returns { message: null }.
// =============================================================================

export interface RabbitMQActivityInput {
  config: RabbitMQConfig;
  context: Record<string, unknown>;
  /** Resolved AMQP URL from credential (overrides config.amqpUrl) */
  resolvedUrl?: string;
}

export interface RabbitMQActivityOutput {
  operation: string;
  // consume
  message?: unknown;
  content?: string;
  fields?: Record<string, unknown>;
  properties?: Record<string, unknown>;
  acked?: boolean;
  // publish
  published?: boolean;
  destination?: string;
  routingKey?: string;
}

// ─── Result discriminated union used inside consumeWithReconnect ──────────────

type ConsumeResult =
  | { kind: "message"; msg: any }
  | { kind: "timeout" }
  | { kind: "reconnect"; reason: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveKVArray(
  arr: Array<{ key: string; value: string }> | undefined,
  context: Record<string, unknown>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { key, value } of arr ?? []) {
    if (key) out[key] = interpolateTemplate(value, context);
  }
  return out;
}

function buildQueueOpts(opts: RabbitMQQueueOptions | undefined, context: Record<string, unknown>) {
  return {
    durable:    opts?.durable    ?? true,
    exclusive:  opts?.exclusive  ?? false,
    autoDelete: opts?.autoDelete ?? false,
    arguments:  resolveKVArray(opts?.arguments, context),
  };
}

function buildExchangeOpts(opts: RabbitMQExchangeOptions | undefined, context: Record<string, unknown>) {
  return {
    durable:    opts?.durable    ?? true,
    autoDelete: opts?.autoDelete ?? false,
    internal:   opts?.internal   ?? false,
    arguments:  resolveKVArray(opts?.arguments, context),
  };
}

function buildMessageOpts(props: RabbitMQMessageProperties | undefined, context: Record<string, unknown>) {
  if (!props) return { persistent: true };
  return {
    persistent:      props.persistent      ?? true,
    contentType:     props.contentType,
    contentEncoding: props.contentEncoding,
    headers:         resolveKVArray(props.headers, context),
    priority:        props.priority,
    correlationId:   props.correlationId ? interpolateTemplate(props.correlationId, context) : undefined,
    replyTo:         props.replyTo        ? interpolateTemplate(props.replyTo,        context) : undefined,
    expiration:      props.expiration,
    messageId:       props.messageId      ? interpolateTemplate(props.messageId,      context) : undefined,
    type:            props.type,
    appId:           props.appId,
  };
}

/** Sleep for at most `ms` milliseconds, but never past `deadline`. */
function sleepUntil(ms: number, deadline: number): Promise<void> {
  const capped = Math.min(ms, deadline - Date.now());
  if (capped <= 0) return Promise.resolve();
  return new Promise((r) => setTimeout(r, capped));
}

// =============================================================================
// consumeWithReconnect
//
// Opens an AMQP connection, asserts the queue, and waits for exactly one
// message.  If the connection drops before the message arrives the function
// closes the broken connection, waits with exponential back-off, then starts
// the whole sequence again — until either a message is received or the
// deadline is reached.
// =============================================================================

interface ConsumeParams {
  amqpUrl:      string;
  queueName:    string;
  assertQueue:  boolean;
  queueOpts:    ReturnType<typeof buildQueueOpts>;
  prefetch:     number | undefined;
  noAck:        boolean;
  consumerTag:  string | undefined;
  deadline:     number; // absolute Date.now() deadline
}

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS  = 30_000;

async function consumeWithReconnect(p: ConsumeParams): Promise<{ msg: any | null; connection: any; channel: any }> {
  let attempt = 0;

  while (Date.now() < p.deadline) {
    let connection: any = null;
    let channel:    any = null;

    try {
      // ── Connect ────────────────────────────────────────────────────────────
      log.info(`RabbitMQ consume attempt ${attempt + 1}`, { queue: p.queueName });
      connection = await amqplib.connect(p.amqpUrl);
      channel    = await connection.createChannel();

      // ── Assert queue ───────────────────────────────────────────────────────
      if (p.assertQueue) {
        await channel.assertQueue(p.queueName, p.queueOpts);
      }
      if (p.prefetch != null) {
        await channel.prefetch(p.prefetch);
      }

      // ── Wait for a message (or connection close / timeout) ─────────────────
      const result = await new Promise<ConsumeResult>((resolve) => {
        const remaining = p.deadline - Date.now();
        if (remaining <= 0) { resolve({ kind: "timeout" }); return; }

        // Overall deadline timer
        const timer = setTimeout(() => resolve({ kind: "timeout" }), remaining);

        // Detect connection-level drops (both close and error fire before channel becomes unusable)
        const onConnectionClose = (err?: Error) => {
          clearTimeout(timer);
          resolve({ kind: "reconnect", reason: err?.message ?? "connection closed" });
        };
        connection.once("close", onConnectionClose);
        connection.once("error", onConnectionClose);

        // Detect channel-level cancellation (broker-initiated queue deletion, etc.)
        channel.once("close", () => {
          clearTimeout(timer);
          resolve({ kind: "reconnect", reason: "channel closed by broker" });
        });
        channel.once("error", (err: Error) => {
          clearTimeout(timer);
          resolve({ kind: "reconnect", reason: `channel error: ${err.message}` });
        });

        // Register consumer
        channel
          .consume(
            p.queueName,
            (msg: any) => {
              // amqplib calls with null when the consumer is cancelled server-side
              if (msg === null) {
                clearTimeout(timer);
                resolve({ kind: "reconnect", reason: "consumer cancelled by broker" });
                return;
              }
              clearTimeout(timer);
              connection.removeListener("close", onConnectionClose);
              connection.removeListener("error", onConnectionClose);
              resolve({ kind: "message", msg });
            },
            {
              noAck:       p.noAck,
              consumerTag: p.consumerTag || undefined,
            }
          )
          .catch((err: Error) => {
            clearTimeout(timer);
            resolve({ kind: "reconnect", reason: `consume registration failed: ${err.message}` });
          });
      });

      // ── Handle result ──────────────────────────────────────────────────────
      if (result.kind === "timeout") {
        // Caller will clean up connection/channel
        return { msg: null, connection, channel };
      }

      if (result.kind === "message") {
        return { msg: result.msg, connection, channel };
      }

      // result.kind === "reconnect"
      log.warn(`RabbitMQ connection lost (${result.reason}) — will reconnect`);

    } catch (err) {
      log.warn(`RabbitMQ connect/setup error: ${(err as Error).message}`);
    }

    // ── Clean up broken connection before next attempt ─────────────────────
    try { await channel?.close();     } catch { /* already closed */ }
    try { await connection?.close();  } catch { /* already closed */ }

    attempt++;
    const backoff = Math.min(RECONNECT_BASE_MS * Math.pow(2, attempt - 1), RECONNECT_MAX_MS);
    log.info(`RabbitMQ reconnecting in ${backoff}ms (attempt ${attempt + 1})…`);
    await sleepUntil(backoff, p.deadline);
  }

  // Deadline exhausted across all attempts
  return { msg: null, connection: null, channel: null };
}

// =============================================================================
// Main activity
// =============================================================================

export async function rabbitmqActivity(
  input: RabbitMQActivityInput
): Promise<RabbitMQActivityOutput> {
  const { config: cfg, context, resolvedUrl } = input;

  const amqpUrl   = resolvedUrl ?? (cfg.amqpUrl ? interpolateTemplate(cfg.amqpUrl, context) : "amqp://localhost");
  const timeoutMs = cfg.timeoutMs ?? 30_000;

  // ─── CONSUME ─────────────────────────────────────────────────────────────────

  if (cfg.operation === "consume") {
    const queueName = interpolateTemplate(cfg.queueName ?? "", context);
    if (!queueName) {
      throw ApplicationFailure.create({
        message:      "queueName is required for consume",
        type:         "CONFIG_ERROR",
        nonRetryable: true,
      });
    }

    const deadline = Date.now() + timeoutMs;

    const { msg, connection, channel } = await consumeWithReconnect({
      amqpUrl,
      queueName,
      assertQueue: cfg.assertQueue !== false,
      queueOpts:   buildQueueOpts(cfg.queueOptions, context),
      prefetch:    cfg.prefetchCount,
      noAck:       cfg.noAck ?? false,
      consumerTag: cfg.consumerTag || undefined,
      deadline,
    });

    try {
      if (msg && !cfg.noAck) {
        try { channel?.ack(msg); } catch { /* channel may already be gone on reconnect edge case */ }
      }

      if (!msg) {
        log.warn(`RabbitMQ consume timed out after ${timeoutMs}ms — no message received`);
        return { operation: "consume", message: null, acked: false };
      }

      const contentStr = msg.content.toString("utf8");
      let parsed: unknown = contentStr;
      try { parsed = JSON.parse(contentStr); } catch { /* keep raw string */ }

      return {
        operation: "consume",
        message:   parsed,
        content:   contentStr,
        fields: {
          exchange:    msg.fields.exchange,
          routingKey:  msg.fields.routingKey,
          redelivered: msg.fields.redelivered,
        },
        properties: {
          contentType:   msg.properties.contentType,
          correlationId: msg.properties.correlationId,
          replyTo:       msg.properties.replyTo,
          messageId:     msg.properties.messageId,
          headers:       msg.properties.headers,
          deliveryMode:  msg.properties.deliveryMode,
          priority:      msg.properties.priority,
        },
        acked: !cfg.noAck,
      };
    } finally {
      try { await channel?.close();    } catch { /* ignore */ }
      try { await connection?.close(); } catch { /* ignore */ }
    }
  }

  // ─── PUBLISH operations — single-attempt with ApplicationFailure on error ───

  let connection: any;
  let channel:    any;

  try {
    connection = await amqplib.connect(amqpUrl);
    channel    = await connection.createChannel();

    // ── PUBLISH TO QUEUE ──────────────────────────────────────────────────────

    if (cfg.operation === "publish_queue") {
      const queueName = interpolateTemplate(cfg.queueName ?? "", context);
      if (!queueName) {
        throw ApplicationFailure.create({
          message:      "queueName is required for publish_queue",
          type:         "CONFIG_ERROR",
          nonRetryable: true,
        });
      }

      if (cfg.assertQueue !== false) {
        await channel.assertQueue(queueName, buildQueueOpts(cfg.queueOptions, context));
      }

      const body = interpolateTemplate(cfg.messageBody ?? "", context);
      const opts = buildMessageOpts(cfg.messageProperties, context);

      log.info("RabbitMQ publish_queue", { queue: queueName });

      const ok = channel.sendToQueue(queueName, Buffer.from(body, "utf8"), opts);
      await channel.waitForConfirms?.().catch(() => {});

      return { operation: "publish_queue", published: ok, destination: queueName };
    }

    // ── PUBLISH TO EXCHANGE ───────────────────────────────────────────────────

    if (cfg.operation === "publish_exchange") {
      const exchangeName = interpolateTemplate(cfg.exchangeName ?? "", context);
      const routingKey   = interpolateTemplate(cfg.routingKey   ?? "", context);
      if (!exchangeName) {
        throw ApplicationFailure.create({
          message:      "exchangeName is required for publish_exchange",
          type:         "CONFIG_ERROR",
          nonRetryable: true,
        });
      }

      const exchangeType = cfg.exchangeOptions?.type ?? "direct";

      if (cfg.assertExchange !== false) {
        await channel.assertExchange(exchangeName, exchangeType, buildExchangeOpts(cfg.exchangeOptions, context));
      }

      const body = interpolateTemplate(cfg.messageBody ?? "", context);
      const opts = buildMessageOpts(cfg.messageProperties, context);

      log.info("RabbitMQ publish_exchange", { exchange: exchangeName, routingKey, type: exchangeType });

      const ok = channel.publish(exchangeName, routingKey, Buffer.from(body, "utf8"), opts);
      await channel.waitForConfirms?.().catch(() => {});

      return { operation: "publish_exchange", published: ok, destination: exchangeName, routingKey };
    }

    throw ApplicationFailure.create({
      message:      `Unknown RabbitMQ operation: ${cfg.operation}`,
      type:         "CONFIG_ERROR",
      nonRetryable: true,
    });

  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    throw ApplicationFailure.create({
      message:      `RabbitMQ ${cfg.operation} failed: ${(err as Error).message}`,
      type:         "RABBITMQ_ERROR",
      nonRetryable: false,
    });
  } finally {
    try { await channel?.close();    } catch { /* ignore */ }
    try { await connection?.close(); } catch { /* ignore */ }
  }
}
