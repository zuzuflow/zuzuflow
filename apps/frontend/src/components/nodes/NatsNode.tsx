import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { NatsConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function NatsNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as NatsConfig;
  return (
    <NodeWrapper
      nodeId={id}
      kind={data.kind}
      label={data.label}
      selected={selected}
      style={data.style}
    >
      <div className="text-[10px] text-slate-300">
        <span className="font-semibold">{cfg.operation ?? "publish"}</span>
        {cfg.subject && (
          <span className="text-slate-500"> · {cfg.subject}</span>
        )}
      </div>
    </NodeWrapper>
  );
}
