import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { GcpPubSubConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function GcpPubSubNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as GcpPubSubConfig;
  const target = cfg.topic ?? cfg.subscription;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="text-[10px] text-slate-300">
        <span className="font-semibold">{cfg.operation ?? "publish"}</span>
        {target && <span className="text-slate-500"> · {target}</span>}
      </div>
    </NodeWrapper>
  );
}
