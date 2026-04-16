import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import { Handle, Position } from "@xyflow/react";
import { Merge, Loader2, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import type { MergeConfig } from "@workflow/shared";
import { useWorkflowStore } from "../../store/workflowStore";
import { useExecutionStore } from "../../store/executionStore";
import { cn } from "../../lib/utils";

export function MergeNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as MergeConfig;
  const modeLabel = cfg.mode === "all" ? "AND" : "OR";
  const nodeStatus = useExecutionStore((s) => s.nodeStatuses[id]);
  const removeNode = useWorkflowStore((s) => s.removeNode);

  return (
    <div className="relative" style={{ width: 140, height: 72 }}>
      {/* Input handle */}
      <Handle type="target" position={Position.Top} id="in" style={{ left: "50%" }} />

      {/* Inverted trapezoid — funnel shape */}
      <div
        className={cn(
          "absolute inset-0 transition-all",
          selected && "drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]"
        )}
        style={{
          clipPath: "polygon(0% 0%, 100% 0%, 80% 100%, 20% 100%)",
          background: "linear-gradient(135deg, #FF9F29 0%, #E8890C 100%)",
        }}
      />
      <div
        className="absolute"
        style={{
          top: 2.5, left: 2.5, right: 2.5, bottom: 2.5,
          clipPath: "polygon(0% 0%, 100% 0%, 80% 100%, 20% 100%)",
          background: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
        }}
      />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
        <div className="flex items-center gap-1">
          <Merge size={12} className="text-amber-400" />
          <span className="text-[11px] font-bold text-white">{data.label}</span>
          {nodeStatus === "running" && <Loader2 size={11} className="animate-spin text-white" />}
          {nodeStatus === "completed" && <CheckCircle2 size={11} className="text-green-400" />}
          {nodeStatus === "failed" && <XCircle size={11} className="text-red-400" />}
        </div>
        <div className="text-[9px] text-slate-400 mt-0.5">
          <span className="font-bold text-amber-300">{modeLabel}</span>
          <span className="text-slate-500"> · {cfg.branchCount} branches</span>
        </div>
      </div>

      {/* Delete */}
      <button
        className="absolute top-1 right-2 z-20 w-4 h-4 flex items-center justify-center rounded-full opacity-0 hover:opacity-100 bg-red-600/80 text-white transition-opacity nodrag nopan"
        onClick={(e) => { e.stopPropagation(); removeNode(id); }}
      >
        <Trash2 size={8} />
      </button>

      {/* Output handle */}
      <Handle type="source" position={Position.Bottom} id="out" style={{ left: "50%" }} />
    </div>
  );
}
