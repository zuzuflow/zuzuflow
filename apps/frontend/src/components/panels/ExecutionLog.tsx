import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  X,
  Trash2,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  GripHorizontal,
} from "lucide-react";
import { useExecutionStore } from "../../store/executionStore";
import type { LogLevel } from "@workflow/shared";
import { cn } from "../../lib/utils";
import { Badge } from "../../components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "bg-purple-900/60 text-purple-300",
  info: "bg-blue-900 text-blue-300",
  warn: "bg-yellow-900 text-yellow-300",
  error: "bg-red-900 text-red-300",
};

const MIN_HEIGHT = 120;
const DEFAULT_HEIGHT = 240; // slightly taller than before to fit expanded rows comfortably
const MAX_HEIGHT_FRACTION = 0.85; // maximize fills ~85% of viewport

function maxHeightPx(): number {
  return Math.floor(window.innerHeight * MAX_HEIGHT_FRACTION);
}

function isConsole(entry: { data?: unknown }): boolean {
  return (
    (entry.data as Record<string, unknown> | undefined)?.source === "console"
  );
}

function isDebugInspect(entry: { data?: unknown }): boolean {
  return (
    (entry.data as Record<string, unknown> | undefined)?.source === "debug"
  );
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

/**
 * Returns the data that should actually be shown under an expanded row.
 * Log entries coming from the execution socket may carry `data` with
 * structural metadata (nodeId duplication etc.) that's noisy in the UI —
 * prefer a compact presentation of `input` + `output` when available.
 */
function extractRichData(entry: {
  data?: unknown;
}): { input?: unknown; output?: unknown; raw?: unknown } | null {
  const d = entry.data as Record<string, unknown> | undefined;
  if (!d || typeof d !== "object") return null;
  const input = "input" in d ? d.input : undefined;
  const output = "output" in d ? d.output : undefined;
  if (input === undefined && output === undefined) {
    // No structured input/output — fall back to rendering the full payload.
    const keys = Object.keys(d);
    if (keys.length === 0) return null;
    return { raw: d };
  }
  return { input, output };
}

export function ExecutionLog(): React.ReactElement | null {
  const executionId = useExecutionStore((s) => s.executionId);
  const status = useExecutionStore((s) => s.status);
  const logs = useExecutionStore((s) => s.logs);
  const isDrawerOpen = useExecutionStore((s) => s.isDrawerOpen);
  const closeDrawer = useExecutionStore((s) => s.closeDrawer);
  const clearExecution = useExecutionStore((s) => s.clearExecution);

  const [height, setHeight] = useState<number>(DEFAULT_HEIGHT);
  const [maximized, setMaximized] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new log entries
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs.length]);

  // Clear expanded rows when a new execution starts so we don't keep stale
  // indices pointing at unrelated log entries.
  useEffect(() => {
    setExpandedRows(new Set());
  }, [executionId]);

  const toggleRow = useCallback((idx: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  // Mouse-drag resize for the top edge of the drawer.
  const onResizeStart = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = height;
      const onMove = (mv: MouseEvent) => {
        const delta = startY - mv.clientY; // dragging up increases height
        const next = Math.min(
          maxHeightPx(),
          Math.max(MIN_HEIGHT, startHeight + delta),
        );
        setHeight(next);
        setMaximized(false); // manual resize overrides maximize
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [height],
  );

  const toggleMaximize = useCallback(() => {
    setMaximized((prev) => {
      const next = !prev;
      setHeight(next ? maxHeightPx() : DEFAULT_HEIGHT);
      return next;
    });
  }, []);

  if (!isDrawerOpen && !executionId) return null;

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="border-t border-border bg-card overflow-hidden flex flex-col shrink-0 relative"
        >
          {/* Resize handle — hover highlights; drag up/down to resize */}
          <div
            onMouseDown={onResizeStart}
            onDoubleClick={toggleMaximize}
            className="absolute top-0 left-0 right-0 h-1.5 cursor-row-resize group z-10"
            title="Drag to resize · double-click to maximize"
          >
            <div className="absolute left-1/2 -translate-x-1/2 top-0.5 flex items-center justify-center opacity-30 group-hover:opacity-80 transition-opacity">
              <GripHorizontal size={14} className="text-muted-foreground" />
            </div>
          </div>

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-border shrink-0 pt-3">
            <span className="text-xs font-semibold text-foreground">
              Execution Log
            </span>

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
                onClick={toggleMaximize}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title={maximized ? "Restore default size" : "Maximize"}
              >
                {maximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
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
          <div className="flex-1 overflow-y-auto px-2 py-1 min-h-0">
            {logs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[11px] text-muted-foreground">
                {status === "running" || status === "pending"
                  ? "Waiting for log entries..."
                  : "No logs"}
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {logs.map((entry, idx) => {
                  const rich = extractRichData(entry);
                  const isExpandable = rich !== null;
                  const isOpen = expandedRows.has(idx);
                  return (
                    <div key={idx} className="group">
                      <div
                        className={cn(
                          "flex items-start gap-2 py-0.5 hover:bg-muted rounded px-1 transition-colors",
                          isExpandable && "cursor-pointer",
                          isConsole(entry) && "bg-yellow-950/20",
                          isDebugInspect(entry) && "bg-purple-950/20",
                        )}
                        onClick={() => isExpandable && toggleRow(idx)}
                      >
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0 pt-0.5 w-16">
                          {formatTime(entry.timestamp)}
                        </span>
                        <span
                          className={cn(
                            "px-1.5 py-0.5 text-[9px] font-bold rounded uppercase shrink-0",
                            LOG_LEVEL_COLORS[entry.level],
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
                        <span
                          className={cn(
                            "text-[11px] flex-1 break-all leading-relaxed",
                            isDebugInspect(entry)
                              ? "font-mono text-emerald-300 whitespace-pre-wrap"
                              : "text-foreground",
                            isConsole(entry) && "font-mono text-yellow-200",
                          )}
                        >
                          {entry.message}
                        </span>
                        {isExpandable && (
                          <span className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
                            {isOpen ? (
                              <ChevronUp size={11} />
                            ) : (
                              <ChevronDown size={11} />
                            )}
                          </span>
                        )}
                      </div>

                      {/* Expanded payload — pretty-printed input / output */}
                      {isOpen && rich && (
                        <div className="ml-[72px] my-1 rounded-md border border-border/60 bg-background/70 overflow-hidden">
                          {rich.input !== undefined && (
                            <DataBlock label="input" value={rich.input} />
                          )}
                          {rich.output !== undefined && (
                            <DataBlock label="output" value={rich.output} />
                          )}
                          {rich.raw !== undefined && (
                            <DataBlock label="data" value={rich.raw} />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DataBlock({
  label,
  value,
}: {
  label: string;
  value: unknown;
}): React.ReactElement {
  // Pretty-print objects; strings/numbers/booleans render inline.
  const isStructured = value !== null && typeof value === "object";
  const formatted = isStructured
    ? JSON.stringify(value, null, 2)
    : String(value);
  return (
    <div className="border-b border-border/40 last:border-b-0">
      <div className="flex items-center gap-2 px-3 py-1 bg-muted/30 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            label === "output"
              ? "bg-emerald-400"
              : label === "input"
                ? "bg-sky-400"
                : "bg-slate-500",
          )}
        />
        {label}
      </div>
      <pre className="px-3 py-1.5 text-[10px] font-mono text-slate-300 whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto">
        {formatted}
      </pre>
    </div>
  );
}
