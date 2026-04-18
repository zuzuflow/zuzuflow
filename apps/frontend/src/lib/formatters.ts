// =============================================================================
// Shared formatting helpers for workflow/execution UI.
// Extracted from WorkflowsPage.tsx so table/card variants can share them.
// =============================================================================

import type { WorkflowExecStats } from "./api";

/** "Jan 15, 2:30 PM" — stable locale-aware short datetime. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "342ms" · "1.234s" · "1m 23.5s" · "—" for null/undefined. */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(3)}s`;
  const m = Math.floor(s / 60);
  const rem = (s % 60).toFixed(1);
  return `${m}m ${rem}s`;
}

/** "just now" · "5m ago" · "2h ago" · "3d ago" · then falls back to absolute date. */
export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDate(iso);
}

/** "—" if no runs yet, otherwise "92%". */
export function successRate(stats: WorkflowExecStats | null | undefined): string {
  if (!stats) return "—";
  const total = stats.completed + stats.failed;
  if (total === 0) return "—";
  return `${Math.round((stats.completed / total) * 100)}%`;
}

/** 0–100 number (null if no runs). Use for color thresholds. */
export function successRateNumber(stats: WorkflowExecStats | null | undefined): number | null {
  if (!stats) return null;
  const total = stats.completed + stats.failed;
  if (total === 0) return null;
  return Math.round((stats.completed / total) * 100);
}

/** Text color class for an execution status. */
export const executionStatusColor: Record<string, string> = {
  completed: "text-emerald-400",
  failed: "text-red-400",
  running: "text-indigo-400",
  pending: "text-amber-400",
  cancelled: "text-muted-foreground",
  timed_out: "text-orange-400",
};
