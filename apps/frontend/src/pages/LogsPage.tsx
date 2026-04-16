import React, { useEffect, useMemo, useState } from "react";
import {
  Search, RefreshCw, ChevronLeft, ChevronRight, FileText,
  Activity, X, ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ExecutionLogViewer } from "@/components/panels/ExecutionLogViewer";
import * as api from "@/lib/api";
import type { ExecutionStatus } from "@workflow/shared";
import { cn } from "@/lib/utils";
import { useEnvironmentStore } from "@/store/environmentStore";
import { LOG_LEVEL_STYLES, LOG_LEVELS, type LogLevel } from "@/lib/logLevels";

// =============================================================================
// LogsPage — Grafana-style log-line search (default) + execution list fallback
//
// Layout note: we deliberately avoid nested flex-1 chains through Radix Tabs
// (which played badly with table rendering). Instead the page is a single
// flex-col with header → tab switcher (plain buttons) → filter bar → scroll
// region → pagination footer. The active tab is kept in local state; the two
// tab components share the same scroll/pagination chrome but render their own
// filter bar + results.
// =============================================================================

const PAGE_SIZE = 100;
const EXEC_PAGE_SIZE = 50;

const STATUSES: Array<ExecutionStatus | "all"> = [
  "all", "pending", "running", "completed", "failed", "cancelled", "timed_out",
];

const statusColor: Record<string, string> = {
  completed: "text-emerald-400",
  failed: "text-red-400",
  running: "text-indigo-400",
  pending: "text-amber-400",
  cancelled: "text-muted-foreground",
  timed_out: "text-orange-400",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  } catch {
    return iso;
  }
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(2)}s`;
  const m = Math.floor(s / 60);
  const rem = (s % 60).toFixed(1);
  return `${m}m ${rem}s`;
}

// =============================================================================
// Root page
// =============================================================================

type TabKey = "logs" | "executions";

export function LogsPage(): React.ReactElement {
  const currentEnvSlug = useEnvironmentStore((s) => s.currentSlug);
  const [tab, setTab] = useState<TabKey>("logs");
  const [workflows, setWorkflows] = useState<api.WorkflowListItem[]>([]);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [viewingName, setViewingName] = useState<string>("");

  useEffect(() => {
    if (!currentEnvSlug) return;
    api.listWorkflows()
      .then((r) => setWorkflows(r.items))
      .catch(() => setWorkflows([]));
  }, [currentEnvSlug]);

  const openExecution = (id: string, name: string) => {
    setViewingId(id);
    setViewingName(name);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Page header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0">
        <Activity size={18} className="text-primary" />
        <div>
          <h1 className="text-lg font-semibold">Logs</h1>
          <p className="text-xs text-muted-foreground">
            Search log lines across every execution, or browse the execution list.
          </p>
        </div>
      </div>

      {/* Tab switcher (plain buttons — avoids Radix Tabs layout quirks) */}
      <div className="flex items-center gap-1 px-6 pt-3 pb-0 border-b border-border shrink-0 bg-card">
        <TabButton active={tab === "logs"} onClick={() => setTab("logs")}>Logs</TabButton>
        <TabButton active={tab === "executions"} onClick={() => setTab("executions")}>Executions</TabButton>
      </div>

      {/* Active tab body */}
      {tab === "logs" ? (
        <LogsTab
          currentEnvSlug={currentEnvSlug}
          workflows={workflows}
          onOpenExecution={openExecution}
        />
      ) : (
        <ExecutionsTab
          currentEnvSlug={currentEnvSlug}
          workflows={workflows}
          onOpenExecution={openExecution}
        />
      )}

      {/* Drill-in log viewer */}
      {viewingId && (
        <Dialog open onOpenChange={(open) => { if (!open) setViewingId(null); }}>
          <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
            <ExecutionLogViewer
              executionId={viewingId}
              workflowName={viewingName}
              onBack={() => setViewingId(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function TabButton({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

// =============================================================================
// Pagination footer (shared)
// =============================================================================

function Paginator({
  page, totalPages, loading, onPrev, onNext, shownCount, total,
}: {
  page: number;
  totalPages: number;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
  shownCount: number;
  total: number;
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-card shrink-0">
      <div className="text-xs text-muted-foreground">
        Page {page + 1} of {totalPages} • showing {shownCount} of {total.toLocaleString()}
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" disabled={page === 0 || loading} onClick={onPrev}>
          <ChevronLeft size={14} className="mr-1" />
          Previous
        </Button>
        <Button variant="ghost" size="sm" disabled={page + 1 >= totalPages || loading} onClick={onNext}>
          Next
          <ChevronRight size={14} className="ml-1" />
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// Logs tab — Grafana-style log-line search
// =============================================================================

interface TabProps {
  currentEnvSlug: string | null | undefined;
  workflows: api.WorkflowListItem[];
  onOpenExecution: (id: string, name: string) => void;
}

function LogsTab({ currentEnvSlug, workflows, onOpenExecution }: TabProps): React.ReactElement {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [level, setLevel] = useState<string>("all");
  const [workflowId, setWorkflowId] = useState<string>("all");
  const [nodeKind, setNodeKind] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [page, setPage] = useState(0);

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<api.PaginatedResult<api.LogSearchItem> | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => { setPage(0); }, [debouncedSearch, level, workflowId, nodeKind, from, to, currentEnvSlug]);

  useEffect(() => {
    if (!currentEnvSlug) return;
    let cancelled = false;
    setLoading(true);
    api.searchLogs({
      q: debouncedSearch || undefined,
      level: level === "all" ? undefined : (level as LogLevel),
      workflowId: workflowId === "all" ? undefined : workflowId,
      nodeKind: nodeKind === "all" ? undefined : nodeKind,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
      .then((r) => { if (!cancelled) setResult(r); })
      .catch((err) => { if (!cancelled) { console.error(err); setResult(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentEnvSlug, debouncedSearch, level, workflowId, nodeKind, from, to, page]);

  const totalPages = useMemo(
    () => (result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1),
    [result]
  );

  const availableNodeKinds = useMemo(() => {
    const set = new Set<string>();
    result?.items.forEach((i) => set.add(i.nodeKind));
    return Array.from(set).sort();
  }, [result]);

  const hasActiveFilter =
    debouncedSearch !== "" || level !== "all" || workflowId !== "all" ||
    nodeKind !== "all" || from !== "" || to !== "";

  const clearFilters = () => {
    setSearch("");
    setLevel("all");
    setWorkflowId("all");
    setNodeKind("all");
    setFrom("");
    setTo("");
  };

  return (
    <>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-border bg-muted/30 shrink-0">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Search log messages — e.g. "hello from python"'
            className="pl-9 h-9 font-mono text-xs"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              title="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger className="h-9 w-[130px]"><SelectValue placeholder="All levels" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            {LOG_LEVELS.map((lv) => (
              <SelectItem key={lv} value={lv}>{lv}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={workflowId} onValueChange={setWorkflowId}>
          <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="All workflows" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All workflows</SelectItem>
            {workflows.map((w) => (
              <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={nodeKind} onValueChange={setNodeKind}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="All node kinds" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All node kinds</SelectItem>
            {availableNodeKinds.map((k) => (
              <SelectItem key={k} value={k}>{k}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <input
          type="datetime-local"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="h-9 px-2 rounded-md border border-input bg-background text-xs"
          title="Logged after"
        />
        <span className="text-muted-foreground text-xs">→</span>
        <input
          type="datetime-local"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="h-9 px-2 rounded-md border border-input bg-background text-xs"
          title="Logged before"
        />

        {hasActiveFilter && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
            <X size={13} className="mr-1" /> Clear
          </Button>
        )}

        <div className="ml-auto text-xs text-muted-foreground">
          {result ? (
            <>
              <span className="font-semibold text-foreground">{result.total.toLocaleString()}</span>{" "}
              log line{result.total === 1 ? "" : "s"}
            </>
          ) : loading ? "Loading…" : null}
        </div>
      </div>

      {/* Results (fills remaining space; owns its scroll) */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading && !result ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <RefreshCw size={16} className="animate-spin mr-2" />
            Loading log lines…
          </div>
        ) : !result || result.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Activity size={32} className="mb-3 opacity-40" />
            <p className="text-sm">
              {hasActiveFilter ? "No log lines match your filters" : "No log lines yet"}
            </p>
            {hasActiveFilter && (
              <Button variant="link" size="sm" onClick={clearFilters}>Clear filters</Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border font-mono text-xs">
            {result.items.map((item) => {
              const style = LOG_LEVEL_STYLES[item.level] ?? LOG_LEVEL_STYLES.info;
              const wfName = item.execution.workflow?.name ?? "(unknown workflow)";
              return (
                <div
                  key={item.id}
                  onClick={() => onOpenExecution(item.execution.id, wfName)}
                  className="group flex items-start gap-3 px-6 py-2 hover:bg-muted/40 cursor-pointer"
                >
                  <span className="shrink-0 text-muted-foreground whitespace-nowrap tabular-nums">
                    {formatTime(item.createdAt)}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase w-14 text-center",
                      style.bg, style.text
                    )}
                  >
                    {item.level}
                  </span>
                  <span
                    className="shrink-0 text-muted-foreground truncate max-w-[260px]"
                    title={`${wfName} · ${item.nodeKind}`}
                  >
                    <span className="text-foreground/80">{wfName}</span>
                    <span className="text-muted-foreground/60 mx-1">·</span>
                    <span>{item.nodeKind}</span>
                  </span>
                  <span className="flex-1 min-w-0 break-words text-foreground/90" title={item.message}>
                    {item.message}
                  </span>
                  <ExternalLink
                    size={12}
                    className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {result && result.total > PAGE_SIZE && (
        <Paginator
          page={page}
          totalPages={totalPages}
          loading={loading}
          onPrev={() => setPage((p) => Math.max(0, p - 1))}
          onNext={() => setPage((p) => p + 1)}
          shownCount={result.items.length}
          total={result.total}
        />
      )}
    </>
  );
}

// =============================================================================
// Executions tab — browse executions
// =============================================================================

function ExecutionsTab({ currentEnvSlug, workflows, onOpenExecution }: TabProps): React.ReactElement {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [workflowId, setWorkflowId] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [page, setPage] = useState(0);

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<api.PaginatedResult<api.ExecutionDetail> | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => { setPage(0); }, [debouncedSearch, status, workflowId, from, to, currentEnvSlug]);

  useEffect(() => {
    if (!currentEnvSlug) return;
    let cancelled = false;
    setLoading(true);
    api.listExecutions({
      workflowId: workflowId === "all" ? undefined : workflowId,
      status: status === "all" ? undefined : (status as ExecutionStatus),
      q: debouncedSearch || undefined,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
      limit: EXEC_PAGE_SIZE,
      offset: page * EXEC_PAGE_SIZE,
    })
      .then((r) => { if (!cancelled) setResult(r); })
      .catch((err) => { if (!cancelled) { console.error(err); setResult(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currentEnvSlug, debouncedSearch, status, workflowId, from, to, page]);

  const totalPages = useMemo(
    () => (result ? Math.max(1, Math.ceil(result.total / EXEC_PAGE_SIZE)) : 1),
    [result]
  );

  const hasActiveFilter =
    debouncedSearch !== "" || status !== "all" || workflowId !== "all" || from !== "" || to !== "";

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setWorkflowId("all");
    setFrom("");
    setTo("");
  };

  return (
    <>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-border bg-muted/30 shrink-0">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workflow name or error message…"
            className="pl-9 h-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              title="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <Select value={workflowId} onValueChange={setWorkflowId}>
          <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="All workflows" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All workflows</SelectItem>
            {workflows.map((w) => (
              <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "All statuses" : s.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <input
          type="datetime-local"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="h-9 px-2 rounded-md border border-input bg-background text-xs"
          title="Started after"
        />
        <span className="text-muted-foreground text-xs">→</span>
        <input
          type="datetime-local"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="h-9 px-2 rounded-md border border-input bg-background text-xs"
          title="Started before"
        />

        {hasActiveFilter && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
            <X size={13} className="mr-1" /> Clear
          </Button>
        )}

        <div className="ml-auto text-xs text-muted-foreground">
          {result ? (
            <>
              <span className="font-semibold text-foreground">{result.total.toLocaleString()}</span>{" "}
              execution{result.total === 1 ? "" : "s"}
            </>
          ) : loading ? "Loading…" : null}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading && !result ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <RefreshCw size={16} className="animate-spin mr-2" />
            Loading executions…
          </div>
        ) : !result || result.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Activity size={32} className="mb-3 opacity-40" />
            <p className="text-sm">
              {hasActiveFilter ? "No executions match your filters" : "No executions yet"}
            </p>
            {hasActiveFilter && (
              <Button variant="link" size="sm" onClick={clearFilters}>Clear filters</Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead className="w-[110px]">Status</TableHead>
                <TableHead>Workflow</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Error</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((ex) => {
                const dur = ex.completedAt && ex.startedAt
                  ? new Date(ex.completedAt).getTime() - new Date(ex.startedAt).getTime()
                  : null;
                const wfName = ex.workflow?.name ?? "(unknown workflow)";
                return (
                  <TableRow
                    key={ex.id}
                    className="group cursor-pointer hover:bg-muted/50"
                    onClick={() => onOpenExecution(ex.id, wfName)}
                  >
                    <TableCell>
                      <span className={cn("font-semibold capitalize text-xs", statusColor[ex.status] ?? "text-muted-foreground")}>
                        {ex.status.replace("_", " ")}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium truncate max-w-[280px]" title={wfName}>
                      {wfName}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {formatDate(ex.startedAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {dur != null ? formatDuration(dur) : (ex.status === "running" ? "running…" : "—")}
                    </TableCell>
                    <TableCell className="text-red-400/80 text-xs truncate max-w-[360px]" title={ex.error ?? ""}>
                      {ex.error ?? ""}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={(e) => { e.stopPropagation(); onOpenExecution(ex.id, wfName); }}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <FileText size={11} />
                        Logs
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {result && result.total > EXEC_PAGE_SIZE && (
        <Paginator
          page={page}
          totalPages={totalPages}
          loading={loading}
          onPrev={() => setPage((p) => Math.max(0, p - 1))}
          onNext={() => setPage((p) => p + 1)}
          shownCount={result.items.length}
          total={result.total}
        />
      )}
    </>
  );
}
