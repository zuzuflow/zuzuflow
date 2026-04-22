import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { GitlabConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function GitlabNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as GitlabConfig;
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
          {cfg.operation ?? "issues.create"}
        </span>
        {cfg.projectId && (
          <span className="text-slate-500"> · {cfg.projectId}</span>
        )}
        {cfg.iid && <span className="text-slate-500"> !{cfg.iid}</span>}
      </div>
    </NodeWrapper>
  );
}
