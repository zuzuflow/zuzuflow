import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function ManualTriggerNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="flex items-center gap-2 text-slate-300 text-xs">
        <span className="px-2 py-0.5 rounded bg-violet-800 text-violet-200 font-semibold uppercase tracking-wide text-[10px]">
          Click Run to execute
        </span>
      </div>
      <div className="text-slate-500 text-[10px] mt-1">
        Starts the workflow immediately when triggered
      </div>
    </NodeWrapper>
  );
}
