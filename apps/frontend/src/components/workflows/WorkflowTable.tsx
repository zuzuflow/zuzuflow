import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import * as api from "@/lib/api";
import { WorkflowTableRow } from "./WorkflowTableRow";

/** Columns that support click-to-sort. */
export type SortColumn = "name" | "tags" | "successRate" | "avgLatency" | "modified";
export type SortDirection = "asc" | "desc";

interface WorkflowTableProps {
  workflows: api.WorkflowListItem[];
  folders: api.FolderItem[];
  selectedFolderId: string | null;
  selectedTags: string[];
  deleting: string | null;
  sortColumn: SortColumn | null;
  sortDirection: SortDirection;
  onSort: (column: SortColumn) => void;
  onOpen: (workflow: api.WorkflowListItem) => void;
  onHistory: (workflow: api.WorkflowListItem) => void;
  onMove: (workflow: api.WorkflowListItem) => void;
  onDelete: (workflow: api.WorkflowListItem) => void;
  onTagClick: (tag: string) => void;
  onStatusChange: (workflowId: string, nextStatus: string) => void;
  onDragStart: (e: React.DragEvent, workflowId: string) => void;
}

interface SortableHeaderProps {
  label: string;
  column: SortColumn;
  activeColumn: SortColumn | null;
  direction: SortDirection;
  onSort: (column: SortColumn) => void;
  className?: string;
  align?: "left" | "right";
}

function SortableHeader({
  label,
  column,
  activeColumn,
  direction,
  onSort,
  className,
  align = "left",
}: SortableHeaderProps) {
  const active = activeColumn === column;
  const Icon = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead className={className}>
      <button
        onClick={() => onSort(column)}
        className={cn(
          "inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide select-none hover:text-foreground transition-colors",
          active ? "text-foreground" : "text-muted-foreground",
          align === "right" && "ml-auto",
        )}
      >
        {align === "right" && <Icon size={11} className={cn(!active && "opacity-40")} />}
        {label}
        {align !== "right" && <Icon size={11} className={cn(!active && "opacity-40")} />}
      </button>
    </TableHead>
  );
}

export function WorkflowTable(props: WorkflowTableProps) {
  const { workflows, sortColumn, sortDirection, onSort, ...rowProps } = props;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card">
          <TableRow>
            <TableHead className="w-[70px]">Status</TableHead>
            <SortableHeader
              label="Name"
              column="name"
              activeColumn={sortColumn}
              direction={sortDirection}
              onSort={onSort}
            />
            <SortableHeader
              label="Tags"
              column="tags"
              activeColumn={sortColumn}
              direction={sortDirection}
              onSort={onSort}
            />
            <SortableHeader
              label="Success"
              column="successRate"
              activeColumn={sortColumn}
              direction={sortDirection}
              onSort={onSort}
              className="text-right w-[90px]"
              align="right"
            />
            <TableHead className="text-right w-[90px]">Runs</TableHead>
            <TableHead className="text-right w-[110px]">Pass / Fail</TableHead>
            <SortableHeader
              label="Avg latency"
              column="avgLatency"
              activeColumn={sortColumn}
              direction={sortDirection}
              onSort={onSort}
              className="text-right w-[100px]"
              align="right"
            />
            <TableHead className="w-[120px]">Last run</TableHead>
            <SortableHeader
              label="Modified"
              column="modified"
              activeColumn={sortColumn}
              direction={sortDirection}
              onSort={onSort}
              className="w-[120px]"
            />
            <TableHead className="w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {workflows.map((wf) => (
            <WorkflowTableRow
              key={wf.id}
              workflow={wf}
              {...rowProps}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
