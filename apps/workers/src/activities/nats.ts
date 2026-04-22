import { ApplicationFailure } from "@temporalio/activity";
import { interpolateTemplate } from "@workflow/shared";
import type { NatsConfig } from "@workflow/shared";

// =============================================================================
// natsActivity — NATS + JetStream via nats.js (lazy-imported)
//
// Credential: { servers, user?, pass?, token? } — servers is CSV list.
// =============================================================================

export interface NatsActivityInput {
  config: NatsConfig;
  context: Record<string, unknown>;
  resolvedCredentials?: {
    servers?: string;
    user?: string;
    pass?: string;
    token?: string;
  };
}

export interface NatsActivityOutput {
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
      message: `NATS ${label}: invalid JSON — ${(err as Error).message}`,
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
      message: `NATS: \`${label}\` is required`,
      type: "VALIDATION_ERROR",
      nonRetryable: true,
    });
  }
  return val;
}

export async function natsActivity(
  input: NatsActivityInput,
): Promise<NatsActivityOutput> {
  const { config: cfg, context, resolvedCredentials } = input;
  const serversRaw = resolvedCredentials?.servers;
  if (!serversRaw) {
    throw ApplicationFailure.create({
      message: "NATS credential is missing — supply `{ servers }` (CSV).",
      type: "AUTH_ERROR",
      nonRetryable: true,
    });
  }
  const servers = serversRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const { connect, headers: createHeaders, StringCodec } = await import("nats");
  const sc = StringCodec();

  const authOpts: Record<string, unknown> = {};
  if (resolvedCredentials?.token) authOpts.token = resolvedCredentials.token;
  else if (resolvedCredentials?.user || resolvedCredentials?.pass) {
    authOpts.user = resolvedCredentials.user;
    authOpts.pass = resolvedCredentials.pass;
  }

  const nc = await connect({
    servers,
    timeout: Math.min(Math.max(cfg.timeoutMs ?? 5000, 100), 60000),
    ...authOpts,
  });

  const subject = mustString("subject", cfg.subject, context);
  const headersObj = parseJson<Record<string, string>>(
    "headers",
    cfg.headers,
    context,
  );
  function buildHeaders() {
    if (!headersObj && !cfg.msgId) return undefined;
    const h = createHeaders();
    if (headersObj) for (const [k, v] of Object.entries(headersObj)) h.set(k, v);
    if (cfg.msgId) h.set("Nats-Msg-Id", interpolateTemplate(cfg.msgId, context));
    return h;
  }

  try {
    switch (cfg.operation) {
      case "publish": {
        const payload = cfg.payload ? interpolateTemplate(cfg.payload, context) : "";
        const replyTo = cfg.replyTo
          ? interpolateTemplate(cfg.replyTo, context)
          : undefined;
        nc.publish(subject, sc.encode(payload), {
          ...(replyTo ? { reply: replyTo } : {}),
          ...(buildHeaders() ? { headers: buildHeaders() } : {}),
        });
        await nc.flush();
        return { ok: true, result: { published: true, subject } };
      }
      case "request": {
        const payload = cfg.payload ? interpolateTemplate(cfg.payload, context) : "";
        const msg = await nc.request(subject, sc.encode(payload), {
          timeout: Math.min(Math.max(cfg.timeoutMs ?? 5000, 100), 60000),
          ...(buildHeaders() ? { headers: buildHeaders() } : {}),
        });
        return {
          ok: true,
          result: {
            subject: msg.subject,
            data: sc.decode(msg.data),
          },
        };
      }
      case "subscribe": {
        const max = Math.min(Math.max(cfg.maxMessages ?? 1, 1), 1000);
        const timeout = Math.min(Math.max(cfg.timeoutMs ?? 5000, 100), 60000);
        const messages: Array<{ subject: string; data: string }> = [];
        const sub = nc.subscribe(subject, { max });
        const done = new Promise<void>((resolve) => {
          const timer = setTimeout(() => {
            sub.unsubscribe();
            resolve();
          }, timeout);
          (async () => {
            for await (const m of sub) {
              messages.push({
                subject: m.subject,
                data: sc.decode(m.data),
              });
              if (messages.length >= max) {
                clearTimeout(timer);
                break;
              }
            }
            resolve();
          })();
        });
        await done;
        return { ok: true, result: { messages, count: messages.length } };
      }
      case "jetstream.publish": {
        if (!cfg.stream) {
          throw ApplicationFailure.create({
            message: "NATS jetstream.publish: `stream` is required",
            type: "VALIDATION_ERROR",
            nonRetryable: true,
          });
        }
        const js = nc.jetstream();
        const payload = cfg.payload ? interpolateTemplate(cfg.payload, context) : "";
        const msgId = cfg.msgId
          ? interpolateTemplate(cfg.msgId, context)
          : undefined;
        const ack = await js.publish(subject, sc.encode(payload), {
          ...(msgId ? { msgID: msgId } : {}),
        });
        return {
          ok: true,
          result: {
            stream: ack.stream,
            seq: ack.seq,
            duplicate: ack.duplicate,
          },
        };
      }
      default:
        throw ApplicationFailure.create({
          message: `Unsupported NATS operation: ${(cfg as { operation?: string }).operation}`,
          type: "VALIDATION_ERROR",
          nonRetryable: true,
        });
    }
  } catch (err) {
    if (err instanceof ApplicationFailure) throw err;
    const e = err as { code?: string; message?: string };
    throw ApplicationFailure.create({
      message: `NATS ${cfg.operation} failed: ${e.message ?? String(err)}`,
      type:
        e.code === "AUTHORIZATION_VIOLATION" || e.code === "AUTHENTICATION_EXPIRED"
          ? "AUTH_ERROR"
          : "UPSTREAM_ERROR",
      nonRetryable:
        e.code === "AUTHORIZATION_VIOLATION" ||
        e.code === "AUTHENTICATION_EXPIRED",
      details: [{ code: e.code, operation: cfg.operation }],
    });
  } finally {
    await nc.close().catch(() => undefined);
  }
}
