import React from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import { X } from "lucide-react";
import { useWorkflowStore } from "../../store/workflowStore";
import { useExecutionStore } from "../../store/executionStore";
import { cn } from "../../lib/utils";

export function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  markerEnd,
  selected,
  data,
}: EdgeProps): React.ReactElement {
  // Use the Zustand store's onEdgesChange so deletion persists correctly
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange);
  const executionStatus = useExecutionStore((s) => s.status);
  const isRunning = executionStatus === "running" || executionStatus === "pending";

  // Per-edge style overrides from data (set via appearance panel)
  const edgeData = data as { color?: string; width?: number; dashed?: boolean } | undefined;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdgesChange([{ id, type: "remove" }]);
  };

  const baseColor = edgeData?.color ?? "#64748b";
  const edgeColor = selected ? "#6366f1" : isRunning ? "#6366f1" : baseColor;
  const strokeWidth = edgeData?.width ?? (selected ? 3 : 2);
  const strokeDasharray = edgeData?.dashed ? "6 3" : undefined;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: edgeColor,
          strokeWidth,
          strokeDasharray,
        }}
        className={cn(isRunning && "animated-edge-path")}
      />

      <EdgeLabelRenderer>
        {/* Edge label (true/false/case labels) */}
        {label && (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="nodrag nopan"
          >
            <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-secondary border border-slate-600 text-foreground">
              {String(label)}
            </span>
          </div>
        )}

        {/* Delete button when edge is selected */}
        {selected && (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY + (label ? 20 : 0)}px)`,
              pointerEvents: "all",
            }}
            className="nodrag nopan"
          >
            <button
              onClick={handleDelete}
              className="flex items-center justify-center w-5 h-5 rounded-full bg-red-600 border border-red-500 text-white transition-colors"
              title="Remove edge (or press Delete)"
            >
              <X size={10} />
            </button>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
