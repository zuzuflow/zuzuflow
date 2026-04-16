import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import { Handle, Position } from "@xyflow/react";
import { Repeat, Loader2, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import type { LoopConfig } from "@workflow/shared";
import { useWorkflowStore } from "../../store/workflowStore";
import { useExecutionStore } from "../../store/executionStore";
import { cn } from "../../lib/utils";

export function LoopNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as LoopConfig;
  const itemsPreview = (cfg.items ?? "").slice(0, 28) || "items";
  const maxIter = cfg.maxIterations ?? 1000;
  const nodeStatus = useExecutionStore((s) => s.nodeStatuses[id]);
  const removeNode = useWorkflowStore((s) => s.removeNode);

  return (
    <div className="relative" style={{ width: 170, height: 80 }}>
      {/* Input handle */}
      <Handle type="target" position={Position.Top} id="in" style={{ left: "50%" }} />

      {/* Rounded rect with loop accent — extra rounded corners */}
      <div
        className={cn(
          "absolute inset-0 rounded-2xl transition-all",
          selected && "ring-2 ring-indigo-500 ring-offset-1 ring-offset-transparent"
        )}
        style={{
          background: "linear-gradient(135deg, #FF9F29 0%, #E8890C 100%)",
        }}
      />
      <div
        className="absolute rounded-2xl"
        style={{
          top: 2.5, left: 2.5, right: 2.5, bottom: 2.5,
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
        }}
      />

      {/* Loop accent — recycling arrows */}
      <div className="absolute top-1 right-2 z-10 pointer-events-none opacity-10">
        <Repeat size={32} className="text-amber-400" />
      </div>

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none px-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Repeat size={13} className={cn("text-amber-400", nodeStatus === "running" && "animate-spin")} />
          <span className="text-[11px] font-bold text-white">{data.label}</span>
          {nodeStatus === "running" && <Loader2 size={11} className="animate-spin text-amber-300" />}
          {nodeStatus === "completed" && <CheckCircle2 size={11} className="text-green-400" />}
          {nodeStatus === "failed" && <XCircle size={11} className="text-red-400" />}
        </div>
        <div className="flex items-center gap-1 text-[8px] text-slate-400">
          <span className="font-mono truncate max-w-[90px]">{itemsPreview}</span>
          <span className="text-slate-600">·</span>
          <span>max {maxIter}</span>
        </div>
      </div>

      {/* Delete */}
      <button
        className="absolute top-1 right-1 z-20 w-4 h-4 flex items-center justify-center rounded-full opacity-0 hover:opacity-100 bg-red-600/80 text-white transition-opacity nodrag nopan"
        onClick={(e) => { e.stopPropagation(); removeNode(id); }}
      >
        <Trash2 size={8} />
      </button>

      {/* Output handles */}
      <Handle type="source" position={Position.Bottom} id="body" style={{ left: "35%" }} />
      <Handle type="source" position={Position.Bottom} id="done" style={{ left: "65%" }} />

      {/* Handle labels */}
      <span className="absolute bottom-[-1px] text-[7px] font-semibold text-amber-300/70 pointer-events-none" style={{ left: "35%", transform: "translateX(-50%)" }}>
        body
      </span>
      <span className="absolute bottom-[-1px] text-[7px] font-semibold text-emerald-400/70 pointer-events-none" style={{ left: "65%", transform: "translateX(-50%)" }}>
        done
      </span>
    </div>
  );
}
