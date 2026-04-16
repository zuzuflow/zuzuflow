import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { WorkflowTriggerOutConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function WorkflowTriggerOutNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as WorkflowTriggerOutConfig;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="text-slate-300 text-[10px] truncate">
        → {cfg.targetWorkflowId || <span className="text-slate-500 italic">no target</span>}
      </div>
    </NodeWrapper>
  );
}
