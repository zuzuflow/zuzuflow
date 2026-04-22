import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { VectorDbConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function VectorDbNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as VectorDbConfig;
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
          {cfg.provider ?? "pinecone"} · {cfg.operation ?? "upsert"}
        </span>
        {cfg.collection && (
          <span className="text-slate-500"> · {cfg.collection}</span>
        )}
      </div>
    </NodeWrapper>
  );
}
