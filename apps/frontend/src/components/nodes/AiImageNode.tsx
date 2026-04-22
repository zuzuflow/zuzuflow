import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { AiImageConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function AiImageNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as AiImageConfig;
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
          {cfg.provider ?? "openai"} · {cfg.model ?? "dall-e-3"}
        </span>
        {cfg.size && <span className="text-slate-500"> · {cfg.size}</span>}
      </div>
    </NodeWrapper>
  );
}
