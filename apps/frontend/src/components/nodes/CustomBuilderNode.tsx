import React from "react";
import { Handle, Position } from "@xyflow/react";
import * as LucideIcons from "lucide-react";
import type { LucideProps } from "lucide-react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Trash2,
} from "lucide-react";
import type { CustomBuilderConfig } from "@workflow/shared";
import type { WorkflowNodeProps } from "../../types/nodeProps";
import { useWorkflowStore } from "../../store/workflowStore";
import { useExecutionStore } from "../../store/executionStore";
import { cn } from "../../lib/utils";

type IconComponent = React.ComponentType<LucideProps>;

function DynamicIcon({
  name,
  size = 13,
}: {
  name: string;
  size?: number;
}): React.ReactElement {
  const icons = LucideIcons as unknown as Record<string, IconComponent>;
  const Icon = icons[name] ?? LucideIcons.Puzzle;
  return <Icon size={size} />;
}

/**
 * Dynamic-handle node for user-authored "custom_builder" nodes.
 *
 * Handles come from the node's own snapshotted config.inputs / config.outputs,
 * not the registry. Mirrors SubworkflowCallNode's approach to variable ports.
 */
export function CustomBuilderNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as CustomBuilderConfig;
  const nodeStatus = useExecutionStore((s) => s.nodeStatuses[id]);
  const removeNode = useWorkflowStore((s) => s.removeNode);

  const inputs = cfg.inputs.length > 0 ? cfg.inputs : [{ id: "in", label: "in" }];
  const outputs =
    cfg.outputs.length > 0 ? cfg.outputs : [{ id: "out", label: "out" }];

  const statusClass =
    {
      running: "node-status-running",
      completed: "node-status-completed",
      failed: "node-status-failed",
      skipped: "node-status-skipped",
    }[nodeStatus ?? ""] ?? "";

  return (
    <div
      className={cn(
        "relative rounded-lg overflow-hidden bg-slate-800 border border-slate-600",
        selected && "border-indigo-500",
        statusClass,
      )}
      style={{ minWidth: 200, maxWidth: 280 }}
    >
      {/* Input handles on the left */}
      {inputs.map((h, i) => {
        const topPct =
          inputs.length === 1 ? 50 : ((i + 1) / (inputs.length + 1)) * 100;
        return (
          <Handle
            key={`in_${h.id}`}
            type="target"
            id={h.id}
            position={Position.Left}
            style={{ top: `${topPct}%` }}
            title={h.label}
          />
        );
      })}

      {/* Output handles on the right */}
      {outputs.map((h, i) => {
        const topPct =
          outputs.length === 1 ? 50 : ((i + 1) / (outputs.length + 1)) * 100;
        return (
          <Handle
            key={`out_${h.id}`}
            type="source"
            id={h.id}
            position={Position.Right}
            style={{ top: `${topPct}%` }}
            title={h.label}
          />
        );
      })}

      {/* Header */}
      <div
        className="flex items-center gap-1.5 px-3 py-2 text-white"
        style={{ backgroundColor: cfg.color || "#8b5cf6" }}
      >
        <DynamicIcon name={cfg.icon || "Puzzle"} size={13} />
        <span className="text-xs font-semibold truncate flex-1">
          {data.label}
        </span>

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

        <button
          className="nodrag nopan ml-auto flex items-center justify-center w-5 h-5 rounded opacity-40 hover:opacity-100 hover:bg-red-600 text-white transition-all shrink-0"
          title="Delete node"
          disabled={nodeStatus === "running"}
          onClick={(e) => {
            e.stopPropagation();
            removeNode(id);
          }}
        >
          <Trash2 size={11} />
        </button>
      </div>

      {/* Body */}
      <div className="px-3 py-2 text-xs space-y-1">
        <div className="flex items-center gap-1.5">
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-bold"
            style={{
              backgroundColor: (cfg.color || "#8b5cf6") + "30",
              color: cfg.color || "#8b5cf6",
            }}
          >
            {cfg.executionMode === "http" ? "HTTP" : "JS"}
          </span>
          <span className="text-slate-400 text-[10px] truncate">
            {cfg.templateKey || "unsaved"}
          </span>
        </div>
        {outputs.length > 1 && (
          <div className="flex flex-col items-end gap-0.5 pt-1">
            {outputs.map((h) => (
              <div
                key={h.id}
                className="text-[10px] text-slate-500 flex items-center gap-1"
              >
                <span>{h.label}</span>
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: cfg.color || "#8b5cf6" }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
