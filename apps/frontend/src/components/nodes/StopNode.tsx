import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import { Handle, Position } from "@xyflow/react";
import { OctagonX, Loader2, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import type { StopConfig } from "@workflow/shared";
import { useWorkflowStore } from "../../store/workflowStore";
import { useExecutionStore } from "../../store/executionStore";
import { cn } from "../../lib/utils";

export function StopNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as StopConfig;
  const nodeStatus = useExecutionStore((s) => s.nodeStatuses[id]);
  const removeNode = useWorkflowStore((s) => s.removeNode);

  // Octagon clip-path
  const octagon = "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)";

  return (
    <div className="relative" style={{ width: 90, height: 90 }}>
      {/* Input handle */}
      <Handle type="target" position={Position.Top} id="in" style={{ left: "50%" }} />

      {/* Octagon — stop sign shape */}
      <div
        className={cn(
          "absolute inset-0 transition-all",
          selected && "drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]"
        )}
        style={{
          clipPath: octagon,
          background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
        }}
      />
      <div
        className="absolute"
        style={{
          top: 3, left: 3, right: 3, bottom: 3,
          clipPath: octagon,
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
        }}
      />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
        <OctagonX size={16} className="text-red-400 mb-0.5" />
        <span className="text-[10px] font-bold text-white">{data.label}</span>
        {cfg.message && (
          <span className="text-[7px] text-slate-400 max-w-[60px] truncate text-center">{cfg.message}</span>
        )}
        {nodeStatus === "completed" && <CheckCircle2 size={10} className="text-green-400 mt-0.5" />}
        {nodeStatus === "failed" && <XCircle size={10} className="text-red-400 mt-0.5" />}
      </div>

      {/* Delete */}
      <button
        className="absolute top-[10%] right-[10%] z-20 w-4 h-4 flex items-center justify-center rounded-full opacity-0 hover:opacity-100 bg-red-600/80 text-white transition-opacity nodrag nopan"
        onClick={(e) => { e.stopPropagation(); removeNode(id); }}
      >
        <Trash2 size={8} />
      </button>
    </div>
  );
}
