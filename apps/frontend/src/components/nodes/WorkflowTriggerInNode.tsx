import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { WorkflowTriggerInConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function WorkflowTriggerInNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as WorkflowTriggerInConfig;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      {cfg.description ? (
        <div className="text-slate-300 text-[10px]">{cfg.description}</div>
      ) : (
        <div className="text-slate-500 text-[10px]">Triggered by another workflow</div>
      )}
    </NodeWrapper>
  );
}
