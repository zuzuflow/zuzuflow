import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useEnvironmentStore } from "@/store/environmentStore";
import {
  Plus, RefreshCw, GitBranch, Clock, KeyRound, Folder, FolderOpen, FolderPlus,
  ChevronRight, ChevronDown, MoreHorizontal, Pencil, Trash2, GitFork,
  LayoutGrid, FileText, Tag, Search, X,
} from "lucide-react";
import { Skeleton } from "../components/ui/skeleton";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import * as api from "../lib/api";
import { cn } from "../lib/utils";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ExecutionLogViewer } from "@/components/panels/ExecutionLogViewer";
import { WorkflowTable, type SortColumn, type SortDirection } from "../components/workflows/WorkflowTable";
import { formatDate, formatDuration, executionStatusColor as statusColor, successRateNumber } from "../lib/formatters";

// Comparator used by the table's client-side sort. Nulls always sort last,
// independent of direction, so a "—" row doesn't float to the top when sorting
// descending.
function compareWorkflows(
  a: api.WorkflowListItem,
  b: api.WorkflowListItem,
  column: SortColumn,
): number {
  switch (column) {
    case "name":
      return a.name.localeCompare(b.name);

    case "tags": {
      const ta = (a.tags?.[0] ?? "").toLowerCase();
      const tb = (b.tags?.[0] ?? "").toLowerCase();
      if (!ta && !tb) return 0;
      if (!ta) return 1;   // empty tags sink
      if (!tb) return -1;
      return ta.localeCompare(tb);
    }

    case "successRate": {
      const ra = successRateNumber(a.stats);
      const rb = successRateNumber(b.stats);
      if (ra === rb) return 0;
      if (ra === null) return 1;
      if (rb === null) return -1;
      return ra - rb;
    }

    case "avgLatency": {
      const la = a.stats?.avgDurationMs;
      const lb = b.stats?.avgDurationMs;
      if (la == null && lb == null) return 0;
      if (la == null) return 1;
      if (lb == null) return -1;
      return la - lb;
    }

    case "modified":
      return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
  }
}

// Build tree from flat folder list
interface FolderNode extends api.FolderItem {
  children: FolderNode[];
}

function buildTree(folders: api.FolderItem[]): FolderNode[] {
  const map = new Map<string, FolderNode>(
    folders.map((f) => [f.id, { ...f, children: [] }])
  );
  const roots: FolderNode[] = [];
  for (const node of map.values()) {
    if (node.parentId) map.get(node.parentId)?.children.push(node);
    else roots.push(node);
  }
  const sort = (arr: FolderNode[]) => arr.sort((a, b) => a.name.localeCompare(b.name));
  const sortTree = (nodes: FolderNode[]) => { sort(nodes); nodes.forEach((n) => sortTree(n.children)); };
  sortTree(roots);
  return roots;
}

// =============================================================================
// Execution History Modal
// =============================================================================

function ExecutionHistoryModal({ workflow, onClose }: { workflow: api.WorkflowListItem; onClose: () => void }) {
  const [executions, setExecutions] = useState<api.ExecutionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingLogsId, setViewingLogsId] = useState<string | null>(null);

  useEffect(() => {
    api.listExecutions(workflow.id).then((r) => setExecutions(r.items)).catch(console.error).finally(() => setLoading(false));
  }, [workflow.id]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className={cn("max-h-[85vh] flex flex-col", viewingLogsId ? "max-w-4xl" : "max-w-2xl")}>
        {viewingLogsId ? (
          /* ── Log Viewer ── */
          <ExecutionLogViewer
            executionId={viewingLogsId}
            workflowName={workflow.name}
            onBack={() => setViewingLogsId(null)}
          />
        ) : (
          /* ── Execution List ── */
          <>
            <DialogHeader>
              <DialogTitle>{workflow.name}</DialogTitle>
              <DialogDescription>Execution History</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground"><RefreshCw size={16} className="animate-spin mr-2" />Loading…</div>
              ) : executions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Clock size={32} className="mb-3 opacity-40" />
                  <p className="text-sm">No executions yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Finished</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {executions.map((ex) => {
                      const dur = ex.completedAt && ex.startedAt
                        ? formatDuration(new Date(ex.completedAt).getTime() - new Date(ex.startedAt).getTime())
                        : ex.status === "running" ? "running…" : "—";
                      return (
                        <TableRow key={ex.id} className="group cursor-pointer hover:bg-muted/50" onClick={() => setViewingLogsId(ex.id)}>
                          <TableCell><span className={cn("font-semibold capitalize", statusColor[ex.status] ?? "text-muted-foreground")}>{ex.status}</span></TableCell>
                          <TableCell className="text-muted-foreground">{formatDate(ex.startedAt)}</TableCell>
                          <TableCell className="text-muted-foreground">{ex.completedAt ? formatDate(ex.completedAt) : "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{dur}</TableCell>
                          <TableCell>
                            <button
                              onClick={(e) => { e.stopPropagation(); setViewingLogsId(ex.id); }}
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Move Workflow Modal
// =============================================================================

function MoveWorkflowModal({
  workflow, folders, onMove, onClose,
}: {
  workflow: api.WorkflowListItem;
  folders: api.FolderItem[];
  onMove: (folderId: string | null) => void;
  onClose: () => void;
}) {
  const tree = buildTree(folders);

  function FolderOption({ node, depth }: { node: FolderNode; depth: number }) {
    const isCurrent = node.id === workflow.folderId;
    return (
      <>
        <button
          onClick={() => onMove(node.id)}
          disabled={isCurrent}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded transition-colors text-left",
            isCurrent ? "text-muted-foreground cursor-default" : "text-foreground hover:bg-muted"
          )}
          style={{ paddingLeft: 12 + depth * 16 }}
        >
          <Folder size={13} className="text-amber-400 shrink-0" />
          {node.name}
          {isCurrent && <span className="ml-auto text-muted-foreground text-[10px]">current</span>}
        </button>
        {node.children.map((c) => <FolderOption key={c.id} node={c} depth={depth + 1} />)}
      </>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Move "{workflow.name}"</DialogTitle>
          <DialogDescription>Select a destination folder.</DialogDescription>
        </DialogHeader>
        <div className="max-h-64 overflow-y-auto py-1">
          <button
            onClick={() => onMove(null)}
            disabled={!workflow.folderId}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded transition-colors text-left",
              !workflow.folderId ? "text-muted-foreground cursor-default" : "text-foreground hover:bg-muted"
            )}
          >
            <GitBranch size={13} className="text-muted-foreground shrink-0" />
            Root (no folder)
            {!workflow.folderId && <span className="ml-auto text-muted-foreground text-[10px]">current</span>}
          </button>
          {tree.map((n) => <FolderOption key={n.id} node={n} depth={0} />)}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Folder Tree sidebar
// =============================================================================

interface FolderTreeProps {
  nodes: FolderNode[];
  selectedId: string | null; // null = All / root
  onSelect: (id: string | null) => void;
  onRename: (id: string, currentName: string) => void;
  onDelete: (id: string, name: string) => void;
  onNewSubfolder: (parentId: string) => void;
  /** All workflows across folders. Each folder node filters by folderId to
   *  render its own workflow leaves. */
  workflows: api.WorkflowListItem[];
  onSelectWorkflow: (id: string) => void;
  onDragStartWorkflow: (e: React.DragEvent, workflowId: string) => void;
}

/** Leaf row in the folder sidebar that represents a single workflow. */
function WorkflowLeaf({
  workflow,
  depth,
  onSelect,
  onDragStart,
}: {
  workflow: api.WorkflowListItem;
  depth: number;
  onSelect: (id: string) => void;
  onDragStart: (e: React.DragEvent, workflowId: string) => void;
}) {
  const isActive = workflow.status === "active";
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, workflow.id)}
      onClick={() => onSelect(workflow.id)}
      className="group flex items-center gap-1 pr-1 rounded cursor-pointer transition-colors select-none text-muted-foreground hover:bg-secondary hover:text-foreground"
      style={{ paddingLeft: 8 + depth * 14 }}
      title={workflow.name}
    >
      {/* Chevron column — empty for leaves, matches folder indent */}
      <span className="w-4 shrink-0" />
      <GitBranch
        size={12}
        className={cn("shrink-0", isActive ? "text-emerald-400" : "text-muted-foreground/60")}
      />
      <span className="flex-1 text-[11px] py-1 truncate">{workflow.name}</span>
    </div>
  );
}

function FolderTreeItem({
  node, depth, selectedId, onSelect, onRename, onDelete, onNewSubfolder,
  workflows, onSelectWorkflow, onDragStartWorkflow,
}: { node: FolderNode; depth: number } & FolderTreeProps) {
  const [expanded, setExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const isSelected = selectedId === node.id;
  // Workflows that live directly in this folder (sorted alphabetically for
  // stable tree display — independent of the table's chosen sort).
  const folderWorkflows = workflows
    .filter((w) => w.folderId === node.id)
    .sort((a, b) => a.name.localeCompare(b.name));
  const hasChildren = node.children.length > 0 || folderWorkflows.length > 0;

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-folder-menu]")) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setMenuPos({ top: rect.bottom + 4, left: rect.right - 160 });
    setMenuOpen((v) => !v);
  };

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 pr-1 rounded cursor-pointer transition-colors select-none",
          isSelected ? "bg-indigo-900/60 text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        )}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => onSelect(node.id)}
      >
        {/* Expand/collapse chevron */}
        <button
          className="shrink-0 p-0.5"
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
        >
          {hasChildren
            ? expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
            : <span className="w-3" />}
        </button>

        {/* Folder icon */}
        {isSelected && expanded
          ? <FolderOpen size={13} className="shrink-0 text-amber-400" />
          : <Folder size={13} className="shrink-0 text-amber-400" />}

        <span className="flex-1 text-xs py-1.5 truncate">{node.name}</span>

        {/* Context menu trigger */}
        <button
          ref={btnRef}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition"
          onClick={openMenu}
        >
          <MoreHorizontal size={12} />
        </button>
      </div>

      {/* Dropdown rendered via fixed positioning to escape overflow:hidden */}
      {menuOpen && (
        <div
          data-folder-menu
          style={{ position: "fixed", top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
          className="w-40 bg-secondary border border-border rounded-lg shadow-xl py-1 text-xs"
        >
          <button className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted text-foreground"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onNewSubfolder(node.id); }}>
            <FolderPlus size={12} /> New subfolder
          </button>
          <button className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted text-foreground"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onRename(node.id, node.name); }}>
            <Pencil size={12} /> Rename
          </button>
          <div className="border-t border-border my-1" />
          <button className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-900/40 text-red-400"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(node.id, node.name); }}>
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}

      {expanded && (
        <>
          {node.children.map((child) => (
            <FolderTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              onNewSubfolder={onNewSubfolder}
              nodes={[]}
              workflows={workflows}
              onSelectWorkflow={onSelectWorkflow}
              onDragStartWorkflow={onDragStartWorkflow}
            />
          ))}
          {folderWorkflows.map((wf) => (
            <WorkflowLeaf
              key={wf.id}
              workflow={wf}
              depth={depth + 1}
              onSelect={onSelectWorkflow}
              onDragStart={onDragStartWorkflow}
            />
          ))}
        </>
      )}
    </div>
  );
}

// =============================================================================
// Main Page
// =============================================================================

export function WorkflowsPage(): React.ReactElement {
  const navigate = useNavigate();
  const currentSlug = useEnvironmentStore((s) => s.currentSlug);

  // Data
  const [workflows, setWorkflows] = useState<api.WorkflowListItem[]>([]);
  const [folders, setFolders] = useState<api.FolderItem[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null); // null = "All"
  const [historyTarget, setHistoryTarget] = useState<api.WorkflowListItem | null>(null);
  const [moveTarget, setMoveTarget] = useState<api.WorkflowListItem | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Folder editing
  const [newFolderParentId, setNewFolderParentId] = useState<string | null | undefined>(undefined); // undefined = closed
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolder, setRenamingFolder] = useState<{ id: string; name: string } | null>(null);

  // Confirm dialogs
  const [deleteWorkflowTarget, setDeleteWorkflowTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<{ id: string; name: string } | null>(null);

  // New workflow dialog
  const [showNewWfDialog, setShowNewWfDialog] = useState(false);
  const [newWfIsSubworkflow, setNewWfIsSubworkflow] = useState(false);

  // Tag filter
  const [tagCatalog, setTagCatalog] = useState<api.Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagMenuOpen, setTagMenuOpen] = useState(false);

  // Search + sort
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn | null>("modified");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const loadAll = useCallback(() => {
    if (!currentSlug) return;
    setLoading(true);
    Promise.all([
      api.listWorkflows(selectedTags.length > 0 ? { tagsAny: selectedTags } : undefined),
      api.listFolders(),
      api.listTags().catch(() => [] as api.Tag[]),
    ]).then(([wf, fl, tg]) => {
      setWorkflows(wf.items);
      setFolders(fl);
      setTagCatalog(tg);
    }).catch(console.error).finally(() => setLoading(false));
  }, [currentSlug, selectedTags]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const tree = buildTree(folders);

  const visibleWorkflows = React.useMemo(() => {
    // 1. Filter by selected folder
    let list = selectedFolderId === null
      ? workflows
      : workflows.filter((w) => w.folderId === selectedFolderId);

    // 2. Filter by search query (name or id, case-insensitive substring)
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (w) => w.name.toLowerCase().includes(q) || w.id.toLowerCase().includes(q),
      );
    }

    // 3. Sort
    if (sortColumn) {
      const dir = sortDirection === "asc" ? 1 : -1;
      list = [...list].sort((a, b) => {
        const cmp = compareWorkflows(a, b, sortColumn);
        return cmp * dir;
      });
    }

    return list;
  }, [workflows, selectedFolderId, searchQuery, sortColumn, sortDirection]);

  const handleSort = useCallback((column: SortColumn) => {
    setSortColumn((prev) => {
      if (prev === column) {
        // Toggle direction
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      // Switch to new column — default to asc for text, desc for numbers/dates
      const defaultDir: SortDirection =
        column === "name" || column === "tags" ? "asc" : "desc";
      setSortDirection(defaultDir);
      return column;
    });
  }, []);

  // Breadcrumb
  const breadcrumb: string[] = [];
  if (selectedFolderId) {
    let cur = folders.find((f) => f.id === selectedFolderId);
    while (cur) {
      breadcrumb.unshift(cur.name);
      cur = folders.find((f) => f.id === cur!.parentId);
    }
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleDeleteWorkflow = (wf: api.WorkflowListItem) => {
    setDeleteWorkflowTarget({ id: wf.id, name: wf.name });
  };

  const handleConfirmDeleteWorkflow = async () => {
    if (!deleteWorkflowTarget) return;
    const target = deleteWorkflowTarget;
    setDeleteWorkflowTarget(null);
    setDeleting(target.id);
    try {
      await api.deleteWorkflow(target.id);
      setWorkflows((prev) => prev.filter((w) => w.id !== target.id));
    } catch (err) { toast.error(`Delete failed: ${String(err)}`); }
    finally { setDeleting(null); }
  };

  const handleMoveWorkflow = async (folderId: string | null) => {
    if (!moveTarget) return;
    try {
      await api.moveWorkflowToFolder(moveTarget.id, folderId);
      setWorkflows((prev) => prev.map((w) => w.id === moveTarget.id ? { ...w, folderId } : w));
    } catch (err) { toast.error(`Move failed: ${String(err)}`); }
    setMoveTarget(null);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const f = await api.createFolder(newFolderName.trim(), newFolderParentId ?? undefined);
      setFolders((prev) => [...prev, f]);
      setSelectedFolderId(f.id);
    } catch (err) { toast.error(String(err)); }
    setNewFolderParentId(undefined);
    setNewFolderName("");
  };

  const handleRenameFolder = async () => {
    if (!renamingFolder || !renamingFolder.name.trim()) return;
    try {
      const f = await api.renameFolder(renamingFolder.id, renamingFolder.name.trim());
      setFolders((prev) => prev.map((x) => x.id === f.id ? f : x));
    } catch (err) { toast.error(String(err)); }
    setRenamingFolder(null);
  };

  const handleDeleteFolder = (id: string, name: string) => {
    setDeleteFolderTarget({ id, name });
  };

  const handleConfirmDeleteFolder = async () => {
    if (!deleteFolderTarget) return;
    const target = deleteFolderTarget;
    setDeleteFolderTarget(null);
    try {
      await api.deleteFolder(target.id);
      setFolders((prev) => prev.filter((f) => f.id !== target.id));
      setWorkflows((prev) => prev.map((w) => w.folderId === target.id ? { ...w, folderId: folders.find((f) => f.id === target.id)?.parentId ?? null } : w));
      if (selectedFolderId === target.id) setSelectedFolderId(null);
    } catch (err) { toast.error(String(err)); }
  };

  // ── Drag-and-drop for moving workflows to folders ─────────────────────────

  const handleDragStart = (e: React.DragEvent, wfId: string) => {
    e.dataTransfer.setData("workflow-id", wfId);
  };

  const handleDropOnFolder = async (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    const wfId = e.dataTransfer.getData("workflow-id");
    if (!wfId) return;
    const wf = workflows.find((w) => w.id === wfId);
    if (!wf || wf.folderId === folderId) return;
    try {
      await api.moveWorkflowToFolder(wfId, folderId);
      setWorkflows((prev) => prev.map((w) => w.id === wfId ? { ...w, folderId } : w));
    } catch (err) { toast.error(String(err)); }
  };

  // Optimistic row-level status update driven by StatusToggle. The toggle
  // component calls this BEFORE the API request (optimistic) and again with
  // the rolled-back status if the request fails.
  const handleStatusChange = useCallback((workflowId: string, nextStatus: string) => {
    setWorkflows((prev) =>
      prev.map((w) => (w.id === workflowId ? { ...w, status: nextStatus } : w))
    );
  }, []);

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <>
    <div className="flex h-full overflow-hidden">

      {/* ── Folder sidebar ───────────────────────────────────────────────────── */}
      <aside className="w-52 h-full bg-card border-r border-border flex flex-col shrink-0">
        <div className="flex items-center justify-between px-3 h-11 border-b border-border shrink-0">
          <span className="text-xs font-semibold text-foreground">Folders</span>
          <button
            onClick={() => { setNewFolderParentId(null); setNewFolderName(""); }}
            title="New folder"
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <FolderPlus size={13} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1.5 px-1.5 space-y-0.5">
          {/* All Workflows */}
          <div
            className={cn(
              "flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer text-xs font-medium transition-colors select-none",
              selectedFolderId === null
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
            onClick={() => setSelectedFolderId(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDropOnFolder(e, null)}
          >
            <LayoutGrid size={13} className="shrink-0" />
            <span className="flex-1">All Workflows</span>
            <span className="text-[10px] tabular-nums opacity-60">{workflows.length}</span>
          </div>

          {/* Folder tree */}
          {tree.map((node) => (
            <div
              key={node.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDropOnFolder(e, node.id)}
            >
              <FolderTreeItem
                node={node}
                depth={0}
                selectedId={selectedFolderId}
                onSelect={setSelectedFolderId}
                onRename={(id, name) => setRenamingFolder({ id, name })}
                onDelete={handleDeleteFolder}
                onNewSubfolder={(parentId) => { setNewFolderParentId(parentId); setNewFolderName(""); }}
                nodes={[]}
                workflows={workflows}
                onSelectWorkflow={(id) => navigate(`/editor/${id}`)}
                onDragStartWorkflow={handleDragStart}
              />
            </div>
          ))}

          {/* Root-level workflows (no folder) — appear as leaves at depth 0 */}
          {workflows
            .filter((w) => w.folderId === null)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((wf) => (
              <WorkflowLeaf
                key={wf.id}
                workflow={wf}
                depth={0}
                onSelect={(id) => navigate(`/editor/${id}`)}
                onDragStart={handleDragStart}
              />
            ))}
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Top bar */}
        <div className="h-11 border-b border-border flex items-center px-5 gap-3 shrink-0">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-1 min-w-0">
            <button onClick={() => setSelectedFolderId(null)} className="hover:text-foreground transition-colors font-medium">
              All
            </button>
            {breadcrumb.map((seg, i) => (
              <React.Fragment key={i}>
                <ChevronRight size={11} className="shrink-0" />
                <span className={cn("truncate", i === breadcrumb.length - 1 ? "text-foreground font-medium" : "")}>
                  {seg}
                </span>
              </React.Fragment>
            ))}
          </div>

          {selectedFolderId && (
            <button
              onClick={() => { setNewFolderParentId(selectedFolderId); setNewFolderName(""); }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors shrink-0"
            >
              <FolderPlus size={12} /> New subfolder
            </button>
          )}

          <button
            onClick={loadAll}
            disabled={loading}
            title="Refresh"
            className="flex items-center justify-center w-7 h-7 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors shrink-0"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>

          <Button
            size="sm"
            onClick={() => { setNewWfIsSubworkflow(false); setShowNewWfDialog(true); }}
            className="shrink-0 h-7 text-xs"
          >
            <Plus size={13} className="mr-1" /> New Workflow
          </Button>
        </div>

        {/* Workflow list */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Search + count + tag filter.
              Kept left-aligned so the right side stays clear — the
              environment-switcher dropdown in TopNav opens downward into
              that column and would overlap anything parked there. */}
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            {/* Prominent search bar */}
            <div className="relative w-full max-w-sm">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by workflow name or ID"
                className="w-full h-8 pl-9 pr-8 text-xs bg-secondary border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                aria-label="Search workflows"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setTagMenuOpen((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded border transition-colors",
                  selectedTags.length > 0
                    ? "border-primary/50 text-foreground bg-primary/10"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <Tag size={11} />
                {selectedTags.length > 0
                  ? `${selectedTags.length} tag${selectedTags.length !== 1 ? "s" : ""}`
                  : "Filter by tag"}
              </button>
              {tagMenuOpen && (
                <div className="absolute right-0 top-full mt-1 z-20 w-56 max-h-72 overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md">
                  {tagCatalog.length === 0 ? (
                    <p className="p-3 text-[11px] text-muted-foreground">No tags yet. Add tags in the workflow editor's settings.</p>
                  ) : (
                    <>
                      {selectedTags.length > 0 && (
                        <button
                          onClick={() => setSelectedTags([])}
                          className="w-full px-3 py-1.5 text-left text-[11px] text-muted-foreground hover:bg-accent border-b border-border"
                        >
                          Clear all
                        </button>
                      )}
                      {tagCatalog.map((t) => {
                        const checked = selectedTags.includes(t.name);
                        return (
                          <button
                            key={t.name}
                            onClick={() =>
                              setSelectedTags((prev) =>
                                prev.includes(t.name)
                                  ? prev.filter((x) => x !== t.name)
                                  : [...prev, t.name]
                              )
                            }
                            className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-accent"
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "w-3 h-3 rounded border",
                                  checked ? "bg-primary border-primary" : "border-muted-foreground/50"
                                )}
                              />
                              {t.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{t.count}</span>
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground">
              {visibleWorkflows.length} workflow{visibleWorkflows.length !== 1 ? "s" : ""}
              {selectedFolderId && folders.find((f) => f.id === selectedFolderId)
                ? ` in "${folders.find((f) => f.id === selectedFolderId)!.name}"`
                : ""}
            </p>
          </div>

          {loading && workflows.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-lg border border-border">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-2/5" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              ))}
            </div>
          ) : visibleWorkflows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                {searchQuery ? <Search size={24} className="opacity-40" /> : <GitBranch size={24} className="opacity-40" />}
              </div>
              {searchQuery ? (
                <>
                  <p className="text-sm font-medium text-foreground mb-1">No workflows match "{searchQuery}"</p>
                  <p className="text-xs mb-6">Try a different name or ID.</p>
                  <Button size="sm" variant="secondary" onClick={() => setSearchQuery("")}>
                    <X size={13} className="mr-1.5" /> Clear search
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground mb-1">No workflows here</p>
                  <p className="text-xs mb-6">
                    {selectedFolderId ? "Drop a workflow here, or create a new one" : "Create your first workflow to get started"}
                  </p>
                  <Button
                    size="sm"
                    onClick={() => { setNewWfIsSubworkflow(false); setShowNewWfDialog(true); }}
                  >
                    <Plus size={13} className="mr-1.5" /> New Workflow
                  </Button>
                </>
              )}
            </div>
          ) : (
            <WorkflowTable
              workflows={visibleWorkflows}
              folders={folders}
              selectedFolderId={selectedFolderId}
              selectedTags={selectedTags}
              deleting={deleting}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={handleSort}
              onOpen={(wf) => navigate(`/editor/${wf.id}`)}
              onHistory={(wf) => setHistoryTarget(wf)}
              onMove={(wf) => setMoveTarget(wf)}
              onDelete={(wf) => handleDeleteWorkflow(wf)}
              onTagClick={(t) =>
                setSelectedTags((prev) =>
                  prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
                )
              }
              onStatusChange={handleStatusChange}
              onDragStart={handleDragStart}
            />
          )}
        </div>
      </div>
    </div>

      {/* ── New Folder modal ───────────────────────────────────────────────── */}
      <Dialog open={newFolderParentId !== undefined} onOpenChange={(open) => { if (!open) setNewFolderParentId(undefined); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
            <DialogDescription>Enter a name for the new folder.</DialogDescription>
          </DialogHeader>
          <input
            autoFocus
            className="w-full px-3 py-1.5 text-sm bg-secondary border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:border-indigo-500"
            placeholder="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); if (e.key === "Escape") setNewFolderParentId(undefined); }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewFolderParentId(undefined)}>Cancel</Button>
            <Button onClick={handleCreateFolder}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Rename Folder modal ────────────────────────────────────────────── */}
      <Dialog open={!!renamingFolder} onOpenChange={(open) => { if (!open) setRenamingFolder(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
            <DialogDescription>Enter a new name for this folder.</DialogDescription>
          </DialogHeader>
          <input
            autoFocus
            className="w-full px-3 py-1.5 text-sm bg-secondary border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:border-indigo-500"
            value={renamingFolder?.name ?? ""}
            onChange={(e) => setRenamingFolder((r) => r ? { ...r, name: e.target.value } : null)}
            onKeyDown={(e) => { if (e.key === "Enter") handleRenameFolder(); if (e.key === "Escape") setRenamingFolder(null); }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenamingFolder(null)}>Cancel</Button>
            <Button onClick={handleRenameFolder}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── New Workflow dialog ────────────────────────────────────────────── */}
      <Dialog open={showNewWfDialog} onOpenChange={setShowNewWfDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>New Workflow</DialogTitle>
            <DialogDescription>Configure before opening the editor.</DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-3 cursor-pointer group">
            <div
              className={cn(
                "mt-0.5 w-9 h-5 rounded-full transition-colors shrink-0 relative",
                newWfIsSubworkflow ? "bg-sky-500" : "bg-muted"
              )}
              onClick={() => setNewWfIsSubworkflow((v) => !v)}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                  newWfIsSubworkflow ? "translate-x-4" : "translate-x-0"
                )}
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <GitFork size={12} className="text-sky-400" />
                Mark as subworkflow
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Subworkflows can be called by other workflows as reusable steps.
              </p>
            </div>
          </label>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNewWfDialog(false)}>Cancel</Button>
            <Button
              onClick={() => {
                setShowNewWfDialog(false);
                navigate(newWfIsSubworkflow ? "/editor/new?subworkflow=true" : "/editor/new");
              }}
            >
              Open Editor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Execution History modal ────────────────────────────────────────── */}
      {historyTarget && <ExecutionHistoryModal workflow={historyTarget} onClose={() => setHistoryTarget(null)} />}

      {/* ── Move Workflow modal ────────────────────────────────────────────── */}
      {moveTarget && (
        <MoveWorkflowModal
          workflow={moveTarget}
          folders={folders}
          onMove={handleMoveWorkflow}
          onClose={() => setMoveTarget(null)}
        />
      )}

      {/* ── Delete Workflow confirm ────────────────────────────────────────── */}
      <ConfirmDialog
        open={deleteWorkflowTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteWorkflowTarget(null); }}
        title="Delete Workflow"
        description={`Delete "${deleteWorkflowTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleConfirmDeleteWorkflow}
        destructive
      />

      {/* ── Delete Folder confirm ──────────────────────────────────────────── */}
      <ConfirmDialog
        open={deleteFolderTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteFolderTarget(null); }}
        title="Delete Folder"
        description={`Delete folder "${deleteFolderTarget?.name}"? Workflows inside will be moved to the parent folder.`}
        confirmLabel="Delete"
        onConfirm={handleConfirmDeleteFolder}
        destructive
      />
    </>
  );
}
