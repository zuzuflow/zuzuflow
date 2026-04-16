import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { Base64Config } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function Base64Node({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as Base64Config;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="text-[10px] text-slate-300">
        Operation: <span className="font-semibold">{cfg.operation ?? "encode"}</span>
      </div>
    </NodeWrapper>
  );
}
