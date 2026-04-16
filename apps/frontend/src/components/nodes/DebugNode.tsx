import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import { NodeWrapper } from "../canvas/NodeWrapper";
import { useExecutionStore } from "../../store/executionStore";
import { useWorkflowStore } from "../../store/workflowStore";

export function DebugNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  // Find the node directly upstream of this debug node via the edge list
  const upstreamNodeId = useWorkflowStore((s) => {
    const incomingEdge = s.edges.find((e) => e.target === id);
    return incomingEdge?.source ?? null;
  });

  const nodeOutputs = useExecutionStore((s) => s.nodeOutputs);

  // Prefer the upstream node's output (what the user wants to inspect).
  // Fall back to this node's own stored output if no upstream edge exists yet.
  const displayOutput =
    upstreamNodeId !== null
      ? nodeOutputs[upstreamNodeId]
      : nodeOutputs[id];

  const hasOutput = displayOutput !== undefined && displayOutput !== null;

  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Debug Output
        </p>

        {hasOutput ? (
          <pre className="text-[10px] leading-snug text-emerald-300 bg-slate-900 rounded p-2 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono">
            {JSON.stringify(displayOutput, null, 2)}
          </pre>
        ) : (
          <p className="text-[10px] text-slate-500 italic">
            Output will appear here after a run
          </p>
        )}
      </div>
    </NodeWrapper>
  );
}
