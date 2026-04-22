import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { CircleCIConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function CircleCINode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as CircleCIConfig;
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
          {cfg.operation ?? "pipelines.trigger"}
        </span>
        {cfg.projectSlug && (
          <span className="text-slate-500"> · {cfg.projectSlug}</span>
        )}
      </div>
    </NodeWrapper>
  );
}
