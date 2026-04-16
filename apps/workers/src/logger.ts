import { Runtime } from "@temporalio/worker";
import { config } from "./config";

// =============================================================================
// Simple logger for the worker process.
// Uses the Temporal Runtime logger for workflow-level messages so they show
// up in the Temporal UI; uses a plain console wrapper for worker-level logs.
// =============================================================================

type Level = "debug" | "info" | "warn" | "error";

function log(level: Level, message: string, meta?: Record<string, unknown>) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  const logFn =
    level === "error"
      ? console.error
      : level === "warn"
      ? console.warn
      : level === "debug"
      ? console.debug
      : console.info;

  if (config.NODE_ENV === "production") {
    logFn(JSON.stringify(entry));
  } else {
    const metaStr =
      meta && Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
    logFn(`[${entry.timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`);
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
};
