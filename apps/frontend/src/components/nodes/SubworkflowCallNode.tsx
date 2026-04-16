import type { WorkflowNodeProps } from "../../types/nodeProps";
import React, { useEffect, useRef } from "react";
import { Handle, Position } from "@xyflow/react";
import { Loader2, CheckCircle2, XCircle, MinusCircle, GitFork, Trash2 } from "lucide-react";
import type { SubworkflowCallConfig } from "@workflow/shared";
import { getWorkflow } from "../../lib/api";
import { useWorkflowStore } from "../../store/workflowStore";
import { useExecutionStore } from "../../store/executionStore";
import { cn } from "../../lib/utils";

// ─── Colour & name state stored outside component to survive re-renders ───────

const COLOR = "#0ea5e9";

export function SubworkflowCallNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as SubworkflowCallConfig;
  const outputCount = Math.max(1, cfg.outputCount ?? 1);

  const nodeStatus = useExecutionStore((s) => s.nodeStatuses[id]);
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const updateNodeConfig = useWorkflowStore((s) => s.updateNodeConfig);

  // Stores fetched subworkflow name
  const nameRef = useRef<string | null>(null);
  const [name, setName] = React.useState<string | null>(null);

  // Fetch the subworkflow details to sync outputCount + display name
  useEffect(() => {
    if (!cfg.subworkflowId) return;
    getWorkflow(cfg.subworkflowId)
      .then((wf) => {
        // Count subflow_output nodes in the template
        const outputNodes = wf.template.nodes.filter((n) => n.kind === "subflow_output");
        const actualCount = Math.max(1, outputNodes.length);
        nameRef.current = wf.name;
        setName(wf.name);
        if (actualCount !== cfg.outputCount) {
          updateNodeConfig(id, { outputCount: actualCount } as Partial<SubworkflowCallConfig>);
        }
      })
      .catch(() => {
        setName(null);
      });
  }, [cfg.subworkflowId]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusClass = {
    running: "node-status-running",
    completed: "node-status-completed",
    failed: "node-status-failed",
    skipped: "node-status-skipped",
  }[nodeStatus ?? ""] ?? "";

  // Build output handle labels from cached subflow info (optional)
  const outputs = Array.from({ length: outputCount }, (_, i) => i);

  return (
    <div
      className={cn(
        "relative rounded-lg overflow-hidden bg-slate-800 border border-slate-600",
        selected && "border-indigo-500",
        statusClass
      )}
      style={{ minWidth: 200, maxWidth: 280 }}
    >
      {/* Single target handle on the left */}
      <Handle
        type="target"
        id="input"
        position={Position.Left}
        style={{ top: "50%" }}
        title="Input"
      />

      {/* Dynamic source handles on the right — one per output */}
      {outputs.map((i) => {
        const topPct = outputs.length === 1
          ? 50
          : ((i + 1) / (outputs.length + 1)) * 100;
        return (
          <Handle
            key={`output_${i}`}
            type="source"
            id={`output_${i}`}
            position={Position.Right}
            style={{ top: `${topPct}%` }}
            title={`Output ${i + 1}`}
          />
        );
      })}

      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-2 text-white" style={{ backgroundColor: COLOR }}>
        <GitFork size={13} className="shrink-0 opacity-90" />
        <span className="text-xs font-semibold truncate flex-1">{data.label}</span>

        {nodeStatus === "running" && <Loader2 size={13} className="animate-spin shrink-0" />}
        {nodeStatus === "completed" && <CheckCircle2 size={13} className="shrink-0 text-green-300" />}
        {nodeStatus === "failed" && <XCircle size={13} className="shrink-0 text-red-300" />}
        {nodeStatus === "skipped" && <MinusCircle size={13} className="shrink-0 text-slate-300" />}

        <button
          className="nodrag nopan ml-auto flex items-center justify-center w-5 h-5 rounded opacity-40 hover:opacity-100 hover:bg-red-600 text-white transition-all shrink-0"
          title="Delete node"
          disabled={nodeStatus === "running"}
          onClick={(e) => { e.stopPropagation(); removeNode(id); }}
        >
          <Trash2 size={11} />
        </button>
      </div>

      {/* Body */}
      <div className="px-3 py-2 text-xs space-y-1">
        {cfg.subworkflowId ? (
          <div className="flex items-center gap-1.5">
            <span className="text-sky-400 font-medium truncate">
              {name ?? cfg.subworkflowId.slice(0, 8) + "…"}
            </span>
          </div>
        ) : (
          <span className="italic text-slate-500">no subworkflow selected</span>
        )}

        {/* Output port labels */}
        <div className="flex flex-col items-end gap-0.5 pt-1">
          {outputs.map((i) => (
            <div key={i} className="text-[10px] text-slate-500 flex items-center gap-1">
              <span>output {i + 1}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-sky-600" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
