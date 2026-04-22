import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { AiTtsConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function AiTtsNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as AiTtsConfig;
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
          {cfg.provider ?? "openai"} · {cfg.model ?? "tts-1"}
        </span>
        {cfg.voice && <span className="text-slate-500"> · {cfg.voice}</span>}
      </div>
    </NodeWrapper>
  );
}
