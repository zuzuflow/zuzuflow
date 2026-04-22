import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { ElasticsearchConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function ElasticsearchNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as ElasticsearchConfig;
  return (
    <NodeWrapper
      nodeId={id}
      kind={data.kind}
      label={data.label}
      selected={selected}
      style={data.style}
    >
      <div className="text-[10px] text-slate-300">
        <span className="font-semibold">{cfg.operation ?? "index"}</span>
        {cfg.index && <span className="text-slate-500"> · {cfg.index}</span>}
        {cfg.documentId && (
          <span className="text-slate-500">/{cfg.documentId}</span>
        )}
      </div>
    </NodeWrapper>
  );
}
