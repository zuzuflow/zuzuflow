import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import { Handle, Position } from "@xyflow/react";
import { Timer, Loader2, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import type { DelayConfig } from "@workflow/shared";
import { useWorkflowStore } from "../../store/workflowStore";
import { useExecutionStore } from "../../store/executionStore";
import { cn } from "../../lib/utils";

export function DelayNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as DelayConfig;
  const nodeStatus = useExecutionStore((s) => s.nodeStatuses[id]);
  const removeNode = useWorkflowStore((s) => s.removeNode);

  return (
    <div className="relative" style={{ width: 150, height: 56 }}>
      {/* Input handle */}
      <Handle type="target" position={Position.Top} id="in" style={{ left: "50%" }} />

      {/* Pill / stadium shape */}
      <div
        className={cn(
          "absolute inset-0 rounded-full transition-all",
          selected && "ring-2 ring-indigo-500 ring-offset-1 ring-offset-transparent"
        )}
        style={{
          background: "linear-gradient(135deg, #FF9F29 0%, #E8890C 100%)",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          top: 2.5, left: 2.5, right: 2.5, bottom: 2.5,
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
        }}
      />

      {/* Content */}
      <div className="absolute inset-0 flex items-center justify-center gap-2 z-10 pointer-events-none">
        <Timer size={14} className={cn("text-amber-400", nodeStatus === "running" && "animate-pulse")} />
        <div className="flex flex-col items-start">
          <span className="text-[11px] font-bold text-white leading-tight">{data.label}</span>
          <span className="text-[9px] text-slate-400">
            <span className="text-amber-300 font-semibold">{cfg.amount}</span> {cfg.unit}
          </span>
        </div>
        {nodeStatus === "running" && <Loader2 size={11} className="animate-spin text-amber-300" />}
        {nodeStatus === "completed" && <CheckCircle2 size={11} className="text-green-400" />}
        {nodeStatus === "failed" && <XCircle size={11} className="text-red-400" />}
      </div>

      {/* Delete */}
      <button
        className="absolute top-0 right-2 z-20 w-4 h-4 flex items-center justify-center rounded-full opacity-0 hover:opacity-100 bg-red-600/80 text-white transition-opacity nodrag nopan"
        onClick={(e) => { e.stopPropagation(); removeNode(id); }}
      >
        <Trash2 size={8} />
      </button>

      {/* Output handle */}
      <Handle type="source" position={Position.Bottom} id="out" style={{ left: "50%" }} />
    </div>
  );
}
