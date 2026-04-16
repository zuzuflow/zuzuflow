import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { RedisConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function RedisNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as RedisConfig;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="text-[10px] text-slate-300">
        <span className="font-semibold uppercase">{cfg.operation ?? "get"}</span>
        {cfg.key && <span className="text-slate-500 font-mono"> {cfg.key.slice(0, 24)}</span>}
      </div>
    </NodeWrapper>
  );
}
