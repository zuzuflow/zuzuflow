import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { JiraConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function JiraNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as JiraConfig;
  return (
    <NodeWrapper
      nodeId={id}
      kind={data.kind}
      label={data.label}
      selected={selected}
      style={data.style}
    >
      <div className="text-[10px] text-slate-300">
        <span className="font-semibold">{cfg.operation ?? "issues.create"}</span>
        {cfg.issueKey && (
          <span className="text-slate-500"> · {cfg.issueKey}</span>
        )}
        {cfg.projectKey && !cfg.issueKey && (
          <span className="text-slate-500"> · {cfg.projectKey}</span>
        )}
      </div>
    </NodeWrapper>
  );
}
