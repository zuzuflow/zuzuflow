import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import { Handle, Position } from "@xyflow/react";
import { GitBranch, Loader2, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import type { IfElseConfig } from "@workflow/shared";
import { useWorkflowStore } from "../../store/workflowStore";
import { useExecutionStore } from "../../store/executionStore";
import { cn } from "../../lib/utils";

export function IfElseNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as IfElseConfig;
  const ruleCount = cfg.condition?.rules?.length ?? 0;
  const combinator = (cfg.condition?.combinator ?? "and").toUpperCase();
  const nodeStatus = useExecutionStore((s) => s.nodeStatuses[id]);
  const removeNode = useWorkflowStore((s) => s.removeNode);

  return (
    <div className="relative" style={{ width: 160, height: 120 }}>
      {/* Input handle — top center */}
      <Handle type="target" position={Position.Top} id="in" style={{ left: "50%" }} />

      {/* Diamond shape */}
      <div
        className={cn(
          "absolute inset-0 transition-all",
          selected && "drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]"
        )}
        style={{
          clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
          background: "linear-gradient(135deg, #FF9F29 0%, #E8890C 100%)",
        }}
      />

      {/* Inner diamond (dark fill) */}
      <div
        className="absolute"
        style={{
          top: 3, left: 3, right: 3, bottom: 3,
          clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
        }}
      />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
        <div className="flex items-center gap-1 mb-1">
          <GitBranch size={12} className="text-amber-400" />
          <span className="text-[11px] font-bold text-white">{data.label}</span>
          {nodeStatus === "running" && <Loader2 size={11} className="animate-spin text-white" />}
          {nodeStatus === "completed" && <CheckCircle2 size={11} className="text-green-400" />}
          {nodeStatus === "failed" && <XCircle size={11} className="text-red-400" />}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-slate-400">{ruleCount} rule{ruleCount !== 1 ? "s" : ""}</span>
          <span className="px-1 py-px rounded text-[8px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {combinator}
          </span>
        </div>
      </div>

      {/* Delete button */}
      <button
        className="absolute top-1 right-[30%] z-20 w-4 h-4 flex items-center justify-center rounded-full opacity-0 hover:opacity-100 bg-red-600/80 text-white transition-opacity nodrag nopan"
        style={{ transform: "translate(50%, 50%)" }}
        onClick={(e) => { e.stopPropagation(); removeNode(id); }}
      >
        <Trash2 size={8} />
      </button>

      {/* Output handles */}
      <Handle type="source" position={Position.Bottom} id="true" style={{ left: "33%" }} />
      <Handle type="source" position={Position.Bottom} id="false" style={{ left: "67%" }} />

      {/* Handle labels */}
      <span className="absolute bottom-[-2px] text-[8px] font-semibold text-emerald-400 pointer-events-none" style={{ left: "33%", transform: "translateX(-50%)" }}>
        true
      </span>
      <span className="absolute bottom-[-2px] text-[8px] font-semibold text-red-400 pointer-events-none" style={{ left: "67%", transform: "translateX(-50%)" }}>
        false
      </span>
    </div>
  );
}
