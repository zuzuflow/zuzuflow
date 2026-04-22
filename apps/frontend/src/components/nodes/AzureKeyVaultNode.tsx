import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { AzureKeyVaultConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function AzureKeyVaultNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as AzureKeyVaultConfig;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="text-[10px] text-slate-300">
        <span className="font-semibold">{cfg.operation ?? "getSecret"}</span>
        {cfg.secretName && <span className="text-slate-500"> · {cfg.secretName}</span>}
      </div>
    </NodeWrapper>
  );
}
