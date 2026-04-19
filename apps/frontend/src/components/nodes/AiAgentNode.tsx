import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { AiAgentConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function AiAgentNode({
  id,
  data,
  selected,
}: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as AiAgentConfig;
  const toolCount = cfg.tools?.length ?? 0;
  const preview = cfg.prompt?.slice(0, 30) ?? "";
  return (
    <NodeWrapper
      nodeId={id}
      kind={data.kind}
      label={data.label}
      selected={selected}
      style={data.style}
    >
      <div className="text-[10px] text-slate-400">
        {cfg.provider ?? "openai"} ·{" "}
        <span className="font-mono">{cfg.model || "—"}</span>
      </div>
      <div className="text-[10px] text-slate-400">
        {toolCount} tool{toolCount !== 1 ? "s" : ""} · max{" "}
        {cfg.maxIterations ?? 10} iter
      </div>
      <div className="text-[10px] text-slate-300 truncate">
        {preview || <span className="text-slate-500 italic">no prompt</span>}
      </div>
    </NodeWrapper>
  );
}
