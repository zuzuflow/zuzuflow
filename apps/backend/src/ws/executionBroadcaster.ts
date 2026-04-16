import { WebSocket, WebSocketServer } from "ws";
import * as http from "http";
import jwt from "jsonwebtoken";
import { logger } from "../logger";
import { config } from "../config";
import { apiTokenService } from "../services/ApiTokenService";
import type { ExecutionEvent } from "@workflow/shared";

// =============================================================================
// ExecutionBroadcaster — WebSocket server for real-time execution updates
//
// Clients connect to:
//   ws://host/ws/executions/:executionId
//
// The server parses the URL path to determine which execution to subscribe to.
// When the worker calls broadcast(), all subscribed clients receive the event.
// =============================================================================

/** executionId → set of connected WebSocket clients */
const subscriptions = new Map<string, Set<WebSocket>>();

let wss: WebSocketServer | null = null;

/**
 * Attach the WebSocket server to an existing HTTP server.
 * Call this once during app startup.
 */
export function attachWebSocketServer(server: http.Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: "/ws/executions" });

  wss.on("connection", async (ws: WebSocket, req: http.IncomingMessage) => {
    const url = new URL(req.url ?? "", `http://${req.headers.host ?? "localhost"}`);
    const executionId = url.searchParams.get("id");
    const token = url.searchParams.get("token");

    // Verify token: master token, JWT, or wf_* API token
    const validMaster = token && token.length === config.API_TOKEN.length &&
      (() => { let ok = true; for (let i = 0; i < token.length; i++) if (token.charCodeAt(i) !== config.API_TOKEN.charCodeAt(i)) ok = false; return ok; })();
    let validJwt = false;
    if (!validMaster && token) {
      try { jwt.verify(token, config.JWT_SECRET); validJwt = true; } catch { /* invalid */ }
    }
    let validApiToken = false;
    if (!validMaster && !validJwt && token?.startsWith("wf_")) {
      try { validApiToken = await apiTokenService.verifyRawToken(token); } catch { /* invalid */ }
    }
    if (!validMaster && !validJwt && !validApiToken) {
      ws.close(1008, "Unauthorized");
      return;
    }

    if (!executionId) {
      ws.close(1008, "Missing executionId query parameter");
      return;
    }

    subscribe(executionId, ws);
    logger.debug("WS client subscribed", { executionId });

    // Ping-pong to detect stale connections
    (ws as any).isAlive = true;
    ws.on("pong", () => {
      (ws as any).isAlive = true;
    });

    ws.on("close", () => {
      cleanup(executionId, ws);
      logger.debug("WS client disconnected", { executionId });
    });

    ws.on("error", (err) => {
      logger.warn("WS client error", { executionId, err });
      cleanup(executionId, ws);
    });

    // Acknowledge subscription
    safeSend(ws, {
      kind: "subscribed",
      executionId,
      timestamp: new Date().toISOString(),
    });
  });

  // Heartbeat interval — prune dead connections every 30s
  const heartbeat = setInterval(() => {
    wss!.clients.forEach((ws) => {
      if ((ws as any).isAlive === false) {
        ws.terminate();
        return;
      }
      (ws as any).isAlive = false;
      ws.ping();
    });
  }, 30_000);

  wss.on("close", () => clearInterval(heartbeat));

  logger.info("WebSocket server attached at /ws/executions");
  return wss;
}

/**
 * Subscribe a WebSocket client to execution updates.
 */
export function subscribe(executionId: string, ws: WebSocket): void {
  if (!subscriptions.has(executionId)) {
    subscriptions.set(executionId, new Set());
  }
  subscriptions.get(executionId)!.add(ws);
}

/**
 * Broadcast an execution event to all subscribed clients.
 * Called by the worker or a separate status-update process.
 */
export function broadcast(executionId: string, event: ExecutionEvent): void {
  const clients = subscriptions.get(executionId);
  if (!clients || clients.size === 0) return;

  const payload = JSON.stringify(event);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload, (err) => {
        if (err) {
          logger.warn("WS send error", { executionId, err });
        }
      });
    }
  }
}

/**
 * Remove a single client from an execution's subscriber set.
 */
export function cleanup(executionId: string, ws: WebSocket): void {
  const clients = subscriptions.get(executionId);
  if (!clients) return;
  clients.delete(ws);
  if (clients.size === 0) {
    subscriptions.delete(executionId);
  }
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function safeSend(ws: WebSocket, data: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}
