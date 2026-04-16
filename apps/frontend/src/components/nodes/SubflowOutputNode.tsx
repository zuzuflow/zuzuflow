import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { SubflowOutputConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function SubflowOutputNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as SubflowOutputConfig;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="text-[10px] text-sky-400 font-medium">
        Output port {(cfg.outputIndex ?? 0) + 1}
        {cfg.label ? ` — ${cfg.label}` : ""}
      </div>
      <div className="text-[10px] text-slate-500 italic">
        Returns data to output handle {(cfg.outputIndex ?? 0) + 1} on the parent node
      </div>
    </NodeWrapper>
  );
}
