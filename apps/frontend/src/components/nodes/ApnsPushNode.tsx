import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { ApnsPushConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function ApnsPushNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as ApnsPushConfig;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${cfg.production ? "bg-red-800/60 text-red-300" : "bg-sky-800/60 text-sky-300"}`}>
            {cfg.production ? "Production" : "Sandbox"}
          </span>
          <span className="text-[10px] text-slate-400 font-mono truncate">
            {cfg.bundleId || "—"}
          </span>
        </div>
        <div className="text-[10px] text-slate-300 truncate">
          {cfg.title || <span className="text-slate-500 italic">no title</span>}
        </div>
      </div>
    </NodeWrapper>
  );
}
