import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { SlackConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function SlackNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as SlackConfig;
  const preview = cfg.message?.slice(0, 40) ?? "";
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      {cfg.channel && (
        <div className="text-[10px] text-slate-400">#{cfg.channel}</div>
      )}
      <div className="text-[10px] text-slate-300 truncate">
        {preview || <span className="text-slate-500 italic">no message</span>}
      </div>
    </NodeWrapper>
  );
}
