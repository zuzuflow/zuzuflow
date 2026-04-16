import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { FirebasePushConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function FirebasePushNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as FirebasePushConfig;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-800/60 text-amber-300">
            {cfg.targetType === "topic" ? "Topic" : "Token"}
          </span>
          <span className="text-[10px] text-slate-300 truncate">
            {cfg.target || "—"}
          </span>
        </div>
        <div className="text-[10px] text-slate-400 truncate">
          {cfg.title || <span className="text-slate-500 italic">no title</span>}
        </div>
      </div>
    </NodeWrapper>
  );
}
