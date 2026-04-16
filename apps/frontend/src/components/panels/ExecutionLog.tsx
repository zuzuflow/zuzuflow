import React, { useEffect, useRef } from "react";
import { X, Trash2 } from "lucide-react";
import { useExecutionStore } from "../../store/executionStore";
import type { LogLevel } from "@workflow/shared";
import { cn } from "../../lib/utils";
import { Badge } from "../../components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "bg-purple-900/60 text-purple-300",
  info:  "bg-blue-900 text-blue-300",
  warn:  "bg-yellow-900 text-yellow-300",
  error: "bg-red-900 text-red-300",
};

function isConsole(entry: { data?: unknown }): boolean {
  return (entry.data as Record<string, unknown> | undefined)?.source === "console";
}

function isDebugInspect(entry: { data?: unknown }): boolean {
  return (entry.data as Record<string, unknown> | undefined)?.source === "debug";
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

export function ExecutionLog(): React.ReactElement | null {
  const executionId = useExecutionStore((s) => s.executionId);
  const status = useExecutionStore((s) => s.status);
  const logs = useExecutionStore((s) => s.logs);
  const isDrawerOpen = useExecutionStore((s) => s.isDrawerOpen);
  const closeDrawer = useExecutionStore((s) => s.closeDrawer);
  const clearExecution = useExecutionStore((s) => s.clearExecution);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new log entries
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs.length]);

  if (!isDrawerOpen && !executionId) return null;

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 192, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="border-t border-border bg-card overflow-hidden flex flex-col shrink-0"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-border shrink-0">
            <span className="text-xs font-semibold text-foreground">Execution Log</span>

            {status && (
              <Badge
                variant={
                  status === "completed"
                    ? "default"
                    : status === "failed"
                    ? "destructive"
                    : "secondary"
                }
                className="capitalize"
              >
                {status.replace("_", " ")}
              </Badge>
            )}

            {executionId && (
              <span className="text-[10px] text-muted-foreground font-mono truncate flex-1">
                {executionId}
              </span>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={clearExecution}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="Clear logs"
              >
                <Trash2 size={12} />
              </button>
              <button
                onClick={closeDrawer}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Close"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Log list */}
          <div className="flex-1 overflow-y-auto px-2 py-1">
            {logs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[11px] text-muted-foreground">
                {status === "running" || status === "pending"
                  ? "Waiting for log entries..."
                  : "No logs"}
              </div>
            ) : (
              <div className="space-y-0.5">
                {logs.map((entry, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-start gap-2 py-0.5 hover:bg-muted rounded px-1 group",
                      isConsole(entry) && "bg-yellow-950/20",
                      isDebugInspect(entry) && "bg-purple-950/20"
                    )}
                  >
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0 pt-0.5 w-16">
                      {formatTime(entry.timestamp)}
                    </span>
                    <span
                      className={cn(
                        "px-1.5 py-0.5 text-[9px] font-bold rounded uppercase shrink-0",
                        LOG_LEVEL_COLORS[entry.level]
                      )}
                    >
                      {entry.level}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                      [{entry.nodeKind}]
                    </span>
                    {isConsole(entry) && (
                      <span className="px-1 py-0.5 text-[9px] font-bold rounded bg-yellow-800/60 text-yellow-300 shrink-0">
                        console
                      </span>
                    )}
                    {isDebugInspect(entry) && (
                      <span className="px-1 py-0.5 text-[9px] font-bold rounded bg-purple-800/60 text-purple-300 shrink-0">
                        inspect
                      </span>
                    )}
                    <span className={cn(
                      "text-[11px] flex-1 break-all leading-relaxed",
                      isDebugInspect(entry) ? "font-mono text-emerald-300 whitespace-pre-wrap" : "text-foreground",
                      isConsole(entry) && "font-mono text-yellow-200"
                    )}>
                      {entry.message}
                    </span>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
