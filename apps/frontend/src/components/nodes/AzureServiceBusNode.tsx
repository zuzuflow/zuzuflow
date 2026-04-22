import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { AzureServiceBusConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function AzureServiceBusNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as AzureServiceBusConfig;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="text-[10px] text-slate-300">
        <span className="font-semibold">{cfg.operation ?? "sendMessage"}</span>
        {cfg.entityName && <span className="text-slate-500"> · {cfg.entityName}</span>}
      </div>
    </NodeWrapper>
  );
}
