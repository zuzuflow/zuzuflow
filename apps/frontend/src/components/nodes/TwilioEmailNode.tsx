import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { TwilioEmailConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function TwilioEmailNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as TwilioEmailConfig;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      {cfg.to && <div className="text-[10px] text-slate-400 truncate">To: {cfg.to}</div>}
      <div className="text-[10px] text-slate-300 truncate">
        {cfg.subject || <span className="text-slate-500 italic">no subject</span>}
      </div>
    </NodeWrapper>
  );
}
