import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { PostgresConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function PostgresNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as PostgresConfig;
  const preview = cfg.query.replace(/\s+/g, " ").trim();
  const truncated = preview.length > 50 ? preview.slice(0, 47) + "..." : preview;

  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="font-mono text-[10px] text-slate-300 break-all leading-relaxed">
        {truncated}
      </div>
    </NodeWrapper>
  );
}
