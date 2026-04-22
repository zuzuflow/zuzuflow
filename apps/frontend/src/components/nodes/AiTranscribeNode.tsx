import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { AiTranscribeConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function AiTranscribeNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as AiTranscribeConfig;
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
          {cfg.provider ?? "openai"} · {cfg.model ?? "whisper-1"}
        </span>
        {cfg.language && (
          <span className="text-slate-500"> · {cfg.language}</span>
        )}
      </div>
    </NodeWrapper>
  );
}
