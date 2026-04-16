import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { DataMapperConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function DataMapperNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as DataMapperConfig;
  const count = cfg.mappings?.length ?? 0;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="text-slate-400 text-[10px]">
        {count} mapping{count !== 1 ? "s" : ""}
      </div>
    </NodeWrapper>
  );
}
