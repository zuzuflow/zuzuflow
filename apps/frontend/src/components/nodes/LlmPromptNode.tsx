import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { LlmPromptConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function LlmPromptNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as LlmPromptConfig;
  const preview = cfg.prompt?.slice(0, 40) ?? "";
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="text-[10px] text-slate-400">
        {cfg.provider ?? "openai"} · <span className="font-mono">{cfg.model || "—"}</span>
      </div>
      <div className="text-[10px] text-slate-300 truncate">
        {preview || <span className="text-slate-500 italic">no prompt</span>}
      </div>
    </NodeWrapper>
  );
}
