import {
  MoreHorizontal, GitFork, Folder, Tag, History, ArrowRight, Play, Trash2, Copy,
} from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import * as api from "@/lib/api";
import {
  formatDuration,
  formatRelative,
  successRate,
  successRateNumber,
} from "@/lib/formatters";
import { StatusToggle } from "./StatusToggle";

interface WorkflowTableRowProps {
  workflow: api.WorkflowListItem;
  folders: api.FolderItem[];
  /** If the user has a folder selected, suppress the inline folder label. */
  selectedFolderId: string | null;
  selectedTags: string[];
  deleting: string | null;
  onOpen: (workflow: api.WorkflowListItem) => void;
  onHistory: (workflow: api.WorkflowListItem) => void;
  onMove: (workflow: api.WorkflowListItem) => void;
  onDelete: (workflow: api.WorkflowListItem) => void;
  onTagClick: (tag: string) => void;
  onStatusChange: (workflowId: string, nextStatus: string) => void;
  onDragStart: (e: React.DragEvent, workflowId: string) => void;
}

const MAX_VISIBLE_TAGS = 3;

export function WorkflowTableRow({
  workflow: wf,
  folders,
  selectedFolderId,
  selectedTags,
  deleting,
  onOpen,
  onHistory,
  onMove,
  onDelete,
  onTagClick,
  onStatusChange,
  onDragStart,
}: WorkflowTableRowProps) {
  const st = wf.stats;
  const rate = successRate(st);
  const rateNum = successRateNumber(st);
  const rateColor =
    rateNum == null ? "text-muted-foreground"
      : rateNum >= 95 ? "text-emerald-400"
      : rateNum >= 80 ? "text-amber-400"
      : "text-red-400";

  const visibleTags = wf.tags?.slice(0, MAX_VISIBLE_TAGS) ?? [];
  const extraTagCount = (wf.tags?.length ?? 0) - visibleTags.length;
  const folderName =
    selectedFolderId === null && wf.folderId
      ? folders.find((f) => f.id === wf.folderId)?.name
      : null;

  return (
    <TableRow
      draggable
      onDragStart={(e) => onDragStart(e, wf.id)}
      onClick={() => onOpen(wf)}
      className="cursor-pointer group odd:bg-muted/10 hover:bg-accent/20 transition-colors"
    >
      {/* 1. Status toggle */}
      <TableCell className="w-[70px]" onClick={(e) => e.stopPropagation()}>
        <StatusToggle
          workflowId={wf.id}
          status={wf.status}
          onOptimisticChange={(next) => onStatusChange(wf.id, next)}
        />
      </TableCell>

      {/* 2. Name + version + sub/folder badges */}
      <TableCell className="max-w-[280px]">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-sm font-semibold text-foreground truncate"
            title={wf.description || wf.name}
          >
            {wf.name}
          </span>
          {wf.version != null && (
            <span className="text-[10px] font-mono text-muted-foreground/80 shrink-0">
              v{wf.version}
            </span>
          )}
          {wf.isSubworkflow && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-sky-900/60 text-sky-300 shrink-0">
              <GitFork size={9} /> Sub
            </span>
          )}
          {folderName && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
              <Folder size={9} className="text-amber-500" />
              {folderName}
            </span>
          )}
        </div>
      </TableCell>

      {/* 3. Tags */}
      <TableCell className="max-w-[200px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1 flex-wrap">
          {visibleTags.map((t) => {
            const active = selectedTags.includes(t);
            return (
              <button
                key={t}
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick(t);
                }}
                className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors",
                  active
                    ? "bg-primary/20 text-primary border border-primary/40"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/70",
                )}
                title={active ? `Remove filter: ${t}` : `Filter by ${t}`}
              >
                <Tag size={8} /> {t}
              </button>
            );
          })}
          {extraTagCount > 0 && (
            <span className="text-[10px] text-muted-foreground">+{extraTagCount}</span>
          )}
          {visibleTags.length === 0 && (
            <span className="text-[11px] text-muted-foreground/50">—</span>
          )}
        </div>
      </TableCell>

      {/* 4. Success % */}
      <TableCell className="text-right w-[90px]">
        <span className={cn("text-[12px] font-semibold tabular-nums", rateColor)}>
          {rate}
        </span>
      </TableCell>

      {/* 5. Total runs */}
      <TableCell className="text-right w-[90px]">
        <span className="text-[12px] font-semibold tabular-nums text-foreground">
          {st?.totalExecutions ?? 0}
        </span>
      </TableCell>

      {/* 6. Pass / Fail */}
      <TableCell className="text-right w-[110px]">
        <span className="text-[12px] tabular-nums">
          <span className="text-emerald-400 font-semibold">{st?.completed ?? 0}</span>
          <span className="text-muted-foreground mx-1">/</span>
          <span className="text-red-400 font-semibold">{st?.failed ?? 0}</span>
        </span>
      </TableCell>

      {/* 7. Avg latency */}
      <TableCell className="text-right w-[100px]">
        <span className="text-[12px] tabular-nums text-muted-foreground">
          {formatDuration(st?.avgDurationMs)}
        </span>
      </TableCell>

      {/* 8. Last run */}
      <TableCell className="w-[120px] text-[11px] text-muted-foreground">
        {st?.lastExecution ? (
          <span title={new Date(st.lastExecution.startedAt).toLocaleString()}>
            {formatRelative(st.lastExecution.startedAt)}
          </span>
        ) : (
          <span className="text-muted-foreground/50 italic">Never</span>
        )}
      </TableCell>

      {/* 9. Modified */}
      <TableCell className="w-[120px] text-[11px] text-muted-foreground">
        <span title={new Date(wf.updatedAt).toLocaleString()}>
          {formatRelative(wf.updatedAt)}
        </span>
      </TableCell>

      {/* 10. Actions */}
      <TableCell className="w-[50px]" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="Row actions"
            >
              <MoreHorizontal size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onOpen(wf)}>
              <Play size={12} className="mr-2" /> Open
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onHistory(wf)}>
              <History size={12} className="mr-2" /> History
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMove(wf)}>
              <ArrowRight size={12} className="mr-2" /> Move
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled
              title="Coming soon"
              onClick={(e) => e.preventDefault()}
            >
              <Copy size={12} className="mr-2" /> Clone
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={deleting === wf.id}
              onClick={() => onDelete(wf)}
              className="text-red-400 focus:text-red-400 focus:bg-red-900/30"
            >
              <Trash2 size={12} className="mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
