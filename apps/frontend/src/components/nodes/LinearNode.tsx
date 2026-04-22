import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { LinearConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function LinearNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as LinearConfig;
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
        {cfg.issueId && (
          <span className="text-slate-500"> · {cfg.issueId.slice(0, 8)}…</span>
        )}
      </div>
    </NodeWrapper>
  );
}
