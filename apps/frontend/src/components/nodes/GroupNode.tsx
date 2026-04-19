import React from "react";
import { Lock, Unlock, Group as GroupIcon } from "lucide-react";
import type { GroupConfig } from "@workflow/shared";
import type { WorkflowNodeProps } from "../../types/nodeProps";
import { cn } from "../../lib/utils";

/**
 * Canvas-only container for visually + logically grouping nodes.
 *
 * - No xyflow Handles — groups are unconnectable by design.
 * - Dotted border makes the grouping state obvious.
 * - When `locked`, the header shows a lock icon and child nodes are frozen
 *   (enforced on the canvas side via `draggable`/`deletable` overrides).
 */
export function GroupNode({
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as GroupConfig;
  const border = cfg.locked ? "border-amber-500/70" : "border-slate-400/70";
  const fill = (cfg.color ?? "#64748b") + "14"; // ~8% alpha

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 border-dashed transition-colors",
        border,
        selected && "border-indigo-400 ring-2 ring-indigo-400/30",
      )}
      style={{
        width: cfg.width,
        height: cfg.height,
        backgroundColor: fill,
      }}
    >
      {/* Label chip anchored top-left, sitting on the dotted border */}
      <div className="absolute -top-3 left-3 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-[10px] text-slate-200 shadow-sm">
        <GroupIcon size={10} className="text-slate-400" />
        <span className="font-medium">{cfg.label ?? "Group"}</span>
        {cfg.locked ? (
          <Lock size={9} className="text-amber-400" />
        ) : (
          <Unlock size={9} className="text-slate-500" />
        )}
      </div>
    </div>
  );
}
