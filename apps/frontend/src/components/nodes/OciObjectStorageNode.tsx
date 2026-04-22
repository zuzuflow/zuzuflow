import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { OciObjectStorageConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function OciObjectStorageNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as OciObjectStorageConfig;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="text-[10px] text-slate-300">
        <span className="font-semibold">{cfg.operation ?? "putObject"}</span>
        {cfg.bucket && <span className="text-slate-500"> · {cfg.bucket}</span>}
        {cfg.object && <span className="text-slate-500">/{cfg.object}</span>}
      </div>
    </NodeWrapper>
  );
}
