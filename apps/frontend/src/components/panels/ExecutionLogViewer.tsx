import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Search, Filter, ChevronLeft, RefreshCw, Download,
  AlertCircle, Info, AlertTriangle, Bug, Terminal,
  ChevronDown, ChevronUp, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import * as api from "@/lib/api";

// =============================================================================
// Types
// =============================================================================

interface Props {
  executionId: string;
  workflowName?: string;
  onBack: () => void;
}

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_STYLES: Record<LogLevel, { bg: string; text: string; icon: React.ElementType }> = {
  debug: { bg: "bg-purple-900/40 border-purple-800/50", text: "text-purple-300", icon: Bug },
  info:  { bg: "bg-blue-900/40 border-blue-800/50",   text: "text-blue-300",   icon: Info },
  warn:  { bg: "bg-yellow-900/40 border-yellow-800/50", text: "text-yellow-300", icon: AlertTriangle },
  error: { bg: "bg-red-900/40 border-red-800/50",     text: "text-red-300",     icon: AlertCircle },
};

const STATUS_COLOR: Record<string, string> = {
  completed: "text-emerald-400",
  failed: "text-red-400",
  running: "text-indigo-400",
  pending: "text-amber-400",
  cancelled: "text-muted-foreground",
  timed_out: "text-orange-400",
};

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const hms = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    const ms = String(d.getMilliseconds()).padStart(3, "0");
    return `${hms}.${ms}`;
  } catch {
    return iso;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(3)}s`;
  const m = Math.floor(s / 60);
  const rem = (s % 60).toFixed(1);
  return `${m}m ${rem}s`;
}

function isConsoleLog(entry: api.ExecutionLogEntry): boolean {
  return (entry.data as Record<string, unknown> | undefined)?.source === "console";
}

function isDebugInspect(entry: api.ExecutionLogEntry): boolean {
  return (entry.data as Record<string, unknown> | undefined)?.source === "debug";
}

// =============================================================================
// ExecutionLogViewer
// =============================================================================

export function ExecutionLogViewer({ executionId, workflowName, onBack }: Props): React.ReactElement {
  const [result, setResult] = useState<api.ExecutionLogsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedNode, setSelectedNode] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: api.ExecutionLogsFilter = { limit: 500 };
      if (selectedNode !== "all") filters.nodeId = selectedNode;
      if (selectedLevel !== "all") filters.level = selectedLevel;
      if (debouncedSearch) filters.search = debouncedSearch;

      const data = await api.getExecutionLogs(executionId, filters);
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [executionId, selectedNode, selectedLevel, debouncedSearch]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setSelectedNode("all");
    setSelectedLevel("all");
  };

  const hasActiveFilters = selectedNode !== "all" || selectedLevel !== "all" || debouncedSearch !== "";

  const handleExport = () => {
    if (!result) return;
    const lines = result.logs.map((log) =>
      `[${log.createdAt}] [${log.level.toUpperCase()}] [${log.nodeKind}:${log.nodeId.slice(0, 8)}] ${log.message}`
    );
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `execution-${executionId.slice(0, 8)}-logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Level summary counts
  const levelCounts = result
    ? result.logs.reduce(
        (acc, log) => {
          acc[log.level] = (acc[log.level] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      )
    : {};

  return (
    <div className="flex flex-col h-full max-h-[75vh]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-border shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 px-2">
          <ChevronLeft size={14} />
          Back
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-muted-foreground shrink-0" />
            <span className="text-sm font-semibold truncate">Execution Logs</span>
            {result?.execution && (
              <span className={cn("text-xs font-semibold capitalize", STATUS_COLOR[result.execution.status] ?? "text-muted-foreground")}>
                {result.execution.status.replace("_", " ")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-muted-foreground font-mono">{executionId.slice(0, 12)}...</span>
            {result?.execution && (
              <span className="text-[10px] text-muted-foreground">
                {formatDate(result.execution.startedAt)}
                {result.execution.completedAt && ` — ${formatDate(result.execution.completedAt)}`}
                {result.execution.completedAt && result.execution.startedAt && (
                  <span className="ml-1.5 font-semibold text-foreground/70">
                    ({formatDurationMs(new Date(result.execution.completedAt).getTime() - new Date(result.execution.startedAt).getTime())})
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={loading} className="gap-1.5 px-2">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleExport} disabled={!result?.logs.length} className="gap-1.5 px-2">
            <Download size={12} />
          </Button>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex items-center gap-2 py-2 border-b border-border shrink-0 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 pl-8 text-xs"
          />
        </div>

        {/* Node filter */}
        <Select value={selectedNode} onValueChange={setSelectedNode}>
          <SelectTrigger className="h-7 w-[170px] text-xs">
            <Filter size={11} className="mr-1.5 text-muted-foreground shrink-0" />
            <SelectValue placeholder="All Nodes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Nodes</SelectItem>
            {result?.nodes.map((n) => (
              <SelectItem key={n.nodeId} value={n.nodeId}>
                <span className="font-mono text-[10px] mr-1 text-muted-foreground">{n.nodeId.slice(0, 6)}</span>
                {n.nodeKind}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Level filter */}
        <Select value={selectedLevel} onValueChange={setSelectedLevel}>
          <SelectTrigger className="h-7 w-[130px] text-xs">
            <SelectValue placeholder="All Levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="debug">
              <span className="flex items-center gap-1.5"><Bug size={11} className="text-purple-400" /> Debug</span>
            </SelectItem>
            <SelectItem value="info">
              <span className="flex items-center gap-1.5"><Info size={11} className="text-blue-400" /> Info</span>
            </SelectItem>
            <SelectItem value="warn">
              <span className="flex items-center gap-1.5"><AlertTriangle size={11} className="text-yellow-400" /> Warn</span>
            </SelectItem>
            <SelectItem value="error">
              <span className="flex items-center gap-1.5"><AlertCircle size={11} className="text-red-400" /> Error</span>
            </SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground">
            <X size={11} /> Clear
          </Button>
        )}
      </div>

      {/* Level summary badges */}
      {result && result.logs.length > 0 && (
        <div className="flex items-center gap-2 py-1.5 px-1 shrink-0">
          <span className="text-[10px] text-muted-foreground">
            {result.total} log{result.total !== 1 ? "s" : ""}
            {hasActiveFilters && ` (filtered from ${result.total})`}
          </span>
          <div className="flex items-center gap-1.5 ml-auto">
            {(["error", "warn", "info", "debug"] as const).map(
              (lvl) =>
                levelCounts[lvl] && (
                  <button
                    key={lvl}
                    onClick={() => setSelectedLevel(selectedLevel === lvl ? "all" : lvl)}
                    className={cn(
                      "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors",
                      selectedLevel === lvl
                        ? LOG_LEVEL_STYLES[lvl].bg + " " + LOG_LEVEL_STYLES[lvl].text + " border"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {React.createElement(LOG_LEVEL_STYLES[lvl].icon, { size: 10 })}
                    {levelCounts[lvl]} {lvl}
                  </button>
                )
            )}
          </div>
        </div>
      )}

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading && !result ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <RefreshCw size={16} className="animate-spin mr-2" />
            Loading logs...
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-red-400">
            <AlertCircle size={24} className="mb-2" />
            <p className="text-sm">{error}</p>
            <Button variant="ghost" size="sm" onClick={fetchLogs} className="mt-2">
              Retry
            </Button>
          </div>
        ) : !result || result.logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Terminal size={28} className="mb-2 opacity-40" />
            <p className="text-sm">{hasActiveFilters ? "No logs match your filters" : "No logs recorded"}</p>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-2 text-xs">
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {result.logs.map((entry) => {
              const lvl = LOG_LEVEL_STYLES[entry.level] ?? LOG_LEVEL_STYLES.info;
              const LevelIcon = lvl.icon;
              const isExpanded = expandedRows.has(entry.id);
              const hasData = entry.data && Object.keys(entry.data).length > 0;
              const isConsole = isConsoleLog(entry);
              const isInspect = isDebugInspect(entry);

              return (
                <div key={entry.id} className="group">
                  <div
                    className={cn(
                      "flex items-start gap-2 px-2 py-1.5 hover:bg-muted/50 transition-colors cursor-pointer",
                      isConsole && "bg-yellow-950/10",
                      isInspect && "bg-purple-950/10",
                    )}
                    onClick={() => hasData && toggleRow(entry.id)}
                  >
                    {/* Timestamp */}
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0 pt-0.5 w-[72px]">
                      {formatTimestamp(entry.createdAt)}
                    </span>

                    {/* Level badge */}
                    <span className={cn("flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold rounded uppercase shrink-0", lvl.bg, lvl.text, "border")}>
                      <LevelIcon size={9} />
                      {entry.level}
                    </span>

                    {/* Node kind */}
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0 max-w-[100px] truncate" title={`${entry.nodeKind} (${entry.nodeId})`}>
                      [{entry.nodeKind}]
                    </span>

                    {/* Source tag */}
                    {isConsole && (
                      <Badge variant="outline" className="text-[8px] py-0 px-1 h-4 bg-yellow-800/30 text-yellow-300 border-yellow-700/50">
                        console
                      </Badge>
                    )}
                    {isInspect && (
                      <Badge variant="outline" className="text-[8px] py-0 px-1 h-4 bg-purple-800/30 text-purple-300 border-purple-700/50">
                        inspect
                      </Badge>
                    )}

                    {/* Message */}
                    <span
                      className={cn(
                        "text-[11px] flex-1 break-all leading-relaxed min-w-0",
                        isInspect ? "font-mono text-emerald-300 whitespace-pre-wrap" : "text-foreground",
                        isConsole && "font-mono text-yellow-200",
                      )}
                    >
                      {entry.message}
                    </span>

                    {/* Expand indicator */}
                    {hasData && (
                      <span className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </span>
                    )}
                  </div>

                  {/* Expanded data */}
                  {isExpanded && hasData && (
                    <div className="px-4 py-2 bg-muted/30 border-l-2 border-muted ml-[72px]">
                      <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">
                        {JSON.stringify(entry.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
