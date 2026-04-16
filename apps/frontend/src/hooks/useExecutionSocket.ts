import { useEffect, useRef, useCallback } from "react";
import { useExecutionStore } from "../store/executionStore";
import { getApiConfig } from "../store/apiConfigStore";
import { getExecution } from "../lib/api";
import type { ExecutionStatus, LogLevel } from "@workflow/shared";

const WS_PROTOCOL = window.location.protocol === "https:" ? "wss" : "ws";
const WS_BASE = `${WS_PROTOCOL}://${window.location.host}`;

// ── Matches the ExecutionEvent shape broadcast by the backend ─────────────────
type ExecutionEventKind =
  | "subscribed"
  | "execution_started"
  | "node_started"
  | "node_completed"
  | "node_log"
  | "node_failed"
  | "execution_completed"
  | "execution_failed"
  | "execution_cancelled";

interface ExecutionEvent {
  kind: ExecutionEventKind;
  executionId: string;
  workflowId?: string;
  nodeId?: string;
  nodeKind?: string;
  payload?: {
    message?: string;
    data?: Record<string, unknown>;
    status?: string;
    output?: unknown;
    error?: string;
  };
  timestamp?: string;
}

// Map backend event kinds → ExecutionStatus for the store
const KIND_TO_STATUS: Partial<Record<ExecutionEventKind, ExecutionStatus>> = {
  execution_started: "running",
  execution_completed: "completed",
  execution_failed: "failed",
  execution_cancelled: "cancelled",
};

export function useExecutionSocket(executionId: string | null): void {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  // Track child execution WebSockets (workflow_trigger_out sub-workflows)
  const childWsRefs = useRef<Map<string, WebSocket>>(new Map());

  const appendLog = useExecutionStore((s) => s.appendLog);
  const setNodeStatus = useExecutionStore((s) => s.setNodeStatus);
  const setNodeOutput = useExecutionStore((s) => s.setNodeOutput);
  const setStatus = useExecutionStore((s) => s.setStatus);

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    // Close all child WebSockets (entries may be null while async setup is pending)
    childWsRefs.current.forEach((ws) => {
      if (ws) {
        ws.onclose = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.close();
      }
    });
    childWsRefs.current.clear();
  }, []);

  // Subscribe to a child execution spawned by workflow_trigger_out.
  // Backfills past logs from REST first (to catch events emitted before we
  // opened the WebSocket), then streams live events.
  const connectChild = useCallback(
    (childExecId: string) => {
      if (!isMountedRef.current) return;
      if (childWsRefs.current.has(childExecId)) return; // already subscribed

      // Mark as "in progress" with a placeholder so we don't double-subscribe
      // while the async setup is running.
      childWsRefs.current.set(childExecId, null as unknown as WebSocket);

      // ── Step 1: backfill past logs from REST ────────────────────────────────
      // Track timestamps already seen so WebSocket live events don't duplicate.
      const seenTimestamps = new Set<string>();

      getExecution(childExecId)
        .then((exec) => {
          if (!isMountedRef.current) return;

          // Inject a separator so it's clear child logs are starting
          appendLog({
            nodeId: "",
            nodeKind: "→ child workflow",
            level: "info",
            message: `[child] execution started (id: ${childExecId.slice(0, 8)}…)`,
            timestamp: exec.startedAt,
          });
          seenTimestamps.add(exec.startedAt);

          for (const log of exec.logs ?? []) {
            const ts = log.createdAt;
            seenTimestamps.add(ts);
            appendLog({
              nodeId: log.nodeId,
              nodeKind: `→ ${log.nodeKind}`,
              level: log.level,
              message: `[child] ${log.message}`,
              data: log.data,
              timestamp: ts,
            });
          }

          // If execution already finished, mark done
          if (
            exec.status === "completed" ||
            exec.status === "failed" ||
            exec.status === "cancelled" ||
            exec.status === "timed_out"
          ) {
            appendLog({
              nodeId: "",
              nodeKind: "→ child workflow",
              level: exec.status === "completed" ? "info" : "error",
              message: `[child] execution ${exec.status}`,
              timestamp: exec.completedAt ?? new Date().toISOString(),
            });
            childWsRefs.current.delete(childExecId);
            return; // no need for WebSocket
          }
        })
        .catch(() => {
          // Non-fatal — continue to WebSocket even if backfill fails
        })
        .finally(() => {
          if (!isMountedRef.current) return;
          // ── Step 2: open WebSocket for live events ──────────────────────────
          const { token } = getApiConfig();
          const tokenParam = token ? `&token=${encodeURIComponent(token)}` : "";
          const url = `${WS_BASE}/ws/executions?id=${childExecId}${tokenParam}`;
          let ws: WebSocket;
          try {
            ws = new WebSocket(url);
          } catch {
            childWsRefs.current.delete(childExecId);
            return;
          }

          childWsRefs.current.set(childExecId, ws);

          ws.onmessage = (event) => {
            try {
              const ev = JSON.parse(event.data as string) as ExecutionEvent;
              if (ev.kind === "subscribed") return;

              const ts = ev.timestamp ?? new Date().toISOString();

              // Skip events already injected from REST backfill
              if (seenTimestamps.has(ts)) return;
              seenTimestamps.add(ts);

              const prefixedKind = `→ ${ev.nodeKind ?? "child"}`;
              const prefixedMsg = ev.payload?.message
                ? `[child] ${ev.payload.message}`
                : `[child] ${ev.kind.replace(/_/g, " ")}`;

              appendLog({
                nodeId: ev.nodeId ?? "",
                nodeKind: prefixedKind,
                level: ev.kind === "node_failed" || ev.kind === "execution_failed" ? "error" : "info",
                message: prefixedMsg,
                data: ev.payload?.data as Record<string, unknown> | undefined,
                timestamp: ts,
              });

              if (
                ev.kind === "execution_completed" ||
                ev.kind === "execution_failed" ||
                ev.kind === "execution_cancelled"
              ) {
                ws.onclose = null;
                ws.close();
                childWsRefs.current.delete(childExecId);
              }
            } catch {
              // ignore malformed messages
            }
          };

          ws.onerror = () => {
            ws.close();
            childWsRefs.current.delete(childExecId);
          };

          ws.onclose = () => {
            childWsRefs.current.delete(childExecId);
          };
        });
    },
    [appendLog]
  );

  const connect = useCallback(
    (execId: string) => {
      if (!isMountedRef.current) return;

      cleanup();

      const { token } = getApiConfig();
      const tokenParam = token ? `&token=${encodeURIComponent(token)}` : "";
      const url = `${WS_BASE}/ws/executions?id=${execId}${tokenParam}`;
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        return;
      }

      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const ev = JSON.parse(event.data as string) as ExecutionEvent;

          switch (ev.kind) {
            // ── Node-level events ─────────────────────────────────────────
            case "node_started": {
              if (ev.nodeId) setNodeStatus(ev.nodeId, "running");
              if (ev.nodeId && ev.nodeKind) {
                appendLog({
                  nodeId: ev.nodeId,
                  nodeKind: ev.nodeKind ?? "",
                  level: "info",
                  message: ev.payload?.message ?? `Node started`,
                  data: ev.payload?.data,
                  timestamp: ev.timestamp ?? new Date().toISOString(),
                });
              }
              break;
            }

            case "node_completed": {
              if (ev.nodeId) {
                setNodeStatus(ev.nodeId, "completed");
                // Only set node output from the dedicated "output" field.
                // Use `in` check so an explicit null is still stored correctly.
                const data = ev.payload?.data as Record<string, unknown> | undefined;
                if (data && "output" in data) setNodeOutput(ev.nodeId, data.output);
              }
              appendLog({
                nodeId: ev.nodeId ?? "",
                nodeKind: ev.nodeKind ?? "",
                level: "info",
                message: ev.payload?.message ?? `Node completed`,
                data: ev.payload?.data,
                timestamp: ev.timestamp ?? new Date().toISOString(),
              });

              // If a workflow_trigger_out or subworkflow_call node just completed, subscribe to the child execution
              if (ev.nodeKind === "workflow_trigger_out" || ev.nodeKind === "subworkflow_call") {
                const output = (ev.payload?.data as any)?.output as Record<string, unknown> | undefined;
                const childExecId = (output?.executionId ?? output?.subworkflowExecutionId) as string | undefined;
                if (childExecId) connectChild(childExecId);
              }
              break;
            }

            case "node_log": {
              // Console / inspect logs — append to log panel, no status change
              const data = ev.payload?.data as Record<string, unknown> | undefined;
              appendLog({
                nodeId: ev.nodeId ?? "",
                nodeKind: ev.nodeKind ?? "",
                level: (data?.level as LogLevel | undefined) ?? "info",
                message: ev.payload?.message ?? "",
                data: ev.payload?.data,
                timestamp: ev.timestamp ?? new Date().toISOString(),
              });
              break;
            }

            case "node_failed": {
              if (ev.nodeId) setNodeStatus(ev.nodeId, "failed");
              appendLog({
                nodeId: ev.nodeId ?? "",
                nodeKind: ev.nodeKind ?? "",
                level: "error",
                message: ev.payload?.message ?? `Node failed`,
                data: ev.payload?.data,
                timestamp: ev.timestamp ?? new Date().toISOString(),
              });
              break;
            }

            // ── Execution-level events ────────────────────────────────────
            case "execution_started":
            case "execution_completed":
            case "execution_failed":
            case "execution_cancelled": {
              const status = KIND_TO_STATUS[ev.kind];
              if (status) setStatus(status);

              appendLog({
                nodeId: "",
                nodeKind: "execution",
                level: ev.kind === "execution_failed" ? "error" : "info",
                message: ev.kind.replace(/_/g, " "),
                data: ev.payload as Record<string, unknown> | undefined,
                timestamp: ev.timestamp ?? new Date().toISOString(),
              });

              // Terminal state — stop reconnecting
              if (
                ev.kind === "execution_completed" ||
                ev.kind === "execution_failed" ||
                ev.kind === "execution_cancelled"
              ) {
                cleanup();
              }
              break;
            }

            // ── Subscription ACK — backfill logs from REST ─────────────────
            case "subscribed": {
              // The execution may have already progressed (or completed) before
              // the WebSocket connected. Fetch current state from REST and
              // replay any logs we missed.
              getExecution(ev.executionId)
                .then((exec) => {
                  if (!isMountedRef.current) return;

                  // Update execution status if it has progressed
                  if (exec.status && exec.status !== "pending") {
                    setStatus(exec.status);
                  }

                  // Backfill logs we missed
                  if (exec.logs && exec.logs.length > 0) {
                    const store = useExecutionStore.getState();
                    const existingCount = store.logs.length;
                    // Only backfill if we haven't received live events yet
                    if (existingCount === 0) {
                      for (const log of exec.logs) {
                        appendLog({
                          nodeId: log.nodeId ?? "",
                          nodeKind: log.nodeKind ?? "",
                          level: log.level ?? "info",
                          message: log.message ?? "",
                          data: log.data as Record<string, unknown> | undefined,
                          timestamp: log.createdAt ?? new Date().toISOString(),
                        });

                        // Restore node statuses from log messages
                        if (log.nodeId) {
                          if (log.message?.includes("completed")) {
                            setNodeStatus(log.nodeId, "completed");
                          } else if (log.message?.includes("failed")) {
                            setNodeStatus(log.nodeId, "failed");
                          } else if (log.message?.includes("starting")) {
                            // Only set running if not already completed/failed
                            const curStatus = useExecutionStore.getState().nodeStatuses[log.nodeId];
                            if (!curStatus || curStatus === "running") {
                              setNodeStatus(log.nodeId, "running");
                            }
                          }
                        }
                      }
                    }
                  }

                  // If execution is already terminal, clean up WebSocket
                  if (
                    exec.status === "completed" ||
                    exec.status === "failed" ||
                    exec.status === "cancelled"
                  ) {
                    cleanup();
                  }
                })
                .catch(() => {
                  // Ignore backfill errors — live events will still work
                });
              break;
            }

            default:
              break;
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        const currentStatus = useExecutionStore.getState().status;
        if (
          currentStatus === "running" ||
          currentStatus === "pending" ||
          currentStatus === null
        ) {
          reconnectTimerRef.current = setTimeout(() => {
            if (
              isMountedRef.current &&
              useExecutionStore.getState().executionId === execId
            ) {
              connect(execId);
            }
          }, 2000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    },
    [cleanup, connectChild, appendLog, setNodeStatus, setNodeOutput, setStatus]
  );

  useEffect(() => {
    isMountedRef.current = true;

    if (executionId) {
      connect(executionId);
    } else {
      cleanup();
    }

    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, [executionId, connect, cleanup]);
}
