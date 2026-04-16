import React, { useEffect } from "react";
import { Handle, Position, useUpdateNodeInternals } from "@xyflow/react";
import { Loader2, CheckCircle2, XCircle, MinusCircle, Trash2 } from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { LucideProps } from "lucide-react";
import { nodeRegistry } from "../../lib/nodeRegistry";
import { useWorkflowStore } from "../../store/workflowStore";
import { useExecutionStore } from "../../store/executionStore";
import { cn } from "../../lib/utils";
import type { NodeKind, NodeStyle } from "@workflow/shared";

const positionMap: Record<string, Position> = {
  top: Position.Top,
  bottom: Position.Bottom,
  left: Position.Left,
  right: Position.Right,
};

interface NodeWrapperProps {
  nodeId: string;
  kind: NodeKind;
  label: string;
  children?: React.ReactNode;
  selected?: boolean;
  style?: NodeStyle;
  /** Optional custom icon element rendered in the header instead of the Lucide icon */
  iconNode?: React.ReactNode;
}

type IconComponent = React.ComponentType<LucideProps>;

function DynamicIcon({ name, size = 14, className }: { name: string; size?: number; className?: string }): React.ReactElement {
  const icons = LucideIcons as unknown as Record<string, IconComponent>;
  const Icon = icons[name];
  if (!Icon) return <span className={className} style={{ width: size, height: size }} />;
  return <Icon size={size} className={className} />;
}

export function NodeWrapper({
  nodeId,
  kind,
  label,
  children,
  selected,
  style: nodeStyle,
  iconNode,
}: NodeWrapperProps): React.ReactElement {
  const entry = nodeRegistry[kind];
  const headerColor = nodeStyle?.headerColor ?? entry.color;
  const iconName = nodeStyle?.icon ?? entry.icon;
  const nodeStatus = useExecutionStore((s) => s.nodeStatuses[nodeId]);
  const removeNode = useWorkflowStore((s) => s.removeNode);

  const statusClass = {
    running: "node-status-running",
    completed: "node-status-completed",
    failed: "node-status-failed",
    skipped: "node-status-skipped",
  }[nodeStatus ?? ""] ?? "";

  const inputPositionOverride = nodeStyle?.handlePositions?.input;
  const outputPositionOverride = nodeStyle?.handlePositions?.output;
  const updateNodeInternals = useUpdateNodeInternals();

  // Tell ReactFlow to recalculate edge paths whenever handle positions change
  useEffect(() => {
    updateNodeInternals(nodeId);
  }, [inputPositionOverride, outputPositionOverride, nodeId, updateNodeInternals]);

  // Resolve effective position for a handle, applying style overrides
  const resolvePosition = (h: (typeof entry.handles)[number]): string => {
    if (h.type === "target" && inputPositionOverride) return inputPositionOverride;
    if (h.type === "source" && outputPositionOverride) return outputPositionOverride;
    return h.position;
  };

  return (
    <div
      className={cn(
        "relative min-w-[180px] max-w-[280px] rounded-lg overflow-hidden bg-slate-800 border border-slate-600",
        selected && "border-indigo-500",
        statusClass
      )}
    >
      {/* Handles */}
      {entry.handles.map((h) => {
        const effectivePosition = resolvePosition(h);
        // Offset multiple handles of same type at same effective position
        const siblings = entry.handles.filter(
          (hh) => hh.type === h.type && resolvePosition(hh) === effectivePosition
        );
        const idx = siblings.findIndex((hh) => hh.id === h.id);
        const total = siblings.length;
        const offsetPercent =
          total > 1 ? `${((idx + 1) / (total + 1)) * 100}%` : "50%";

        const style: React.CSSProperties =
          effectivePosition === "left" || effectivePosition === "right"
            ? { top: offsetPercent }
            : { left: offsetPercent };

        return (
          <Handle
            key={`${h.id}-${effectivePosition}`}
            type={h.type}
            position={positionMap[effectivePosition]}
            id={h.id}
            style={style}
            title={h.label}
          />
        );
      })}

      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-2 text-white" style={{ backgroundColor: headerColor }}>
        {iconNode ?? <DynamicIcon name={iconName} size={13} className="shrink-0 opacity-90" />}
        <span className="text-xs font-semibold truncate flex-1">{label}</span>

        {/* Status badge */}
        {nodeStatus === "running" && (
          <Loader2 size={13} className="animate-spin shrink-0" />
        )}
        {nodeStatus === "completed" && (
          <CheckCircle2 size={13} className="shrink-0 text-green-300" />
        )}
        {nodeStatus === "failed" && (
          <XCircle size={13} className="shrink-0 text-red-300" />
        )}
        {nodeStatus === "skipped" && (
          <MinusCircle size={13} className="shrink-0 text-slate-300" />
        )}

        {/* Delete button — always visible, disabled while node is running */}
        <button
          className="nodrag nopan ml-auto flex items-center justify-center w-5 h-5 rounded opacity-40 hover:opacity-100 hover:bg-red-600 text-white transition-all shrink-0"
          title="Delete node (or press Delete key)"
          disabled={nodeStatus === "running"}
          onClick={(e) => {
            e.stopPropagation();
            removeNode(nodeId);
          }}
        >
          <Trash2 size={11} />
        </button>
      </div>

      {/* Body */}
      {children && (
        <div className="px-3 py-2 text-xs text-slate-400 space-y-1">{children}</div>
      )}

      {/* Handle labels — only for nodes with multiple labelled source handles (e.g. if_else, switch) */}
      {entry.handles.filter((h) => h.type === "source" && h.label).length > 1 &&
        entry.handles
          .filter((h) => h.type === "source" && h.label && resolvePosition(h) === "bottom")
          .map((h) => {
            const sourcesBottom = entry.handles.filter(
              (hh) => hh.type === "source" && resolvePosition(hh) === "bottom"
            );
            const idx = sourcesBottom.findIndex((hh) => hh.id === h.id);
            const total = sourcesBottom.length;
            const leftPct = ((idx + 1) / (total + 1)) * 100;
            return (
              <span
                key={`label-${h.id}`}
                className="absolute bottom-1 text-[9px] text-slate-500 font-medium pointer-events-none"
                style={{ left: `${leftPct}%`, transform: "translateX(-50%)" }}
              >
                {h.label}
              </span>
            );
          })}
    </div>
  );
}
