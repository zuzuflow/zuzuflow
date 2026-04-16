import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function SubflowInputNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="text-[10px] text-slate-500 italic">
        Receives payload from the parent workflow
      </div>
    </NodeWrapper>
  );
}
