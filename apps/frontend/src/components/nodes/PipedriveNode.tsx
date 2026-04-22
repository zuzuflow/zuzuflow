import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { PipedriveConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function PipedriveNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as PipedriveConfig;
  return (
    <NodeWrapper
      nodeId={id}
      kind={data.kind}
      label={data.label}
      selected={selected}
      style={data.style}
    >
      <div className="text-[10px] text-slate-300">
        <span className="font-semibold">
          {cfg.operation ?? "deals.create"}
        </span>
        {cfg.objectId && (
          <span className="text-slate-500"> · {cfg.objectId}</span>
        )}
        {cfg.searchTerm && !cfg.objectId && (
          <span className="text-slate-500"> · “{cfg.searchTerm}”</span>
        )}
      </div>
    </NodeWrapper>
  );
}
