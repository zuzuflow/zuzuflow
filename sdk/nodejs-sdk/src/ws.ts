// =============================================================================
// WebSocket helper — async-iterable stream of execution events.
//
// Connects to `${wsBaseUrl(baseUrl)}/ws/executions?id=<execId>&token=<tok>`,
// buffers incoming events, and yields them until the execution reaches a
// terminal state (completed / failed / cancelled) or the caller-supplied
// timeout elapses.
// =============================================================================

import WebSocket from "ws";
import { TriggerTimeoutError } from "./errors";
import type { EventKind, ExecutionEvent, WatchOptions } from "./types";

export type WsFactory = (url: string) => WebSocket;

const TERMINAL_KINDS: ReadonlySet<EventKind> = new Set([
  "execution_completed",
  "execution_failed",
  "execution_cancelled",
]);

/**
 * Derive the WebSocket base URL from the REST base URL.
 *   "http://host"   → "ws://host"
 *   "https://host"  → "wss://host"
 */
export function wsBaseUrl(baseUrl: string): string {
  return baseUrl
    .replace(/\/$/, "")
    .replace(/^http:\/\//, "ws://")
    .replace(/^https:\/\//, "wss://");
}

export interface WatchConfig {
  baseUrl: string;
  token: string;
  wsFactory?: WsFactory;
}

export async function* watchExecution(
  cfg: WatchConfig,
  executionId: string,
  options: WatchOptions = {}
): AsyncGenerator<ExecutionEvent> {
  const { timeoutMs = 300_000 } = options;

  const url = `${wsBaseUrl(cfg.baseUrl)}/ws/executions?id=${encodeURIComponent(
    executionId
  )}&token=${encodeURIComponent(cfg.token)}`;

  const queue: ExecutionEvent[] = [];
  let resolveWait: (() => void) | null = null;
  let done = false;
  let wsError: Error | null = null;

  const ws = (cfg.wsFactory ?? ((u) => new WebSocket(u)))(url);

  const notify = () => {
    resolveWait?.();
    resolveWait = null;
  };

  ws.on("message", (raw: Buffer | ArrayBuffer | string) => {
    try {
      const event = JSON.parse(raw.toString()) as ExecutionEvent;
      queue.push(event);
      if (TERMINAL_KINDS.has(event.kind)) done = true;
      notify();
    } catch {
      /* ignore malformed messages */
    }
  });

  ws.on("error", (err: Error) => {
    wsError = err;
    done = true;
    notify();
  });

  ws.on("close", () => {
    done = true;
    notify();
  });

  // Wait for the connection to open before yielding anything.
  await new Promise<void>((resolve, reject) => {
    ws.once("open", () => resolve());
    ws.once("error", (err: Error) => reject(err));
  });

  const deadline = Date.now() + timeoutMs;

  try {
    while (true) {
      while (queue.length > 0) {
        const event = queue.shift()!;
        // Internal server ack — not interesting to callers.
        if ((event.kind as string) === "subscribed") continue;
        yield event;
        if (TERMINAL_KINDS.has(event.kind)) return;
      }

      if (done) break;

      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new TriggerTimeoutError(executionId, timeoutMs);
      }

      await Promise.race([
        new Promise<void>((resolve) => {
          resolveWait = resolve;
        }),
        new Promise<void>((_, reject) =>
          setTimeout(
            () => reject(new TriggerTimeoutError(executionId, timeoutMs)),
            remaining
          )
        ),
      ]);
    }

    if (wsError) throw wsError;
  } finally {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  }
}
