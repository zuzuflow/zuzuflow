import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { AzureCosmosConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function AzureCosmosNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as AzureCosmosConfig;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="text-[10px] text-slate-300">
        <span className="font-semibold">{cfg.operation ?? "query"}</span>
        {cfg.databaseId && <span className="text-slate-500"> · {cfg.databaseId}/{cfg.containerId}</span>}
      </div>
    </NodeWrapper>
  );
}
