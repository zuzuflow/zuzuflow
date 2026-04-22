import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { GithubConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

/**
 * GitHub node — issues, PRs, repos, workflow dispatches.
 */
export function GithubNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as GithubConfig;
  const repo =
    cfg.owner && cfg.repo ? `${cfg.owner}/${cfg.repo}` : undefined;
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
        {repo && <span className="text-slate-500"> · {repo}</span>}
        {cfg.number && <span className="text-slate-500"> #{cfg.number}</span>}
      </div>
    </NodeWrapper>
  );
}
