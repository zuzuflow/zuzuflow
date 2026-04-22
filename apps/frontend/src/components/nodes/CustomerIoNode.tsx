import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { CustomerIoConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function CustomerIoNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as CustomerIoConfig;
  return (
    <NodeWrapper
      nodeId={id}
      kind={data.kind}
      label={data.label}
      selected={selected}
      style={data.style}
    >
      <div className="text-[10px] text-slate-300">
        <span className="font-semibold">{cfg.operation ?? "identify"}</span>
        {cfg.customerId && (
          <span className="text-slate-500"> · {cfg.customerId}</span>
        )}
        {cfg.eventName && (
          <span className="text-slate-500"> · {cfg.eventName}</span>
        )}
      </div>
    </NodeWrapper>
  );
}
