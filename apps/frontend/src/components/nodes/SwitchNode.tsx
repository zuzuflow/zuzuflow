import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import { Handle, Position } from "@xyflow/react";
import { ToggleLeft, Loader2, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import type { SwitchConfig } from "@workflow/shared";
import { useWorkflowStore } from "../../store/workflowStore";
import { useExecutionStore } from "../../store/executionStore";
import { cn } from "../../lib/utils";

export function SwitchNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as SwitchConfig;
  const caseCount = cfg.cases?.length ?? 0;
  const expr = (cfg.expression ?? "").length > 22 ? cfg.expression.slice(0, 19) + "..." : cfg.expression;
  const nodeStatus = useExecutionStore((s) => s.nodeStatuses[id]);
  const removeNode = useWorkflowStore((s) => s.removeNode);

  // All source handles: cases + default
  const allHandles = [
    ...cfg.cases.map((c) => ({ id: c.label || String(c.value), label: c.label || String(c.value) })),
    ...(cfg.defaultLabel ? [{ id: "default", label: cfg.defaultLabel }] : []),
  ];

  return (
    <div className="relative" style={{ width: 180, height: 130 }}>
      {/* Input handle */}
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
          <ToggleLeft size={12} className="text-amber-400" />
          <span className="text-[11px] font-bold text-white">{data.label}</span>
          {nodeStatus === "running" && <Loader2 size={11} className="animate-spin text-white" />}
          {nodeStatus === "completed" && <CheckCircle2 size={11} className="text-green-400" />}
          {nodeStatus === "failed" && <XCircle size={11} className="text-red-400" />}
        </div>
        <div className="font-mono text-[8px] text-slate-400 truncate max-w-[100px]">{expr}</div>
        <div className="text-[8px] text-slate-500 mt-0.5">
          {caseCount} case{caseCount !== 1 ? "s" : ""}{cfg.defaultLabel ? " + default" : ""}
        </div>
      </div>

      {/* Delete */}
      <button
        className="absolute top-1 right-[28%] z-20 w-4 h-4 flex items-center justify-center rounded-full opacity-0 hover:opacity-100 bg-red-600/80 text-white transition-opacity nodrag nopan"
        onClick={(e) => { e.stopPropagation(); removeNode(id); }}
      >
        <Trash2 size={8} />
      </button>

      {/* Output handles — spread along bottom */}
      {allHandles.map((h, i) => {
        const pct = ((i + 1) / (allHandles.length + 1)) * 100;
        return (
          <React.Fragment key={h.id}>
            <Handle type="source" position={Position.Bottom} id={h.id} style={{ left: `${pct}%` }} />
            <span
              className="absolute bottom-[-2px] text-[7px] font-medium text-amber-300/70 pointer-events-none"
              style={{ left: `${pct}%`, transform: "translateX(-50%)" }}
            >
              {h.label}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}
