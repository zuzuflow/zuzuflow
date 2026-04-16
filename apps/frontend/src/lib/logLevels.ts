import { AlertCircle, AlertTriangle, Bug, Info } from "lucide-react";
import type { ElementType } from "react";

// =============================================================================
// Shared log-level palette & icons
// Kept in one place so the ExecutionLogViewer and the global LogsPage render
// log levels consistently.
// =============================================================================

export type LogLevel = "debug" | "info" | "warn" | "error";

export const LOG_LEVEL_STYLES: Record<
  LogLevel,
  { bg: string; text: string; icon: ElementType; label: string }
> = {
  debug: {
    bg: "bg-purple-900/40 border-purple-800/50",
    text: "text-purple-300",
    icon: Bug,
    label: "debug",
  },
  info: {
    bg: "bg-blue-900/40 border-blue-800/50",
    text: "text-blue-300",
    icon: Info,
    label: "info",
  },
  warn: {
    bg: "bg-yellow-900/40 border-yellow-800/50",
    text: "text-yellow-300",
    icon: AlertTriangle,
    label: "warn",
  },
  error: {
    bg: "bg-red-900/40 border-red-800/50",
    text: "text-red-300",
    icon: AlertCircle,
    label: "error",
  },
};

export const LOG_LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];
