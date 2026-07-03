import React, { useState, useMemo, useEffect } from "react";
import * as LucideIcons from "lucide-react";
import type { LucideProps } from "lucide-react";
import { Search, ChevronDown, ChevronRight, GitFork, RefreshCw, Puzzle, Plus } from "lucide-react";
import type { NodeKind } from "@workflow/shared";
import {
  nodeRegistry,
  NODE_CATEGORIES,
  getNodesByCategory,
} from "../../lib/nodeRegistry";
import { listSubworkflows } from "../../lib/api";
import type { WorkflowListItem, CustomNodeTemplateRecord } from "../../lib/api";
import { useCustomNodeTemplates } from "../../hooks/useCustomNodeTemplates";
import { useSdkHostStore, isNodeKindVisible } from "../../store/sdkHostStore";
import { Input } from "../../components/ui/input";
import { motion, AnimatePresence } from "framer-motion";

type IconComponent = React.ComponentType<LucideProps>;

function DynamicIcon({ name, size = 14 }: { name: string; size?: number }): React.ReactElement {
  const icons = LucideIcons as unknown as Record<string, IconComponent>;
  const Icon = icons[name];
  if (!Icon) return <span style={{ width: size, height: size, display: "inline-block" }} />;
  return <Icon size={size} />;
}

// ─── Palette item ─────────────────────────────────────────────────────────────

interface PaletteItemProps {
  kind: NodeKind;
  showCategory?: boolean;
}

function PaletteItem({ kind, showCategory }: PaletteItemProps): React.ReactElement {
  const entry = nodeRegistry[kind];

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData("application/node-kind", kind);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <motion.div
      whileHover={{ x: 2 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      draggable
      onDragStart={handleDragStart as unknown as (event: MouseEvent | PointerEvent | TouchEvent) => void}
      className="flex items-start gap-2.5 px-3 py-2 rounded-md cursor-grab active:cursor-grabbing transition-colors hover:bg-accent border-l-2"
      style={{ borderLeftColor: entry.color }}
    >
      <div
        className="flex items-center justify-center w-7 h-7 rounded-md shrink-0 text-white"
        style={{ backgroundColor: entry.color }}
      >
        <DynamicIcon name={entry.icon} size={13} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-foreground leading-tight">{entry.label}</div>
        <div className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate">
          {entry.description}
        </div>
        {showCategory && (
          <span
            className="inline-block mt-0.5 text-[9px] font-bold uppercase tracking-wider px-1 rounded"
            style={{ color: entry.color, backgroundColor: entry.color + "20" }}
          >
            {entry.category.replace("_", " ")}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Category section ─────────────────────────────────────────────────────────

interface CategorySectionProps {
  id: string;
  label: string;
  color: string;
  kinds: NodeKind[];
  collapsed: boolean;
  onToggle: () => void;
}

function CategorySection({ id, label, color, kinds, collapsed, onToggle }: CategorySectionProps): React.ReactElement {
  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-secondary/40 transition-colors"
      >
        <span style={{ color }} className="shrink-0">
          {collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
        </span>
        <span
          className="text-[10px] font-bold uppercase tracking-widest flex-1"
          style={{ color }}
        >
          {label}
        </span>
        <span
          className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: color + "25", color }}
        >
          {kinds.length}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="space-y-0.5 px-2 pb-1">
              {kinds.map((kind) => (
                <PaletteItem key={kind} kind={kind} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Subworkflow palette item ─────────────────────────────────────────────────

function SubworkflowPaletteItem({ wf }: { wf: WorkflowListItem }): React.ReactElement {
  const color = "#0ea5e9";
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData("application/node-kind", "subworkflow_call");
    e.dataTransfer.setData("application/subworkflow-id", wf.id);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <motion.div
      whileHover={{ x: 2 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      draggable
      onDragStart={handleDragStart as unknown as (event: MouseEvent | PointerEvent | TouchEvent) => void}
      className="flex items-start gap-2.5 px-3 py-2 rounded-md cursor-grab active:cursor-grabbing transition-colors hover:bg-accent border-l-2"
      style={{ borderLeftColor: color }}
    >
      <div
        className="flex items-center justify-center w-7 h-7 rounded-md shrink-0 text-white"
        style={{ backgroundColor: color }}
      >
        <GitFork size={13} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-foreground leading-tight truncate">{wf.name}</div>
        <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">subworkflow</div>
      </div>
    </motion.div>
  );
}

// ─── Custom node palette item ─────────────────────────────────────────────────

function CustomNodePaletteItem({
  template,
}: {
  template: CustomNodeTemplateRecord;
}): React.ReactElement {
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    // Distinct MIME so WorkflowCanvas knows to snapshot the template into a
    // CustomBuilderConfig rather than fall through the default node-kind path.
    e.dataTransfer.setData("application/custom-node-template", template.id);
    e.dataTransfer.setData("application/node-kind", "custom_builder");
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <motion.div
      whileHover={{ x: 2 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      draggable
      onDragStart={handleDragStart as unknown as (event: MouseEvent | PointerEvent | TouchEvent) => void}
      className="flex items-start gap-2.5 px-3 py-2 rounded-md cursor-grab active:cursor-grabbing transition-colors hover:bg-accent border-l-2"
      style={{ borderLeftColor: template.color }}
      title={template.description ?? template.name}
    >
      <div
        className="flex items-center justify-center w-7 h-7 rounded-md shrink-0 text-white"
        style={{ backgroundColor: template.color }}
      >
        <DynamicIcon name={template.icon} size={13} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-foreground leading-tight truncate">{template.name}</div>
        <div className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate">
          {template.executionMode === "http" ? "HTTP" : "JS"} · {template.key}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main palette ─────────────────────────────────────────────────────────────

export function NodePalette({ isSubworkflow = false }: { isSubworkflow?: boolean }): React.ReactElement {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [subworkflows, setSubworkflows] = useState<WorkflowListItem[]>([]);
  const [subwfCollapsed, setSubwfCollapsed] = useState(false);
  const [subwfLoading, setSubwfLoading] = useState(true);
  const [customCollapsed, setCustomCollapsed] = useState(false);
  const {
    templates: customTemplates,
    loading: customLoading,
    refresh: refreshCustom,
  } = useCustomNodeTemplates();

  const fetchSubworkflows = () => {
    setSubwfLoading(true);
    listSubworkflows()
      .then((r) => setSubworkflows(r.items.filter((wf) => wf.status === "active")))
      .catch(() => setSubworkflows([]))
      .finally(() => setSubwfLoading(false));
  };

  useEffect(() => {
    fetchSubworkflows();
  }, []);

  function toggleCategory(id: string) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // Subworkflow-only node kinds — shown only when editing a subworkflow
  const SUBFLOW_ONLY: NodeKind[] = ["subflow_input", "subflow_output"];

  // Host-supplied palette filter (SDK allowedNodeKinds / hiddenNodeKinds).
  const allowedNodeKinds = useSdkHostStore((s) => s.allowedNodeKinds);
  const hiddenNodeKinds = useSdkHostStore((s) => s.hiddenNodeKinds);
  const hostVisible = React.useCallback(
    (kind: string) => isNodeKindVisible(kind, { allowedNodeKinds, hiddenNodeKinds }),
    [allowedNodeKinds, hiddenNodeKinds]
  );

  // Build flat searchable list — exclude hidden nodes, but include subflow-only ones when editing a subworkflow
  const allKinds = useMemo(
    () =>
      (Object.keys(nodeRegistry) as NodeKind[]).filter((k) => {
        if (!hostVisible(k)) return false;
        if (SUBFLOW_ONLY.includes(k)) return isSubworkflow;
        return !nodeRegistry[k].hidden;
      }),
    [isSubworkflow, hostVisible]
  );

  const searchResults = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return allKinds.filter((kind) => {
      const e = nodeRegistry[kind];
      return (
        e.label.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        kind.toLowerCase().includes(q)
      );
    });
  }, [query, allKinds]);

  const isSearching = query.trim().length > 0;

  return (
    <aside className="w-64 h-full bg-card border-r border-border flex flex-col overflow-hidden">
      {/* Header + search */}
      <div className="px-3 py-3 border-b border-border space-y-2">
        <div>
          <h2 className="text-xs font-semibold text-foreground">Nodes</h2>
          <p className="text-[10px] text-muted-foreground">Drag onto the canvas to add</p>
        </div>
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search nodes..."
            className="pl-7"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-2">
        {isSearching ? (
          // ── Search mode: flat filtered list ──────────────────────────────────
          searchResults.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-muted-foreground">No nodes match</p>
              <p className="text-[10px] text-muted-foreground mt-1">"{query}"</p>
            </div>
          ) : (
            <div className="space-y-0.5 px-2">
              {searchResults.map((kind) => (
                <PaletteItem key={kind} kind={kind} showCategory />
              ))}
            </div>
          )
        ) : (
          // ── Normal mode: categorized collapsible sections ─────────────────────
          <>
            {NODE_CATEGORIES.map(({ id, label, color }) => {
              const kinds = getNodesByCategory(id as any).concat(
                isSubworkflow
                  ? SUBFLOW_ONLY.filter((k) => nodeRegistry[k].category === id)
                  : []
              ).filter((k) => hostVisible(k));
              if (kinds.length === 0) return null;
              return (
                <CategorySection
                  key={id}
                  id={id}
                  label={label}
                  color={color}
                  kinds={kinds}
                  collapsed={!!collapsed[id]}
                  onToggle={() => toggleCategory(id)}
                />
              );
            })}

            {/* Subworkflows section */}
            <div className="mb-1">
              <div className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-secondary/40 transition-colors">
                <button
                  onClick={() => setSubwfCollapsed((v) => !v)}
                  className="flex items-center gap-2 flex-1 text-left"
                >
                  <span style={{ color: "#0ea5e9" }} className="shrink-0">
                    {subwfCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest flex-1" style={{ color: "#0ea5e9" }}>
                    Subworkflows
                  </span>
                </button>
                <button
                  onClick={() => fetchSubworkflows()}
                  className="p-0.5 rounded hover:bg-muted transition-colors shrink-0"
                  title="Refresh"
                >
                  <RefreshCw size={9} style={{ color: "#0ea5e9" }} />
                </button>
                <span
                  className="text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ backgroundColor: "#0ea5e920", color: "#0ea5e9" }}
                >
                  {subworkflows.length}
                </span>
              </div>

              <AnimatePresence initial={false}>
                {!subwfCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-0.5 px-2 pb-1">
                      {subwfLoading ? (
                        <div className="px-3 py-2 text-[10px] text-muted-foreground">Loading…</div>
                      ) : subworkflows.length === 0 ? (
                        <div className="px-3 py-2 text-[10px] text-muted-foreground">
                          No active subworkflows found.
                        </div>
                      ) : (
                        subworkflows.map((wf) => (
                          <SubworkflowPaletteItem key={wf.id} wf={wf} />
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Custom Nodes section — org-scoped reusable node kinds */}
            <div className="mb-1">
              <div className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-secondary/40 transition-colors">
                <button
                  onClick={() => setCustomCollapsed((v) => !v)}
                  className="flex items-center gap-2 flex-1 text-left"
                >
                  <span style={{ color: "#8b5cf6" }} className="shrink-0">
                    {customCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest flex-1 flex items-center gap-1" style={{ color: "#8b5cf6" }}>
                    <Puzzle size={10} />
                    Custom Nodes
                  </span>
                </button>
                <button
                  onClick={() => {
                    // Builder modal lands in Slice 2 — placeholder.
                    window.dispatchEvent(new CustomEvent("open-custom-node-builder"));
                  }}
                  className="p-0.5 rounded hover:bg-muted transition-colors shrink-0"
                  title="Create new custom node"
                >
                  <Plus size={10} style={{ color: "#8b5cf6" }} />
                </button>
                <button
                  onClick={() => refreshCustom()}
                  className="p-0.5 rounded hover:bg-muted transition-colors shrink-0"
                  title="Refresh"
                >
                  <RefreshCw size={9} style={{ color: "#8b5cf6" }} />
                </button>
                <span
                  className="text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
                  style={{ backgroundColor: "#8b5cf620", color: "#8b5cf6" }}
                >
                  {customTemplates.length}
                </span>
              </div>

              <AnimatePresence initial={false}>
                {!customCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-0.5 px-2 pb-1">
                      {customLoading ? (
                        <div className="px-3 py-2 text-[10px] text-muted-foreground">Loading…</div>
                      ) : customTemplates.length === 0 ? (
                        <div className="px-3 py-2 text-[10px] text-muted-foreground leading-relaxed">
                          No custom nodes yet. Click <Plus size={9} className="inline -mt-0.5" /> to build one.
                        </div>
                      ) : (
                        customTemplates.map((t) => (
                          <CustomNodePaletteItem key={t.id} template={t} />
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
