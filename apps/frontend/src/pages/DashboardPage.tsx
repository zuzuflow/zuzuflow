import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity, CheckCircle2, Clock, Loader2, Play, RefreshCw, Timer,
  TrendingUp, XCircle, AlertTriangle, Zap,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import * as api from "../lib/api";
import type { DashboardStats, DashboardWindow } from "../lib/api";
import { useEnvironmentStore } from "@/store/environmentStore";
import { cn } from "../lib/utils";
import {
  formatDuration,
  formatRelative,
  executionStatusColor as statusColor,
} from "../lib/formatters";

// Poll the stats endpoint at this cadence. Short enough to feel live, long
// enough to avoid hammering the DB. Running-now counter updates in step.
const POLL_INTERVAL_MS = 15_000;

const WINDOWS: Array<{ value: DashboardWindow; label: string }> = [
  { value: "1h",  label: "1h" },
  { value: "24h", label: "24h" },
  { value: "7d",  label: "7d" },
  { value: "30d", label: "30d" },
];

export function DashboardPage(): React.ReactElement {
  const currentSlug = useEnvironmentStore((s) => s.currentSlug);
  const [window, setWindow] = useState<DashboardWindow>("24h");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!currentSlug) return;
    if (opts.silent) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await api.getDashboardStats(window);
      setStats(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentSlug, window]);

  useEffect(() => {
    load();
    const id = setInterval(() => load({ silent: true }), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [load]);

  return (
    // Let the parent <main> (AppShell) handle scrolling — nested scroll
    // containers would swallow wheel events and cap the page height.
    <div>
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Real-time execution overview for this environment.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5">
              {WINDOWS.map((w) => (
                <button
                  key={w.value}
                  onClick={() => setWindow(w.value)}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-[4px] transition-colors",
                    window === w.value
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {w.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => load()}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={12} className={cn(refreshing && "animate-spin")} />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-900/40 bg-red-900/20 px-4 py-3 text-xs text-red-300">
            Couldn't load stats: {error}
          </div>
        )}

        {loading && !stats ? (
          <LoadingState />
        ) : stats ? (
          <>
            <KpiRow stats={stats} window={window} />
            <TimelineCard stats={stats} window={window} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TopWorkflowsCard stats={stats} onOpen={(id) => navigate(`/editor/${id}`)} />
              <RecentFailuresCard stats={stats} onOpen={(id) => navigate(`/editor/${id}`)} />
            </div>
            <LiveFeedCard stats={stats} onOpen={(id) => navigate(`/editor/${id}`)} />
          </>
        ) : null}
      </div>
    </div>
  );
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
      <Loader2 size={22} className="animate-spin mb-3" />
      <p className="text-sm">Loading stats…</p>
    </div>
  );
}

// ─── KPI row (4 cards) ──────────────────────────────────────────────────────

function KpiRow({ stats, window }: { stats: DashboardStats; window: DashboardWindow }) {
  const windowLabel = window === "1h" ? "last hour" : window === "24h" ? "last 24h" : window === "7d" ? "last 7 days" : "last 30 days";
  const successPct = stats.successRate == null ? null : Math.round(stats.successRate * 100);
  const successTone =
    successPct == null ? "muted"
      : successPct >= 95 ? "emerald"
      : successPct >= 80 ? "amber"
      : "red";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        label="Runs"
        value={stats.runs.total.toLocaleString()}
        sub={windowLabel}
        icon={<Activity size={14} className="text-indigo-400" />}
      />
      <KpiCard
        label="Success rate"
        value={successPct == null ? "—" : `${successPct}%`}
        sub={`${stats.runs.completed.toLocaleString()} ok / ${stats.runs.failed.toLocaleString()} failed`}
        icon={<TrendingUp size={14} className={cn(
          successTone === "emerald" && "text-emerald-400",
          successTone === "amber" && "text-amber-400",
          successTone === "red" && "text-red-400",
          successTone === "muted" && "text-muted-foreground",
        )} />}
        valueTone={successTone}
      />
      <KpiCard
        label="Running now"
        value={stats.runningNow.toLocaleString()}
        sub={stats.runningNow > 0 ? "active executions" : "idle"}
        icon={
          <span className="relative inline-flex">
            <Zap size={14} className={stats.runningNow > 0 ? "text-emerald-400" : "text-muted-foreground"} />
            {stats.runningNow > 0 && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </span>
        }
        pulse={stats.runningNow > 0}
      />
      <KpiCard
        label="Avg latency"
        value={formatDuration(stats.avgDurationMs)}
        sub={windowLabel}
        icon={<Timer size={14} className="text-blue-400" />}
      />
    </div>
  );
}

function KpiCard({
  label, value, sub, icon, valueTone, pulse,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  valueTone?: "emerald" | "amber" | "red" | "muted";
  pulse?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-xl border border-border bg-card p-4 transition-colors",
      pulse && "border-emerald-900/40",
    )}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {icon}
      </div>
      <div className={cn(
        "text-2xl font-semibold tabular-nums",
        valueTone === "emerald" && "text-emerald-400",
        valueTone === "amber" && "text-amber-400",
        valueTone === "red" && "text-red-400",
        !valueTone && "text-foreground",
      )}>
        {value}
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}

// ─── Timeline chart ─────────────────────────────────────────────────────────

function TimelineCard({ stats, window }: { stats: DashboardStats; window: DashboardWindow }) {
  // Recharts-friendly data: shorter labels on the X axis based on window size.
  const data = useMemo(() => stats.timeline.map((pt) => {
    const d = new Date(pt.bucket);
    const label = window === "1h" || window === "24h"
      ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false })
      : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return {
      label,
      completed: pt.completed,
      failed: pt.failed,
      running: pt.running,
      cancelled: pt.cancelled,
    };
  }), [stats.timeline, window]);

  const isEmpty = data.every((p) => p.completed + p.failed + p.running + p.cancelled === 0);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Executions over time</h2>
          <p className="text-[11px] text-muted-foreground">
            Stacked by status — {data.length} buckets
          </p>
        </div>
      </div>
      {isEmpty ? (
        <EmptyChartState />
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                stroke="hsl(var(--border))"
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                stroke="hsl(var(--border))"
                allowDecimals={false}
                width={30}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--accent))", opacity: 0.15 }}
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                iconType="square"
              />
              <Bar dataKey="completed" stackId="a" fill="#34d399" name="Completed" />
              <Bar dataKey="failed"    stackId="a" fill="#f87171" name="Failed" />
              <Bar dataKey="running"   stackId="a" fill="#818cf8" name="Running" />
              <Bar dataKey="cancelled" stackId="a" fill="#9ca3af" name="Cancelled" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function EmptyChartState() {
  return (
    <div className="h-72 flex flex-col items-center justify-center text-muted-foreground">
      <Activity size={24} className="opacity-30 mb-2" />
      <p className="text-xs">No executions in this window yet.</p>
    </div>
  );
}

// ─── Top workflows ──────────────────────────────────────────────────────────

function TopWorkflowsCard({ stats, onOpen }: { stats: DashboardStats; onOpen: (id: string) => void }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={14} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Top workflows</h2>
      </div>
      {stats.topWorkflows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-8 text-center">No runs yet.</p>
      ) : (
        <div className="space-y-1.5">
          {stats.topWorkflows.map((w) => {
            const pct = w.successRate == null ? null : Math.round(w.successRate * 100);
            return (
              <button
                key={w.workflowId}
                onClick={() => onOpen(w.workflowId)}
                className="w-full flex items-center gap-3 px-2 py-1.5 rounded hover:bg-accent/40 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{w.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {w.runs.toLocaleString()} runs · avg {formatDuration(w.avgDurationMs)}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-[11px] tabular-nums">
                  <span className="text-emerald-400">{w.completed.toLocaleString()}</span>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-red-400">{w.failed.toLocaleString()}</span>
                  {pct != null && (
                    <span className={cn(
                      "font-semibold w-10 text-right",
                      pct >= 95 ? "text-emerald-400" : pct >= 80 ? "text-amber-400" : "text-red-400",
                    )}>
                      {pct}%
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Recent failures ────────────────────────────────────────────────────────

function RecentFailuresCard({ stats, onOpen }: { stats: DashboardStats; onOpen: (id: string) => void }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={14} className={stats.recentFailures.length > 0 ? "text-red-400" : "text-muted-foreground"} />
        <h2 className="text-sm font-semibold text-foreground">Recent failures</h2>
        {stats.recentFailures.length > 0 && (
          <span className="ml-auto text-[10px] bg-red-900/40 text-red-300 px-1.5 py-0.5 rounded">
            {stats.recentFailures.length}
          </span>
        )}
      </div>
      {stats.recentFailures.length === 0 ? (
        <div className="py-8 text-center">
          <CheckCircle2 size={24} className="text-emerald-400/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No failures in this window.</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {stats.recentFailures.map((f) => (
            <button
              key={f.executionId}
              onClick={() => onOpen(f.workflowId)}
              className="w-full flex items-start gap-2 px-2 py-1.5 rounded hover:bg-accent/40 transition-colors text-left group"
            >
              <XCircle size={12} className="text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{f.workflowName}</p>
                <p className="text-[10px] text-red-300/80 truncate">{f.error ?? "(no error message)"}</p>
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                {formatRelative(f.startedAt)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Live feed ──────────────────────────────────────────────────────────────

function LiveFeedCard({ stats, onOpen }: { stats: DashboardStats; onOpen: (id: string) => void }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Play size={13} className="text-indigo-400" />
        <h2 className="text-sm font-semibold text-foreground">Recent executions</h2>
        <span className="ml-auto text-[10px] text-muted-foreground">Last 20</span>
      </div>
      {stats.recentExecutions.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">No executions yet.</p>
      ) : (
        <div className="divide-y divide-border/40">
          {stats.recentExecutions.map((e) => {
            const color = statusColor[e.status] ?? "text-muted-foreground";
            return (
              <button
                key={e.executionId}
                onClick={() => onOpen(e.workflowId)}
                className="w-full flex items-center gap-3 px-2 py-2 hover:bg-accent/30 transition-colors text-left"
              >
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", {
                  "bg-emerald-400": e.status === "completed",
                  "bg-red-400": e.status === "failed",
                  "bg-indigo-400": e.status === "running",
                  "bg-amber-400": e.status === "pending",
                  "bg-muted-foreground": e.status === "cancelled" || e.status === "timed_out",
                })} />
                <span className={cn("text-[11px] capitalize font-medium w-20 shrink-0", color)}>
                  {e.status.replace("_", " ")}
                </span>
                <span className="text-xs text-foreground flex-1 min-w-0 truncate">
                  {e.workflowName}
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                  {formatDuration(e.durationMs)}
                </span>
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 w-16 text-right">
                  {formatRelative(e.startedAt)}
                </span>
                <Clock size={10} className="text-muted-foreground/60 shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
