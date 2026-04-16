import type { WorkflowNodeProps } from "../../types/nodeProps";
import React from "react";
import type { TwilioSmsConfig } from "@workflow/shared";
import { NodeWrapper } from "../canvas/NodeWrapper";

export function TwilioSmsNode({ id, data, selected }: WorkflowNodeProps): React.ReactElement {
  const cfg = data.config as TwilioSmsConfig;
  return (
    <NodeWrapper nodeId={id} kind={data.kind} label={data.label} selected={selected} style={data.style}>
      {cfg.to && <div className="text-[10px] text-slate-400">To: {cfg.to}</div>}
      <div className="text-[10px] text-slate-300 truncate">
        {cfg.body?.slice(0, 40) || <span className="text-slate-500 italic">no message</span>}
      </div>
    </NodeWrapper>
  );
}
