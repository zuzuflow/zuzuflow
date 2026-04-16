import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { SendEmailConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function SendEmailNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as SendEmailConfig;
  const to = Array.isArray(cfg.to) ? cfg.to[0] : cfg.to;
  const toDisplay = to.length > 28 ? to.slice(0, 25) + "..." : to;

  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      <div className="text-slate-300 truncate">
        <span className="text-slate-500">to: </span>{toDisplay}
      </div>
      <div className="flex items-center gap-1">
        <span className="px-1.5 py-0.5 rounded bg-emerald-900 text-emerald-300 text-[10px] font-medium uppercase">
          {cfg.provider}
        </span>
      </div>
    </NodeWrapper>
  );
}
